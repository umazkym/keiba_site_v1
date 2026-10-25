#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cloudflare からの定時起動と GitHub の予定（予備）が二重に動かないようにする関所。

GitHub の schedule はこのリポジトリで2〜6時間おくれるため、Cloudflare Workers の Cron Triggers が
予定の時刻に workflow_dispatch（trigger=cloudflare・表示名に「(定時」）で起動する。予定の回は予備として残す。

- 予定の回（schedule）：同じ枠（直近の cron 時刻の10分前から）に定時の起動が成功していれば止める。
- 定時の起動：同じ枠の予定の回が先に成功していれば止める（GitHub が予定どおりに動いたまれな日）。
- 手で起こした回は止めない。API が読めないときも止めない（出し損ねより二重の方がまし）。

Workflow の concurrency で同じ Workflow を1本ずつにしてあるので、この関所が動く間、相手は終わっているか待っている。
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

DISPATCH_MARKER = "(定時"
DISPATCH_TRIGGER = "cloudflare"
SLOT_MARGIN = timedelta(minutes=10)
# 定時の起動が待たされても（前の予定の回が長く動いていても）同じ枠の予定の回を拾える幅
SCHEDULE_LOOKBACK = timedelta(hours=3)
MAX_SCHEDULE_DELAY = timedelta(hours=24)


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _cron_weekdays(field: str) -> Optional[set[int]]:
    """cron の曜日（0=日〜6=土、7=日）を Python の曜日（0=月）にする。* は None。"""
    if field == "*":
        return None
    days = set()
    for part in field.split(","):
        days.add((int(part) - 1) % 7)
    return days


def previous_slot(cron: str, observed_at: datetime) -> datetime:
    """observed_at 以前にある直近の cron 時刻（UTC）。分・時は数1つ、日・月は * の cron だけ扱う。"""
    fields = cron.split()
    if len(fields) != 5 or fields[2:4] != ["*", "*"]:
        raise ValueError(f"扱えない cron です: {cron}")
    minute, hour = int(fields[0]), int(fields[1])
    weekdays = _cron_weekdays(fields[4])
    observed = observed_at.astimezone(timezone.utc)
    slot = observed.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if slot > observed:
        slot -= timedelta(days=1)
    for _ in range(8):
        if weekdays is None or slot.weekday() in weekdays:
            break
        slot -= timedelta(days=1)
    if observed - slot >= MAX_SCHEDULE_DELAY:
        raise ValueError(f"予定の時刻から24時間以上たっています: cron={cron} observed={observed.isoformat()}")
    return slot


def _successful_others(runs: Iterable[dict], own_run_id: str, *, marker: Optional[str]) -> list[dict]:
    found = []
    for run in runs:
        if str(run.get("id")) == str(own_run_id):
            continue
        if marker is not None and marker not in (run.get("display_title") or ""):
            continue
        if run.get("status") == "completed" and run.get("conclusion") == "success":
            found.append(run)
    return found


def decide(event_name: str, *, trigger: str, event_schedule: str, own_run: dict, list_runs) -> tuple[bool, str]:
    """(動かすか, 理由)。list_runs(event, created_since) は同じ Workflow の回の一覧を返す。"""
    created_at = _parse_time(own_run["created_at"])
    if event_name == "schedule":
        slot = previous_slot(event_schedule, created_at)
        since = slot - SLOT_MARGIN
        found = _successful_others(list_runs("workflow_dispatch", since), own_run["id"], marker=DISPATCH_MARKER)
        if found:
            return False, f"予定 {slot:%Y-%m-%d %H:%M}Z の枠は定時の起動 {found[0]['id']} が済ませた"
        return True, f"予定 {slot:%Y-%m-%d %H:%M}Z の枠に成功した定時の起動が無い（予備として動く）"
    if event_name == "workflow_dispatch" and trigger == DISPATCH_TRIGGER:
        since = created_at - SCHEDULE_LOOKBACK
        found = _successful_others(list_runs("schedule", since), own_run["id"], marker=None)
        if found:
            return False, f"同じ枠の予定の回 {found[0]['id']} が先に済ませた"
        # Cloudflare が同じ枠で2回起動した・出し直しが両方届いたとき（表示名は枠ごとに同じ）
        title = own_run.get("display_title") or DISPATCH_MARKER
        found = _successful_others(list_runs("workflow_dispatch", since), own_run["id"], marker=title)
        if found:
            return False, f"同じ枠の定時の起動 {found[0]['id']} が先に済ませた"
        return True, "定時の起動"
    return True, f"{event_name} の回は止めない"


def _api(path: str, token: str) -> dict:
    request = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "keiba-workflow-dispatch-gate",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main() -> int:
    env = os.environ
    event_name = env.get("GITHUB_EVENT_NAME", "")
    repository = env["GITHUB_REPOSITORY"]
    run_id = env["GITHUB_RUN_ID"]
    token = env.get("GITHUB_TOKEN", "")
    # owner/repo/.github/workflows/<file>@refs/heads/main
    workflow_file = env.get("GITHUB_WORKFLOW_REF", "").split("@", 1)[0].rsplit("/", 1)[-1]

    def list_runs(event: str, since: datetime) -> list[dict]:
        query = urllib.parse.urlencode({
            "event": event,
            "created": f">={since:%Y-%m-%dT%H:%M:%SZ}",
            "per_page": 30,
        })
        return _api(f"/repos/{repository}/actions/workflows/{workflow_file}/runs?{query}", token)["workflow_runs"]

    try:
        own_run = _api(f"/repos/{repository}/actions/runs/{run_id}", token)
        run, reason = decide(
            event_name,
            trigger=env.get("DISPATCH_TRIGGER", ""),
            event_schedule=env.get("EVENT_SCHEDULE", ""),
            own_run=own_run,
            list_runs=list_runs,
        )
    except Exception as exc:  # noqa: BLE001 - 読めないときは動かす
        run, reason = True, f"起動の記録を読めないので動かす: {exc}"
        print(f"::warning::{reason}")

    if run and event_name == "schedule":
        # 予備が動いた＝定時の起動が来ていない（Cloudflare の鍵の期限切れなど）。おくれて動くので気づけるようにする
        print(f"::warning::{reason}")
    print(f"{'動かす' if run else '止める'}: {reason}")
    output = env.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as handle:
            handle.write(f"run={'true' if run else 'false'}\n")
    summary = env.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(f"## 定時の関所\n\n- {'動かす' if run else '止める'}: {reason}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
