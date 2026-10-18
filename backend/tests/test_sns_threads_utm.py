"""Threads のリンクに付ける印（UTM）。2026-08-20 に外したものを 2026-10-18 に戻した。"""
import os
import re
import sys
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit


BACKEND_DIR = Path(__file__).resolve().parents[1]
TESTS_DIR = Path(__file__).resolve().parent
for _path in (BACKEND_DIR, TESTS_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from scripts import sns_poster
from test_sns_threads_link_reply import POST_TEXT, FakeThreadsApi

# frontend/lib/analytics.ts の parseSocialAttributionSearch が投稿種別を取り出す形
FRONTEND_CONTENT_KEY = re.compile(r"^(.+?)-\d{8}-[a-f0-9]{12}$")


def site_query(text: str) -> dict[str, list[str]]:
    """本文の中の UMA-FREE のリンク1本のクエリを返す。"""
    urls = re.findall(r"https://uma-free\.com/[^\s。、）)\]]+", text)
    assert len(urls) == 1, urls
    return parse_qs(urlsplit(urls[0]).query)


class ThreadsAttributionTextTest(unittest.TestCase):
    def test_only_site_links_get_utm(self) -> None:
        text = "\n".join([
            "結果とAIの評価",
            "https://uma-free.com/races/2026-10-18/kyoto/11。",
            "https://example.com/races/2026-10-18",
        ])
        result = sns_poster.add_threads_attribution(text, "hit_immediate", "hit_immediate-20261018-0123456789ab")
        lines = result.splitlines()
        self.assertEqual(lines[0], "結果とAIの評価")
        self.assertTrue(lines[1].startswith("https://uma-free.com/races/2026-10-18/kyoto/11?utm_source=threads&"))
        self.assertTrue(lines[1].endswith("。"))
        self.assertEqual(lines[2], "https://example.com/races/2026-10-18")
        query = site_query(result)
        self.assertEqual(query["utm_source"], ["threads"])
        self.assertEqual(query["utm_medium"], ["social"])
        self.assertEqual(query["utm_campaign"], ["race_post_v2"])
        self.assertEqual(query["utm_content"], ["hit_immediate-20261018-0123456789ab"])
        self.assertEqual(query["utm_term"], ["hit_immediate"])

    def test_content_key_matches_the_frontend_parser(self) -> None:
        key = sns_poster.build_social_content_key(POST_TEXT, "evening_main", "2026-10-18")
        match = FRONTEND_CONTENT_KEY.match(key)
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), "evening_main")
        self.assertTrue(key.startswith("evening_main-20261018-"))
        self.assertLessEqual(len(key), 100)


class ThreadsAttributionPostTest(unittest.TestCase):
    def setUp(self) -> None:
        sns_poster._threads_link_replies_sent = 0

    def _post(self, api: FakeThreadsApi, text: str, *, image_url: str | None, **kwargs):
        with ExitStack() as stack:
            for item in [
                patch.object(sns_poster, "ENABLE_THREADS", True),
                patch.object(sns_poster, "DRY_RUN", False),
                patch.object(sns_poster, "THREADS_USER_ID", "user-1"),
                patch.object(sns_poster, "THREADS_ACCESS_TOKEN", "token"),
                patch.object(sns_poster, "THREADS_LINK_REPLY_MAX_PER_RUN", 1),
                patch.object(sns_poster, "_stage_threads_image", return_value=(None, image_url)),
                patch.object(sns_poster, "_wait_threads_container", return_value=True),
                patch.object(sns_poster.requests, "post", side_effect=api.post),
                patch.object(sns_poster.time, "sleep"),
                patch.object(sns_poster, "_log"),
            ]:
                stack.enter_context(item)
            return sns_poster.post_to_threads(text, "image.png" if image_url else None, **kwargs)

    def test_body_and_reply_share_the_same_content_key(self) -> None:
        api = FakeThreadsApi()
        reply = "つかみの一言\nhttps://uma-free.com/races/2026-09-27/nakayama/11"
        result = self._post(
            api,
            POST_TEXT,
            image_url="https://storage.example/image.png",
            reply_text=reply,
            post_type="morning_pick",
            target_date="2026-09-27",
        )
        self.assertTrue(result.ok)
        parent, reply_data = api.containers()
        body_query = site_query(parent["text"])
        reply_query = site_query(reply_data["text"])
        self.assertEqual(body_query["utm_content"], reply_query["utm_content"])
        self.assertEqual(reply_query["utm_term"], ["morning_pick"])
        self.assertTrue(reply_data["text"].startswith("つかみの一言\nhttps://uma-free.com/races/2026-09-27/nakayama/11?"))
        self.assertIn("#中山競馬", parent["text"])

    def test_reply_from_the_body_link_also_gets_utm(self) -> None:
        api = FakeThreadsApi()
        self._post(
            api,
            POST_TEXT,
            image_url="https://storage.example/image.png",
            post_type="evening_race",
            target_date="2026-09-27",
        )
        reply_data = api.containers()[1]
        self.assertTrue(reply_data["text"].startswith("全レースの分析\nhttps://uma-free.com/races/2026-09-27?"))
        self.assertEqual(site_query(reply_data["text"])["utm_term"], ["evening_race"])

    def test_without_post_type_links_stay_plain(self) -> None:
        api = FakeThreadsApi()
        self._post(api, POST_TEXT, image_url=None)
        self.assertIn("https://uma-free.com/races/2026-09-27\n", api.containers()[0]["text"])

    def test_body_stays_plain_when_utm_would_pass_the_api_limit(self) -> None:
        api = FakeThreadsApi()
        long_text = "\n".join(["あ" * 400, "全レースの分析", "https://uma-free.com/races/2026-09-27"])
        reply = "つかみの一言\nhttps://uma-free.com/races/2026-09-27/nakayama/11"
        self._post(
            api,
            long_text,
            image_url="https://storage.example/image.png",
            reply_text=reply,
            post_type="pre_race_remind",
            target_date="2026-09-27",
        )
        parent, reply_data = api.containers()
        self.assertNotIn("utm_", parent["text"])
        self.assertLessEqual(len(parent["text"]), sns_poster.THREADS_API_TEXT_LIMIT)
        self.assertEqual(site_query(reply_data["text"])["utm_term"], ["pre_race_remind"])

    def test_real_posts_fit_the_api_limit_with_utm(self) -> None:
        api = FakeThreadsApi()
        self._post(api, POST_TEXT, image_url=None, post_type="morning_pick_only", target_date="2026-09-27")
        text = api.containers()[0]["text"]
        self.assertIn("utm_source=threads", text)
        self.assertLessEqual(len(text), sns_poster.THREADS_API_TEXT_LIMIT)


class ThreadsAttributionCallerTest(unittest.TestCase):
    def test_post_single_passes_post_type_and_date(self) -> None:
        calls = []

        def fake_post_to_threads(text, image_path=None, reply_text=None, **kwargs):
            calls.append(kwargs)
            return sns_poster.ThreadsPostResult(ok=True, post_id="post-1")

        with ExitStack() as stack:
            stack.enter_context(patch.object(sns_poster, "is_already_posted", return_value=False))
            stack.enter_context(patch.object(sns_poster, "post_to_threads", side_effect=fake_post_to_threads))
            stack.enter_context(patch.object(sns_poster, "record_post_if_delivered"))
            stack.enter_context(patch.object(sns_poster, "track_threads_result"))
            stack.enter_context(patch.object(sns_poster, "_log"))
            sns_poster.post_single([], POST_TEXT, "evening_main", "2026-10-18", post_x=False)
        self.assertEqual(calls, [{"post_type": "evening_main", "target_date": "2026-10-18"}])

    def test_morning_items_pass_each_post_type(self) -> None:
        calls = []

        def fake_post_to_threads(text, image_path=None, reply_text=None, **kwargs):
            calls.append(kwargs)
            return sns_poster.ThreadsPostResult(ok=True, post_id="post-1")

        with patch.object(sns_poster, "post_to_threads", side_effect=fake_post_to_threads), \
                patch.object(sns_poster.time, "sleep"), patch.object(sns_poster, "_log"):
            sns_poster.post_to_threads_with_images(
                [("本文1", None, None, "morning_hit"), ("本文2", None, None, "morning_pick")],
                target_date="2026-10-18",
            )
        self.assertEqual(
            calls,
            [
                {"post_type": "morning_hit", "target_date": "2026-10-18"},
                {"post_type": "morning_pick", "target_date": "2026-10-18"},
            ],
        )


if __name__ == "__main__":
    unittest.main()
