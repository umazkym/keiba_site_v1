import inspect
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.social_video import renderer
from scripts.social_video.data_loader import HorseVideoData, RaceVideoData
from scripts.social_video.visual_assets import resolve_visual_asset


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
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"SOCIAL_VIDEO_ASSET_MANIFEST": str(manifest)}):
                asset = resolve_visual_asset("2026-07-12", "函館", 11, "wide")
            self.assertIsNotNone(asset)
            self.assertEqual(asset.path.name, "race.jpg")
            self.assertEqual(asset.focus, (0.7, 0.4))

    def test_thumbnail_and_position_slides_have_expected_sizes(self) -> None:
        race = _race()
        hero = race.predictions[0]
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            thumbnail = root / "thumbnail.png"
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
            with Image.open(position_wide) as image:
                self.assertEqual(image.size, (1920, 1080))
            with Image.open(position_vertical) as image:
                self.assertEqual(image.size, (1080, 1920))

    def test_video_clip_renderer_does_not_use_zoompan(self) -> None:
        source = inspect.getsource(renderer._render_static_clip)
        self.assertNotIn("zoompan", source)
        self.assertEqual(renderer.KEN_BURNS_ZOOM_TO, 1.0)


if __name__ == "__main__":
    unittest.main()
