import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


PLANNER_PATH = Path(__file__).resolve().parents[1] / "scripts" / "agents" / "editorial_evergreen_planner.py"
SPEC = importlib.util.spec_from_file_location("editorial_evergreen_planner_test_target", PLANNER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("editorial_evergreen_planner.py を読み込めません。")

planner = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = planner
SPEC.loader.exec_module(planner)


class EditorialEvergreenPlannerTest(unittest.TestCase):
    def test_reference_summary_parsers_extract_markdown_tables(self) -> None:
        jra_jockeys = planner.parse_reference_jra_jockey_topics()
        nar_jockeys = planner.parse_reference_nar_jockey_topics()
        jra_courses = planner.parse_reference_jra_course_topics()
        nar_courses = planner.parse_reference_nar_course_topics()

        self.assertEqual(len(jra_jockeys), 20)
        self.assertEqual(len(nar_jockeys), 20)
        self.assertEqual(jra_jockeys[0].name, "C.ルメール")
        self.assertEqual(jra_jockeys[0].rows[0]["勝率"], "28.2%")
        self.assertEqual(nar_jockeys[0].name, "笹川翼")
        self.assertEqual(nar_jockeys[0].rows[0]["3着内率"], "53.8%")

        tokyo = next((topic for topic in jra_courses if topic.venue == "東京"), None)
        monbetsu = next((topic for topic in nar_courses if topic.venue == "門別"), None)
        self.assertIsNotNone(tokyo)
        self.assertIsNotNone(monbetsu)
        self.assertIn("芝2400m", {row["コース"] for row in tokyo.rows})
        self.assertIn("ダート1600m", {row["コース"] for row in tokyo.rows})
        self.assertIn("ダート2000m", {row["コース"] for row in monbetsu.rows})

    def test_jra_course_parser_groups_distances_by_venue(self) -> None:
        topics = planner.parse_jra_course_topics()
        tokyo = next((topic for topic in topics if topic.venue == "東京"), None)

        self.assertIsNotNone(tokyo)
        self.assertGreaterEqual(len(tokyo.rows), 10)
        courses = {row["コース"] for row in tokyo.rows}
        self.assertIn("芝1400m", courses)
        self.assertIn("ダート1600m", courses)
        self.assertIn("docs/reference_data_summary.md", tokyo.source_file)
        self.assertTrue(any(row.get("リファレンス要点") for row in tokyo.rows))

    def test_nar_course_parser_groups_dirt_and_turf_rows_by_venue(self) -> None:
        topics = planner.parse_nar_course_topics()
        morioka = next((topic for topic in topics if topic.venue == "盛岡"), None)

        self.assertIsNotNone(morioka)
        courses = {row["コース"] for row in morioka.rows}
        self.assertIn("ダート1200m", courses)
        self.assertIn("芝1600m", courses)

    def test_jockey_parser_extracts_leading_metrics(self) -> None:
        jra_topics = planner.parse_jra_jockey_topics()
        nar_topics = planner.parse_nar_jockey_topics()

        self.assertGreater(len(jra_topics), 5)
        self.assertGreater(len(nar_topics), 5)
        self.assertEqual(jra_topics[0].name, "C.ルメール")
        self.assertEqual(jra_topics[0].rows[0]["勝率"], "28.2%")
        self.assertEqual(nar_topics[0].name, "笹川翼")
        self.assertEqual(nar_topics[0].rows[0]["勝率"], "25.4%")

    def test_jockey_candidates_continue_beyond_top_thirty(self) -> None:
        jra_orders = [planner.build_jockey_order(topic) for topic in planner.parse_jra_jockey_topics()]
        nar_orders = [planner.build_jockey_order(topic) for topic in planner.parse_nar_jockey_topics()]
        known_keys = set()
        for generated in [*jra_orders[:30], *nar_orders[:30]]:
            known_keys.add(planner.normalize_key(generated.order["target_keyword"]))
            known_keys.add(planner.normalize_key(generated.key))

        candidates = planner.candidates_for_kind("jockey", known_keys)

        self.assertTrue(candidates)
        self.assertTrue(any(
            int(candidate.order["reference_data"]["key_metrics"][0]["順位"].replace("位", "")) >= 31
            for candidate in candidates
        ))

    def test_course_write_order_uses_venue_level_cluster(self) -> None:
        topic = next(topic for topic in planner.parse_jra_course_topics() if topic.venue == "東京")
        generated = planner.build_course_order(topic)
        order = generated.order

        self.assertEqual(order["theme_cluster"], "course_venue")
        self.assertEqual(order["category"], "コース分析")
        self.assertEqual(order["reference_data"]["article_type"], "course_venue")
        self.assertGreaterEqual(order["reference_data"]["sample_size"], 10)
        self.assertIn("距離ごとに記事を分けず", order["reference_data"]["content_focus"])

    def test_seasonal_grade_race_prioritizes_related_course_article(self) -> None:
        class FakeEntry:
            name = "アイビスサマーダッシュ"
            venue = "新潟"

        fake_planner = types.SimpleNamespace(
            _RACE_SCHEDULE_CACHE={},
            focus_races=lambda: [(FakeEntry(), 1)],
            is_race_article_eligible=lambda _entry: True,
            grade_race_entity_key=lambda _name: "ibis-summer-dash",
            race_demand_date=lambda _entry: planner.current_jst().date(),
        )

        with patch.dict(sys.modules, {"news_topic_planner": fake_planner}):
            contexts = planner.seasonal_course_context()

        candidates = planner.candidates_for_kind("course", set(), contexts)

        self.assertEqual(contexts["新潟"]["entity_key"], "ibis-summer-dash")
        self.assertTrue(candidates)
        self.assertEqual(candidates[0].order["reference_data"]["course_venue"], "新潟")
        self.assertGreaterEqual(candidates[0].order["priority"], 76)
        self.assertEqual(
            candidates[0].order["reference_data"]["source_race_entity_key"],
            "ibis-summer-dash",
        )
        self.assertIn("course", candidates[0].order["reference_data"]["query_intents"])

    def test_beginner_topics_cover_twenty_guides(self) -> None:
        topics = planner.beginner_topics()

        self.assertEqual(len(topics), 20)
        self.assertEqual(len({topic.key for topic in topics}), 20)

    def test_beginner_topics_avoid_guarded_phrases(self) -> None:
        guarded_phrases = [
            "期待値",
            "勝負気配",
            "信頼できる",
            "プラスを目指",
            "買うべき",
            "投資",
            "必勝",
            "絶対",
            "圧倒",
            "最強",
            "消去対象",
            "走走",
            " of ",
        ]
        text_parts = []
        for topic in planner.beginner_topics():
            text_parts.extend(
                [
                    topic.key,
                    topic.target_keyword,
                    topic.focus,
                    *[str(row) for row in topic.rows],
                    *topic.structure,
                ]
            )
        joined = "\n".join(text_parts)

        for phrase in guarded_phrases:
            self.assertNotIn(phrase, joined)


if __name__ == "__main__":
    unittest.main()
