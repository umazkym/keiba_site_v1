from __future__ import annotations

import unittest

from backend.scripts.agents.monetization_weekly_report import SCHEMA_VERSION, build_report


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
        self.assertGreaterEqual(len(report["warnings"]), 3)


if __name__ == "__main__":
    unittest.main()
