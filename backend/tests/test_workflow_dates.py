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
    resolve_friday_weekend_target_date,
    resolve_youtube_target_date,
)


class WorkflowDatesTest(unittest.TestCase):
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
        target_date, recovery_mode = resolve_youtube_target_date(
            "workflow_run",
            source_run_started_at="2026-07-31T14:55:00Z",
            now_jst=datetime(2026, 8, 1, 0, 30, tzinfo=JST),
        )
        self.assertEqual((target_date, recovery_mode), ("2026-08-01", False))

    def test_fallback_cron_uses_next_jst_date(self) -> None:
        target_date, recovery_mode = resolve_youtube_target_date(
            "schedule",
            event_schedule="20 9 * * *",
            now_jst=datetime(2026, 7, 31, 18, 20, tzinfo=JST),
        )
        self.assertEqual((target_date, recovery_mode), ("2026-08-01", False))

    def test_unknown_cron_keeps_next_day_target(self) -> None:
        target_date, recovery_mode = resolve_youtube_target_date(
            "schedule",
            now_jst=datetime(2026, 7, 31, 18, 20, tzinfo=JST),
        )
        self.assertEqual((target_date, recovery_mode), ("2026-08-01", False))

    def test_recovery_cron_targets_same_jst_date(self) -> None:
        target_date, recovery_mode = resolve_youtube_target_date(
            "schedule",
            event_schedule="30 3 * * *",
            now_jst=datetime(2026, 7, 31, 12, 30, tzinfo=JST),
        )
        self.assertEqual((target_date, recovery_mode), ("2026-07-31", True))

    def test_manual_target_date_is_authoritative(self) -> None:
        target_date, recovery_mode = resolve_youtube_target_date(
            "workflow_dispatch",
            explicit_target_date="2026-08-05",
            now_jst=datetime(2026, 7, 31, 12, 0, tzinfo=timezone(timedelta(hours=9))),
        )
        self.assertEqual((target_date, recovery_mode), ("2026-08-05", False))

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
        self.assertIn("cron: '30 3 * * *'", youtube_workflow)
        self.assertIn("--recovery-only", youtube_workflow)
        self.assertIn("group: keiba-youtube-video-daily", youtube_workflow)
        self.assertIn("YOUTUBE_PUBLISH_MIN_LEAD_MINUTES: '45'", youtube_workflow)
        self.assertIn("github.event.workflow_run.run_started_at", youtube_workflow)
        self.assertIn("github.event.schedule", youtube_workflow)
        self.assertIn("github.event.schedule", friday_workflow)
        self.assertNotIn("date -u +%H", friday_workflow)


if __name__ == "__main__":
    unittest.main()
