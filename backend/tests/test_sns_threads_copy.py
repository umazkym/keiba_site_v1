"""Threads 用の的中・注目馬の文と、画像つきの投稿に付ける返信（2026-09-26 利用者の指定）。

- 的中・注目馬：改修前（〜9/24）の中身と雰囲気をもとに、絵文字をやめ、トーンを少し抑える。
- 重賞：本文は build_race_text のまま。返信は「重賞名（グレード）の全頭の分析」＋そのレースのページ。
- X には今までどおりの文（build_hit_text・build_pick_text）を送る。
"""
import json
import os
import sys
import unittest
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
from test_sns_design_renewal import EMOJI_PATTERN, day_fixture  # noqa: E402

DATE = "2026-09-20"
HIT = SC.HitCard(DATE, "中山", 12, "3歳以上1勝クラス", "3連単", "11→13→1", 716000)
HONMEI = {"total": 24, "win": 3, "second": 2, "third": 1, "other": 18}


def threads_body(text: str) -> str:
    """実際に Threads へ送る形（文字数の整え）を通した本文。"""
    return sns_poster.truncate_for_threads(
        sns_poster.prepare_short_social_text(text, "Threads", remove_urls=False, max_chars=sns_poster.THREADS_MAX_CHARS)
    )


class ThreadsCopyTest(unittest.TestCase):
    def assert_calm_copy(self, text: str, *, allowed_exclamations: int = 0) -> None:
        self.assertIsNone(EMOJI_PATTERN.search(text), text)
        self.assertEqual(SC.find_prohibited_phrases(text), [], text)
        self.assertEqual(text.count("！"), allowed_exclamations, text)
        self.assertLessEqual(len(text), sns_poster.THREADS_MAX_CHARS)

    def test_hit_text_follows_the_old_structure_without_emoji(self):
        text = SC.build_threads_hit_text(HIT, HONMEI, day_word="昨日")
        # 「！」は「高配当を的中しました！」の1か所だけ（2026-09-26 利用者の指定）
        self.assert_calm_copy(text, allowed_exclamations=1)
        self.assertTrue(text.startswith("昨日のAI的中速報（9月20日(日)）"))
        self.assertIn("【中山12R 3連単】\n716,000円の高配当を的中しました！", text)
        self.assertIn("昨日のAI本命(◎)の成績\n3-2-1-18（勝率12.5%・複勝率25.0%）", text)
        self.assertIn("▼レース結果とAIの印\nhttps://uma-free.com/races/2026-09-20", text)
        # 最初のハッシュタグ（Threads のトピック）は改修前と同じ #競馬
        self.assertTrue(text.splitlines()[-1].startswith("#競馬 #AI予想 #万馬券 #中山競馬"))

    def test_same_day_hit_says_today_and_skips_the_honmei_block(self):
        text = SC.build_threads_hit_text(HIT, day_word="本日")
        self.assert_calm_copy(text, allowed_exclamations=1)
        self.assertTrue(text.startswith("本日のAI的中速報"))
        self.assertNotIn("本命", text)

    def test_small_payout_uses_the_hit_tag(self):
        small = SC.HitCard(DATE, "園田", 9, "C2", "馬連", "4-2", 3400)
        self.assertIn("#的中", SC.build_threads_hit_text(small))
        self.assertNotIn("#万馬券", SC.build_threads_hit_text(small))

    def test_pick_text_follows_the_old_structure_without_emoji(self):
        pick = SC.find_best_pick(day_fixture(), DATE)
        text = SC.build_threads_pick_text(pick)
        self.assert_calm_copy(text)
        self.assertTrue(text.startswith("本日のAI注目馬（9月20日(日)）"))
        self.assertIn("AIが今日の全4レースで最も高く評価した1頭です", text)
        self.assertIn("【園田9R C2】\n◎ 4番 スマッシュヒット（AI偏差値 74.9）", text)
        self.assertIn("▼全レースの無料予測\nhttps://uma-free.com/races/2026-09-20", text)
        self.assertTrue(text.splitlines()[-1].startswith("#競馬 #AI予想 #地方競馬 #園田競馬"))

    def test_threads_formatting_keeps_the_link_and_blank_lines(self):
        for text in (
            SC.build_threads_hit_text(HIT, HONMEI),
            SC.build_threads_pick_text(SC.find_best_pick(day_fixture(), DATE)),
        ):
            body = threads_body(text)
            self.assertIn("https://uma-free.com/races/2026-09-20", body)
            self.assertIn("▼", body)
            self.assertIn("\n\n", body)

    def test_replies_carry_the_hook_and_the_race_page(self):
        day = day_fixture()
        grade = SC.find_grade_races(day, DATE)[0]
        pick = SC.find_best_pick(day, DATE)
        self.assertEqual(
            SC.build_threads_race_reply(grade),
            "オールカマー（G2）の全頭の分析\nhttps://uma-free.com/races/2026-09-20/nakayama/11",
        )
        self.assertEqual(
            SC.build_threads_hit_reply(HIT),
            "中山12R 3連単 716,000円の結果\nhttps://uma-free.com/races/2026-09-20/nakayama/12",
        )
        self.assertEqual(
            SC.build_threads_pick_reply(pick),
            "園田9R スマッシュヒット AI偏差値74.9の分析\nhttps://uma-free.com/races/2026-09-20/sonoda/9",
        )
        for reply in (SC.build_threads_race_reply(grade), SC.build_threads_hit_reply(HIT), SC.build_threads_pick_reply(pick)):
            self.assert_calm_copy(reply)

    def test_main_race_reply_names_the_venue_and_race(self):
        card = SC.RaceCard(DATE, "園田", 11, "園田特別", grade=None)
        self.assertEqual(
            SC.build_threads_race_reply(card),
            "園田11R 園田特別の全頭の分析\nhttps://uma-free.com/races/2026-09-20/sonoda/11",
        )

    def test_race_page_url_uses_the_site_venue_slugs(self):
        registry = json.loads(
            (BACKEND_DIR.parent / "frontend" / "lib" / "venue-slugs.json").read_text(encoding="utf-8")
        )["aliases"]
        for venue, slug in registry.items():
            self.assertEqual(SC.build_race_detail_url(DATE, venue, 11), f"https://uma-free.com/races/{DATE}/{slug}/11")
        self.assertEqual(SC.build_race_detail_url(DATE, "中山競馬場", 11), f"https://uma-free.com/races/{DATE}/nakayama/11")
        # 分からない場・レース番号が無いときは、その日のレース一覧へ戻す
        self.assertEqual(SC.build_race_detail_url(DATE, "存在しない場", 11), f"https://uma-free.com/races/{DATE}")
        self.assertEqual(SC.build_race_detail_url(DATE, "中山", None), f"https://uma-free.com/races/{DATE}")


class ThreadsPostRoutingTest(unittest.TestCase):
    def test_post_single_sends_threads_copy_and_reply_while_x_keeps_its_text(self):
        x_text = SC.build_hit_text(HIT)
        threads_text = SC.build_threads_hit_text(HIT, day_word="本日")
        reply = SC.build_threads_hit_reply(HIT)
        with (
            patch.object(sns_poster, "is_already_posted", return_value=False),
            patch.object(sns_poster, "post_to_twitter", return_value=sns_poster.TwitterPostResult(ok=True)) as post_x,
            patch.object(sns_poster, "post_to_threads", return_value=sns_poster.ThreadsPostResult(ok=True)) as post_threads,
            patch.object(sns_poster, "record_post_if_delivered") as record,
            patch.object(sns_poster, "ENABLE_TWITTER", False),
            patch.object(sns_poster, "ENABLE_THREADS", False),
            patch.object(sns_poster, "_log"),
        ):
            sns_poster.post_single(
                [], x_text, "hit_immediate", DATE,
                threads_image="image.png", threads_text=threads_text, threads_reply=reply,
            )
        self.assertEqual(post_x.call_args.args[0], x_text)
        self.assertEqual(post_threads.call_args.args, (threads_text, "image.png", reply))
        # 重複の判定と記録は X と同じ文で行う
        self.assertEqual(record.call_args.args[0], x_text)

    def test_explicit_reply_text_is_used_for_the_link_reply(self):
        sns_poster._threads_link_replies_sent = 0
        sent = {}

        class Response:
            def __init__(self, payload):
                self.status_code = 200
                self._payload = payload
                self.text = ""

            def json(self):
                return self._payload

        def fake_post(url, headers=None, data=None, timeout=None):
            if "reply_to_id" in (data or {}):
                sent.update(data)
            return Response({"id": "x"})

        reply = SC.build_threads_hit_reply(HIT)
        with (
            patch.object(sns_poster, "DRY_RUN", False),
            patch.object(sns_poster, "THREADS_LINK_REPLY_MAX_PER_RUN", 1),
            patch.object(sns_poster.requests, "post", side_effect=fake_post),
            patch.object(sns_poster.time, "sleep"),
            patch.object(sns_poster, "_log"),
        ):
            sns_poster._post_threads_link_reply("parent-1", SC.build_threads_hit_text(HIT), reply)
        self.assertEqual(sent["text"], reply)
        self.assertEqual(sent["reply_to_id"], "parent-1")


if __name__ == "__main__":
    unittest.main()
