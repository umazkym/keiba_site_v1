import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from scripts import sns_poster


class FakeTwitterError(Exception):
    def __init__(self, status_code: int, body: str) -> None:
        super().__init__(body)
        self.response = SimpleNamespace(status_code=status_code, text=body)


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self) -> dict:
        return self._payload


class SnsPosterResilienceTest(unittest.TestCase):
    def test_threads_utm_keeps_path_and_external_urls(self) -> None:
        source = (
            "レパードSの分析\n"
            "https://uma-free.com/races/2026-08-09/niigata/7?race=7\n"
            "公式 https://www.jra.go.jp/"
        )
        threads_text = sns_poster.add_social_attribution_to_text(
            source,
            "threads",
            "evening_race",
            "2026-08-09",
        )

        self.assertIn("utm_source=threads", threads_text)
        self.assertIn("utm_medium=organic_social", threads_text)
        self.assertIn("utm_campaign=race_post_v2", threads_text)
        self.assertIn("utm_term=evening_race", threads_text)
        self.assertRegex(threads_text, r"utm_content=evening_race-20260809-[a-f0-9]{12}")
        self.assertIn("/races/2026-08-09/niigata/7", threads_text)
        self.assertIn("https://www.jra.go.jp/", threads_text)

    def test_x_is_not_an_attribution_target(self) -> None:
        """Xはリンクを貼らない方針のため、UTM付与の対象外であることを固定する。"""
        with self.assertRaises(ValueError):
            sns_poster.add_social_attribution_to_text(
                "https://uma-free.com/races/2026-08-09",
                "x",
                "evening_race",
                "2026-08-09",
            )

    def test_x_body_drops_url_and_cta_line(self) -> None:
        """X本文からはURL行と直前の誘導文が落ちることを固定する。"""
        source = (
            "本日のAI注目馬\n"
            "▼全レースの無料予測\n"
            "https://uma-free.com/races/2026-08-09\n"
            "#競馬 #AI予想"
        )
        x_text = sns_poster.prepare_short_social_text(source, "X")

        self.assertNotIn("https://", x_text)
        self.assertNotIn("▼", x_text)
        self.assertIn("本日のAI注目馬", x_text)
        self.assertIn("#競馬", x_text)

    def test_x_body_drops_cta_separated_from_url_by_blank_line(self) -> None:
        """誘導文とURLの間に空行があっても、リンク先のない誘導文を残さない。"""
        source = (
            "🐎本日のAI注目馬 (06/28)\n"
            "\n"
            "▼全レースの無料予測\n"
            "\n"
            "https://uma-free.com/races/2026-06-28?race=11\n"
            "\n"
            "#競馬 #AI予想"
        )
        x_text = sns_poster.prepare_short_social_text(source, "X")

        self.assertNotIn("https://", x_text)
        self.assertNotIn("▼全レースの無料予測", x_text)
        self.assertIn("🐎本日のAI注目馬 (06/28)", x_text)
        self.assertIn("#競馬", x_text)

    def test_threads_body_keeps_cta_and_url(self) -> None:
        """Threadsは誘導文とURLをそのまま残す（Xとの差分を固定する）。"""
        source = (
            "🐎本日のAI注目馬 (06/28)\n"
            "\n"
            "▼全レースの無料予測\n"
            "\n"
            "https://uma-free.com/races/2026-06-28?race=11\n"
            "\n"
            "#競馬 #AI予想"
        )
        threads_text = sns_poster.prepare_short_social_text(
            source,
            "Threads",
            remove_urls=False,
            max_chars=sns_poster.THREADS_MAX_CHARS,
        )

        self.assertIn("▼全レースの無料予測", threads_text)
        self.assertIn("https://uma-free.com/races/2026-06-28?race=11", threads_text)

    def test_social_content_key_is_stable_for_same_source(self) -> None:
        first = sns_poster.build_social_content_key("同じ本文", "pre_race_remind", "2026-08-09")
        second = sns_poster.build_social_content_key("同じ本文", "pre_race_remind", "2026-08-09")
        self.assertEqual(first, second)

    def test_action_level_403_is_retryable_but_other_auth_errors_are_permanent(self) -> None:
        action_error = FakeTwitterError(
            403,
            '{"detail":"You are not permitted to perform this action.","title":"Forbidden"}',
        )
        generic_forbidden = FakeTwitterError(403, '{"title":"Forbidden"}')
        unauthorized = FakeTwitterError(401, '{"title":"Unauthorized"}')

        self.assertTrue(sns_poster._classify_twitter_exception(action_error)[0])
        self.assertFalse(sns_poster._classify_twitter_exception(generic_forbidden)[0])
        self.assertFalse(sns_poster._classify_twitter_exception(unauthorized)[0])

    def test_action_level_403_retries_three_times(self) -> None:
        action_error = FakeTwitterError(
            403,
            '{"detail":"You are not permitted to perform this action.","title":"Forbidden"}',
        )
        api_v1 = Mock()
        client_v2 = Mock()
        client_v2.create_tweet.side_effect = action_error

        with (
            patch.object(sns_poster, "TWITTER_POST_MAX_RETRIES", 3),
            patch.object(sns_poster, "_create_twitter_clients", return_value=(api_v1, client_v2)),
            patch.object(sns_poster, "_sleep_before_twitter_retry"),
            patch.object(sns_poster, "_log"),
        ):
            result = sns_poster._post_single_tweet_to_x(
                "投稿テスト",
                None,
                1,
                1,
            )

        self.assertFalse(result.ok)
        self.assertTrue(result.transient)
        self.assertEqual(client_v2.create_tweet.call_count, 3)

    def test_threads_success_softens_only_retryable_x_failure(self) -> None:
        retryable_result = sns_poster.TwitterPostResult(
            ok=False,
            transient=True,
            reason="X APIが個別投稿を拒否した外部要因(403)",
        )
        permanent_result = sns_poster.TwitterPostResult(
            ok=False,
            transient=False,
            reason="X APIエラー(401)",
        )

        with (
            patch.object(sns_poster, "ALLOW_X_TRANSIENT_FAILURE_WITH_THREADS", True),
            patch.object(sns_poster, "_log"),
        ):
            failures: list[str] = []
            sns_poster.track_x_result(
                failures,
                "evening_race:テスト重賞",
                retryable_result,
                threads_ok=True,
            )
            self.assertEqual(failures, [])

            sns_poster.track_x_result(
                failures,
                "evening_race:認証失敗",
                permanent_result,
                threads_ok=True,
            )
            sns_poster.track_x_result(
                failures,
                "evening_race:両媒体失敗",
                retryable_result,
                threads_ok=False,
            )

        self.assertEqual(
            failures,
            [
                "X(Twitter): evening_race:認証失敗",
                "X(Twitter): evening_race:両媒体失敗",
            ],
        )

    def test_expired_metadata_probes_live_token_and_refreshes_when_valid(self) -> None:
        def fake_get(url: str, **_: object) -> FakeResponse:
            if url.endswith("/v1.0/me"):
                return FakeResponse(200, {"id": "threads-user"})
            if url.endswith("/refresh_access_token"):
                return FakeResponse(200, {"access_token": "refreshed-token"})
            raise AssertionError(f"想定外のURLです: {url}")

        with (
            patch.object(sns_poster, "ENABLE_THREADS", True),
            patch.object(sns_poster, "THREADS_ACCESS_TOKEN", "current-token"),
            patch.object(sns_poster, "THREADS_TOKEN_EXPIRY", "2000-01-01"),
            patch.object(sns_poster.requests, "get", side_effect=fake_get) as request_get,
            patch.object(sns_poster, "_log") as log,
        ):
            sns_poster.refresh_threads_token_if_needed()
            self.assertEqual(sns_poster.THREADS_ACCESS_TOKEN, "refreshed-token")

        self.assertEqual(request_get.call_count, 2)
        self.assertTrue(
            any("メタデータが古い" in str(call.args[0]) for call in log.call_args_list)
        )

    def test_expired_metadata_stops_only_when_live_token_is_rejected(self) -> None:
        with (
            patch.object(sns_poster, "ENABLE_THREADS", True),
            patch.object(sns_poster, "THREADS_ACCESS_TOKEN", "rejected-token"),
            patch.object(sns_poster, "THREADS_TOKEN_EXPIRY", "2000-01-01"),
            patch.object(
                sns_poster.requests,
                "get",
                return_value=FakeResponse(401, text="invalid token"),
            ) as request_get,
            patch.object(sns_poster, "_log"),
        ):
            sns_poster.refresh_threads_token_if_needed()

        self.assertEqual(request_get.call_count, 1)


if __name__ == "__main__":
    unittest.main()
