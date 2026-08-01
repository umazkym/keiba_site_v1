import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts" / "agents"
sys.path.insert(0, str(SCRIPT_DIR))
SPEC = importlib.util.spec_from_file_location("grade_race_search_monitor_test_target", SCRIPT_DIR / "grade_race_search_monitor.py")
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("grade_race_search_monitor.pyを読み込めません。")
monitor = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = monitor
SPEC.loader.exec_module(monitor)


class GradeRaceSearchMonitorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = [
            {
                "entity_key": "ibis-summer-dash",
                "name": "アイビスサマーダッシュ",
                "aliases": ["アイビスサマーダッシュ", "アイビスSD"],
            }
        ]

    def test_detects_impression_and_position_collapse(self) -> None:
        rows = [
            {"keys": ["2026-07-26", "アイビスサマーダッシュ 2026", "https://uma-free.com/articles/a"], "clicks": 27, "impressions": 1053, "position": 9.49},
            {"keys": ["2026-07-27", "アイビスサマーダッシュ 2026", "https://uma-free.com/articles/a"], "clicks": 2, "impressions": 13, "position": 77.88},
        ]
        alerts = monitor.detect_search_alerts(rows, self.registry)
        self.assertEqual({alert["type"] for alert in alerts}, {"impression_drop", "position_worsening"})

    def test_detects_multiple_article_pages(self) -> None:
        rows = [
            {"keys": ["2026-07-26", "アイビスSD 2026", "https://uma-free.com/articles/a"], "clicks": 2, "impressions": 30, "position": 9},
            {"keys": ["2026-07-27", "アイビスサマーダッシュ 2026", "https://uma-free.com/articles/b"], "clicks": 1, "impressions": 20, "position": 12},
        ]
        alerts = monitor.detect_search_alerts(rows, self.registry)
        duplicate = next(alert for alert in alerts if alert["type"] == "multiple_article_pages")
        self.assertEqual(duplicate["pages"], ["/articles/a", "/articles/b"])

    def test_content_audit_uses_stage_update_date(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            articles_dir = root / "articles"
            articles_dir.mkdir()
            (articles_dir / "ibis.md").write_text(
                """---
entity_type: grade_race
entity_key: ibis-summer-dash
season_year: '2026'
update_stage: draw_confirmed
draw_status: confirmed
scheduled_race_date: '2026-08-02'
date: '2026-07-25T23:53:32.439Z'
last_updated: '2026-08-01T02:01:12.691Z'
draft: false
---
本文
""",
                encoding="utf-8",
            )
            redirects_path = root / "redirects.json"
            redirects_path.write_text("[]", encoding="utf-8")
            self.assertEqual(monitor.detect_content_alerts(articles_dir, redirects_path), [])

    def test_content_audit_rejects_stage_without_fact_flags(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            articles_dir = root / "articles"
            articles_dir.mkdir()
            (articles_dir / "invalid.md").write_text(
                """---
entity_type: grade_race
entity_key: ibis-summer-dash
season_year: '2026'
update_stage: draw_confirmed
scheduled_race_date: '2026-08-02'
last_updated: '2026-08-01T02:01:12.691Z'
draft: false
---
本文
""",
                encoding="utf-8",
            )
            redirects_path = root / "redirects.json"
            redirects_path.write_text("[]", encoding="utf-8")
            alert_types = {
                alert["type"]
                for alert in monitor.detect_content_alerts(articles_dir, redirects_path)
            }
            self.assertIn("draw_without_confirmed_data", alert_types)

    def test_content_audit_rejects_empty_grade_race_entity_key(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            articles_dir = root / "articles"
            articles_dir.mkdir()
            (articles_dir / "invalid.md").write_text(
                """---
entity_type: grade_race
entity_key: ''
season_year: '2026'
update_stage: field_building
scheduled_race_date: '2026-08-02'
date: '2026-07-25T00:00:00Z'
draft: false
---
本文
""",
                encoding="utf-8",
            )
            redirects_path = root / "redirects.json"
            redirects_path.write_text("[]", encoding="utf-8")
            alert_types = {
                alert["type"]
                for alert in monitor.detect_content_alerts(articles_dir, redirects_path)
            }
            self.assertIn("missing_entity_key", alert_types)

    def test_content_audit_ignores_redirect_sources_for_duplicates(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            articles_dir = root / "articles"
            articles_dir.mkdir()
            article = """---
entity_type: grade_race
entity_key: ibis-summer-dash
season_year: '2026'
update_stage: race_week
scheduled_race_date: '2026-08-02'
date: '2026-07-25T00:00:00Z'
draft: false
---
本文
"""
            (articles_dir / "primary.md").write_text(article, encoding="utf-8")
            (articles_dir / "duplicate.md").write_text(article, encoding="utf-8")
            redirects_path = root / "redirects.json"
            redirects_path.write_text(
                json.dumps([{"redirect_slugs": ["duplicate"]}]),
                encoding="utf-8",
            )
            self.assertEqual(monitor.detect_content_alerts(articles_dir, redirects_path), [])


if __name__ == "__main__":
    unittest.main()
