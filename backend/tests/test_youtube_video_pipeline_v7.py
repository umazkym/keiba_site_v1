from __future__ import annotations

import os
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock, call, patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts import youtube_video_pipeline
from scripts.social_video import data_loader
from scripts.social_video.data_loader import HorseVideoData, RaceVideoData, VenueVideoData, merge_expected_races
from scripts.social_video.registry import PublicationRecord, validate_youtube_status_transition
from scripts.social_video.video_package import VideoPackage, build_content_hash
from scripts.social_video.youtube_client import (
    JST,
    YouTubeClient,
    YouTubeUploadResult,
    YouTubeVideoStatus,
    YouTubeVideoStatusUnavailableError,
    build_publish_at,
    build_publish_schedule,
    estimate_quota_units,
)


class FakeRegistry:
    enabled = True

    def __init__(self, existing: PublicationRecord | None = None) -> None:
        self.existing = existing
        self.transitions: list[str] = []
        self.errors: list[str] = []

    def reserve(self, **kwargs) -> PublicationRecord:
        if self.existing:
            if self.existing.content_hash != kwargs["content_hash"]:
                raise RuntimeError("同一動画キーに異なる内容が検出されました")
            return self.existing
        self.existing = PublicationRecord(
            platform="youtube",
            target_date=kwargs["target_date"],
            video_type=kwargs["video_type"],
            stable_id=kwargs["stable_id"],
            status="planned",
            content_hash=kwargs["content_hash"],
            remote_video_id=None,
            scheduled_at=None,
            attempt_count=1,
            last_error=None,
            metadata=kwargs["metadata"],
        )
        return self.existing

    def list_recent(self, days=7, statuses=None):
        if self.existing is None:
            return []
        if statuses and self.existing.status not in statuses:
            return []
        return [self.existing]

    def transition(self, target_date, video_type, stable_id, status, **kwargs) -> PublicationRecord:
        assert self.existing is not None
        self.transitions.append(status)
        self.existing = PublicationRecord(
            platform="youtube",
            target_date=target_date,
            video_type=video_type,
            stable_id=stable_id,
            status=status,
            content_hash=self.existing.content_hash,
            remote_video_id=kwargs.get("remote_video_id") or self.existing.remote_video_id,
            scheduled_at=(
                None
                if kwargs.get("clear_scheduled_at")
                else kwargs.get("scheduled_at") or self.existing.scheduled_at
            ),
            attempt_count=self.existing.attempt_count,
            last_error=None,
            metadata={**self.existing.metadata, **(kwargs.get("metadata") or {})},
        )
        return self.existing

    def record_error(self, target_date, video_type, stable_id, error) -> None:
        self.errors.append(error)


def _args(mode: str) -> SimpleNamespace:
    return SimpleNamespace(
        target_date="2099-07-12",
        input_json=None,
        allow_placeholder_data=False,
        skip_upload=False,
        dry_run=False,
        disable_registry=False,
        force=False,
        publication_mode=mode,
        publish_time_jst="19:00",
        publish_min_lead_minutes=20,
        max_publish_shift_minutes=240,
        quota_budget=8000,
        processing_timeout_seconds=1,
        processing_poll_seconds=1,
    )


def _package(root: Path, video_type: str, thumbnail_required: bool) -> VideoPackage:
    video = root / f"{video_type}.mp4"
    thumbnail = root / f"{video_type}.png"
    metadata = root / f"{video_type}.json"
    video.write_bytes(b"video")
    thumbnail.write_bytes(b"thumbnail")
    metadata.write_text("{}\n", encoding="utf-8")
    return VideoPackage(
        video_type=video_type,
        stable_id=f"{video_type}_test",
        title="テスト動画",
        description="テスト説明",
        tags=["競馬", "AI偏差値"],
        video_path=video,
        thumbnail_path=thumbnail,
        metadata_path=metadata,
        publish_offset_minutes=0,
        target_date="2099-07-12",
        venue_name="東京",
        race_ids=["race-1"],
        aspect_ratio="9:16" if video_type == "short" else "16:9",
        destination_url="https://uma-free.com/races/2099-07-12/tokyo/11",
        utm_content=f"{video_type}_test",
        rights_manifest_hash="rights",
        content_hash=build_content_hash({"video_type": video_type}),
        thumbnail_required=thumbnail_required,
    )


def _youtube_client() -> Mock:
    client = Mock()
    client.insert_video.return_value = YouTubeUploadResult("video-id", "https://www.youtube.com/watch?v=video-id")
    client.wait_for_processing.return_value = YouTubeVideoStatus(
        video_id="video-id",
        processing_status="succeeded",
        upload_status="processed",
        privacy_status="private",
        publish_at=None,
        failure_reason=None,
        rejection_reason=None,
    )
    return client


def _valid_horses(prefix: str = "通常馬") -> list[HorseVideoData]:
    return [
        HorseVideoData(
            f"{prefix}{number}",
            number,
            number,
            "",
            64.0 - number,
            float(number),
        )
        for number in range(1, 4)
    ]


class YouTubeVideoPipelineV7Test(unittest.TestCase):
    def test_private_review_short_skips_thumbnail_and_publish_at(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "short", thumbnail_required=False)
            registry = FakeRegistry()
            client = _youtube_client()
            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True), patch.object(
                youtube_video_pipeline, "VideoPostRegistry", return_value=registry
            ), patch.object(youtube_video_pipeline, "YouTubeClient", return_value=client):
                youtube_video_pipeline._upload_all(_args("private_review"), [package])

        self.assertIsNone(client.insert_video.call_args.kwargs["publish_at"])
        client.set_thumbnail.assert_not_called()
        self.assertEqual(
            registry.transitions,
            ["uploaded", "thumbnail_skipped", "processing", "private_review"],
        )

    def test_one_upload_failure_does_not_prevent_other_video_upload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            short = _package(root, "short", thumbnail_required=False)
            long_video = _package(root, "daily_long", thumbnail_required=True)
            records: dict[tuple[str, str], PublicationRecord] = {}
            registry = Mock(enabled=True)
            registry.list_recent.return_value = []

            def reserve(**kwargs) -> PublicationRecord:
                key = (kwargs["video_type"], kwargs["stable_id"])
                record = PublicationRecord(
                    platform="youtube",
                    target_date=kwargs["target_date"],
                    video_type=kwargs["video_type"],
                    stable_id=kwargs["stable_id"],
                    status="planned",
                    content_hash=kwargs["content_hash"],
                    remote_video_id=None,
                    scheduled_at=None,
                    attempt_count=1,
                    last_error=None,
                    metadata=kwargs["metadata"],
                )
                records[key] = record
                return record

            def transition(target_date, video_type, stable_id, status, **kwargs) -> PublicationRecord:
                key = (video_type, stable_id)
                current = records[key]
                record = PublicationRecord(
                    platform="youtube",
                    target_date=target_date,
                    video_type=video_type,
                    stable_id=stable_id,
                    status=status,
                    content_hash=current.content_hash,
                    remote_video_id=kwargs.get("remote_video_id") or current.remote_video_id,
                    scheduled_at=kwargs.get("scheduled_at") or current.scheduled_at,
                    attempt_count=current.attempt_count,
                    last_error=None,
                    metadata=current.metadata,
                )
                records[key] = record
                return record

            registry.reserve.side_effect = reserve
            registry.transition.side_effect = transition
            client = _youtube_client()
            client.insert_video.side_effect = [
                RuntimeError("Short upload failed"),
                YouTubeUploadResult("long-video", "https://www.youtube.com/watch?v=long-video"),
            ]
            context = youtube_video_pipeline.UploadContext(registry, client, "channel")

            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True):
                with self.assertRaisesRegex(RuntimeError, "成功済み動画は維持"):
                    youtube_video_pipeline._upload_all(
                        _args("private_review"),
                        [short, long_video],
                        upload_context=context,
                    )

        self.assertEqual(client.insert_video.call_count, 2)
        self.assertEqual(records[("daily_long", long_video.stable_id)].status, "private_review")

    def test_one_registry_reservation_failure_does_not_prevent_other_upload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            short = _package(root, "short", thumbnail_required=False)
            long_video = _package(root, "daily_long", thumbnail_required=True)
            backing_registry = FakeRegistry()
            registry = Mock(enabled=True)
            registry.list_recent.side_effect = backing_registry.list_recent
            registry.transition.side_effect = backing_registry.transition
            registry.record_error.side_effect = backing_registry.record_error

            def reserve(**kwargs) -> PublicationRecord:
                if kwargs["video_type"] == "short":
                    raise RuntimeError("Short content hash mismatch")
                return backing_registry.reserve(**kwargs)

            registry.reserve.side_effect = reserve
            client = _youtube_client()
            context = youtube_video_pipeline.UploadContext(registry, client, "channel")

            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True):
                with self.assertRaisesRegex(RuntimeError, "成功済み動画は維持"):
                    youtube_video_pipeline._upload_all(
                        _args("private_review"),
                        [short, long_video],
                        upload_context=context,
                    )

        client.insert_video.assert_called_once()
        self.assertEqual(backing_registry.existing.status, "private_review")
        self.assertTrue(any("content hash mismatch" in error for error in backing_registry.errors))

    def test_scheduled_long_sets_thumbnail_and_publish_at(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "venue_long", thumbnail_required=True)
            registry = FakeRegistry()
            client = _youtube_client()
            client.wait_for_processing.return_value = YouTubeVideoStatus(
                video_id="video-id",
                processing_status="succeeded",
                upload_status="processed",
                privacy_status="private",
                publish_at="2099-07-11T11:30:00Z",
                failure_reason=None,
                rejection_reason=None,
            )
            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True), patch.object(
                youtube_video_pipeline, "VideoPostRegistry", return_value=registry
            ), patch.object(youtube_video_pipeline, "YouTubeClient", return_value=client), patch.object(
                youtube_video_pipeline,
                "build_publish_schedule",
                return_value=(["2099-07-11T11:30:00Z"], 0),
            ):
                youtube_video_pipeline._upload_all(_args("scheduled_public"), [package])

        self.assertEqual(client.insert_video.call_args.kwargs["publish_at"], "2099-07-11T11:30:00Z")
        client.set_thumbnail.assert_called_once_with("video-id", package.thumbnail_path)
        self.assertEqual(registry.transitions[-1], "scheduled")

    def test_delayed_schedule_is_uploaded_and_reported_without_losing_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            package = _package(temp_root, "short", thumbnail_required=False)
            summary_path = temp_root / "summary.md"
            registry = FakeRegistry()
            client = _youtube_client()
            shifted_publish_at = "2099-07-11T12:10:00Z"
            with patch.dict(
                os.environ,
                {"GITHUB_STEP_SUMMARY": str(summary_path)},
                clear=False,
            ), patch.object(
                youtube_video_pipeline, "_env_flag", return_value=True
            ), patch.object(
                youtube_video_pipeline, "VideoPostRegistry", return_value=registry
            ), patch.object(
                youtube_video_pipeline, "YouTubeClient", return_value=client
            ), patch.object(
                youtube_video_pipeline,
                "build_publish_schedule",
                return_value=([shifted_publish_at], 60),
            ):
                youtube_video_pipeline._upload_all(_args("scheduled_public"), [package])
            summary_text = summary_path.read_text(encoding="utf-8")

        self.assertEqual(
            client.insert_video.call_args.kwargs["publish_at"],
            shifted_publish_at,
        )
        self.assertEqual(registry.existing.metadata["schedule_shift_minutes"], 60)
        self.assertIn("遅延時刻補正", summary_text)

    def test_unpublishable_item_does_not_downgrade_other_scheduled_video(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "venue_long", thumbnail_required=True)
            blocked = _package(Path(temp_dir), "short", thumbnail_required=False)
            blocked.publishable = False
            blocked.publish_block_reasons = ["素材権利メタデータ不足"]
            args = _args("scheduled_public")
            registry = FakeRegistry()
            client = _youtube_client()
            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True), patch.object(
                youtube_video_pipeline, "VideoPostRegistry", return_value=registry
            ), patch.object(youtube_video_pipeline, "YouTubeClient", return_value=client):
                youtube_video_pipeline._upload_all(args, [package, blocked])

        self.assertIsNotNone(client.insert_video.call_args.kwargs["publish_at"])
        self.assertEqual(registry.transitions[-1], "scheduled")

    def test_resume_after_insert_reuses_remote_video_id(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "venue_long", thumbnail_required=True)
            existing = PublicationRecord(
                platform="youtube",
                target_date="2099-07-12",
                video_type="venue_long",
                stable_id=package.stable_id,
                status="uploaded",
                content_hash=package.content_hash,
                remote_video_id="existing-video",
                scheduled_at=None,
                attempt_count=2,
                last_error="thumbnail error",
                metadata={},
            )
            registry = FakeRegistry(existing)
            client = _youtube_client()
            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True), patch.object(
                youtube_video_pipeline, "VideoPostRegistry", return_value=registry
            ), patch.object(youtube_video_pipeline, "YouTubeClient", return_value=client):
                youtube_video_pipeline._upload_all(_args("private_review"), [package])

        client.insert_video.assert_not_called()
        client.set_thumbnail.assert_called_once_with("existing-video", package.thumbnail_path)

    def test_resume_processing_record_preserves_schedule_and_accepts_published_video(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "short", thumbnail_required=False)
            original_publish_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
            existing = PublicationRecord(
                platform="youtube",
                target_date="2099-07-12",
                video_type="short",
                stable_id=package.stable_id,
                status="processing",
                content_hash=package.content_hash,
                remote_video_id="existing-video",
                scheduled_at=original_publish_at,
                attempt_count=2,
                last_error="YouTube上の動画状態を取得できません: existing-video",
                metadata={},
            )
            registry = FakeRegistry(existing)
            client = _youtube_client()
            client.wait_for_processing.return_value = YouTubeVideoStatus(
                video_id="existing-video",
                processing_status="succeeded",
                upload_status="processed",
                privacy_status="public",
                publish_at=None,
                failure_reason=None,
                rejection_reason=None,
            )
            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True), patch.object(
                youtube_video_pipeline, "VideoPostRegistry", return_value=registry
            ), patch.object(youtube_video_pipeline, "YouTubeClient", return_value=client), patch.object(
                youtube_video_pipeline,
                "build_publish_schedule",
                return_value=(["2099-07-11T12:30:00Z"], 60),
            ):
                youtube_video_pipeline._upload_all(_args("scheduled_public"), [package])

        client.insert_video.assert_not_called()
        self.assertEqual(registry.existing.status, "published")
        self.assertEqual(
            client.wait_for_processing.call_args.kwargs["expected_publish_at"],
            original_publish_at.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z"),
        )

    def test_content_hash_change_stops_before_creating_another_video(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "venue_long", thumbnail_required=True)
            existing = PublicationRecord(
                platform="youtube",
                target_date="2099-07-12",
                video_type="venue_long",
                stable_id=package.stable_id,
                status="planned",
                content_hash="different-content-hash",
                remote_video_id=None,
                scheduled_at=None,
                attempt_count=1,
                last_error=None,
                metadata={},
            )
            registry = FakeRegistry(existing)
            client = _youtube_client()
            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True), patch.object(
                youtube_video_pipeline, "VideoPostRegistry", return_value=registry
            ), patch.object(youtube_video_pipeline, "YouTubeClient", return_value=client):
                with self.assertRaisesRegex(RuntimeError, "異なる内容"):
                    youtube_video_pipeline._upload_all(_args("private_review"), [package])

        client.insert_video.assert_not_called()

    def test_private_mode_preserves_a_previous_terminal_schedule(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "venue_long", thumbnail_required=True)
            existing = PublicationRecord(
                platform="youtube",
                target_date="2099-07-12",
                video_type="venue_long",
                stable_id=package.stable_id,
                status="scheduled",
                content_hash=package.content_hash,
                remote_video_id="scheduled-video",
                scheduled_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=2),
                attempt_count=1,
                last_error=None,
                metadata={},
            )
            registry = FakeRegistry(existing)
            client = _youtube_client()
            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True), patch.object(
                youtube_video_pipeline, "VideoPostRegistry", return_value=registry
            ), patch.object(youtube_video_pipeline, "YouTubeClient", return_value=client):
                youtube_video_pipeline._upload_all(_args("private_review"), [package])

        client.clear_publish_schedule.assert_not_called()
        client.insert_video.assert_not_called()
        self.assertEqual(registry.existing.status, "scheduled")
        self.assertIsNotNone(registry.existing.scheduled_at)

    def test_private_mode_accepts_public_video_found_while_clearing_nonterminal_schedule(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "venue_long", thumbnail_required=True)
            existing = PublicationRecord(
                platform="youtube",
                target_date="2099-07-12",
                video_type="venue_long",
                stable_id=package.stable_id,
                status="processing",
                content_hash=package.content_hash,
                remote_video_id="already-public-video",
                scheduled_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=2),
                attempt_count=1,
                last_error=None,
                metadata={},
            )
            registry = FakeRegistry(existing)
            client = _youtube_client()
            client.clear_publish_schedule.return_value = YouTubeVideoStatus(
                video_id="already-public-video",
                processing_status="succeeded",
                upload_status="processed",
                privacy_status="public",
                publish_at=None,
                failure_reason=None,
                rejection_reason=None,
            )
            with patch.object(youtube_video_pipeline, "_env_flag", return_value=True), patch.object(
                youtube_video_pipeline, "VideoPostRegistry", return_value=registry
            ), patch.object(youtube_video_pipeline, "YouTubeClient", return_value=client):
                youtube_video_pipeline._upload_all(_args("private_review"), [package])

        client.insert_video.assert_not_called()
        self.assertEqual(registry.existing.status, "published")

    def test_incomplete_race_is_omitted_without_blocking_other_venue(self) -> None:
        valid_race = RaceVideoData("valid", "2026-07-12", "東京", 1, "1R", "芝", 1600, predictions=_valid_horses())
        missing_race = RaceVideoData("missing", "2026-07-12", "大井", 1, "1R", "ダート", 1200, predictions=[])
        publishable, omissions = youtube_video_pipeline._partition_publishable_venues(
            [
                VenueVideoData("東京", "中央", [valid_race]),
                VenueVideoData("大井", "地方", [missing_race]),
            ],
            allow_placeholder_data=False,
        )
        self.assertEqual([venue.venue_name for venue in publishable], ["東京"])
        self.assertEqual([item.race_id for item in omissions], ["missing"])

    def test_newcomer_race_is_excluded_without_blocking_venue(self) -> None:
        valid_horses = _valid_horses()
        first_race = RaceVideoData(
            "race-1",
            "2026-07-24",
            "笠松",
            1,
            "3歳未勝利",
            "ダート",
            1400,
            predictions=valid_horses,
        )
        newcomer_race = RaceVideoData(
            "race-2",
            "2026-07-24",
            "笠松",
            2,
            "2歳新馬",
            "ダート",
            800,
            predictions=[],
        )
        third_race = RaceVideoData(
            "race-3",
            "2026-07-24",
            "笠松",
            3,
            "2歳特別",
            "ダート",
            1400,
            predictions=valid_horses,
        )

        publishable, omissions = youtube_video_pipeline._prepare_publishable_venues(
            [VenueVideoData("笠松", "地方", [first_race, newcomer_race, third_race])],
            allow_placeholder_data=False,
        )

        self.assertEqual([race.race_number for race in publishable[0].races], [1, 3])
        self.assertEqual([race.race_number for race in publishable[0].excluded_races], [2])
        self.assertEqual([item.category for item in omissions], ["expected_exclusion"])

    def test_obstacle_race_is_excluded_without_blocking_venue(self) -> None:
        valid_horses = _valid_horses()
        flat_race = RaceVideoData(
            "race-1",
            "2026-08-01",
            "中京",
            1,
            "3歳未勝利",
            "芝",
            1600,
            predictions=valid_horses,
        )
        obstacle_race = RaceVideoData(
            "race-2",
            "2026-08-01",
            "中京",
            2,
            "3歳以上障害未勝利",
            "障",
            3000,
            predictions=[],
        )

        publishable, omissions = youtube_video_pipeline._prepare_publishable_venues(
            [VenueVideoData("中京", "中央", [flat_race, obstacle_race])],
            allow_placeholder_data=False,
        )

        self.assertEqual([race.race_number for race in publishable[0].races], [1])
        self.assertEqual([race.race_number for race in publishable[0].excluded_races], [2])
        self.assertEqual([item.category for item in omissions], ["expected_exclusion"])

    def test_branded_nar_debut_is_excluded_without_blocking_venue(self) -> None:
        valid_horses = _valid_horses()
        normal_race = RaceVideoData(
            "race-1",
            "2026-07-31",
            "名古屋",
            1,
            "3歳条件",
            "ダート",
            1500,
            predictions=valid_horses,
        )
        branded_debut = RaceVideoData(
            "race-3",
            "2026-07-31",
            "名古屋",
            3,
            "ゴールデンデビュー名古屋(2歳)",
            "ダート",
            900,
            predictions=[],
        )
        second_race = RaceVideoData(
            "race-2",
            "2026-07-31",
            "名古屋",
            2,
            "3歳条件",
            "ダート",
            1500,
            predictions=valid_horses,
        )

        publishable, omissions = youtube_video_pipeline._prepare_publishable_venues(
            [VenueVideoData("名古屋", "地方", [normal_race, second_race, branded_debut])],
            allow_placeholder_data=False,
        )

        self.assertEqual([race.race_number for race in publishable[0].races], [1, 2])
        self.assertEqual([race.race_number for race in publishable[0].excluded_races], [3])
        self.assertEqual([item.category for item in omissions], ["expected_exclusion"])

    def test_sonoda_new_beginning_is_an_expected_exclusion(self) -> None:
        debut = RaceVideoData(
            "sonoda-debut",
            "2026-07-29",
            "園田",
            3,
            "NewBeginning 2歳初出走",
            "ダート",
            1400,
            predictions=[],
        )
        normal = RaceVideoData(
            "sonoda-main",
            "2026-07-29",
            "園田",
            11,
            "園田11R",
            "ダート",
            1400,
            predictions=_valid_horses(),
        )

        publishable, omissions = youtube_video_pipeline._prepare_publishable_venues(
            [VenueVideoData("園田", "地方", [debut, normal])],
            allow_placeholder_data=False,
        )

        self.assertEqual([race.id for race in publishable[0].races], ["sonoda-main"])
        self.assertEqual(omissions[0].category, "expected_exclusion")

    def test_all_zero_readiness_retries_and_forces_database_refresh(self) -> None:
        target_date = "2026-07-31"
        invalid_race = RaceVideoData(
            "race-1",
            target_date,
            "川崎",
            1,
            "1R",
            "ダート",
            1500,
            predictions=[],
        )
        valid_race = RaceVideoData(
            "race-1",
            target_date,
            "川崎",
            1,
            "1R",
            "ダート",
            1500,
            predictions=_valid_horses(),
        )
        args = SimpleNamespace(
            input_json=None,
            readiness_attempts=3,
            readiness_delay_seconds=0,
            allow_placeholder_data=False,
        )

        with patch.object(
            youtube_video_pipeline,
            "load_venues_for_date",
            side_effect=[
                [VenueVideoData("川崎", "地方", [invalid_race])],
                [VenueVideoData("川崎", "地方", [valid_race])],
            ],
        ) as load_venues, patch.object(youtube_video_pipeline.time, "sleep"):
            prepared = youtube_video_pipeline._load_venues_with_readiness(
                args,
                target_date,
            )

        self.assertEqual([venue.venue_name for venue in prepared.venues], ["川崎"])
        self.assertEqual(prepared.retry_count, 1)
        self.assertEqual(load_venues.call_count, 2)
        self.assertFalse(load_venues.call_args_list[0].kwargs["force_refresh"])
        self.assertTrue(load_venues.call_args_list[1].kwargs["force_refresh"])

    def test_partial_data_is_used_without_waiting_for_retry(self) -> None:
        target_date = "2026-08-03"
        valid = RaceVideoData(
            "valid",
            target_date,
            "盛岡",
            11,
            "11R",
            "ダート",
            1600,
            predictions=_valid_horses(),
        )
        missing = RaceVideoData(
            "missing",
            target_date,
            "盛岡",
            12,
            "12R",
            "ダート",
            1600,
            predictions=[],
        )
        args = SimpleNamespace(
            input_json=None,
            readiness_attempts=3,
            readiness_delay_seconds=0,
            allow_placeholder_data=False,
        )

        with patch.object(
            youtube_video_pipeline,
            "load_venues_for_date",
            return_value=[VenueVideoData("盛岡", "地方", [valid, missing])],
        ) as load_venues, patch.object(youtube_video_pipeline.time, "sleep") as sleep:
            prepared = youtube_video_pipeline._load_venues_with_readiness(args, target_date)

        self.assertEqual(prepared.actual_race_count, 1)
        self.assertEqual(prepared.retry_count, 0)
        self.assertEqual(prepared.coverage_status, "partial")
        self.assertEqual([item.race_id for item in prepared.omitted_races], ["missing"])
        load_venues.assert_called_once()
        sleep.assert_not_called()

    def test_database_force_refresh_invalidates_prediction_cache(self) -> None:
        db = Mock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        with patch(
            "database.database.SessionLocal",
            return_value=db,
        ), patch(
            "crud.race_crud.invalidate_predictions_cache",
        ) as invalidate_cache, patch(
            "crud.race_crud.get_predictions_by_date",
            return_value={"jra": [], "nar": []},
        ), patch(
            "crud.race_crud.get_weekly_grade_races",
            return_value=[],
        ):
            venues = data_loader._load_venues_for_date_from_database(
                "2026-07-31",
                force_refresh=True,
            )

        self.assertEqual(venues, [])
        invalidate_cache.assert_called_once_with(date(2026, 7, 31))
        db.close.assert_called_once_with()

    def test_database_failure_falls_back_to_public_api(self) -> None:
        diagnostics: dict[str, object] = {}
        payload = {
            "jra": [
                {
                    "venue_name": "東京",
                    "races": [
                        {
                            "id": "race-1",
                            "race_date": "2026-08-03",
                            "venue_name": "東京",
                            "race_number": 1,
                            "race_name": "3歳未勝利",
                            "course_type": "芝",
                            "distance": 1600,
                            "predictions": [
                                {
                                    "horse_name": f"通常馬{number}",
                                    "horse_number": number,
                                    "waku_number": number,
                                    "deviation_score": 64.0 - number,
                                    "start_1c_indicator": float(number),
                                }
                                for number in range(1, 4)
                            ],
                        }
                    ],
                }
            ],
            "nar": [],
        }

        with patch.dict(os.environ, {"DATABASE_URL": "postgresql://masked"}), patch.object(
            data_loader,
            "_load_venues_for_date_from_database",
            side_effect=RuntimeError("接続失敗"),
        ), patch.object(
            data_loader,
            "fetch_race_day_payload",
            return_value=payload,
        ), patch.object(
            data_loader,
            "fetch_weekly_grade_races",
            return_value=[],
        ):
            venues = data_loader.load_venues_for_date(
                "2026-08-03",
                diagnostics=diagnostics,
            )

        self.assertEqual([venue.venue_name for venue in venues], ["東京"])
        self.assertEqual(diagnostics["data_source"], "api_fallback")
        self.assertTrue(diagnostics["fallback_used"])

    def test_api_data_infers_grade_outside_weekly_grade_window(self) -> None:
        payload = {
            "jra": [
                {
                    "venue_name": "新潟",
                    "races": [
                        {
                            "id": "ibis",
                            "race_date": "2026-08-02",
                            "venue_name": "新潟",
                            "race_number": 7,
                            "race_name": "アイビスSD",
                            "course_type": "芝",
                            "distance": 1000,
                            "predictions": [],
                        }
                    ],
                }
            ],
            "nar": [
                {
                    "venue_name": "盛岡",
                    "races": [
                        {
                            "id": "local-grade",
                            "race_date": "2026-08-02",
                            "venue_name": "盛岡",
                            "race_number": 11,
                            "race_name": "せきれい賞重賞",
                            "course_type": "芝",
                            "distance": 2400,
                            "predictions": [],
                        }
                    ],
                }
            ],
        }

        venues = data_loader.normalize_venues(payload, [], "2026-08-02")

        self.assertEqual(venues[0].races[0].grade, "G3")
        self.assertEqual(venues[1].races[0].grade, "地方重賞")

    def test_exact_placeholder_horse_is_removed_and_race_is_omitted(self) -> None:
        placeholder = HorseVideoData("サンプル馬", 1, 1, "", 60.0, 0.5)
        race = RaceVideoData("sample", "2026-07-12", "東京", 1, "1R", "芝", 1600, predictions=[placeholder])
        publishable, omissions = youtube_video_pipeline._partition_publishable_venues(
            [VenueVideoData("東京", "中央", [race])],
            allow_placeholder_data=False,
        )
        self.assertEqual(publishable, [])
        self.assertEqual([item.race_id for item in omissions], ["sample"])
        self.assertIn("プレースホルダー馬1頭", omissions[0].reason)

    def test_legitimate_horse_name_containing_test_is_publishable(self) -> None:
        race = RaceVideoData(
            "grade",
            "2026-08-02",
            "新潟",
            7,
            "アイビスSD",
            "芝",
            1000,
            grade="G3",
            predictions=_valid_horses("ウイングレイテスト"),
        )

        publishable, omissions = youtube_video_pipeline._partition_publishable_venues(
            [VenueVideoData("新潟", "中央", [race])],
            allow_placeholder_data=False,
        )

        self.assertEqual([venue.venue_name for venue in publishable], ["新潟"])
        self.assertEqual(omissions, [])

    def test_database_race_without_predictions_is_added_for_readiness_gate(self) -> None:
        venue = VenueVideoData(
            "東京",
            "中央",
            [RaceVideoData("race-1", "2026-07-12", "東京", 1, "1R", "芝", 1600, predictions=_valid_horses())],
        )
        expected_race = SimpleNamespace(
            id="race-2",
            race_date="2026-07-12",
            venue_name="東京",
            race_number=2,
            race_name="2R",
            race_type="中央",
            course_type="芝",
            distance=1800,
        )

        merged = merge_expected_races(
            [venue],
            [expected_race],
            "2026-07-12",
            expected_grades={"race-2": "G3"},
        )
        publishable, omissions = youtube_video_pipeline._partition_publishable_venues(
            merged,
            allow_placeholder_data=False,
        )

        self.assertEqual([race.id for race in publishable[0].races], ["race-1"])
        self.assertEqual([item.race_id for item in omissions], ["race-2"])
        self.assertEqual(omissions[0].grade, "G3")

    def test_fixture_or_placeholder_mode_cannot_upload(self) -> None:
        args = _args("private_review")
        args.input_json = "fixture.json"
        args.allow_placeholder_data = False
        args.target_date = "2099-07-12"
        with patch.object(youtube_video_pipeline, "parse_args", return_value=args), patch.object(
            youtube_video_pipeline, "_render_all"
        ) as render_all:
            with self.assertRaisesRegex(RuntimeError, "実DBの確定データ"):
                youtube_video_pipeline.main()
        render_all.assert_not_called()

    def test_oauth_preflight_failure_stops_before_render_or_registry_reservation(self) -> None:
        args = _args("private_review")
        registry = Mock(enabled=True)
        client = Mock()
        client.validate_channel.side_effect = RuntimeError(
            "YouTube OAuth refresh tokenが失効しています。YOUTUBE_REFRESH_TOKENを更新してください。"
        )
        with patch.object(youtube_video_pipeline, "parse_args", return_value=args), patch.object(
            youtube_video_pipeline, "_env_flag", return_value=True
        ), patch.object(
            youtube_video_pipeline, "VideoPostRegistry", return_value=registry
        ), patch.object(
            youtube_video_pipeline, "YouTubeClient", return_value=client
        ), patch.object(
            youtube_video_pipeline, "_render_all"
        ) as render_all:
            with self.assertRaisesRegex(RuntimeError, "YOUTUBE_REFRESH_TOKEN"):
                youtube_video_pipeline.main()

        render_all.assert_not_called()
        registry.reserve.assert_not_called()
        client.insert_video.assert_not_called()

    def test_strong_gambling_language_is_rejected_before_upload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "venue_long", thumbnail_required=True)
            package.title = "絶対に当たる競馬情報"
            youtube_video_pipeline._apply_content_safety_gate([package])
        self.assertFalse(package.publishable)
        self.assertTrue(any("強すぎる競馬表現" in reason for reason in package.publish_block_reasons))

    def test_quota_estimate_counts_thumbnail_only_for_long_videos(self) -> None:
        self.assertEqual(estimate_quota_units(video_count=4, thumbnail_count=3), 574)

    def test_resumable_upload_uses_bounded_google_client_retries(self) -> None:
        client = YouTubeClient.__new__(YouTubeClient)
        service = Mock()
        request = service.videos.return_value.insert.return_value
        request.next_chunk.return_value = (None, {"id": "video-id"})
        client._service = service
        googleapiclient_module = ModuleType("googleapiclient")
        googleapiclient_module.__path__ = []  # type: ignore[attr-defined]
        http_module = ModuleType("googleapiclient.http")
        http_module.MediaFileUpload = Mock()  # type: ignore[attr-defined]
        with tempfile.TemporaryDirectory() as temp_dir:
            video_path = Path(temp_dir) / "video.mp4"
            video_path.write_bytes(b"video")
            with patch.dict(
                sys.modules,
                {
                    "googleapiclient": googleapiclient_module,
                    "googleapiclient.http": http_module,
                },
            ):
                result = client.insert_video(
                    video_path=video_path,
                    title="テスト",
                    description="説明",
                    tags=["競馬"],
                    publish_at=None,
                )

        self.assertEqual(result.video_id, "video-id")
        request.next_chunk.assert_called_once_with(num_retries=3)

    def test_processing_check_rejects_changed_publish_time(self) -> None:
        client = YouTubeClient.__new__(YouTubeClient)
        client.get_video_status = Mock(
            return_value=YouTubeVideoStatus(
                video_id="video-id",
                processing_status="succeeded",
                upload_status="processed",
                privacy_status="private",
                publish_at="2099-07-11T11:40:00Z",
                failure_reason=None,
                rejection_reason=None,
            )
        )

        with self.assertRaisesRegex(RuntimeError, "予約公開時刻が要求値と一致しません"):
            client.wait_for_processing(
                "video-id",
                expected_publish_at="2099-07-11T11:30:00Z",
                timeout_seconds=1,
                poll_interval_seconds=1,
            )

    def test_processing_check_retries_temporary_status_visibility_lag(self) -> None:
        client = YouTubeClient.__new__(YouTubeClient)
        completed = YouTubeVideoStatus(
            video_id="video-id",
            processing_status="succeeded",
            upload_status="processed",
            privacy_status="private",
            publish_at=None,
            failure_reason=None,
            rejection_reason=None,
        )
        client.get_video_status = Mock(
            side_effect=[
                YouTubeVideoStatusUnavailableError(
                    "YouTube上の動画状態を取得できません: video-id"
                ),
                completed,
            ]
        )

        with patch("scripts.social_video.youtube_client.time.sleep") as sleep:
            status = client.wait_for_processing(
                "video-id",
                timeout_seconds=10,
                poll_interval_seconds=1,
            )

        self.assertEqual(status, completed)
        sleep.assert_called_once_with(1)

    def test_processing_check_accepts_public_video_after_scheduled_time(self) -> None:
        client = YouTubeClient.__new__(YouTubeClient)
        client.get_video_status = Mock(
            return_value=YouTubeVideoStatus(
                video_id="video-id",
                processing_status="succeeded",
                upload_status="processed",
                privacy_status="public",
                publish_at=None,
                failure_reason=None,
                rejection_reason=None,
            )
        )
        expected = (
            datetime.now(timezone.utc) - timedelta(minutes=1)
        ).isoformat().replace("+00:00", "Z")

        status = client.wait_for_processing(
            "video-id",
            expected_publish_at=expected,
            timeout_seconds=1,
            poll_interval_seconds=1,
        )

        self.assertEqual(status.privacy_status, "public")

    def test_processing_check_accepts_remote_public_state_even_if_publish_at_is_absent(self) -> None:
        client = YouTubeClient.__new__(YouTubeClient)
        client.get_video_status = Mock(
            return_value=YouTubeVideoStatus(
                video_id="video-id",
                processing_status="succeeded",
                upload_status="processed",
                privacy_status="public",
                publish_at=None,
                failure_reason=None,
                rejection_reason=None,
            )
        )
        expected = (
            datetime.now(timezone.utc) + timedelta(hours=1)
        ).isoformat().replace("+00:00", "Z")

        status = client.wait_for_processing(
            "video-id",
            expected_publish_at=expected,
            timeout_seconds=1,
            poll_interval_seconds=1,
        )

        self.assertEqual(status.privacy_status, "public")

    def test_youtube_status_transition_is_monotonic(self) -> None:
        validate_youtube_status_transition("planned", "processing")
        validate_youtube_status_transition("processing", "scheduled")
        validate_youtube_status_transition("scheduled", "published")
        with self.assertRaisesRegex(RuntimeError, "後戻り"):
            validate_youtube_status_transition("processing", "uploaded")
        with self.assertRaisesRegex(RuntimeError, "確定済み"):
            validate_youtube_status_transition("scheduled", "private_review")

    def test_video_summary_keeps_social_distribution_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "short", thumbnail_required=False)
            package.destination_path = "/races/2099-07-12/tokyo/11"
            package.race_number = 11
            package.race_name = "テスト競走"

            summary = youtube_video_pipeline._video_summary(package)

        self.assertEqual(summary["target_date"], "2099-07-12")
        self.assertEqual(summary["venue_name"], "東京")
        self.assertEqual(summary["race_number"], 11)
        self.assertEqual(summary["destination_path"], "/races/2099-07-12/tokyo/11")

    def test_late_schedule_is_rejected_instead_of_silently_shifted(self) -> None:
        target_date = (datetime.now(JST).date() + timedelta(days=1)).isoformat()
        with self.assertRaisesRegex(RuntimeError, "時刻を自動変更せず投稿を中止"):
            build_publish_at(target_date, "00:00", 0)

    def test_all_videos_keep_same_time_when_delayed(self) -> None:
        publish_times, shift_minutes = build_publish_schedule(
            "2026-07-27",
            "19:00",
            [0, 0, 0, 0],
            now_jst=datetime(2026, 7, 26, 18, 43, tzinfo=JST),
            minimum_lead_minutes=20,
            maximum_shift_minutes=240,
        )

        self.assertEqual(shift_minutes, 10)
        self.assertEqual(
            publish_times,
            [
                "2026-07-26T10:10:00Z",
                "2026-07-26T10:10:00Z",
                "2026-07-26T10:10:00Z",
                "2026-07-26T10:10:00Z",
            ],
        )

    def test_on_time_actions_run_schedules_every_video_at_1900(self) -> None:
        publish_times, shift_minutes = build_publish_schedule(
            "2026-07-27",
            "19:00",
            [0, 0, 0],
            now_jst=datetime(2026, 7, 26, 17, 30, tzinfo=JST),
        )

        self.assertEqual(shift_minutes, 0)
        self.assertEqual(
            publish_times,
            [
                "2026-07-26T10:00:00Z",
                "2026-07-26T10:00:00Z",
                "2026-07-26T10:00:00Z",
            ],
        )

    def test_assign_publish_offsets_sets_short_and_all_venues_to_zero(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            long_video = _package(root, "venue_long", thumbnail_required=True)
            short_video = _package(root, "short", thumbnail_required=False)
            long_video.publish_offset_minutes = 30
            short_video.publish_offset_minutes = -20

            ordered = youtube_video_pipeline._assign_publish_offsets(
                [long_video, short_video],
                [],
            )

        self.assertEqual([item.video_type for item in ordered], ["short", "venue_long"])
        self.assertEqual([item.publish_offset_minutes for item in ordered], [0, 0])

    def test_excessively_late_actions_run_is_rejected(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "古い内容の自動公開を中止"):
            build_publish_schedule(
                "2026-07-27",
                "19:00",
                [0, 0],
                now_jst=datetime(2026, 7, 27, 1, 0, tzinfo=JST),
                maximum_shift_minutes=240,
            )

    def test_same_day_recovery_shift_cap_allows_publishing_after_the_stale_anchor(self) -> None:
        # 予約基準は対象日前日19:00 JST。当日復旧では基準が丸1日前になるため、
        # 通常の240分上限では必ず弾かれ、復旧用の上限でのみ公開できる。
        recovery_now = datetime(2026, 8, 20, 12, 30, tzinfo=JST)
        with self.assertRaisesRegex(RuntimeError, "古い内容の自動公開を中止"):
            build_publish_schedule(
                "2026-08-20",
                "19:00",
                [0, 0],
                now_jst=recovery_now,
                maximum_shift_minutes=240,
            )

        publish_times, shift_minutes = build_publish_schedule(
            "2026-08-20",
            "19:00",
            [0, 0],
            now_jst=recovery_now,
            maximum_shift_minutes=2880,
        )
        first_publish_at = datetime.fromisoformat(
            publish_times[0].replace("Z", "+00:00")
        ).astimezone(JST)
        self.assertEqual(shift_minutes, 1100)
        self.assertEqual(len(publish_times), 2)
        self.assertEqual(len(set(publish_times)), 1)
        self.assertGreaterEqual(first_publish_at, recovery_now + timedelta(minutes=45))
        self.assertEqual(first_publish_at.date(), date(2026, 8, 20))

    def test_authenticated_channel_must_match_configured_channel(self) -> None:
        client = YouTubeClient.__new__(YouTubeClient)
        client.channel_id = "expected-channel"
        service = Mock()
        service.channels.return_value.list.return_value.execute.return_value = {
            "items": [{"id": "different-channel"}]
        }
        client._service = service
        with self.assertRaisesRegex(RuntimeError, "一致しません"):
            client.validate_channel()
        service.channels.return_value.list.return_value.execute.assert_called_once_with(num_retries=3)

    def test_invalid_grant_has_actionable_recovery_message(self) -> None:
        from google.auth.exceptions import RefreshError

        client = YouTubeClient.__new__(YouTubeClient)
        client.channel_id = "expected-channel"
        service = Mock()
        service.channels.return_value.list.return_value.execute.side_effect = RefreshError(
            "invalid_grant: Token has been expired or revoked."
        )
        client._service = service

        with self.assertRaisesRegex(RuntimeError, "YOUTUBE_REFRESH_TOKEN") as raised:
            client.validate_channel()

        self.assertIn("本番環境", str(raised.exception))

    def test_video_status_retries_temporary_empty_api_visibility(self) -> None:
        client = YouTubeClient.__new__(YouTubeClient)
        service = Mock()
        request = service.videos.return_value.list.return_value
        request.execute.side_effect = [
            {"items": []},
            {
                "items": [{
                    "status": {"uploadStatus": "processed", "privacyStatus": "private"},
                    "processingDetails": {"processingStatus": "succeeded"},
                }]
            },
        ]
        client._service = service

        with patch("scripts.social_video.youtube_client.time.sleep") as sleep:
            status = client.get_video_status("video-id")

        self.assertEqual(status.processing_status, "succeeded")
        self.assertEqual(request.execute.call_count, 2)
        request.execute.assert_has_calls([call(num_retries=3), call(num_retries=3)])
        sleep.assert_called_once_with(1)

    def test_clear_schedule_treats_remote_public_as_terminal_success(self) -> None:
        client = YouTubeClient.__new__(YouTubeClient)
        service = Mock()
        client._service = service
        public_status = YouTubeVideoStatus(
            video_id="video-id",
            processing_status="succeeded",
            upload_status="processed",
            privacy_status="public",
            publish_at=None,
            failure_reason=None,
            rejection_reason=None,
        )
        client.get_video_status = Mock(return_value=public_status)

        status = client.clear_publish_schedule("video-id")

        self.assertEqual(status, public_status)
        service.videos.return_value.update.assert_not_called()

    def test_reconciliation_marks_due_public_video_as_published(self) -> None:
        record = PublicationRecord(
            platform="youtube",
            target_date="2099-07-12",
            video_type="venue_long",
            stable_id="venue_tokyo",
            status="scheduled",
            content_hash="hash",
            remote_video_id="video-id",
            scheduled_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5),
            attempt_count=1,
            last_error=None,
            metadata={},
        )
        registry = FakeRegistry(record)
        client = _youtube_client()
        client.get_video_status.return_value = YouTubeVideoStatus(
            video_id="video-id",
            processing_status="succeeded",
            upload_status="processed",
            privacy_status="public",
            publish_at=None,
            failure_reason=None,
            rejection_reason=None,
        )

        lines, checks, errors = youtube_video_pipeline._reconcile_recent_publications(registry, client)

        self.assertEqual(checks, 1)
        self.assertEqual(errors, [])
        self.assertIn("published", registry.transitions)
        self.assertTrue(any("公開確認" in line for line in lines))

    def test_reconciliation_marks_manually_published_review_video_as_published(self) -> None:
        record = PublicationRecord(
            platform="youtube",
            target_date="2099-07-12",
            video_type="venue_long",
            stable_id="venue_sonoda",
            status="private_review",
            content_hash="hash",
            remote_video_id="video-id",
            scheduled_at=None,
            attempt_count=1,
            last_error=None,
            metadata={},
        )
        registry = FakeRegistry(record)
        client = _youtube_client()
        client.get_video_status.return_value = YouTubeVideoStatus(
            video_id="video-id",
            processing_status="succeeded",
            upload_status="processed",
            privacy_status="public",
            publish_at=None,
            failure_reason=None,
            rejection_reason=None,
        )

        lines, checks, errors = youtube_video_pipeline._reconcile_recent_publications(registry, client)

        self.assertEqual(checks, 1)
        self.assertEqual(errors, [])
        self.assertEqual(registry.existing.status, "published")
        self.assertTrue(registry.existing.metadata["published_via_manual_review"])
        self.assertTrue(any("公開確認" in line for line in lines))


if __name__ == "__main__":
    unittest.main()
