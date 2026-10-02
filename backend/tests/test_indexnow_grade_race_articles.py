import argparse
import importlib.util
import io
import json
import sys
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts" / "agents"
SPEC = importlib.util.spec_from_file_location("indexnow_grade_race_articles_test_target", SCRIPT_DIR / "indexnow_grade_race_articles.py")
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("indexnow_grade_race_articles.pyを読み込めません。")
indexnow = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = indexnow
SPEC.loader.exec_module(indexnow)


def article(category: str = "重賞攻略", extra: str = "") -> str:
    return f"---\ntitle: 見出し\ncategory: {category}\n{extra}date: '2026-09-28T01:23:21.726Z'\n---\n\n本文\n"


def path_of(slug: str) -> str:
    return f"frontend/content/articles/{slug}.md"


class SelectUrlsTest(unittest.TestCase):
    def select(self, files: dict, changed: list, limit: int = 10, redirected: set = frozenset()) -> list:
        return indexnow.select_urls(changed, lambda path: files.get(path), set(redirected), limit)

    def test_sends_only_grade_race_articles(self) -> None:
        files = {
            path_of("2026-09-28-t-2026-entries"): article(),
            path_of("2026-08-18-tokyoturf-1600-m"): article(category="コース攻略"),
            path_of("2026-09-30-entity-only"): article(category="データ分析", extra="entity_type: grade_race\n"),
        }
        changed = [("added", path) for path in files]
        self.assertEqual(
            self.select(files, changed),
            [
                "https://uma-free.com/articles/2026-09-30-entity-only",
                "https://uma-free.com/articles/2026-09-28-t-2026-entries",
            ],
        )

    def test_returns_nothing_when_no_grade_race_article_changed(self) -> None:
        files = {path_of("2026-08-18-tokyoturf-1600-m"): article(category="コース攻略")}
        self.assertEqual(self.select(files, [("modified", path_of("2026-08-18-tokyoturf-1600-m"))]), [])
        self.assertEqual(self.select({}, []), [])

    def test_ignores_files_outside_the_articles_folder(self) -> None:
        files = {
            "frontend/content/reference/note.md": article(),
            "frontend/content/articles/nested/2026-09-28-a.md": article(),
            "frontend/content/articles/2026-09-28-a.json": article(),
            "frontend/app/page.tsx": article(),
        }
        self.assertEqual(self.select(files, [("added", path) for path in files]), [])

    def test_skips_drafts_redirected_and_unreadable_articles(self) -> None:
        files = {
            path_of("2026-09-28-draft"): article(extra="draft: true\n"),
            path_of("2026-07-13-2026-503c1de6"): article(),
            path_of("2026-09-28-no-front-matter"): "本文だけ\n",
        }
        changed = [("added", path) for path in files] + [("added", path_of("2026-09-28-removed-later"))]
        self.assertEqual(self.select(files, changed, redirected={"/articles/2026-07-13-2026-503c1de6"}), [])

    def test_limit_keeps_added_articles_before_modified_ones(self) -> None:
        files = {path_of(f"2026-09-{day:02d}-new"): article() for day in range(1, 8)}
        files.update({path_of(f"2026-09-{day:02d}-old"): article() for day in range(20, 28)})
        changed = [("modified", path) for path in files if path.endswith("-old.md")]
        changed += [("added", path) for path in files if path.endswith("-new.md")]
        urls = self.select(files, changed, limit=10)
        self.assertEqual(len(urls), 10)
        self.assertEqual(urls[0], "https://uma-free.com/articles/2026-09-07-new")
        self.assertEqual(urls[6], "https://uma-free.com/articles/2026-09-01-new")
        self.assertEqual(urls[7:], [f"https://uma-free.com/articles/2026-09-{day}-old" for day in (27, 26, 25)])
        self.assertEqual(self.select(files, changed, limit=3), urls[:3])
        self.assertEqual(self.select(files, changed, limit=0), [])

    def test_url_follows_the_canonical_rule_of_the_sitemap(self) -> None:
        files = {
            path_of("2026-06-01-takarazuka-a"): article(extra="canonical_path: /articles/grade-races/takarazuka-kinen/\n"),
            path_of("2026-06-02-takarazuka-b"): article(extra="canonical_path: '/articles/grade-races/takarazuka-kinen'\n"),
            path_of("2026-06-03-slug"): article(extra="canonical_slug: sprinters-stakes-2026\n"),
            path_of("2026-06-04-profile"): article(extra="canonical_path: /jockeys/someone\n"),
            path_of("2026-06-05-external"): article(extra="canonical_path: https://example.com/articles/x\n"),
        }
        self.assertEqual(
            self.select(files, [("modified", path) for path in files]),
            [
                "https://uma-free.com/articles/2026-06-05-external",
                "https://uma-free.com/articles/sprinters-stakes-2026",
                "https://uma-free.com/articles/grade-races/takarazuka-kinen",
            ],
        )


class ChangedFilesTest(unittest.TestCase):
    def test_compare_result_is_used_only_when_head_is_ahead(self) -> None:
        files = [
            {"status": "added", "filename": path_of("a")},
            {"status": "modified", "filename": path_of("b")},
            {"status": "removed", "filename": path_of("c")},
            {"status": "renamed", "filename": path_of("d")},
        ]
        self.assertEqual(
            indexnow.changed_files_from_compare({"status": "ahead", "files": files}),
            [("added", path_of("a")), ("modified", path_of("b")), ("added", path_of("d"))],
        )
        for status in ("behind", "diverged", "identical", None):
            self.assertIsNone(indexnow.changed_files_from_compare({"status": status, "files": files}))

    def test_git_name_status_is_parsed(self) -> None:
        output = f"A\t{path_of('a')}\nM\t{path_of('b')}\nR100\t{path_of('old')}\t{path_of('new')}\nD\t{path_of('gone')}\n"
        self.assertEqual(
            indexnow.parse_git_name_status(output),
            [("added", path_of("a")), ("modified", path_of("b")), ("added", path_of("new"))],
        )


class KeyAndPayloadTest(unittest.TestCase):
    def test_repository_has_exactly_one_key_file(self) -> None:
        key = indexnow.find_indexnow_key()
        self.assertIsNotNone(key)
        self.assertRegex(key, r"^[A-Za-z0-9-]{8,128}$")
        self.assertEqual((indexnow.PUBLIC_DIR / f"{key}.txt").read_text(encoding="utf-8").strip(), key)

    def test_key_is_not_used_when_missing_or_ambiguous(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            public_dir = Path(temporary)
            (public_dir / "ads.txt").write_text("google.com, pub-0, DIRECT\n", encoding="utf-8")
            (public_dir / "abcdef0123456789.txt").write_text("another-value", encoding="utf-8")
            self.assertIsNone(indexnow.find_indexnow_key(public_dir))
            (public_dir / "0123456789abcdef.txt").write_text("0123456789abcdef\n", encoding="utf-8")
            self.assertEqual(indexnow.find_indexnow_key(public_dir), "0123456789abcdef")
            (public_dir / "fedcba9876543210.txt").write_text("fedcba9876543210", encoding="utf-8")
            self.assertIsNone(indexnow.find_indexnow_key(public_dir))

    def test_payload_points_to_the_key_file_on_the_site(self) -> None:
        urls = ["https://uma-free.com/articles/2026-09-28-t-2026-entries"]
        self.assertEqual(
            indexnow.build_payload(urls, "0123456789abcdef"),
            {
                "host": "uma-free.com",
                "key": "0123456789abcdef",
                "keyLocation": "https://uma-free.com/0123456789abcdef.txt",
                "urlList": urls,
            },
        )


class RunTest(unittest.TestCase):
    """送る所は、にせの関数に差し替えて確かめる（テストは外へ1回も送らない）。"""

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.compare_path = Path(self.temporary.name) / "compare.json"
        self.slug = "2026-09-28-t-2026-entries"
        self.readers = mock.patch.object(indexnow, "read_article_from_worktree", lambda path: article())
        self.readers.start()
        self.addCleanup(self.readers.stop)
        # GitHub Actions の上でテストを動かしても、実行結果のページに「送りました」を書かない。
        self.summary = mock.patch.object(indexnow, "write_step_summary", lambda lines: None)
        self.summary.start()
        self.addCleanup(self.summary.stop)

    def write_compare(self, status: str = "ahead") -> None:
        payload = {"status": status, "files": [{"status": "added", "filename": path_of(self.slug)}]}
        self.compare_path.write_text(json.dumps(payload), encoding="utf-8")

    def run_main(self, *extra: str) -> str:
        output = io.StringIO()
        with redirect_stdout(output):
            exit_code = indexnow.main(["--compare-json", str(self.compare_path), *extra])
        self.assertEqual(exit_code, 0)
        return output.getvalue()

    def test_dry_run_prints_urls_and_never_sends(self) -> None:
        self.write_compare()
        with mock.patch.object(indexnow, "send_to_indexnow") as send:
            output = self.run_main("--dry-run")
        send.assert_not_called()
        self.assertIn(f"https://uma-free.com/articles/{self.slug}", output)

    def test_nothing_is_sent_when_there_is_no_url(self) -> None:
        self.write_compare(status="behind")
        with mock.patch.object(indexnow, "send_to_indexnow") as send:
            output = self.run_main()
        send.assert_not_called()
        self.assertIn("0 本", output)

    def test_sends_once_with_the_selected_urls(self) -> None:
        self.write_compare()
        with mock.patch.object(indexnow, "send_to_indexnow", return_value=(True, "HTTP 200")) as send:
            self.run_main()
        send.assert_called_once()
        self.assertEqual(send.call_args.args[0]["urlList"], [f"https://uma-free.com/articles/{self.slug}"])

    def test_failures_only_warn_and_exit_with_zero(self) -> None:
        self.write_compare()
        with mock.patch.object(indexnow, "send_to_indexnow", return_value=(False, "HTTP 403")):
            self.assertIn("::warning::", self.run_main())
        with mock.patch.object(indexnow, "send_to_indexnow", side_effect=RuntimeError("boom")):
            self.assertIn("::warning::", self.run_main())
        self.compare_path.write_text("{broken", encoding="utf-8")
        self.assertIn("::warning::", self.run_main())

    def test_http_and_network_errors_are_reported_without_raising(self) -> None:
        payload = indexnow.build_payload(["https://uma-free.com/articles/a"], "0123456789abcdef")

        def http_error(request, timeout):
            raise urllib.error.HTTPError(request.full_url, 429, "Too Many Requests", None, None)

        def network_error(request, timeout):
            raise urllib.error.URLError("unreachable")

        class Accepted:
            status = 202

            def __enter__(self):
                return self

            def __exit__(self, *arguments):
                return False

        requests = []

        def accepted(request, timeout):
            requests.append(request)
            return Accepted()

        self.assertEqual(indexnow.send_to_indexnow(payload, opener=http_error), (False, "HTTP 429"))
        self.assertFalse(indexnow.send_to_indexnow(payload, opener=network_error)[0])
        self.assertEqual(indexnow.send_to_indexnow(payload, opener=accepted), (True, "HTTP 202"))
        self.assertEqual(requests[0].full_url, "https://api.indexnow.org/indexnow")
        self.assertEqual(requests[0].get_method(), "POST")
        self.assertEqual(json.loads(requests[0].data.decode("utf-8")), payload)


class ArgumentsTest(unittest.TestCase):
    def test_default_limit_is_ten(self) -> None:
        arguments = indexnow.parse_arguments([])
        self.assertIsInstance(arguments, argparse.Namespace)
        self.assertEqual(arguments.limit, 10)
        self.assertFalse(arguments.dry_run)


if __name__ == "__main__":
    unittest.main()
