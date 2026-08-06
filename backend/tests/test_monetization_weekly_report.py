from __future__ import annotations

import unittest

from backend.scripts.agents.monetization_weekly_report import (
    SCHEMA_VERSION,
    build_report,
    resolve_formal_week,
)


class MonetizationWeeklyReportTest(unittest.TestCase):
    def test_contract_keeps_quality_warnings_and_no_automatic_action(self) -> None:
        report = build_report(
            ga4={
                "period": {"start_date": "2026-07-01", "end_date": "2026-07-28"},
                "events": {"race_view": {"event_count": 100, "users": 80}},
                "publisher_revenue": {"available": False},
                "measurement_quality_gate": {"ready_for_new_experiment": False},
            },
            gsc={
                "periods": {"current": {"start_date": "2026-07-01", "end_date": "2026-07-28"}},
                "query_device_opportunities": [{"query": "稍重", "opportunity_score": 10}],
            },
            clarity_dir=None,
        )
        self.assertEqual(report["schema_version"], SCHEMA_VERSION)
        self.assertEqual(report["automatic_action"], "none")
        self.assertEqual(report["funnel"]["race_view"]["event_count"], 100)
        self.assertEqual(len(report["search"]["opportunities"]), 1)
        self.assertIn("ad_experiment_exposure", report["experiments"])
        self.assertIn("adsense_daily", report)
        self.assertIn("youtube", report)
        self.assertIn("social_workflows", report)
        self.assertGreaterEqual(len(report["warnings"]), 3)

    def test_formal_week_requires_sunday_and_exact_supplied_periods(self) -> None:
        status = resolve_formal_week(
            "2026-08-02",
            ga4={"period": {"start_date": "2026-07-27", "end_date": "2026-08-02"}},
            gsc={"periods": {"current": {"start_date": "2026-07-27", "end_date": "2026-08-02"}}},
            adsense_daily={
                "rows": [
                    {"date": f"2026-07-{day:02d}"}
                    for day in range(27, 32)
                ] + [
                    {"date": "2026-08-01"},
                    {"date": "2026-08-02"},
                ]
            },
        )
        self.assertTrue(status["formal"])
        self.assertEqual(len(status["expected_dates"]), 7)

        incomplete = resolve_formal_week(
            "2026-08-02",
            adsense_daily={"rows": [{"date": "2026-08-02"}]},
        )
        self.assertFalse(incomplete["formal"])
        self.assertEqual(incomplete["incomplete_sources"], ["AdSense"])

        with self.assertRaisesRegex(ValueError, "日曜日"):
            resolve_formal_week("2026-08-01")

        no_sources = resolve_formal_week("2026-08-02")
        self.assertFalse(no_sources["formal"])
        self.assertEqual(no_sources["checked_sources"], [])

        missing_period = resolve_formal_week("2026-08-02", ga4={"sessions": 500})
        self.assertFalse(missing_period["formal"])
        self.assertEqual(missing_period["incomplete_sources"], ["GA4"])


if __name__ == "__main__":
    unittest.main()
