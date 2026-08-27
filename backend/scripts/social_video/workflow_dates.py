#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Tuple


JST = timezone(timedelta(hours=9))
FRIDAY_WEEKEND_OFFSETS = {
    "0 3 * * 5": 1,
    "0 6 * * 5": 2,
}
DAILY_PIPELINE_SCHEDULES = {
    "afternoon": ("30 4 * * *", 1),
    "morning-today": ("30 21 * * *", 1),
    "retry-today": ("0 1 * * *", 0),
    "results": ("0 20 * * *", 0),
}
YOUTUBE_FALLBACK_SCHEDULE = "20 9 * * *"
MAX_SCHEDULE_DELAY = timedelta(hours=24)
ISO_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass(frozen=True)
class ScheduleResolution:
    target_date: str
    scheduled_at_utc: Optional[datetime]
    delay_minutes: int


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


def _as_utc(value: Optional[datetime]) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _parse_daily_cron(value: str) -> tuple[int, int]:
    fields = value.strip().split()
    if len(fields) != 5 or fields[2:] != ["*", "*", "*"]:
        raise ValueError(f"毎日実行の固定時刻cronではありません: {value}")
    try:
        minute = int(fields[0])
        hour = int(fields[1])
    except ValueError as exc:
        raise ValueError(f"cronの時刻は整数で指定してください: {value}") from exc
    if not 0 <= minute <= 59 or not 0 <= hour <= 23:
        raise ValueError(f"cronの時刻が範囲外です: {value}")
    return hour, minute


def _previous_scheduled_run(
    event_schedule: str,
    observed_at: Optional[datetime] = None,
) -> tuple[datetime, int]:
    """実開始時刻以前にある直近のUTC cron時刻を返す。"""
    hour, minute = _parse_daily_cron(event_schedule)
    observed_utc = _as_utc(observed_at)
    scheduled_at = observed_utc.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if scheduled_at > observed_utc:
        scheduled_at -= timedelta(days=1)
    return scheduled_at, _schedule_delay_minutes(scheduled_at, observed_utc)


def _schedule_delay_minutes(scheduled_at: datetime, observed_at: datetime) -> int:
    scheduled_utc = _as_utc(scheduled_at)
    observed_utc = _as_utc(observed_at)
    delay = observed_utc - scheduled_utc
    if delay < timedelta(0) or delay >= MAX_SCHEDULE_DELAY:
        raise ValueError(
            "定期実行の遅延が許容範囲外です: "
            f"scheduled_at={scheduled_utc.isoformat()} observed_at={observed_utc.isoformat()}"
        )
    return int(delay.total_seconds() // 60)


def _manual_resolution(explicit_target_date: str) -> ScheduleResolution:
    explicit = explicit_target_date.strip()
    if not explicit:
        raise ValueError("手動実行では対象日をYYYY-MM-DDで明示してください。")
    if not ISO_DATE_PATTERN.fullmatch(explicit):
        raise ValueError("手動実行の対象日はYYYY-MM-DD形式で指定してください。")
    return ScheduleResolution(
        target_date=date.fromisoformat(explicit).isoformat(),
        scheduled_at_utc=None,
        delay_minutes=0,
    )


def resolve_daily_pipeline_target_date(
    pipeline: str,
    event_name: str,
    *,
    event_schedule: str = "",
    explicit_target_date: str = "",
    observed_at: Optional[datetime] = None,
) -> ScheduleResolution:
    """日次データWorkflowの対象日を実際の起動日ではなくcron基準で決定する。"""
    normalized_pipeline = pipeline.strip()
    if normalized_pipeline not in DAILY_PIPELINE_SCHEDULES:
        raise ValueError(f"未対応の日次パイプラインです: {pipeline}")
    normalized_event = event_name.strip()
    if normalized_event == "workflow_dispatch":
        return _manual_resolution(explicit_target_date)
    if normalized_event != "schedule":
        raise ValueError(f"未対応のGitHub Actionsイベントです: {event_name}")

    expected_schedule, target_offset = DAILY_PIPELINE_SCHEDULES[normalized_pipeline]
    actual_schedule = event_schedule.strip()
    if actual_schedule != expected_schedule:
        raise ValueError(
            f"{normalized_pipeline}のcronが想定と一致しません: "
            f"expected={expected_schedule} actual={actual_schedule}"
        )
    scheduled_at, delay_minutes = _previous_scheduled_run(actual_schedule, observed_at)
    return ScheduleResolution(
        target_date=(scheduled_at.date() + timedelta(days=target_offset)).isoformat(),
        scheduled_at_utc=scheduled_at,
        delay_minutes=delay_minutes,
    )


def resolve_youtube_target_date(
    event_name: str,
    *,
    explicit_target_date: str = "",
    source_run_started_at: str = "",
    event_schedule: str = "",
    now_jst: Optional[datetime] = None,
) -> str:
    """起動種別からYouTube動画の対象日を決定する。"""
    return resolve_youtube_target_date_details(
        event_name,
        explicit_target_date=explicit_target_date,
        source_run_started_at=source_run_started_at,
        event_schedule=event_schedule,
        now_jst=now_jst,
    ).target_date


def resolve_youtube_target_date_details(
    event_name: str,
    *,
    explicit_target_date: str = "",
    source_run_started_at: str = "",
    event_schedule: str = "",
    now_jst: Optional[datetime] = None,
) -> ScheduleResolution:
    """YouTube Workflowの対象日と基準cron時刻を返す。"""
    normalized_event = event_name.strip()
    if normalized_event == "workflow_dispatch":
        return _manual_resolution(explicit_target_date)
    if normalized_event == "workflow_run":
        source_started_at = _parse_timestamp(source_run_started_at)
        return resolve_daily_pipeline_target_date(
            "afternoon",
            "schedule",
            event_schedule=DAILY_PIPELINE_SCHEDULES["afternoon"][0],
            observed_at=source_started_at,
        )
    if normalized_event == "schedule":
        actual_schedule = event_schedule.strip()
        if actual_schedule != YOUTUBE_FALLBACK_SCHEDULE:
            raise ValueError(
                "YouTube予備cronが想定と一致しません: "
                f"expected={YOUTUBE_FALLBACK_SCHEDULE} actual={actual_schedule}"
            )
        observed_at = _as_jst(now_jst).astimezone(timezone.utc) if now_jst else None
        scheduled_at, delay_minutes = _previous_scheduled_run(actual_schedule, observed_at)
        return ScheduleResolution(
            target_date=(scheduled_at.date() + timedelta(days=1)).isoformat(),
            scheduled_at_utc=scheduled_at,
            delay_minutes=delay_minutes,
        )
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
    youtube.add_argument("--event-schedule", default="")
    youtube.add_argument("--github-output", action="store_true")

    daily = subparsers.add_parser("daily", help="日次データ取得・結果反映の対象日")
    daily.add_argument("--pipeline", required=True, choices=sorted(DAILY_PIPELINE_SCHEDULES))
    daily.add_argument("--event-name", required=True)
    daily.add_argument("--event-schedule", default="")
    daily.add_argument("--explicit-target-date", default="")
    daily.add_argument("--github-output", action="store_true")

    friday = subparsers.add_parser("friday-weekend", help="金曜先行取得の対象日")
    friday.add_argument("--event-name", required=True)
    friday.add_argument("--event-schedule", default="")
    friday.add_argument("--manual-offset", type=int, default=2)
    friday.add_argument("--github-output", action="store_true")
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    if args.command == "youtube":
        resolution = resolve_youtube_target_date_details(
            args.event_name,
            explicit_target_date=args.explicit_target_date,
            source_run_started_at=args.source_run_started_at,
            event_schedule=args.event_schedule,
        )
        if args.github_output:
            _print_github_output(resolution)
        else:
            print(resolution.target_date)
        return

    if args.command == "daily":
        resolution = resolve_daily_pipeline_target_date(
            args.pipeline,
            args.event_name,
            event_schedule=args.event_schedule,
            explicit_target_date=args.explicit_target_date,
        )
        if args.github_output:
            _print_github_output(resolution)
        else:
            print(resolution.target_date)
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


def _print_github_output(resolution: ScheduleResolution) -> None:
    scheduled_at = (
        resolution.scheduled_at_utc.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        if resolution.scheduled_at_utc is not None
        else "manual"
    )
    print(f"target_date={resolution.target_date}")
    print(f"scheduled_at_utc={scheduled_at}")
    print(f"delay_minutes={resolution.delay_minutes}")


if __name__ == "__main__":
    main()
