from __future__ import annotations

import unittest
import json
from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from backend.scripts.agents.revenue_notifications import build_daily_notice, collect_daily, main


TODAY = date(2026, 9, 21)
END = TODAY - timedelta(days=2)
CURRENT = [END - timedelta(days=1), END]
PREVIOUS = [day - timedelta(days=7) for day in CURRENT]


def _row(source: str, dataset: str, day: date, metrics: dict, dimensions: dict | None = None) -> dict:
    return {
        "source": source,
        "dataset": dataset,
        "date": day.isoformat(),
        "metrics": metrics,
        "dimensions": dimensions or {},
    }


def _results(
    *,
    ads_values: list[object] | None = None,
    session_values: list[object] | None = None,
    ads_status: str = "complete",
    ga_daily_status: str = "complete",
    acquisition_status: str = "complete",
) -> dict:
    days = [*CURRENT, *PREVIOUS]
    ads_values = ads_values or [100, 100, 100, 100]
    session_values = session_values or [100, 100, 100, 100]
    ads_rows = [_row("adsense", "daily", day, {"impressions": value}) for day, value in zip(days, ads_values)]
    ga_rows = [_row("ga4", "daily", day, {"sessions": value}) for day, value in zip(days, session_values)]
    ga_rows.extend(
        _row("ga4", "acquisition", day, {"sessions": 100}, {"sessionSourceMedium": "google / organic"})
        for day in CURRENT
    )
    return {
        "adsense": {"reports": {"daily": {"status": ads_status}}, "rows": ads_rows},
        "ga4": {
            "reports": {
                "daily": {"status": ga_daily_status},
                "acquisition": {"status": acquisition_status},
            },
            "rows": ga_rows,
        },
    }


class RevenueNotificationsTest(unittest.TestCase):
    def test_api_exceptions_do_not_leak_into_public_notice(self) -> None:
        with patch('backend.scripts.agents.revenue_notifications.history.collect_adsense',
                   side_effect=RuntimeError('機密値と収益12345円')), \
             patch('backend.scripts.agents.revenue_notifications.history.collect_ga4',
                   side_effect=RuntimeError('機密値と訪問12345件')):
            payload = collect_daily(TODAY)
        self.assertIn('adsense_fetch_failed', payload['reason_codes'])
        self.assertIn('ga4_fetch_failed', payload['reason_codes'])
        self.assertNotIn('12345', json.dumps(payload, ensure_ascii=False))
        self.assertNotIn('機密値', json.dumps(payload, ensure_ascii=False))

    def test_cli_keeps_only_public_body_and_marks_incomplete_workflow(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            analysis = root / 'analysis.json'
            analysis.write_text('{}', encoding='utf-8')
            digest = {'period_end': '2026-09-20', 'reason_codes': ['action_routine'],
                      'needs_attention': False, 'public_title': '週次確認',
                      'public_body': '- あなたの対応: 確認不要', 'body': '収益12345円'}
            with patch('sys.argv', ['notify', '--kind', 'weekly', '--analysis', str(analysis),
                                  '--output-dir', str(root / 'public'), '--workflow-status', 'incomplete']), \
                 patch('backend.scripts.agents.revenue_digest.build_weekly_digest', return_value=digest):
                self.assertEqual(main(), 0)
            payload = json.loads((root / 'public/notification.json').read_text(encoding='utf-8'))
            self.assertTrue(payload['needs_attention'])
            self.assertIn('workflow_incomplete', payload['reason_codes'])
            self.assertNotIn('確認不要', payload['body'])
            self.assertNotIn('12345', json.dumps(payload, ensure_ascii=False))

    def test_true_zero_is_complete_data_not_missing(self) -> None:
        notice = build_daily_notice(
            _results(ads_values=[0, 0, 0, 0], session_values=[0, 0, 0, 0]), TODAY
        )

        self.assertEqual(notice["reason_codes"], [])
        self.assertFalse(notice["needs_attention"])

    def test_missing_partial_nonfinite_and_duplicate_rows_are_not_normalized_to_zero(self) -> None:
        missing = _results()
        missing["adsense"]["rows"].pop(0)
        self.assertIn("adsense_data_missing", build_daily_notice(missing, TODAY)["reason_codes"])

        partial = build_daily_notice(_results(ads_status="partial"), TODAY)
        self.assertIn("adsense_fetch_failed", partial["reason_codes"])

        nonfinite = _results(ads_values=[float("nan"), 100, 100, 100])
        self.assertIn("adsense_data_missing", build_daily_notice(nonfinite, TODAY)["reason_codes"])

        duplicate = _results()
        duplicate["adsense"]["rows"].append(dict(duplicate["adsense"]["rows"][0]))
        self.assertIn("adsense_data_missing", build_daily_notice(duplicate, TODAY)["reason_codes"])

    def test_same_weekday_drop_requires_both_days_not_one_day(self) -> None:
        two_days = build_daily_notice(
            _results(session_values=[10, 10, 100, 100]), TODAY
        )
        self.assertIn("traffic_drop", two_days["reason_codes"])

        one_day = build_daily_notice(
            _results(session_values=[10, 100, 100, 100]), TODAY
        )
        self.assertNotIn("traffic_drop", one_day["reason_codes"])

    def test_ad_delivery_drop_is_distinct_from_traffic_drop(self) -> None:
        notice = build_daily_notice(
            _results(ads_values=[10, 10, 100, 100], session_values=[100, 100, 100, 100]),
            TODAY,
        )

        self.assertIn("ad_delivery_drop", notice["reason_codes"])
        self.assertNotIn("traffic_drop", notice["reason_codes"])

    def test_not_set_uses_acquisition_denominator_not_ga_daily_sessions(self) -> None:
        results = _results(session_values=[1_000, 1_000, 1_000, 1_000])
        results["ga4"]["rows"] = [
            row for row in results["ga4"]["rows"] if row["dataset"] != "acquisition"
        ]
        for day in CURRENT:
            results["ga4"]["rows"].extend([
                _row("ga4", "acquisition", day, {"sessions": 30}, {"sessionSourceMedium": "(not set)"}),
                _row("ga4", "acquisition", day, {"sessions": 70}, {"sessionSourceMedium": "google / organic"}),
            ])

        notice = build_daily_notice(results, TODAY)

        self.assertIn("attribution_missing", notice["reason_codes"])
        self.assertNotIn("traffic_drop", notice["reason_codes"])

    def test_today_and_yesterday_are_excluded_and_public_body_has_no_amounts(self) -> None:
        results = _results()
        for day in (TODAY - timedelta(days=1), TODAY):
            results["adsense"]["rows"].append(_row("adsense", "daily", day, {"impressions": 999_999}))
            results["ga4"]["rows"].append(_row("ga4", "daily", day, {"sessions": 999_999}))

        notice = build_daily_notice(results, TODAY)

        self.assertEqual(notice["period_end"], END.isoformat())
        self.assertEqual(notice["reason_codes"], [])
        self.assertTrue(notice["public_safe"])
        for forbidden in ("999", "円", "¥", "$"):
            self.assertNotIn(forbidden, notice["body"])


if __name__ == "__main__":
    unittest.main()
