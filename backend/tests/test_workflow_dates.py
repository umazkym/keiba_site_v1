from __future__ import annotations

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.social_video.workflow_dates import (
    JST,
    _schedule_delay_minutes,
    resolve_daily_pipeline_target_date,
    resolve_friday_weekend_target_date,
    resolve_youtube_target_date,
)


class WorkflowDatesTest(unittest.TestCase):
    def test_delayed_afternoon_keeps_intended_target_date(self) -> None:
        resolution = resolve_daily_pipeline_target_date(
            "afternoon",
            "schedule",
            event_schedule="30 4 * * *",
            observed_at=datetime(2026, 8, 27, 15, 21, tzinfo=timezone.utc),
        )
        self.assertEqual(resolution.target_date, "2026-08-28")
        self.assertEqual(resolution.scheduled_at_utc.isoformat(), "2026-08-27T04:30:00+00:00")
        self.assertEqual(resolution.delay_minutes, 651)

    def test_morning_today_keeps_date_after_jst_day_boundary(self) -> None:
        resolution = resolve_daily_pipeline_target_date(
            "morning-today",
            "schedule",
            event_schedule="30 21 * * *",
            observed_at=datetime(2026, 8, 27, 23, 45, tzinfo=timezone.utc),
        )
        self.assertEqual(resolution.target_date, "2026-08-28")

    def test_retry_today_keeps_date_after_jst_midnight(self) -> None:
        resolution = resolve_daily_pipeline_target_date(
            "retry-today",
            "schedule",
            event_schedule="0 1 * * *",
            observed_at=datetime(2026, 8, 28, 16, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(resolution.target_date, "2026-08-28")

    def test_results_keeps_nominal_utc_date(self) -> None:
        resolution = resolve_daily_pipeline_target_date(
            "results",
            "schedule",
            event_schedule="0 20 * * *",
            observed_at=datetime(2026, 8, 28, 1, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(resolution.target_date, "2026-08-27")

    def test_daily_manual_target_date_is_required(self) -> None:
        with self.assertRaisesRegex(ValueError, "対象日"):
            resolve_daily_pipeline_target_date("afternoon", "workflow_dispatch")

    def test_daily_manual_target_date_is_authoritative(self) -> None:
        resolution = resolve_daily_pipeline_target_date(
            "afternoon",
            "workflow_dispatch",
            explicit_target_date="2026-08-28",
        )
        self.assertEqual(resolution.target_date, "2026-08-28")
        self.assertIsNone(resolution.scheduled_at_utc)

    def test_daily_manual_target_rejects_basic_iso_without_hyphens(self) -> None:
        with self.assertRaisesRegex(ValueError, "YYYY-MM-DD形式"):
            resolve_daily_pipeline_target_date(
                "afternoon",
                "workflow_dispatch",
                explicit_target_date="20260828",
            )

    def test_daily_cron_mismatch_stops_before_pipeline(self) -> None:
        with self.assertRaisesRegex(ValueError, "cronが想定と一致"):
            resolve_daily_pipeline_target_date(
                "afternoon",
                "schedule",
                event_schedule="0 5 * * *",
                observed_at=datetime(2026, 8, 28, 5, 0, tzinfo=timezone.utc),
            )

    def test_delay_of_24_hours_is_rejected(self) -> None:
        scheduled_at = datetime(2026, 8, 27, 4, 30, tzinfo=timezone.utc)
        with self.assertRaisesRegex(ValueError, "遅延が許容範囲外"):
            _schedule_delay_minutes(
                scheduled_at,
                scheduled_at + timedelta(hours=24),
            )

    def test_friday_noon_cron_keeps_saturday_when_start_is_delayed(self) -> None:
        target_date, offset = resolve_friday_weekend_target_date(
            "schedule",
            event_schedule="0 3 * * 5",
            now_jst=datetime(2026, 7, 31, 14, 54, tzinfo=JST),
        )
        self.assertEqual((target_date, offset), ("2026-08-01", 1))

    def test_friday_afternoon_cron_keeps_sunday_when_start_is_delayed(self) -> None:
        target_date, offset = resolve_friday_weekend_target_date(
            "schedule",
            event_schedule="0 6 * * 5",
            now_jst=datetime(2026, 7, 31, 18, 9, tzinfo=JST),
        )
        self.assertEqual((target_date, offset), ("2026-08-02", 2))

    def test_friday_cron_anchors_to_friday_even_after_midnight(self) -> None:
        target_date, offset = resolve_friday_weekend_target_date(
            "schedule",
            event_schedule="0 3 * * 5",
            now_jst=datetime(2026, 8, 1, 0, 20, tzinfo=JST),
        )
        self.assertEqual((target_date, offset), ("2026-08-01", 1))

    def test_friday_manual_offset_uses_explicit_value(self) -> None:
        target_date, offset = resolve_friday_weekend_target_date(
            "workflow_dispatch",
            manual_offset=2,
            now_jst=datetime(2026, 7, 31, 12, 0, tzinfo=JST),
        )
        self.assertEqual((target_date, offset), ("2026-08-02", 2))

    def test_workflow_run_uses_source_start_date_when_completion_crosses_midnight(self) -> None:
        target_date = resolve_youtube_target_date(
            "workflow_run",
            source_run_started_at="2026-07-31T14:55:00Z",
            now_jst=datetime(2026, 8, 1, 0, 30, tzinfo=JST),
        )
        self.assertEqual(target_date, "2026-08-01")

    def test_fallback_cron_uses_next_jst_date(self) -> None:
        target_date = resolve_youtube_target_date(
            "schedule",
            event_schedule="20 9 * * *",
            now_jst=datetime(2026, 7, 31, 18, 20, tzinfo=JST),
        )
        self.assertEqual(target_date, "2026-08-01")

    def test_workflow_run_anchors_delayed_afternoon_to_nominal_cron(self) -> None:
        target_date = resolve_youtube_target_date(
            "workflow_run",
            source_run_started_at="2026-08-27T15:21:27Z",
        )
        self.assertEqual(target_date, "2026-08-28")

    def test_youtube_manual_target_date_is_required(self) -> None:
        with self.assertRaisesRegex(ValueError, "対象日"):
            resolve_youtube_target_date("workflow_dispatch")

    def test_manual_target_date_is_authoritative(self) -> None:
        target_date = resolve_youtube_target_date(
            "workflow_dispatch",
            explicit_target_date="2026-08-05",
            now_jst=datetime(2026, 7, 31, 12, 0, tzinfo=timezone(timedelta(hours=9))),
        )
        self.assertEqual(target_date, "2026-08-05")

    def test_workflows_use_stable_event_sources_and_single_concurrency_group(self) -> None:
        repository_root = BACKEND_DIR.parent
        youtube_workflow = (
            repository_root / ".github" / "workflows" / "keiba-youtube-video-pipeline.yml"
        ).read_text(encoding="utf-8")
        friday_workflow = (
            repository_root / ".github" / "workflows" / "keiba-data-fetch-friday-weekend.yml"
        ).read_text(encoding="utf-8")

        self.assertIn("workflow_run:", youtube_workflow)
        self.assertIn("Keiba Data Fetch (Afternoon)", youtube_workflow)
        self.assertIn("cron: '20 9 * * *'", youtube_workflow)
        self.assertIn("group: keiba-youtube-video-daily", youtube_workflow)
        self.assertIn("YOUTUBE_PUBLISH_MIN_LEAD_MINUTES: '45'", youtube_workflow)
        self.assertIn("github.event.workflow_run.run_started_at", youtube_workflow)
        self.assertIn("github.event.workflow_run.event == 'schedule'", youtube_workflow)
        self.assertIn("github.event.workflow_run.conclusion == 'success'", youtube_workflow)
        self.assertIn("--event-schedule", youtube_workflow)
        self.assertIn("github.event.schedule", friday_workflow)
        self.assertNotIn("date -u +%H", friday_workflow)

    def test_core_daily_workflows_do_not_pass_relative_dates(self) -> None:
        repository_root = BACKEND_DIR.parent
        workflows = [
            "keiba-data-fetch-afternoon.yml",
            "keiba-data-fetch-morning-today.yml",
            "keiba-data-fetch-retry-today.yml",
            "keiba-pipeline-runner.yml",
        ]
        for workflow_name in workflows:
            workflow = (
                repository_root / ".github" / "workflows" / workflow_name
            ).read_text(encoding="utf-8")
            self.assertIn("workflow_dates.py daily", workflow)
            self.assertIn("steps.target_date.outputs.target_date", workflow)
            self.assertNotRegex(workflow, r"--date\s+(today|tomorrow|yesterday)\b")


if __name__ == "__main__":
    unittest.main()
