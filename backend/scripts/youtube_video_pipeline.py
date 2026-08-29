#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


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
    order_venues_for_daily_compilation,
    pick_daily_short_races,
)
from scripts.social_video.create_design_contact_sheet import (  # noqa: E402
    create_contact_sheet,
    create_motion_review_videos,
)
from scripts.social_video.registry import PublicationRecord, VideoPostRegistry  # noqa: E402
from scripts.social_video.renderer import (  # noqa: E402
    RenderedVideo,
    render_daily_long_video,
    render_daily_short_video,
)
from scripts.social_video.visual_assets import validate_asset_library  # noqa: E402
from scripts.social_video.youtube_client import (  # noqa: E402
    YouTubeClient,
    build_publish_schedule,
    estimate_quota_units,
    parse_publish_at,
    validate_publication_mode,
)
from scripts.race_classification import prediction_exclusion_reason  # noqa: E402


DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "youtube_video_dist"
PLACEHOLDER_HORSE_NAMES = frozenset(
    {
        "",
        "?",
        "サンプル",
        "サンプル馬",
        "sample",
        "sample horse",
        "dummy",
        "dummy horse",
        "テスト",
        "テスト馬",
        "test",
        "test horse",
    }
)
PROHIBITED_VIDEO_PHRASES = ("投資", "必勝", "絶対", "圧倒的", "最強", "消去対象")
REPLACEMENT_REVISION_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,47}$")


@dataclass(frozen=True)
class UploadContext:
    registry: VideoPostRegistry
    client: YouTubeClient
    authenticated_channel_id: str


@dataclass(frozen=True)
class RaceOmission:
    race_id: str
    venue_name: str
    race_number: int
    race_name: str
    grade: str
    reason: str
    category: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "race_id": self.race_id,
            "venue_name": self.venue_name,
            "race_number": self.race_number,
            "race_name": self.race_name,
            "grade": self.grade,
            "reason": self.reason,
            "category": self.category,
        }


@dataclass(frozen=True)
class PreparedVideoData:
    venues: List[VenueVideoData]
    omitted_races: List[RaceOmission]
    data_source: str
    retry_count: int
    source_race_count: int
    load_errors: Tuple[str, ...] = ()

    @property
    def actual_race_count(self) -> int:
        return sum(len(venue.races) for venue in self.venues)

    @property
    def coverage_status(self) -> str:
        if not self.venues:
            return "empty"
        return "partial" if self.omitted_races else "complete"

    @property
    def blocking_omissions(self) -> List[RaceOmission]:
        return [
            item
            for item in self.omitted_races
            if item.category != "expected_exclusion"
        ]

    @property
    def readiness_status(self) -> str:
        if not self.venues:
            return "empty"
        if self.blocking_omissions:
            return "incomplete"
        if self.omitted_races:
            return "ready_with_expected_exclusions"
        return "ready"


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
    normalized = unicodedata.normalize("NFKC", str(name or "")).strip().casefold()
    return normalized in PLACEHOLDER_HORSE_NAMES


def _valid_scored_horses(race: RaceVideoData) -> List[Any]:
    valid = []
    for horse in race.predictions:
        if horse.horse_number <= 0 or _is_placeholder_horse_name(horse.horse_name):
            continue
        if horse.deviation_score is None:
            continue
        try:
            if not math.isfinite(float(horse.deviation_score)):
                continue
        except (TypeError, ValueError):
            continue
        valid.append(horse)
    return valid


def _has_publishable_predictions(race: RaceVideoData) -> bool:
    return len(_valid_scored_horses(race)) >= 3


def _prediction_exclusion_reason(race: RaceVideoData) -> str:
    """予測処理と同じ判定で、AI偏差値の算出対象外理由を返す。"""
    return prediction_exclusion_reason(race.race_name, race.course_type)


def _is_prediction_excluded_race(race: RaceVideoData) -> bool:
    return bool(_prediction_exclusion_reason(race))


def _all_venue_races(venue: VenueVideoData) -> List[RaceVideoData]:
    races_by_id = {
        race.id: race
        for race in [*venue.races, *venue.excluded_races]
    }
    return sorted(races_by_id.values(), key=lambda race: race.race_number)


def _race_omission(race: RaceVideoData, *, placeholder_count: int = 0) -> RaceOmission:
    explicit_reason = _prediction_exclusion_reason(race)
    reasons = sorted(
        {
            horse.unpredictable_reason.strip()
            for horse in race.predictions
            if horse.unpredictable_reason.strip()
        }
    )
    valid_count = len(_valid_scored_horses(race))
    if explicit_reason:
        reason = explicit_reason.rstrip("。")
        category = "expected_exclusion"
    elif reasons and all("予測対象外" in reason for reason in reasons):
        reason = " / ".join(reasons).rstrip("。")
        category = "expected_exclusion"
    elif not race.predictions:
        reason = "Predictionレコードがありません"
        category = "missing_predictions"
    elif any("予測計算中にエラー" in reason for reason in reasons):
        reason = "予測計算エラーが残っています"
        category = "prediction_error"
    else:
        reason = f"有効なAI偏差値が3頭未満です（{valid_count}頭）"
        category = "insufficient_scores"
    if placeholder_count:
        reason += f" / プレースホルダー馬{placeholder_count}頭を除外"
    return RaceOmission(
        race_id=race.id,
        venue_name=race.venue_name,
        race_number=race.race_number,
        race_name=race.display_name,
        grade=race.grade or "",
        reason=reason,
        category=category,
    )


def _prepare_publishable_venues(
    venues: List[VenueVideoData],
    allow_placeholder_data: bool,
) -> Tuple[List[VenueVideoData], List[RaceOmission]]:
    publishable: List[VenueVideoData] = []
    omissions: List[RaceOmission] = []
    for venue in venues:
        all_races = _all_venue_races(venue)
        eligible: List[RaceVideoData] = []
        excluded: List[RaceVideoData] = []
        for race in all_races:
            placeholder_count = sum(
                1 for horse in race.predictions if _is_placeholder_horse_name(horse.horse_name)
            )
            clean_predictions = (
                list(race.predictions)
                if allow_placeholder_data
                else [
                    horse
                    for horse in race.predictions
                    if not _is_placeholder_horse_name(horse.horse_name)
                ]
            )
            clean_race = replace(race, predictions=clean_predictions)
            if allow_placeholder_data and clean_race.predictions:
                eligible.append(clean_race)
                continue
            if not _is_prediction_excluded_race(clean_race) and _has_publishable_predictions(clean_race):
                eligible.append(clean_race)
                continue
            omission = _race_omission(clean_race, placeholder_count=placeholder_count)
            omissions.append(omission)
            excluded.append(replace(clean_race, omission_reason=omission.reason))
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
    return publishable, omissions


def _partition_publishable_venues(
    venues: List[VenueVideoData],
    allow_placeholder_data: bool,
) -> Tuple[List[VenueVideoData], List[RaceOmission]]:
    return _prepare_publishable_venues(venues, allow_placeholder_data)


def _source_race_count(venues: Iterable[VenueVideoData]) -> int:
    return sum(len(_all_venue_races(venue)) for venue in venues)


def _is_video_data_ready(
    publishable: List[VenueVideoData],
    omissions: List[RaceOmission],
) -> bool:
    return bool(publishable) and all(
        item.category == "expected_exclusion"
        for item in omissions
    )


def _ensure_video_data_ready(
    prepared: PreparedVideoData,
    target_date: str,
) -> None:
    blocking = prepared.blocking_omissions
    if not blocking:
        return
    details = " / ".join(
        f"{item.venue_name}{item.race_number}R {item.race_name}（{item.reason}）"
        for item in blocking
    )
    message = (
        f"{target_date}は{prepared.retry_count}回再確認しても、"
        f"収録対象{prepared.source_race_count}レースの予測データが揃っていません: "
        f"{details}"
    )
    _append_actions_summary(
        [
            f"## YouTube動画生成 {target_date}",
            "",
            "- 生成本数: 0",
            "- readiness_status: incomplete",
            f"- データ取得元: {prepared.data_source}",
            f"- 再取得回数: {prepared.retry_count}",
            f"- 取得レース数: {prepared.source_race_count}",
            f"- 収録可能レース数: {prepared.actual_race_count}",
            "- 結果: 予測データ準備未完了のため、動画生成・投稿前に停止",
            f"- 未完了レース: {details}",
        ]
    )
    raise RuntimeError(message)


def _load_venues_with_readiness(
    args: argparse.Namespace,
    target_date: str,
) -> PreparedVideoData:
    if args.input_json:
        venues = _load_input_json(Path(args.input_json), target_date)
        publishable, omissions = _prepare_publishable_venues(
            venues,
            allow_placeholder_data=args.allow_placeholder_data,
        )
        return PreparedVideoData(
            venues=publishable,
            omitted_races=omissions,
            data_source="input_json",
            retry_count=0,
            source_race_count=_source_race_count(venues),
        )

    attempts = max(1, int(args.readiness_attempts))
    last_publishable: List[VenueVideoData] = []
    last_omissions: List[RaceOmission] = []
    last_data_source = "unavailable"
    last_source_race_count = 0
    load_errors: List[str] = []
    for attempt in range(1, attempts + 1):
        diagnostics: Dict[str, Any] = {}
        try:
            venues = load_venues_for_date(
                target_date,
                force_refresh=attempt > 1,
                diagnostics=diagnostics,
            )
            last_data_source = str(diagnostics.get("data_source") or "unknown")
            last_source_race_count = _source_race_count(venues)
            last_publishable, last_omissions = _prepare_publishable_venues(
                venues,
                allow_placeholder_data=args.allow_placeholder_data,
            )
        except Exception as exc:
            venues = []
            last_publishable = []
            last_omissions = []
            last_data_source = "unavailable"
            error = f"{type(exc).__name__}: 動画データを取得できません"
            load_errors.append(error)
            print(f"動画データ取得エラー ({attempt}/{attempts}): {error}")
        if _is_video_data_ready(last_publishable, last_omissions):
            return PreparedVideoData(
                venues=last_publishable,
                omitted_races=last_omissions,
                data_source=last_data_source,
                retry_count=attempt - 1,
                source_race_count=last_source_race_count,
                load_errors=tuple(load_errors),
            )
        if attempt < attempts:
            details = (
                " / ".join(
                    f"{item.venue_name}{item.race_number}R: {item.reason}"
                    for item in last_omissions[:8]
                )
                or "収録可能なAI分析データなし"
            )
            print(f"動画データ準備待ち ({attempt}/{attempts}): {details}")
            time.sleep(max(0, int(args.readiness_delay_seconds)))
    return PreparedVideoData(
        venues=last_publishable,
        omitted_races=last_omissions,
        data_source=last_data_source,
        retry_count=max(0, attempts - 1),
        source_race_count=last_source_race_count,
        load_errors=tuple(load_errors),
    )


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
        "race_ids": item.race_ids,
        "actual_race_count": len(item.race_ids),
        "estimated_duration_seconds": round(item.estimated_duration_seconds, 3),
        "featured_races": item.featured_races,
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


def _is_upload_requested(args: argparse.Namespace) -> bool:
    return bool(
        validate_publication_mode(args.publication_mode) != "disabled"
        and not args.skip_upload
        and not args.dry_run
        and _env_flag("YOUTUBE_UPLOAD_ENABLED", False)
    )


def _replacement_revision(args: argparse.Namespace) -> str:
    return str(getattr(args, "replacement_revision", "") or "").strip()


def _validate_replacement_request(args: argparse.Namespace) -> None:
    revision = _replacement_revision(args)
    supersede_existing = bool(getattr(args, "supersede_existing", False))
    if revision and not REPLACEMENT_REVISION_PATTERN.fullmatch(revision):
        raise RuntimeError(
            "replacement_revisionは英小文字・数字・ハイフンのみ48文字以内で指定してください。"
        )
    if supersede_existing and not revision:
        raise RuntimeError("supersede_existingにはreplacement_revisionが必要です。")
    if supersede_existing and not _is_upload_requested(args):
        raise RuntimeError("既存動画の差し替え確定はYouTubeアップロード有効時だけ実行できます。")
    if revision and _is_upload_requested(args) and not supersede_existing:
        raise RuntimeError(
            "差し替え版をアップロードする場合はsupersede_existingを有効にしてください。"
        )


def _apply_replacement_revision(rendered: List[RenderedVideo], revision: str) -> None:
    if not revision:
        return
    for item in rendered:
        base_stable_id = item.stable_id
        item.stable_id = f"{base_stable_id}__{revision}"
        try:
            metadata = json.loads(item.metadata_path.read_text(encoding="utf-8"))
            if isinstance(metadata, dict):
                metadata["stable_id"] = item.stable_id
                metadata["replacement_revision"] = revision
                metadata["replacement_of_stable_id"] = base_stable_id
                item.metadata_path.write_text(
                    json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(
                f"差し替え版メタデータを更新できません: {item.metadata_path}"
            ) from exc


def _validate_replacement_coverage(
    args: argparse.Namespace,
    prepared: PreparedVideoData,
    rendered: List[RenderedVideo],
    included_races: List[dict[str, Any]],
    omitted_races: List[dict[str, Any]],
    coverage_status: str,
    render_errors: List[str],
) -> Optional[dict[str, int]]:
    revision = _replacement_revision(args)
    if not revision:
        return None
    required_video_types = set()
    if args.include_long:
        required_video_types.add("daily_long")
    if args.include_shorts and args.max_shorts > 0:
        required_video_types.add("short")
    generated_video_types = {item.video_type for item in rendered}
    missing_video_types = sorted(required_video_types - generated_video_types)
    blocked_videos = [item.stable_id for item in rendered if not item.publishable]
    expected_exclusion_ids = {
        str(item.get("race_id") or "").strip()
        for item in omitted_races
        if item.get("category") == "expected_exclusion"
        and str(item.get("race_id") or "").strip()
    }
    blocking_omissions = [
        item
        for item in omitted_races
        if item.get("category") != "expected_exclusion"
    ]
    expected_recordable_count = max(
        0,
        prepared.source_race_count - len(expected_exclusion_ids),
    )
    if (
        prepared.actual_race_count == expected_recordable_count
        and len(included_races) == expected_recordable_count
        and not blocking_omissions
        and not render_errors
        and not missing_video_types
        and not blocked_videos
    ):
        return {
            "expected_recordable_count": expected_recordable_count,
            "expected_exclusion_count": len(expected_exclusion_ids),
        }

    details = [
        f"coverage_status={coverage_status}",
        f"収録可能={prepared.actual_race_count}/{expected_recordable_count}",
        f"横動画収録={len(included_races)}/{expected_recordable_count}",
        f"期待除外={len(expected_exclusion_ids)}件",
    ]
    if blocking_omissions:
        details.append(
            "異常除外="
            + " / ".join(
                f"{item.get('venue_name')}{item.get('race_number')}R "
                f"{item.get('race_name')}（{item.get('category')}）"
                for item in blocking_omissions
            )
        )
    if render_errors:
        details.append("生成エラー=" + " / ".join(render_errors))
    if missing_video_types:
        details.append("未生成=" + ",".join(missing_video_types))
    if blocked_videos:
        details.append("公開不可=" + ",".join(blocked_videos))
    raise RuntimeError("差し替え版は収録対象レースを網羅できないため停止します: " + " / ".join(details))


def _ensure_standard_render_coverage(
    args: argparse.Namespace,
    target_date: str,
    venues: List[VenueVideoData],
    rendered: List[RenderedVideo],
    included_races: List[dict[str, Any]],
    render_omissions: List[dict[str, Any]],
    render_errors: List[str],
) -> None:
    required_video_types = set()
    if args.include_long:
        required_video_types.add("daily_long")
    if args.include_shorts and args.max_shorts > 0:
        required_video_types.add("short")
    generated_video_types = {item.video_type for item in rendered}
    missing_video_types = sorted(required_video_types - generated_video_types)
    blocked_videos = [item.stable_id for item in rendered if not item.publishable]
    expected_race_ids = {
        race.id
        for venue in venues
        for race in venue.races
    }
    included_race_ids = {
        str(item.get("race_id") or "").strip()
        for item in included_races
        if str(item.get("race_id") or "").strip()
    }
    missing_long_race_ids = sorted(expected_race_ids - included_race_ids)

    if (
        not render_omissions
        and not render_errors
        and not missing_video_types
        and not blocked_videos
        and (not args.include_long or not missing_long_race_ids)
    ):
        return

    details = [
        f"横動画収録={len(included_race_ids)}/{len(expected_race_ids)}",
    ]
    if render_omissions:
        details.append(
            "描画除外="
            + " / ".join(
                f"{item.get('venue_name')}{item.get('race_number')}R "
                f"{item.get('race_name')}（{item.get('reason')}）"
                for item in render_omissions
            )
        )
    if missing_long_race_ids:
        details.append("横動画未収録ID=" + ",".join(missing_long_race_ids))
    if render_errors:
        details.append("生成エラー=" + " / ".join(render_errors))
    if missing_video_types:
        details.append("未生成=" + ",".join(missing_video_types))
    if blocked_videos:
        details.append("公開不可=" + ",".join(blocked_videos))

    message = "通常版は収録対象を網羅できないため、投稿前に停止します: " + " / ".join(details)
    _append_actions_summary(
        [
            f"## YouTube動画生成 {target_date}",
            "",
            "- 生成本数: 0",
            "- readiness_status: render_incomplete",
            "- 結果: 描画完全性ゲートで動画投稿前に停止",
            f"- 詳細: {' / '.join(details)}",
        ]
    )
    raise RuntimeError(message)


def _preflight_upload(args: argparse.Namespace) -> Optional[UploadContext]:
    """動画生成前に認証・チャンネル・DBレジストリを検証する。"""
    if not _is_upload_requested(args):
        return None
    if args.disable_registry:
        raise RuntimeError("投稿時は重複防止レジストリを無効化できません。")
    if args.force:
        raise RuntimeError("--forceはv7では使用できません。既存動画を保護したまま状態から再開してください。")

    target_date = args.target_date or get_target_date()
    try:
        registry = VideoPostRegistry(enabled=True)
        if not registry.enabled:
            raise RuntimeError("動画投稿レジストリを初期化できません。投稿を中止します。")
    except Exception as exc:
        _append_actions_summary(
            [
                f"## YouTube投稿事前検証 {target_date}",
                "",
                "- 結果: 失敗",
                f"- 原因区分: DBレジストリ検証失敗（{exc}）",
                "- 生成本数: 0",
                "- アップロード本数: 0",
            ]
        )
        raise

    try:
        client = YouTubeClient()
        authenticated_channel_id = client.validate_channel()
    except Exception as exc:
        _append_actions_summary(
            [
                f"## YouTube投稿事前検証 {target_date}",
                "",
                "- 結果: 失敗",
                f"- 原因区分: OAuth・チャンネル認証失敗（{exc}）",
                "- 生成本数: 0",
                "- アップロード本数: 0",
            ]
        )
        raise

    print(f"YouTube投稿事前検証に成功しました: channel={authenticated_channel_id}")
    return UploadContext(
        registry=registry,
        client=client,
        authenticated_channel_id=authenticated_channel_id,
    )


def _preflight_scheduled_publish_window(args: argparse.Namespace) -> None:
    """ffmpeg生成やYouTube API呼び出し前に予約公開可能な時間帯か検証する。"""
    if not _is_upload_requested(args):
        return
    if validate_publication_mode(args.publication_mode) != "scheduled_public":
        return
    try:
        publish_schedule, shift_minutes = build_publish_schedule(
            args.target_date or get_target_date(),
            args.publish_time_jst,
            [0],
            minimum_lead_minutes=args.publish_min_lead_minutes,
            maximum_shift_minutes=args.max_publish_shift_minutes,
            publish_cutoff_time_jst=getattr(args, "publish_cutoff_jst", "09:00"),
        )
    except Exception as exc:
        _append_actions_summary(
            [
                f"## YouTube予約公開事前検証 {args.target_date or get_target_date()}",
                "",
                "- 結果: 失敗",
                f"- 原因: {exc}",
                "- 動画生成・アップロード: 未実行",
            ]
        )
        raise
    first_publish = publish_schedule[0] if publish_schedule else "なし"
    print(
        "YouTube予約公開時間の事前検証に成功しました: "
        f"first_publish={first_publish}, shift={shift_minutes}分, cutoff={getattr(args, 'publish_cutoff_jst', '09:00')} JST"
    )


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

    prepared = _load_venues_with_readiness(args, target_date)
    venues = prepared.venues
    args.prepared_video_data = prepared

    _ensure_video_data_ready(prepared, target_date)

    if prepared.omitted_races:
        details = " / ".join(
            f"{item.venue_name}{item.race_number}R {item.race_name}: {item.reason}"
            for item in prepared.omitted_races
        )
        print(f"収録できないレースだけを動画対象から除外しました: {details}")

    if args.max_venues is not None:
        venues = venues[: max(0, args.max_venues)]

    venues = order_venues_for_daily_compilation(venues)

    if not venues:
        message = (
            f"{target_date}は{prepared.retry_count}回再確認しても、"
            "3頭以上のAI偏差値を持つ収録可能レースが見つかりません。"
        )
        _append_actions_summary(
            [
                f"## YouTube動画生成 {target_date}",
                "",
                "- 生成本数: 0",
                "- coverage_status: empty",
                f"- データ取得元: {prepared.data_source}",
                f"- 再取得回数: {prepared.retry_count}",
                f"- 取得レース数: {prepared.source_race_count}",
                f"- 結果: 全件ゼロのため停止（{message}）",
            ]
        )
        if validate_publication_mode(args.publication_mode) != "disabled" and not args.dry_run:
            raise RuntimeError(message)
        print(f"{message} 動画生成を終了します。")
        return []

    print(f"{target_date} の動画生成を開始します。対象会場: {', '.join(v.venue_name for v in venues)}")
    rendered: List[RenderedVideo] = []
    render_errors: List[str] = []
    if args.include_long:
        print("日次統合の横動画を生成中: 中央競馬の各場 → 地方競馬")
        try:
            rendered.append(
                render_daily_long_video(
                    venues,
                    target_date,
                    output_dir,
                    skip_video=args.skip_video,
                )
            )
        except Exception as exc:
            error = f"横動画: {type(exc).__name__}: {exc}"
            render_errors.append(error)
            print(
                "横動画の生成に失敗しました。Shortの生成後、"
                f"完全性ゲートで外部投稿を停止します: {error}"
            )

    if args.include_shorts and args.max_shorts > 0:
        shorts_targets = pick_daily_short_races(venues)
        short_scope = "AI分析可能な重賞" if any(race.is_grade_race for race in shorts_targets) else "各開催場のメインレース"
        print(
            f"日次統合のShorts動画を生成中: {short_scope} / "
            + "、".join(
                f"{race.venue_name}{race.race_number}R {race.display_name}"
                for race in shorts_targets
            )
        )
        try:
            rendered.append(
                render_daily_short_video(
                    shorts_targets,
                    venues,
                    target_date,
                    output_dir,
                    skip_video=args.skip_video,
                )
            )
        except Exception as exc:
            error = f"Short: {type(exc).__name__}: {exc}"
            render_errors.append(error)
            print(
                "Shortの生成に失敗しました。生成済み横動画は保持しますが、"
                f"完全性ゲートで外部投稿を停止します: {error}"
            )

    if not rendered:
        raise RuntimeError("横動画とShortの両方を生成できませんでした: " + " / ".join(render_errors))

    _apply_content_safety_gate(rendered)
    rendered = _assign_publish_offsets(rendered, venues)
    render_omissions: List[dict[str, Any]] = []
    for item in rendered:
        try:
            metadata = json.loads(item.metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for omission in metadata.get("render_omissions") or []:
            if isinstance(omission, dict):
                render_omissions.append({**omission, "video_type": item.video_type})

    all_omitted_races = [
        item.to_dict() for item in prepared.omitted_races
    ] + render_omissions
    long_video = next((item for item in rendered if item.video_type == "daily_long"), None)
    long_race_ids = set(long_video.race_ids) if long_video else {
        race.id for venue in venues for race in venue.races
    }
    included_races = [
        {
            "race_id": race.id,
            "venue_name": race.venue_name,
            "race_number": race.race_number,
            "race_name": race.display_name,
            "grade": race.grade or "",
        }
        for venue in venues
        for race in venue.races
        if race.id in long_race_ids
    ]
    included_counts_by_venue: Dict[str, int] = {}
    for race in included_races:
        venue_name = str(race["venue_name"])
        included_counts_by_venue[venue_name] = included_counts_by_venue.get(venue_name, 0) + 1
    _ensure_standard_render_coverage(
        args,
        target_date,
        venues,
        rendered,
        included_races,
        render_omissions,
        render_errors,
    )
    short_video = next((item for item in rendered if item.video_type == "short"), None)
    included_grade_races = (
        [race for race in short_video.featured_races if race.get("grade")]
        if short_video
        else [race for race in included_races if race.get("grade")]
    )
    coverage_status = "partial" if all_omitted_races else prepared.coverage_status
    replacement_revision = _replacement_revision(args)
    replacement_coverage: Optional[dict[str, int]] = None
    if replacement_revision:
        try:
            replacement_coverage = _validate_replacement_coverage(
                args,
                prepared,
                rendered,
                included_races,
                all_omitted_races,
                coverage_status,
                render_errors,
            )
        except RuntimeError as exc:
            _append_actions_summary(
                [
                    f"## YouTube差し替え完全性ゲート {target_date}",
                    "",
                    f"- replacement_revision: {replacement_revision}",
                    f"- 結果: 停止（{exc}）",
                ]
            )
            raise
        _apply_replacement_revision(rendered, replacement_revision)
    summary = {
        "target_date": target_date,
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "count": len(rendered),
        "publication_mode": validate_publication_mode(args.publication_mode),
        "replacement_revision": replacement_revision or None,
        "replacement_coverage": replacement_coverage,
        "included_races": included_races,
        "omitted_races": all_omitted_races,
        "included_grade_races": included_grade_races,
        "omitted_grade_races": [
            item for item in all_omitted_races if item.get("grade")
        ],
        "data_source": prepared.data_source,
        "retry_count": prepared.retry_count,
        "coverage_status": coverage_status,
        "actual_race_count": len(included_races),
        "duration_seconds": {
            item.video_type: round(item.estimated_duration_seconds, 3)
            for item in rendered
        },
        "render_errors": render_errors,
        "load_errors": list(prepared.load_errors),
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
            "- 会場別収録数: "
            + " / ".join(
                f"{venue.race_type} {venue.venue_name}="
                f"{included_counts_by_venue.get(venue.venue_name, 0)}R"
                for venue in venues
            ),
            f"- 実収録レース数: {len(included_races)}",
            f"- coverage_status: {coverage_status}",
            f"- readiness_status: {prepared.readiness_status}",
            f"- 取得レース数: {prepared.source_race_count}",
            (
                "- 差し替え完全性: complete "
                f"（収録対象{replacement_coverage['expected_recordable_count']}件 / "
                f"期待除外{replacement_coverage['expected_exclusion_count']}件）"
                if replacement_coverage
                else "- 差し替え完全性: 対象外"
            ),
            f"- データ取得元: {prepared.data_source}",
            f"- 再取得回数: {prepared.retry_count}",
            (
                "- 除外レース: "
                + " / ".join(
                    f"{item.get('venue_name')}{item.get('race_number')}R "
                    f"{item.get('race_name')}（{item.get('reason')}）"
                    for item in all_omitted_races
                )
                if all_omitted_races
                else "- 除外レース: なし"
            ),
            (
                "- 除外重賞: "
                + " / ".join(
                    f"{item.get('venue_name')}{item.get('race_number')}R {item.get('race_name')}"
                    for item in all_omitted_races
                    if item.get("grade")
                )
                if any(item.get("grade") for item in all_omitted_races)
                else "- 除外重賞: なし"
            ),
            (
                "- 生成エラー: " + " / ".join(render_errors)
                if render_errors
                else "- 生成エラー: なし"
            ),
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


def _supersede_existing_publications(
    args: argparse.Namespace,
    rendered: List[RenderedVideo],
    context: UploadContext,
) -> None:
    """差し替え対象の予約を解除し、旧動画IDを履歴として確定する。"""
    revision = _replacement_revision(args)
    if not revision or not bool(getattr(args, "supersede_existing", False)):
        return
    suffix = f"__{revision}"
    target_date = args.target_date or get_target_date()
    candidates: List[tuple[RenderedVideo, str, PublicationRecord]] = []
    for item in rendered:
        if not item.stable_id.endswith(suffix):
            raise RuntimeError(f"差し替え版の台帳キーが不正です: {item.stable_id}")
        original_stable_id = item.stable_id[: -len(suffix)]
        record = context.registry.get(target_date, item.video_type, original_stable_id)
        if record is None:
            raise RuntimeError(
                "差し替え対象の旧動画レコードがありません: "
                f"{target_date} {item.video_type} {original_stable_id}"
            )
        if record.target_date != target_date:
            raise RuntimeError(
                f"差し替え対象日が一致しません: expected={target_date} actual={record.target_date}"
            )
        if record.status not in {"scheduled", "private_review", "superseded"}:
            raise RuntimeError(
                "差し替え対象にできない旧動画状態です: "
                f"{item.video_type} {original_stable_id} status={record.status}"
            )
        if not record.remote_video_id:
            raise RuntimeError(f"差し替え対象の旧動画IDがありません: {original_stable_id}")
        candidates.append((item, original_stable_id, record))

    summary_lines = [
        f"## YouTube旧動画の非公開化 {target_date}",
        "",
        f"- replacement_revision: {revision}",
    ]
    for item, original_stable_id, record in candidates:
        if record.status == "superseded":
            status = context.client.get_video_status(record.remote_video_id)
            if status.privacy_status != "private" or status.publish_at:
                raise RuntimeError(
                    "superseded済み旧動画が非公開ではありません: "
                    f"{record.remote_video_id} privacyStatus={status.privacy_status} "
                    f"publishAt={status.publish_at}"
                )
            summary_lines.append(
                f"- 確認済み: {original_stable_id} / video_id={record.remote_video_id} / superseded"
            )
            continue

        status = context.client.clear_publish_schedule(record.remote_video_id)
        if status.privacy_status == "public":
            raise RuntimeError(
                f"公開済み動画は自動差し替えできません: {record.remote_video_id}"
            )
        if status.privacy_status != "private" or status.publish_at:
            raise RuntimeError(
                "旧動画を非公開へ移行できません: "
                f"{record.remote_video_id} privacyStatus={status.privacy_status} publishAt={status.publish_at}"
            )
        context.registry.transition(
            target_date,
            item.video_type,
            original_stable_id,
            "superseded",
            remote_video_id=record.remote_video_id,
            scheduled_at=record.scheduled_at,
            metadata={
                "superseded_reason": "coverage_recovery",
                "replacement_revision": revision,
                "replacement_stable_id": item.stable_id,
                "original_scheduled_at": _format_publish_at(record.scheduled_at),
                "privacy_status": status.privacy_status,
                "publish_schedule_cleared": True,
                "superseded_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            },
        )
        summary_lines.append(
            f"- 非公開化: {original_stable_id} / video_id={record.remote_video_id} / superseded"
        )
    _append_actions_summary(summary_lines)


def _is_retryable_status_visibility_error(record: PublicationRecord) -> bool:
    return bool(
        record.remote_video_id
        and record.status in {"uploaded", "thumbnail_set", "thumbnail_skipped", "processing", "scheduled", "private_review"}
        and record.last_error
        and re.search(
            r"YouTube上の動画状態を取得できません|SSL|EOF occurred|timed? ?out|"
            r"connection (?:reset|aborted)|temporar(?:y|ily) unavailable|(?:^|\D)50[0234](?:\D|$)",
            record.last_error,
            re.IGNORECASE,
        )
    )


def _reconcile_recent_publications(
    registry: VideoPostRegistry,
    client: YouTubeClient,
) -> Tuple[List[str], int, List[str]]:
    """予約公開と手動公開された非公開レビュー動画をYouTube状態へ同期する。"""
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    lines: List[str] = []
    errors: List[str] = []
    checks = 0
    records = registry.list_recent(days=7, statuses={"scheduled", "private_review"})
    for record in records:
        if not record.remote_video_id:
            error = f"投稿レコードに動画IDがありません: {record.stable_id}"
            registry.record_error(record.target_date, record.video_type, record.stable_id, error)
            errors.append(error)
            continue
        scheduled_at = _utc_naive(record.scheduled_at) if record.scheduled_at is not None else None
        if record.status == "scheduled":
            if scheduled_at is None:
                error = f"予約レコードに公開時刻がありません: {record.stable_id}"
                registry.record_error(record.target_date, record.video_type, record.stable_id, error)
                errors.append(error)
                continue
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
                        "published_via_manual_review": record.status == "private_review",
                    },
                )
                lines.append(f"- 公開確認: {record.stable_id}")
            elif (
                record.status == "scheduled"
                and scheduled_at is not None
                and now_utc > scheduled_at + timedelta(hours=1)
            ):
                raise RuntimeError(
                    "予約公開時刻から1時間を過ぎても公開状態になっていません"
                    f"（privacyStatus={status.privacy_status}）"
                )
            elif record.status == "private_review":
                lines.append(f"- 非公開レビュー継続: {record.stable_id}")
            else:
                lines.append(f"- 公開反映待ち: {record.stable_id}")
        except Exception as exc:
            error = f"{record.stable_id}: {exc}"
            registry.record_error(record.target_date, record.video_type, record.stable_id, error)
            errors.append(error)
            lines.append(f"- 公開確認エラー: {error}")
    if not records:
        lines.append("- 直近の公開状態照合: 対象なし")
    return lines, checks, errors


def _upload_all(
    args: argparse.Namespace,
    rendered: List[RenderedVideo],
    upload_context: Optional[UploadContext] = None,
) -> None:
    target_date = args.target_date or get_target_date()
    publication_mode = validate_publication_mode(args.publication_mode)
    if not _is_upload_requested(args):
        print(
            "YouTubeアップロードはスキップします。"
            "YOUTUBE_UPLOAD_ENABLED=trueかつYOUTUBE_PUBLICATION_MODE=private_review/scheduled_publicで有効化できます。"
        )
        return
    context = upload_context or _preflight_upload(args)
    if context is None:
        raise RuntimeError("YouTube投稿事前検証の結果を取得できません。")
    registry = context.registry
    client = context.client
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
        and not record.is_terminal
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
    uploaded_count = 0
    reused_count = 0
    scheduled_count = 0
    published_count = 0
    private_review_count = 0
    upload_errors: List[str] = []
    effective_publish_time = "なし（非公開レビュー）"
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
            publish_cutoff_time_jst=getattr(args, "publish_cutoff_jst", "09:00"),
        )
        publish_at_by_key.update(
            {
                (item.video_type, item.stable_id): publish_at
                for item, publish_at in zip(publishable_items, publish_schedule)
            }
        )
        if publish_schedule:
            first_publish_at = min(
                datetime.fromisoformat(value.replace("Z", "+00:00"))
                for value in publish_schedule
            ).astimezone(timezone(timedelta(hours=9)))
            effective_publish_time = first_publish_at.strftime("%Y-%m-%d %H:%M JST")
        if schedule_shift_minutes:
            delay_message = (
                "GitHub Actionsの起動遅延に合わせ、全動画の同時公開を維持したまま"
                f"全予約を{schedule_shift_minutes}分後ろ倒ししました"
                f"（最初の公開: {first_publish_at.strftime('%Y-%m-%d %H:%M JST')}）"
            )
            print(delay_message)
            uploaded_lines.append(f"- 遅延時刻補正: {delay_message}")

    reserved_records = {}
    for item in publishable_items:
        try:
            publication_metadata = item.publication_metadata()
            replacement_revision = _replacement_revision(args)
            if replacement_revision:
                publication_metadata["replacement_revision"] = replacement_revision
                publication_metadata["replacement_of_stable_id"] = item.stable_id.removesuffix(
                    f"__{replacement_revision}"
                )
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
            try:
                registry.record_error(
                    target_date,
                    item.video_type,
                    item.stable_id,
                    str(exc),
                )
            except Exception as registry_exc:
                print(f"警告: 投稿予約エラー状態の保存にも失敗しました: {registry_exc}")
            error = f"{item.video_type} {item.stable_id}: 投稿予約失敗（{exc}）"
            upload_errors.append(error)
            uploaded_lines.append(f"- 投稿予約失敗: {item.title}（{exc}）")

    for item in rendered:
        if not item.publishable:
            reasons = " / ".join(item.publish_block_reasons) or "素材要件を満たしていません"
            print(f"素材不足のためYouTube投稿をスキップ: {item.video_type} {item.stable_id} ({reasons})")
            uploaded_lines.append(f"- 保留: {item.title}（{reasons}）")
            continue

        if (item.video_type, item.stable_id) not in reserved_records:
            continue

        record = reserved_records[(item.video_type, item.stable_id)]
        if record.is_terminal:
            print(f"投稿完了済みのためスキップ: {item.video_type} {item.stable_id} ({record.status})")
            uploaded_lines.append(f"- 再利用: {item.title}（{record.status}）")
            reused_count += 1
            if record.status == "scheduled":
                scheduled_count += 1
            elif record.status == "published":
                published_count += 1
            elif record.status == "private_review":
                private_review_count += 1
            continue
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
            if item.video_path is None:
                raise RuntimeError(
                    f"動画ファイルが生成されていないためアップロードできません: {item.stable_id}"
                )
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
                uploaded_count += 1
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
                cleared_status = client.clear_publish_schedule(video_id)
                if cleared_status.privacy_status == "public":
                    registry.transition(
                        target_date,
                        item.video_type,
                        item.stable_id,
                        "published",
                        remote_video_id=video_id,
                        scheduled_at=record.scheduled_at,
                        metadata={
                            "processing_status": cleared_status.processing_status,
                            "upload_status": cleared_status.upload_status,
                            "privacy_status": cleared_status.privacy_status,
                            "published_while_schedule_clear_checked": True,
                        },
                    )
                    published_count += 1
                    reused_count += 1
                    uploaded_lines.append(
                        f"- published: {item.title} — https://www.youtube.com/watch?v={video_id}"
                    )
                    continue
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
            if final_status == "scheduled":
                scheduled_count += 1
            elif final_status == "published":
                published_count += 1
            else:
                private_review_count += 1
            watch_url = f"https://www.youtube.com/watch?v={video_id}"
            print(f"YouTube投稿成功: {watch_url} ({final_status})")
            uploaded_lines.append(f"- {final_status}: {item.title} — {watch_url}")
        except Exception as exc:
            try:
                registry.record_error(target_date, item.video_type, item.stable_id, str(exc))
            except Exception as registry_exc:
                print(f"警告: 投稿エラー状態の保存にも失敗しました: {registry_exc}")
            error = f"{item.video_type} {item.stable_id}: {exc}"
            upload_errors.append(error)
            uploaded_lines.append(f"- 失敗: {item.title}（{exc}）")
            continue
    uploaded_lines.extend(
        [
            f"- 生成本数: {len(rendered)}",
            f"- 新規アップロード本数: {uploaded_count}",
            f"- 既存動画再利用本数: {reused_count}",
            f"- 予約本数: {scheduled_count}",
            f"- 公開本数: {published_count}",
            f"- 非公開レビュー本数: {private_review_count}",
            f"- 実効公開時刻: {effective_publish_time}",
            (
                "- 投稿エラー: " + " / ".join(upload_errors)
                if upload_errors
                else "- 投稿エラー: なし"
            ),
        ]
    )
    _append_actions_summary(uploaded_lines)
    if upload_errors:
        raise RuntimeError(
            "一部動画の投稿に失敗しました。成功済み動画は維持します: "
            + " / ".join(upload_errors)
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UMA-FREEのYouTube向け自動動画生成・投稿パイプライン")
    parser.add_argument("--target-date", help="対象日 YYYY-MM-DD。未指定なら翌日JST")
    parser.add_argument("--input-json", help="ローカルJSONから生成する検証用入力")
    parser.add_argument("--output-dir", help="出力ディレクトリ。未指定なら youtube_video_dist")
    parser.add_argument("--max-venues", type=int, default=None, help="検証用に生成会場数を制限")
    parser.add_argument("--max-shorts", type=int, default=int(os.getenv("YOUTUBE_MAX_SHORTS", "1")), help="0でShortsを無効化。1以上では日次統合Shortsを1本生成")
    parser.add_argument("--publish-time-jst", default=os.getenv("YOUTUBE_PUBLISH_TIME_JST", "19:00"), help="翌日分を公開予約するJST時刻 HH:MM")
    parser.add_argument(
        "--publish-min-lead-minutes",
        type=int,
        default=int(os.getenv("YOUTUBE_PUBLISH_MIN_LEAD_MINUTES", "45")),
        help="遅延時に最初の予約公開まで確保する最低猶予分数",
    )
    parser.add_argument(
        "--max-publish-shift-minutes",
        type=int,
        default=int(os.getenv("YOUTUBE_MAX_PUBLISH_SHIFT_MINUTES", "840")),
        help="GitHub Actions遅延時に許可する予約時刻の最大後ろ倒し分数",
    )
    parser.add_argument(
        "--publish-cutoff-jst",
        default=os.getenv("YOUTUBE_PUBLISH_CUTOFF_JST", "09:00"),
        help="遅延時も自動公開を許可する対象日側の最終時刻 HH:MM",
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
        default=int(os.getenv("YOUTUBE_READINESS_ATTEMPTS", "3")),
        help="翌日データの準備確認回数",
    )
    parser.add_argument(
        "--readiness-delay-seconds",
        type=int,
        default=int(os.getenv("YOUTUBE_READINESS_DELAY_SECONDS", "120")),
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
    parser.add_argument(
        "--replacement-revision",
        default="",
        help="完全性ゲートを有効にして新しい台帳キーを作る差し替え版識別子",
    )
    parser.add_argument(
        "--supersede-existing",
        action="store_true",
        help="差し替え対象の旧予約動画を非公開化しsupersededへ移行する",
    )
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
    _validate_replacement_request(args)
    publication_mode = validate_publication_mode(args.publication_mode)
    upload_requested = publication_mode != "disabled" and not args.dry_run and not args.skip_upload
    if upload_requested and (args.input_json or args.allow_placeholder_data):
        raise RuntimeError(
            "入力JSONまたはプレースホルダー許可を使ったYouTube投稿は禁止しています。"
            "実DBの確定データで実行してください。"
        )
    args.prepared_video_data = None
    _preflight_scheduled_publish_window(args)
    upload_context = _preflight_upload(args)
    rendered = _render_all(args)
    if rendered:
        if upload_context is not None:
            _supersede_existing_publications(args, rendered, upload_context)
        _upload_all(args, rendered, upload_context=upload_context)


if __name__ == "__main__":
    main()
