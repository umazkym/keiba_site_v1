import inspect
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.social_video import renderer
from scripts.social_video.create_design_contact_sheet import _collect_review_images, create_contact_sheet
from scripts import youtube_video_pipeline
from scripts.social_video.data_loader import (
    HorseVideoData,
    RaceVideoData,
    VenueVideoData,
    build_video_url,
    infer_waku_number,
    order_venues_for_daily_compilation,
    order_venues_for_publication,
    pick_daily_short_races,
    pick_shorts_targets,
)
from scripts.social_video import visual_assets
from scripts.social_video.motion import MotionLayer
from scripts.social_video.visual_assets import (
    AudioAsset,
    resolve_audio_asset,
    resolve_course_asset,
    resolve_sfx_assets,
    resolve_video_asset,
    resolve_visual_asset,
    validate_asset_library,
)


def _horse(index: int, position: str, waku_number: int | None = None) -> HorseVideoData:
    return HorseVideoData(
        horse_name=f"テストホース{index}",
        horse_number=index,
        waku_number=waku_number,
        mark="",
        deviation_score=72.0 - index,
        start_1c_indicator=float(index),
        position_label=position,
    )


def _race() -> RaceVideoData:
    labels = ["先行", "中団", "後方"]
    return RaceVideoData(
        id="test-race",
        race_date="2026-07-12",
        venue_name="函館",
        race_number=11,
        race_name="非常に長い名称を持つテスト用記念競走",
        course_type="芝",
        distance=2000,
        grade="G3",
        predictions=[_horse(index, labels[(index - 1) % 3], ((index - 1) % 8) + 1 if index != 18 else None) for index in range(1, 19)],
    )


class SocialVideoRendererTest(unittest.TestCase):
    def test_waku_inference_matches_frontend_distribution(self) -> None:
        expected = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8]
        actual = [infer_waku_number(number, 18) for number in range(1, 19)]
        self.assertEqual(actual, expected)

    def test_visual_asset_priority_is_race_then_venue_then_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            images = root / "images"
            images.mkdir()
            for name in ("default.jpg", "venue.jpg", "race.jpg"):
                Image.new("RGB", (1920, 1080), "white").save(images / name)
            manifest = root / "manifest.json"
            manifest.write_text(
                json.dumps(
                    {
                        "defaults": {"wide": "images/default.jpg"},
                        "venues": {"函館": {"wide": "images/venue.jpg"}},
                        "races": {"2026-07-12:函館:11": {"wide": "images/race.jpg", "focus": [0.7, 0.4]}},
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8-sig",
            )
            with patch.dict(os.environ, {"SOCIAL_VIDEO_ASSET_MANIFEST": str(manifest)}):
                asset = resolve_visual_asset("2026-07-12", "函館", 11, "wide")
            self.assertIsNotNone(asset)
            self.assertEqual(asset.path.name, "race.jpg")
            self.assertEqual(asset.focus, (0.7, 0.4))

    def test_folder_assets_use_priority_and_deterministic_selection(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            folders = [
                root / "images" / "default" / "wide",
                root / "images" / "venues" / "函館" / "wide",
                root / "images" / "races" / "2026-07-12" / "函館" / "11" / "wide",
            ]
            for folder in folders:
                folder.mkdir(parents=True)
            Image.new("RGB", (1920, 1080), "white").save(folders[0] / "default.jpg")
            Image.new("RGB", (1920, 1080), "green").save(folders[1] / "venue.jpg")
            Image.new("RGB", (1920, 1080), "red").save(folders[2] / "race-a.jpg")
            Image.new("RGB", (1920, 1080), "blue").save(folders[2] / "race-b.jpg")
            (root / "credits.json").write_text(
                json.dumps(
                    {
                        "images/races/2026-07-12/函館/11/wide/race-a.jpg": {
                            "credit": "撮影者A",
                            "focus": [0.6, 0.4],
                        }
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8-sig",
            )
            with patch.dict(
                os.environ,
                {"SOCIAL_VIDEO_ASSET_ROOT": str(root), "SOCIAL_VIDEO_ASSET_MANIFEST": str(root / "missing.json")},
                clear=False,
            ):
                first = resolve_visual_asset("2026-07-12", "函館", 11, "wide", selection_key="same-video")
                second = resolve_visual_asset("2026-07-12", "函館", 11, "wide", selection_key="same-video")
            self.assertIsNotNone(first)
            self.assertIsNotNone(second)
            self.assertEqual(first.path, second.path)
            self.assertIn(first.path.name, {"race-a.jpg", "race-b.jpg"})
            self.assertEqual(first.source, "folder:race")

    def test_audio_selection_prefers_video_type_then_common(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            long_dir = root / "audio" / "long"
            common_dir = root / "audio" / "common"
            shorts_dir = root / "audio" / "shorts"
            for folder in (long_dir, common_dir, shorts_dir):
                folder.mkdir(parents=True)
            (long_dir / "long.mp3").write_bytes(b"long")
            (common_dir / "common.mp3").write_bytes(b"common")
            (root / "credits.json").write_text(
                json.dumps({"audio/long/long.mp3": {"credit": "作曲者", "volume": 0.16}}, ensure_ascii=False),
                encoding="utf-8",
            )
            with patch.object(visual_assets, "_probe_audio", return_value=(True, 30.0, "")):
                with patch.dict(
                    os.environ,
                    {"SOCIAL_VIDEO_ASSET_ROOT": str(root), "SOCIAL_VIDEO_BGM_PATH": ""},
                    clear=False,
                ):
                    long_asset = resolve_audio_asset("2026-07-12", "venue_long", "venue-hakodate")
                    short_asset = resolve_audio_asset("2026-07-12", "short", "short-11")
            self.assertIsNotNone(long_asset)
            self.assertEqual(long_asset.path.name, "long.mp3")
            self.assertEqual(long_asset.credit, "作曲者")
            self.assertEqual(long_asset.volume, 0.16)
            self.assertIsNotNone(short_asset)
            self.assertEqual(short_asset.path.name, "common.mp3")

    def test_video_asset_selection_is_deterministic_and_local(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            folder = root / "video" / "default" / "wide"
            folder.mkdir(parents=True)
            (folder / "race-a.mp4").write_bytes(b"video-a")
            (folder / "race-b.mp4").write_bytes(b"video-b")
            (root / "credits.json").write_text(
                json.dumps(
                    {
                        "video/default/wide/race-a.mp4": {
                            "credit": "UMA-FREE",
                            "license": "商用利用・加工可",
                        },
                        "video/default/wide/race-b.mp4": {
                            "credit": "UMA-FREE",
                            "license": "商用利用・加工可",
                        },
                    }
                ),
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"SOCIAL_VIDEO_ASSET_ROOT": str(root)}, clear=False), patch.object(
                visual_assets,
                "_probe_video",
                return_value=(True, 10.0, (1920, 1080), ""),
            ):
                first = resolve_video_asset("2026-07-12", "函館", 11, "wide", "stable")
                second = resolve_video_asset("2026-07-12", "函館", 11, "wide", "stable")
            self.assertIsNotNone(first)
            self.assertEqual(first.path, second.path)
            self.assertIn(first.path.name, {"race-a.mp4", "race-b.mp4"})

    def test_sfx_selection_uses_cue_directories(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            folder = root / "audio" / "sfx" / "cta"
            folder.mkdir(parents=True)
            cue = folder / "cta.wav"
            cue.write_bytes(b"audio")
            (root / "credits.json").write_text(
                json.dumps(
                    {
                        "audio/sfx/cta/cta.wav": {
                            "title": "CTA",
                            "credit": "UMA-FREE",
                            "license": "商用利用可",
                            "volume": 0.12,
                        }
                    }
                ),
                encoding="utf-8",
            )
            with patch.object(visual_assets, "_probe_audio", return_value=(True, 0.5, "")):
                assets = resolve_sfx_assets("2026-07-12", "short", "stable", root)
            self.assertEqual(set(assets), {"cta"})
            self.assertEqual(assets["cta"].volume, 0.12)

    def test_course_asset_prefers_surface_specific_then_venue_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            folder = root / "courses" / "central"
            folder.mkdir(parents=True)
            Image.new("RGBA", (1038, 720), (0, 0, 0, 0)).save(folder / "hakodate.png")
            turf = Image.new("RGBA", (1038, 720), (0, 0, 0, 0))
            turf.putpixel((500, 300), (0, 128, 0, 255))
            turf.save(folder / "hakodate_turf.png")
            default = Image.open(folder / "hakodate.png")
            default.putpixel((500, 300), (128, 64, 0, 255))
            default.save(folder / "hakodate.png")
            turf_asset = resolve_course_asset("函館", "芝", root)
            dirt_asset = resolve_course_asset("函館", "ダート", root)
            self.assertIsNotNone(turf_asset)
            self.assertEqual(turf_asset.path.name, "hakodate_turf.png")
            self.assertIsNotNone(dirt_asset)
            self.assertEqual(dirt_asset.path.name, "hakodate.png")

    def test_course_asset_resolves_local_racecourse_texture(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            folder = root / "courses" / "local"
            folder.mkdir(parents=True)
            course = Image.new("RGBA", (1038, 720), (0, 0, 0, 0))
            course.putpixel((500, 300), (128, 64, 0, 255))
            course.save(folder / "ooi_course_texture.png")

            asset = resolve_course_asset("大井", "ダート", root)

            self.assertIsNotNone(asset)
            self.assertEqual(asset.path.name, "ooi_course_texture.png")
            self.assertEqual(asset.asset_id, "courses/local/ooi_course_texture.png")

    def test_upload_skips_only_unpublishable_video(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            blocked = renderer.RenderedVideo(
                video_type="short",
                stable_id="blocked-short",
                title="テスト",
                description="テスト",
                tags=[],
                video_path=root / "blocked.mp4",
                thumbnail_path=root / "thumbnail.png",
                metadata_path=root / "metadata.json",
                publish_offset_minutes=0,
                publishable=False,
                publish_block_reasons=["Shorts用BGMが見つかりません"],
            )
            args = SimpleNamespace(
                target_date="2026-07-12",
                skip_upload=False,
                dry_run=False,
                disable_registry=False,
                publication_mode="private_review",
                force=False,
                publish_time_jst="19:00",
                quota_budget=8000,
                processing_timeout_seconds=1,
                processing_poll_seconds=1,
            )
            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True):
                with patch.object(youtube_video_pipeline, "VideoPostRegistry"):
                    with patch.object(youtube_video_pipeline, "YouTubeClient") as client:
                        youtube_video_pipeline._upload_all(args, [blocked])
            client.return_value.upload_video.assert_not_called()

    def test_video_url_points_to_the_race_date_page_without_query(self) -> None:
        # 単発レースの動画も含め、着地先は日付ページに統一する。
        # /races/ 配下はクエリが1つでもあるとミドルウェアが301で落とすため、
        # 帰属パラメータを付けても届かない。
        self.assertEqual(
            build_video_url("2026-07-12"),
            "https://uma-free.com/races/2026-07-12",
        )

    def test_race_display_name_uses_the_shared_normalizer(self) -> None:
        # 整形規則そのものは tests/test_race_name.py で検証している。
        race = _race()
        race.race_name = "スパーキングサマーカップ【地方交重賞"
        self.assertEqual(race.display_name, "スパーキングサマーカップ")

    def test_video_url_falls_back_to_site_root_without_target_date(self) -> None:
        self.assertEqual(build_video_url(""), "https://uma-free.com")

    def test_daily_short_selection_prefers_highest_grade_then_main_race(self) -> None:
        g1 = _race()
        g1.id = "g1"
        g1.grade = "G1"
        g1.venue_name = "東京"
        g3 = _race()
        g3.id = "g3"
        g3.grade = "G3"
        g3.venue_name = "函館"
        venues = [
            VenueVideoData("函館", "中央", [g3]),
            VenueVideoData("東京", "中央", [g1]),
        ]
        selected = pick_shorts_targets(venues, 1)
        self.assertEqual([race.id for race in selected], ["g1"])
        self.assertEqual([venue.venue_name for venue in order_venues_for_publication(venues)], ["東京", "函館"])

    def test_daily_compilation_orders_central_venues_before_local_venues(self) -> None:
        race = _race()
        venues = [
            VenueVideoData("大井", "地方", [race]),
            VenueVideoData("東京", "中央", [race]),
            VenueVideoData("川崎", "地方", [race]),
            VenueVideoData("中京", "中央", [race]),
        ]

        ordered = order_venues_for_daily_compilation(venues)

        self.assertEqual([venue.race_type for venue in ordered], ["中央", "中央", "地方", "地方"])
        self.assertEqual({venue.venue_name for venue in ordered[:2]}, {"東京", "中京"})

    def test_daily_short_compilation_selects_every_grade_race(self) -> None:
        g1 = _race()
        g1.id = "g1"
        g1.grade = "G1"
        g1.venue_name = "東京"
        g3 = _race()
        g3.id = "g3"
        g3.grade = "G3"
        g3.venue_name = "函館"
        local_main = _race()
        local_main.id = "local-main"
        local_main.grade = None
        local_main.venue_name = "大井"
        venues = [
            VenueVideoData("大井", "地方", [local_main]),
            VenueVideoData("函館", "中央", [g3]),
            VenueVideoData("東京", "中央", [g1]),
        ]

        selected = pick_daily_short_races(venues)

        self.assertEqual([race.id for race in selected], ["g1", "g3"])

    def test_daily_short_compilation_uses_each_venue_main_race_without_grade(self) -> None:
        tokyo_10 = _race()
        tokyo_10.id = "tokyo-10"
        tokyo_10.grade = None
        tokyo_10.venue_name = "東京"
        tokyo_10.race_number = 10
        tokyo_11 = _race()
        tokyo_11.id = "tokyo-11"
        tokyo_11.grade = None
        tokyo_11.venue_name = "東京"
        local_10 = _race()
        local_10.id = "local-10"
        local_10.grade = None
        local_10.venue_name = "盛岡"
        local_10.race_number = 10

        selected = pick_daily_short_races(
            [
                VenueVideoData("盛岡", "地方", [local_10]),
                VenueVideoData("東京", "中央", [tokyo_10, tokyo_11]),
            ]
        )

        self.assertEqual([race.id for race in selected], ["tokyo-11", "local-10"])

    def test_daily_compilation_titles_and_description_include_search_intent(self) -> None:
        grade = _race()
        grade.id = "grade"
        grade.venue_name = "東京"
        grade.race_name = "天皇賞（秋）"
        grade.grade = "G1"
        local = _race()
        local.id = "local"
        local.venue_name = "大井"
        local.race_name = "大井11R"
        local.grade = None
        venues = [
            VenueVideoData("東京", "中央", [grade]),
            VenueVideoData("大井", "地方", [local]),
        ]

        long_title = renderer._daily_long_title(venues, "2026-11-01")
        short_title = renderer._daily_short_title([grade], "2026-11-01")
        description = renderer._daily_compilation_description(
            title=long_title,
            url="https://uma-free.com",
            venues=venues,
            target_date="2026-11-01",
            chapter_lines=renderer._finalize_chapter_lines(
                [
                    (0.0, "本日の全レースAI分析"),
                    (20.0, "中央競馬 東京 全1レース"),
                    (40.0, "地方競馬 大井 全1レース"),
                ],
                60.0,
            ),
        )

        self.assertIn("11/1(日)｜全2レースAI分析", long_title)
        self.assertIn("中央競馬・地方競馬予想", long_title)
        self.assertIn("天皇賞（秋）", long_title)
        # 「{競馬場名} 予想」で検索されるため、会場名もタイトルへ入れる
        self.assertIn("東京・大井", long_title)
        self.assertIn("11/1(日)｜東京 注目1レースAI分析", short_title)
        self.assertEqual(description.splitlines()[0], "https://uma-free.com")
        self.assertIn("【中央・地方競馬のAI分析をいつでも無料公開中】", description)
        self.assertIn("#競馬 #AI予想 #競馬予想", description)
        self.assertIn("チャプター", description)
        # 概要欄の冒頭はタイトルの丸写しではなく、検索語を含む文章にする
        self.assertNotIn(long_title, description)
        self.assertIn("2026年11月1日(日)", description)
        self.assertIn("天皇賞（秋）", description.splitlines()[2])

    def test_title_drops_whole_elements_instead_of_cutting_a_race_name(self) -> None:
        # 上限ぎりぎりで連結して末尾を切ると、重賞名が語の途中で切れて
        # 検索されない文字列になる。入らない要素は丸ごと落とす。
        long_name = "あ" * 75
        title = renderer._assemble_title(
            ["8/19(水)", "全48レースAI分析"],
            [long_name, "地方競馬予想", "2026年"],
        )

        self.assertLessEqual(len(title), renderer.YOUTUBE_TITLE_MAX_LENGTH)
        self.assertTrue(title.startswith("8/19(水)｜全48レースAI分析"))
        # 重賞名は原形のまま残る（語の途中で切れない）
        self.assertIn(long_name, title)
        # 入らない要素は落とすが、そこで打ち切らず後続の短い要素は拾う
        self.assertNotIn("地方競馬予想", title)
        self.assertTrue(title.endswith("｜2026年"))

    def test_title_keeps_every_element_when_they_all_fit(self) -> None:
        title = renderer._assemble_title(
            ["8/19(水)", "全48レースAI分析"],
            ["川崎・門別ほか", "スパーキングサマーカップ", "地方競馬予想", "2026年"],
        )

        self.assertEqual(
            title,
            "8/19(水)｜全48レースAI分析｜川崎・門別ほか｜スパーキングサマーカップ｜地方競馬予想｜2026年",
        )

    def test_venue_label_summarises_when_there_are_too_many_venues(self) -> None:
        self.assertEqual(renderer._venue_label(["川崎", "門別"]), "川崎・門別")
        self.assertEqual(
            renderer._venue_label(["川崎", "門別", "名古屋", "園田"]),
            "川崎・門別ほか",
        )
        self.assertEqual(renderer._venue_label(["川崎", "川崎"]), "川崎")
        self.assertEqual(renderer._venue_label([]), "")

    def test_tags_stay_within_youtube_count_and_character_limits(self) -> None:
        # タグはリスト全体で500文字を超えるとアップロードがinvalidTagsで落ちる。
        oversized = [f"{'あ' * 40}{index}" for index in range(30)]
        tags = renderer._dedupe_tags([*oversized, "競馬"])

        self.assertLessEqual(len(tags), renderer.YOUTUBE_TAG_COUNT_LIMIT)
        total = sum(len(tag) for tag in tags) + max(0, len(tags) - 1)
        self.assertLessEqual(total, renderer.YOUTUBE_TAG_TOTAL_LIMIT)
        # 予算を超えた長いタグを読み飛ばし、後ろの短いタグは残す
        self.assertIn("競馬", tags)

    def test_grade_race_tags_include_the_search_intent_combinations(self) -> None:
        race = _race()
        race.race_name = "スパーキングサマーカップ【地方交重賞"
        race.grade = "地方重賞"

        self.assertEqual(
            renderer._grade_race_intent_tags([race]),
            [
                "スパーキングサマーカップ",
                "スパーキングサマーカップ予想",
                "スパーキングサマーカップAI予想",
            ],
        )
        self.assertEqual(
            renderer._venue_intent_tags(["川崎"]),
            ["川崎", "川崎競馬", "川崎競馬予想"],
        )
        self.assertEqual(renderer._date_tag("2026-08-19"), "8月19日競馬")
        self.assertEqual(renderer._date_tag(""), "")

    def test_chapter_lines_meet_youtube_requirements_or_are_dropped(self) -> None:
        # 10秒未満の区間は直前のチャプターへ統合される
        merged = renderer._finalize_chapter_lines(
            [(0.0, "オープニング"), (2.2, "東京"), (76.2, "大井"), (150.0, "川崎")],
            220.0,
        )
        self.assertEqual(
            merged,
            [
                "00:00 オープニング / 東京",
                "01:16 大井",
                "02:30 川崎",
            ],
        )
        # 3件に満たない場合はリンク化されないので概要欄へ出さない
        self.assertEqual(
            renderer._finalize_chapter_lines([(0.0, "川崎11R"), (12.0, "門別12R")], 24.0),
            [],
        )
        # 末尾のチャプターが10秒未満のときも1つ前へ畳む
        self.assertEqual(
            renderer._finalize_chapter_lines(
                [(0.0, "A"), (20.0, "B"), (40.0, "C"), (60.0, "D")],
                63.0,
            ),
            ["00:00 A", "00:20 B", "00:40 C / D"],
        )

    def test_five_grade_short_is_capped_at_59_point_5_seconds(self) -> None:
        intermediate = renderer._daily_short_intermediate_duration(5)

        self.assertAlmostEqual(intermediate, 11.0)
        self.assertAlmostEqual(intermediate * 4 + renderer.SHORT_SCENE_SECONDS, 59.5)

    def test_daily_compilation_renderers_create_one_long_and_one_short_package(self) -> None:
        central = _race()
        central.id = "tokyo-grade"
        central.venue_name = "東京"
        central.race_name = "天皇賞（秋）"
        central.grade = "G1"
        local = _race()
        local.id = "ooi-main"
        local.venue_name = "大井"
        local.race_name = "東京大賞典"
        local.grade = "Jpn1"
        venues = order_venues_for_daily_compilation(
            [
                VenueVideoData("大井", "地方", [local]),
                VenueVideoData("東京", "中央", [central]),
            ]
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir)
            long_package = renderer.render_daily_long_video(
                venues,
                "2026-11-01",
                output,
                skip_video=True,
            )
            short_package = renderer.render_daily_short_video(
                [central, local],
                venues,
                "2026-11-01",
                output,
                skip_video=True,
            )

            self.assertEqual(long_package.video_type, "daily_long")
            self.assertEqual(long_package.stable_id, "daily_all")
            self.assertEqual(long_package.race_ids, ["tokyo-grade", "ooi-main"])
            self.assertTrue(long_package.thumbnail_path.is_file())
            self.assertIn("11/1(日) 全2レース AI分析", json.loads(
                long_package.metadata_path.read_text(encoding="utf-8")
            )["thumbnail_text"])
            self.assertEqual(short_package.video_type, "short")
            self.assertEqual(short_package.stable_id, "daily_short")
            self.assertEqual(short_package.race_ids, ["tokyo-grade", "ooi-main"])
            self.assertEqual(len(short_package.featured_races), 2)
            self.assertTrue(short_package.vertical_cover_path.is_file())

    def test_daily_long_omits_only_a_race_that_fails_preflight_rendering(self) -> None:
        broken = _race()
        broken.id = "broken-long"
        broken.race_number = 1
        broken.race_name = "描画失敗レース"
        healthy = _race()
        healthy.id = "healthy-long"
        healthy.race_number = 2
        venue = VenueVideoData("東京", "中央", [broken, healthy])
        original_builder = renderer._build_long_race_motion_scene

        def build_scene(*args, **kwargs):
            if args[1].id == "broken-long":
                raise ValueError("fixture render failure")
            return original_builder(*args, **kwargs)

        with tempfile.TemporaryDirectory() as temp_dir, patch.object(
            renderer,
            "_build_long_race_motion_scene",
            side_effect=build_scene,
        ):
            package = renderer.render_daily_long_video(
                [venue],
                "2026-11-01",
                Path(temp_dir),
                skip_video=True,
            )
            metadata = json.loads(package.metadata_path.read_text(encoding="utf-8"))

        self.assertEqual(package.race_ids, ["healthy-long"])
        self.assertEqual(metadata["render_omissions"][0]["race_id"], "broken-long")
        self.assertIn("描画失敗レース", package.description)

    def test_daily_short_omits_only_a_grade_race_that_fails_preflight_rendering(self) -> None:
        broken = _race()
        broken.id = "broken-short"
        broken.race_number = 10
        broken.race_name = "除外ステークス"
        broken.grade = "G3"
        healthy = _race()
        healthy.id = "healthy-short"
        healthy.race_number = 11
        healthy.race_name = "収録ステークス"
        healthy.grade = "G3"
        broken.venue_name = healthy.venue_name = "東京"
        venue = VenueVideoData("東京", "中央", [broken, healthy])
        original_builder = renderer._build_short_motion_scene

        def build_scene(*args, **kwargs):
            if args[1].id == "broken-short":
                raise ValueError("fixture render failure")
            return original_builder(*args, **kwargs)

        with tempfile.TemporaryDirectory() as temp_dir, patch.object(
            renderer,
            "_build_short_motion_scene",
            side_effect=build_scene,
        ):
            package = renderer.render_daily_short_video(
                [broken, healthy],
                [venue],
                "2026-11-01",
                Path(temp_dir),
                skip_video=True,
            )
            metadata = json.loads(package.metadata_path.read_text(encoding="utf-8"))

        self.assertEqual(package.race_ids, ["healthy-short"])
        self.assertEqual(metadata["render_omissions"][0]["race_id"], "broken-short")
        self.assertIn("11/1(日)｜東京 注目1レースAI分析", package.title)
        self.assertNotIn("全重賞", package.title)
        self.assertIn("除外ステークス", package.description)

    def test_brand_logo_metadata_points_to_the_drawn_logo(self) -> None:
        metadata = renderer._brand_logo_metadata()
        self.assertEqual(metadata["type"], "brand_logo")
        self.assertEqual(metadata["asset_id"], "backend/fonts/new-logo.png")
        self.assertTrue(Path(metadata["path"]).is_file())

    def test_missing_assets_still_render_but_block_publish(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "credits.json").write_text("{}\n", encoding="utf-8")
            race = _race()
            with patch.dict(
                os.environ,
                {
                    "SOCIAL_VIDEO_ASSET_ROOT": str(root),
                    "SOCIAL_VIDEO_ASSET_MANIFEST": str(root / "missing.json"),
                    "SOCIAL_VIDEO_BGM_PATH": "",
                },
                clear=False,
            ):
                rendered = renderer.render_daily_short_video(
                    [race], [VenueVideoData("函館", "中央", [race])], "2026-07-12", root / "output", skip_video=True
                )
            self.assertFalse(rendered.publishable)
            self.assertIn("日次Shorts用BGMが見つかりません", rendered.publish_block_reasons)
            self.assertTrue(rendered.thumbnail_path.exists())
            self.assertTrue(rendered.vertical_cover_path.exists())
            self.assertFalse(rendered.thumbnail_required)
            metadata = json.loads(rendered.metadata_path.read_text(encoding="utf-8"))
            self.assertFalse(metadata["publishable"])
            self.assertIn("函館11Rは紺の背景を使用", metadata["asset_warnings"])
            self.assertEqual(metadata["selected_assets"]["brand_logo"]["type"], "brand_logo")
            self.assertEqual(metadata["selected_assets"]["brand_design"]["type"], "brand_design")
            self.assertEqual(metadata["destination_path"], "/races/2026-07-12")
            self.assertIn("tiktok_clean", metadata["variant_video_paths"])
            self.assertEqual(metadata["design_system"], renderer.DESIGN_SYSTEM)

    def test_daily_description_has_one_site_link_and_lists_excluded_races(self) -> None:
        race = _race()
        newcomer = _race()
        newcomer.race_number = 5
        newcomer.race_name = "2歳新馬"
        obstacle = _race()
        obstacle.race_number = 9
        obstacle.race_name = "3歳以上障害未勝利"
        description = renderer._daily_compilation_description(
            title="テスト動画",
            url="https://uma-free.com/races/2026-07-12",
            venues=[VenueVideoData("函館", "中央", [race], excluded_races=[newcomer, obstacle])],
            target_date="2026-07-12",
        )

        self.assertEqual(description.splitlines()[0], "https://uma-free.com/races/2026-07-12")
        self.assertEqual(description.count("https://uma-free.com"), 1)
        self.assertNotIn("素材クレジット", description)
        self.assertNotIn("DOVA-SYNDROME", description)
        self.assertIn("函館5R 2歳新馬", description)
        self.assertIn("函館9R 3歳以上障害未勝利", description)
        self.assertIn("算出対象外・データ未掲載のレースは収録していません", description)

    def test_chapter_scope_says_how_many_races_are_included(self) -> None:
        race = _race()
        race.course_type = "ダ"
        excluded = _race()
        excluded.race_number = 1
        self.assertEqual(renderer._chapter_scope(VenueVideoData("園田", "地方", [race])), "全1レース · ダート")
        self.assertEqual(
            renderer._chapter_scope(VenueVideoData("園田", "地方", [race], excluded_races=[excluded])),
            "全2レース中1レースを収録 · ダート",
        )

    def test_design_contact_sheet_contains_review_frames_and_small_thumbnail(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            date_root = root / "2026-07-12"
            long_dir = date_root / "long" / "daily_all"
            short_dir = date_root / "shorts" / "daily_short"
            (short_dir / "race_02").mkdir(parents=True)
            (short_dir / "tiktok-clean" / "race_02").mkdir(parents=True)
            long_dir.mkdir(parents=True)
            (date_root / "summary.json").write_text("{}\n", encoding="utf-8")
            for path in [
                long_dir / "thumbnail.jpg",
                long_dir / "000_intro.png",
                long_dir / "chapter_01_福島.png",
                long_dir / "chapter_01_福島_base.png",
                long_dir / "01_01_11r_race.png",
                long_dir / "999_outro.png",
            ]:
                Image.new("RGB", (1920, 1080), "white").save(path)
            for path in [
                short_dir / "000_intro.png",
                short_dir / "001_top5.png",
                short_dir / "002_lanes.png",
                short_dir / "race_02" / "999_outro.png",
                short_dir / "tiktok-clean" / "race_02" / "999_outro.png",
            ]:
                Image.new("RGB", (1080, 1920), "white").save(path)
            destination = date_root / "design-contact-sheet.png"
            items = _collect_review_images(date_root, "v10 / ")
            chapter = next(path for label, path in items if label.endswith("競馬場の章"))
            create_contact_sheet(date_root, destination)
            self.assertTrue(destination.exists())
            with Image.open(date_root / "thumbnail_246x138.png") as image:
                self.assertEqual(image.size, (246, 138))
            with Image.open(date_root / "shorts-ui-overlay.png") as image:
                self.assertEqual(image.size, (1080, 1920))
        self.assertEqual(chapter.name, "chapter_01_福島.png")
        self.assertEqual(
            [label for label, _ in items],
            [
                "v10 / 長尺サムネイル",
                "v10 / 長尺導入",
                "v10 / 長尺競馬場の章",
                "v10 / 長尺レース",
                "v10 / 長尺締め",
                "v10 / Shorts表紙",
                "v10 / Shorts上位5頭",
                "v10 / Shorts位置取り",
                "v10 / Shorts締め",
                "v10 / TikTok用の締め",
            ],
        )

    def test_motion_renderer_does_not_use_zoompan(self) -> None:
        from scripts.social_video import motion

        self.assertNotIn("zoompan", inspect.getsource(motion))

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpegとffprobeが必要です")
    def test_motion_video_with_bgm_has_aac_audio_and_keeps_the_timeline(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            audio_path = root / "bgm.wav"
            with wave.open(str(audio_path), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(48000)
                wav.writeframes(b"\x00\x00" * 48000)
            scene_list = []
            for index, duration in enumerate((0.4, 1.2, 0.9)):
                background = root / f"scene-{index}.png"
                Image.new("RGB", (320, 180), (20 + index * 30, 30, 60)).save(background)
                scene_list.append(renderer.MotionScene(background, duration, background))
            output_path = root / "output.mp4"
            with patch.dict(os.environ, {"SOCIAL_VIDEO_BGM_PATH": ""}, clear=False):
                renderer.render_motion_video(
                    scene_list, output_path, 320, 180, audio_asset=AudioAsset(path=audio_path, title="テストBGM", volume=0.2)
                )
            result = subprocess.run(
                [
                    shutil.which("ffprobe") or "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "stream=codec_name,sample_rate:format=duration",
                    "-of",
                    "json",
                    str(output_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            probe = json.loads(result.stdout)
            self.assertFalse(output_path.with_suffix(".video.mp4").exists())
        audio = next(stream for stream in probe["streams"] if stream["codec_name"] == "aac")
        self.assertEqual(audio["sample_rate"], "48000")
        self.assertAlmostEqual(float(probe["format"]["duration"]), 2.5, delta=0.15)

    def test_motion_overlay_uses_end_exclusive_interval(self) -> None:
        from scripts.social_video import motion

        source = inspect.getsource(motion.render_motion_scene)
        self.assertIn("gte(t,", source)
        self.assertIn("*lt(t,", source)
        self.assertNotIn("between(t,", source)

    def test_motion_profile_rejects_unknown_value(self) -> None:
        with patch.dict(os.environ, {"SOCIAL_VIDEO_MOTION_PROFILE": "unknown"}, clear=False):
            with self.assertRaises(ValueError):
                renderer.resolve_motion_profile()

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpegとffprobeが必要です")
    def test_motion_scene_renders_h264_and_removes_scene_clips(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            background = root / "background.png"
            preview = root / "preview.png"
            layer = root / "layer.png"
            Image.new("RGB", (320, 180), "navy").save(background)
            Image.new("RGB", (320, 180), "navy").save(preview)
            Image.new("RGBA", (80, 40), (200, 155, 60, 255)).save(layer)
            scene = renderer.MotionScene(
                background,
                0.6,
                preview,
                layers=[
                    MotionLayer(
                        layer,
                        120,
                        70,
                        0.1,
                        0.6,
                        start_x=40,
                        end_x=120,
                    )
                ],
            )
            output = root / "motion.mp4"
            with patch.dict(
                os.environ,
                {"SOCIAL_VIDEO_MOTION_PROFILE": "standard", "SOCIAL_VIDEO_BGM_PATH": ""},
                clear=False,
            ):
                renderer.render_motion_video([scene], output, 320, 180)
            result = subprocess.run(
                [
                    shutil.which("ffprobe") or "ffprobe",
                    "-v",
                    "error",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=codec_name,width,height",
                    "-of",
                    "json",
                    str(output),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            stream = json.loads(result.stdout)["streams"][0]
            self.assertEqual(stream["codec_name"], "h264")
            self.assertEqual((stream["width"], stream["height"]), (320, 180))
            self.assertFalse((root / ".motion_motion").exists())

    def test_asset_validation_reports_required_materials(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "credits.json").write_text("{}\n", encoding="utf-8")
            report = validate_asset_library(root)
            self.assertFalse(report.default_wide_available)
            self.assertFalse(report.default_vertical_available)
            self.assertFalse(report.long_audio_available)
            self.assertFalse(report.shorts_audio_available)
            self.assertEqual(report.error_count, 0)

    def test_asset_validation_warns_about_wrong_orientation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            folder = root / "images" / "default" / "vertical"
            folder.mkdir(parents=True)
            Image.new("RGB", (800, 600), "white").save(folder / "landscape.jpg")
            (root / "credits.json").write_text("{}\n", encoding="utf-8")
            report = validate_asset_library(root)
            codes = {issue.code for issue in report.issues}
            self.assertIn("vertical_orientation_mismatch", codes)

    def test_asset_validation_rejects_image_without_rights_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            folder = root / "images" / "default" / "wide"
            folder.mkdir(parents=True)
            Image.new("RGB", (1920, 1080), "white").save(folder / "uncredited.jpg")
            (root / "credits.json").write_text("{}\n", encoding="utf-8")

            report = validate_asset_library(root)

            codes = {issue.code for issue in report.issues if issue.severity == "error"}
            self.assertIn("image_rights_metadata_missing", codes)

    def test_asset_validation_rejects_video_without_rights_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            folder = root / "video" / "default" / "wide"
            folder.mkdir(parents=True)
            (folder / "uncredited.mp4").write_bytes(b"video")
            (root / "credits.json").write_text("{}\n", encoding="utf-8")
            with patch.object(
                visual_assets,
                "_probe_video",
                return_value=(True, 10.0, (1920, 1080), ""),
            ):
                report = validate_asset_library(root)
            codes = {issue.code for issue in report.issues if issue.severity == "error"}
            self.assertIn("video_rights_metadata_missing", codes)


if __name__ == "__main__":
    unittest.main()
