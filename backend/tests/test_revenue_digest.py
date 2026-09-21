from __future__ import annotations

import json
import unittest
from datetime import date, timedelta
from pathlib import Path

from backend.scripts.agents.monetization_history import build_analysis, common_row
from backend.scripts.agents.revenue_digest import build_weekly_digest


def _coverage(start: str, days: int) -> list[str]:
    start_date = date.fromisoformat(start)
    return [(start_date + timedelta(days=index)).isoformat() for index in range(days)]


def _analysis(*, partial: bool = False, rpm: object = 500.0) -> dict:
    current_dates = _coverage("2026-04-20", 7)
    rolling_dates = _coverage("2026-03-30", 28)
    status = "partial" if partial else "complete"
    return {
        "current_week": {
            "start_date": "2026-04-20",
            "end_date": "2026-04-26",
            "adsense_revenue_jpy": 2_000.0,
            "date_coverage": {"adsense": list(current_dates)},
            "adsense_metric_coverage": {
                "estimated_earnings": list(current_dates),
                "page_views": list(current_dates),
            },
        },
        "rolling_28_days": {
            "start_date": "2026-03-30",
            "end_date": "2026-04-26",
            "adsense_revenue_jpy": 8_400.0,
            "page_rpm_jpy": rpm,
            "date_coverage": {"adsense": list(rolling_dates)},
            "adsense_metric_coverage": {
                "estimated_earnings": list(rolling_dates),
                "page_views": list(rolling_dates),
            },
        },
        "source_status": {
            "adsense": {"status": status, "reports": {"daily": {"status": status}}},
            "ga4": {"status": "complete", "reports": {"daily": {"status": "complete"}}},
            "gsc": {"status": "complete", "reports": {"daily": {"status": "complete"}}},
        },
        "root_causes": [{"category": "revenue_efficiency"}],
    }


class RevenueDigestTest(unittest.TestCase):
    def test_complete_data_uses_adsense_only_for_pace_and_pv(self) -> None:
        analysis = _analysis()
        analysis["current_week"]["ga4_ad_revenue"] = 999_999.0
        analysis["rolling_28_days"]["ga4_ad_revenue"] = 999_999.0

        digest = build_weekly_digest(analysis)

        self.assertIn("今週のAdSense収益: 2,000円", digest["body"])
        self.assertIn("30日換算ペース: 9,000円", digest["body"])
        self.assertIn("目標までの不足額: 1,000円", digest["body"])
        self.assertIn("2,000 PV", digest["body"])
        self.assertNotIn("999,999", digest["body"])
        self.assertEqual(digest["period_end"], "2026-04-26")
        self.assertTrue(digest["needs_attention"])
        self.assertIn("action_traffic", digest["reason_codes"])

    def test_partial_source_or_missing_coverage_makes_pace_undetermined(self) -> None:
        digest = build_weekly_digest(_analysis(partial=True))

        self.assertIn("今週のAdSense収益: 未判定", digest["body"])
        self.assertIn("30日換算ペース: 未判定", digest["body"])
        self.assertIn("不足額を補う目安のPV（直近28日の実績RPM使用）: 未判定", digest["body"])
        self.assertIn("adsense_daily_report_partial", digest["reason_codes"])
        self.assertIn("monthly_pace_unavailable", digest["reason_codes"])

        missing_coverage = _analysis()
        missing_coverage["rolling_28_days"]["date_coverage"]["adsense"].pop()
        digest = build_weekly_digest(missing_coverage)
        self.assertIn("直近28日からの30日換算ペース: 未判定", digest["body"])
        self.assertIn("rolling_28_days_adsense_date_coverage_incomplete", digest["reason_codes"])

    def test_null_zero_and_nonfinite_are_distinct(self) -> None:
        zero_digest = build_weekly_digest(_analysis(rpm=0))
        self.assertIn("30日換算ペース: 9,000円", zero_digest["body"])
        self.assertIn("目安のPV（直近28日の実績RPM使用）: 未判定", zero_digest["body"])
        self.assertIn("rolling_28_days_rpm_nonpositive", zero_digest["reason_codes"])

        null_analysis = _analysis()
        null_analysis["rolling_28_days"]["adsense_revenue_jpy"] = None
        null_digest = build_weekly_digest(null_analysis)
        self.assertIn("30日換算ペース: 未判定", null_digest["body"])
        self.assertIn("rolling_28_days_adsense_revenue_missing", null_digest["reason_codes"])

        nonfinite_analysis = _analysis()
        nonfinite_analysis["rolling_28_days"]["page_rpm_jpy"] = float("nan")
        nonfinite_digest = build_weekly_digest(nonfinite_analysis)
        self.assertIn("rolling_28_days_rpm_missing", nonfinite_digest["reason_codes"])

    def test_metric_coverage_is_required_for_revenue_pace_and_required_pv(self) -> None:
        legacy_analysis = _analysis()
        del legacy_analysis["current_week"]["adsense_metric_coverage"]
        del legacy_analysis["rolling_28_days"]["adsense_metric_coverage"]

        legacy_digest = build_weekly_digest(legacy_analysis)

        self.assertIn("今週のAdSense収益: 未判定", legacy_digest["body"])
        self.assertIn("30日換算ペース: 未判定", legacy_digest["body"])
        self.assertIn("current_week_adsense_metric_coverage_unavailable", legacy_digest["reason_codes"])
        self.assertIn("rolling_28_days_adsense_metric_coverage_unavailable", legacy_digest["reason_codes"])

        page_views_missing = _analysis()
        page_views_missing["rolling_28_days"]["adsense_metric_coverage"]["page_views"].pop()
        digest = build_weekly_digest(page_views_missing)

        self.assertIn("30日換算ペース: 9,000円", digest["body"])
        self.assertIn("目安のPV（直近28日の実績RPM使用）: 未判定", digest["body"])
        self.assertIn("rolling_28_days_adsense_page_views_coverage_incomplete", digest["reason_codes"])

    def test_public_body_never_contains_private_metrics_or_hypothesis(self) -> None:
        analysis = _analysis()
        analysis["root_causes"] = [{"category": "data_quality", "hypothesis": "GA4収益が123円"}]
        digest = build_weekly_digest(analysis)

        self.assertEqual(digest["public_title"], "UMA-FREE 週次状況（2026-04-26時点）")
        self.assertIn("目標への進み具合: まだ届いていません", digest["public_body"])
        self.assertIn("あなたの対応: 確認が必要", digest["public_body"])
        self.assertIn("全記事チェックは不要です。", digest["public_body"])
        for forbidden in ("2,000", "9,000", "500", "GA4収益", "http", "@"):
            self.assertNotIn(forbidden, digest["public_body"])

    def test_reaching_simple_pace_is_not_described_as_confirmed_monthly_revenue(self) -> None:
        analysis = _analysis()
        analysis["rolling_28_days"]["adsense_revenue_jpy"] = 10_000

        digest = build_weekly_digest(analysis)

        self.assertIn("単純換算では目標水準に到達", digest["public_body"])
        self.assertIn("実月収の確定達成ではありません", digest["public_body"])

    def test_routine_and_goal_shortfall_do_not_require_manual_check(self) -> None:
        analysis = _analysis()
        analysis["root_causes"] = [{"category": "unknown"}]

        digest = build_weekly_digest(analysis)

        self.assertFalse(digest["needs_attention"])
        self.assertIn("あなたの対応: 確認不要", digest["public_body"])
        self.assertIn("自動収集を継続します", digest["public_body"])

    def test_ga4_or_gsc_failure_is_a_fixed_data_quality_attention(self) -> None:
        analysis = _analysis()
        analysis["source_status"]["gsc"] = {"status": "failed", "reports": {"daily": {"status": "failed"}}}

        digest = build_weekly_digest(analysis)

        self.assertTrue(digest["needs_attention"])
        self.assertIn("core_non_adsense_source_incomplete", digest["reason_codes"])
        self.assertIn("action_data_quality", digest["reason_codes"])
        del analysis["source_status"]["gsc"]
        self.assertIn("core_non_adsense_source_incomplete", build_weekly_digest(analysis)["reason_codes"])

    def test_generated_analysis_json_has_rolling_date_coverage(self) -> None:
        week_end = date(2026, 4, 26)
        rows = []
        for offset in range(44):
            day = week_end - timedelta(days=43 - offset)
            rows.append(common_row(
                "adsense", "daily", day.isoformat(), "test", "fixture", "unit-test", {},
                {"estimated_earnings": 10, "page_views": 100},
            ))
            rows.append(common_row(
                "ga4", "daily", day.isoformat(), "test", "fixture", "unit-test", {},
                {"sessions": 80, "screenPageViews": 100},
            ))
            rows.append(common_row(
                "gsc", "daily", day.isoformat(), "test", "fixture", "unit-test", {},
                {"clicks": 10, "impressions": 100},
            ))
        analysis = build_analysis(
            {"rows": rows, "source_status": {"adsense": {"status": "complete", "reports": {"daily": {"status": "complete"}}}}},
            week_end,
            None,
            None,
            Path.cwd(),
        )
        generated_json = json.loads(json.dumps(analysis))
        coverage = generated_json["rolling_28_days"]["date_coverage"]["adsense"]
        earnings_coverage = generated_json["rolling_28_days"]["adsense_metric_coverage"]["estimated_earnings"]
        page_views_coverage = generated_json["rolling_28_days"]["adsense_metric_coverage"]["page_views"]
        self.assertEqual(len(coverage), 28)
        self.assertEqual(len(earnings_coverage), 28)
        self.assertEqual(len(page_views_coverage), 28)
        self.assertEqual(coverage[0], "2026-03-30")
        self.assertEqual(coverage[-1], "2026-04-26")


if __name__ == "__main__":
    unittest.main()
