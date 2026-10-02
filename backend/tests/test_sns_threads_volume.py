"""Threads の本数の見直し（2026-10-02 利用者の選択：案2）。

- 当日の的中速報：Threads へは払戻のいちばん高い1本だけ（X は3本のまま）。
- 重賞の無い晩：Threads に「明日のメインレース」を1本（X へは送らない）。
- 夜の Workflow が日付をまたいで始まっても、予定の日の回として扱う。
"""
import argparse
import os
import sys
import tempfile
import unittest
from contextlib import contextmanager
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

from scripts import instagram_carousel  # noqa: E402
from scripts import sns_content as SC  # noqa: E402
from scripts import sns_poster  # noqa: E402
from test_sns_design_renewal import EMOJI_PATTERN, _prediction, _race, day_fixture  # noqa: E402

DATE = "2026-09-20"
JST = timezone(timedelta(hours=9))


def _scored(count):
    return [_prediction(n, f"テスト馬{n}", 60.0 - n, "◎" if n == 1 else "") for n in range(1, count + 1)]


def _venue(name, races):
    return {"venue_name": name, "races": [_race(f"{name}-{number}", number, title, None, "ダート", 1400, predictions, venue=name) for number, title, predictions in races]}


def no_grade_day():
    """重賞の無い日。中央1場（11R と 12R）・地方2場（11R のある場と、9R までの場）。"""
    return {
        "jra": [_venue("中山", [(11, "初秋ステークス", _scored(5)), (12, "3歳以上1勝クラス", _scored(8))])],
        "nar": [
            _venue("園田", [(11, "園田特別", _scored(9)), (12, "C1", _scored(6))]),
            _venue("佐賀", [(8, "C2", _scored(4)), (9, "佐賀スプリント", _scored(7))]),
        ],
    }


class LateNightDateTest(unittest.TestCase):
    def test_runs_that_start_after_midnight_count_as_the_night_before(self):
        self.assertEqual(SC.evening_base_date(datetime(2026, 10, 2, 23, 27, tzinfo=JST)).isoformat(), "2026-10-02")
        self.assertEqual(SC.evening_base_date(datetime(2026, 10, 3, 0, 5, tzinfo=JST)).isoformat(), "2026-10-02")
        self.assertEqual(SC.evening_base_date(datetime(2026, 10, 3, 5, 59, tzinfo=JST)).isoformat(), "2026-10-02")
        self.assertEqual(SC.evening_base_date(datetime(2026, 10, 3, 6, 0, tzinfo=JST)).isoformat(), "2026-10-03")

    def test_only_the_night_post_types_are_shifted(self):
        late = datetime(2026, 10, 3, 3, 25, tzinfo=JST)
        with patch.object(sns_poster, "_log"):
            for post_type in ("evening", "hit_immediate"):
                self.assertEqual(sns_poster.posting_now(post_type, late).date().isoformat(), "2026-10-02", post_type)
            for post_type in ("morning", "afternoon", "pre_race"):
                self.assertEqual(sns_poster.posting_now(post_type, late), late, post_type)
            on_time = datetime(2026, 10, 2, 20, 0, tzinfo=JST)
            self.assertEqual(sns_poster.posting_now("evening", on_time), on_time)

    def test_carousel_targets_the_planned_tomorrow_after_midnight(self):
        seen = []

        class FakeDatetime(datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2026, 10, 3, 1, 30, tzinfo=tz)

        def fetch(target_date):
            seen.append(target_date)
            return {"jra": [], "nar": []}

        with tempfile.TemporaryDirectory() as tmp, patch.object(instagram_carousel, "datetime", FakeDatetime):
            args = argparse.Namespace(target_date=None, mode="validate", output_root=tmp)
            self.assertEqual(instagram_carousel.run(args, fetch=fetch), 0)
        self.assertEqual(seen, ["2026-10-03"])


class MainRaceChoiceTest(unittest.TestCase):
    def test_jra_11r_comes_first(self):
        card = SC.find_main_race(no_grade_day(), DATE)
        self.assertEqual((card.venue, card.race_number, card.race_name), ("中山", 11, "初秋ステークス"))

    def test_nar_only_day_prefers_the_venue_with_an_11r(self):
        day = no_grade_day()
        day["jra"] = []
        card = SC.find_main_race(day, DATE)
        self.assertEqual((card.venue, card.race_number), ("園田", 11))

    def test_venue_without_an_11r_uses_its_last_race(self):
        day = {"jra": [], "nar": no_grade_day()["nar"][1:]}
        card = SC.find_main_race(day, DATE)
        self.assertEqual((card.venue, card.race_number, card.race_name), ("佐賀", 9, "佐賀スプリント"))

    def test_more_runners_win_between_equal_candidates(self):
        day = {"jra": [], "nar": [_venue("園田", [(11, "園田特別", _scored(8))]), _venue("名古屋", [(11, "名古屋特別", _scored(12))])]}
        self.assertEqual(SC.find_main_race(day, DATE).venue, "名古屋")

    def test_races_without_enough_scores_are_left_out(self):
        day = {"jra": [_venue("中山", [(11, "初秋ステークス", _scored(2))])], "nar": [_venue("園田", [(11, "園田特別", _scored(3))])]}
        self.assertEqual(SC.find_main_race(day, DATE).venue, "園田")
        day["nar"] = []
        self.assertIsNone(SC.find_main_race(day, DATE))
        self.assertIsNone(SC.find_main_race(None, DATE))


@contextmanager
def routing(*, posted=(), x_enabled=True, threads_result=None):
    """post_single の先（X・Threads・記録・画像）を差しかえる。posted は「投稿済み」にする鍵。"""
    calls = {"x": [], "threads": [], "records": [], "checked": []}

    def already(content, post_type, target_date):
        calls["checked"].append(content)
        return content in posted

    def to_x(text, image=None, **kwargs):
        calls["x"].append(text)
        return sns_poster.TwitterPostResult(ok=True, posted_ids=["1"])

    def to_threads(text, image=None, reply=None):
        calls["threads"].append((text, image, reply))
        # 失敗の結果は偽として扱われるので、None かどうかで見分ける
        return sns_poster.ThreadsPostResult(ok=True) if threads_result is None else threads_result

    def record(content, post_type, target_date, x_result=None, threads_ok=False):
        if bool(x_result) or threads_ok:
            calls["records"].append((content, post_type, target_date))

    with (
        patch.object(sns_poster, "is_already_posted", side_effect=already),
        patch.object(sns_poster, "post_to_twitter", side_effect=to_x),
        patch.object(sns_poster, "post_to_threads", side_effect=to_threads),
        patch.object(sns_poster, "record_post_if_delivered", side_effect=record),
        patch.object(sns_poster, "render_threads_image", side_effect=lambda renderer, data, prefix, key, **kw: f"{prefix}.jpg"),
        patch.object(sns_poster, "render_sns_image", side_effect=lambda renderer, data, prefix, key, **kw: f"{prefix}.png"),
        patch.object(sns_poster, "ENABLE_TWITTER", x_enabled),
        patch.object(sns_poster, "ENABLE_THREADS", True),
        patch.object(sns_poster, "THREADS_EVENING_VIDEO_REPLACES_TEXT", False),
        patch.object(sns_poster, "THREADS_EVENING_MAIN_RACE", True),
        patch.object(sns_poster, "_log"),
    ):
        yield calls


class EveningMainRaceTest(unittest.TestCase):
    def test_no_grade_night_posts_one_main_race_to_threads_only(self):
        failures = []
        with routing() as calls:
            self.assertTrue(sns_poster.post_evening_main_race(failures, no_grade_day(), DATE))
        self.assertEqual(calls["x"], [])
        self.assertEqual(len(calls["threads"]), 1)
        text, image, reply = calls["threads"][0]
        self.assertTrue(text.startswith("9月20日(日)のメインレース 中山11R 初秋ステークス"), text)
        self.assertIn("https://uma-free.com/races/2026-09-20", text)
        self.assertEqual(image, "th_race.jpg")
        self.assertEqual(reply, "中山11R 初秋ステークスの全頭の分析\nhttps://uma-free.com/races/2026-09-20/nakayama/11")
        self.assertEqual(calls["records"], [("evening_main:2026-09-20", "evening_main", DATE)])
        # X へ送らない投稿は、X の失敗に数えない
        self.assertEqual(failures, [])
        for copy in (text, reply):
            self.assertIsNone(EMOJI_PATTERN.search(copy), copy)
            self.assertEqual(SC.find_prohibited_phrases(copy), [], copy)
            self.assertNotIn("！", copy)
            self.assertLessEqual(len(copy), sns_poster.THREADS_MAX_CHARS)

    def test_second_run_on_the_same_night_does_not_post_again(self):
        with routing(posted={"evening_main:2026-09-20"}) as calls:
            sns_poster.post_evening_main_race([], no_grade_day(), DATE)
        self.assertEqual(calls["checked"], ["evening_main:2026-09-20"])
        self.assertEqual(calls["threads"], [])
        self.assertEqual(calls["records"], [])

    def test_a_day_with_a_grade_race_never_gets_a_main_race_post(self):
        # 重賞はあるが、AI偏差値がまだそろっていない日（夜の重賞の投稿も出ない日）
        day = no_grade_day()
        day["jra"][0]["races"].append(_race("r-g3", 10, "テスト重賞", "G3", "芝", 1600, _scored(2)))
        self.assertEqual(SC.find_grade_races(day, DATE), [])
        with routing() as calls:
            self.assertFalse(sns_poster.post_evening_main_race([], day, DATE))
            self.assertFalse(sns_poster.post_evening_main_race([], day_fixture(), DATE))
        self.assertEqual(calls["threads"], [])

    def test_switches_and_missing_data_stop_the_post(self):
        with routing() as calls:
            with patch.object(sns_poster, "THREADS_EVENING_MAIN_RACE", False):
                self.assertFalse(sns_poster.post_evening_main_race([], no_grade_day(), DATE))
            with patch.object(sns_poster, "THREADS_EVENING_VIDEO_REPLACES_TEXT", True):
                self.assertFalse(sns_poster.post_evening_main_race([], no_grade_day(), DATE))
            self.assertFalse(sns_poster.post_evening_main_race([], None, DATE))
        self.assertEqual(calls["threads"], [])
        self.assertEqual(calls["x"], [])

    def test_threads_failure_is_counted_and_not_recorded(self):
        failures = []
        failed = sns_poster.ThreadsPostResult(ok=False, attempted=True, reason="Threads APIエラー(500)")
        with routing(threads_result=failed) as calls:
            sns_poster.post_evening_main_race(failures, no_grade_day(), DATE)
        self.assertEqual(failures, ["Threads: evening_main:中山11R"])
        self.assertEqual(calls["records"], [])


def run_main(post_type, api, *, now):
    """main() を、外へ出る所をすべて差しかえて動かす。api は get_api_data の代わり、now は始まった時刻（日本時間）。"""

    @contextmanager
    def lock(*args, **kwargs):
        yield True

    class FakeDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return now.astimezone(tz) if tz else now

    with (
        patch.object(sns_poster, "datetime", FakeDatetime),
        patch.object(sys, "argv", ["sns_poster.py", "--post-type", post_type]),
        patch.object(sns_poster, "twitter_credentials_ready", return_value=True),
        patch.object(sns_poster, "threads_credentials_ready", return_value=True),
        patch.object(sns_poster, "refresh_threads_token_if_needed"),
        patch.object(sns_poster, "database_lock", lock),
        patch.object(sns_poster, "get_api_data", side_effect=api),
        patch.object(sns_poster.time, "sleep"),
    ):
        sns_poster.main()


class HitImmediateThreadsLimitTest(unittest.TestCase):
    HITS = [
        {"race_id": f"r{rank}", "race_date": DATE, "venue_name": "中山", "race_number": 9 + rank, "race_name": "テスト",
         "bet_type": "3連単", "winning_numbers": "1→2→3", "payout": payout}
        for rank, payout in enumerate((716000, 47440, 12300, 11000), 1)
    ]

    def run_hits(self, limit):
        endpoints = []

        def api(endpoint):
            endpoints.append(endpoint)
            return self.HITS

        with routing() as calls, patch.object(sns_poster, "THREADS_HIT_IMMEDIATE_MAX", limit):
            # 当日（9/20）の回が、日付をまたいで 9/21 00:40 に始まった。的中は 9/20 の分を読む
            run_main("hit_immediate", api, now=datetime(2026, 9, 21, 0, 40, tzinfo=JST))
        self.assertEqual(endpoints, [f"hits/high-payouts/{DATE}"])
        return calls

    def test_threads_gets_only_the_highest_payout_while_x_keeps_three(self):
        calls = self.run_hits(1)
        self.assertEqual(len(calls["x"]), 3)
        self.assertEqual(len(calls["threads"]), 1)
        text, image, reply = calls["threads"][0]
        self.assertIn("716,000円", text)
        self.assertEqual(image, "th_hit.jpg")
        self.assertIn("/races/2026-09-20/nakayama/10", reply)
        self.assertEqual(len(calls["records"]), 3)

    def test_the_limit_can_be_put_back_to_three(self):
        self.assertEqual(len(self.run_hits(3)["threads"]), 3)

    def test_zero_sends_nothing_to_threads(self):
        calls = self.run_hits(0)
        self.assertEqual((len(calls["x"]), len(calls["threads"])), (3, 0))


class EveningRoutingTest(unittest.TestCase):
    def test_no_grade_night_asks_for_tomorrow_and_posts_the_main_race(self):
        endpoints = []

        def api(endpoint):
            endpoints.append(endpoint)
            return no_grade_day()

        with routing() as calls:
            # 予定の日（9/19）の夜の回が、日付をまたいで 9/20 01:10 に始まった。「明日」は 9/20 のまま
            run_main("evening", api, now=datetime(2026, 9, 20, 1, 10, tzinfo=JST))
        self.assertEqual(endpoints, [DATE])
        self.assertEqual(calls["x"], [])
        self.assertEqual(len(calls["threads"]), 1)
        self.assertTrue(calls["threads"][0][0].startswith("9月20日(日)のメインレース"))

    def test_grade_night_posts_the_grade_races_and_no_main_race(self):
        with routing() as calls:
            run_main("evening", lambda endpoint: day_fixture(), now=datetime(2026, 9, 19, 20, 0, tzinfo=JST))
        self.assertEqual(len(calls["x"]), 2)
        self.assertEqual(len(calls["threads"]), 2)
        for text, _image, _reply in calls["threads"]:
            self.assertTrue(text.startswith("9月20日(日)の重賞"), text)
            self.assertNotIn("メインレース", text)


if __name__ == "__main__":
    unittest.main()
