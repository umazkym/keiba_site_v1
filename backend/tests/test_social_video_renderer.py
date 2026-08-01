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
from unittest.mock import Mock, patch

from PIL import Image


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.social_video import renderer
from scripts.social_video.create_design_contact_sheet import create_contact_sheet
from scripts import youtube_video_pipeline
from scripts.social_video.data_loader import (
    HorseVideoData,
    RaceVideoData,
    VenueVideoData,
    build_video_url,
    infer_waku_number,
    order_venues_for_publication,
    pick_shorts_targets,
)
from scripts.social_video import visual_assets
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
    def test_brand_logo_resolves_and_is_circularly_masked(self) -> None:
        logo_path = renderer._resolve_brand_logo_path()
        self.assertIsNotNone(logo_path)
        logo = renderer._load_brand_logo(str(logo_path), 64)
        self.assertEqual(logo.size, (64, 64))
        alpha = logo.getchannel("A")
        self.assertEqual(alpha.getpixel((0, 0)), 0)
        self.assertEqual(alpha.getpixel((32, 32)), 255)

    def test_intro_sequence_hides_first_score_and_never_counts_from_zero(self) -> None:
        race = _race()
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch.object(renderer, "_draw_intro_slide") as draw_intro:
                slides = renderer._draw_intro_sequence(
                    Path(temp_dir),
                    race.race_date,
                    race.display_name,
                    (1080, 1920),
                    hero_horse=race.predictions[0],
                    race_label="函館11R",
                    venue_name="函館",
                    race_number=11,
                )
        self.assertEqual(len(slides), 7)
        self.assertAlmostEqual(sum(slide.duration_seconds for slide in slides), 1.85)
        calls = draw_intro.call_args_list
        self.assertFalse(calls[0].kwargs["show_score"])
        visible_scores = [call.kwargs["score_override"] for call in calls[1:]]
        self.assertGreaterEqual(min(visible_scores), 50.0)
        self.assertEqual(visible_scores[-1], race.predictions[0].deviation_score)

    def test_horse_number_badge_uses_site_circle_without_shadow(self) -> None:
        horse = _horse(12, "中団", 6)
        draw = Mock()
        renderer._draw_horse_number_badge(draw, (80, 64), horse, 48, stroke_width=2)
        draw.ellipse.assert_called_once_with((56, 40, 104, 88), fill=(22, 163, 74))
        draw.rounded_rectangle.assert_not_called()
        text_call = draw.text.call_args
        self.assertEqual(text_call.args[0], (80, 64))
        self.assertEqual(text_call.kwargs["anchor"], "mm")

    def test_waku_inference_matches_frontend_distribution(self) -> None:
        expected = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8]
        actual = [infer_waku_number(number, 18) for number in range(1, 19)]
        self.assertEqual(actual, expected)

    def test_unknown_position_is_not_merged_into_middle_group(self) -> None:
        race = _race()
        race.predictions[0].position_label = "-"
        groups = renderer._position_groups(race)
        self.assertIn(race.predictions[0], groups["-"])
        self.assertNotIn(race.predictions[0], groups["中団"])

    def test_position_slide_draws_all_18_horses_once(self) -> None:
        race = _race()
        race.predictions[-1].position_label = "-"
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "position.png"
            with patch.object(renderer, "_draw_position_token") as draw_token:
                renderer._draw_position_slide(output, race, race.race_date, (1080, 1920))
        numbers = [call.args[1].horse_number for call in draw_token.call_args_list]
        self.assertEqual(len(numbers), 18)
        self.assertEqual(sorted(numbers), list(range(1, 19)))

    def test_position_slide_orders_lanes_and_uses_one_column(self) -> None:
        race = _race()
        for horse in race.predictions:
            horse.position_label = "先行"
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "position-wide.png"
            with patch.object(renderer, "_draw_position_token") as draw_token, patch.object(renderer, "_draw_position_lane", wraps=renderer._draw_position_lane) as draw_lane:
                renderer._draw_position_slide(output, race, race.race_date, (1920, 1080))
        labels = [call.args[2] for call in draw_lane.call_args_list[:3]]
        self.assertEqual(labels, ["先行", "中団", "後方"])
        positions = [call.args[2] for call in draw_token.call_args_list]
        self.assertEqual(len({x for x, _ in positions}), 1)
        self.assertEqual([y for _, y in positions], sorted(y for _, y in positions))

    def test_new_templates_do_not_expose_internal_or_absolute_track_labels(self) -> None:
        source = "\n".join(
            inspect.getsource(function)
            for function in (
                renderer._draw_race_slide,
                renderer._draw_position_slide,
                renderer._draw_outro_slide,
            )
        )
        for forbidden in ("NEXT", "スタート", "ゴール"):
            self.assertNotIn(forbidden, source)

    def test_no_ellipsis_fit_keeps_full_horse_name_when_shrinking(self) -> None:
        image = Image.new("RGB", (320, 120), "white")
        draw = renderer.ImageDraw.Draw(image)
        horse_name = "ヴィクトリーノート"
        _, lines = renderer._fit_text_no_ellipsis(
            draw,
            horse_name,
            renderer.FONT_BOLD,
            28,
            12,
            150,
            max_lines=1,
        )
        self.assertEqual("".join(lines), horse_name)
        self.assertNotIn("...", "".join(lines))
        self.assertNotIn("…", "".join(lines))

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

    def test_missing_assets_generate_preview_but_block_publish(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "credits.json").write_text("{}\n", encoding="utf-8")
            output = root / "output"
            with patch.dict(
                os.environ,
                {
                    "SOCIAL_VIDEO_ASSET_ROOT": str(root),
                    "SOCIAL_VIDEO_ASSET_MANIFEST": str(root / "missing.json"),
                    "SOCIAL_VIDEO_BGM_PATH": "",
                },
                clear=False,
            ):
                rendered = renderer.render_short_video(_race(), "2026-07-12", output, index=1, skip_video=True)
            self.assertFalse(rendered.publishable)
            self.assertTrue(rendered.thumbnail_path.exists())
            self.assertIn("Shorts用の縦写真が見つかりません", rendered.publish_block_reasons)
            self.assertIn("Shorts用BGMが見つかりません", rendered.publish_block_reasons)
            self.assertFalse(rendered.thumbnail_required)
            metadata = json.loads(rendered.metadata_path.read_text(encoding="utf-8"))
            self.assertFalse(metadata["publishable"])
            self.assertEqual(metadata["selected_assets"]["brand_logo"]["type"], "brand_logo")
            self.assertEqual(metadata["race_number"], 11)
            self.assertTrue(metadata["destination_path"].endswith("/11"))
            self.assertIn("tiktok_clean", metadata["variant_video_paths"])
            self.assertTrue(rendered.vertical_cover_path.exists())

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

    def test_thumbnail_and_position_slides_have_expected_sizes(self) -> None:
        race = _race()
        hero = race.predictions[0]
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            thumbnail = root / "thumbnail.jpg"
            position_wide = root / "position-wide.png"
            position_vertical = root / "position-vertical.png"
            renderer._draw_thumbnail(
                thumbnail,
                race.display_name,
                "AI偏差値",
                race.race_date,
                (1920, 1080),
                hero_horse=hero,
                venue_name=race.venue_name,
                race_number=race.race_number,
                grade=race.grade or "",
            )
            renderer._draw_position_slide(position_wide, race, race.race_date, (1920, 1080))
            renderer._draw_position_slide(position_vertical, race, race.race_date, (1080, 1920))
            with Image.open(thumbnail) as image:
                self.assertEqual(image.size, (1920, 1080))
            self.assertLess(thumbnail.stat().st_size, 2 * 1024 * 1024)
            with Image.open(position_wide) as image:
                self.assertEqual(image.size, (1920, 1080))
            with Image.open(position_vertical) as image:
                self.assertEqual(image.size, (1080, 1920))

    def test_design_contact_sheet_contains_review_frames_and_small_thumbnail(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            date_root = root / "2026-07-12"
            long_dir = date_root / "long" / "venue_福島"
            short_dir = date_root / "shorts" / "short_test"
            long_dir.mkdir(parents=True)
            short_dir.mkdir(parents=True)
            (date_root / "summary.json").write_text("{}\n", encoding="utf-8")
            for path in [
                long_dir / "thumbnail.jpg",
                long_dir / "000_intro.png",
                long_dir / "002_11r_race.png",
                long_dir / "999_outro.png",
            ]:
                Image.new("RGB", (1920, 1080), "white").save(path)
            for path in [
                short_dir / "000_intro.png",
                short_dir / "001_race.png",
                short_dir / "002_position_preview.png",
                short_dir / "003_hero_preview.png",
                short_dir / "999_outro_preview.png",
            ]:
                Image.new("RGB", (1080, 1920), "white").save(path)
            destination = date_root / "design-contact-sheet.png"
            create_contact_sheet(date_root, destination)
            self.assertTrue(destination.exists())
            with Image.open(destination) as image:
                self.assertGreater(image.width, 2000)
                self.assertGreater(image.height, 1000)
            with Image.open(date_root / "thumbnail_246x138.png") as image:
                self.assertEqual(image.size, (246, 138))
            with Image.open(date_root / "shorts-ui-overlay.png") as image:
                self.assertEqual(image.size, (1080, 1920))

    def test_video_urls_use_the_same_site_root_without_utm(self) -> None:
        url = build_video_url("2026-07-12", "venue_long_函館", "函館", 11)
        self.assertEqual(url, "https://uma-free.com")
        self.assertNotIn("utm_", url)

    def test_video_description_has_one_site_link_without_date_or_credit(self) -> None:
        description = renderer._description(
            "テスト動画",
            "https://uma-free.com",
            "函館",
            excluded_race_labels=("5R 2歳新馬",),
        )

        self.assertEqual(description.splitlines()[0], "https://uma-free.com")
        self.assertEqual(description.count("https://uma-free.com"), 1)
        self.assertNotIn("データ基準日", description)
        self.assertNotIn("素材クレジット", description)
        self.assertNotIn("DOVA-SYNDROME", description)
        self.assertIn("5R 2歳新馬", description)
        self.assertIn("AI偏差値の算出対象外となる新馬戦は収録していません", description)

    def test_video_description_can_list_an_excluded_obstacle_race(self) -> None:
        description = renderer._description(
            "テスト動画",
            "https://uma-free.com",
            "中京",
            excluded_race_labels=("9R 3歳以上障害未勝利",),
            excluded_race_intro="AI偏差値の算出対象外レース",
        )

        self.assertIn("9R 3歳以上障害未勝利", description)
        self.assertNotIn("算出対象外となる新馬戦", description)

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

    def test_long_title_prioritizes_grade_race_name(self) -> None:
        race = _race()
        race.race_name = "宝塚記念"
        race.grade = "G1"
        title = renderer._long_title(VenueVideoData("阪神", "中央", [race]), "2026-06-28")
        self.assertEqual(title, "6/28 阪神｜全1R AI予想｜宝塚記念開催｜2026")

    def test_long_title_does_not_expose_excluded_newcomer_detail(self) -> None:
        race = _race()
        race.grade = None
        newcomer = _race()
        newcomer.id = "newcomer"
        newcomer.race_number = 2
        newcomer.race_name = "2歳新馬"
        newcomer.predictions = []
        title = renderer._long_title(
            VenueVideoData("笠松", "地方", [race], excluded_races=[newcomer]),
            "2026-07-24",
        )
        self.assertEqual(title, "7/24 笠松｜全1R AI予想｜2026")
        self.assertNotIn("新馬", title)
        self.assertNotIn("対象", title)

    def test_long_title_keeps_mobile_essential_prefix_short_for_every_venue(self) -> None:
        venue_registry = json.loads(
            (renderer.PROJECT_ROOT / "frontend" / "lib" / "venue-slugs.json").read_text(
                encoding="utf-8"
            )
        )
        race = _race()
        races = [race] * 12
        for venue_name in venue_registry["aliases"]:
            with self.subTest(venue_name=venue_name):
                venue = VenueVideoData(venue_name, "地方", races)
                essential = renderer._long_title_essential(venue, "2026-12-31")
                title = renderer._long_title(venue, "2026-12-31")
                self.assertLessEqual(len(essential), 26)
                self.assertTrue(title.startswith(essential))
                self.assertIn(f"12/31 {venue_name}", essential)
                self.assertIn("全12R AI予想", essential)

    def test_short_title_starts_with_date_venue_and_single_race_scope(self) -> None:
        race = _race()
        race.venue_name = "川崎"
        race.race_number = 11
        race.race_name = "川崎記念"
        race.grade = "Jpn1"
        title = renderer._short_title(race, "2026-07-30")
        self.assertEqual(
            title,
            "7/30 川崎11R｜AI予想TOP3｜川崎記念｜2026 #Shorts",
        )
        self.assertNotIn("全レース", title)

    def test_long_ranking_slide_limits_rows_to_top_five(self) -> None:
        race = _race()
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "ranking.png"
            with patch.object(renderer, "_draw_ranking_row") as draw_row:
                renderer._draw_race_slide(output, race, race.race_date, (1920, 1080), "venue_long_test")
        self.assertEqual(draw_row.call_count, 4)

    def test_long_video_records_every_race_once_in_number_order(self) -> None:
        races = []
        for race_number in (1, 2, 3):
            race = _race()
            race.id = f"race-{race_number}"
            race.race_number = race_number
            race.race_name = f"{race_number}R"
            race.grade = None
            races.append(race)
        venue = VenueVideoData("函館", "中央", races)

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            dummy = root / "dummy.png"
            Image.new("RGB", (16, 9), "black").save(dummy)
            intro_scene = renderer.MotionScene(dummy, renderer.LONG_INTRO_SECONDS, dummy, scene_id="intro")
            outro_scene = renderer.MotionScene(dummy, renderer.LONG_OUTRO_SECONDS, dummy, scene_id="outro")

            def build_race_scene(
                _video_dir: Path,
                race: RaceVideoData,
                _target_date: str,
                _progress_index: int,
                _progress_total: int,
            ) -> renderer.MotionScene:
                return renderer.MotionScene(
                    dummy,
                    renderer.LONG_RACE_SCENE_SECONDS,
                    dummy,
                    scene_id=f"race-{race.race_number}",
                )

            with patch.object(
                renderer, "_build_intro_motion_scene", return_value=intro_scene
            ), patch.object(
                renderer, "_build_long_race_motion_scene", side_effect=build_race_scene
            ) as build_race, patch.object(
                renderer, "_build_outro_motion_scene", return_value=outro_scene
            ), patch.object(
            renderer, "_draw_thumbnail"
            ) as draw_thumbnail, patch.object(
                renderer, "resolve_visual_asset", return_value=None
            ), patch.object(
                renderer, "resolve_video_asset", return_value=None
            ), patch.object(
                renderer, "resolve_audio_asset", return_value=None
            ), patch.object(
                renderer, "resolve_sfx_assets", return_value={}
            ), patch.object(
                renderer, "resolve_course_asset", return_value=None
            ):
                package = renderer.render_long_video(
                    venue,
                    "2026-07-12",
                    root,
                    skip_video=True,
                )

        self.assertEqual([call.args[1].race_number for call in build_race.call_args_list], [1, 2, 3])
        self.assertEqual([call.args[3] for call in build_race.call_args_list], [1, 2, 3])
        self.assertTrue(all(call.args[4] == 3 for call in build_race.call_args_list))
        self.assertEqual(package.race_ids, ["race-1", "race-2", "race-3"])
        self.assertTrue(package.title.startswith("7/12 函館｜全3R AI予想"))
        self.assertEqual(draw_thumbnail.call_args.args[1], "函館 全3R")

    def test_long_race_scene_contains_top_three_and_all_position_tokens_once(self) -> None:
        race = _race()
        race.predictions[-1].position_label = "-"
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(
            renderer,
            "_draw_broadcast_position_lane_layer",
            wraps=renderer._draw_broadcast_position_lane_layer,
        ) as draw_lane, patch.object(
            renderer,
            "_draw_broadcast_rank_layer",
            wraps=renderer._draw_broadcast_rank_layer,
        ) as draw_rank:
            scene = renderer._build_long_race_motion_scene(
                Path(temp_dir),
                race,
                race.race_date,
                1,
                11,
            )
            self.assertTrue(scene.preview_path.exists())

        self.assertEqual(scene.duration_seconds, 6.0)
        self.assertEqual(draw_rank.call_count, 3)
        lane_horses = [
            horse.horse_number
            for call in draw_lane.call_args_list
            for horse in call.args[2]
        ]
        self.assertEqual(sorted(lane_horses), list(range(1, 19)))
        self.assertEqual(len(lane_horses), 18)
        self.assertEqual([call.args[1] for call in draw_lane.call_args_list], ["先行", "中団", "後方", "不明"])

    def test_position_lane_centers_one_and_two_rows_vertically(self) -> None:
        ranked_numbers: dict[int, int] = {}
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(
            renderer,
            "_draw_horse_number_badge",
        ) as draw_badge:
            renderer._draw_broadcast_position_lane_layer(
                Path(temp_dir) / "one-row.png",
                "先行",
                [_horse(index, "先行") for index in range(1, 7)],
                ranked_numbers,
            )
            one_row_centers = [call.args[1] for call in draw_badge.call_args_list]
            draw_badge.reset_mock()
            renderer._draw_broadcast_position_lane_layer(
                Path(temp_dir) / "two-rows.png",
                "中団",
                [_horse(index, "中団") for index in range(1, 10)],
                ranked_numbers,
            )
            two_row_centers = [call.args[1] for call in draw_badge.call_args_list]

        self.assertEqual({center[1] for center in one_row_centers}, {72})
        self.assertEqual({center[1] for center in two_row_centers}, {48, 96})
        self.assertEqual((one_row_centers[0][0] + one_row_centers[-1][0]) // 2, 409)
        first_two_row = [center for center in two_row_centers if center[1] == 48]
        second_two_row = [center for center in two_row_centers if center[1] == 96]
        self.assertEqual((first_two_row[0][0] + first_two_row[-1][0]) // 2, 409)
        self.assertEqual([center[0] for center in second_two_row], [409])

    def test_long_race_scene_keeps_detail_navigation_visible(self) -> None:
        race = _race()
        with tempfile.TemporaryDirectory() as temp_dir:
            scene = renderer._build_long_race_motion_scene(
                Path(temp_dir),
                race,
                race.race_date,
                1,
                11,
            )
            cta = next(layer for layer in scene.layers if layer.image_path.name.endswith("_cta.png"))
            with Image.open(cta.image_path) as image:
                cta_size = image.size
        self.assertLessEqual(cta.start_seconds, 0.35)
        self.assertEqual(cta.end_seconds, renderer.LONG_RACE_SCENE_SECONDS)
        self.assertEqual(cta_size, (renderer.LONG_CONTENT_WIDTH, 186))
        self.assertEqual(cta.x, renderer.LONG_CONTENT_LEFT)
        self.assertEqual(cta.x + cta_size[0], renderer.LONG_CONTENT_RIGHT)
        self.assertEqual(cta.y, renderer.LONG_CTA_Y)
        self.assertGreaterEqual(
            renderer.LONG_CTA_Y - renderer.LONG_DATA_PANEL_BOTTOM,
            24,
        )

    def test_access_cta_copy_is_unified_and_not_redundant(self) -> None:
        self.assertEqual(
            renderer.LONG_SITE_ACCESS_CTA,
            "その他の分析情報は概要欄のサイトから",
        )
        self.assertEqual(
            renderer.SHORT_SITE_ACCESS_CTA,
            "その他の分析情報はUMA-FREEで公開",
        )
        source = (
            inspect.getsource(renderer._draw_broadcast_cta_layer)
            + inspect.getsource(renderer._draw_outro_slide)
            + inspect.getsource(renderer._draw_short_analysis_footer)
        )
        self.assertNotIn("サイトへのアクセスは概要欄のリンクから", source)
        self.assertNotIn("サイトへのアクセスはプロフィールのリンクから", source)
        self.assertNotIn("このレースの詳細をチェック", source)
        self.assertNotIn("全レースに詳細4分析を掲載", source)
        self.assertNotIn("全レースに4つの詳細分析を掲載", source)

    def test_short_motion_scene_has_cover_at_zero_and_cta_until_end(self) -> None:
        race = _race()
        with tempfile.TemporaryDirectory() as temp_dir:
            scene = renderer._build_short_motion_scene(
                Path(temp_dir),
                race,
                race.race_date,
                race.predictions[0],
                None,
                None,
            )
            self.assertTrue(scene.preview_path.exists())
            cover = next(layer for layer in scene.layers if layer.image_path.name == "000_cover.png")
            cta = next(layer for layer in scene.layers if layer.image_path.name == "999_outro.png")
            analysis_footer = next(
                layer
                for layer in scene.layers
                if layer.image_path.name == "000_short_analysis_footer.png"
            )
            with Image.open(analysis_footer.image_path) as footer_image:
                footer_center_x = analysis_footer.x + footer_image.width // 2
            phase_names = {timing[0] for timing in renderer.SHORT_PHASE_TIMINGS}
            phase_layers = sorted(
                (
                    layer
                    for layer in scene.layers
                    if layer.image_path.name in phase_names
                ),
                key=lambda layer: layer.start_seconds,
            )
        self.assertEqual(scene.duration_seconds, 15.5)
        self.assertEqual(cover.start_seconds, 0.0)
        self.assertEqual(cta.end_seconds, 15.5)
        self.assertEqual(analysis_footer.start_seconds, 0.0)
        self.assertEqual(analysis_footer.end_seconds, 15.5)
        self.assertEqual(
            (analysis_footer.x, analysis_footer.y),
            (renderer.SHORT_COLUMN_X, renderer.SHORT_ANALYSIS_FOOTER_Y),
        )
        self.assertEqual(footer_center_x, 540)
        self.assertEqual(
            renderer.SHORT_COLUMN_X + renderer.SHORT_COLUMN_WIDTH,
            renderer.SHORT_COLUMN_RIGHT,
        )
        self.assertEqual(len(phase_layers), 5)
        for previous, current in zip(phase_layers, phase_layers[1:]):
            self.assertLessEqual(previous.end_seconds, current.start_seconds)
            self.assertIsNone(current.start_x)
            self.assertIsNone(current.start_y)

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

    def test_video_clip_renderer_does_not_use_zoompan(self) -> None:
        source = inspect.getsource(renderer._render_static_clip)
        self.assertNotIn("zoompan", source)
        self.assertEqual(renderer.KEN_BURNS_ZOOM_TO, 1.0)

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpegが必要です")
    def test_static_mode_mp4_contains_aac_audio(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            image_path = root / "slide.png"
            audio_path = root / "bgm.wav"
            output_path = root / "output.mp4"
            Image.new("RGB", (320, 180), "navy").save(image_path)
            with wave.open(str(audio_path), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(48000)
                wav.writeframes(b"\x00\x00" * 48000)
            audio_asset = AudioAsset(path=audio_path, title="テストBGM", volume=0.2)
            with patch.dict(os.environ, {"SOCIAL_VIDEO_DISABLE_MOTION": "1", "SOCIAL_VIDEO_BGM_PATH": ""}, clear=False):
                renderer.render_mp4([renderer.Slide(image_path, 1.2)], output_path, 320, 180, audio_asset=audio_asset)
            result = subprocess.run(
                [
                    shutil.which("ffprobe") or "ffprobe",
                    "-v",
                    "error",
                    "-select_streams",
                    "a:0",
                    "-show_entries",
                    "stream=codec_name,sample_rate",
                    "-of",
                    "json",
                    str(output_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            stream = json.loads(result.stdout)["streams"][0]
            self.assertEqual(stream["codec_name"], "aac")
            self.assertEqual(stream["sample_rate"], "48000")

    @unittest.skipUnless(shutil.which("ffmpeg"), "FFmpegが必要です")
    def test_motion_mode_removes_intermediate_clips(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            image_path = root / "slide.png"
            output_path = root / "output.mp4"
            Image.new("RGB", (320, 180), "navy").save(image_path)
            with patch.dict(os.environ, {"SOCIAL_VIDEO_DISABLE_MOTION": "0", "SOCIAL_VIDEO_BGM_PATH": ""}, clear=False):
                renderer.render_mp4([renderer.Slide(image_path, 0.4)], output_path, 320, 180)
            self.assertTrue(output_path.exists())
            self.assertFalse((root / ".output_motion").exists())

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
                    renderer.MotionLayer(
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

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpegとffprobeが必要です")
    def test_motion_mode_preserves_timeline_duration(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            slides = []
            for index, duration in enumerate((0.10, 0.10, 1.25, 5.0, 3.5)):
                image_path = root / f"slide-{index}.png"
                Image.new("RGB", (320, 180), (20 + index * 20, 30, 60)).save(image_path)
                slides.append(renderer.Slide(image_path, duration))
            output_path = root / "output.mp4"
            with patch.dict(os.environ, {"SOCIAL_VIDEO_DISABLE_MOTION": "0", "SOCIAL_VIDEO_BGM_PATH": ""}, clear=False):
                renderer.render_mp4(slides, output_path, 320, 180)

            result = subprocess.run(
                [
                    shutil.which("ffprobe") or "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(output_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            actual_duration = float(result.stdout.strip())
            expected_duration = renderer._timeline_duration(slides, use_crossfade=True)
            self.assertAlmostEqual(actual_duration, expected_duration, delta=0.20)

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
