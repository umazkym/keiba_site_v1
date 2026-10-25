"""レース前の投稿と発走の時刻（2026-10-25 菊花賞の日の直し）。

- 直前の回（予定 14:00）が Workflow のおくれで 18:36 に動き、発走 15:40 のあとに出た
  → 発走の見積もりを過ぎた中央のレースは、朝・直前の投稿に使わない。地方は見積もれないので直前に選ばない。
- 朝の回が全レースの最上位の馬を選び、菊花賞を出さなかった
  → 中央の重賞がある日は、朝の1本をいちばん上の重賞のAI予想にする（利用者の決定）。
"""
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

TESTS_DIR = Path(__file__).resolve().parent
if str(TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(TESTS_DIR))

from scripts import sns_content as SC  # noqa: E402
from scripts import sns_poster  # noqa: E402
from test_sns_design_renewal import _prediction, _race, day_fixture  # noqa: E402
from test_sns_threads_volume import _scored, no_grade_day, routing, run_main  # noqa: E402

DATE = "2026-09-20"
KIKKA = "2026-10-25"
JST = timezone(timedelta(hours=9))


def at(hour, minute=0, day=DATE):
    year, month, date = (int(part) for part in day.split("-"))
    return datetime(year, month, date, hour, minute, tzinfo=JST)


def kikka_day():
    """10/25 の形：京都 11R 菊花賞（G1）、東京 11R に G3、地方に点のいちばん高い馬。"""
    return {
        "jra": [
            {"venue_name": "東京", "races": [
                _race("tokyo-1", 1, "2歳未勝利", None, "ダート", 1400, _scored(6), venue="東京", date=KIKKA),
                _race("tokyo-11", 11, "テストステークス", "G3", "芝", 1800, _scored(8), venue="東京", date=KIKKA),
            ]},
            {"venue_name": "京都", "races": [
                _race("kyoto-11", 11, "菊花賞", "G1", "芝", 3000, _scored(10), venue="京都", date=KIKKA),
            ]},
        ],
        "nar": [
            {"venue_name": "高知", "races": [
                _race("kochi-10", 10, "C3", None, "ダート", 1300, [
                    _prediction(3, "ポールセン", 80.1, "◎"),
                    _prediction(1, "テスト馬A", 60.0, "○"),
                    _prediction(2, "テスト馬B", 55.0, "▲"),
                ], venue="高知", date=KIKKA),
            ]},
        ],
    }


class StartEstimateTest(unittest.TestCase):
    def test_jra_race_counts_as_started_from_ten_minutes_before_the_estimate(self):
        card = SC.find_grade_races(kikka_day(), KIKKA)[0]
        self.assertEqual((card.venue, card.race_number), ("京都", 11))
        self.assertEqual(SC.estimated_start(card), at(14, 50, KIKKA))
        self.assertIs(SC.race_started(card, at(14, 0, KIKKA)), False)
        self.assertIs(SC.race_started(card, at(14, 39, KIKKA)), False)
        self.assertIs(SC.race_started(card, at(14, 41, KIKKA)), True)
        # 10/25 に直前の回が実際に動いた時刻
        self.assertIs(SC.race_started(card, at(18, 36, KIKKA)), True)
        # 次の日の朝は、前の日のレースを「発走後」と見る
        self.assertIs(SC.race_started(card, at(7, 0, "2026-10-26")), True)

    def test_utc_and_naive_times_are_read_as_the_same_moment(self):
        card = SC.find_grade_races(kikka_day(), KIKKA)[0]
        self.assertIs(SC.race_started(card, datetime(2026, 10, 25, 5, 0, tzinfo=timezone.utc)), False)  # 14:00 JST
        self.assertIs(SC.race_started(card, datetime(2026, 10, 25, 9, 36, tzinfo=timezone.utc)), True)  # 18:36 JST
        self.assertIs(SC.race_started(card, datetime(2026, 10, 25, 14, 0)), False)

    def test_nar_and_unknown_race_numbers_have_no_estimate(self):
        nar = next(card for card in SC.iter_race_cards(kikka_day(), KIKKA) if not card.is_jra)
        self.assertIsNone(SC.estimated_start(nar))
        self.assertIsNone(SC.race_started(nar, at(23, 0, KIKKA)))
        odd = SC.RaceCard(date=KIKKA, venue="東京", race_number=0, race_name="")
        self.assertIsNone(SC.race_started(odd, at(7, 0, KIKKA)))

    def test_estimates_rise_with_the_race_number(self):
        times = [SC.JRA_EARLIEST_START[number] for number in range(1, 13)]
        self.assertEqual(times, sorted(times))


class RaceChoiceTest(unittest.TestCase):
    def test_morning_picks_the_top_jra_grade_race_not_the_highest_horse(self):
        card = SC.find_morning_grade_race(kikka_day(), KIKKA, at(7, 0, KIKKA))
        self.assertEqual((card.venue, card.race_name, card.grade), ("京都", "菊花賞", "G1"))
        # 注目馬の選び方なら地方の馬になる（10/25 に起きたこと）
        self.assertEqual(SC.find_best_pick(kikka_day(), KIKKA).pick.name, "ポールセン")

    def test_a_started_grade_race_hands_over_to_the_next_one(self):
        day = day_fixture()  # 中山 11R G2・10R G3
        self.assertEqual(SC.find_morning_grade_race(day, DATE, at(7, 0)).race_name, "オールカマー")
        # 11R の G2 を外すと、まだ発走していない 10R の G3 を選ぶ
        day["jra"][0]["races"][0]["race_number"] = 9
        self.assertEqual(SC.find_morning_grade_race(day, DATE, at(13, 50)).race_name, "テスト特別")
        self.assertIsNone(SC.find_morning_grade_race(day, DATE, at(14, 10)))

    def test_nar_grade_races_do_not_replace_the_morning_pick(self):
        day = {"jra": [], "nar": [{"venue_name": "大井", "races": [
            _race("ooi-11", 11, "テスト記念", "S1", "ダート", 2000, _scored(8), venue="大井"),
        ]}]}
        self.assertTrue(SC.find_grade_races(day, DATE))
        self.assertIsNone(SC.find_morning_grade_race(day, DATE, at(7, 0)))
        self.assertIsNone(SC.find_pre_race_target(day, DATE, at(14, 0)))

    def test_pre_race_uses_the_grade_race_then_the_jra_11r_and_never_after_the_start(self):
        self.assertEqual(SC.find_pre_race_target(kikka_day(), KIKKA, at(14, 2, KIKKA)).race_name, "菊花賞")
        self.assertIsNone(SC.find_pre_race_target(kikka_day(), KIKKA, at(18, 36, KIKKA)))
        card = SC.find_pre_race_target(no_grade_day(), DATE, at(14, 0))
        self.assertEqual((card.venue, card.race_number), ("中山", 11))
        self.assertIsNone(SC.find_pre_race_target(no_grade_day(), DATE, at(16, 0)))
        # 地方の 11R は発走を見積もれないので選ばない
        self.assertIsNone(SC.find_pre_race_target({"jra": [], "nar": no_grade_day()["nar"]}, DATE, at(14, 0)))
        self.assertIsNone(SC.find_pre_race_target(None, DATE, at(14, 0)))

    def test_best_pick_skips_started_jra_races_and_keeps_nar(self):
        day = {"jra": [{"venue_name": "中山", "races": [
            _race("n-1", 1, "2歳未勝利", None, "ダート", 1200, [_prediction(1, "朝の馬", 79.0), _prediction(2, "二番手", 50.0)]),
            _race("n-11", 11, "テストステークス", None, "芝", 1600, [_prediction(1, "昼の馬", 70.0), _prediction(2, "二番手", 50.0)]),
        ]}], "nar": [{"venue_name": "園田", "races": [
            _race("s-9", 9, "C2", None, "ダート", 820, [_prediction(1, "地方の馬", 65.0)], venue="園田"),
        ]}]}
        self.assertEqual(SC.find_best_pick(day, DATE).pick.name, "朝の馬")
        pick = SC.find_best_pick(day, DATE, at(12, 0))
        self.assertEqual((pick.pick.name, pick.total_races), ("昼の馬", 2))
        pick = SC.find_best_pick(day, DATE, at(16, 0))
        self.assertEqual((pick.pick.name, pick.total_races), ("地方の馬", 1))


class MorningPostTest(unittest.TestCase):
    HIT = {"race_id": "r-hit", "race_date": "2026-09-19", "venue_name": "中山", "race_number": 12, "race_name": "テスト",
           "bet_type": "3連単", "winning_numbers": "1→2→3", "payout": 52300}

    def run_morning(self, day, *, hit=True, posted=()):
        def api(endpoint):
            if endpoint.startswith("hits/high-payouts/"):
                return [self.HIT] if hit else []
            return day if endpoint == DATE else None

        with (
            routing(posted=posted, x_enabled=False) as calls,
            patch.object(sns_poster, "summarize_honmei_results_from_db", return_value=None),
            patch.object(sns_poster, "summarize_honmei_results_from_api", return_value=None),
        ):
            run_main("morning", api, now=at(7, 2))
        return calls

    def test_grade_day_posts_yesterdays_hit_and_the_grade_race(self):
        calls = self.run_morning(day_fixture())
        self.assertEqual(len(calls["threads"]), 2)
        text, image, reply = calls["threads"][1]
        self.assertTrue(text.startswith("9月20日(日) 本日の重賞のAI予想 中山11R オールカマー（G2）"), text)
        self.assertEqual(image, "th_race.jpg")
        self.assertIn("https://uma-free.com/races/2026-09-20/nakayama/11", reply)
        self.assertLessEqual(len(text), sns_poster.THREADS_MAX_CHARS)
        self.assertEqual([record[1] for record in calls["records"]], ["morning_combined"])

    def test_grade_day_without_a_hit_posts_the_grade_race_alone(self):
        calls = self.run_morning(day_fixture(), hit=False)
        self.assertEqual(len(calls["threads"]), 1)
        self.assertTrue(calls["threads"][0][0].startswith("9月20日(日) 本日の重賞のAI予想 中山11R"))
        self.assertEqual([record[1] for record in calls["records"]], ["morning_race_only"])

    def test_day_without_a_jra_grade_race_keeps_the_ai_pick(self):
        calls = self.run_morning(no_grade_day(), hit=False)
        self.assertEqual(len(calls["threads"]), 1)
        self.assertEqual(calls["threads"][0][1], "th_pick.jpg")
        self.assertEqual([record[1] for record in calls["records"]], ["morning_pick_only"])

    def test_morning_and_pre_race_texts_differ_so_both_pass_the_duplicate_check(self):
        card = SC.find_morning_grade_race(day_fixture(), DATE, at(7, 0))
        morning = SC.build_race_text(card, f"{SC.date_label(DATE)} 本日の重賞のAI予想")
        pre_race = SC.build_race_text(card, f"{SC.date_label(DATE)} 本日の重賞")
        self.assertNotEqual(morning, pre_race)


class PreRacePostTest(unittest.TestCase):
    def run_pre_race(self, now):
        with routing(x_enabled=False) as calls:
            run_main("pre_race", lambda endpoint: day_fixture() if endpoint == DATE else None, now=now)
        return calls

    def test_on_time_run_posts_the_grade_race(self):
        calls = self.run_pre_race(at(14, 3))
        self.assertEqual(len(calls["threads"]), 1)
        self.assertTrue(calls["threads"][0][0].startswith("9月20日(日) 本日の重賞 中山11R オールカマー（G2）"))

    def test_late_run_after_the_start_posts_nothing(self):
        calls = self.run_pre_race(at(18, 36))
        self.assertEqual(calls["threads"], [])
        self.assertEqual(calls["records"], [])


if __name__ == "__main__":
    unittest.main()
