"""SNS投稿のデザイン改修（2026-09 段階4）：投稿文・Xの文字数・画像・Threadsの画像添付・夜の差し替え・Instagramカルーセル。"""

import argparse
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from PIL import Image

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from scripts import instagram_carousel  # noqa: E402
from scripts import sns_content as SC  # noqa: E402
from scripts import sns_images as SI  # noqa: E402
from scripts import sns_poster  # noqa: E402

# 以前の投稿文で使っていた絵文字と、絵文字の範囲
EMOJI_PATTERN = re.compile("[\U0001F000-\U0001FAFF⏰✅⚠️]")


def _prediction(number, name, score, mark="", indicator=None, waku=None):
    return {
        "horse_id": f"h{number}",
        "horse_name": name,
        "horse_number": number,
        "waku_number": waku,
        "deviation_score": score,
        "mark": mark,
        "start_1c_indicator": indicator,
    }


def _race(race_id, number, name, grade, course, distance, predictions, advantages=None, venue="中山", date="2026-09-20"):
    return {
        "id": race_id,
        "race_date": date,
        "venue_name": venue,
        "race_number": number,
        "race_name": name,
        "grade": grade,
        "course_type": course,
        "distance": distance,
        "predictions": predictions,
        "horse_number_advantages": advantages or [],
    }


def day_fixture():
    grade_predictions = [
        _prediction(6, "パンジャ", 62.0, "◎", 28.4),
        _prediction(12, "エセルフリーダ", 58.9, "○", 71.0),
        _prediction(1, "キャントウェイト", 58.3, "▲", 39.0),
        _prediction(9, "コスモキュランダ", 57.6, "△", 29.0),
        _prediction(4, "ヴーレヴー", 55.0, "☆", 58.0),
        _prediction(3, "ジューンテイク", 52.3, "", 80.0),
        _prediction(11, "セイウンプラチナ", None, "", None),
    ]
    advantages = [{"horse_number": n, "advantage_score": v} for n, v in ((1, 0.13), (3, -0.27), (6, 0.26), (12, 0.02))]
    return {
        "jra": [{
            "venue_name": "中山",
            "races": [
                _race("r-g2", 11, "オールカマー", "G2", "芝", 2200, grade_predictions, advantages),
                _race("r-g3", 10, "テスト特別", "G3", "ダート", 1800, grade_predictions[:5]),
            ],
        }],
        "nar": [{
            "venue_name": "園田",
            "races": [
                _race("r-sonoda9", 9, "C2", None, "ダート", 820, [
                    _prediction(4, "スマッシュヒット", 74.9, "◎", 50.0),
                    _prediction(2, "バフェ", 58.3, "○", 40.0),
                    _prediction(7, "ユナモンスター", 57.0, "▲", 30.0),
                ], venue="園田"),
                # AI偏差値の出ないレース（新馬戦など）も「全Nレース」の母数に入る
                _race("r-sonoda2", 2, "2歳新馬", None, "ダート", 820, [], venue="園田"),
            ],
        }],
    }


class SnsCopyTest(unittest.TestCase):
    def test_x_weighted_length_counts_japanese_twice_and_urls_as_23(self):
        self.assertEqual(SC.x_weighted_length("abc"), 3)
        self.assertEqual(SC.x_weighted_length("競馬"), 4)
        self.assertEqual(SC.x_weighted_length("a https://uma-free.com/races/2026-09-20"), 2 + 23)

    def test_best_pick_is_the_highest_score_among_all_races(self):
        pick = SC.find_best_pick(day_fixture(), "2026-09-20")
        self.assertEqual(pick.pick.name, "スマッシュヒット")
        self.assertEqual(pick.total_races, 4)
        self.assertEqual(pick.venues_label, "中央1場・地方1場")

    def test_grade_races_follow_the_api_grade_order(self):
        cards = SC.find_grade_races(day_fixture(), "2026-09-20")
        self.assertEqual([card.grade for card in cards], ["G2", "G3"])

    def test_position_labels_are_relative_within_the_race(self):
        card = SC.find_grade_races(day_fixture(), "2026-09-20")[0]
        labels = {row.number: row.position for row in card.rows}
        self.assertEqual(labels[3], "先行")
        self.assertEqual(labels[6], "後方")
        self.assertIsNone(labels[11])

    def test_copy_has_no_emoji_and_no_prohibited_words(self):
        day = day_fixture()
        pick = SC.find_best_pick(day, "2026-09-20")
        card = SC.find_grade_races(day, "2026-09-20")[0]
        hit = SC.HitCard("2026-09-20", "中山", 12, "3歳以上1勝クラス", "3連単", "11→13→1", 716000)
        texts = [
            SC.build_pick_text(pick),
            SC.build_race_text(card, "9月20日(日)の重賞"),
            SC.build_hit_text(hit, {"total": 24, "win": 3, "second": 2, "third": 1, "other": 18}),
            SC.build_day_summary_text("2026-09-20", day, hit),
            SC.build_carousel_caption(card),
        ]
        for text in texts:
            self.assertIsNone(EMOJI_PATTERN.search(text), text)
            self.assertEqual(SC.find_prohibited_phrases(text), [], text)
            self.assertNotIn("！", text)

    def test_hit_text_names_the_result_date_instead_of_yesterday(self):
        hit = SC.HitCard("2026-09-20", "中山", 12, "3歳以上1勝クラス", "3連単", "11→13→1", 716000)
        text = SC.build_hit_text(hit)
        self.assertIn("9月20日(日)の結果", text)
        self.assertNotIn("昨日", text)
        self.assertIn("#万馬券", text)

    def test_x_body_drops_the_link_label_and_fits_the_x_count(self):
        pick = SC.find_best_pick(day_fixture(), "2026-09-20")
        x_text = sns_poster.prepare_short_social_text(SC.build_pick_text(pick), "X")
        self.assertNotIn("https://", x_text)
        self.assertNotIn("全レースの分析", x_text)
        self.assertIn("スマッシュヒット", x_text)
        self.assertLessEqual(SC.x_weighted_length(x_text), 280)

    def test_long_japanese_text_is_cut_by_the_x_count(self):
        long_text = "\n".join(["園田の全レースのAI偏差値を公開しています"] * 12 + ["#園田競馬"])
        x_text = sns_poster.prepare_short_social_text(long_text, "X")
        self.assertLessEqual(SC.x_weighted_length(x_text), 280)
        threads_text = sns_poster.prepare_short_social_text(
            long_text, "Threads", remove_urls=False, max_chars=sns_poster.THREADS_MAX_CHARS
        )
        self.assertLessEqual(len(threads_text), sns_poster.THREADS_MAX_CHARS)


class SnsImageTest(unittest.TestCase):
    def test_every_template_renders_at_the_platform_size(self):
        day = day_fixture()
        pick = SC.find_best_pick(day, "2026-09-20")
        card = SC.find_grade_races(day, "2026-09-20")[0]
        hit = SC.HitCard("2026-09-20", "中山", 12, "3歳以上1勝クラス", "3連単", "11→13→1", 716000)
        other = SC.HitCard("2026-09-20", "中山", 12, "3歳以上1勝クラス", "馬単", "11→13", 47440)
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            expected = {
                SI.render_x_pick(pick, tmp_path / "x-pick.png"): (1200, 675),
                SI.render_x_hit(hit, tmp_path / "x-hit.png", [other]): (1200, 675),
                SI.render_x_race(card, tmp_path / "x-race.png"): (1200, 675),
                SI.render_threads_pick(pick, tmp_path / "th-pick.jpg"): (1080, 1350),
                SI.render_threads_hit(hit, tmp_path / "th-hit.jpg", [other]): (1080, 1350),
                SI.render_threads_race(card, tmp_path / "th-race.jpg"): (1080, 1350),
            }
            for path, size in expected.items():
                with Image.open(path) as image:
                    self.assertEqual(image.size, size, path)

    def test_carousel_skips_pages_without_data(self):
        day = day_fixture()
        full = SC.find_grade_races(day, "2026-09-20")[0]
        without_extra = SC.find_grade_races(day, "2026-09-20")[0]
        for row in without_extra.rows:
            row.position = None
        without_extra.advantages = []
        with tempfile.TemporaryDirectory() as tmp:
            pages = SI.render_carousel(full, Path(tmp) / "full")
            short = SI.render_carousel(without_extra, Path(tmp) / "short")
            self.assertEqual([Path(p).stem for p in pages], ["01-cover", "02-top5", "03-all", "04-lanes", "05-advantages", "06-closing"])
            self.assertEqual([Path(p).stem for p in short], ["01-cover", "02-top5", "03-all", "04-closing"])
            with Image.open(pages[0]) as image:
                self.assertEqual((image.size, image.format), ((1080, 1350), "JPEG"))


class FakeResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text or str(payload or "")

    def json(self):
        return self._payload


class ThreadsImageAndEveningTest(unittest.TestCase):
    def test_evening_video_replacement_skips_threads_but_keeps_x(self):
        x_result = sns_poster.TwitterPostResult(ok=True, posted_ids=["1"])
        failures = []
        with patch.object(sns_poster, "is_already_posted", return_value=False), \
                patch.object(sns_poster, "post_to_twitter", return_value=x_result) as post_x, \
                patch.object(sns_poster, "post_to_threads") as post_threads, \
                patch.object(sns_poster, "record_post_if_delivered") as record:
            sns_poster.post_single(failures, "本文", "evening_race", "2026-09-20", post_threads=False)
        post_x.assert_called_once()
        post_threads.assert_not_called()
        record.assert_called_once()
        self.assertEqual(failures, [])

    def test_rejected_image_falls_back_to_a_text_post(self):
        stager = Mock()
        stager.cleanup.return_value = []
        responses = [
            FakeResponse(400, {"error": {"message": "Invalid image", "code": 100}}),
            FakeResponse(200, {"id": "container-1"}),
            FakeResponse(200, {"id": "post-1"}),
        ]
        with patch.object(sns_poster, "THREADS_IMAGE_MODE", "public"), \
                patch.object(sns_poster, "ENABLE_THREADS", True), \
                patch.object(sns_poster, "DRY_RUN", False), \
                patch.object(sns_poster, "THREADS_USER_ID", "user"), \
                patch.object(sns_poster, "THREADS_ACCESS_TOKEN", "token"), \
                patch.object(sns_poster, "_stage_threads_image", return_value=(stager, "https://signed.example/image.jpg")), \
                patch.object(sns_poster.requests, "post", side_effect=responses) as post, \
                patch.object(sns_poster.time, "sleep"):
            result = sns_poster.post_to_threads("本文\n全レースの分析\nhttps://uma-free.com/races/2026-09-20", "image.jpg")
        self.assertTrue(result.ok)
        self.assertEqual(post.call_args_list[0].kwargs["data"]["media_type"], "IMAGE")
        self.assertEqual(post.call_args_list[1].kwargs["data"]["media_type"], "TEXT")
        stager.cleanup.assert_called_once()

    def test_images_are_not_attached_when_the_mode_is_off(self):
        with patch.object(sns_poster, "THREADS_IMAGE_MODE", "off"):
            self.assertEqual(sns_poster._stage_threads_image("image.jpg"), (None, None))


class InstagramCarouselTest(unittest.TestCase):
    def test_validate_mode_builds_pages_and_caption_without_posting(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = argparse.Namespace(target_date="2026-09-20", mode="validate", output_root=tmp)
            with patch.object(instagram_carousel, "publish_carousel") as publish:
                code = instagram_carousel.run(args, fetch=lambda _date: day_fixture())
            publish.assert_not_called()
            self.assertEqual(code, 0)
            caption = (Path(tmp) / "2026-09-20" / "caption.txt").read_text(encoding="utf-8")
            self.assertIn("オールカマー（G2）", caption)
            self.assertEqual(len(list((Path(tmp) / "2026-09-20").glob("*.jpg"))), 6)

    def test_no_grade_race_means_nothing_to_post(self):
        day = day_fixture()
        day["jra"] = []
        with tempfile.TemporaryDirectory() as tmp:
            args = argparse.Namespace(target_date="2026-09-20", mode="validate", output_root=tmp)
            self.assertEqual(instagram_carousel.run(args, fetch=lambda _date: day), 0)
            self.assertFalse((Path(tmp) / "2026-09-20").exists())

    def test_draft_mode_is_rejected(self):
        with self.assertRaises(RuntimeError):
            instagram_carousel.resolve_mode("draft")


if __name__ == "__main__":
    unittest.main()
