from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from backend.scripts.agents.monetization_history import (
    BUSINESS_START_DATE,
    Period,
    YOUTUBE_REPORTS,
    assess_grade_races,
    build_analysis,
    clarity_snapshot_summary,
    common_row,
    deduplicate_history_rows,
    grade_article_weekly_replacement,
    grade_race_publish_lead_days,
    parse_adsense_report,
    parse_ga4_report,
    resolve_period,
    safe_error,
    source_summary,
    traffic_cross_analysis,
    workflow_failure_impact,
)


def daily_row(source: str, dataset: str, day: date, metrics: dict[str, float]):
    return common_row(
        source,
        dataset,
        day.isoformat(),
        "test",
        "fixture",
        "unit-test",
        {},
        metrics,
    )


class MonetizationHistoryTest(unittest.TestCase):
    def test_youtube_video_report_uses_supported_top_video_query(self) -> None:
        video_report = next(
            report for report in YOUTUBE_REPORTS if report["name"] == "video_period"
        )
        metrics = set(video_report["metrics"].split(","))

        self.assertEqual(video_report["dimensions"], "video")
        self.assertEqual(video_report["sort"], "-views")
        self.assertTrue(video_report["single_page"])
        self.assertIn("views", metrics)
        self.assertIn("averageViewPercentage", metrics)
        self.assertNotIn("impressions", metrics)
        self.assertNotIn("impressionClickThroughRate", metrics)

    def test_business_boundary_and_first_complete_week(self) -> None:
        period = resolve_period("backfill", None, date(2026, 3, 22))
        self.assertEqual(period.start, BUSINESS_START_DATE)
        self.assertEqual(period.days, 9)
        with self.assertRaisesRegex(ValueError, "2026-03-14"):
            Period(date(2026, 3, 13), date(2026, 3, 14))

    def test_adsense_parser_keeps_missing_distinct_from_zero(self) -> None:
        rows = parse_adsense_report(
            "daily",
            {
                "headers": [
                    {"name": "DATE", "type": "DIMENSION"},
                    {"name": "ESTIMATED_EARNINGS", "type": "METRIC_TALLY"},
                    {"name": "CLICKS", "type": "METRIC_TALLY"},
                ],
                "rows": [
                    {"cells": [{"value": "2026-03-14"}, {"value": "12.5"}, {"value": "0"}]},
                    {"cells": [{"value": "2026-03-15"}, {"value": ""}]},
                ],
            },
        )
        self.assertEqual(rows[0]["metrics"]["clicks"], 0.0)
        self.assertIsNone(rows[1]["metrics"]["estimated_earnings"])
        self.assertIsNone(rows[1]["metrics"]["clicks"])

    def test_source_summary_marks_partial_report(self) -> None:
        result = {
            "rows": [{"source": "ga4"}],
            "reports": {
                "daily": {"status": "complete"},
                "page_type": {"status": "unavailable"},
            },
        }
        self.assertEqual(source_summary(result)["status"], "partial")

    def test_identical_history_rows_are_idempotent(self) -> None:
        row = daily_row("gsc", "daily", date(2026, 3, 14), {"clicks": 1})
        unique = deduplicate_history_rows([row, dict(row)])
        self.assertEqual(len(unique), 1)

    def test_sensitive_values_are_redacted(self) -> None:
        with patch.dict(os.environ, {"UNIT_TEST_REFRESH_TOKEN": "secret-token-value"}):
            rendered = safe_error(RuntimeError(
                "Authorization: Bearer abc123 refresh_token=secret-token-value"
            ))
        self.assertNotIn("abc123", rendered)
        self.assertNotIn("secret-token-value", rendered)
        self.assertIn("[REDACTED]", rendered)

    def test_clarity_snapshot_is_marked_as_72_hours(self) -> None:
        history = {"rows": [
            common_row("clarity", "csv/overview/08_Traffic", "2026-08-13", "rolling", "72h", "fixture", {}, {
                "totalSessionCount": 100,
                "totalBotSessionCount": 20,
                "distinctUserCount": 60,
            }),
            common_row("clarity", "csv/overview/05_ScriptErrorCount", "2026-08-13", "rolling", "72h", "fixture", {}, {
                "sessionsWithMetricPercentage": 2.5,
            }),
        ]}
        summary = clarity_snapshot_summary(history)
        self.assertEqual(summary["human_session_estimate"], 80)
        self.assertEqual(summary["script_error_rate"], 0.025)
        self.assertEqual(summary["history_limit"], "latest_72_hours")

    def test_formal_week_requires_all_three_daily_sources(self) -> None:
        week_end = date(2026, 3, 22)
        rows = []
        for offset in range(7):
            day = week_end - timedelta(days=6 - offset)
            rows.extend([
                daily_row("adsense", "daily", day, {
                    "estimated_earnings": 10,
                    "page_views": 100,
                    "impressions": 250,
                }),
                daily_row("ga4", "daily", day, {
                    "sessions": 80,
                    "screenPageViews": 120,
                    "totalAdRevenue": 9,
                }),
                daily_row("gsc", "daily", day, {"clicks": 5, "impressions": 100}),
            ])
        history = {
            "rows": rows,
            "source_status": {
                "adsense": {"status": "complete"},
                "ga4": {"status": "complete"},
                "gsc": {"status": "complete"},
            },
            "source_details": {"ga4": {"currency_code": "JPY"}},
        }
        analysis = build_analysis(history, week_end, None, None, Path.cwd())
        self.assertTrue(analysis["formal_week"]["formal"])
        self.assertEqual(analysis["previous_week"]["start_date"], "2026-03-14")
        self.assertEqual(analysis["previous_week"]["end_date"], "2026-03-15")
        self.assertEqual(analysis["revenue_reconciliation"]["status"], "review")

        history["rows"] = [
            row for row in rows
            if not (row["source"] == "gsc" and row["date"] == "2026-03-18")
        ]
        incomplete = build_analysis(history, week_end, None, None, Path.cwd())
        self.assertFalse(incomplete["formal_week"]["formal"])
        self.assertFalse(incomplete["formal_week"]["source_date_completeness"]["gsc"])

    def test_ga4_currency_is_preserved_and_not_compared_to_jpy(self) -> None:
        payload = {
            "dimensionHeaders": [{"name": "date"}],
            "metricHeaders": [{"name": "totalAdRevenue"}],
            "metadata": {"currencyCode": "USD", "timeZone": "Etc/GMT-9"},
            "rows": [{
                "dimensionValues": [{"value": "20260316"}],
                "metricValues": [{"value": "0.25"}],
            }],
        }
        parsed = parse_ga4_report("daily", payload)
        self.assertEqual(parsed[0]["source_currency"], "USD")
        self.assertEqual(parsed[0]["source_timezone"], "Etc/GMT-9")

        rows = []
        week_end = date(2026, 3, 22)
        for offset in range(7):
            day = week_end - timedelta(days=6 - offset)
            rows.extend([
                daily_row("adsense", "daily", day, {"estimated_earnings": 10, "page_views": 100}),
                {**daily_row("ga4", "daily", day, {"sessions": 80, "screenPageViews": 120, "totalAdRevenue": 0.25}), "source_currency": "USD"},
                daily_row("gsc", "daily", day, {"clicks": 5, "impressions": 100}),
            ])
        analysis = build_analysis({"rows": rows, "source_status": {}, "source_details": {}}, week_end, None, None, Path.cwd())
        reconciliation = analysis["revenue_reconciliation"]
        self.assertEqual(reconciliation["status"], "currency_mismatch")
        self.assertIsNone(reconciliation["difference_rate"])
        self.assertIsNone(reconciliation["ga4_ad_revenue_jpy"])

    def test_grade_race_classifications_cover_missing_and_hit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inventory_path = root / "inventory.json"
            schedule_path = root / "schedule.json"
            inventory_path.write_text(json.dumps({
                "articles": [{
                    "entity_type": "grade_race",
                    "entity_key": "hit-race",
                    "scheduled_race_date": "2026-04-12",
                    "canonical_url": "https://uma-free.com/articles/hit-race",
                    "source_slug": "hit-race",
                    "title": "ヒット重賞",
                }]
            }, ensure_ascii=False), encoding="utf-8")
            schedule_path.write_text(json.dumps({
                "races": [
                    {"entity_key": "missing-race", "race_name": "未掲載重賞", "race_date": "2026-04-05"},
                    {"entity_key": "hit-race", "race_name": "ヒット重賞", "race_date": "2026-04-12"},
                ]
            }, ensure_ascii=False), encoding="utf-8")
            history = {
                "rows": [
                    daily_row("gsc", "page_daily", date(2026, 4, 1), {
                        "impressions": 1000,
                        "clicks": 80,
                    }) | {"dimensions": {"page": "https://uma-free.com/articles/hit-race"}},
                    daily_row("ga4", "landing_device", date(2026, 4, 1), {
                        "sessions": 70,
                        "totalAdRevenue": 15,
                    }) | {"dimensions": {"landingPagePlusQueryString": "/articles/hit-race"}},
                ]
            }
            with patch(
                "backend.scripts.agents.monetization_history.git_first_commit_date",
                return_value="2026-03-15",
            ):
                rows, quality = assess_grade_races(
                    history, inventory_path, schedule_path, root
                )
            by_key = {row["entity_key"]: row for row in rows}
            self.assertEqual(by_key["missing-race"]["classification"], "記事なし")
            self.assertEqual(by_key["hit-race"]["classification"], "検索・回遊・収益が良好")
            self.assertEqual(quality["missing_article_detection"], "complete")

    def test_grade_race_publish_lead_matches_demand_policy(self) -> None:
        self.assertEqual(grade_race_publish_lead_days("G1", "jra"), 21)
        self.assertEqual(grade_race_publish_lead_days("JpnII", "nar"), 14)
        self.assertEqual(grade_race_publish_lead_days("G3", "JRA"), 10)
        self.assertEqual(grade_race_publish_lead_days("S1", "nar", 300, demand_profile_known=True), 9)
        self.assertEqual(grade_race_publish_lead_days("S2", "nar", 120, demand_profile_known=True), 3)
        self.assertIsNone(grade_race_publish_lead_days("S3", "nar", 49, demand_profile_known=True))

    def test_grade_article_weekly_replacement_and_cross_analysis(self) -> None:
        previous = Period(date(2026, 7, 27), date(2026, 8, 2))
        current = Period(date(2026, 8, 3), date(2026, 8, 9))
        article_url = "https://uma-free.com/articles/grade-a"
        rows = [
            daily_row("gsc", "page_daily", date(2026, 8, 1), {"clicks": 100})
            | {"dimensions": {"page": article_url}},
            daily_row("gsc", "page_daily", date(2026, 8, 8), {"clicks": 15})
            | {"dimensions": {"page": article_url}},
            daily_row("youtube", "daily", date(2026, 8, 1), {"views": 1000}),
            daily_row("youtube", "daily", date(2026, 8, 8), {"views": 1600}),
            daily_row("ga4", "acquisition", date(2026, 8, 1), {"sessions": 3})
            | {"dimensions": {"sessionDefaultChannelGroup": "Organic Video", "sessionSourceMedium": "youtube / referral"}},
            daily_row("ga4", "acquisition", date(2026, 8, 8), {"sessions": 9})
            | {"dimensions": {"sessionDefaultChannelGroup": "Organic Video", "sessionSourceMedium": "youtube / video"}},
        ]
        history = {"rows": rows}
        replacement = grade_article_weekly_replacement(
            history,
            [{"canonical_url": article_url, "source_slug": "grade-a"}],
            current,
            previous,
        )
        self.assertEqual(replacement["previous_grade_article_clicks"], 100)
        self.assertEqual(replacement["current_grade_article_clicks"], 15)
        self.assertAlmostEqual(replacement["replacement_rate"], 0.15)
        self.assertEqual(replacement["status"], "critical")

        cross = traffic_cross_analysis(history, current, previous)
        self.assertEqual(cross["youtube_site_recovery"]["youtube_views"], 1600)
        self.assertEqual(cross["youtube_site_recovery"]["youtube_source_sessions"], 9)
        self.assertFalse(cross["youtube_site_recovery"]["site_recovery_supported"])
        self.assertEqual(cross["youtube_site_recovery"]["utm_missing_rate"], 1.0)
        self.assertEqual(cross["youtube_site_recovery"]["race_funnel_attribution_status"], "unavailable")

    def test_workflow_failure_impact_separates_article_draft_failures(self) -> None:
        history = {"source_details": {"github_actions": {"failure_jobs": [
            {
                "created_at": "2026-08-04T01:00:00Z",
                "workflow": "Keiba Article Auto Pipeline",
                "failed_steps": ["Generate Draft and Review"],
            },
            {
                "created_at": "2026-08-05T01:00:00Z",
                "workflow": "Keiba Article Auto Pipeline",
                "failed_steps": ["Generate Draft and Review"],
            },
            {
                "created_at": "2026-08-06T01:00:00Z",
                "workflow": "YouTube Daily",
                "failed_steps": ["Upload"],
            },
        ]}}}
        impact = workflow_failure_impact(history, Period(date(2026, 8, 3), date(2026, 8, 9)))
        self.assertEqual(impact["all_failure_jobs"], 3)
        self.assertEqual(impact["article_pipeline_failures"], 2)
        self.assertEqual(impact["draft_review_failures"], 2)
        self.assertTrue(impact["repeated_draft_review_failure"])


if __name__ == "__main__":
    unittest.main()
