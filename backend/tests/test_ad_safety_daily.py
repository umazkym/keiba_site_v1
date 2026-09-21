import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from datetime import date
from backend.scripts.agents import ad_safety_daily as daily

def row(source, clicks=3, dataset="daily", day="2026-09-14"):
    return {"source": source, "dataset": dataset, "date": day, "dimensions": {}, "metrics": {"clicks": clicks, "impressions": 100}}

class AdSafetyDailyTest(unittest.TestCase):
    def test_comparison_uses_weighted_ctr_and_does_not_impute_failure(self):
        data = [row("adsense", 1, day="2026-08-17"), row("adsense", 30, day="2026-08-18")]
        data[1]["metrics"]["impressions"] = 1000
        stats = daily.period_stats(data, daily.BASELINE, True)
        self.assertAlmostEqual(stats["ctr"], 31 / 1100 * 100)
        self.assertEqual(stats["days"], 28)
        self.assertIsNone(daily.period_stats(data, daily.BASELINE, False))

    def test_previous_seven_days_excludes_today(self):
        period = daily.recent_period(date(2026, 9, 15))
        self.assertEqual((str(period.start), str(period.end)), ("2026-09-08", "2026-09-14"))
        self.assertEqual(daily.BASELINE.days, 28)

    def test_monitoring_keeps_web_ad_format_breakdowns(self):
        adsense_names = {name for name, _ in daily.ADSENSE_REPORTS}
        self.assertTrue({"format_browser", "format_os", "format_country",
                         "format_traffic_source", "buyer_creative_format",
                         "content_platform"} <= adsense_names)
        buyer_report = dict(daily.ADSENSE_REPORTS)["buyer_creative_format"]
        self.assertEqual(buyer_report,
                         ("DATE", "BUYER_NETWORK_NAME", "SERVED_AD_TYPE_CODE", "AD_FORMAT_CODE"))
        ga4_names = {report["name"] for report in daily.GA4_REPORTS}
        self.assertTrue({"publisher_format_browser", "publisher_format_os",
                         "publisher_format_source", "publisher_page",
                         "publisher_ad_unit"} <= ga4_names)
        for report in daily.GA4_REPORTS:
            if report["name"].startswith("publisher_"):
                self.assertIn("publisherAdClicks", report["metrics"])
                self.assertIn("publisherAdImpressions", report["metrics"])

    def test_failed_fetch_retains_previous_and_does_not_become_zero(self):
        old = [row("adsense")]
        result = {"rows": [], "reports": {"daily": {"status": "failed"}}}
        self.assertEqual(daily.merge_rows(old, result, "adsense", daily.recent_period(date(2026, 9, 15))), old)
        self.assertEqual(daily.number(None), "未取得")

    def test_complete_empty_fetch_can_correct_previous_data(self):
        result = {"rows": [], "reports": {"daily": {"status": "complete"}}}
        merged = daily.merge_rows([row("adsense"), row("ga4")], result, "adsense", daily.recent_period(date(2026, 9, 15)))
        self.assertEqual(merged, [row("ga4")])

    def test_sources_are_never_combined(self):
        result = {"rows": [row("adsense", 2)], "reports": {"daily": {"status": "complete"}}}
        merged = daily.merge_rows([row("adsense"), row("ga4", 10)], result, "adsense", daily.recent_period(date(2026, 9, 15)))
        self.assertEqual(len(merged), 2)
        self.assertEqual(next(r for r in merged if r["source"] == "adsense")["metrics"]["clicks"], 2)
        self.assertIsNone(daily.ctr({"clicks": 0, "impressions": 0}))

    def test_partial_snapshot_keeps_other_source_and_retries_baseline(self):
        calls = []
        def success(period, raw, **options):
            calls.append((period, options))
            return {"rows": [row("ga4")], "reports": {"daily": {"status": "complete"}}}
        def failure(*args, **kwargs):
            raise RuntimeError("missing auth")
        with TemporaryDirectory() as directory:
            snapshot = daily.collect_snapshot(date(2026, 9, 15), Path(directory), collectors={"adsense": failure, "ga4": success})
            self.assertEqual(snapshot["sources"]["adsense"]["status"], "failed")
            self.assertEqual(snapshot["sources"]["ga4"]["status"], "complete")
            self.assertTrue(snapshot["rows"])
            self.assertEqual(len(calls), 2)
            daily.collect_snapshot(date(2026, 9, 16), Path(directory), snapshot, {"adsense": failure, "ga4": success})
            self.assertEqual(len(calls), 3)

if __name__ == '__main__':
    unittest.main()
