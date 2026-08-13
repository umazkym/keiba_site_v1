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
    parse_adsense_report,
    resolve_period,
    safe_error,
    source_summary,
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
            "source_details": {},
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


if __name__ == "__main__":
    unittest.main()
