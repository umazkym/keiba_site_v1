#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.social_video.data_loader import (  # noqa: E402
    RaceVideoData,
    VenueVideoData,
    get_target_date,
    load_venues_for_date,
    normalize_venues,
    pick_shorts_targets,
)
from scripts.social_video.create_design_contact_sheet import (  # noqa: E402
    create_contact_sheet,
    create_motion_review_videos,
)
from scripts.social_video.registry import PublicationRecord, VideoPostRegistry  # noqa: E402
from scripts.social_video.renderer import RenderedVideo, render_long_video, render_short_video  # noqa: E402
from scripts.social_video.visual_assets import validate_asset_library  # noqa: E402
from scripts.social_video.youtube_client import (  # noqa: E402
    YouTubeClient,
    build_publish_schedule,
    estimate_quota_units,
    parse_publish_at,
    validate_publication_mode,
)


DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "youtube_video_dist"
PLACEHOLDER_NAME_MARKERS = ("サンプル", "sample", "dummy", "テスト", "test", "?")
PROHIBITED_VIDEO_PHRASES = ("投資", "必勝", "絶対", "圧倒的", "最強", "消去対象")


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _load_input_json(path: Path, target_date: str):
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if isinstance(payload, dict) and "venues" in payload:
        return normalize_venues(payload.get("race_day", {}), payload.get("weekly_grade_races", []), target_date)
    if isinstance(payload, dict):
        return normalize_venues(payload, payload.get("weekly_grade_races", []) if isinstance(payload.get("weekly_grade_races"), list) else [], target_date)
    raise RuntimeError(f"入力JSONの形式が不正です: {path}")


def _is_placeholder_horse_name(name: str) -> bool:
    normalized = str(name or "").strip().lower()
    if not normalized:
        return True
    return any(marker in normalized for marker in PLACEHOLDER_NAME_MARKERS)


def _has_publishable_predictions(race: RaceVideoData) -> bool:
    valid_scored_horse = any(
        horse.deviation_score is not None and not _is_placeholder_horse_name(horse.horse_name)
        for horse in race.predictions
    )
    has_placeholder = any(_is_placeholder_horse_name(horse.horse_name) for horse in race.predictions)
    return valid_scored_horse and not has_placeholder


def _is_newcomer_race(race: RaceVideoData) -> bool:
    """予測処理と同じ判定で、新馬戦を動画対象外にする。"""
    return "新馬" in str(race.race_name or "")


def _all_venue_races(venue: VenueVideoData) -> List[RaceVideoData]:
    races_by_id = {
        race.id: race
        for race in [*venue.races, *venue.excluded_races]
    }
    return sorted(races_by_id.values(), key=lambda race: race.race_number)


def _venue_readiness_reason(venue: VenueVideoData, allow_placeholder_data: bool) -> str:
    if allow_placeholder_data:
        return ""
    all_races = _all_venue_races(venue)
    if not all_races:
        return "レースがありません"
    race_numbers = [race.race_number for race in all_races]
    expected_numbers = list(range(1, max(race_numbers) + 1))
    if race_numbers != expected_numbers:
        return f"レース番号が連続していません: {race_numbers}"
    invalid_races = [
        race.race_number
        for race in all_races
        if not _is_newcomer_race(race) and not _has_publishable_predictions(race)
    ]
    if invalid_races:
        return f"有効な予測データがないレース: {','.join(f'{number}R' for number in invalid_races)}"
    return ""


def _prepare_publishable_venues(
    venues: List[VenueVideoData],
    allow_placeholder_data: bool,
) -> Tuple[List[VenueVideoData], Dict[str, str], Dict[str, List[str]]]:
    publishable: List[VenueVideoData] = []
    blocked: Dict[str, str] = {}
    excluded_newcomer_races: Dict[str, List[str]] = {}
    for venue in venues:
        reason = _venue_readiness_reason(venue, allow_placeholder_data)
        if reason:
            blocked[venue.venue_name] = reason
            continue

        all_races = _all_venue_races(venue)
        excluded = [race for race in all_races if _is_newcomer_race(race)]
        eligible = [race for race in all_races if not _is_newcomer_race(race)]
        if excluded:
            excluded_newcomer_races[venue.venue_name] = [
                f"{race.race_number}R {race.display_name}"
                for race in excluded
            ]
        if not eligible:
            continue
        publishable.append(
            VenueVideoData(
                venue_name=venue.venue_name,
                race_type=venue.race_type,
                races=eligible,
                excluded_races=excluded,
            )
        )
    return publishable, blocked, excluded_newcomer_races


def _partition_publishable_venues(
    venues: List[VenueVideoData],
    allow_placeholder_data: bool,
) -> Tuple[List[VenueVideoData], Dict[str, str]]:
    publishable, blocked, _ = _prepare_publishable_venues(venues, allow_placeholder_data)
    return publishable, blocked


def _load_venues_with_readiness(
    args: argparse.Namespace,
    target_date: str,
) -> tuple[List[VenueVideoData], Dict[str, str], Dict[str, List[str]]]:
    if args.input_json:
        venues = _load_input_json(Path(args.input_json), target_date)
        return _prepare_publishable_venues(venues, allow_placeholder_data=args.allow_placeholder_data)

    attempts = max(1, int(args.readiness_attempts))
    last_publishable: List[VenueVideoData] = []
    last_blocked: Dict[str, str] = {}
    last_excluded_newcomer_races: Dict[str, List[str]] = {}
    for attempt in range(1, attempts + 1):
        venues = load_venues_for_date(target_date)
        last_publishable, last_blocked, last_excluded_newcomer_races = _prepare_publishable_venues(
            venues,
            allow_placeholder_data=args.allow_placeholder_data,
        )
        if venues and not last_blocked:
            return last_publishable, last_blocked, last_excluded_newcomer_races
        if attempt < attempts:
            details = " / ".join(f"{venue}: {reason}" for venue, reason in last_blocked.items()) or "開催データなし"
            print(f"動画データ準備待ち ({attempt}/{attempts}): {details}")
            time.sleep(max(0, int(args.readiness_delay_seconds)))
    return last_publishable, last_blocked, last_excluded_newcomer_races


def _assign_publish_offsets(rendered: List[RenderedVideo], venues: List[VenueVideoData]) -> List[RenderedVideo]:
    del venues
    for item in rendered:
        item.publish_offset_minutes = 0
    return sorted(
        rendered,
        key=lambda item: (0 if item.video_type == "short" else 1, item.stable_id),
    )


def _apply_content_safety_gate(rendered: List[RenderedVideo]) -> None:
    for item in rendered:
        combined_text = f"{item.title}\n{item.description}"
        matched = sorted({phrase for phrase in PROHIBITED_VIDEO_PHRASES if phrase in combined_text})
        if not matched:
            continue
        item.publishable = False
        item.publish_block_reasons.append(f"強すぎる競馬表現を検出: {', '.join(matched)}")
        try:
            metadata = json.loads(item.metadata_path.read_text(encoding="utf-8"))
            if isinstance(metadata, dict):
                metadata["publishable"] = False
                metadata["publish_block_reasons"] = item.publish_block_reasons
                metadata["asset_warnings"] = item.publish_block_reasons
                item.metadata_path.write_text(
                    json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
        except (OSError, json.JSONDecodeError):
            item.publish_block_reasons.append("メタデータへ表現ゲート結果を保存できません")


def _append_actions_summary(lines: List[str]) -> None:
    summary_path = os.getenv("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    with Path(summary_path).open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def _video_summary(item: RenderedVideo) -> dict:
    return {
        "video_type": item.video_type,
        "stable_id": item.stable_id,
        "title": item.title,
        "video_path": str(item.video_path) if item.video_path else None,
        "thumbnail_path": str(item.thumbnail_path),
        "metadata_path": str(item.metadata_path),
        "target_date": item.target_date,
        "venue_name": item.venue_name,
        "destination_url": item.destination_url,
        "destination_path": item.destination_path,
        "utm_content": item.utm_content,
        "race_number": item.race_number,
        "race_name": item.race_name,
        "vertical_cover_path": str(item.vertical_cover_path) if item.vertical_cover_path else None,
        "variant_video_paths": {
            name: str(path)
            for name, path in sorted(item.variant_video_paths.items())
        },
        "publish_offset_minutes": item.publish_offset_minutes,
        "content_hash": item.content_hash,
        "rights_manifest_hash": item.rights_manifest_hash,
        "thumbnail_required": item.thumbnail_required,
        "publishable": item.publishable,
        "publish_block_reasons": item.publish_block_reasons,
        "selected_assets": item.selected_assets,
    }


def _render_all(args: argparse.Namespace) -> List[RenderedVideo]:
    target_date = args.target_date or get_target_date()
    output_dir = Path(args.output_dir or DEFAULT_OUTPUT_DIR) / target_date
    output_dir.mkdir(parents=True, exist_ok=True)
    asset_validation = validate_asset_library()
    asset_validation_path = output_dir / "asset-validation.json"
    asset_validation_path.write_text(
        json.dumps(asset_validation.to_dict(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        "動画素材を検証しました: "
        f"写真{asset_validation.image_count}件 / コース{asset_validation.course_count}件 / "
        f"音声{asset_validation.audio_count}件 / "
        f"エラー{asset_validation.error_count}件 / 警告{asset_validation.warning_count}件"
    )
    if asset_validation.error_count:
        issue_summary = " / ".join(
            f"{issue.code}: {issue.path or issue.message}"
            for issue in asset_validation.issues
            if issue.severity == "error"
        )
        raise RuntimeError(f"動画素材の権利・形式検証に失敗しました: {issue_summary}")

    venues, blocked_venues, excluded_newcomer_races = _load_venues_with_readiness(args, target_date)
    args.incomplete_venues = blocked_venues
    args.excluded_newcomer_races = excluded_newcomer_races

    if excluded_newcomer_races:
        details = " / ".join(
            f"{venue}: {', '.join(races)}"
            for venue, races in excluded_newcomer_races.items()
        )
        print(f"新馬戦を動画対象から除外しました: {details}")

    only_newcomer_races = not venues and bool(excluded_newcomer_races) and not blocked_venues

    if args.max_venues is not None:
        venues = venues[: max(0, args.max_venues)]

    if not venues:
        if only_newcomer_races:
            message = f"{target_date}は新馬戦を除く動画対象レースがありません。"
            print(f"{message} 動画生成を正常終了します。")
            _append_actions_summary(
                [
                    f"## YouTube動画生成 {target_date}",
                    "",
                    "- 生成本数: 0",
                    "- 結果: 新馬戦のみのため動画対象なし",
                ]
            )
            return []
        message = f"{target_date}の公開可能な開催データが見つかりません。"
        if validate_publication_mode(args.publication_mode) != "disabled" and not args.dry_run:
            raise RuntimeError(message)
        print(f"{message} 動画生成を終了します。")
        return []

    print(f"{target_date} の動画生成を開始します。対象会場: {', '.join(v.venue_name for v in venues)}")
    rendered: List[RenderedVideo] = []
    if args.include_long:
        for venue in venues:
            print(f"長尺動画を生成中: {venue.venue_name}")
            rendered.append(render_long_video(venue, target_date, output_dir, skip_video=args.skip_video))

    if args.include_shorts and args.max_shorts > 0:
        shorts_targets = pick_shorts_targets(venues, min(1, args.max_shorts))
        for index, race in enumerate(shorts_targets, start=1):
            print(f"Shorts動画を生成中: {race.venue_name}{race.race_number}R {race.display_name}")
            rendered.append(render_short_video(race, target_date, output_dir, index=index, skip_video=args.skip_video))

    _apply_content_safety_gate(rendered)
    rendered = _assign_publish_offsets(rendered, venues)
    summary = {
        "target_date": target_date,
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "count": len(rendered),
        "publication_mode": validate_publication_mode(args.publication_mode),
        "blocked_venues": blocked_venues,
        "excluded_newcomer_races": excluded_newcomer_races,
        "videos": [_video_summary(item) for item in rendered],
        "asset_validation": asset_validation.to_dict(),
        "asset_validation_path": str(asset_validation_path),
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    contact_sheet = create_contact_sheet(output_dir, output_dir / "design-contact-sheet.png")
    print(f"デザイン確認シート: {contact_sheet}")
    if args.dry_run and not args.skip_video:
        review_videos = create_motion_review_videos(output_dir)
        for review_video in review_videos:
            print(f"モーション確認動画: {review_video}")
    print(f"動画生成サマリー: {output_dir / 'summary.json'}")
    _append_actions_summary(
        [
            f"## YouTube動画生成 {target_date}",
            "",
            f"- 生成本数: {len(rendered)}",
            f"- 対象会場: {', '.join(venue.venue_name for venue in venues)}",
            (
                "- 除外した新馬戦: "
                + " / ".join(
                    f"{venue}: {', '.join(races)}"
                    for venue, races in excluded_newcomer_races.items()
                )
                if excluded_newcomer_races
                else "- 除外した新馬戦: なし"
            ),
            f"- 保留会場: {', '.join(blocked_venues) if blocked_venues else 'なし'}",
            f"- 公開モード: {validate_publication_mode(args.publication_mode)}",
        ]
    )
    return rendered


def _utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _format_publish_at(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    aware = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    return aware.isoformat().replace("+00:00", "Z")


def _is_retryable_status_visibility_error(record: PublicationRecord) -> bool:
    return bool(
        record.remote_video_id
        and record.status in {"uploaded", "thumbnail_set", "thumbnail_skipped", "processing"}
        and record.last_error
        and "YouTube上の動画状態を取得できません" in record.last_error
    )


def _reconcile_recent_publications(
    registry: VideoPostRegistry,
    client: YouTubeClient,
) -> Tuple[List[str], int, List[str]]:
    """公開時刻を過ぎた予約動画を照合し、publishedまたはエラーへ更新する。"""
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    lines: List[str] = []
    errors: List[str] = []
    checks = 0
    records = registry.list_recent(days=7, statuses={"scheduled"})
    for record in records:
        if not record.remote_video_id or record.scheduled_at is None:
            error = f"予約レコードに動画IDまたは公開時刻がありません: {record.stable_id}"
            registry.record_error(record.target_date, record.video_type, record.stable_id, error)
            errors.append(error)
            continue
        scheduled_at = _utc_naive(record.scheduled_at)
        if scheduled_at > now_utc:
            continue
        try:
            status = client.get_video_status(record.remote_video_id)
            checks += 1
            if status.processing_status in {"failed", "terminated"} or status.upload_status in {
                "failed",
                "rejected",
                "deleted",
            }:
                reason = status.failure_reason or status.rejection_reason or status.processing_status or status.upload_status
                raise RuntimeError(f"YouTube処理失敗: {reason}")
            if status.privacy_status == "public":
                registry.transition(
                    record.target_date,
                    record.video_type,
                    record.stable_id,
                    "published",
                    remote_video_id=record.remote_video_id,
                    scheduled_at=record.scheduled_at,
                    metadata={
                        "processing_status": status.processing_status,
                        "upload_status": status.upload_status,
                        "privacy_status": status.privacy_status,
                        "published_checked_at": now_utc.isoformat() + "Z",
                    },
                )
                lines.append(f"- 公開確認: {record.stable_id}")
            elif now_utc > scheduled_at + timedelta(hours=1):
                raise RuntimeError(
                    "予約公開時刻から1時間を過ぎても公開状態になっていません"
                    f"（privacyStatus={status.privacy_status}）"
                )
            else:
                lines.append(f"- 公開反映待ち: {record.stable_id}")
        except Exception as exc:
            error = f"{record.stable_id}: {exc}"
            registry.record_error(record.target_date, record.video_type, record.stable_id, error)
            errors.append(error)
            lines.append(f"- 公開確認エラー: {error}")
    if not records:
        lines.append("- 直近の予約公開照合: 対象なし")
    return lines, checks, errors


def _upload_all(args: argparse.Namespace, rendered: List[RenderedVideo]) -> None:
    target_date = args.target_date or get_target_date()
    publication_mode = validate_publication_mode(args.publication_mode)
    upload_enabled = _env_flag("YOUTUBE_UPLOAD_ENABLED", False)
    if args.skip_upload or args.dry_run or publication_mode == "disabled" or not upload_enabled:
        print(
            "YouTubeアップロードはスキップします。"
            "YOUTUBE_UPLOAD_ENABLED=trueかつYOUTUBE_PUBLICATION_MODE=private_review/scheduled_publicで有効化できます。"
        )
        return
    if args.disable_registry:
        raise RuntimeError("投稿時は重複防止レジストリを無効化できません。")
    if args.force:
        raise RuntimeError("--forceはv7では使用できません。既存動画を保護したまま状態から再開してください。")

    registry = VideoPostRegistry(enabled=not args.disable_registry)
    if not registry.enabled:
        raise RuntimeError("動画投稿レジストリを初期化できません。投稿を中止します。")
    client = YouTubeClient()
    client.validate_channel()
    reconciliation_lines, reconciliation_checks, reconciliation_errors = _reconcile_recent_publications(registry, client)
    recent_records = registry.list_recent(days=7)
    retryable_recent_errors = [
        record
        for record in recent_records
        if record.last_error and _is_retryable_status_visibility_error(record)
    ]
    recent_errors = [
        record
        for record in recent_records
        if record.last_error and not _is_retryable_status_visibility_error(record)
    ]
    status_counts: Dict[str, int] = {}
    for record in recent_records:
        status_counts[record.status] = status_counts.get(record.status, 0) + 1
    status_summary = ", ".join(f"{status}={count}" for status, count in sorted(status_counts.items())) or "記録なし"
    reconciliation_lines.append(f"- 直近7日DB状態: {status_summary} / errors={len(recent_errors)}")
    if retryable_recent_errors:
        reconciliation_lines.append(
            f"- 状態反映待ちから再開: {len(retryable_recent_errors)}件"
        )
    safety_reasons: List[str] = []
    if any(not item.publishable for item in rendered):
        safety_reasons.append("素材・権利ゲート保留あり")
    if reconciliation_errors or recent_errors:
        safety_reasons.append("直近7日間の投稿エラーあり")
    if publication_mode == "scheduled_public" and safety_reasons:
        publication_mode = "private_review"
        print(f"安全ゲートにより非公開レビューへ切り替えます: {', '.join(safety_reasons)}")

    schedule_clear_candidates = [
        record
        for record in recent_records
        if publication_mode == "private_review"
        and record.target_date == target_date
        and record.remote_video_id
        and record.scheduled_at is not None
        and record.status != "published"
    ]
    quota_budget = max(1, int(args.quota_budget))
    quota_estimate = estimate_quota_units(
        video_count=len([item for item in rendered if item.publishable]),
        thumbnail_count=len([item for item in rendered if item.publishable and item.thumbnail_required]),
    ) + 1 + reconciliation_checks + len(schedule_clear_candidates) * 51
    if quota_estimate > quota_budget:
        raise RuntimeError(f"YouTube APIクォータ概算が安全上限を超えます: {quota_estimate}/{quota_budget}")

    uploaded_lines = [
        "",
        "### YouTube投稿",
        f"- APIクォータ概算: {quota_estimate}/{quota_budget}",
        f"- 実効公開モード: {publication_mode}",
        *reconciliation_lines,
    ]
    if safety_reasons:
        uploaded_lines.append(f"- 安全ゲート: {', '.join(safety_reasons)}")

    publishable_items = [item for item in rendered if item.publishable]
    publish_at_by_key: Dict[Tuple[str, str], Optional[str]] = {
        (item.video_type, item.stable_id): None
        for item in publishable_items
    }
    schedule_shift_minutes = 0
    if publication_mode == "scheduled_public":
        publish_schedule, schedule_shift_minutes = build_publish_schedule(
            target_date,
            args.publish_time_jst,
            [item.publish_offset_minutes for item in publishable_items],
            minimum_lead_minutes=args.publish_min_lead_minutes,
            maximum_shift_minutes=args.max_publish_shift_minutes,
        )
        publish_at_by_key.update(
            {
                (item.video_type, item.stable_id): publish_at
                for item, publish_at in zip(publishable_items, publish_schedule)
            }
        )
        if schedule_shift_minutes:
            first_publish_at = min(
                datetime.fromisoformat(value.replace("Z", "+00:00"))
                for value in publish_schedule
            ).astimezone(timezone(timedelta(hours=9)))
            delay_message = (
                "GitHub Actionsの起動遅延に合わせ、全動画の同時公開を維持したまま"
                f"全予約を{schedule_shift_minutes}分後ろ倒ししました"
                f"（最初の公開: {first_publish_at.strftime('%Y-%m-%d %H:%M JST')}）"
            )
            print(delay_message)
            uploaded_lines.append(f"- 遅延時刻補正: {delay_message}")

    reserved_records = {}
    try:
        for item in publishable_items:
            publication_metadata = item.publication_metadata()
            if schedule_shift_minutes:
                publication_metadata["schedule_shift_minutes"] = schedule_shift_minutes
            reserved_records[(item.video_type, item.stable_id)] = registry.reserve(
                target_date=target_date,
                video_type=item.video_type,
                stable_id=item.stable_id,
                content_hash=item.content_hash,
                metadata=publication_metadata,
            )
    except Exception as exc:
        uploaded_lines.append(f"- 投稿前検証で停止: {exc}")
        _append_actions_summary(uploaded_lines)
        raise

    for item in rendered:
        if not item.publishable:
            reasons = " / ".join(item.publish_block_reasons) or "素材要件を満たしていません"
            print(f"素材不足のためYouTube投稿をスキップ: {item.video_type} {item.stable_id} ({reasons})")
            uploaded_lines.append(f"- 保留: {item.title}（{reasons}）")
            continue

        record = reserved_records[(item.video_type, item.stable_id)]
        if record.is_terminal:
            if (
                record.status == "scheduled"
                and publication_mode == "private_review"
                and record.remote_video_id
            ):
                try:
                    client.clear_publish_schedule(record.remote_video_id)
                    registry.transition(
                        target_date,
                        item.video_type,
                        item.stable_id,
                        "private_review",
                        remote_video_id=record.remote_video_id,
                        clear_scheduled_at=True,
                        metadata={"publish_schedule_cleared": True},
                    )
                except Exception as exc:
                    registry.record_error(target_date, item.video_type, item.stable_id, str(exc))
                    uploaded_lines.append(f"- 予約解除失敗: {item.title}（{exc}）")
                    _append_actions_summary(uploaded_lines)
                    raise
                print(f"安全モードのため予約公開を解除: {item.video_type} {item.stable_id}")
                uploaded_lines.append(f"- 予約解除・非公開維持: {item.title}")
                continue
            print(f"投稿完了済みのためスキップ: {item.video_type} {item.stable_id} ({record.status})")
            uploaded_lines.append(f"- 再利用: {item.title}（{record.status}）")
            continue
        if item.video_path is None:
            raise RuntimeError(f"動画ファイルが生成されていないためアップロードできません: {item.stable_id}")

        publish_at = publish_at_by_key[(item.video_type, item.stable_id)]
        if (
            publication_mode == "scheduled_public"
            and record.remote_video_id
            and record.scheduled_at is not None
        ):
            publish_at = _format_publish_at(record.scheduled_at)
        mode_label = f"予約公開 {publish_at}" if publish_at else "非公開レビュー"
        print(f"YouTubeへ投稿します: {item.title} ({mode_label})")
        try:
            video_id = record.remote_video_id
            if not video_id:
                result = client.insert_video(
                    video_path=item.video_path,
                    title=item.title,
                    description=item.description,
                    tags=item.tags,
                    publish_at=publish_at,
                    notify_subscribers=False,
                )
                video_id = result.video_id
                record = registry.transition(
                    target_date,
                    item.video_type,
                    item.stable_id,
                    "uploaded",
                    remote_video_id=video_id,
                    scheduled_at=parse_publish_at(publish_at),
                    metadata={
                        "watch_url": result.watch_url,
                        "schedule_shift_minutes": schedule_shift_minutes,
                    },
                )

            if publication_mode == "private_review" and record.scheduled_at is not None:
                client.clear_publish_schedule(video_id)
                record = registry.transition(
                    target_date,
                    item.video_type,
                    item.stable_id,
                    record.status,
                    remote_video_id=video_id,
                    clear_scheduled_at=True,
                    metadata={"publish_schedule_cleared": True},
                )

            completed_thumbnail_states = {
                "thumbnail_set",
                "thumbnail_skipped",
                "processing",
                "private_review",
                "scheduled",
                "published",
            }
            if record.status not in completed_thumbnail_states:
                if item.thumbnail_required:
                    client.set_thumbnail(video_id, item.thumbnail_path)
                    record = registry.transition(
                        target_date,
                        item.video_type,
                        item.stable_id,
                        "thumbnail_set",
                        remote_video_id=video_id,
                    )
                else:
                    record = registry.transition(
                        target_date,
                        item.video_type,
                        item.stable_id,
                        "thumbnail_skipped",
                        remote_video_id=video_id,
                    )

            if record.status != "processing":
                record = registry.transition(
                    target_date,
                    item.video_type,
                    item.stable_id,
                    "processing",
                    remote_video_id=video_id,
                )
            status = client.wait_for_processing(
                video_id,
                expected_publish_at=publish_at,
                timeout_seconds=args.processing_timeout_seconds,
                poll_interval_seconds=args.processing_poll_seconds,
            )
            final_status = "scheduled" if publication_mode == "scheduled_public" else "private_review"
            if status.privacy_status == "public":
                final_status = "published"
            registry.transition(
                target_date,
                item.video_type,
                item.stable_id,
                final_status,
                remote_video_id=video_id,
                scheduled_at=parse_publish_at(publish_at),
                metadata={
                    "processing_status": status.processing_status,
                    "upload_status": status.upload_status,
                    "privacy_status": status.privacy_status,
                },
            )
            watch_url = f"https://www.youtube.com/watch?v={video_id}"
            print(f"YouTube投稿成功: {watch_url} ({final_status})")
            uploaded_lines.append(f"- {final_status}: {item.title} — {watch_url}")
        except Exception as exc:
            try:
                registry.record_error(target_date, item.video_type, item.stable_id, str(exc))
            except Exception as registry_exc:
                print(f"警告: 投稿エラー状態の保存にも失敗しました: {registry_exc}")
            uploaded_lines.append(f"- 失敗: {item.title}（{exc}）")
            _append_actions_summary(uploaded_lines)
            raise
    _append_actions_summary(uploaded_lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UMA-FREEのYouTube向け自動動画生成・投稿パイプライン")
    parser.add_argument("--target-date", help="対象日 YYYY-MM-DD。未指定なら翌日JST")
    parser.add_argument("--input-json", help="ローカルJSONから生成する検証用入力")
    parser.add_argument("--output-dir", help="出力ディレクトリ。未指定なら youtube_video_dist")
    parser.add_argument("--max-venues", type=int, default=None, help="検証用に生成会場数を制限")
    parser.add_argument("--max-shorts", type=int, default=int(os.getenv("YOUTUBE_MAX_SHORTS", "1")), help="Shorts生成上限。v7では最大1本")
    parser.add_argument("--publish-time-jst", default=os.getenv("YOUTUBE_PUBLISH_TIME_JST", "19:00"), help="翌日分を公開予約するJST時刻 HH:MM")
    parser.add_argument(
        "--publish-min-lead-minutes",
        type=int,
        default=int(os.getenv("YOUTUBE_PUBLISH_MIN_LEAD_MINUTES", "20")),
        help="遅延時に最初の予約公開まで確保する最低猶予分数",
    )
    parser.add_argument(
        "--max-publish-shift-minutes",
        type=int,
        default=int(os.getenv("YOUTUBE_MAX_PUBLISH_SHIFT_MINUTES", "240")),
        help="GitHub Actions遅延時に許可する予約時刻の最大後ろ倒し分数",
    )
    parser.add_argument(
        "--publication-mode",
        default=os.getenv("YOUTUBE_PUBLICATION_MODE", "disabled"),
        choices=["disabled", "private_review", "scheduled_public"],
        help="disabled=生成のみ、private_review=非公開投稿、scheduled_public=予約公開",
    )
    parser.add_argument(
        "--readiness-attempts",
        type=int,
        default=int(os.getenv("YOUTUBE_READINESS_ATTEMPTS", "1")),
        help="翌日データの準備確認回数",
    )
    parser.add_argument(
        "--readiness-delay-seconds",
        type=int,
        default=int(os.getenv("YOUTUBE_READINESS_DELAY_SECONDS", "600")),
        help="翌日データ再確認までの待機秒数",
    )
    parser.add_argument(
        "--quota-budget",
        type=int,
        default=int(os.getenv("YOUTUBE_DAILY_QUOTA_BUDGET", "8000")),
        help="1実行で使用してよいYouTube Data APIクォータ概算の上限",
    )
    parser.add_argument(
        "--processing-timeout-seconds",
        type=int,
        default=int(os.getenv("YOUTUBE_PROCESSING_TIMEOUT_SECONDS", "600")),
        help="YouTube側の動画処理完了を待つ上限秒数",
    )
    parser.add_argument(
        "--processing-poll-seconds",
        type=int,
        default=int(os.getenv("YOUTUBE_PROCESSING_POLL_SECONDS", "10")),
        help="YouTube動画処理状態の確認間隔",
    )
    parser.add_argument("--dry-run", action="store_true", help="生成のみ行い、アップロードしない")
    parser.add_argument("--skip-upload", action="store_true", help="YouTubeアップロードを常にスキップ")
    parser.add_argument("--skip-video", action="store_true", help="PNG/metadataのみ生成し、ffmpegによるMP4作成をスキップ")
    parser.add_argument("--allow-placeholder-data", action="store_true", help="検証用。サンプル馬名や空データの除外を無効化する")
    parser.add_argument("--disable-registry", action="store_true", help="DBの重複投稿レジストリを使わない")
    parser.add_argument("--force", action="store_true", help="投稿済み判定を無視してアップロードする")
    parser.add_argument("--no-long", dest="include_long", action="store_false", help="会場別長尺動画を生成しない")
    parser.add_argument("--no-shorts", dest="include_shorts", action="store_false", help="Shorts動画を生成しない")
    parser.set_defaults(include_long=True, include_shorts=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.target_date:
        args.target_date = get_target_date()
    publication_mode = validate_publication_mode(args.publication_mode)
    upload_requested = publication_mode != "disabled" and not args.dry_run and not args.skip_upload
    if upload_requested and (args.input_json or args.allow_placeholder_data):
        raise RuntimeError(
            "入力JSONまたはプレースホルダー許可を使ったYouTube投稿は禁止しています。"
            "実DBの確定データで実行してください。"
        )
    args.incomplete_venues = {}
    rendered = _render_all(args)
    if rendered:
        _upload_all(args, rendered)
    if args.incomplete_venues and validate_publication_mode(args.publication_mode) != "disabled":
        details = " / ".join(f"{venue}: {reason}" for venue, reason in args.incomplete_venues.items())
        raise RuntimeError(f"一部会場の動画を保留しました: {details}")


if __name__ == "__main__":
    main()
