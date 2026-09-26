"""画像つきの Threads 投稿に付ける、リンクだけの返信（2026-09-26 利用者の選択 B）。"""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from scripts import sns_poster


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self) -> dict:
        return self._payload


POST_TEXT = "\n".join([
    "9月27日(日) 本日のAI注目馬",
    "中山11R スプリンターズS（G1・芝1200m・16頭）",
    "5番 サンプル",
    "AI偏差値 72.1",
    "全レースの分析",
    "https://uma-free.com/races/2026-09-27",
    "#中山競馬 #中央競馬 #競馬予想",
])


class FakeThreadsApi:
    """コンテナ作成と公開を順に受け、送られた中身を記録する。"""

    def __init__(self, fail_reply: bool = False) -> None:
        self.calls: list[tuple[str, dict]] = []
        self.fail_reply = fail_reply
        self.counter = 0

    def post(self, url: str, headers=None, data=None, timeout=None):
        self.calls.append((url, dict(data or {})))
        self.counter += 1
        if url.endswith("/threads"):
            if self.fail_reply and "reply_to_id" in (data or {}):
                return FakeResponse(400, text="reply rejected")
            return FakeResponse(200, {"id": f"container-{self.counter}"})
        return FakeResponse(200, {"id": f"post-{self.counter}"})

    def containers(self) -> list[dict]:
        return [data for url, data in self.calls if url.endswith("/threads")]


class ThreadsLinkReplyTest(unittest.TestCase):
    def setUp(self) -> None:
        sns_poster._threads_link_replies_sent = 0

    def _patches(self, api: FakeThreadsApi, *, image_url: str | None, max_replies: int = 1):
        return [
            patch.object(sns_poster, "ENABLE_THREADS", True),
            patch.object(sns_poster, "DRY_RUN", False),
            patch.object(sns_poster, "THREADS_USER_ID", "user-1"),
            patch.object(sns_poster, "THREADS_ACCESS_TOKEN", "token"),
            patch.object(sns_poster, "THREADS_LINK_REPLY_MAX_PER_RUN", max_replies),
            patch.object(sns_poster, "_stage_threads_image", return_value=(None, image_url)),
            patch.object(sns_poster, "_wait_threads_container", return_value=True),
            patch.object(sns_poster.requests, "post", side_effect=api.post),
            patch.object(sns_poster.time, "sleep"),
            patch.object(sns_poster, "_log"),
        ]

    def _run(self, api: FakeThreadsApi, *, image_url: str | None, max_replies: int = 1, posts: int = 1):
        patches = self._patches(api, image_url=image_url, max_replies=max_replies)
        for item in patches:
            item.start()
        try:
            return [sns_poster.post_to_threads(POST_TEXT, "image.png") for _ in range(posts)]
        finally:
            for item in reversed(patches):
                item.stop()

    def test_image_post_gets_one_link_only_reply(self) -> None:
        api = FakeThreadsApi()
        [result] = self._run(api, image_url="https://storage.example/signed.png")

        self.assertTrue(result.ok)
        self.assertTrue(result.with_image)
        self.assertIsNotNone(result.link_reply_id)
        parent, reply = api.containers()
        self.assertEqual(parent["media_type"], "IMAGE")
        self.assertEqual(reply["media_type"], "TEXT")
        self.assertEqual(reply["reply_to_id"], result.post_id)
        # 返信は本文と同じ小見出しとリンクだけ（カードを出すため画像は付けない）
        self.assertEqual(reply["text"], "全レースの分析\nhttps://uma-free.com/races/2026-09-27")
        self.assertNotIn("image_url", reply)

    def test_only_first_image_post_in_a_run_gets_a_reply(self) -> None:
        api = FakeThreadsApi()
        results = self._run(api, image_url="https://storage.example/signed.png", posts=3)

        self.assertTrue(all(result.ok for result in results))
        self.assertIsNotNone(results[0].link_reply_id)
        self.assertIsNone(results[1].link_reply_id)
        self.assertIsNone(results[2].link_reply_id)
        self.assertEqual(sum(1 for data in api.containers() if "reply_to_id" in data), 1)

    def test_text_only_post_gets_no_reply(self) -> None:
        # 画像の準備に失敗して文字だけになった投稿は、Threads がカードを出すので返信しない
        api = FakeThreadsApi()
        [result] = self._run(api, image_url=None)

        self.assertTrue(result.ok)
        self.assertFalse(result.with_image)
        self.assertIsNone(result.link_reply_id)
        self.assertEqual(len(api.containers()), 1)

    def test_zero_setting_stops_replies(self) -> None:
        api = FakeThreadsApi()
        [result] = self._run(api, image_url="https://storage.example/signed.png", max_replies=0)

        self.assertTrue(result.ok)
        self.assertIsNone(result.link_reply_id)
        self.assertEqual(len(api.containers()), 1)

    def test_reply_failure_keeps_parent_post_successful_and_is_not_retried(self) -> None:
        api = FakeThreadsApi(fail_reply=True)
        results = self._run(api, image_url="https://storage.example/signed.png", posts=2)

        self.assertTrue(all(result.ok for result in results))
        self.assertIsNone(results[0].link_reply_id)
        self.assertIsNone(results[1].link_reply_id)
        # 失敗した返信は同じ実行で出し直さない（投稿の数を増やさない）
        self.assertEqual(sum(1 for data in api.containers() if "reply_to_id" in data), 1)

    def test_reply_text_is_none_without_a_site_link(self) -> None:
        self.assertIsNone(sns_poster._threads_link_reply_text("リンクのない本文\n#競馬予想"))
        self.assertEqual(
            sns_poster._threads_link_reply_text("本文\nhttps://uma-free.com/races/2026-09-27"),
            "https://uma-free.com/races/2026-09-27",
        )


if __name__ == "__main__":
    unittest.main()
