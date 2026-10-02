#!/usr/bin/env python3
"""公開のあとに、重賞の記事の URL だけを IndexNow へ知らせる。

IndexNow は「この URL が新しくなった」と検索エンジン（Bing など）へ伝える無料の仕組み。
公開の Workflow（deploy-frontend-cloud-run.yml）が、公開の確認が済んだあとに1回だけ呼ぶ。

決まり：
- 送るのは、前回の公開から今回の公開までに足された・変わった重賞の記事だけ。
- 前回の公開が今回より古い版だと確かめられないときは、送らない。
- 1回に送る本数には上限がある（既定 10 本。--limit で変えられる）。
- 0 本なら何も送らずに終わる。
- 失敗（通信・4xx・5xx・設定の不足）は警告を出すだけで、終了コードは 0（公開を止めない）。
- --dry-run は URL を表示するだけで、送らない。手元で動かすのは --dry-run だけにする。

使い方：
  公開の Workflow（GitHub の比べる API の結果を渡す）
    python backend/scripts/agents/indexnow_grade_race_articles.py --compare-json compare.json
  手元での試し（送らない）
    python backend/scripts/agents/indexnow_grade_race_articles.py --base-sha <前回> --head-sha <今回> --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable, Iterable, Optional


REPO_ROOT = Path(__file__).resolve().parents[3]
ARTICLES_DIR = "frontend/content/articles"
PUBLIC_DIR = REPO_ROOT / "frontend" / "public"
CANONICAL_OVERRIDES_PATH = REPO_ROOT / "frontend" / "content" / "reference" / "grade-race-canonical-overrides.json"

SITE_HOST = "uma-free.com"
SITE_ORIGIN = f"https://{SITE_HOST}"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
DEFAULT_LIMIT = 10
REQUEST_TIMEOUT_SECONDS = 15

# 重賞の記事の印。category が「重賞攻略」の記事は 158 本、entity_type が grade_race の記事はその中の 110 本（2026-10-02 に数えた）。
GRADE_RACE_CATEGORY = "重賞攻略"
GRADE_RACE_ENTITY_TYPE = "grade_race"

# IndexNow の鍵の決まり：英数字とハイフンで 8〜128 文字。
INDEXNOW_KEY_PATTERN = re.compile(r"^[A-Za-z0-9-]{8,128}$")
# frontend/lib/article-canonical.ts の REDIRECTED_ARTICLE_PATHS に手で書かれている分。
STATIC_REDIRECTED_ARTICLE_PATHS = ("/articles/courses/hakodate/turf-1200m",)

# 足された記事を先に、変わった記事をあとに送る（上限に当たったときに、新しい記事を落とさない）。
STATUS_PRIORITY = {"added": 0, "modified": 1}
COMPARE_STATUS_MAP = {
    "added": "added",
    "copied": "added",
    "renamed": "added",
    "modified": "modified",
    "changed": "modified",
}
GIT_STATUS_MAP = {"A": "added", "C": "added", "R": "added", "M": "modified"}
# GitHub の比べる API が1回で返すファイルの上限。
COMPARE_FILES_LIMIT = 300


def warn(message: str) -> None:
    """GitHub Actions の警告として出す（手元ではそのまま1行で見える）。"""
    print(f"::warning::IndexNow: {message}")


def parse_front_matter(text: str) -> dict[str, str]:
    """記事の先頭（--- で囲まれた所）から、字下げのない「鍵: 値」だけを読む。

    ここで使うのは category・entity_type・draft・canonical_path・canonical_slug だけなので、
    YAML の部品を足さずに1行ずつ読む。リストや複数行の値は読まない。
    """
    lines = text.lstrip("﻿").splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    values: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            return values
        matched = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$", line)
        if not matched:
            continue
        value = matched.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        values[matched.group(1)] = value.strip()
    # 終わりの --- が無い記事は、先頭を読めなかった物として扱う。
    return {}


def is_draft(front_matter: dict[str, str]) -> bool:
    return front_matter.get("draft", "").lower() == "true"


def is_grade_race_article(front_matter: dict[str, str]) -> bool:
    return (
        front_matter.get("category") == GRADE_RACE_CATEGORY
        or (front_matter.get("entity_type") or front_matter.get("entityType")) == GRADE_RACE_ENTITY_TYPE
    )


def resolve_canonical_path(front_matter: dict[str, str], slug: str) -> str:
    """frontend/lib/article-canonical.ts の resolveArticleCanonicalPath と同じ順で決める。"""
    raw = (front_matter.get("canonical_path") or front_matter.get("canonicalPath") or "").strip()
    if raw and raw.startswith("/") and not re.match(r"^https?://", raw, re.IGNORECASE):
        return raw.rstrip("/") if len(raw) > 1 else raw
    return f"/articles/{front_matter.get('canonical_slug') or slug}"


def load_redirected_article_paths(overrides_path: Path = CANONICAL_OVERRIDES_PATH) -> set[str]:
    """301 で別の記事へ移した URL（送らない）。"""
    paths = set(STATIC_REDIRECTED_ARTICLE_PATHS)
    entries = json.loads(overrides_path.read_text(encoding="utf-8"))
    for entry in entries:
        for slug in entry.get("redirect_slugs") or []:
            paths.add(f"/articles/{slug}")
    return paths


def article_slug_from_path(path: str) -> Optional[str]:
    """記事のファイル（frontend/content/articles/<slug>.md）だけを通す。下の階層のファイルは通さない。"""
    normalized = path.replace("\\", "/").strip()
    prefix = f"{ARTICLES_DIR}/"
    if not normalized.startswith(prefix) or not normalized.endswith(".md"):
        return None
    slug = normalized[len(prefix):-len(".md")]
    if not slug or "/" in slug:
        return None
    return slug


def article_url(front_matter: dict[str, str], slug: str, redirected_paths: set[str]) -> Optional[str]:
    """サイトマップ（frontend/lib/article-sitemap.ts）と同じ決め方で、送る URL を決める。"""
    canonical_path = resolve_canonical_path(front_matter, slug)
    if not canonical_path.startswith("/articles/") or canonical_path in redirected_paths:
        return None
    return SITE_ORIGIN + urllib.parse.quote(canonical_path, safe="/-._~")


def select_urls(
    changed_files: Iterable[tuple[str, str]],
    read_article: Callable[[str], Optional[str]],
    redirected_paths: set[str],
    limit: int = DEFAULT_LIMIT,
) -> list[str]:
    """変わったファイルの一覧から、送る URL を選ぶ。

    changed_files は（"added" か "modified", ファイルのパス）の並び。
    read_article はパスを受け取り、今回の版の本文を返す（読めないときは None）。
    """
    if limit <= 0:
        return []
    candidates: list[tuple[int, str, str]] = []
    for status, path in changed_files:
        if status not in STATUS_PRIORITY:
            continue
        slug = article_slug_from_path(path)
        if slug is None:
            continue
        text = read_article(path)
        if text is None:
            continue
        front_matter = parse_front_matter(text)
        if not front_matter or is_draft(front_matter) or not is_grade_race_article(front_matter):
            continue
        url = article_url(front_matter, slug, redirected_paths)
        if url is None:
            continue
        candidates.append((STATUS_PRIORITY[status], slug, url))

    # 足された記事が先。その中では slug の新しい日付が先。
    candidates.sort(key=lambda item: item[1], reverse=True)
    candidates.sort(key=lambda item: item[0])
    urls: list[str] = []
    for _, _, url in candidates:
        if url not in urls:
            urls.append(url)
    return urls[:limit]


def changed_files_from_compare(payload: dict) -> Optional[list[tuple[str, str]]]:
    """GitHub の比べる API（compare）の結果から、変わったファイルを読む。

    前回の公開が今回より古い版（status が ahead）のときだけ一覧を返す。
    同じ版・巻き戻し・枝分かれは None（送らない）。
    """
    if payload.get("status") != "ahead":
        return None
    files = payload.get("files") or []
    if len(files) >= COMPARE_FILES_LIMIT:
        warn(f"変わったファイルが {len(files)} 件あり、一覧が途中で切れている可能性があります。")
    changed: list[tuple[str, str]] = []
    for entry in files:
        status = COMPARE_STATUS_MAP.get(str(entry.get("status") or ""))
        filename = entry.get("filename")
        if status and isinstance(filename, str):
            changed.append((status, filename))
    return changed


def run_git(arguments: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-c", "core.quotepath=false", *arguments],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def parse_git_name_status(output: str) -> list[tuple[str, str]]:
    """git diff --name-status の出力を読む。名前の変更（R）は新しい名前を「足された」として扱う。"""
    changed: list[tuple[str, str]] = []
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) < 2 or not parts[0]:
            continue
        status = GIT_STATUS_MAP.get(parts[0][0])
        if status:
            changed.append((status, parts[-1]))
    return changed


def changed_files_from_git(base_sha: str, head_sha: str) -> Optional[list[tuple[str, str]]]:
    """手元の git から、変わったファイルを読む。前回が今回より古い版でなければ None（送らない）。"""
    for sha in (base_sha, head_sha):
        if not re.fullmatch(r"[0-9a-fA-F]{7,40}", sha):
            warn("SHA の形が正しくありません。")
            return None
    # 巻き戻し・枝分かれ・手元に無い版は、ここで外れる（同じ版は、差分が空になる）。
    ancestor = run_git(["merge-base", "--is-ancestor", base_sha, head_sha])
    if ancestor.returncode != 0:
        return None
    diff = run_git(["diff", "--name-status", "--diff-filter=ACMR", base_sha, head_sha, "--", ARTICLES_DIR])
    if diff.returncode != 0:
        warn("git diff に失敗しました。")
        return None
    return parse_git_name_status(diff.stdout)


def read_article_from_worktree(path: str) -> Optional[str]:
    try:
        return (REPO_ROOT / path).read_text(encoding="utf-8")
    except OSError:
        return None


def read_article_from_git(head_sha: str) -> Callable[[str], Optional[str]]:
    def read(path: str) -> Optional[str]:
        shown = run_git(["show", f"{head_sha}:{path}"])
        return shown.stdout if shown.returncode == 0 else None

    return read


def find_indexnow_key(public_dir: Path = PUBLIC_DIR) -> Optional[str]:
    """鍵は frontend/public/<鍵>.txt（中身＝鍵）の1か所だけに置く。ちょうど1つ見つかったときだけ返す。"""
    keys = []
    for path in sorted(public_dir.glob("*.txt")):
        if not INDEXNOW_KEY_PATTERN.fullmatch(path.stem):
            continue
        try:
            content = path.read_text(encoding="utf-8").strip()
        except OSError:
            continue
        if content == path.stem:
            keys.append(path.stem)
    return keys[0] if len(keys) == 1 else None


def build_payload(urls: list[str], key: str) -> dict:
    return {
        "host": SITE_HOST,
        "key": key,
        "keyLocation": f"{SITE_ORIGIN}/{key}.txt",
        "urlList": urls,
    }


def send_to_indexnow(payload: dict, opener: Callable = urllib.request.urlopen) -> tuple[bool, str]:
    """IndexNow へ送る。成功（200・202）なら True。失敗は理由の文を返すだけで、例外を外へ出さない。"""
    request = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with opener(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            status = int(getattr(response, "status", 0) or response.getcode())
    except urllib.error.HTTPError as error:
        return False, f"HTTP {error.code}"
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return False, f"通信に失敗しました（{type(error).__name__}）"
    if status in (200, 202):
        return True, f"HTTP {status}"
    return False, f"HTTP {status}"


def write_step_summary(lines: list[str]) -> None:
    """GitHub Actions の実行結果のページに、送った URL を残す（手元では何もしない）。"""
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    try:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
    except OSError:
        pass


def parse_arguments(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="重賞の記事の URL だけを IndexNow へ知らせる。")
    parser.add_argument("--base-sha", help="前回公開した版の SHA（手元の git で比べる）")
    parser.add_argument("--head-sha", help="今回公開した版の SHA（手元の git で比べる）")
    parser.add_argument("--compare-json", help="GitHub の比べる API（compare）の結果を保存したファイル")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help=f"1回に送る本数の上限（既定 {DEFAULT_LIMIT}）")
    parser.add_argument("--dry-run", action="store_true", help="URL を表示するだけで、送らない")
    return parser.parse_args(argv)


def collect_urls(arguments: argparse.Namespace) -> list[str]:
    redirected_paths = load_redirected_article_paths()
    if arguments.compare_json:
        payload = json.loads(Path(arguments.compare_json).read_text(encoding="utf-8"))
        changed = changed_files_from_compare(payload)
        reader: Callable[[str], Optional[str]] = read_article_from_worktree
    elif arguments.base_sha and arguments.head_sha:
        changed = changed_files_from_git(arguments.base_sha, arguments.head_sha)
        reader = read_article_from_git(arguments.head_sha)
    else:
        warn("前回と今回の版が渡されていません（--compare-json か、--base-sha と --head-sha）。送りません。")
        return []
    if changed is None:
        print("IndexNow: 前回の公開が今回より古い版だと確かめられないため、送りません。")
        return []
    return select_urls(changed, reader, redirected_paths, arguments.limit)


def run(arguments: argparse.Namespace) -> None:
    urls = collect_urls(arguments)
    if not urls:
        print("IndexNow: 送る重賞の記事はありません（0 本）。")
        return

    print(f"IndexNow: 重賞の記事 {len(urls)} 本（上限 {arguments.limit} 本）")
    for url in urls:
        print(f"  {url}")

    key = find_indexnow_key()
    if arguments.dry_run:
        print(f"IndexNow: --dry-run のため送りません。鍵のファイル：{'あり' if key else 'なし'}")
        return
    if key is None:
        warn("鍵のファイル（frontend/public/<鍵>.txt）がちょうど1つ見つからないため、送りません。")
        return

    succeeded, detail = send_to_indexnow(build_payload(urls, key))
    if succeeded:
        print(f"IndexNow: 送りました（{detail}）。")
        write_step_summary([f"- IndexNow: 重賞の記事 {len(urls)} 本を送りました（{detail}）", *[f"  - {url}" for url in urls]])
    else:
        warn(f"送れませんでした（{detail}）。公開はそのまま続けます。")
        write_step_summary([f"- IndexNow: 送れませんでした（{detail}）"])


def main(argv: Optional[list[str]] = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        run(parse_arguments(argv))
    except Exception as error:  # 何が起きても公開を止めない
        warn(f"途中で止まりました（{type(error).__name__}）。公開はそのまま続けます。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
