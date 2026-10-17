from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.scripts import export_clarity_insights as clarity


class ExportClarityInsightsTest(unittest.TestCase):
    def test_scheduled_profiles_fit_shared_daily_budget(self) -> None:
        self.assertEqual(len(clarity.PULSE_QUERIES), 2)
        self.assertEqual(len(clarity.FULL_QUERIES), 8)
        self.assertLessEqual(
            len(clarity.PULSE_QUERIES) + len(clarity.FULL_QUERIES),
            clarity.MAX_REQUESTS_PER_DAY,
        )

    def test_http_429_preserves_partial_manifest_and_returns_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "clarity"
            calls = 0

            def fake_request_json(**kwargs):
                nonlocal calls
                calls += 1
                query = kwargs["query"]
                if calls == 7:
                    raise clarity.ClarityRequestError("daily limit", http_status=429)
                return [], {
                    "queryName": query.name,
                    "dimensions": list(query.dimensions),
                    "numOfDays": kwargs["num_days"],
                    "httpStatus": 200,
                    "elapsedMs": 1.0,
                    "responseBytes": 2,
                    "responseHeaders": {},
                    "requestUrlWithoutToken": "https://example.invalid/clarity",
                }

            argv = [
                "export_clarity_insights.py",
                "--profile",
                "full",
                "--num-days",
                "3",
                "--output-dir",
                str(output_dir),
                "--delay",
                "0",
            ]
            with (
                patch.object(sys, "argv", argv),
                patch.dict(os.environ, {"CLARITY_API_KEY": "test-token"}, clear=False),
                patch.object(clarity, "request_json", side_effect=fake_request_json),
            ):
                exit_code = clarity.main()

            self.assertEqual(exit_code, 1)
            manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["status"], "partial")
            self.assertEqual(manifest["plannedRequestCount"], 8)
            self.assertEqual(manifest["attemptedRequestCount"], 7)
            self.assertEqual(manifest["successfulRequestCount"], 6)
            self.assertEqual(manifest["failedQueries"][0]["queryName"], "geography_device")
            self.assertEqual(manifest["failedQueries"][0]["httpStatus"], 429)
            self.assertNotIn("test-token", json.dumps(manifest))
            self.assertNotIn("daily limit", json.dumps(manifest))
            summary = (output_dir / "summary.md").read_text(encoding="utf-8")
            self.assertNotIn("test-token", summary)
            self.assertNotIn("daily limit", summary)
            self.assertEqual(len(list((output_dir / "raw").glob("*.json"))), 6)

    def run_with_failure(self, output_dir: Path, failing_call: int, http_status: int | None) -> int:
        calls = 0

        def fake_request_json(**kwargs):
            nonlocal calls
            calls += 1
            query = kwargs["query"]
            if calls == failing_call:
                raise clarity.ClarityRequestError("failure", http_status=http_status)
            return [], {
                "queryName": query.name, "dimensions": list(query.dimensions),
                "numOfDays": kwargs["num_days"], "httpStatus": 200, "elapsedMs": 1.0,
                "responseBytes": 2, "responseHeaders": {},
                "requestUrlWithoutToken": "https://example.invalid/clarity",
            }

        argv = [
            "export_clarity_insights.py", "--profile", "full", "--output-dir", str(output_dir),
            "--delay", "0", "--allow-daily-limit",
        ]
        with (
            patch.object(sys, "argv", argv),
            patch.dict(os.environ, {"CLARITY_API_KEY": "test-token"}, clear=False),
            patch.object(clarity, "request_json", side_effect=fake_request_json),
        ):
            return clarity.main()

    def test_allow_daily_limit_succeeds_when_only_429_stopped_the_export(self) -> None:
        # 金曜の再試行は木曜の実行から24時間以内に呼ぶため、3件目で上限に当たる。
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "clarity"
            self.assertEqual(self.run_with_failure(output_dir, 3, 429), 0)
            manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["status"], "partial")
            self.assertTrue(manifest["dailyLimitReached"])
            self.assertEqual(manifest["successfulRequestCount"], 2)
            self.assertIn("overview", [row["queryName"] for row in manifest["requests"]])

    def test_allow_daily_limit_still_fails_on_other_errors(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "clarity"
            self.assertEqual(self.run_with_failure(output_dir, 2, 401), 1)
            manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertFalse(manifest["dailyLimitReached"])


if __name__ == "__main__":
    unittest.main()
