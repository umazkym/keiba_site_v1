from __future__ import annotations

import unittest
from datetime import date, timedelta

from backend.scripts.agents.data_value_funnel_report import (
    DEFAULT_MEASUREMENT_RELEASE_ID,
    GA4_AD_REVENUE_METRIC,
    _safe_breakdown,
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


def build_accelerated_rows(*, unassigned_sessions: int = 2, sessions_per_day: int = 200):
    channel_rows = []
    page_view_rows = []
    start = date(2026, 8, 4)
    for offset in range(3):
        day = (start + timedelta(days=offset)).isoformat()
        channel_rows.extend([
            {
                "date": day,
                "channel": "Organic Search",
                "sessions": sessions_per_day - unassigned_sessions,
            },
            {
                "date": day,
                "channel": "Unassigned",
                "sessions": unassigned_sessions,
            },
        ])
        page_view_rows.extend([
            {
                "date": day,
                "measurement_release_id": DEFAULT_MEASUREMENT_RELEASE_ID,
                "page_type": "article",
                "content_group": "grade_race",
                "page_views": 197,
            },
            {
                "date": day,
                "measurement_release_id": DEFAULT_MEASUREMENT_RELEASE_ID,
                "page_type": "(not set)",
                "content_group": "grade_race",
                "page_views": 1,
            },
            {
                "date": day,
                "measurement_release_id": "(not set)",
                "page_type": "(not set)",
                "content_group": "(not set)",
                "page_views": 2,
            },
        ])
    return channel_rows, page_view_rows


class MeasurementQualityGateTest(unittest.TestCase):
    def test_breakdown_uses_current_ga4_ad_revenue_metric(self) -> None:
        class FakeRequest:
            def execute(self):
                return {"rows": []}

        class FakeProperties:
            body = None

            def runReport(self, *, property, body):
                self.body = body
                return FakeRequest()

        class FakeService:
            def __init__(self):
                self.reports = FakeProperties()

            def properties(self):
                return self.reports

        service = FakeService()
        result = _safe_breakdown(
            service,
            "461553182",
            start_date="2026-08-04",
            end_date="2026-08-06",
            dimension="date",
        )

        self.assertTrue(result["available"])
        self.assertEqual(GA4_AD_REVENUE_METRIC, "totalAdRevenue")
        self.assertEqual(
            [metric["name"] for metric in service.reports.body["metrics"]],
            ["sessions", "screenPageViews", "totalAdRevenue", "activeUsers"],
        )

    def test_three_complete_days_below_two_percent_and_500_sessions_pass_fast_gate(self) -> None:
        channel_rows, page_view_rows = build_accelerated_rows()
        result = evaluate_measurement_quality_gate(
            channel_rows=channel_rows,
            page_view_rows=page_view_rows,
            target_release_id=DEFAULT_MEASUREMENT_RELEASE_ID,
        )
        self.assertTrue(result["ready_for_new_experiment"])
        self.assertEqual(result["gate_mode"], "accelerated")
        self.assertEqual(result["required_complete_days"], 3)
        self.assertEqual(result["accelerated_gate"]["observed_sessions"], 600)

    def test_exactly_two_percent_unassigned_fails_fast_gate(self) -> None:
        channel_rows, page_view_rows = build_accelerated_rows(unassigned_sessions=4)
        result = evaluate_measurement_quality_gate(
            channel_rows=channel_rows,
            page_view_rows=page_view_rows,
            target_release_id=DEFAULT_MEASUREMENT_RELEASE_ID,
        )
        self.assertFalse(result["ready_for_new_experiment"])
        self.assertFalse(result["accelerated_gate"]["ready"])

    def test_fast_gate_requires_500_sessions(self) -> None:
        channel_rows, page_view_rows = build_accelerated_rows(
            unassigned_sessions=1,
            sessions_per_day=166,
        )
        result = evaluate_measurement_quality_gate(
            channel_rows=channel_rows,
            page_view_rows=page_view_rows,
            target_release_id=DEFAULT_MEASUREMENT_RELEASE_ID,
        )
        self.assertFalse(result["ready_for_new_experiment"])
        self.assertEqual(result["accelerated_gate"]["observed_sessions"], 498)

    def test_seven_complete_days_below_five_percent_pass(self) -> None:
        channel_rows, page_view_rows = build_rows()
        result = evaluate_measurement_quality_gate(
            channel_rows=channel_rows,
            page_view_rows=page_view_rows,
            target_release_id=DEFAULT_MEASUREMENT_RELEASE_ID,
        )
        self.assertTrue(result["ready_for_new_experiment"])
        self.assertEqual(result["gate_mode"], "standard")
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
