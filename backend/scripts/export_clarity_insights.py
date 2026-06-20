#!/usr/bin/env python3
"""
Microsoft Clarity Data Export APIから直近のダッシュボード集計を取得する。

APIトークンは環境変数またはリポジトリ内の.envから読み込み、ログや成果物には出力しない。
Microsoft Clarityの1日10リクエスト制限を考慮し、既定のfullプロファイルは8回に抑える。
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_ENDPOINT = "https://www.clarity.ms/export-data/api/v1/project-live-insights"
MAX_REQUESTS_PER_DAY = 10
MAX_DIMENSIONS = 3

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class ExportQuery:
    name: str
    dimensions: tuple[str, ...]


CORE_QUERIES = (
    ExportQuery("overview", ()),
    ExportQuery("content_url", ("URL",)),
    ExportQuery("technology", ("Device", "OS", "Browser")),
    ExportQuery("acquisition", ("Source", "Medium", "Channel")),
)

PULSE_QUERIES = (
    ExportQuery("overview", ()),
    ExportQuery("content_device", ("URL", "Device")),
)

FULL_QUERIES = CORE_QUERIES + (
    ExportQuery("content_device", ("URL", "Device")),
    ExportQuery("content_source", ("URL", "Source")),
    ExportQuery("geography_device", ("Country/Region", "Device")),
    ExportQuery("campaign_acquisition", ("Campaign", "Source", "Medium")),
)

RANKING_KEYS = (
    "totalSessionCount",
    "sessionCount",
    "sessionsCount",
    "totalSessions",
    "activeUserCount",
    "distinctUserCount",
    "distantUserCount",
    "userCount",
    "traffic",
    "visits",
    "totalVisits",
    "count",
)

SENSITIVE_KEY_PATTERN = re.compile(
    r"(authorization|bearer|api[_-]?key|access[_-]?token|secret|password)",
    re.IGNORECASE,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Microsoft Clarityの直近ダッシュボード集計を安全に取得します。"
    )
    parser.add_argument(
        "--profile",
        choices=("pulse", "core", "full"),
        default="full",
        help=(
            "pulseは2リクエスト、coreは4リクエスト、"
            "fullは8リクエストを使用します。既定値: full"
        ),
    )
    parser.add_argument(
        "--num-days",
        type=int,
        choices=(1, 2, 3),
        default=3,
        help="取得対象期間。1=直近24時間、2=48時間、3=72時間。既定値: 3",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="出力先。未指定時はanalysis_results/clarity/<UTCタイムスタンプ>です。",
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=REPOSITORY_ROOT / ".env",
        help="CLARITY_API_KEYを読む.envファイル。",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="1リクエストのタイムアウト秒数。既定値: 30",
    )
    parser.add_argument(
        "--top-rows",
        type=int,
        default=20,
        help="summary.mdへ掲載する各指標の上位行数。既定値: 20",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="リクエスト間の待機秒数。既定値: 0.5",
    )
    return parser.parse_args()


def load_dotenv_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]
        values[key] = value

    return values


def resolve_configuration(env_file: Path) -> tuple[str, str]:
    file_values = load_dotenv_file(env_file)
    token = os.environ.get("CLARITY_API_KEY") or file_values.get("CLARITY_API_KEY", "")
    endpoint = (
        os.environ.get("CLARITY_ENDPOINT")
        or file_values.get("CLARITY_ENDPOINT")
        or DEFAULT_ENDPOINT
    )

    token = token.strip()
    endpoint = endpoint.strip()

    if not token:
        raise RuntimeError(
            "CLARITY_API_KEYが未設定です。Clarityの "
            "Settings > Data Export でAPIトークンを生成し、環境変数または.envへ設定してください。"
        )

    if endpoint.startswith("www.clarity.ms/"):
        endpoint = f"https://{endpoint}"

    parsed = urllib.parse.urlparse(endpoint)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "www.clarity.ms"
        or parsed.path != "/export-data/api/v1/project-live-insights"
    ):
        raise RuntimeError(
            "CLARITY_ENDPOINTはMicrosoft Clarity公式のData Export APIを指定してください。"
            f" 推奨値: {DEFAULT_ENDPOINT}"
        )

    return token, urllib.parse.urlunparse(
        ("https", "www.clarity.ms", parsed.path, "", "", "")
    )


def make_output_dir(path: Path | None) -> Path:
    if path is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        path = REPOSITORY_ROOT / "analysis_results" / "clarity" / timestamp
    elif not path.is_absolute():
        path = REPOSITORY_ROOT / path

    path.mkdir(parents=True, exist_ok=False)
    (path / "raw").mkdir()
    (path / "csv").mkdir()
    return path


def build_request_url(
    endpoint: str,
    num_days: int,
    dimensions: tuple[str, ...],
) -> str:
    if len(dimensions) > MAX_DIMENSIONS:
        raise ValueError(f"dimensionsは最大{MAX_DIMENSIONS}件です。")

    params: list[tuple[str, str]] = [("numOfDays", str(num_days))]
    for index, dimension in enumerate(dimensions, start=1):
        params.append((f"dimension{index}", dimension))
    return f"{endpoint}?{urllib.parse.urlencode(params)}"


def request_json(
    endpoint: str,
    token: str,
    query: ExportQuery,
    num_days: int,
    timeout: float,
) -> tuple[Any, dict[str, Any]]:
    url = build_request_url(endpoint, num_days, query.dimensions)
    request = urllib.request.Request(
        url,
        method="GET",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "UMA-FREE-Clarity-Audit/1.0",
        },
    )

    started_at = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read()
            status = response.status
            response_headers = {
                key: value
                for key, value in response.headers.items()
                if not SENSITIVE_KEY_PATTERN.search(key)
            }
    except urllib.error.HTTPError as error:
        body = error.read()
        elapsed_ms = round((time.perf_counter() - started_at) * 1000, 1)
        safe_body = body.decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(
            f"{query.name}: Clarity APIがHTTP {error.code}を返しました。"
            f" 応答先頭: {safe_body!r} / 経過: {elapsed_ms}ms"
        ) from error
    except urllib.error.URLError as error:
        elapsed_ms = round((time.perf_counter() - started_at) * 1000, 1)
        raise RuntimeError(
            f"{query.name}: Clarity APIへ接続できませんでした。"
            f" 理由: {error.reason!r} / 経過: {elapsed_ms}ms"
        ) from error

    elapsed_ms = round((time.perf_counter() - started_at) * 1000, 1)
    try:
        payload = json.loads(body.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        safe_body = body.decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(
            f"{query.name}: JSON応答を解析できませんでした。応答先頭: {safe_body!r}"
        ) from error

    metadata = {
        "queryName": query.name,
        "dimensions": list(query.dimensions),
        "numOfDays": num_days,
        "httpStatus": status,
        "elapsedMs": elapsed_ms,
        "responseBytes": len(body),
        "responseHeaders": response_headers,
        "requestUrlWithoutToken": url,
    }
    return payload, metadata


def safe_filename(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("._")
    return normalized or "metric"


def iter_metric_blocks(payload: Any) -> Iterable[tuple[str, list[dict[str, Any]]]]:
    if not isinstance(payload, list):
        return

    for index, block in enumerate(payload, start=1):
        if not isinstance(block, Mapping):
            continue

        metric_name = str(block.get("metricName") or f"metric_{index}")
        information = block.get("information")
        rows: list[dict[str, Any]] = []
        if isinstance(information, list):
            rows = [dict(row) for row in information if isinstance(row, Mapping)]
        elif isinstance(information, Mapping):
            rows = [dict(information)]
        yield metric_name, rows


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row:
            if key not in seen:
                fieldnames.append(str(key))
                seen.add(str(key))

    with path.open("w", encoding="utf-8-sig", newline="") as file:
        if not fieldnames:
            file.write("")
            return

        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    key: json.dumps(value, ensure_ascii=False)
                    if isinstance(value, (dict, list))
                    else value
                    for key, value in row.items()
                }
            )


def as_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        normalized = value.strip().replace(",", "").replace("%", "")
        try:
            return float(normalized)
        except ValueError:
            return None
    return None


def choose_ranking_key(rows: list[dict[str, Any]]) -> str | None:
    available_keys = {str(key) for row in rows for key in row}
    for key in RANKING_KEYS:
        if key in available_keys and any(as_number(row.get(key)) is not None for row in rows):
            return key

    numeric_counts: dict[str, int] = {}
    for row in rows:
        for key, value in row.items():
            if as_number(value) is not None:
                numeric_counts[str(key)] = numeric_counts.get(str(key), 0) + 1
    if not numeric_counts:
        return None
    return max(numeric_counts, key=numeric_counts.get)


def sorted_rows(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
    ranking_key = choose_ranking_key(rows)
    if ranking_key is None:
        return rows, None

    return (
        sorted(
            rows,
            key=lambda row: as_number(row.get(ranking_key)) or 0.0,
            reverse=True,
        ),
        ranking_key,
    )


def markdown_escape(value: Any, max_length: int = 120) -> str:
    if value is None:
        text = ""
    elif isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    else:
        text = str(value)

    text = text.replace("\r", " ").replace("\n", " ").replace("|", "\\|")
    if len(text) > max_length:
        return text[: max_length - 1] + "…"
    return text


def build_markdown_table(rows: list[dict[str, Any]], top_rows: int) -> list[str]:
    if not rows:
        return ["データ行はありません。", ""]

    ordered_rows, ranking_key = sorted_rows(rows)
    selected_rows = ordered_rows[:top_rows]

    columns: list[str] = []
    seen: set[str] = set()
    for row in selected_rows:
        for key in row:
            key_text = str(key)
            if key_text not in seen:
                columns.append(key_text)
                seen.add(key_text)

    if len(columns) > 10:
        priority = [
            key
            for key in columns
            if key in RANKING_KEYS or not any(char.isdigit() for char in key)
        ]
        columns = (priority + [key for key in columns if key not in priority])[:10]

    lines = []
    if ranking_key:
        lines.append(f"並び順: `{ranking_key}` の降順")
        lines.append("")
    lines.append("| " + " | ".join(columns) + " |")
    lines.append("| " + " | ".join("---" for _ in columns) + " |")
    for row in selected_rows:
        lines.append(
            "| "
            + " | ".join(markdown_escape(row.get(column)) for column in columns)
            + " |"
        )
    lines.append("")
    return lines


def build_summary(
    output_dir: Path,
    manifest: dict[str, Any],
    payloads: dict[str, Any],
    top_rows: int,
) -> str:
    lines = [
        "# Microsoft Clarity API監査結果",
        "",
        f"- 取得日時（UTC）: `{manifest['generatedAtUtc']}`",
        f"- 対象期間: 取得時点から直近 `{manifest['numOfDays'] * 24}` 時間",
        f"- 実行プロファイル: `{manifest['profile']}`",
        f"- APIリクエスト数: `{manifest['requestCount']}` / 日次上限 `{MAX_REQUESTS_PER_DAY}`",
        f"- 出力先: `{output_dir}`",
        "",
        "## 取得状況",
        "",
        "| クエリ | ディメンション | HTTP | 応答時間 | 応答サイズ | 指標数 | データ行数 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]

    metadata_by_name = {
        item["queryName"]: item for item in manifest.get("requests", [])
    }
    for query_name, payload in payloads.items():
        metadata = metadata_by_name[query_name]
        metric_blocks = list(iter_metric_blocks(payload))
        total_rows = sum(len(rows) for _, rows in metric_blocks)
        dimensions = ", ".join(metadata["dimensions"]) or "なし"
        lines.append(
            "| "
            f"{query_name} | {dimensions} | {metadata['httpStatus']} | "
            f"{metadata['elapsedMs']} ms | {metadata['responseBytes']} bytes | "
            f"{len(metric_blocks)} | {total_rows} |"
        )

    lines.extend(
        [
            "",
            "## 指標別データ",
            "",
            "各表は分析しやすいよう数値列の候補で降順に並べています。"
            "全行は`raw`のJSONと`csv`のCSVを確認してください。",
            "",
        ]
    )

    for query_name, payload in payloads.items():
        metadata = metadata_by_name[query_name]
        dimensions = ", ".join(metadata["dimensions"]) or "なし"
        lines.extend(
            [
                f"### {query_name}",
                "",
                f"ディメンション: `{dimensions}`",
                "",
            ]
        )
        metric_blocks = list(iter_metric_blocks(payload))
        if not metric_blocks:
            lines.extend(
                [
                    "想定した`metricName` / `information`形式の指標がありません。"
                    "raw JSONを確認してください。",
                    "",
                ]
            )
            continue

        for metric_name, rows in metric_blocks:
            lines.extend(
                [
                    f"#### {metric_name}",
                    "",
                    f"行数: `{len(rows)}`",
                    "",
                ]
            )
            lines.extend(build_markdown_table(rows, top_rows))

    lines.extend(
        [
            "## 共有時の注意",
            "",
            "- APIトークンは成果物に含まれていません。",
            "- URLに検索語や個人情報相当の値が含まれていないか確認してから外部共有してください。",
            "- APIはUTC基準です。日本時間の日付境界とは9時間ずれます。",
            "- 直近72時間より前の比較、ヒートマップ画像、録画本体、個別セッションはこのAPIでは取得できません。",
            "",
        ]
    )
    return "\n".join(lines)


def export_query_csvs(output_dir: Path, query_name: str, payload: Any) -> list[str]:
    exported: list[str] = []
    used_names: set[str] = set()
    for index, (metric_name, rows) in enumerate(iter_metric_blocks(payload), start=1):
        base_name = safe_filename(metric_name)
        unique_name = base_name
        suffix = 2
        while unique_name in used_names:
            unique_name = f"{base_name}_{suffix}"
            suffix += 1
        used_names.add(unique_name)

        relative_path = Path("csv") / query_name / f"{index:02d}_{unique_name}.csv"
        absolute_path = output_dir / relative_path
        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        write_csv(absolute_path, rows)
        exported.append(relative_path.as_posix())
    return exported


def main() -> int:
    args = parse_args()
    if args.profile == "pulse":
        queries = PULSE_QUERIES
    elif args.profile == "core":
        queries = CORE_QUERIES
    else:
        queries = FULL_QUERIES
    if len(queries) > MAX_REQUESTS_PER_DAY:
        raise RuntimeError(
            f"リクエスト数がClarityの日次上限{MAX_REQUESTS_PER_DAY}を超えています。"
        )

    token, endpoint = resolve_configuration(args.env_file)
    output_dir = make_output_dir(args.output_dir)

    print(f"出力先: {output_dir}")
    print(
        f"Clarity APIから直近{args.num_days * 24}時間を"
        f"{len(queries)}リクエストで取得します。"
    )
    print("APIトークンは表示・保存しません。")

    payloads: dict[str, Any] = {}
    request_metadata: list[dict[str, Any]] = []
    csv_files: list[str] = []

    for index, query in enumerate(queries, start=1):
        dimensions = ", ".join(query.dimensions) or "なし"
        print(f"[{index}/{len(queries)}] {query.name} ({dimensions})")
        payload, metadata = request_json(
            endpoint=endpoint,
            token=token,
            query=query,
            num_days=args.num_days,
            timeout=args.timeout,
        )
        payloads[query.name] = payload
        request_metadata.append(metadata)

        raw_relative_path = Path("raw") / f"{query.name}.json"
        write_json(output_dir / raw_relative_path, payload)
        metadata["rawFile"] = raw_relative_path.as_posix()
        exported_csvs = export_query_csvs(output_dir, query.name, payload)
        metadata["csvFiles"] = exported_csvs
        csv_files.extend(exported_csvs)

        if index < len(queries) and args.delay > 0:
            time.sleep(args.delay)

    manifest = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "profile": args.profile,
        "numOfDays": args.num_days,
        "requestCount": len(queries),
        "dailyRequestLimit": MAX_REQUESTS_PER_DAY,
        "endpoint": endpoint,
        "tokenIncluded": False,
        "requests": request_metadata,
        "csvFiles": csv_files,
    }
    write_json(output_dir / "manifest.json", manifest)

    summary = build_summary(
        output_dir=output_dir,
        manifest=manifest,
        payloads=payloads,
        top_rows=max(1, args.top_rows),
    )
    (output_dir / "summary.md").write_text(summary + "\n", encoding="utf-8")

    print("取得が完了しました。")
    print(f"共有用サマリー: {output_dir / 'summary.md'}")
    print(f"実行情報: {output_dir / 'manifest.json'}")
    print(f"生JSON: {output_dir / 'raw'}")
    print(f"CSV: {output_dir / 'csv'}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("中断しました。", file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(f"エラー: {error}", file=sys.stderr)
        raise SystemExit(1)
