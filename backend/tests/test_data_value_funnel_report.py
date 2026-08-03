from __future__ import annotations

import unittest
from datetime import date, timedelta

from backend.scripts.agents.data_value_funnel_report import (
    DEFAULT_MEASUREMENT_RELEASE_ID,
    evaluate_measurement_quality_gate,
)


def build_rows(*, failing_last_day: bool = False, skip_day: int | None = None):
    channel_rows = []
    page_view_rows = []
    start = date(2026, 8, 1)
    for offset in range(7):
        if skip_day == offset:
            continue
        day = (start + timedelta(days=offset)).isoformat()
        unassigned = 5 if failing_last_day and offset == 6 else 4
        channel_rows.extend([
            {"date": day, "channel": "Organic Search", "sessions": 100 - unassigned},
            {"date": day, "channel": "Unassigned", "sessions": unassigned},
        ])
        page_view_rows.extend([
            {
                "date": day,
                "measurement_release_id": DEFAULT_MEASUREMENT_RELEASE_ID,
                "page_type": "article",
                "content_group": "grade_race",
                "page_views": 94,
            },
            {
                "date": day,
                "measurement_release_id": DEFAULT_MEASUREMENT_RELEASE_ID,
                "page_type": "(not set)",
                "content_group": "grade_race",
                "page_views": 2,
            },
            {
                "date": day,
                "measurement_release_id": "(not set)",
                "page_type": "(not set)",
                "content_group": "(not set)",
                "page_views": 4,
            },
        ])
    return channel_rows, page_view_rows


class MeasurementQualityGateTest(unittest.TestCase):
    def test_seven_complete_days_below_five_percent_pass(self) -> None:
        channel_rows, page_view_rows = build_rows()
        result = evaluate_measurement_quality_gate(
            channel_rows=channel_rows,
            page_view_rows=page_view_rows,
            target_release_id=DEFAULT_MEASUREMENT_RELEASE_ID,
        )
        self.assertTrue(result["ready_for_new_experiment"])
        self.assertEqual(result["consecutive_pass_days"], 7)
        self.assertEqual(result["latest_complete_date"], "2026-08-07")

    def test_exactly_five_percent_unassigned_fails(self) -> None:
        channel_rows, page_view_rows = build_rows(failing_last_day=True)
        result = evaluate_measurement_quality_gate(
            channel_rows=channel_rows,
            page_view_rows=page_view_rows,
            target_release_id=DEFAULT_MEASUREMENT_RELEASE_ID,
        )
        self.assertFalse(result["ready_for_new_experiment"])
        self.assertEqual(result["consecutive_pass_days"], 0)

    def test_missing_calendar_day_breaks_consecutive_count(self) -> None:
        channel_rows, page_view_rows = build_rows(skip_day=3)
        result = evaluate_measurement_quality_gate(
            channel_rows=channel_rows,
            page_view_rows=page_view_rows,
            target_release_id=DEFAULT_MEASUREMENT_RELEASE_ID,
        )
        self.assertFalse(result["ready_for_new_experiment"])
        self.assertEqual(result["consecutive_pass_days"], 3)


if __name__ == "__main__":
    unittest.main()
