import importlib.util
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts" / "agents"
SPEC = importlib.util.spec_from_file_location(
    "grade_race_search_repair_planner_test_target",
    SCRIPT_DIR / "grade_race_search_repair_planner.py",
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("grade_race_search_repair_planner.pyを読み込めません。")
repair_planner = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = repair_planner
SPEC.loader.exec_module(repair_planner)


class GradeRaceSearchRepairPlannerTest(unittest.TestCase):
    def test_builds_one_order_and_respects_cooldown(self) -> None:
        report = {
            "window": {"start": "2026-07-18", "end": "2026-07-27"},
            "repair_candidates": [{
                "entity_key": "ibis-summer-dash",
                "season_year": "2026",
                "scheduled_race_date": "2026-08-02",
                "target_slug": "ibis",
                "alert_types": ["impression_drop"],
            }],
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            articles_dir = root / "articles"
            orders_dir = root / "orders"
            articles_dir.mkdir()
            orders_dir.mkdir()
            article_path = articles_dir / "ibis.md"
            article_path.write_text(
                """---
title: アイビスサマーダッシュ2026
target_keyword: アイビスサマーダッシュ2026
entity_type: grade_race
entity_key: ibis-summer-dash
season_year: '2026'
scheduled_race_date: '2026-08-02'
draft: false
---
本文
""",
                encoding="utf-8",
            )
            report_path = root / "report.json"
            report_path.write_text(json.dumps(report), encoding="utf-8")
            now = datetime(2026, 8, 1, 7, tzinfo=timezone.utc)
            orders = repair_planner.build_repair_orders(
                report,
                articles_dir,
                orders_dir,
                report_path,
                max_orders=1,
                cooldown_hours=48,
                now=now,
            )
            self.assertEqual(len(orders), 1)
            self.assertEqual(orders[0]["operation"], "grade_race_search_repair")
            self.assertEqual(orders[0]["rewrite_target_slug"], "ibis")
            self.assertEqual(
                orders[0]["reference_data"]["scheduled_race_date"],
                "2026-08-02",
            )

            mismatched_report = json.loads(json.dumps(report))
            mismatched_report["repair_candidates"][0]["scheduled_race_date"] = "2026-08-03"
            self.assertEqual(
                repair_planner.build_repair_orders(
                    mismatched_report,
                    articles_dir,
                    orders_dir,
                    report_path,
                    max_orders=1,
                    cooldown_hours=48,
                    now=now,
                ),
                [],
            )

            article_path.write_text(
                article_path.read_text(encoding="utf-8").replace(
                    "draft: false",
                    "gsc_grade_race_last_repaired_at: '2026-08-01T06:00:00+00:00'\ndraft: false",
                ),
                encoding="utf-8",
            )
            blocked = repair_planner.build_repair_orders(
                report,
                articles_dir,
                orders_dir,
                report_path,
                max_orders=1,
                cooldown_hours=48,
                now=now,
            )
            self.assertEqual(blocked, [])


if __name__ == "__main__":
    unittest.main()
