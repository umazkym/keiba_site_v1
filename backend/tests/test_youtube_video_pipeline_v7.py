from __future__ import annotations

import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts import youtube_video_pipeline
from scripts.social_video.data_loader import HorseVideoData, RaceVideoData, VenueVideoData, merge_expected_races
from scripts.social_video.registry import PublicationRecord
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

    def test_scheduled_mode_falls_back_to_private_when_an_asset_is_blocked(self) -> None:
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

        self.assertIsNone(client.insert_video.call_args.kwargs["publish_at"])
        self.assertEqual(registry.transitions[-1], "private_review")

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

    def test_private_mode_clears_a_previous_future_schedule(self) -> None:
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

        client.clear_publish_schedule.assert_called_once_with("scheduled-video")
        client.insert_video.assert_not_called()
        self.assertEqual(registry.existing.status, "private_review")
        self.assertIsNone(registry.existing.scheduled_at)

    def test_incomplete_race_blocks_only_its_venue(self) -> None:
        valid_horse = HorseVideoData("通常馬", 1, 1, "", 60.0, 0.5)
        valid_race = RaceVideoData("valid", "2026-07-12", "東京", 1, "1R", "芝", 1600, predictions=[valid_horse])
        missing_race = RaceVideoData("missing", "2026-07-12", "大井", 1, "1R", "ダート", 1200, predictions=[])
        publishable, blocked = youtube_video_pipeline._partition_publishable_venues(
            [
                VenueVideoData("東京", "中央", [valid_race]),
                VenueVideoData("大井", "地方", [missing_race]),
            ],
            allow_placeholder_data=False,
        )
        self.assertEqual([venue.venue_name for venue in publishable], ["東京"])
        self.assertIn("大井", blocked)

    def test_newcomer_race_is_excluded_without_blocking_venue(self) -> None:
        valid_horse = HorseVideoData("通常馬", 1, 1, "", 60.0, 0.5)
        first_race = RaceVideoData(
            "race-1",
            "2026-07-24",
            "笠松",
            1,
            "3歳未勝利",
            "ダート",
            1400,
            predictions=[valid_horse],
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
            predictions=[valid_horse],
        )

        publishable, blocked, excluded = youtube_video_pipeline._prepare_publishable_venues(
            [VenueVideoData("笠松", "地方", [first_race, newcomer_race, third_race])],
            allow_placeholder_data=False,
        )

        self.assertEqual(blocked, {})
        self.assertEqual([race.race_number for race in publishable[0].races], [1, 3])
        self.assertEqual([race.race_number for race in publishable[0].excluded_races], [2])
        self.assertEqual(excluded, {"笠松": ["2R 2歳新馬"]})

    def test_placeholder_horse_name_blocks_venue(self) -> None:
        placeholder = HorseVideoData("サンプル馬", 1, 1, "", 60.0, 0.5)
        race = RaceVideoData("sample", "2026-07-12", "東京", 1, "1R", "芝", 1600, predictions=[placeholder])
        publishable, blocked = youtube_video_pipeline._partition_publishable_venues(
            [VenueVideoData("東京", "中央", [race])],
            allow_placeholder_data=False,
        )
        self.assertEqual(publishable, [])
        self.assertIn("東京", blocked)

    def test_database_race_without_predictions_is_added_for_readiness_gate(self) -> None:
        valid_horse = HorseVideoData("通常馬", 1, 1, "", 60.0, 0.5)
        venue = VenueVideoData(
            "東京",
            "中央",
            [RaceVideoData("race-1", "2026-07-12", "東京", 1, "1R", "芝", 1600, predictions=[valid_horse])],
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

        merged = merge_expected_races([venue], [expected_race], "2026-07-12")
        publishable, blocked = youtube_video_pipeline._partition_publishable_venues(
            merged,
            allow_placeholder_data=False,
        )

        self.assertEqual(publishable, [])
        self.assertIn("有効な予測データがないレース: 2R", blocked["東京"])

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

    def test_strong_gambling_language_is_rejected_before_upload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            package = _package(Path(temp_dir), "venue_long", thumbnail_required=True)
            package.title = "絶対に当たる競馬情報"
            youtube_video_pipeline._apply_content_safety_gate([package])
        self.assertFalse(package.publishable)
        self.assertTrue(any("強すぎる競馬表現" in reason for reason in package.publish_block_reasons))

    def test_quota_estimate_counts_thumbnail_only_for_long_videos(self) -> None:
        self.assertEqual(estimate_quota_units(video_count=4, thumbnail_count=3), 574)

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


if __name__ == "__main__":
    unittest.main()
