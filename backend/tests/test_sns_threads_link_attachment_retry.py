"""Threads の公開が「Invalid Link Attachment」（error_subcode 4279047）で落ちたときの記録と出し直し。"""

import json
import os
import sys
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from scripts import sns_poster


FAKE_TOKEN = "fake-threads-token-for-test"
POST_TEXT = "本日のAI注目馬\n▼全レースの無料予測\nhttps://uma-free.com/races/2026-10-02\n#競馬"


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text if text is not None else json.dumps(self._payload, ensure_ascii=False)

    def json(self) -> dict:
        return self._payload


def link_attachment_error(padding: str = "") -> FakeResponse:
    return FakeResponse(
        400,
        {
            "error": {
                "message": "Invalid parameter",
                "type": "OAuthException",
                "code": 100,
                "error_subcode": 4279047,
                "is_transient": False,
                "error_user_title": "Invalid Link Attachment",
                "error_user_msg": "The link attachment could not be created." + padding,
                "fbtrace_id": "TRACE-END-MARK",
            }
        },
    )


def other_bad_request() -> FakeResponse:
    return FakeResponse(
        400,
        {
            "error": {
                "message": "Invalid parameter",
                "code": 100,
                "error_subcode": 1234567,
                "is_transient": False,
                "fbtrace_id": "TRACE-OTHER",
            }
        },
    )


class ThreadsLinkAttachmentRetryTest(unittest.TestCase):
    def _run(self, publish_responses, get_side_effect=None, max_retries=3, wait_seconds=30):
        """post_to_threads を、通信と待ちを差し替えて動かす。"""
        calls = {"create": 0, "publish": 0, "get": 0, "sleeps": [], "logs": []}
        publish_queue = list(publish_responses)

        def fake_post(url: str, **_: object) -> FakeResponse:
            if url.endswith("/threads_publish"):
                calls["publish"] += 1
                return publish_queue.pop(0)
            if url.endswith("/threads"):
                calls["create"] += 1
                return FakeResponse(200, {"id": f"container-{calls['create']}"})
            raise AssertionError(f"想定外のURLです: {url}")

        def fake_get(url: str, **_: object) -> FakeResponse:
            calls["get"] += 1
            if get_side_effect is not None:
                return get_side_effect(url)
            return FakeResponse(200, {"status": "ERROR", "error_message": "FAILED_LINK_PREVIEW", "id": "x"})

        with ExitStack() as stack:
            for name, value in (
                ("ENABLE_THREADS", True),
                ("DRY_RUN", False),
                ("THREADS_USER_ID", "threads-user"),
                ("THREADS_ACCESS_TOKEN", FAKE_TOKEN),
                ("THREADS_IMAGE_MODE", "off"),
                ("THREADS_POST_MAX_RETRIES", max_retries),
                ("THREADS_LINK_ATTACHMENT_RETRY_WAIT_SECONDS", wait_seconds),
            ):
                stack.enter_context(patch.object(sns_poster, name, value))
            stack.enter_context(patch.object(sns_poster.requests, "post", side_effect=fake_post))
            stack.enter_context(patch.object(sns_poster.requests, "get", side_effect=fake_get))
            stack.enter_context(
                patch.object(sns_poster.time, "sleep", side_effect=lambda seconds: calls["sleeps"].append(seconds))
            )
            stack.enter_context(
                patch.object(sns_poster, "_log", side_effect=lambda message: calls["logs"].append(str(message)))
            )
            result = sns_poster.post_to_threads(POST_TEXT)
        return result, calls

    def test_link_attachment_error_is_retried_once_and_succeeds(self) -> None:
        result, calls = self._run([link_attachment_error(), FakeResponse(200, {"id": "post-1"})])

        self.assertTrue(result.ok)
        self.assertEqual(result.post_id, "post-1")
        self.assertEqual(calls["create"], 2)
        self.assertEqual(calls["publish"], 2)
        # 1回目の公開の前は3秒、出し直しは「待つ30秒」と「公開の前の30秒」
        self.assertEqual(calls["sleeps"], [3, 30, 30])

    def test_retry_does_not_consume_the_normal_attempt_count(self) -> None:
        """THREADS_POST_MAX_RETRIES が 1 でも、出し直しは1回できる。"""
        result, calls = self._run(
            [link_attachment_error(), FakeResponse(200, {"id": "post-1"})],
            max_retries=1,
        )

        self.assertTrue(result.ok)
        self.assertEqual(calls["create"], 2)
        self.assertEqual(calls["publish"], 2)

    def test_wait_seconds_follow_the_setting(self) -> None:
        _, calls = self._run(
            [link_attachment_error(), FakeResponse(200, {"id": "post-1"})],
            wait_seconds=45,
        )

        self.assertEqual(calls["sleeps"], [3, 45, 45])

    def test_link_attachment_error_twice_stops_after_one_retry(self) -> None:
        result, calls = self._run(
            [link_attachment_error(), link_attachment_error(), FakeResponse(200, {"id": "must-not-be-used"})]
        )

        self.assertFalse(result.ok)
        self.assertFalse(result.transient)
        self.assertIn("出し直しても", result.reason)
        self.assertEqual(calls["create"], 2)
        self.assertEqual(calls["publish"], 2)
        # コンテナの状態は、失敗のたびに1回ずつ読む
        self.assertEqual(calls["get"], 2)

    def test_other_bad_request_is_not_retried(self) -> None:
        result, calls = self._run([other_bad_request(), FakeResponse(200, {"id": "must-not-be-used"})])

        self.assertFalse(result.ok)
        self.assertNotIn("出し直しても", result.reason)
        self.assertEqual(calls["create"], 1)
        self.assertEqual(calls["publish"], 1)
        self.assertEqual(calls["sleeps"], [3])

    def test_transient_error_with_same_subcode_is_not_retried(self) -> None:
        """一時エラーは公開済みかもしれないので、番号が同じでも出し直さない。"""
        response = link_attachment_error()
        response._payload["error"]["is_transient"] = True
        result, calls = self._run([response, FakeResponse(200, {"id": "must-not-be-used"})])

        self.assertFalse(result.ok)
        self.assertTrue(result.transient)
        self.assertEqual(calls["publish"], 1)

    def test_server_error_at_publish_is_not_retried(self) -> None:
        result, calls = self._run([FakeResponse(503, text="unavailable"), FakeResponse(200, {"id": "must-not-be-used"})])

        self.assertFalse(result.ok)
        self.assertTrue(result.transient)
        self.assertEqual(calls["create"], 1)
        self.assertEqual(calls["publish"], 1)

    def test_failure_log_has_full_body_and_container_status(self) -> None:
        response = link_attachment_error(padding="あ" * 300)
        self.assertGreater(len(response.text), 200)
        _, calls = self._run([response, response])
        logs = "\n".join(calls["logs"])

        # 200字より後ろにある fbtrace_id まで読める
        failure_line = next(line for line in calls["logs"] if "Threads公開失敗" in line)
        self.assertGreater(len(failure_line), 300)
        self.assertIn("TRACE-END-MARK", failure_line)
        self.assertIn("error_subcode=4279047", logs)
        self.assertIn("error_user_title='Invalid Link Attachment'", logs)
        self.assertIn("is_transient=False", logs)
        self.assertIn("fbtrace_id='TRACE-END-MARK'", logs)
        self.assertIn("コンテナの状態（container-1）", logs)
        self.assertIn("status='ERROR'", logs)
        self.assertIn("error_message='FAILED_LINK_PREVIEW'", logs)
        self.assertNotIn(FAKE_TOKEN, logs)

    def test_failure_log_is_capped_and_masks_the_token(self) -> None:
        response = FakeResponse(400, text=f"{FAKE_TOKEN} " + "x" * 3000)
        _, calls = self._run([response])
        failure_line = next(line for line in calls["logs"] if "Threads公開失敗" in line)

        self.assertLess(len(failure_line), 1200)
        self.assertNotIn(FAKE_TOKEN, "\n".join(calls["logs"]))

    def test_container_status_exception_does_not_break_the_flow(self) -> None:
        def raise_error(_: str) -> FakeResponse:
            raise sns_poster.requests.ConnectionError("接続できません")

        result, calls = self._run(
            [link_attachment_error(), FakeResponse(200, {"id": "post-1"})],
            get_side_effect=raise_error,
        )

        self.assertTrue(result.ok)
        self.assertEqual(calls["publish"], 2)
        self.assertTrue(any("コンテナの状態を読めませんでした" in line for line in calls["logs"]))

    def test_container_status_http_error_is_logged_and_flow_continues(self) -> None:
        result, calls = self._run(
            [other_bad_request()],
            get_side_effect=lambda _: FakeResponse(500, text="server error"),
        )

        self.assertFalse(result.ok)
        self.assertEqual(calls["get"], 1)
        self.assertTrue(any("コンテナの状態を読めませんでした" in line and "500" in line for line in calls["logs"]))


if __name__ == "__main__":
    unittest.main()
