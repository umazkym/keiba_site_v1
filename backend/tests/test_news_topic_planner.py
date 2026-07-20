import importlib.util
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


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

    def test_local_grade_schedule_files_are_loaded(self) -> None:
        schedule = planner.available_race_demands()
        radio_nikkei = planner.find_race_demand("ラジオNIKKEI賞", schedule=schedule)
        kanazawa_summer = planner.find_race_demand("金沢サマーカップ", schedule=schedule)
        kitakyushu = planner.find_race_demand("北九州記念", schedule=schedule)

        self.assertIsNotNone(radio_nikkei)
        self.assertEqual(planner.race_demand_date(radio_nikkei).isoformat(), "2026-06-28")
        self.assertEqual(radio_nikkei.venue, "福島")
        self.assertEqual(radio_nikkei.distance, "芝1800m")

        self.assertIsNotNone(kanazawa_summer)
        self.assertEqual(planner.race_demand_date(kanazawa_summer).isoformat(), "2026-06-28")
        self.assertEqual(kanazawa_summer.venue, "金沢")
        self.assertEqual(kanazawa_summer.distance, "1700m")

        self.assertIsNotNone(kitakyushu)
        self.assertEqual(planner.race_demand_date(kitakyushu).isoformat(), "2026-07-05")
        self.assertEqual(kitakyushu.venue, "小倉")
        self.assertEqual(kitakyushu.distance, "芝1200m")
        self.assertEqual(planner.grade_race_entity_key("北九州記念"), "kitakyushu-kinen")

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

    def test_grade_priority_order_follows_search_demand_policy(self) -> None:
        self.assertLess(planner.grade_priority_rank("G1"), planner.grade_priority_rank("JpnI"))
        self.assertLess(planner.grade_priority_rank("JpnI"), planner.grade_priority_rank("G2"))
        self.assertLess(planner.grade_priority_rank("G2"), planner.grade_priority_rank("JpnII"))
        self.assertLess(planner.grade_priority_rank("JpnII"), planner.grade_priority_rank("G3"))
        self.assertLess(planner.grade_priority_rank("G3"), planner.grade_priority_rank("JpnIII"))
        self.assertLess(planner.grade_priority_rank("JpnIII"), planner.grade_priority_rank("重賞"))

    def test_jra_grade_preview_waits_for_friday_draw_time(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-03T11:44:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            kitakyushu = planner.find_race_demand("北九州記念")
            self.assertIsNotNone(kitakyushu)
            self.assertEqual(planner.days_until_race(kitakyushu), 2)
            self.assertEqual(planner.preview_deadline_status(kitakyushu, 2), "")

            os.environ["KEIBA_NEWS_NOW"] = "2026-07-03T11:45:00+09:00"
            planner._RACE_SCHEDULE_CACHE.clear()
            self.assertEqual(planner.preview_deadline_status(kitakyushu, 2), "due_preview")
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_calendar_deadline_generates_jra_draw_article_with_course_keywords(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        previous_max_orders = os.environ.get("KEIBA_NEWS_MAX_ORDERS_PER_RUN")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-03T11:45:00+09:00"
        os.environ["KEIBA_NEWS_MAX_ORDERS_PER_RUN"] = "3"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            state = planner.WorkflowState(
                run_id="jra-draw-deadline-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "build_internal_data_bundle", return_value={}),
            ):
                planner.cluster_topics_node(state)
                planner.build_write_orders_node(state)

            order = next(
                order
                for order in state.write_orders
                if order["reference_data"]["race_name"] == "北九州記念"
            )
            self.assertEqual(order["target_keyword"], "北九州記念2026 枠順確定後 確認ポイント")
            self.assertEqual(order["reference_data"]["update_stage"], "draw_confirmed")
            self.assertEqual(order["reference_data"]["draw_status"], "confirmed")
            self.assertIn("北九州記念 小倉", order["reference_data"]["keywords"])
            self.assertIn("小倉芝1200m 傾向", order["reference_data"]["keywords"])
            self.assertEqual(order["priority"], planner.grade_calendar_priority("G3", "due_preview"))
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            if previous_max_orders is None:
                os.environ.pop("KEIBA_NEWS_MAX_ORDERS_PER_RUN", None)
            else:
                os.environ["KEIBA_NEWS_MAX_ORDERS_PER_RUN"] = previous_max_orders
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_missed_preview_is_backfilled_until_race_day(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-05T08:00:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            state = planner.WorkflowState(
                run_id="missed-preview-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "build_internal_data_bundle", return_value={}),
            ):
                planner.cluster_topics_node(state)
                planner.build_write_orders_node(state)

            order = next(
                order
                for order in state.write_orders
                if order["reference_data"]["race_name"] == "北九州記念"
            )
            self.assertEqual(order["reference_data"]["deadline_status"], "missed_preview")
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_jra_result_review_requires_result_data_and_updates_existing_entity(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-05T16:45:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            kitakyushu = planner.find_race_demand("北九州記念")
            self.assertIsNotNone(kitakyushu)
            preview_key = planner.grade_race_stage_key(
                planner.grade_race_identity_key(kitakyushu),
                "2026",
                planner.PREVIEW_STAGE_KEY,
            )
            state = planner.WorkflowState(
                run_id="jra-result-review-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value={preview_key}),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "grade_race_has_results", return_value=True),
                patch.object(planner, "build_internal_data_bundle", return_value={"results": [{"着順": 1, "馬番": 1, "馬名": "確認馬"}]}),
            ):
                planner.cluster_topics_node(state)
                planner.build_write_orders_node(state)

            order = next(
                order
                for order in state.write_orders
                if order["reference_data"]["race_name"] == "北九州記念"
            )
            self.assertEqual(order["target_keyword"], "北九州記念2026 結果 回顧")
            self.assertEqual(order["reference_data"]["update_stage"], "result_review")
            self.assertTrue(order["reference_data"]["result_confirmed"])
            self.assertEqual(order["reference_data"]["race_phase"], "post_race")
            self.assertEqual(order["reference_data"]["entity_key"], "kitakyushu-kinen")
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_nar_grade_does_not_generate_result_review(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-08T16:45:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            state = planner.WorkflowState(
                run_id="nar-no-result-review-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "grade_race_has_results", return_value=True),
            ):
                planner.cluster_topics_node(state)

            result_candidates = [
                candidate
                for candidate in state.topic_candidates
                if candidate.search_intent == "result_review"
                and candidate.race_name == "スパーキングレディーカップ"
            ]
            self.assertEqual(result_candidates, [])
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

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

    def test_pre_race_result_source_is_converted_to_past_trends(self) -> None:
        self.assertEqual(
            planner.normalize_intent_for_race_phase(
                "result_review",
                2,
                "前年の府中牝馬S結果",
                "過去の優勝馬と着順を振り返る。",
            ),
            "past_trends",
        )

    def test_schedule_backfill_keeps_fuchu_himba_in_candidates(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-06-19"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            state = planner.WorkflowState(
                run_id="schedule-backfill-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
            ):
                planner.cluster_topics_node(state)
            fuchu = next(
                (
                    candidate
                    for candidate in state.topic_candidates
                    if candidate.race_name == "府中牝馬S"
                ),
                None,
            )

            self.assertIsNotNone(fuchu)
            self.assertTrue(fuchu.is_schedule_backfill)
            self.assertEqual(fuchu.days_to_race, 2)
            self.assertEqual(fuchu.search_intent, "field_analysis")
            self.assertNotEqual(fuchu.search_intent, "result_review")

            with patch.object(planner, "build_internal_data_bundle", return_value={}):
                planner.build_write_orders_node(state)
            selected_races = {
                order["reference_data"]["race_name"]
                for order in state.write_orders
            }
            self.assertIn("府中牝馬S", selected_races)
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_schedule_backfill_keeps_kitakyushu_kinen_on_race_day(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        previous_max_focus = os.environ.get("KEIBA_NEWS_MAX_FOCUS_RACES")
        previous_max_orders = os.environ.get("KEIBA_NEWS_MAX_ORDERS_PER_RUN")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-05"
        os.environ["KEIBA_NEWS_MAX_FOCUS_RACES"] = "4"
        os.environ["KEIBA_NEWS_MAX_ORDERS_PER_RUN"] = "3"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            state = planner.WorkflowState(
                run_id="kitakyushu-backfill-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "build_internal_data_bundle", return_value={}),
            ):
                planner.cluster_topics_node(state)
                planner.build_write_orders_node(state)

            selected_races = [
                order["reference_data"]["race_name"]
                for order in state.write_orders
            ]
            self.assertIn("北九州記念", selected_races)
            kitakyushu_order = next(
                order
                for order in state.write_orders
                if order["reference_data"]["race_name"] == "北九州記念"
            )
            self.assertEqual(kitakyushu_order["target_keyword"], "北九州記念2026 枠順確定後 確認ポイント")
            self.assertEqual(kitakyushu_order["reference_data"]["deadline_status"], "missed_preview")
            self.assertEqual(kitakyushu_order["reference_data"]["scheduled_race_date"], "2026-07-05")
            self.assertEqual(kitakyushu_order["reference_data"]["entity_key"], "kitakyushu-kinen")
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            if previous_max_focus is None:
                os.environ.pop("KEIBA_NEWS_MAX_FOCUS_RACES", None)
            else:
                os.environ["KEIBA_NEWS_MAX_FOCUS_RACES"] = previous_max_focus
            if previous_max_orders is None:
                os.environ.pop("KEIBA_NEWS_MAX_ORDERS_PER_RUN", None)
            else:
                os.environ["KEIBA_NEWS_MAX_ORDERS_PER_RUN"] = previous_max_orders
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_trusted_media_only_is_never_a_publishable_candidate(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-06-20"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            stale_url = "https://news.netkeiba.com/stale-kyoto-track"
            fresh_url = "https://news.netkeiba.com/fresh-tokyo-track"
            state = planner.WorkflowState(
                run_id="generic-date-freshness-test",
                fetched_at=planner.current_jst().isoformat(),
                source_cards=[
                    planner.SourceCard(
                        title="京都競馬場の馬場傾向",
                        url=stale_url,
                        content="2月14日の京都競馬場は芝の内側に傷みが見られた。",
                        query="競馬 馬場 最新",
                        source_name="news.netkeiba.com",
                        source_type="trusted_media",
                        score=100,
                        fetched_at=planner.current_jst().isoformat(),
                        allowed_claims=["2月14日の京都競馬場は芝の内側に傷みが見られた。"],
                    ),
                    planner.SourceCard(
                        title="東京競馬場の馬場傾向",
                        url=fresh_url,
                        content="6月20日の東京競馬場について当日の馬場状態を確認する。",
                        query="競馬 馬場 最新",
                        source_name="news.netkeiba.com",
                        source_type="trusted_media",
                        score=100,
                        fetched_at=planner.current_jst().isoformat(),
                        allowed_claims=["6月20日の東京競馬場について当日の馬場状態を確認する。"],
                    ),
                ],
            )
            planner.cluster_topics_node(state)
            candidate_urls = {
                card.url
                for candidate in state.topic_candidates
                for card in candidate.source_cards
            }

            self.assertNotIn(stale_url, candidate_urls)
            self.assertNotIn(fresh_url, candidate_urls)
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_official_course_topic_is_classified_without_media_dependency(self) -> None:
        official_card = planner.SourceCard(
            title="東京競馬場のコース紹介",
            url="https://www.jra.go.jp/facilities/race/tokyo/course/",
            content="東京競馬場の芝コースは左回りで、直線距離は525.9メートル。",
            query="東京競馬場 コース 公式",
            source_name="www.jra.go.jp",
            source_type="official",
            score=100,
            fetched_at=planner.current_jst().isoformat(),
            allowed_claims=["東京競馬場の芝コースの直線距離は525.9メートル。"],
        )

        classified = planner.classify_publishable_generic_topic([official_card], "track_condition")

        self.assertEqual(
            classified,
            ("course_venue", "course_venue", "東京競馬場 コース分析"),
        )

    def test_official_but_off_topic_analogy_is_rejected(self) -> None:
        athletics_card = planner.SourceCard(
            title="陸上競技の中距離選手",
            url="https://www.example.go.jp/athletics/",
            content="陸上の1500メートル選手の走りを芝2000メートルへ類推する。",
            query="陸上 中距離",
            source_name="www.example.go.jp",
            source_type="official",
            score=100,
            fetched_at=planner.current_jst().isoformat(),
            allowed_claims=["陸上の1500メートル選手が出場した。"],
        )

        self.assertIsNone(planner.classify_publishable_generic_topic([athletics_card], "race_profile"))

    def test_writer_evidence_contains_only_official_and_uma_free_rows(self) -> None:
        official_card = planner.SourceCard(
            title="京都競馬場のコース紹介",
            url="https://www.jra.go.jp/facilities/race/kyoto/course/",
            content="京都ダートコースの直線距離は329.1メートル。",
            query="京都競馬場 コース 公式",
            source_name="www.jra.go.jp",
            source_type="official",
            score=100,
            fetched_at=planner.current_jst().isoformat(),
            allowed_claims=["京都ダートコースの直線距離は329.1メートル。"],
        )
        media_card = planner.SourceCard(
            title="外部記事の推奨馬",
            url="https://news.example.com/pick",
            content="第三者の推奨内容。",
            query="競馬 推奨",
            source_name="news.example.com",
            source_type="trusted_media",
            score=90,
            fetched_at=planner.current_jst().isoformat(),
            allowed_claims=["推奨馬はテストホース。"],
        )
        candidate = planner.TopicCandidate(
            topic_key="kyoto-course",
            target_keyword="京都競馬場 コース分析",
            title_seed="京都競馬場のコース分析",
            article_type="course_venue",
            theme_cluster="course_venue",
            search_intent="track_condition",
            search_intent_label="馬場",
            search_angle_label="コース",
            score=100,
            reason="公式コース情報",
            race_name="",
            calendar_race="",
            days_to_race=None,
            source_cards=[official_card, media_card],
        )
        evidence = planner.build_writer_evidence(
            candidate,
            {
                "matched_race": {
                    "race_date": "2026-07-21",
                    "venue_name": "京都",
                    "race_number": 11,
                    "race_name": "テスト競走",
                }
            },
        )

        self.assertEqual(evidence["facts"], [{"text": official_card.allowed_claims[0], "origin": "official"}])
        self.assertTrue(evidence["metrics"])
        self.assertTrue(all(row["origin"] == "uma_free" for row in evidence["metrics"]))
        serialized = json.dumps(evidence, ensure_ascii=False)
        self.assertNotIn(media_card.title, serialized)
        self.assertNotIn(media_card.url, serialized)


if __name__ == "__main__":
    unittest.main()
