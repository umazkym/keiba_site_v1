import importlib.util
import os
import sys
import unittest
from pathlib import Path


os.environ["KEIBA_NEWS_REMOTE_SCHEDULE_ENABLED"] = "false"
os.environ["KEIBA_NEWS_NOW"] = "2026-06-18"
os.environ["KEIBA_NEWS_RACE_WINDOW_BEFORE_DAYS"] = "7"
os.environ["KEIBA_NEWS_RACE_WINDOW_AFTER_DAYS"] = "3"

PLANNER_PATH = Path(__file__).resolve().parents[1] / "scripts" / "agents" / "news_topic_planner.py"
SPEC = importlib.util.spec_from_file_location("news_topic_planner_test_target", PLANNER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("news_topic_planner.py を読み込めません。")

planner = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = planner
SPEC.loader.exec_module(planner)


class NewsTopicPlannerTest(unittest.TestCase):
    def test_2026_schedule_uses_actual_sakitama_and_teio_dates(self) -> None:
        schedule = planner.available_race_demands()
        sakitama = planner.find_race_demand("さきたま杯", schedule=schedule)
        teio = planner.find_race_demand("帝王賞", schedule=schedule)

        self.assertIsNotNone(sakitama)
        self.assertIsNotNone(teio)
        self.assertEqual(planner.race_demand_date(sakitama).isoformat(), "2026-06-24")
        self.assertEqual(planner.race_demand_date(teio).isoformat(), "2026-07-01")

    def test_query_builder_distributes_races_and_intents(self) -> None:
        state = planner.WorkflowState(
            run_id="test",
            fetched_at=planner.current_jst().isoformat(),
        )
        planner.build_queries_node(state)

        joined = "\n".join(state.queries)
        self.assertIn("さきたま杯", joined)
        self.assertIn("府中牝馬S", joined)
        self.assertIn("しらさぎS", joined)
        self.assertNotIn("帝王賞", joined)
        self.assertLessEqual(joined.count("追い切り"), 1)
        self.assertLessEqual(joined.count("枠順"), 1)

    def test_focus_window_is_seven_days_before_and_three_days_after(self) -> None:
        self.assertTrue(planner.is_in_focus_window(7))
        self.assertFalse(planner.is_in_focus_window(8))
        self.assertTrue(planner.is_in_focus_window(-3))
        self.assertFalse(planner.is_in_focus_window(-4))

    def test_source_text_outweighs_query_hint(self) -> None:
        intent, _label, _score = planner.detect_search_intent(
            "府中牝馬Sの過去10年傾向とコース条件",
            "東京芝1800mで好走条件を整理する。",
            "府中牝馬S 枠順 追い切り",
        )
        self.assertEqual(intent, "past_trends")

    def test_post_race_source_does_not_return_to_pre_race_topic(self) -> None:
        post_race = planner.RaceDemand(
            name="確認用重賞",
            aliases=("確認用重賞",),
            month=6,
            day=17,
            grade="G3",
            base_score=30,
        )
        self.assertEqual(
            planner.query_intents_for_race(post_race, -1),
            ["result_review"],
        )
        self.assertIsNone(
            planner.normalize_intent_for_race_phase(
                "waku",
                -1,
                "関東オークスの枠順",
                "出馬表を確認する。",
            )
        )
        self.assertEqual(
            planner.normalize_intent_for_race_phase(
                "result_review",
                -1,
                "関東オークス結果",
                "レース後に展開と勝因を振り返る。",
            ),
            "result_review",
        )


if __name__ == "__main__":
    unittest.main()
