import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "agents"
    / "monetization_snapshot_report.py"
)
SPEC = importlib.util.spec_from_file_location("monetization_snapshot_report_test_target", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("monetization_snapshot_report.py を読み込めません。")
reporter = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = reporter
SPEC.loader.exec_module(reporter)


class MonetizationClassificationTest(unittest.TestCase):
    def test_page_classification(self) -> None:
        cases = {
            "https://uma-free.com/": "home",
            "/articles": "article_index",
            "/articles/2026-test": "article",
            "/races/2026-07-31": "race_day",
            "/races/2026-07-31/niigata/11": "race_detail",
            "/courses/niigata/turf-1000m": "course",
            "/horses/2022100001": "horse",
            "/keiba-data": "data_hub",
            "/my-data": "data_hub",
            "/about": "other",
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(reporter.classify_page(value), expected)

    def test_query_classification(self) -> None:
        self.assertEqual(reporter.classify_query("uma-free")["primary"], "brand")
        self.assertEqual(
            reporter.classify_query("マーキュリーカップ 2026 出走予定")["primary"],
            "race_preparation",
        )
        self.assertEqual(reporter.classify_query("旭岳賞 2026 予想")["primary"], "prediction")
        self.assertEqual(reporter.classify_query("稍重とは")["primary"], "evergreen_research")
        self.assertEqual(reporter.classify_query("アイビスサマーダッシュ 2026")["primary"], "race_entity")
        self.assertEqual(reporter.classify_query("門別 旭岳賞 2026 予想")["circuit"], "nar")


class MonetizationSnapshotAcceptanceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.input_dir = Path(__file__).resolve().parents[2] / "分析レポート"
        if not cls.input_dir.exists():
            raise unittest.SkipTest("ローカル分析レポートがありません。")
        cls.report = reporter.build_report(cls.input_dir)

    def test_all_source_files_are_inventoried(self) -> None:
        self.assertEqual(self.report["sample_quality"]["source_file_count"], 26)
        self.assertEqual(self.report["sample_quality"]["empty_file_count"], 1)
        self.assertTrue(
            any(source["path"].endswith("広告情報.txt") and source["status"] == "empty" for source in self.report["sources"])
        )

    def test_adsense_baseline_reproduces_export(self) -> None:
        totals = self.report["revenue"]["adsense"]["totals"]
        self.assertEqual(totals["estimated_revenue_jpy"], 1666)
        self.assertEqual(totals["page_views"], 6475)
        self.assertEqual(totals["ad_impressions"], 19965)

    def test_gsc_and_rakuten_baselines_reproduce_exports(self) -> None:
        self.assertEqual(self.report["seo"]["device_totals"]["clicks"], 1371)
        affiliate = self.report["affiliate"]["rakuten_linkshare"]["totals"]
        self.assertEqual(affiliate["clicks"], 517)
        self.assertEqual(affiliate["occurrences"], 0)

    def test_common_period_has_25_complete_dates(self) -> None:
        self.assertEqual(self.report["sample_quality"]["common_daily_rows"], 25)
        self.assertEqual(self.report["daily"][0]["date"], "2026-07-07")
        self.assertEqual(self.report["daily"][-1]["date"], "2026-07-31")


if __name__ == "__main__":
    unittest.main()
