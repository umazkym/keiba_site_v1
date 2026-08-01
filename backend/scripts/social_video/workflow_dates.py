#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Tuple


JST = timezone(timedelta(hours=9))
FRIDAY_WEEKEND_OFFSETS = {
    "0 3 * * 5": 1,
    "0 6 * * 5": 2,
}


def _as_jst(value: Optional[datetime]) -> datetime:
    current = value or datetime.now(JST)
    if current.tzinfo is None:
        return current.replace(tzinfo=JST)
    return current.astimezone(JST)


def _parse_timestamp(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    if not normalized:
        raise ValueError("前段Workflowの開始日時がありません。")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def resolve_youtube_target_date(
    event_name: str,
    *,
    explicit_target_date: str = "",
    source_run_started_at: str = "",
    now_jst: Optional[datetime] = None,
) -> str:
    """起動種別からYouTube動画の対象日を決定する。"""
    normalized_event = event_name.strip()
    explicit = explicit_target_date.strip()
    if normalized_event == "workflow_dispatch" and explicit:
        return date.fromisoformat(explicit).isoformat()
    if normalized_event == "workflow_run":
        source_date_jst = _parse_timestamp(source_run_started_at).astimezone(JST).date()
        return (source_date_jst + timedelta(days=1)).isoformat()
    if normalized_event in {"schedule", "workflow_dispatch"}:
        return (_as_jst(now_jst).date() + timedelta(days=1)).isoformat()
    raise ValueError(f"未対応のGitHub Actionsイベントです: {event_name}")


def resolve_friday_weekend_target_date(
    event_name: str,
    *,
    event_schedule: str = "",
    manual_offset: int = 2,
    now_jst: Optional[datetime] = None,
) -> Tuple[str, int]:
    """実際の開始時刻ではなくcron文字列を正本に週末取得日を決定する。"""
    current_date = _as_jst(now_jst).date()
    if event_name.strip() == "schedule":
        schedule = event_schedule.strip()
        if schedule not in FRIDAY_WEEKEND_OFFSETS:
            raise ValueError(f"未対応の金曜データ取得cronです: {event_schedule}")
        offset = FRIDAY_WEEKEND_OFFSETS[schedule]
        days_since_friday = (current_date.weekday() - 4) % 7
        base_friday = current_date - timedelta(days=days_since_friday)
        return (base_friday + timedelta(days=offset)).isoformat(), offset

    if event_name.strip() != "workflow_dispatch":
        raise ValueError(f"未対応のGitHub Actionsイベントです: {event_name}")
    offset = int(manual_offset)
    if offset not in {1, 2}:
        raise ValueError("手動offsetは1（翌日）または2（翌々日）を指定してください。")
    return (current_date + timedelta(days=offset)).isoformat(), offset


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="GitHub Actions用の対象日決定")
    subparsers = parser.add_subparsers(dest="command", required=True)

    youtube = subparsers.add_parser("youtube", help="YouTube日次投稿の対象日")
    youtube.add_argument("--event-name", required=True)
    youtube.add_argument("--explicit-target-date", default="")
    youtube.add_argument("--source-run-started-at", default="")
    youtube.add_argument("--github-output", action="store_true")

    friday = subparsers.add_parser("friday-weekend", help="金曜先行取得の対象日")
    friday.add_argument("--event-name", required=True)
    friday.add_argument("--event-schedule", default="")
    friday.add_argument("--manual-offset", type=int, default=2)
    friday.add_argument("--github-output", action="store_true")
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    if args.command == "youtube":
        target_date = resolve_youtube_target_date(
            args.event_name,
            explicit_target_date=args.explicit_target_date,
            source_run_started_at=args.source_run_started_at,
        )
        if args.github_output:
            print(f"target_date={target_date}")
        else:
            print(target_date)
        return

    target_date, offset = resolve_friday_weekend_target_date(
        args.event_name,
        event_schedule=args.event_schedule,
        manual_offset=args.manual_offset,
    )
    if args.github_output:
        print(f"target_date={target_date}")
        print(f"offset={offset}")
    else:
        print(target_date)


if __name__ == "__main__":
    main()
