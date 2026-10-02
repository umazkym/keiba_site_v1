import copy
import importlib.util
import json
import os
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch


os.environ["KEIBA_NEWS_REMOTE_SCHEDULE_ENABLED"] = "false"
os.environ["KEIBA_NEWS_NOW"] = "2026-06-18"
os.environ["KEIBA_NEWS_RACE_WINDOW_BEFORE_DAYS"] = "21"
os.environ["KEIBA_NEWS_RACE_WINDOW_AFTER_DAYS"] = "3"
os.environ["KEIBA_NEWS_DB_ENRICH_ENABLED"] = "false"

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

    def test_grade_race_entity_matching_does_not_use_unsafe_substrings(self) -> None:
        self.assertEqual(planner.grade_race_entity_key("黒潮菊花賞"), "kuroshio-kikuka-sho")
        self.assertNotEqual(planner.grade_race_entity_key("黒潮菊花賞"), "kikuka-sho")
        self.assertEqual(planner.grade_race_entity_key("ひまわり賞(オークス)"), "himawari-sho-oaks")
        self.assertNotEqual(planner.grade_race_entity_key("ひまわり賞(オークス)"), "oaks")
        self.assertEqual(planner.grade_race_entity_key("ルーキーズサマーカップ"), "rookies-summer-cup")
        self.assertNotEqual(planner.grade_race_entity_key("ルーキーズサマーカップ"), "summer-cup")
        self.assertEqual(
            planner.grade_race_entity_key_from_text("2026 アイビスサマーダッシュ 出走予定"),
            "ibis-summer-dash",
        )
        self.assertEqual(planner.grade_race_entity_key("はまなす賞"), "hamanasu-sho")
        self.assertEqual(planner.grade_race_entity_key("ジュニアグランプリ"), "junior-grand-prix")
        self.assertEqual(planner.grade_race_entity_key("九州チャンピオンシップ"), "kyushu-championship")

    def test_find_race_demand_prefers_exact_and_longest_alias(self) -> None:
        planner._RACE_SCHEDULE_CACHE.clear()
        schedule = planner.available_race_demands()
        # 名前の一部が別の重賞の別名と重なるレース。直す前は、先に並ぶ短い別名の行に化けていた
        # （南部杯→マイルCS、関東オークス→オークス、ノースクイーンC→クイーンカップ）。
        expected_rows = [
            ("マイルチャンピオンシップ南部杯", "マイルチャンピオンシップ南部杯", "2026-10-12"),
            ("関東オークス", "関東オークス", "2026-06-17"),
            ("東京ダービー", "東京ダービー", "2026-06-10"),
            ("ジャパンダートクラシック", "ジャパンダートクラシック", "2026-10-07"),
            ("ノースクイーンC", "ノースクイーンカップ", "2026-07-16"),
            # 中央の本家は従来どおり
            ("マイルCS", "マイルCS", "2026-11-22"),
            ("マイルチャンピオンシップ", "マイルCS", "2026-11-22"),
            ("日本ダービー", "日本ダービー", "2026-05-31"),
            # 取り違えの無かったレースは直す前と同じ行
            ("さきたま杯", "さきたま杯", "2026-06-24"),
            ("帝王賞", "帝王賞", "2026-07-01"),
            ("ラジオNIKKEI賞", "ラジオNIKKEI賞", "2026-06-28"),
            ("金沢サマーカップ", "金沢サマーカップ", "2026-06-28"),
            ("北九州記念", "北九州記念", "2026-07-05"),
            ("エルムS", "エルムS", "2026-08-08"),
            ("マーキュリーカップ", "マーキュリーカップ", "2026-07-20"),
            ("アイビスサマーダッシュ", "アイビスサマーダッシュ", "2026-08-02"),
            ("オパールC", "オパールカップ", "2026-07-28"),
        ]
        for query, expected_name, expected_date in expected_rows:
            # race_name で引く形（日程由来の候補）と、文だけで引く形（ニュース由来）の両方
            for args in (("", query), (query,), (f"{query}2026 出走予定 開催概要", query)):
                with self.subTest(query=query, args=args):
                    entry = planner.find_race_demand(*args, schedule=schedule)
                    self.assertIsNotNone(entry)
                    self.assertEqual(entry.name, expected_name)
                    self.assertEqual(planner.race_demand_date(entry).isoformat(), expected_date)

        # 文に別のレース名が混じっていても、取り出し済みの race_name の行を選ぶ
        mixed = planner.find_race_demand(
            "マイルチャンピオンシップ南部杯 前年のマイルCS出走馬",
            "マイルチャンピオンシップ南部杯",
            schedule=schedule,
        )
        self.assertIsNotNone(mixed)
        self.assertEqual(mixed.name, "マイルチャンピオンシップ南部杯")

    def test_nanbu_hai_order_is_not_resolved_as_mile_championship(self) -> None:
        planner._RACE_SCHEDULE_CACHE.clear()
        now = datetime.fromisoformat("2026-09-28T08:00:00+09:00")
        entry = planner.find_race_demand("", "マイルチャンピオンシップ南部杯")
        self.assertIsNotNone(entry)
        candidate = planner.schedule_backfill_candidate(
            entry,
            14,
            now=now,
            search_intent_override="field_analysis",
            update_stage="field_building",
            deadline_status="due_initial",
            schedule_milestone="initial",
        )
        state = planner.WorkflowState(run_id="nanbu-hai-order", fetched_at=now.isoformat(), topic_candidates=[candidate])
        with patch.object(planner, "build_internal_data_bundle", return_value={}):
            planner.build_write_orders_node(state)

        self.assertEqual(len(state.write_orders), 1)
        order = state.write_orders[0]
        ref = order["reference_data"]
        self.assertEqual(ref["race_name"], "マイルチャンピオンシップ南部杯")
        self.assertEqual(ref["race_date"], "2026-10-12")
        self.assertEqual(ref["scheduled_venue"], "盛岡")
        self.assertEqual(ref["scheduled_grade"], "JpnI")
        self.assertEqual(ref["race_circuit"], "nar")
        self.assertNotEqual(ref["entity_archive_slug"], "mile-championship")
        self.assertNotEqual(ref["entity_key"], "mile-championship")
        self.assertNotIn("mile-championship", order["canonical_path"])

    def test_deterministic_grade_race_identity_matches_shared_fixtures(self) -> None:
        fixture_path = (
            Path(__file__).resolve().parents[2]
            / "frontend"
            / "content"
            / "reference"
            / "grade-race-identity-fixtures.json"
        )
        fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))
        for fixture in fixtures:
            entry = planner.RaceDemand(
                fixture["race_name"],
                (fixture["race_name"],),
                12,
                1,
                "地方重賞" if fixture["circuit"] == "nar" else "G3",
                30,
                year=2026,
                venue="佐賀" if fixture["circuit"] == "nar" else "東京",
                source_kind="nar" if fixture["circuit"] == "nar" else "jra",
            )
            resolution = planner.resolve_grade_race_schedule_identity(entry, registry=[])
            self.assertEqual(resolution.entity_key, fixture["entity_key"])
            self.assertEqual(resolution.source, "deterministic_schedule")
            self.assertEqual(resolution.archive_slug, "")

    def test_future_schedule_entities_resolve_without_manual_registry_coverage(self) -> None:
        now = datetime.fromisoformat("2026-08-03T08:00:00+09:00")
        schedule = planner.available_race_demands(now)
        future_entries = [
            entry
            for entry in schedule
            if 0 <= planner.days_until_race(entry, now) <= 370
            and planner.is_race_article_eligible(entry)
        ]
        resolutions = [planner.resolve_grade_race_schedule_identity(entry) for entry in future_entries]
        self.assertTrue(future_entries)
        self.assertTrue(all(resolution.resolved for resolution in resolutions))
        self.assertTrue(any(resolution.source == "deterministic_schedule" for resolution in resolutions))

    def test_grade_race_query_intents_are_gated_by_verified_stage(self) -> None:
        elm = planner.find_race_demand("エルムS")
        self.assertIsNotNone(elm)
        scheduled = planner.race_demand_date(elm)

        initial = planner.seo_keywords_for_grade_race(elm, scheduled, "field_building")
        self.assertTrue(any("出走予定" in keyword for keyword in initial))
        self.assertFalse(any("枠順" in keyword for keyword in initial))
        self.assertFalse(any("AI予想" in keyword for keyword in initial))

        draw = planner.seo_keywords_for_grade_race(
            elm,
            scheduled,
            "draw_confirmed",
            has_predictions=True,
        )
        self.assertTrue(any("枠順" in keyword for keyword in draw))
        self.assertTrue(any("AI予想" in keyword for keyword in draw))

        result = planner.seo_keywords_for_grade_race(
            elm,
            scheduled,
            "post_race",
            result_confirmed=True,
        )
        self.assertTrue(any("結果" in keyword for keyword in result))

    def test_query_builder_distributes_races_and_intents(self) -> None:
        state = planner.WorkflowState(
            run_id="test",
            fetched_at=planner.current_jst().isoformat(),
        )
        planner.build_queries_node(state)

        joined = "\n".join(state.queries)
        self.assertIn("さきたま杯", joined)
        self.assertIn("しらさぎS", joined)
        self.assertIn("帝王賞", joined)
        self.assertLessEqual(joined.count("追い切り"), 1)
        self.assertLessEqual(joined.count("枠順"), 1)

    def test_focus_window_is_twenty_one_days_before_and_three_days_after(self) -> None:
        self.assertTrue(planner.is_in_focus_window(7))
        self.assertTrue(planner.is_in_focus_window(21))
        self.assertFalse(planner.is_in_focus_window(22))
        self.assertTrue(planner.is_in_focus_window(-3))
        self.assertFalse(planner.is_in_focus_window(-4))

    def test_grade_priority_order_follows_search_demand_policy(self) -> None:
        self.assertLess(planner.grade_priority_rank("G1"), planner.grade_priority_rank("JpnI"))
        self.assertLess(planner.grade_priority_rank("JpnI"), planner.grade_priority_rank("G2"))
        self.assertLess(planner.grade_priority_rank("G2"), planner.grade_priority_rank("JpnII"))
        self.assertLess(planner.grade_priority_rank("JpnII"), planner.grade_priority_rank("G3"))
        self.assertLess(planner.grade_priority_rank("G3"), planner.grade_priority_rank("JpnIII"))
        self.assertLess(planner.grade_priority_rank("JpnIII"), planner.grade_priority_rank("重賞"))

    def test_first_pre_race_article_outranks_updates_and_reviews(self) -> None:
        # 検索はレースの前に集まるため、記事のない重賞の最初の1本を、既存記事の更新と結果回顧より先に書く。
        initial = planner.grade_calendar_priority("重賞", "due_initial")
        self.assertEqual(initial, planner.INITIAL_ARTICLE_PRIORITY)
        self.assertEqual(initial, planner.grade_calendar_priority("G1", "due_initial"))
        for status in (
            "due_race_morning",
            "due_final_48h",
            "due_draw_confirmed",
            "due_race_week",
            "due_field_refresh",
            "due_post_race",
            "due_result_review",
        ):
            self.assertGreater(initial, planner.grade_calendar_priority("G1", status), status)
        self.assertGreater(initial, planner.grade_calendar_priority("G1"))

    def test_uncovered_grade_races_are_ordered_by_race_date_and_far_initials_go_last(self) -> None:
        # 記事のない重賞（優先度120）の中の並び。
        # レース週（D-7以内）はレース日が近い順、同じ日は score 順。それより遠い初回は後ろで score 順。
        now = datetime.fromisoformat("2026-10-02T08:00:00+09:00")

        def uncovered(name: str, grade: str, days: int, venue: str, source_kind: str):
            race_date = now.date() + timedelta(days=days)
            entry = planner.RaceDemand(
                name,
                (name,),
                race_date.month,
                race_date.day,
                grade,
                planner.base_score_for_grade(grade),
                year=race_date.year,
                venue=venue,
                distance="ダ1400m" if source_kind == "nar" else "芝2000m",
                source_kind=source_kind,
            )
            candidate = planner.schedule_backfill_candidate(
                entry,
                days,
                now=now,
                search_intent_override="field_analysis",
                update_stage="race_week" if days <= 7 else "field_building",
                deadline_status="due_race_week" if days <= 7 else "due_initial",
                schedule_milestone=planner.RACE_WEEK_STAGE_KEY if days <= 7 else planner.INITIAL_STAGE_KEY,
            )
            candidate.order_priority = planner.INITIAL_ARTICLE_PRIORITY
            return candidate

        far_g1 = uncovered("並び確認G1", "G1", 16, "京都", "jra")
        far_jpn1 = uncovered("並び確認JpnI", "JpnI", 10, "盛岡", "nar")
        far_local = uncovered("並び確認ローカル遠い", "重賞", 9, "佐賀", "nar")
        week_g2 = uncovered("並び確認G2", "G2", 6, "東京", "jra")
        near_local = uncovered("並び確認ローカル前々日", "重賞", 2, "金沢", "nar")
        near_g3 = uncovered("並び確認G3", "G3", 2, "小倉", "jra")
        tomorrow_local = uncovered("並び確認ローカル前日", "重賞", 1, "園田", "nar")

        # score だけで並べると、遠い G1・JpnI がローカル重賞の前日・前々日より先になる（直す前の並び）
        self.assertGreater(far_g1.score, tomorrow_local.score)
        self.assertGreater(far_jpn1.score, near_local.score)

        ordered = sorted(
            [far_g1, far_jpn1, far_local, week_g2, near_local, near_g3, tomorrow_local],
            key=planner.topic_candidate_sort_key,
            reverse=True,
        )
        self.assertEqual(
            [candidate.race_name for candidate in ordered],
            [
                "並び確認ローカル前日",
                "並び確認G3",
                "並び確認ローカル前々日",
                "並び確認G2",
                "並び確認JpnI",
                "並び確認G1",
                "並び確認ローカル遠い",
            ],
        )

        # 記事のある重賞の更新（120未満）は、これまでどおり priority → score の順で、記事のない重賞の後ろ
        update = uncovered("並び確認更新", "G1", 0, "中山", "jra")
        update.order_priority = planner.grade_calendar_priority("G1", "due_race_morning")
        self.assertLess(planner.topic_candidate_sort_key(update), planner.topic_candidate_sort_key(far_local))
        news = uncovered("並び確認ニュース", "G1", 1, "中山", "jra")
        news.order_priority = 0
        self.assertLess(planner.topic_candidate_sort_key(news), planner.topic_candidate_sort_key(update))

    def test_cluster_topics_orders_uncovered_grade_races_by_sort_key(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-03T11:45:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            state = planner.WorkflowState(
                run_id="uncovered-order-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
            ):
                planner.cluster_topics_node(state)

            uncovered_candidates = [
                candidate
                for candidate in state.topic_candidates
                if candidate.order_priority == planner.INITIAL_ARTICLE_PRIORITY
            ]
            uncovered_days = [candidate.days_to_race for candidate in uncovered_candidates]
            self.assertGreater(len(uncovered_days), 1)
            self.assertTrue(all(days is not None and days >= 0 for days in uncovered_days))
            near_days = [days for days in uncovered_days if days <= planner.INITIAL_ARTICLE_NEAR_RACE_DAYS]
            far_days = [days for days in uncovered_days if days > planner.INITIAL_ARTICLE_NEAR_RACE_DAYS]
            # レース週の候補が先（レース日が近い順）、遠い初回はそのあと
            self.assertEqual(uncovered_days, near_days + far_days)
            self.assertEqual(near_days, sorted(near_days))
            # 同じレース日の中は score の高い順
            for earlier, later in zip(uncovered_candidates, uncovered_candidates[1:]):
                if earlier.days_to_race == later.days_to_race:
                    self.assertGreaterEqual(earlier.score, later.score)
            # 記事のない重賞は、どの候補よりも先に並ぶ
            self.assertEqual(state.topic_candidates[: len(uncovered_candidates)], uncovered_candidates)
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_initial_article_waits_for_entries_only_outside_g1_and_jpn1(self) -> None:
        # G1・JpnI 以外の「記事のない最初の1本」は、出馬表が入るころ（D-3 以内）まで待つ（2026-10-02）。
        now = datetime.fromisoformat("2026-10-02T08:00:00+09:00")

        def demand(grade: str, days: int, venue: str, source_kind: str):
            race_date = now.date() + timedelta(days=days)
            return planner.RaceDemand(
                f"待ち確認{grade}",
                (f"待ち確認{grade}",),
                race_date.month,
                race_date.day,
                grade,
                planner.base_score_for_grade(grade),
                year=race_date.year,
                venue=venue,
                source_kind=source_kind,
            )

        self.assertEqual(planner.LATE_INITIAL_ARTICLE_MAX_DAYS, 3)
        # G1・JpnI は、遠くても待たない
        for grade, venue, source_kind in (("G1", "京都", "jra"), ("JpnI", "盛岡", "nar")):
            for days in (21, 16, 8, 4, 3, 0):
                with self.subTest(grade=grade, days=days):
                    self.assertFalse(
                        planner.initial_article_waits_for_entries(demand(grade, days, venue, source_kind), days)
                    )
        # それ以外の格は、D-4 より前は待ち、D-3 からは待たない（レース後も待たない）
        for grade, venue, source_kind in (
            ("G2", "東京", "jra"),
            ("G3", "東京", "jra"),
            ("JpnII", "大井", "nar"),
            ("JpnIII", "船橋", "nar"),
            ("重賞", "金沢", "nar"),
        ):
            for days in (14, 6, 4):
                with self.subTest(grade=grade, days=days):
                    self.assertTrue(
                        planner.initial_article_waits_for_entries(demand(grade, days, venue, source_kind), days)
                    )
            for days in (3, 2, 0, -1):
                with self.subTest(grade=grade, days=days):
                    self.assertFalse(
                        planner.initial_article_waits_for_entries(demand(grade, days, venue, source_kind), days)
                    )
        # 日数が分からないときは、待たせない（これまでどおりの流れに任せる）
        self.assertFalse(planner.initial_article_waits_for_entries(demand("G3", 6, "東京", "jra"), None))

    def test_far_first_articles_stay_for_g1_and_wait_for_other_grades(self) -> None:
        # 2026-10-04 08:00：菊花賞 D-21・秋華賞 D-14・南部杯 D-8（G1・JpnI）は今のまま初回が出る。
        # サウジアラビアロイヤルC（G3・D-6）・富士S（G2・D-13）・アルテミスS（G3・D-20）・東京盃（JpnII・D-4）は待つ。
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-10-04T08:00:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            state = planner.WorkflowState(
                run_id="late-initial-wait-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
            ):
                planner.cluster_topics_node(state)

            by_name = {candidate.race_name: candidate for candidate in state.topic_candidates}
            for name, days in (("菊花賞", 21), ("秋華賞", 14), ("マイルチャンピオンシップ南部杯", 8)):
                with self.subTest(race=name):
                    self.assertIn(name, by_name)
                    self.assertEqual(by_name[name].days_to_race, days)
                    self.assertEqual(by_name[name].order_priority, planner.INITIAL_ARTICLE_PRIORITY)
            self.assertEqual(by_name["菊花賞"].schedule_milestone, planner.INITIAL_STAGE_KEY)
            for name in ("サウジアラビアロイヤルC", "富士S", "アルテミスS", "東京盃"):
                with self.subTest(race=name):
                    self.assertNotIn(name, by_name)
            # D-4 より前の候補に残るのは、G1・JpnI だけ
            for candidate in state.topic_candidates:
                if candidate.days_to_race is not None and candidate.days_to_race > planner.LATE_INITIAL_ARTICLE_MAX_DAYS:
                    entry = planner.find_race_demand("", candidate.race_name)
                    self.assertIsNotNone(entry, candidate.race_name)
                    self.assertIn(
                        planner.normalize_grade_label(entry.grade),
                        planner.EARLY_INITIAL_ARTICLE_GRADES,
                        candidate.race_name,
                    )

            waiting_issues = [issue for issue in state.issues if issue.startswith("出馬表が入るころ（D-3）まで初回を待つ重賞")]
            self.assertEqual(len(waiting_issues), 1)
            for label in ("サウジアラビアロイヤルC(D-6)", "富士S(D-13)", "アルテミスS(D-20)", "東京盃(D-4)"):
                self.assertIn(label, waiting_issues[0])
            self.assertNotIn("菊花賞", waiting_issues[0])
            # 待っている重賞には、公開準備・未公開の警告を出さない。G1 の公開準備はそのまま出す
            deadline_issues = [
                issue for issue in state.issues if issue.startswith(("D-21公開準備", "D-16未公開警告"))
            ]
            self.assertIn("D-21公開準備: 菊花賞 / 初回公開期限D-21", deadline_issues)
            for issue in deadline_issues:
                self.assertNotIn("アルテミスS", issue)
                self.assertNotIn("富士S", issue)
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_g3_first_article_waits_at_d6_and_appears_at_d3(self) -> None:
        # 北九州記念（G3・7/5）：D-6 の朝は候補にならず、D-3 の朝から初回（優先度120）が出る。
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        previous_max_orders = os.environ.get("KEIBA_NEWS_MAX_ORDERS_PER_RUN")
        os.environ["KEIBA_NEWS_MAX_ORDERS_PER_RUN"] = "3"
        draw_bundle = {
            "matched_race": {"total_horses": 3},
            "predictions": [
                {"馬番": "1枠1番"},
                {"馬番": "2枠2番"},
                {"馬番": "3枠3番"},
            ],
        }

        def plan(moment: str, *, draw_confirmed: bool):
            os.environ["KEIBA_NEWS_NOW"] = moment
            planner._RACE_SCHEDULE_CACHE.clear()
            state = planner.WorkflowState(
                run_id="g3-late-initial-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "grade_race_has_confirmed_draw", return_value=draw_confirmed),
                patch.object(
                    planner,
                    "build_internal_data_bundle",
                    return_value=draw_bundle if draw_confirmed else {},
                ),
            ):
                planner.cluster_topics_node(state)
                planner.build_write_orders_node(state)
            return state

        try:
            # D-6：出馬表（馬番・枠番）が入っていても、候補にも注文にもならない
            waiting = plan("2026-06-29T08:00:00+09:00", draw_confirmed=True)
            self.assertNotIn("北九州記念", [candidate.race_name for candidate in waiting.topic_candidates])
            self.assertNotIn(
                "北九州記念",
                [order["reference_data"]["race_name"] for order in waiting.write_orders],
            )
            self.assertTrue(any("北九州記念(D-6)" in issue for issue in waiting.issues))

            # D-3・馬番と枠番が入っている：枠順確定後の段階で、初回として先に書く
            with_draw = plan("2026-07-02T08:00:00+09:00", draw_confirmed=True)
            order = next(
                order
                for order in with_draw.write_orders
                if order["reference_data"]["race_name"] == "北九州記念"
            )
            self.assertEqual(order["reference_data"]["days_to_race"], 3)
            self.assertEqual(order["priority"], planner.INITIAL_ARTICLE_PRIORITY)
            self.assertEqual(order["reference_data"]["update_stage"], "draw_confirmed")
            self.assertEqual(order["reference_data"]["draw_status"], "confirmed")

            # D-3・馬番と枠番がまだ無い：レース週の段階で初回を書く（枠順を先取りしない）
            without_draw = plan("2026-07-02T08:00:00+09:00", draw_confirmed=False)
            order = next(
                order
                for order in without_draw.write_orders
                if order["reference_data"]["race_name"] == "北九州記念"
            )
            self.assertEqual(order["priority"], planner.INITIAL_ARTICLE_PRIORITY)
            self.assertEqual(order["reference_data"]["update_stage"], "race_week")
            self.assertEqual(order["reference_data"]["draw_status"], "pre_draw")
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

    def test_existing_article_update_gets_a_slot_when_far_firsts_wait(self) -> None:
        # 2026-06-29 08:00・上限3：記事のない D-3 以内は ハヤテスプリント・優駿スプリント（D-1）の2本。
        # 帝王賞（D-2）は初回の記事があり、レース週の更新が残っている。
        # 遠い初回（北九州記念 D-6 など）を待たせるので、3本目の枠が帝王賞の更新に回る。
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        previous_max_orders = os.environ.get("KEIBA_NEWS_MAX_ORDERS_PER_RUN")
        os.environ["KEIBA_NEWS_NOW"] = "2026-06-29T08:00:00+09:00"
        os.environ["KEIBA_NEWS_MAX_ORDERS_PER_RUN"] = "3"
        planner._RACE_SCHEDULE_CACHE.clear()

        def plan(covered_keys, *, wait_enabled: bool):
            state = planner.WorkflowState(
                run_id="update-slot-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            patches = [
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set(covered_keys)),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "build_internal_data_bundle", return_value={}),
            ]
            if not wait_enabled:
                # 直す前の動き（遠い初回も候補にする）
                patches.append(patch.object(planner, "initial_article_waits_for_entries", return_value=False))
            for item in patches:
                item.start()
            try:
                planner.cluster_topics_node(state)
                planner.build_write_orders_node(state)
            finally:
                for item in patches:
                    item.stop()
            return state

        try:
            teio = planner.find_race_demand("帝王賞")
            self.assertIsNotNone(teio)
            self.assertEqual(planner.days_until_race(teio), 2)
            covered_keys = {
                planner.grade_race_stage_key(
                    planner.grade_race_identity_key(teio),
                    "2026",
                    planner.INITIAL_STAGE_KEY,
                )
            }
            update_priority = planner.grade_calendar_priority(teio.grade, "due_race_week")
            self.assertLess(update_priority, planner.INITIAL_ARTICLE_PRIORITY)

            after = plan(covered_keys, wait_enabled=True)
            after_orders = {
                order["reference_data"]["race_name"]: order for order in after.write_orders
            }
            self.assertEqual(len(after.write_orders), 3)
            self.assertIn("帝王賞", after_orders)
            self.assertEqual(after_orders["帝王賞"]["priority"], update_priority)
            self.assertEqual(after_orders["帝王賞"]["reference_data"]["update_stage"], "race_week")
            # 残りの2本は、記事のない D-3 以内の初回
            first_orders = [
                order for order in after.write_orders if order["priority"] == planner.INITIAL_ARTICLE_PRIORITY
            ]
            self.assertEqual(len(first_orders), 2)
            for order in first_orders:
                self.assertLessEqual(
                    order["reference_data"]["days_to_race"],
                    planner.LATE_INITIAL_ARTICLE_MAX_DAYS,
                )

            # 待たせない（直す前の）動きでは、3本とも記事のない初回で埋まり、更新は選ばれない
            before = plan(covered_keys, wait_enabled=False)
            self.assertEqual(len(before.write_orders), 3)
            self.assertNotIn("帝王賞", [order["reference_data"]["race_name"] for order in before.write_orders])
            self.assertTrue(
                all(order["priority"] == planner.INITIAL_ARTICLE_PRIORITY for order in before.write_orders)
            )
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

    def test_news_candidate_for_uncovered_far_race_waits_too(self) -> None:
        # ニュースから作る候補も、G1・JpnI 以外の記事のない重賞は D-3 以内まで待つ。
        # 2026-07-03：七夕賞（G3・7/12）は D-9。初回の記事があれば、ニュースの候補はこれまでどおり出る。
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-03T11:45:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        news_url = "https://www.jra.go.jp/keiba/thisweek/2026/0712_1/"

        def plan(covered_keys):
            state = planner.WorkflowState(
                run_id="news-late-initial-test",
                fetched_at=planner.current_jst().isoformat(),
                source_cards=[
                    planner.SourceCard(
                        title="七夕賞の過去10年の傾向",
                        url=news_url,
                        content="七夕賞は福島競馬場の芝2000メートルで行われる。過去10年の傾向を確認する。",
                        query="七夕賞 過去 傾向",
                        source_name="www.jra.go.jp",
                        source_type="official",
                        score=100,
                        fetched_at=planner.current_jst().isoformat(),
                        allowed_claims=["七夕賞は福島競馬場の芝2000メートルで行われる。"],
                    )
                ],
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set(covered_keys)),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
            ):
                planner.cluster_topics_node(state)
            return [
                candidate
                for candidate in state.topic_candidates
                if any(card.url == news_url for card in candidate.source_cards)
            ]

        try:
            tanabata = planner.find_race_demand("七夕賞")
            self.assertIsNotNone(tanabata)
            self.assertEqual(planner.days_until_race(tanabata), 9)
            self.assertEqual(plan(set()), [])

            initial_key = planner.grade_race_stage_key(
                planner.grade_race_identity_key(tanabata),
                "2026",
                planner.INITIAL_STAGE_KEY,
            )
            covered_news = plan({initial_key})
            self.assertEqual(len(covered_news), 1)
            self.assertEqual(covered_news[0].race_name, "七夕賞")
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_article_lead_days_follow_grade_and_observed_demand(self) -> None:
        g1 = planner.RaceDemand("確認G1", ("確認G1",), 12, 1, "G1", 40, source_kind="jra")
        g2 = planner.RaceDemand("確認G2", ("確認G2",), 12, 1, "G2", 36, source_kind="jra")
        g3 = planner.RaceDemand("確認G3", ("確認G3",), 12, 1, "G3", 30, source_kind="jra")
        mercury = planner.find_race_demand("マーキュリーカップ")
        banei = planner.RaceDemand("ばんえい大賞典", ("ばんえい大賞典",), 7, 20, "重賞", 22, source_kind="nar")

        self.assertEqual(planner.race_article_initial_lead_days(g1), 21)
        self.assertEqual(planner.race_article_initial_lead_days(g2), 14)
        self.assertEqual(planner.race_article_initial_lead_days(g3), 14)
        self.assertIsNotNone(mercury)
        self.assertEqual(planner.race_article_initial_lead_days(mercury), 14)
        self.assertEqual(planner.race_article_initial_lead_days(banei), 14)

    def test_initial_due_days_match_the_timing_the_first_article_is_ordered(self) -> None:
        # 計測の「公開が遅い」と監査の「次回公開期限」が使う日数。初回を待つ判定と同じ境目にする
        g1 = planner.RaceDemand("確認G1", ("確認G1",), 12, 1, "G1", 40, source_kind="jra")
        jpn1 = planner.RaceDemand("確認JpnI", ("確認JpnI",), 12, 1, "JpnI", 36, source_kind="nar")
        g3 = planner.RaceDemand("確認G3", ("確認G3",), 12, 1, "G3", 30, source_kind="jra")
        banei = planner.RaceDemand("ばんえい大賞典", ("ばんえい大賞典",), 7, 20, "重賞", 22, source_kind="nar")

        self.assertEqual(planner.race_article_initial_due_days(g1), 21)
        self.assertEqual(planner.race_article_initial_due_days(jpn1), 21)
        for entry in (g3, banei):
            due_days = planner.race_article_initial_due_days(entry)
            self.assertEqual(due_days, planner.LATE_INITIAL_ARTICLE_MAX_DAYS)
            self.assertTrue(planner.initial_article_waits_for_entries(entry, due_days + 1))
            self.assertFalse(planner.initial_article_waits_for_entries(entry, due_days))

    def test_replays_four_observed_search_demand_patterns(self) -> None:
        ibis = planner.find_race_demand("アイビスサマーダッシュ")
        mercury = planner.find_race_demand("マーキュリーカップ")
        opal = planner.find_race_demand("オパールC")
        north_queen = planner.find_race_demand("ノースクイーンC")

        self.assertIsNotNone(ibis)
        self.assertIsNotNone(mercury)
        self.assertIsNotNone(opal)
        self.assertIsNotNone(north_queen)
        self.assertEqual(planner.race_article_initial_lead_days(ibis), 14)
        self.assertEqual(planner.race_article_initial_lead_days(mercury), 14)
        self.assertEqual(planner.race_article_initial_lead_days(opal), 14)
        self.assertEqual(planner.race_article_initial_lead_days(north_queen), 14)
        self.assertTrue(planner.is_race_article_eligible(north_queen))

    def test_all_grade_races_keep_d21_d16_d14_publication_boundaries(self) -> None:
        g1 = planner.RaceDemand(
            "確認G1", ("確認G1",), 8, 22, "G1", 40, year=2026,
            venue="東京", distance="芝2000m", conditions="3歳以上", source_kind="jra",
        )
        g3 = planner.RaceDemand(
            "確認G3", ("確認G3",), 8, 15, "G3", 30, year=2026,
            venue="東京", distance="芝1600m", conditions="3歳以上", source_kind="jra",
        )
        local = planner.RaceDemand(
            "確認地方重賞", ("確認地方重賞",), 8, 15, "地方重賞", 20, year=2026,
            venue="大井", distance="1800m", conditions="3歳以上", source_kind="nar",
        )
        now = datetime.fromisoformat("2026-08-01T08:00:00+09:00")
        self.assertEqual(planner.race_article_initial_lead_days(g1), 21)
        self.assertEqual(planner.race_article_initial_lead_days(g3), 14)
        self.assertEqual(planner.race_article_initial_lead_days(local), 14)
        self.assertEqual(planner.grade_race_publication_readiness(g1, 21, set(), now=now), "preparation_d21")
        self.assertEqual(planner.grade_race_publication_readiness(g1, 16, set(), now=now), "warning_d16_unpublished")
        self.assertEqual(planner.grade_race_publication_readiness(g3, 14, set(), now=now), "due_initial")

    def test_official_fact_fallback_requires_complete_confirmed_schedule(self) -> None:
        confirmed = planner.RaceDemand(
            "確認重賞", ("確認重賞",), 8, 15, "G3", 30, year=2026,
            venue="東京", distance="芝1600m", conditions="3歳以上", source_kind="jra",
        )
        incomplete = planner.RaceDemand(
            "日程未確定重賞", ("日程未確定重賞",), 8, 15, "地方重賞", 20, year=2026,
            venue="大井", distance="1800m", conditions="", source_kind="nar",
        )
        late = planner.RaceDemand(
            "遅発表重賞", ("遅発表重賞",), 8, 15, "地方重賞", 20, year=2026,
            venue="大井", distance="1800m", conditions="3歳以上", source_kind="web",
        )
        cached_jra = planner.RaceDemand(
            "保存済みJRA日程", ("保存済みJRA日程",), 8, 15, "G3", 30, year=2026,
            venue="東京", distance="芝1600m", conditions="3歳以上", source_kind="jra_local",
            source_url="https://www.jra.go.jp/datafile/seiseki/replay/2026/jyusyo.html",
        )
        self.assertTrue(planner.has_confirmed_official_schedule_facts(confirmed))
        self.assertFalse(planner.has_confirmed_official_schedule_facts(incomplete))
        self.assertFalse(planner.has_confirmed_official_schedule_facts(late))
        self.assertFalse(planner.has_confirmed_official_schedule_facts(cached_jra))
        self.assertFalse(
            planner.has_confirmed_official_schedule_facts(
                planner.RaceDemand(
                    "偽装JRA日程", ("偽装JRA日程",), 8, 15, "G3", 30, year=2026,
                    venue="東京", distance="芝1600m", conditions="3歳以上", source_kind="jra",
                    source_url="https://attacker@example.org@www.jra.go.jp/datafile/seiseki/replay/2026/jyusyo.html",
                )
            )
        )

    def test_nar_official_pdf_text_requires_complete_rows_and_keeps_source_evidence(self) -> None:
        source_url = "https://www.keiba.go.jp/pdf/RaceScheduleList/heavyprize202608.pdf"
        extracted_text = """2026年8月重賞日程
競馬場 実施日 曜日 レース名 格 シリーズ 距離(m) 出走資格 交流区分
盛岡 8/11 祝火 第31回クラスターカップ JpnⅢ 1200 サラ系3歳以上 指定交流
園田 8/14 金 第58回摂津盃 重賞Ⅰ 1700 サラ系3歳以上
大井 8/32 月 第1回不正日付賞 SⅢ 1200 サラ系3歳以上
金沢 8/20 木 第1回条件欠落賞 SⅢ 1500
"""
        entries = planner.parse_nar_official_schedule_text(extracted_text, 2026, source_url)
        self.assertEqual([entry.name for entry in entries], ["クラスターカップ", "摂津盃"])
        cluster = entries[0]
        self.assertEqual(cluster.grade, "JpnIII")
        self.assertEqual(cluster.venue, "盛岡")
        self.assertEqual(cluster.distance, "1200m")
        self.assertEqual(cluster.conditions, "サラ系3歳以上")
        self.assertEqual(cluster.source_kind, "nar_official_pdf")
        self.assertEqual(cluster.source_url, source_url)
        self.assertTrue(planner.has_confirmed_official_schedule_facts(cluster))
        self.assertFalse(
            planner.has_confirmed_official_schedule_facts(
                planner.RaceDemand(
                    **{**cluster.__dict__, "source_url": "https://www.keiba.go.jp/"},
                )
            )
        )

    def test_official_nar_pdf_fetch_is_month_bounded_and_never_uses_media_when_disabled(self) -> None:
        calls = []

        class FakeResponse:
            headers = {"content-type": "application/pdf"}
            content = b"not-a-pdf"
            text = ""
            status_code = 200
            url = ""

            def raise_for_status(self) -> None:
                return None

            def iter_content(self, chunk_size):
                yield self.content

            def close(self) -> None:
                return None

        def fake_get(url, **_kwargs):
            calls.append((url, _kwargs))
            response = FakeResponse()
            response.url = url
            return response

        with (
            patch.dict(os.environ, {
                "KEIBA_NEWS_REMOTE_SCHEDULE_ENABLED": "true",
                "KEIBA_NEWS_OFFICIAL_NAR_SCHEDULE_ENABLED": "true",
                "KEIBA_NEWS_REMOTE_NAR_SCHEDULE_ENABLED": "false",
            }, clear=False),
            patch.object(planner, "schedule_months_in_window", return_value=[(2026, 8), (2026, 9), (2026, 10), (2026, 11)]),
            patch.object(planner.requests, "get", side_effect=fake_get),
        ):
            planner.fetch_remote_race_schedule(datetime.fromisoformat("2026-08-01T08:00:00+09:00"))

        official_pdf_calls = [(url, kwargs) for url, kwargs in calls if "heavyprize" in url]
        self.assertEqual(len(official_pdf_calls), planner.NAR_OFFICIAL_PDF_MAX_MONTHS)
        self.assertTrue(all(url.startswith("https://www.keiba.go.jp/pdf/RaceScheduleList/heavyprize2026") for url, _kwargs in official_pdf_calls))
        self.assertTrue(all(kwargs["allow_redirects"] is False and kwargs["stream"] is True for _url, kwargs in official_pdf_calls))
        self.assertFalse(any("netkeiba" in url for url, _kwargs in calls))

    def test_due_official_schedule_order_marks_llm_free_fallback_eligibility(self) -> None:
        now = datetime.fromisoformat("2026-08-01T08:00:00+09:00")
        entry = planner.RaceDemand(
            "確認重賞", ("確認重賞",), 8, 15, "G3", 30, year=2026,
            venue="東京", distance="芝1600m", conditions="3歳以上", source_kind="jra",
        )
        candidate = planner.schedule_backfill_candidate(
            entry,
            14,
            now=now,
            search_intent_override="field_analysis",
            update_stage="field_building",
            deadline_status="due_initial",
            schedule_milestone="initial",
        )
        state = planner.WorkflowState(run_id="official-fact-order", fetched_at=now.isoformat(), topic_candidates=[candidate])
        with (
            patch.object(planner, "find_race_demand", return_value=entry),
            patch.object(planner, "build_internal_data_bundle", return_value={}),
        ):
            planner.build_write_orders_node(state)

        self.assertEqual(len(state.write_orders), 1)
        ref = state.write_orders[0]["reference_data"]
        self.assertTrue(ref["official_schedule_confirmed"])
        self.assertTrue(ref["official_fact_fallback_eligible"])
        self.assertEqual(ref["schedule_source_url"], "https://www.jra.go.jp/datafile/seiseki/replay/2026/jyusyo.html")

    def test_schedule_milestone_history_prevents_duplicate_stage_generation(self) -> None:
        fields = {
            "entity_type": "grade_race",
            "entity_key": "ibis-summer-dash",
            "season_year": "2026",
            "schedule_milestone": "draw_confirmed",
            "schedule_milestones": "initial,race_week_d7,draw_confirmed",
        }
        keys = planner.grade_race_stage_keys_from_fields(fields)
        self.assertIn("ibis-summer-dash:2026:initial", keys)
        self.assertIn("ibis-summer-dash:2026:race_week_d7", keys)
        self.assertIn("ibis-summer-dash:2026:draw_confirmed", keys)

    def test_grade_write_order_is_generated_without_gsc_configuration(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        previous_gsc_site_url = os.environ.pop("GSC_SITE_URL", None)
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-03T11:45:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            state = planner.WorkflowState(
                run_id="grade-without-gsc-test",
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

            self.assertTrue(
                any(
                    order["reference_data"].get("race_name") == "北九州記念"
                    for order in state.write_orders
                )
            )
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            if previous_gsc_site_url is not None:
                os.environ["GSC_SITE_URL"] = previous_gsc_site_url
            planner._RACE_SCHEDULE_CACHE.clear()

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

    def test_confirmed_db_draw_generates_jra_draw_update_with_course_keywords(self) -> None:
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
                patch.object(planner, "grade_race_has_confirmed_draw", return_value=True),
                patch.object(
                    planner,
                    "build_internal_data_bundle",
                    return_value={
                        "matched_race": {"total_horses": 3},
                        "predictions": [
                            {"馬番": "1枠1番"},
                            {"馬番": "2枠2番"},
                            {"馬番": "3枠3番"},
                        ],
                    },
                ),
            ):
                planner.cluster_topics_node(state)
                planner.build_write_orders_node(state)

            order = next(
                order
                for order in state.write_orders
                if order["reference_data"]["race_name"] == "北九州記念"
            )
            # 予測（馬番つき）がある段階なので、検索の語に「AI予想」が入る（2026-10-02）
            self.assertEqual(order["target_keyword"], "北九州記念2026 AI予想 枠順確定後")
            self.assertEqual(order["reference_data"]["update_stage"], "draw_confirmed")
            self.assertEqual(order["reference_data"]["draw_status"], "confirmed")
            self.assertIn("北九州記念 小倉", order["reference_data"]["keywords"])
            self.assertIn("小倉芝1200m 傾向", order["reference_data"]["keywords"])
            self.assertEqual(order["reference_data"]["schedule_milestone"], "draw_confirmed")
            # 記事のない重賞の最初の1本なので、枠順確定後の段階でも初回として先に書く
            self.assertEqual(order["priority"], planner.INITIAL_ARTICLE_PRIORITY)
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

    def test_unconfirmed_draw_never_advances_beyond_race_week(self) -> None:
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
            self.assertEqual(order["reference_data"]["deadline_status"], "due_race_week")
            self.assertEqual(order["reference_data"]["update_stage"], "race_week")
            self.assertEqual(order["reference_data"]["draw_status"], "pre_draw")
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
                patch.object(
                    planner,
                    "build_internal_data_bundle",
                    return_value={
                        "results": [
                            {"着順": 1, "馬番": 1, "馬名": "確認馬1"},
                            {"着順": 2, "馬番": 2, "馬名": "確認馬2"},
                            {"着順": 3, "馬番": 3, "馬名": "確認馬3"},
                        ]
                    },
                ),
            ):
                planner.cluster_topics_node(state)
                # 並び順（記事のない他の重賞の初回が先）ではなく、結果回顧の注文の中身を確かめる
                state.topic_candidates = [
                    candidate for candidate in state.topic_candidates if candidate.race_name == "北九州記念"
                ]
                planner.build_write_orders_node(state)

            order = next(
                order
                for order in state.write_orders
                if order["reference_data"]["race_name"] == "北九州記念"
            )
            self.assertEqual(order["target_keyword"], "北九州記念2026 結果 回顧")
            self.assertEqual(order["reference_data"]["update_stage"], "post_race")
            self.assertTrue(order["reference_data"]["result_confirmed"])
            self.assertEqual(order["reference_data"]["race_phase"], "post_race")
            self.assertEqual(order["reference_data"]["entity_key"], "kitakyushu-kinen")
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_nar_grade_generates_post_race_only_after_results_are_confirmed(self) -> None:
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
            # レース前の記事を一度も出していない重賞は、結果回顧だけの候補を作らない（レース後が初出の記事は読まれない）
            self.assertEqual(result_candidates, [])
            self.assertFalse(
                any(candidate.race_name == "スパーキングレディーカップ" for candidate in state.topic_candidates)
            )
            self.assertTrue(
                any(
                    "結果回顧の候補を見送り" in issue and "スパーキングレディーカップ" in issue
                    for issue in state.issues
                )
            )
            self.assertFalse(any(candidate.update_stage == "post_race" for candidate in state.topic_candidates))

            # レース前の記事がある重賞は、同じURLを結果回顧へ更新する通常の優先度
            entry = next(entry for entry, _days in planner.focus_races() if entry.name == "スパーキングレディーカップ")
            identity_key = planner.resolve_grade_race_schedule_identity(entry).entity_key
            season_year = str(planner.race_demand_date(entry).year)
            covered_keys = {planner.grade_race_stage_key(identity_key, season_year, planner.INITIAL_STAGE_KEY)}
            covered_state = planner.WorkflowState(
                run_id="nar-covered-result-review-test",
                fetched_at=planner.current_jst().isoformat(),
            )
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=covered_keys),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "grade_race_has_results", return_value=True),
            ):
                planner.cluster_topics_node(covered_state)
            covered_candidates = [
                candidate
                for candidate in covered_state.topic_candidates
                if candidate.search_intent == "result_review"
                and candidate.race_name == "スパーキングレディーカップ"
            ]
            self.assertEqual(len(covered_candidates), 1)
            self.assertEqual(covered_candidates[0].order_priority, planner.grade_calendar_priority("", "due_post_race"))
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
            # 予測がない段階は「過去データ」の形（「予想」も「出走予定」「比較データ」も使わない。2026-10-02）
            self.assertEqual(kitakyushu_order["target_keyword"], "北九州記念2026 過去データ 傾向 レース条件")
            self.assertEqual(kitakyushu_order["reference_data"]["deadline_status"], "due_race_week")
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

    def test_grade_race_target_keyword_follows_prediction_and_stage(self) -> None:
        pre_race_stages = ["race_week", "draw_confirmed", "final_48h", "race_morning"]

        def keyword(stage: str, has_predictions: bool) -> str:
            return planner.grade_race_target_keyword(
                "北九州記念",
                2026,
                stage,
                "waku" if stage == "draw_confirmed" else "race_profile",
                has_predictions=has_predictions,
            )

        # (a) 予測がある段階は「予想」（「AI予想」の形）が入る
        for stage in pre_race_stages:
            with self.subTest(stage=stage, has_predictions=True):
                with_predictions = keyword(stage, True)
                self.assertTrue(with_predictions.startswith("北九州記念2026 "))
                self.assertIn("AI予想", with_predictions)

        # (b) 予測がない段階は「予想」を名乗らない。枠順の前は「過去データ」の形にする
        for stage in ["field_building", "race_week"]:
            with self.subTest(stage=stage, has_predictions=False):
                without_predictions = keyword(stage, False)
                self.assertNotIn("予想", without_predictions)
                self.assertIn("過去データ", without_predictions)
                # 書く側は、枠順の前の題に「出走予定」「比較データ」を使わない決まり
                self.assertNotIn("出走予定", without_predictions)
                self.assertNotIn("比較データ", without_predictions)
        for stage in ["draw_confirmed", "final_48h", "race_morning"]:
            with self.subTest(stage=stage, has_predictions=False):
                self.assertNotIn("予想", keyword(stage, False))

        # 最初の段階は、公式の事実だけの定型記事になることがあるので、予測があっても「予想」を入れない
        self.assertNotIn("予想", keyword("field_building", True))
        self.assertIn("過去データ", keyword("field_building", True))

        # (c) 枠順が確定する前の段階は、予測があっても「枠順」を入れない
        for stage in ["field_building", "race_week"]:
            for has_predictions in (False, True):
                with self.subTest(stage=stage, has_predictions=has_predictions):
                    self.assertNotIn("枠順", keyword(stage, has_predictions))

        # (d) 結果回顧は、予測の有無で変わらない
        for has_predictions in (False, True):
            self.assertEqual(
                planner.grade_race_target_keyword(
                    "北九州記念",
                    2026,
                    "post_race",
                    "result_review",
                    has_predictions=has_predictions,
                ),
                "北九州記念2026 結果 回顧",
            )

        # 段階ごとに違う語にする（書く側は、既存記事とまったく同じ語の注文を重複として飛ばす）
        all_keywords = [
            keyword(stage, has_predictions)
            for stage in ["field_building", *pre_race_stages]
            for has_predictions in (False, True)
            if not (stage == "field_building" and has_predictions)
        ]
        self.assertEqual(len(all_keywords), len(set(all_keywords)))

        # 当てはまる形がない段階は空文字（呼ぶ側は元の語を使う）
        self.assertEqual(planner.grade_race_target_keyword("北九州記念", 2026, "", "race_profile"), "")

    def test_grade_race_keywords_keep_ai_prediction_within_cap(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-05T08:00:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        try:
            entry = planner.find_race_demand("北九州記念")
            scheduled = planner.race_demand_date(entry)
            for stage in ["race_week", "draw_confirmed", "final_48h", "race_morning"]:
                with self.subTest(stage=stage):
                    with_predictions = planner.seo_keywords_for_grade_race(
                        entry, scheduled, stage, has_predictions=True
                    )
                    # 上限で切られても、予測がある段階は「AI予想」が残る
                    self.assertLessEqual(len(with_predictions), 18)
                    self.assertIn("北九州記念 AI予想", with_predictions)
                    without_predictions = planner.seo_keywords_for_grade_race(
                        entry, scheduled, stage, has_predictions=False
                    )
                    self.assertFalse(any("予想" in keyword for keyword in without_predictions))
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_race_week_order_uses_ai_prediction_keyword_only_with_predictions(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-05T08:00:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()
        # 予測はあるが、馬番がまだ無い（枠順は未確定）
        bundle_with_predictions = {
            "matched_race": {"total_horses": 3},
            "predictions": [{"馬名": "確認馬1"}, {"馬名": "確認馬2"}, {"馬名": "確認馬3"}],
        }
        cases = [
            ("with_predictions", bundle_with_predictions, True, "北九州記念2026 AI予想 過去データ"),
            ("without_predictions", {}, False, "北九州記念2026 過去データ 傾向 レース条件"),
        ]
        try:
            for label, bundle, has_predictions, expected_keyword in cases:
                with self.subTest(label=label):
                    state = planner.WorkflowState(
                        run_id=f"target-keyword-{label}-test",
                        fetched_at=planner.current_jst().isoformat(),
                    )
                    with (
                        patch.object(planner, "load_existing_article_keywords", return_value=set()),
                        patch.object(planner, "load_pending_order_keywords", return_value=set()),
                        patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                        patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                        patch.object(planner, "build_internal_data_bundle", return_value=bundle),
                    ):
                        planner.cluster_topics_node(state)
                        # 並び順ではなく、北九州記念の注文の中身を確かめる
                        state.topic_candidates = [
                            candidate for candidate in state.topic_candidates if candidate.race_name == "北九州記念"
                        ]
                        planner.build_write_orders_node(state)

                    order = next(
                        order
                        for order in state.write_orders
                        if order["reference_data"]["race_name"] == "北九州記念"
                    )
                    self.assertEqual(order["reference_data"]["update_stage"], "race_week")
                    self.assertEqual(order["reference_data"]["draw_status"], "pre_draw")
                    self.assertEqual(order["has_predictions"], has_predictions)
                    self.assertEqual(order["target_keyword"], expected_keyword)
                    # 枠順が確定していない段階なので、どちらも「枠順」を使わない
                    self.assertNotIn("枠順", order["target_keyword"])
                    if has_predictions:
                        self.assertIn("予想", order["target_keyword"])
                        self.assertTrue(any("AI予想" in keyword for keyword in order["keywords"]))
                    else:
                        self.assertNotIn("予想", order["target_keyword"])
                        self.assertIn("過去データ", order["target_keyword"])
                        self.assertFalse(any("AI予想" in keyword for keyword in order["keywords"]))
                    # 同じ記事かどうかを見る鍵（entity_key・年・節目）は、語を変えても同じ
                    self.assertEqual(order["reference_data"]["entity_key"], "kitakyushu-kinen")
                    self.assertEqual(order["reference_data"]["schedule_milestone"], planner.RACE_WEEK_STAGE_KEY)
        finally:
            if previous_now is None:
                os.environ.pop("KEIBA_NEWS_NOW", None)
            else:
                os.environ["KEIBA_NEWS_NOW"] = previous_now
            planner._RACE_SCHEDULE_CACHE.clear()

    def test_gate_rejected_candidates_do_not_use_order_slots(self) -> None:
        previous_now = os.environ.get("KEIBA_NEWS_NOW")
        previous_max_orders = os.environ.get("KEIBA_NEWS_MAX_ORDERS_PER_RUN")
        os.environ["KEIBA_NEWS_NOW"] = "2026-07-03T11:45:00+09:00"
        planner._RACE_SCHEDULE_CACHE.clear()

        def clustered_state(run_id: str):
            state = planner.WorkflowState(run_id=run_id, fetched_at=planner.current_jst().isoformat())
            planner.cluster_topics_node(state)
            return state

        def stop_at_gate(candidate) -> None:
            # 確定結果の無い結果回顧にして、関門（確定結果不足）で止める
            candidate.search_intent = "result_review"
            candidate.update_stage = "post_race"

        def stopped_issues(state) -> list:
            return [issue for issue in state.issues if "確定結果不足のため結果更新を停止" in issue]

        try:
            with (
                patch.object(planner, "load_existing_article_keywords", return_value=set()),
                patch.object(planner, "load_pending_order_keywords", return_value=set()),
                patch.object(planner, "load_existing_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "load_pending_grade_race_stage_keys", return_value=set()),
                patch.object(planner, "build_internal_data_bundle", return_value={}),
                # ここで見るのは注文の枠の数え方。候補が5件以上要るため、初回を D-3 まで待つ決まりは外す
                patch.object(planner, "initial_article_waits_for_entries", return_value=False),
            ):
                # 関門で止まる候補が無いときは、候補の上から5件がそのまま注文になる
                os.environ["KEIBA_NEWS_MAX_ORDERS_PER_RUN"] = "5"
                baseline = clustered_state("gate-slot-baseline")
                planner.build_write_orders_node(baseline)
                baseline_races = [order["reference_data"]["race_name"] for order in baseline.write_orders]
                self.assertEqual(len(baseline_races), 5)
                self.assertEqual(len(set(baseline_races)), 5)
                self.assertEqual(
                    baseline_races,
                    [candidate.race_name for candidate in baseline.topic_candidates[:5]],
                )

                # 上位2件が関門で止まっても、次の候補で上限の3件まで埋まる（上限は超えない）
                os.environ["KEIBA_NEWS_MAX_ORDERS_PER_RUN"] = "3"
                state = clustered_state("gate-slot-refill")
                for candidate in state.topic_candidates[:2]:
                    stop_at_gate(candidate)
                planner.build_write_orders_node(state)
                ordered_races = [order["reference_data"]["race_name"] for order in state.write_orders]
                self.assertEqual(ordered_races, baseline_races[2:5])
                self.assertEqual([candidate.race_name for candidate in state.selected_topics], ordered_races)
                stopped = stopped_issues(state)
                self.assertEqual(len(stopped), 2)
                for race_name in baseline_races[:2]:
                    self.assertTrue(any(race_name in issue for issue in stopped), race_name)

                # 全部の候補が関門で止まるときは、最後まで見て注文0件。理由は1件ずつ残る
                all_stopped = clustered_state("gate-slot-all-stopped")
                for candidate in all_stopped.topic_candidates:
                    stop_at_gate(candidate)
                planner.build_write_orders_node(all_stopped)
                self.assertEqual(all_stopped.write_orders, [])
                self.assertEqual(all_stopped.selected_topics, [])
                self.assertGreater(len(stopped_issues(all_stopped)), 3)

                # 関門で止まったレースを、同じ回に別の候補で書き直さない
                retry = clustered_state("gate-slot-same-race")
                stopped_candidate = retry.topic_candidates[0]
                same_race_candidate = copy.deepcopy(stopped_candidate)
                stop_at_gate(stopped_candidate)
                retry.topic_candidates = [stopped_candidate, same_race_candidate]
                planner.build_write_orders_node(retry)
                self.assertEqual(retry.write_orders, [])
                self.assertEqual(len(stopped_issues(retry)), 1)
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
