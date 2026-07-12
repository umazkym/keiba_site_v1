#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List


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
from scripts.social_video.registry import VideoPostRegistry, make_registry_key  # noqa: E402
from scripts.social_video.renderer import RenderedVideo, render_long_video, render_short_video  # noqa: E402
from scripts.social_video.youtube_client import YouTubeClient, build_publish_at  # noqa: E402


DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "youtube_video_dist"
PLACEHOLDER_NAME_MARKERS = ("サンプル", "sample", "dummy", "テスト", "test", "?")


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
    return any(
        horse.deviation_score is not None and not _is_placeholder_horse_name(horse.horse_name)
        for horse in race.predictions
    )


def _filter_publishable_venues(venues: List[VenueVideoData], allow_placeholder_data: bool) -> List[VenueVideoData]:
    if allow_placeholder_data:
        return venues
    filtered: List[VenueVideoData] = []
    skipped_races = 0
    for venue in venues:
        races = [race for race in venue.races if _has_publishable_predictions(race)]
        skipped_races += len(venue.races) - len(races)
        if races:
            filtered.append(VenueVideoData(venue_name=venue.venue_name, race_type=venue.race_type, races=races))
    if skipped_races:
        print(f"本番投稿に不適切な空データ/プレースホルダー混入レースを除外しました: {skipped_races}件")
    return filtered


def _render_all(args: argparse.Namespace) -> List[RenderedVideo]:
    target_date = args.target_date or get_target_date()
    output_dir = Path(args.output_dir or DEFAULT_OUTPUT_DIR) / target_date
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.input_json:
        venues = _load_input_json(Path(args.input_json), target_date)
    else:
        venues = load_venues_for_date(target_date)

    venues = _filter_publishable_venues(venues, allow_placeholder_data=bool(args.input_json) or args.allow_placeholder_data)

    if args.max_venues is not None:
        venues = venues[: max(0, args.max_venues)]

    if not venues:
        print(f"{target_date} の開催データが見つからないため、動画生成を終了します。")
        return []

    print(f"{target_date} の動画生成を開始します。対象会場: {', '.join(v.venue_name for v in venues)}")
    rendered: List[RenderedVideo] = []
    if args.include_long:
        for venue in venues:
            print(f"長尺動画を生成中: {venue.venue_name}")
            rendered.append(render_long_video(venue, target_date, output_dir, skip_video=args.skip_video))

    if args.include_shorts and args.max_shorts > 0:
        shorts_targets = pick_shorts_targets(venues, args.max_shorts)
        for index, race in enumerate(shorts_targets, start=1):
            print(f"Shorts動画を生成中: {race.venue_name}{race.race_number}R {race.display_name}")
            rendered.append(render_short_video(race, target_date, output_dir, index=index, skip_video=args.skip_video))

    summary = {
        "target_date": target_date,
        "count": len(rendered),
        "videos": [
            {
                "video_type": item.video_type,
                "stable_id": item.stable_id,
                "title": item.title,
                "video_path": str(item.video_path) if item.video_path else None,
                "thumbnail_path": str(item.thumbnail_path),
                "metadata_path": str(item.metadata_path),
            }
            for item in rendered
        ],
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"動画生成サマリー: {output_dir / 'summary.json'}")
    return rendered


def _upload_all(args: argparse.Namespace, rendered: List[RenderedVideo]) -> None:
    target_date = args.target_date or get_target_date()
    upload_enabled = _env_flag("YOUTUBE_UPLOAD_ENABLED", False)
    if args.skip_upload or args.dry_run or not upload_enabled:
        print("YouTubeアップロードはスキップします。YOUTUBE_UPLOAD_ENABLED=true で有効化できます。")
        return
    registry = VideoPostRegistry(enabled=not args.disable_registry)
    client = YouTubeClient()
    privacy_status = args.privacy_status
    for item in rendered:
        registry_key = make_registry_key(target_date, item.video_type, item.stable_id)
        if not args.force and registry.is_posted(registry_key, target_date):
            print(f"既に投稿済みのためスキップ: {item.video_type} {item.stable_id}")
            continue
        if item.video_path is None:
            raise RuntimeError(f"動画ファイルが生成されていないためアップロードできません: {item.stable_id}")
        publish_at = build_publish_at(target_date, args.publish_time_jst, item.publish_offset_minutes)
        print(f"YouTubeへ予約投稿します: {item.title} ({publish_at})")
        result = client.upload_video(
            video_path=item.video_path,
            thumbnail_path=item.thumbnail_path,
            title=item.title,
            description=item.description,
            tags=item.tags,
            publish_at=publish_at,
            privacy_status=privacy_status,
            notify_subscribers=args.notify_subscribers,
        )
        print(f"YouTube投稿成功: {result.watch_url}")
        registry.record(registry_key, target_date, f"youtube_{item.video_type}", result.video_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UMA-FREEのYouTube向け自動動画生成・投稿パイプライン")
    parser.add_argument("--target-date", help="対象日 YYYY-MM-DD。未指定なら翌日JST")
    parser.add_argument("--input-json", help="ローカルJSONから生成する検証用入力")
    parser.add_argument("--output-dir", help="出力ディレクトリ。未指定なら youtube_video_dist")
    parser.add_argument("--max-venues", type=int, default=None, help="検証用に生成会場数を制限")
    parser.add_argument("--max-shorts", type=int, default=int(os.getenv("YOUTUBE_MAX_SHORTS", "3")), help="Shorts生成上限")
    parser.add_argument("--publish-time-jst", default=os.getenv("YOUTUBE_PUBLISH_TIME_JST", "20:30"), help="翌日分を公開予約するJST時刻 HH:MM")
    parser.add_argument("--privacy-status", default=os.getenv("YOUTUBE_PRIVACY_STATUS", "private"), choices=["private", "unlisted", "public"], help="YouTube投稿の公開状態")
    parser.add_argument("--dry-run", action="store_true", help="生成のみ行い、アップロードしない")
    parser.add_argument("--skip-upload", action="store_true", help="YouTubeアップロードを常にスキップ")
    parser.add_argument("--skip-video", action="store_true", help="PNG/metadataのみ生成し、ffmpegによるMP4作成をスキップ")
    parser.add_argument("--allow-placeholder-data", action="store_true", help="検証用。サンプル馬名や空データの除外を無効化する")
    parser.add_argument("--disable-registry", action="store_true", help="DBの重複投稿レジストリを使わない")
    parser.add_argument("--force", action="store_true", help="投稿済み判定を無視してアップロードする")
    parser.add_argument("--no-long", dest="include_long", action="store_false", help="会場別長尺動画を生成しない")
    parser.add_argument("--no-shorts", dest="include_shorts", action="store_false", help="Shorts動画を生成しない")
    parser.add_argument("--notify-subscribers", action="store_true", help="YouTube通知を有効にする")
    parser.set_defaults(include_long=True, include_shorts=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.target_date:
        args.target_date = get_target_date()
    rendered = _render_all(args)
    if rendered:
        _upload_all(args, rendered)


if __name__ == "__main__":
    main()
