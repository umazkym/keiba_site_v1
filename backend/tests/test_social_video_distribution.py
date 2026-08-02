from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.social_video.distribution import (
    SUPPORTED_PLATFORMS,
    build_destination_url,
    build_variant,
)
from scripts.social_video.publishers import (
    FacebookPublisher,
    InstagramPublisher,
    _bluesky_link_facets,
)
from scripts.social_video_distribution import build_parser, run


def _package(root: Path) -> dict:
    standard = root / "standard.mp4"
    clean = root / "clean.mp4"
    cover = root / "cover.png"
    standard.write_bytes(b"standard-video")
    clean.write_bytes(b"clean-video")
    cover.write_bytes(b"cover")
    return {
        "video_type": "short",
        "stable_id": "short_20260731_tokyo_11",
        "target_date": "2026-07-31",
        "venue_name": "東京",
        "race_number": 11,
        "race_name": "テスト重賞",
        "destination_path": "/races/2026-07-31/tokyo/11",
        "video_path": str(standard),
        "vertical_cover_path": str(cover),
        "variant_video_paths": {
            "standard": str(standard),
            "tiktok_clean": str(clean),
        },
        "content_hash": "source-hash",
        "rights_manifest_hash": "rights-hash",
        "selected_assets": {
            "hero_image": {
                "type": "image",
                "asset_id": "images/default/vertical/horse01.jpg",
                "allowed_platforms": list(SUPPORTED_PLATFORMS) + ["youtube"],
            },
            "bgm": {
                "type": "audio",
                "asset_id": "audio/common/test.mp3",
                "allowed_platforms": list(SUPPORTED_PLATFORMS) + ["youtube"],
            },
        },
        "publishable": True,
        "publish_block_reasons": [],
    }


class SocialVideoDistributionTest(unittest.TestCase):
    def test_builds_platform_specific_destination_and_tiktok_clean_variant(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir))
            for platform in SUPPORTED_PLATFORMS:
                variant = build_variant(package, platform=platform, mode="validate")
                variant.validate_local()
                self.assertIn(f"utm_source={platform}", variant.destination_url)
                self.assertIn("utm_medium=organic_social", variant.destination_url)
                if platform in {"instagram", "tiktok"}:
                    self.assertIn("utm_campaign=profile", variant.destination_url)
                else:
                    self.assertIn("utm_campaign=daily_race_video", variant.destination_url)
                    self.assertIn("/races/2026-07-31/tokyo/11", variant.destination_url)
                if platform == "tiktok":
                    self.assertEqual(variant.video_path.name, "clean.mp4")
                    self.assertTrue(variant.is_clean_variant)
                else:
                    self.assertEqual(variant.video_path.name, "standard.mp4")

    def test_compilation_package_uses_multi_race_caption_and_title(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir))
            package["stable_id"] = "daily_short"
            package["race_name"] = "重賞2レースまとめ"
            package["featured_races"] = [
                {
                    "venue_name": "東京",
                    "race_number": 11,
                    "race_name": "天皇賞（秋）",
                    "grade": "G1",
                },
                {
                    "venue_name": "阪神",
                    "race_number": 11,
                    "race_name": "スワンステークス",
                    "grade": "G2",
                },
            ]

            variant = build_variant(package, platform="threads", mode="validate")

            self.assertEqual(variant.title, "重賞2レース AI偏差値TOP3")
            self.assertIn("当日の重賞2レース", variant.caption)
            self.assertIn("天皇賞（秋）", variant.caption)
            self.assertIn("スワンステークス", variant.caption)
            self.assertIn("注目2レース", variant.alt_text)

    def test_validate_mode_does_not_use_registry_or_external_post(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            target_dir = root / "2026-07-31"
            target_dir.mkdir(parents=True)
            package = _package(root)
            summary_path = target_dir / "summary.json"
            summary_path.write_text(
                json.dumps(
                    {
                        "target_date": "2026-07-31",
                        "videos": [package],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            args = build_parser().parse_args(
                [
                    "--summary",
                    str(summary_path),
                    "--default-mode",
                    "validate",
                ]
            )
            with patch(
                "scripts.social_video_distribution.VideoPostRegistry",
                side_effect=AssertionError("validateではDBを初期化しない"),
            ):
                exit_code = run(args)
            self.assertEqual(exit_code, 0)
            result = json.loads(
                (target_dir / "social-distribution-summary.json").read_text(encoding="utf-8")
            )
            self.assertEqual(len(result["results"]), len(SUPPORTED_PLATFORMS))
            self.assertTrue(
                all(item["status"] == "validated_local" for item in result["results"])
            )

    def test_draft_mode_is_limited_to_supported_platforms(self) -> None:
        with self.assertRaises(RuntimeError):
            InstagramPublisher().validate_mode("draft")
        FacebookPublisher().validate_mode("draft")

    def test_missing_platform_rights_scope_blocks_distribution(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir))
            package["selected_assets"]["bgm"]["allowed_platforms"] = ["youtube"]
            with self.assertRaisesRegex(ValueError, "threadsでの利用許諾"):
                build_variant(package, platform="threads", mode="validate")

    def test_bluesky_facet_uses_utf8_byte_offsets(self) -> None:
        url = build_destination_url(
            "bluesky",
            "/races/2026-07-31/tokyo/11",
            "20260731_tokyo_11r_daily1",
        )
        text = f"東京11Rの分析\n{url}"
        facets = _bluesky_link_facets(text, url)
        self.assertEqual(len(facets), 1)
        start = facets[0]["index"]["byteStart"]
        self.assertEqual(start, len("東京11Rの分析\n".encode("utf-8")))


if __name__ == "__main__":
    unittest.main()
