import importlib.util
import json
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import Mock
from zoneinfo import ZoneInfo


ANALYZER_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "agents"
    / "gsc_seo_analyzer.py"
)
SPEC = importlib.util.spec_from_file_location("gsc_seo_analyzer_test_target", ANALYZER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("gsc_seo_analyzer.py を読み込めません。")

analyzer = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = analyzer
SPEC.loader.exec_module(analyzer)


def page_row(
    url: str,
    *,
    impressions: float,
    clicks: float,
    position: float,
) -> dict:
    return {
        "keys": [url],
        "impressions": impressions,
        "clicks": clicks,
        "ctr": clicks / impressions if impressions else 0,
        "position": position,
    }


def query_row(
    url: str,
    query: str,
    *,
    impressions: float,
    clicks: float,
    position: float,
) -> dict:
    row = page_row(
        url,
        impressions=impressions,
        clicks=clicks,
        position=position,
    )
    row["keys"] = [url, query]
    return row


class GscSeoAnalyzerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.current_window = analyzer.DateWindow(
            start=date(2026, 6, 23),
            end=date(2026, 7, 20),
        )
        self.previous_window = analyzer.DateWindow(
            start=date(2026, 5, 26),
            end=date(2026, 6, 22),
        )
        self.inventory = [
            {
                "source_slug": "low-ctr",
                "canonical_path": "/articles/low-ctr",
                "canonical_url": "https://uma-free.com/articles/low-ctr",
                "title": "低CTR記事",
                "entity_type": "",
                "entity_key": "",
                "season_year": "",
                "scheduled_race_date": "",
                "published": True,
                "self_canonical": True,
                "indexable": True,
            },
            {
                "source_slug": "benchmark",
                "canonical_path": "/articles/benchmark",
                "canonical_url": "https://uma-free.com/articles/benchmark",
                "title": "基準記事",
                "entity_type": "",
                "entity_key": "",
                "season_year": "",
                "scheduled_race_date": "",
                "published": True,
                "self_canonical": True,
                "indexable": True,
            },
            {
                "source_slug": "seasonal-grade",
                "canonical_path": "/articles/grade-races/test-stakes",
                "canonical_url": "https://uma-free.com/articles/grade-races/test-stakes",
                "title": "テストステークス",
                "entity_type": "grade_race",
                "entity_key": "test-stakes",
                "season_year": "2026",
                "scheduled_race_date": "2026-07-26",
                "published": True,
                "self_canonical": True,
                "indexable": True,
            },
        ]

    def test_calculate_windows_uses_finalized_consecutive_28_day_periods(self) -> None:
        now = datetime(2026, 7, 23, 9, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
        current, previous = analyzer.calculate_windows(now)

        self.assertEqual(current.start.isoformat(), "2026-06-23")
        self.assertEqual(current.end.isoformat(), "2026-07-20")
        self.assertEqual(previous.start.isoformat(), "2026-05-26")
        self.assertEqual(previous.end.isoformat(), "2026-06-22")

    def test_fetch_rows_pages_at_25000_and_stops_at_50000(self) -> None:
        first_page = [
            page_row(
                f"https://uma-free.com/articles/{index}",
                impressions=1,
                clicks=0,
                position=10,
            )
            for index in range(25_000)
        ]
        second_page = [
            page_row(
                f"https://uma-free.com/articles/{index + 25_000}",
                impressions=1,
                clicks=0,
                position=10,
            )
            for index in range(25_000)
        ]
        execute = Mock(
            side_effect=[
                {"rows": first_page},
                {"rows": second_page},
            ]
        )

        rows = analyzer.fetch_search_analytics_rows(
            execute,
            window=self.current_window,
            dimensions=["page"],
        )

        self.assertEqual(len(rows), 50_000)
        self.assertEqual(execute.call_count, 2)
        self.assertEqual(execute.call_args_list[0].args[0]["startRow"], 0)
        self.assertEqual(execute.call_args_list[1].args[0]["startRow"], 25_000)
        self.assertEqual(execute.call_args_list[0].args[0]["dataState"], "final")

    def test_candidate_scoring_and_seasonal_grade_separation(self) -> None:
        current_rows = [
            page_row(
                "https://uma-free.com/articles/low-ctr?utm_source=test",
                impressions=1_000,
                clicks=5,
                position=8,
            ),
            page_row(
                "https://uma-free.com/articles/benchmark/",
                impressions=400,
                clicks=20,
                position=8,
            ),
            page_row(
                "https://uma-free.com/articles/grade-races/test-stakes",
                impressions=800,
                clicks=32,
                position=8,
            ),
        ]
        previous_rows = [
            page_row(
                "https://uma-free.com/articles/low-ctr",
                impressions=500,
                clicks=5,
                position=9,
            )
        ]
        query_rows = [
            query_row(
                "https://uma-free.com/articles/low-ctr",
                "競馬 馬場",
                impressions=600,
                clicks=3,
                position=8,
            ),
            query_row(
                "https://uma-free.com/articles/benchmark",
                "競馬 馬場",
                impressions=30,
                clicks=2,
                position=7,
            ),
        ]

        report = analyzer.analyze_report(
            site_url="sc-domain:uma-free.com",
            inventory=self.inventory,
            current_window=self.current_window,
            previous_window=self.previous_window,
            current_page_rows=current_rows,
            previous_page_rows=previous_rows,
            current_query_rows=query_rows,
            as_of_date=date(2026, 7, 23),
        )
        analyzer.finalize_cannibalization(report, query_rows, self.inventory)

        self.assertEqual([item["source_slug"] for item in report["candidates"]], ["low-ctr"])
        self.assertEqual(
            [item["source_slug"] for item in report["seasonal_grade_demand"]],
            ["seasonal-grade"],
        )
        self.assertEqual(report["candidates"][0]["previous"]["impressions"], 500)
        self.assertGreater(report["candidates"][0]["estimated_missed_clicks"], 0)
        self.assertEqual(report["summary"]["cannibalization_count"], 1)

    def test_low_impressions_and_position_over_20_are_not_candidates(self) -> None:
        inventory = [
            {
                **self.inventory[0],
                "source_slug": "under-sample",
                "canonical_path": "/articles/under-sample",
                "canonical_url": "https://uma-free.com/articles/under-sample",
            },
            {
                **self.inventory[1],
                "source_slug": "too-low-rank",
                "canonical_path": "/articles/too-low-rank",
                "canonical_url": "https://uma-free.com/articles/too-low-rank",
            },
        ]
        rows = [
            page_row(
                "https://uma-free.com/articles/under-sample",
                impressions=99,
                clicks=0,
                position=8,
            ),
            page_row(
                "https://uma-free.com/articles/too-low-rank",
                impressions=1_000,
                clicks=0,
                position=21,
            ),
        ]

        report = analyzer.analyze_report(
            site_url="sc-domain:uma-free.com",
            inventory=inventory,
            current_window=self.current_window,
            previous_window=self.previous_window,
            current_page_rows=rows,
            previous_page_rows=[],
            current_query_rows=[],
            as_of_date=date(2026, 7, 23),
        )

        self.assertEqual(report["candidates"], [])

    def test_active_grade_is_reported_as_seasonal_even_without_gsc_rows(self) -> None:
        report = analyzer.analyze_report(
            site_url="sc-domain:uma-free.com",
            inventory=[self.inventory[2]],
            current_window=self.current_window,
            previous_window=self.previous_window,
            current_page_rows=[],
            previous_page_rows=[],
            current_query_rows=[],
            as_of_date=date(2026, 7, 23),
        )

        self.assertEqual(report["candidates"], [])
        self.assertEqual(
            [item["source_slug"] for item in report["seasonal_grade_demand"]],
            ["seasonal-grade"],
        )
        self.assertEqual(
            report["seasonal_grade_demand"][0]["current"]["impressions"],
            0,
        )

    def test_inventory_excludes_draft_noindex_and_canonical_mismatch(self) -> None:
        rows = [
            {
                **self.inventory[0],
                "source_slug": "published",
                "canonical_path": "/articles/published",
                "canonical_url": "https://uma-free.com/articles/published",
            },
            {
                **self.inventory[0],
                "source_slug": "draft",
                "canonical_path": "/articles/draft",
                "canonical_url": "https://uma-free.com/articles/draft",
                "published": False,
            },
            {
                **self.inventory[0],
                "source_slug": "noindex",
                "canonical_path": "/articles/noindex",
                "canonical_url": "https://uma-free.com/articles/noindex",
                "indexable": False,
            },
            {
                **self.inventory[0],
                "source_slug": "canonical-mismatch",
                "canonical_path": "/articles/canonical-mismatch",
                "canonical_url": "https://uma-free.com/articles/canonical-mismatch",
                "self_canonical": False,
            },
            {
                **self.inventory[0],
                "source_slug": "outside-articles",
                "canonical_path": "/races/today",
                "canonical_url": "https://uma-free.com/races/today",
            },
        ]
        with tempfile.TemporaryDirectory() as temp_dir:
            inventory_path = Path(temp_dir) / "inventory.json"
            inventory_path.write_text(
                json.dumps({"articles": rows}, ensure_ascii=False),
                encoding="utf-8",
            )
            inventory = analyzer.load_inventory(inventory_path)

        self.assertEqual(
            [item["source_slug"] for item in inventory],
            ["published"],
        )

    def test_api_error_is_propagated_without_creating_partial_rows(self) -> None:
        def execute(_body: dict) -> dict:
            raise analyzer.GscAnalyzerError("HTTP 403")

        with self.assertRaisesRegex(analyzer.GscAnalyzerError, "403"):
            analyzer.fetch_search_analytics_rows(
                execute,
                window=self.current_window,
                dimensions=["page"],
            )

    def test_empty_response_returns_no_rows(self) -> None:
        execute = Mock(return_value={})

        rows = analyzer.fetch_search_analytics_rows(
            execute,
            window=self.current_window,
            dimensions=["page"],
        )

        self.assertEqual(rows, [])
        self.assertEqual(execute.call_count, 1)

    def test_rate_limit_error_is_propagated(self) -> None:
        def execute(_body: dict) -> dict:
            raise analyzer.GscAnalyzerError("HTTP 429")

        with self.assertRaisesRegex(analyzer.GscAnalyzerError, "429"):
            analyzer.fetch_search_analytics_rows(
                execute,
                window=self.current_window,
                dimensions=["page", "query"],
            )


if __name__ == "__main__":
    unittest.main()
