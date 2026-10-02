"""動画の場面（デザイン改修 2026-09 段階6）の検査。

ポートフォリオ「YouTube・縦動画」の構成、Shorts の安全な範囲、TikTok 用の版、
会場をまたいだ場面の取り違え（旧版の不具合）の再発を確かめる。
"""

import inspect
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts import brand_tokens as T  # noqa: E402
from scripts.social_video import brand_scenes as scenes  # noqa: E402
from scripts.social_video import renderer  # noqa: E402
from scripts.social_video.data_loader import HorseVideoData, RaceVideoData, VenueVideoData  # noqa: E402
from scripts.social_video.motion import MotionLayer, MotionScene, render_motion_scenes  # noqa: E402
from scripts.social_video.visual_assets import VideoAsset, resolve_visual_asset  # noqa: E402

LONG_NAME = "悠大が好きすぎて滅!三十路記念(3歳)"


def _horse(number: int, start: float | None, score: float | None = None, name: str | None = None) -> HorseVideoData:
    return HorseVideoData(
        horse_name=name or f"テストホース{number}",
        horse_number=number,
        waku_number=None,
        mark="◎" if number == 1 else "",
        deviation_score=72.0 - number if score is None else score,
        start_1c_indicator=start,
    )


def _race(
    race_id: str = "test-race",
    *,
    venue: str = "中山",
    number: int = 11,
    name: str = "オールカマー",
    grade: str | None = "G2",
    runners: int = 18,
    course_type: str = "芝",
) -> RaceVideoData:
    predictions = [_horse(n, float(n * 5 % 97)) for n in range(1, runners + 1)]
    predictions[0].horse_name = "エアポートライナー"  # 9文字の馬名
    return RaceVideoData(
        id=race_id,
        race_date="2026-09-20",
        venue_name=venue,
        race_number=number,
        race_name=name,
        course_type=course_type,
        distance=2200,
        grade=grade,
        predictions=predictions,
    )


def _layer(scene: MotionScene, suffix: str) -> MotionLayer:
    return next(layer for layer in scene.layers if layer.image_path.name.endswith(suffix))


class CourseGlyphTest(unittest.TestCase):
    def test_course_shapes_cover_every_venue_and_bbox_is_left_top_right_bottom(self) -> None:
        shapes = scenes.course_shapes()
        self.assertEqual(len(shapes), 24)
        for name, shape in shapes.items():
            with self.subTest(venue=name):
                xs, ys = [], []
                for key in ("turf", "dirt"):
                    for polygon in scenes._subpaths(shape[key] or ""):
                        xs += [x for x, _ in polygon]
                        ys += [y for _, y in polygon]
                left, top, right, bottom = shape["bbox"]
                self.assertAlmostEqual(min(xs), left, delta=0.2)
                self.assertAlmostEqual(min(ys), top, delta=0.2)
                self.assertAlmostEqual(max(xs), right, delta=0.2)
                self.assertAlmostEqual(max(ys), bottom, delta=0.2)

    def test_course_glyph_fills_the_track_and_leaves_the_infield_empty(self) -> None:
        width, height = scenes.course_glyph_size("東京", 400, 400)
        canvas = scenes.VideoCanvas(round(width), round(height), transparent=True)
        scenes.course_glyph(canvas, "東京", 0, 0, width)
        with tempfile.TemporaryDirectory() as temp_dir:
            image = Image.open(canvas.save(Path(temp_dir) / "glyph.png"))
            alpha = image.getchannel("A")
            self.assertIsNotNone(alpha.getbbox())
            # 内側の芝生（コースの穴）は塗らない（塗りの規則 evenodd）
            self.assertEqual(alpha.getpixel((image.width // 2, image.height // 2)), 0)


class VideoCanvasTest(unittest.TestCase):
    def test_text_on_a_transparent_layer_keeps_its_color_at_the_edges(self) -> None:
        canvas = scenes.VideoCanvas(240, 80, transparent=True)
        canvas.text(10, 40, "全頭のデータ", "disp", 40, T.WHITE)
        with tempfile.TemporaryDirectory() as temp_dir:
            image = Image.open(canvas.save(Path(temp_dir) / "text.png")).convert("RGBA")
        edges = [pixel for pixel in image.getdata() if 0 < pixel[3] < 255]
        self.assertTrue(edges)
        # 縁が黒ずむと、夜の紺の上で文字が細く汚く見える
        self.assertGreater(min(min(pixel[:3]) for pixel in edges), 200)

    def test_translucent_fill_is_layered_over_what_is_below(self) -> None:
        canvas = scenes.VideoCanvas(40, 40, transparent=True)
        canvas.rect((0, 0, 40, 40), fill=T.NIGHT)
        canvas.rect((0, 0, 40, 40), fill=scenes.white(0.08))
        with tempfile.TemporaryDirectory() as temp_dir:
            pixel = Image.open(canvas.save(Path(temp_dir) / "fill.png")).convert("RGBA").getpixel((20, 20))
        self.assertEqual(pixel[3], 255)
        self.assertGreater(pixel[0], T.NIGHT[0])
        self.assertLess(pixel[0], 60)


class LanesTest(unittest.TestCase):
    def test_every_horse_with_a_position_is_placed_once_and_the_rest_are_counted(self) -> None:
        race = _race()
        race.predictions[4].start_1c_indicator = None
        race.predictions[9].start_1c_indicator = None
        plan = scenes.plan_lanes(scenes.race_card(race), 830, size=46, label_width=110)
        numbers = [row.number for _, placed, _, _ in plan.lanes for row, _, _ in placed]
        self.assertEqual([lane for lane, _, _, _ in plan.lanes], ["先行", "中団", "後方"])
        self.assertEqual(sorted(numbers), [n for n in range(1, 19) if n not in (5, 10)])
        self.assertEqual(plan.unknown, 2)

    def test_each_lane_is_ordered_by_number_and_centered(self) -> None:
        # サイトの展開予測と同じ：段ごとに馬番の小さい順に左から、段の中で横の中央（2026-09-26）
        race = _race(runners=12)
        for horse in race.predictions:
            horse.start_1c_indicator = float(100 - horse.horse_number * 7)
        plan = scenes.plan_lanes(scenes.race_card(race), 830, size=46, label_width=110)
        center = 110 + (830 - 2 * 110) / 2
        for _, placed, _, _ in plan.lanes:
            for slot in {row_slot for _, _, row_slot in placed}:
                row = sorted(((px, horse.number) for horse, px, row_slot in placed if row_slot == slot))
                numbers = [number for _, number in row]
                self.assertEqual(numbers, sorted(numbers))
                left, right = row[0][0], row[-1][0] + 46
                self.assertAlmostEqual((left + right) / 2, center, places=6)

    def test_crowded_lane_wraps_into_centered_rows(self) -> None:
        race = _race(runners=16)
        for horse in race.predictions:
            horse.start_1c_indicator = 50.0
        plan = scenes.plan_lanes(scenes.race_card(race), 830, size=46, label_width=110)
        _, placed, lane_height, rows = next(lane for lane in plan.lanes if lane[1])
        self.assertEqual(len(placed), 16)
        self.assertGreaterEqual(rows, 2)
        self.assertEqual(lane_height, rows * (46 + 8) + 16)
        for slot in range(rows):
            xs = sorted(px for _, px, row_slot in placed if row_slot == slot)
            self.assertTrue(all(b - a >= 46 + 4 for a, b in zip(xs, xs[1:])))
            self.assertGreaterEqual(xs[0], 110)
            self.assertLessEqual(xs[-1] + 46, 830 - 110)

    def test_stretched_lanes_fill_the_height_and_widen_crowded_lanes_more(self) -> None:
        race = _race(runners=10)
        for horse in race.predictions:
            horse.start_1c_indicator = 90.0 if horse.horse_number <= 6 else 10.0  # 中団に馬がいない
        plan = scenes.plan_lanes(scenes.race_card(race), 830, size=46, label_width=110)
        stretched = scenes.stretch_lanes(plan, 704)
        self.assertAlmostEqual(stretched.height, 704)
        self.assertAlmostEqual(6 + sum(height for _, _, height, _ in stretched.lanes) + scenes.lanes_footer_height(46), 704)
        heights = {lane: height for lane, _, height, _ in stretched.lanes}
        self.assertLess(heights["中団"], heights["先行"])

    def test_no_position_data_gives_no_lanes(self) -> None:
        race = _race(runners=8)
        for horse in race.predictions:
            horse.start_1c_indicator = None
        self.assertIsNone(scenes.plan_lanes(scenes.race_card(race), 830, size=46, label_width=110))


class LongSceneTest(unittest.TestCase):
    def test_race_scene_shows_the_header_at_once_then_five_rows_and_lanes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            scene = renderer._build_long_race_motion_scene(Path(temp_dir), _race(), "2026-09-20", 3, 11)
            with Image.open(scene.preview_path) as preview:
                self.assertEqual(preview.size, scenes.LONG_SIZE)
            header = _layer(scene, "_header.png")
            rows = [layer for layer in scene.layers if "_rank_" in layer.image_path.name]
            lanes = _layer(scene, "_lanes.png")
            progress = _layer(scene, "_progress.png")
        # レースの切り替えで白い面が空にならない
        self.assertEqual((header.start_seconds, header.enter_duration), (0.0, 0.0))
        self.assertEqual(len(rows), 5)
        self.assertTrue(all(row.start_seconds <= 0.35 for row in rows))
        self.assertLessEqual(lanes.start_seconds, 0.5)
        self.assertEqual(progress.reveal_duration, renderer.LONG_RACE_SCENE_SECONDS)
        self.assertEqual(scene.duration_seconds, renderer.LONG_RACE_SCENE_SECONDS)

    def test_race_scene_rows_and_lanes_share_top_and_bottom_edges(self) -> None:
        # 2026-09-25 の確認で「細かいレイアウトの位置ずれ」「余分がある」と指摘された点
        with tempfile.TemporaryDirectory() as temp_dir:
            scene = renderer._build_long_race_motion_scene(Path(temp_dir), _race(), "2026-09-20", 3, 11)
            rows = sorted((layer for layer in scene.layers if "_rank_" in layer.image_path.name), key=lambda layer: layer.y)
            lanes = _layer(scene, "_lanes.png")
            with Image.open(rows[-1].image_path) as image:
                rows_bottom = rows[-1].y + image.height
            with Image.open(lanes.image_path) as image:
                lanes_bottom = lanes.y + image.height
        self.assertEqual(rows[0].y, lanes.y)
        self.assertLessEqual(abs(rows_bottom - lanes_bottom), 2)
        self.assertGreater(rows_bottom, 930)  # 下の案内（984）の手前まで使う

    def test_race_scene_without_position_data_still_renders(self) -> None:
        race = _race(runners=6)
        for horse in race.predictions:
            horse.start_1c_indicator = None
        with tempfile.TemporaryDirectory() as temp_dir:
            scene = renderer._build_long_race_motion_scene(Path(temp_dir), race, "2026-09-20", 1, 1)
            self.assertTrue(_layer(scene, "_lanes.png").image_path.exists())
        self.assertEqual(len([layer for layer in scene.layers if "_rank_" in layer.image_path.name]), 5)

    def test_daily_long_scenes_never_share_files_across_venues(self) -> None:
        # 旧版は「会場の中の順番＋R番号」だけで名前を付け、後の会場の絵で前の会場の場面が上書きされていた
        venues = [
            VenueVideoData("中山", "中央", [_race("nakayama-1", number=1, grade=None), _race("nakayama-2", number=2, grade=None)]),
            VenueVideoData("阪神", "中央", [_race("hanshin-1", venue="阪神", number=1, grade=None), _race("hanshin-2", venue="阪神", number=2, grade=None)]),
        ]
        captured: list[MotionScene] = []
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(
            renderer, "render_motion_video", side_effect=lambda scene_list, *args, **kwargs: captured.extend(scene_list)
        ):
            renderer.render_daily_long_video(venues, "2026-09-20", Path(temp_dir))
            race_scenes = [scene for scene in captured if scene.scene_id.startswith("race-")]
            paths = [str(layer.image_path) for scene in race_scenes for layer in scene.layers]
            backgrounds = [str(scene.background_path) for scene in race_scenes]
        self.assertEqual(len(race_scenes), 4)
        self.assertEqual(len(set(backgrounds)), 4)
        self.assertEqual(len(set(paths)), len(paths))
        self.assertEqual(
            [scene.scene_id for scene in captured],
            ["000_intro", "chapter_01_中山", "race-1", "race-2", "chapter_02_阪神", "race-1", "race-2", "999_outro"],
        )

    def test_thumbnail_is_1280x720_and_features_the_highest_grade(self) -> None:
        g3 = _race("g3", grade="G3", venue="阪神")
        g1 = _race("g1", grade="G1", name="天皇賞（秋）", venue="東京")
        self.assertEqual(scenes.featured_for_thumbnail([g3, g1], g3).id, "g1")
        plain = _race("plain", grade=None)
        self.assertEqual(scenes.featured_for_thumbnail([plain], plain).id, "plain")
        with tempfile.TemporaryDirectory() as temp_dir:
            path = scenes.draw_thumbnail(
                Path(temp_dir) / "thumbnail.jpg",
                target_date="2026-11-01",
                headline="全45レース",
                accent="AI分析",
                featured=g1,
                asset=resolve_visual_asset("2026-11-01", "東京", 11, "wide", surface="turf"),
            )
            with Image.open(path) as image:
                self.assertEqual(image.size, scenes.THUMBNAIL_SIZE)
            self.assertLess(path.stat().st_size, 2 * 1024 * 1024)

    def test_thumbnail_grade_order_is_grade_then_jra_then_later_race(self) -> None:
        # サムネイルの主役と題名の先頭は、この並びの1つ目になる
        local_early = _race("local-4", grade="地方重賞", venue="佐賀", number=4, name="ロータスクラウン賞")
        local_late = _race("local-11", grade="地方重賞", venue="水沢", number=11, name="ヴィーナススプリント")
        jpn2 = _race("jpn2", grade="Jpn2", venue="船橋", number=11, name="日本テレビ盃")
        g1 = _race("g1", grade="G1", venue="中山", number=11, name="スプリンターズS")
        plain = _race("plain", grade=None, venue="阪神", number=12, name="3歳以上2勝クラス")
        ordered = scenes.graded_for_thumbnail([local_early, plain, local_late, jpn2, g1])
        self.assertEqual([race.id for race in ordered], ["g1", "jpn2", "local-11", "local-4"])
        self.assertEqual(scenes.graded_for_thumbnail([plain]), [])

    def test_grade_order_puts_the_highest_rank_first(self) -> None:
        # 重賞が複数ある日の主役は、序列（G1 → Jpn1 → G2 → Jpn2 → G3 → Jpn3 → そのほかの重賞）でいちばん上の1つ
        g1 = _race("g1", grade="G1", venue="東京", name="天皇賞（秋）")
        g2 = _race("g2", grade="G2", venue="京都", name="スワンS")
        g3 = _race("g3", grade="G3", venue="新潟", name="新潟記念")
        jpn1 = _race("jpn1", grade="Jpn1", venue="盛岡", number=12, name="マイルチャンピオンシップ南部杯")
        jpn2 = _race("jpn2", grade="Jpn2", venue="船橋", name="日本テレビ盃")
        jpn3 = _race("jpn3", grade="Jpn3", venue="門別", name="エーデルワイス賞")
        local = _race("local", grade="地方重賞", venue="金沢", number=12, name="見本トライアル")
        cases = {
            "G3 と G1": ([g3, g1], "g1"),
            "中央の G3 と地方の Jpn1": ([g3, jpn1], "jpn1"),
            "中央の G1 と地方の Jpn1": ([jpn1, g1], "g1"),
            "中央の G2 と地方の Jpn1": ([g2, jpn1], "jpn1"),
            "中央の G3 と地方の Jpn2": ([g3, jpn2], "jpn2"),
            "中央の G3 と地方の Jpn3": ([jpn3, g3], "g3"),
            "地方の Jpn3 と地方重賞": ([local, jpn3], "jpn3"),
        }
        for label, (races, expected) in cases.items():
            with self.subTest(label):
                self.assertEqual(scenes.featured_for_thumbnail(races, races[0]).id, expected)
                self.assertEqual(scenes.short_race_order(races)[0].id, expected)
        ordered = scenes.graded_for_thumbnail([local, jpn3, g3, jpn2, g2, jpn1, g1])
        self.assertEqual([race.id for race in ordered], ["g1", "jpn1", "g2", "jpn2", "g3", "jpn3", "local"])

    def test_grade_order_breaks_a_tie_by_jra_then_later_race_then_venue(self) -> None:
        # 同じ格が2つあるとき：中央が先 → R番号の大きい方（メインに近い方）→ 会場の並び
        early = _race("hanshin-10", grade="G3", venue="阪神", number=10, name="先のステークス")
        main = _race("nakayama-11", grade="G3", venue="中山", number=11, name="メインステークス")
        same_number = _race("hanshin-11", grade="G3", venue="阪神", number=11, name="同じ番号のステークス")
        self.assertEqual([race.id for race in scenes.graded_for_thumbnail([early, main])], ["nakayama-11", "hanshin-10"])
        self.assertEqual(
            [race.id for race in scenes.graded_for_thumbnail([main, early, same_number])],
            ["hanshin-11", "nakayama-11", "hanshin-10"],
        )
        # 地方重賞どうしは、名前の中のしるし（〔H1〕→〔H2〕→ しるし無し）が先に効く
        h2 = _race("h2", grade="地方重賞", venue="門別", number=12, name="見本スプリント〔H2〕")
        h1 = _race("h1", grade="地方重賞", venue="門別", number=11, name="サンライズカップ〔H1〕")
        unmarked = _race("unmarked", grade="地方重賞", venue="水沢", number=12, name="ヴィーナススプリント")
        self.assertEqual([race.id for race in scenes.graded_for_thumbnail([unmarked, h2, h1])], ["h1", "h2", "unmarked"])

    def test_short_race_order_keeps_non_grade_races_in_the_given_order(self) -> None:
        g3 = _race("g3", grade="G3", venue="新潟", name="新潟記念")
        g1 = _race("g1", grade="G1", venue="東京", name="天皇賞（秋）")
        first = _race("main-a", grade=None, venue="札幌", name="札幌日刊スポーツ杯")
        second = _race("main-b", grade=None, venue="小倉", name="小倉日経オープン")
        self.assertEqual([race.id for race in scenes.short_race_order([first, g3, second, g1])], ["g1", "g3", "main-a", "main-b"])
        # 重賞の無い日は、渡された順（各場のメイン）のまま
        self.assertEqual([race.id for race in scenes.short_race_order([second, first])], ["main-b", "main-a"])

    def test_thumbnail_name_parts_move_the_local_grade_to_the_badge(self) -> None:
        cases = {
            # 地方の格はバッジへ回して、名前を大きく出す
            ("サンライズカップ〔H1〕", "重賞"): ("サンライズカップ", "", "H1"),
            ("ネクストスター門別〔H1〕", None): ("ネクストスター門別", "", "H1"),
            # 格の値があるときは、その格を保つ
            ("サンライズカップ〔H1〕", "Jpn3"): ("サンライズカップ", "", "Jpn3"),
            # 末尾の括弧は消さず、小さく出す側へ分ける
            ("千葉ダートマイル(3上)", None): ("千葉ダートマイル", "(3上)", ""),
            ("天皇賞（秋）", "G1"): ("天皇賞", "（秋）", "G1"),
            (LONG_NAME, None): ("悠大が好きすぎて滅!三十路記念", "(3歳)", ""),
            ("スプリンターズS", "G1"): ("スプリンターズS", "", "G1"),
            # 括弧だけの名前は、名前を空にしない
            ("(3上)", None): ("(3上)", "", ""),
            ("", None): ("", "", ""),
        }
        for (name, grade), expected in cases.items():
            with self.subTest(name=name, grade=grade):
                self.assertEqual(scenes.thumbnail_name_parts(name, grade), expected)

    def test_thumbnail_name_stays_large_and_breaks_only_at_natural_points(self) -> None:
        c = scenes.VideoCanvas(*scenes.THUMBNAIL_SIZE)
        width = scenes.THUMBNAIL_TEXT_WIDTH
        # 短い名前は1行で最大の大きさ
        self.assertEqual(scenes.thumbnail_name_layout(c, "スプリンターズS", "", width), (["スプリンターズS"], scenes.THUMBNAIL_NAME_MAX))
        # 長い名前は、カタカナと漢字の境目・記号のあとで2行にする（1文字ずつの折り返しをしない）
        lines, size = scenes.thumbnail_name_layout(c, "マイルチャンピオンシップ南部杯", "", width)
        self.assertEqual(lines, ["マイルチャンピオンシップ", "南部杯"])
        self.assertGreaterEqual(size, scenes.THUMBNAIL_NAME_ONE_LINE_MIN)
        lines, size = scenes.thumbnail_name_layout(c, "悠大が好きすぎて滅!三十路記念", "(3歳)", width)
        self.assertEqual(lines, ["悠大が好きすぎて滅!", "三十路記念"])
        self.assertGreaterEqual(size, scenes.THUMBNAIL_NAME_ONE_LINE_MIN)
        # 「杯」「賞」などは前の語から離さない
        self.assertNotIn(5, scenes.thumbnail_name_breaks("サンライズ杯"))
        for name, note in (
            ("ネクストスター門別", ""),
            ("千葉ダートマイル", "(3上)"),
            ("オパール・フレアオープン", "(A)"),
            ("マイルチャンピオンシップ南部杯", ""),
            ("あ" * 40, ""),
        ):
            with self.subTest(name=name):
                lines, size = scenes.thumbnail_name_layout(c, name, note, width)
                self.assertLessEqual(len(lines), 2)
                self.assertGreaterEqual(size, scenes.THUMBNAIL_NAME_MIN)
                for index, line in enumerate(lines):
                    tail = 0.0
                    if note and index == len(lines) - 1:
                        tail = size * 0.1 + c.text_width(note, "bold", size * scenes.THUMBNAIL_NOTE_RATIO)
                    self.assertLessEqual(c.text_width(line, "brand", size) + tail, width + 0.5)

    def test_thumbnail_others_line_lists_what_fits_and_ends_with_hoka(self) -> None:
        c = scenes.VideoCanvas(*scenes.THUMBNAIL_SIZE)
        width = scenes.THUMBNAIL_TEXT_WIDTH
        others = [
            _race("o1", grade="地方重賞", venue="水沢", name="ヴィーナススプリント"),
            _race("o2", grade="地方重賞", venue="高知", name="珊瑚冠賞"),
            _race("o3", grade="地方重賞", venue="佐賀", name="ロータスクラウン賞"),
        ]
        text, size = scenes.thumbnail_others_line(c, others, width)
        self.assertTrue(text.startswith("ヴィーナススプリント"))
        self.assertTrue(text.endswith(" ほか"))
        self.assertGreaterEqual(size, scenes.THUMBNAIL_OTHERS_MIN)
        self.assertLessEqual(c.text_width(text, "brand", size), width + 0.5)
        # 1つだけなら「ほか」を付けない。地方の格の括弧は外す
        text, _ = scenes.thumbnail_others_line(c, [_race("o4", grade="地方重賞", venue="門別", name="サンライズカップ〔H1〕")], width)
        self.assertEqual(text, "サンライズカップ")
        self.assertEqual(scenes.thumbnail_others_line(c, [], width), ("", 0.0))

    def test_thumbnail_draws_other_grade_races_long_names_and_no_grade_days(self) -> None:
        cases = {
            "others": (
                _race("g1", grade="G1", name="スプリンターズS"),
                [
                    _race("o1", grade="地方重賞", venue="水沢", name="ヴィーナススプリント"),
                    _race("o2", grade="地方重賞", venue="高知", name="珊瑚冠賞"),
                ],
            ),
            "local-grade": (_race("h1", grade="地方重賞", venue="門別", number=12, name="ネクストスター門別〔H1〕"), []),
            "two-lines": (_race("long", grade="Jpn1", venue="盛岡", name="マイルチャンピオンシップ南部杯"), []),
            "long-name": (_race("long-name", grade=None, venue="笠松", name=LONG_NAME), []),
            "no-grade": (_race("plain", grade=None, venue="船橋", name="千葉ダートマイル(3上)"), []),
            "no-featured": (None, []),
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            for key, (featured, others) in cases.items():
                with self.subTest(case=key):
                    path = scenes.draw_thumbnail(
                        Path(temp_dir) / f"{key}.jpg",
                        target_date="2026-09-27",
                        headline="全52レース",
                        accent="AI分析",
                        featured=featured,
                        asset=resolve_visual_asset("2026-09-27", "中山", 11, "wide", surface="turf"),
                        others=others,
                    )
                    with Image.open(path) as image:
                        self.assertEqual(image.size, scenes.THUMBNAIL_SIZE)
                    self.assertLess(path.stat().st_size, 2 * 1024 * 1024)


class ShortSceneTest(unittest.TestCase):
    def test_phases_follow_the_portfolio_timing(self) -> None:
        self.assertEqual(
            scenes.short_phase_windows(15.5, include_closing=True, has_lanes=True),
            [("cover", 0.0, 1.2), ("top5", 1.2, 5.0), ("lanes", 5.0, 12.0), ("closing", 12.0, 15.5)],
        )
        scaled = scenes.short_phase_windows(6.0, include_closing=False, has_lanes=True)
        self.assertEqual([name for name, _, _ in scaled], ["cover", "top5", "lanes"])
        self.assertAlmostEqual(scaled[0][2], 0.6)
        self.assertAlmostEqual(scaled[-1][2], 6.0)
        # 位置取りのデータが無いレースは、上位5頭を最後まで見せる
        self.assertEqual(
            scenes.short_phase_windows(12.0, include_closing=False, has_lanes=False),
            [("cover", 0.0, 1.2), ("top5", 1.2, 12.0)],
        )

    def test_cover_is_complete_on_the_first_frame_and_closing_lasts_to_the_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            scene = renderer._build_short_motion_scene(Path(temp_dir), _race(), "2026-09-20", None, None)
            cover = [layer for layer in scene.layers if layer.image_path.name.startswith("01")]
            closing = [layer for layer in scene.layers if layer.image_path.name.startswith("04")]
            with Image.open(scene.preview_path) as preview:
                self.assertEqual(preview.size, scenes.SHORT_SIZE)
            self.assertTrue((Path(temp_dir) / "000_intro.png").exists())
        self.assertEqual(scene.duration_seconds, renderer.SHORT_SCENE_SECONDS)
        self.assertTrue(cover and all(layer.start_seconds == 0.0 and layer.enter_duration == 0.0 for layer in cover))
        self.assertTrue(closing and all(layer.end_seconds == renderer.SHORT_SCENE_SECONDS for layer in closing))

    def test_every_phase_is_centered_on_the_screen(self) -> None:
        # 中身の固まりの左右の余白が同じで、場面が替わっても上下の中心が跳ばない
        for branded in (True, False):
            with self.subTest(branded=branded), tempfile.TemporaryDirectory() as temp_dir:
                scene = renderer._build_short_motion_scene(
                    Path(temp_dir), _race(), "2026-09-20", None, None, race_index=1, race_total=3, branded=branded
                )
                phases: dict[str, list[int]] = {}
                for layer in scene.layers:
                    key = layer.image_path.name[:2]
                    if key not in {"01", "02", "03", "04"}:
                        continue
                    with Image.open(layer.image_path) as image:
                        box = image.getchannel("A").getbbox()
                    edges = [layer.x + box[0], layer.y + box[1], layer.x + box[2], layer.y + box[3]]
                    current = phases.setdefault(key, edges)
                    phases[key] = [min(current[0], edges[0]), min(current[1], edges[1]), max(current[2], edges[2]), max(current[3], edges[3])]
                centers = []
                for left, top, right, bottom in phases.values():
                    self.assertLessEqual(abs(left - (1080 - right)), 2)
                    centers.append((top + bottom) / 2)
                self.assertLessEqual(max(centers) - min(centers), 12)

    def test_long_race_name_and_18_horses_stay_inside_the_safe_area(self) -> None:
        race = _race(name=LONG_NAME, grade=None)
        with tempfile.TemporaryDirectory() as temp_dir:
            # 範囲の外に出ると validate_short_layers が止める
            scene = renderer._build_short_motion_scene(
                Path(temp_dir), race, "2026-09-24", None, None, race_index=2, race_total=4
            )
            header = _layer(scene, "000_header.png")
            with Image.open(header.image_path) as image:
                # 長い名前は2行にする。2行でも、下の「上位5頭」が入る高さ（318px）までに収まる
                self.assertGreater(image.height, scenes.SHORT_NAME_TOP + scenes.SHORT_NAME_MIN * scenes.THUMBNAIL_NAME_PITCH * 2)
                self.assertLessEqual(image.height, 318)
        with self.assertRaises(ValueError):
            with tempfile.TemporaryDirectory() as temp_dir:
                wide = Path(temp_dir) / "010_wide.png"
                Image.new("RGBA", (400, 40), (255, 255, 255, 255)).save(wide)
                scenes.validate_short_layers([scenes.Placed(wide, 700, 800, 0.0, 1.0)])

    def test_header_shows_the_race_name_large_on_every_frame(self) -> None:
        # 縦の表紙（1本目の最初のコマ）でも、横のサムネイルと同じくレース名が主役。直す前は最大78px
        probe = scenes.VideoCanvas(1, 1, transparent=True)
        width = scenes.SHORT_NAME_WIDTH

        def name_of(race_name: str, grade: str | None) -> tuple[list[str], float, str, str]:
            return scenes.short_header_name(probe, scenes.race_card(_race(name=race_name, grade=grade)))

        # 短い名前は1行で大きく。末尾の括弧は小さく、格はしるしへ回す
        self.assertEqual(name_of("有馬記念", "G1"), (["有馬記念"], scenes.SHORT_NAME_MAX, "", "G1"))
        self.assertEqual(name_of("天皇賞（秋）", "G1"), (["天皇賞"], scenes.SHORT_NAME_MAX, "（秋）", "G1"))
        lines, size, note, badge = name_of("サンライズカップ〔H1〕", "地方重賞")
        self.assertEqual((lines, note, badge), (["サンライズカップ"], "", "H1"))
        self.assertGreaterEqual(size, 100)
        lines, size, _, _ = name_of("スプリンターズS", "G1")
        self.assertEqual(lines, ["スプリンターズS"])
        self.assertGreaterEqual(size, 100)
        self.assertLessEqual(probe.text_width(lines[0], "brand", size), width)
        # 長い名前は、自然な切れ目で2行（1文字ずつの折り返しをしない）
        lines, size, _, badge = name_of("マイルチャンピオンシップ南部杯", "Jpn1")
        self.assertEqual((lines, badge), (["マイルチャンピオンシップ", "南部杯"], "Jpn1"))
        self.assertGreaterEqual(size, scenes.SHORT_NAME_MIN)
        lines, size, note, _ = name_of(LONG_NAME, None)
        self.assertEqual((lines, note), (["悠大が好きすぎて滅!", "三十路記念"], "(3歳)"))
        self.assertGreater(size, 78)
        # 切れ目が無くて1行に入らない名前は、「…」で切らずに2行へ折り返す
        endless = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ"
        lines, size, _, _ = name_of(endless, None)
        self.assertEqual("".join(lines), endless)
        self.assertEqual(len(lines), 2)
        self.assertTrue(all(probe.text_width(line, "brand", size) <= width for line in lines))
        # 名前の無いレースは、会場とR番号を名前の代わりにする
        self.assertEqual(name_of("", None)[0], ["中山11R"])

    def test_header_with_a_large_name_leaves_room_for_every_phase(self) -> None:
        # 見出しが高くなっても、下の場面（18頭）が安全な範囲の中に収まり、上下の中央にそろう
        for race_name, grade in (("有馬記念", "G1"), ("マイルチャンピオンシップ南部杯", "Jpn1"), (LONG_NAME, "G3"), ("サンライズカップ〔H1〕", "地方重賞")):
            with self.subTest(race_name), tempfile.TemporaryDirectory() as temp_dir:
                # 1本だけの日の形（右上の「1 / 3」が無い）で、レース名と1段目の右端を測る
                scene = renderer._build_short_motion_scene(
                    Path(temp_dir), _race(name=race_name, grade=grade), "2026-09-24", None, None, race_index=1, race_total=1
                )
                header = _layer(scene, "000_header.png")
                with Image.open(header.image_path) as image:
                    box = image.getchannel("A").getbbox()
                    self.assertLessEqual(image.height, 318)
                # レース名の右端は、右の操作ボタンにかからない位置まで
                self.assertLessEqual(header.x + box[2], scenes.SHORT_SAFE_RIGHT)
                header_bottom = header.y + box[3]
                for layer in scene.layers:
                    if layer.image_path.name[:2] in {"01", "02", "03", "04"}:
                        self.assertGreater(layer.y, header_bottom)
                        with Image.open(layer.image_path) as image:
                            self.assertLessEqual(layer.y + image.getchannel("A").getbbox()[3], scenes.SHORT_CONTENT_BOTTOM)

    def test_tiktok_version_has_no_logo_guide_horse_or_site_copy(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            branded = renderer._build_short_motion_scene(Path(temp_dir) / "brand", _race(), "2026-09-20", None, None)
            clean = renderer._build_short_motion_scene(
                Path(temp_dir) / "clean", _race(), "2026-09-20", None, None, branded=False
            )
            names = {layer.image_path.name for layer in clean.layers}
            with Image.open(Path(temp_dir) / "brand" / "000_short_base.png") as image:
                branded_top = image.crop((80, 100, 420, 180)).convert("L").getextrema()
            with Image.open(Path(temp_dir) / "clean" / "000_short_base.png") as image:
                clean_top = image.crop((80, 100, 420, 180)).convert("L").getextrema()
        self.assertIn("040_closing_horse.png", {layer.image_path.name for layer in branded.layers})
        self.assertNotIn("040_closing_horse.png", names)
        self.assertGreater(branded_top[1], 200)  # ロゴの白い文字
        self.assertLess(clean_top[1], 120)
        source = inspect.getsource(scenes._short_closing)
        self.assertIn('("対戦成績と馬番の傾向も", "同じ基準で整理")', source)

    def test_video_background_gets_a_scrim_and_the_logo_on_top(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            video = VideoAsset(path=Path(temp_dir) / "broll.mp4")
            scene = renderer._build_short_motion_scene(Path(temp_dir), _race(), "2026-09-20", None, video)
        self.assertEqual(scene.background_path, video.path)
        names = [layer.image_path.name for layer in scene.layers]
        self.assertIn("000_video_scrim.png", names)
        self.assertIn("000_brand.png", names)


class CopyAndAssetsTest(unittest.TestCase):
    def test_scene_copy_avoids_prohibited_phrases_and_emoji(self) -> None:
        source = inspect.getsource(scenes)
        for phrase in ("推奨", "必勝", "絶対", "最強", "圧倒的", "投資", "おすすめ", "はこちら", "NEXT", "スタート", "ゴール", "枠順傾向"):
            self.assertNotIn(phrase, source)
        self.assertIsNone(re.search("[\U0001F300-\U0001FAFF☀-⛿]", source))

    def test_photos_are_chosen_race_then_venue_then_surface_then_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            for folder in ("images/default/vertical", "images/surfaces/dirt/vertical", "images/venues/大井/vertical"):
                (root / folder).mkdir(parents=True)
                Image.new("RGB", (1080, 1920), "gray").save(root / folder / "photo.jpg")
            (root / "credits.json").write_text("{}\n", encoding="utf-8")
            with patch.dict(os.environ, {"SOCIAL_VIDEO_ASSET_ROOT": str(root), "SOCIAL_VIDEO_ASSET_MANIFEST": str(root / "none.json")}):
                venue = resolve_visual_asset("2026-09-24", "大井", 11, "vertical", surface="dirt")
                surface = resolve_visual_asset("2026-09-24", "川崎", 11, "vertical", surface="dirt")
                default = resolve_visual_asset("2026-09-24", "川崎", 11, "vertical")
        self.assertEqual(venue.source, "folder:venue")
        self.assertEqual(surface.source, "folder:surface")
        self.assertEqual(default.source, "folder:default")

    def test_the_library_has_surface_photos_cleared_for_every_platform(self) -> None:
        for surface in ("turf", "dirt"):
            for orientation in ("wide", "vertical"):
                with self.subTest(surface=surface, orientation=orientation):
                    asset = resolve_visual_asset("2026-09-20", "テスト", None, orientation, surface=surface)
                    self.assertEqual(asset.source, "folder:surface")
                    self.assertIn(f"surfaces/{surface}/{orientation}/", asset.asset_id)
                    self.assertIn("tiktok", asset.allowed_platforms)
                    self.assertTrue(asset.license)

    def test_closing_icons_and_guide_horse_are_bundled(self) -> None:
        for name in ("guide-horse", "icon-gauge", "icon-swords", "icon-lanes", "icon-bars"):
            with self.subTest(name=name):
                image = scenes.video_asset(name)
                self.assertEqual(image.mode, "RGBA")
                self.assertEqual(image.getchannel("A").getpixel((0, 0)), 0)


@unittest.skipUnless(shutil.which("ffmpeg"), "FFmpegが必要です")
class RevealLayerTest(unittest.TestCase):
    def test_progress_bar_grows_from_the_left(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            Image.new("RGB", (320, 180), T.NIGHT).save(root / "bg.png")
            Image.new("RGBA", (300, 10), (*T.BRAND, 255)).save(root / "bar.png")
            scene = MotionScene(
                root / "bg.png",
                2.0,
                root / "bg.png",
                [MotionLayer(root / "bar.png", 10, 160, 0.0, 2.0, enter_duration=0.0, reveal_duration=2.0)],
            )
            render_motion_scenes([scene], root / "out.mp4", 320, 180, 30)
            widths = []
            for seconds in (0.5, 1.5):
                frame = root / f"frame-{seconds}.png"
                subprocess.run(
                    [shutil.which("ffmpeg"), "-y", "-loglevel", "error", "-ss", str(seconds), "-i", str(root / "out.mp4"), "-frames:v", "1", str(frame)],
                    check=True,
                )
                with Image.open(frame) as image:
                    rgb = image.convert("RGB")
                    lit = [x for x in range(320) if rgb.getpixel((x, 165))[2] > 150 and rgb.getpixel((x, 165))[0] > 50]
                widths.append((min(lit), max(lit)))
        self.assertEqual(widths[0][0], widths[1][0])  # 左端は動かない
        self.assertAlmostEqual(widths[0][1] - 10, 75, delta=12)
        self.assertAlmostEqual(widths[1][1] - 10, 225, delta=12)


if __name__ == "__main__":
    unittest.main()
