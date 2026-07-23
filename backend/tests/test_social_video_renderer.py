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
                publish_time_jst="20:30",
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
                long_dir / "001_11r_ai.png",
                long_dir / "002_11r_position.png",
                long_dir / "999_outro.png",
            ]:
                Image.new("RGB", (1920, 1080), "white").save(path)
            for path in [
                short_dir / "000_intro_00.png",
                short_dir / "000_intro_06.png",
                short_dir / "001_race_03.png",
                short_dir / "002_position.png",
                short_dir / "999_outro.png",
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

    def test_video_urls_use_exact_race_route_and_utm_content(self) -> None:
        url = build_video_url("2026-07-12", "venue_long_函館", "函館", 11)
        self.assertEqual(
            url,
            "https://uma-free.com/races/2026-07-12/hakodate/11"
            "?utm_source=youtube&utm_medium=video&utm_campaign=20260712_preview&utm_content=venue_long_%E5%87%BD%E9%A4%A8",
        )
        self.assertNotIn("?venue=", url)

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
        self.assertTrue(title.startswith("【宝塚記念】阪神 全レース"))

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

        with tempfile.TemporaryDirectory() as temp_dir, patch.object(
            renderer, "_draw_intro_sequence", return_value=[]
        ), patch.object(renderer, "_draw_venue_title_slide"), patch.object(
            renderer, "_draw_race_slide"
        ) as draw_race, patch.object(
            renderer, "_draw_position_slide"
        ) as draw_position, patch.object(
            renderer, "_draw_outro_slide"
        ), patch.object(
            renderer, "_draw_thumbnail"
        ) as draw_thumbnail, patch.object(
            renderer, "resolve_visual_asset", return_value=None
        ), patch.object(
            renderer, "resolve_audio_asset", return_value=None
        ), patch.object(
            renderer, "resolve_course_asset", return_value=None
        ):
            package = renderer.render_long_video(
                venue,
                "2026-07-12",
                Path(temp_dir),
                skip_video=True,
            )

        self.assertEqual([call.args[1].race_number for call in draw_race.call_args_list], [1, 2, 3])
        self.assertEqual([call.args[1].race_number for call in draw_position.call_args_list], [1, 2, 3])
        self.assertTrue(all(call.args[3] == (1920, 1080) for call in draw_race.call_args_list))
        self.assertTrue(all(call.args[3] == (1920, 1080) for call in draw_position.call_args_list))
        self.assertEqual(package.race_ids, ["race-1", "race-2", "race-3"])
        self.assertTrue(package.title.startswith("【函館】"))
        self.assertEqual(draw_thumbnail.call_args.args[1], "函館 全3R")

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


if __name__ == "__main__":
    unittest.main()
