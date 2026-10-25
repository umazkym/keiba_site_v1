"""定時の起動（Cloudflare）と GitHub の予定（予備）の関所（2026-10-25 菊花賞の日の直し）。"""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.maintenance import workflow_dispatch_gate as gate  # noqa: E402

PRE_RACE = "0 5 * * 0,6"
AFTERNOON = "30 4 * * *"


def utc(text):
    return datetime.fromisoformat(text).replace(tzinfo=timezone.utc)


def run(run_id, created_at, *, title="Keiba SNS Pre-Race Post", status="completed", conclusion="success"):
    return {"id": run_id, "created_at": created_at, "display_title": title, "status": status, "conclusion": conclusion}


class FakeRuns:
    def __init__(self, **runs_by_event):
        self.runs_by_event = runs_by_event
        self.calls = []

    def __call__(self, event, since):
        self.calls.append((event, since))
        return [item for item in self.runs_by_event.get(event, []) if gate._parse_time(item["created_at"]) >= since]


class PreviousSlotTest(unittest.TestCase):
    def test_late_weekend_run_maps_back_to_the_same_day(self):
        # 10/25（日）の直前の回は 09:36Z（18:36 JST）に動いた
        self.assertEqual(gate.previous_slot(PRE_RACE, utc("2026-10-25T09:36:00")), utc("2026-10-25T05:00:00"))

    def test_weekday_filter_skips_back_to_the_last_matching_day(self):
        # 月曜の朝に動いても日曜の枠（24時間を超えるので扱わない）
        with self.assertRaises(ValueError):
            gate.previous_slot(PRE_RACE, utc("2026-10-26T06:00:00"))
        # 土曜 04:00Z は金曜に枠が無いので、24時間を超える前の枠が無い
        with self.assertRaises(ValueError):
            gate.previous_slot(PRE_RACE, utc("2026-10-24T04:00:00"))

    def test_daily_cron_before_the_time_of_day_maps_to_yesterday(self):
        self.assertEqual(gate.previous_slot(AFTERNOON, utc("2026-10-26T01:00:00")), utc("2026-10-25T04:30:00"))
        self.assertEqual(gate.previous_slot(AFTERNOON, utc("2026-10-25T04:30:00")), utc("2026-10-25T04:30:00"))

    def test_cron_sunday_as_seven(self):
        self.assertEqual(gate.previous_slot("0 5 * * 7", utc("2026-10-25T08:00:00")), utc("2026-10-25T05:00:00"))

    def test_unsupported_cron_is_rejected(self):
        with self.assertRaises(ValueError):
            gate.previous_slot("*/5 * * * *", utc("2026-10-25T08:00:00"))
        with self.assertRaises(ValueError):
            gate.previous_slot("0 3 1 * *", utc("2026-10-25T08:00:00"))


class ScheduleRunTest(unittest.TestCase):
    OWN = run(900, "2026-10-25T09:36:00Z", status="in_progress", conclusion=None)

    def decide(self, runs):
        return gate.decide("schedule", trigger="", event_schedule=PRE_RACE, own_run=self.OWN, list_runs=runs)

    def test_skips_when_the_on_time_dispatch_succeeded(self):
        runs = FakeRuns(workflow_dispatch=[run(800, "2026-10-25T05:00:40Z", title="Keiba SNS Pre-Race Post (定時)")])
        ok, reason = self.decide(runs)
        self.assertFalse(ok)
        self.assertIn("800", reason)
        self.assertEqual(runs.calls, [("workflow_dispatch", utc("2026-10-25T04:50:00"))])

    def test_runs_as_backup_when_the_dispatch_failed_or_is_missing(self):
        failed = FakeRuns(workflow_dispatch=[run(800, "2026-10-25T05:00:40Z", title="X (定時)", conclusion="failure")])
        self.assertTrue(self.decide(failed)[0])
        self.assertTrue(self.decide(FakeRuns())[0])

    def test_manual_dispatch_and_the_previous_slot_do_not_count(self):
        runs = FakeRuns(workflow_dispatch=[
            run(700, "2026-10-25T06:10:00Z", title="Keiba SNS Pre-Race Post"),  # 手で起こした回
            run(600, "2026-10-24T05:00:30Z", title="Keiba SNS Pre-Race Post (定時)"),  # 前の日の枠
        ])
        self.assertTrue(self.decide(runs)[0])

    def test_pending_dispatch_does_not_stop_the_schedule_run(self):
        # concurrency で待っている定時の起動は、あとで予定の回の成功を見て止まる
        runs = FakeRuns(workflow_dispatch=[run(800, "2026-10-25T05:00:40Z", title="X (定時)", status="pending", conclusion=None)])
        self.assertTrue(self.decide(runs)[0])

    def test_data_workflow_title_with_the_target_date(self):
        own = run(901, "2026-10-25T08:10:00Z", status="in_progress", conclusion=None)
        runs = FakeRuns(workflow_dispatch=[run(801, "2026-10-25T04:30:20Z", title="Keiba Data Fetch (Afternoon) (定時 2026-10-26)")])
        ok, _ = gate.decide("schedule", trigger="", event_schedule=AFTERNOON, own_run=own, list_runs=runs)
        self.assertFalse(ok)


class DispatchRunTest(unittest.TestCase):
    OWN = run(800, "2026-10-25T05:00:40Z", title="X (定時)", status="in_progress", conclusion=None)

    def decide(self, runs, *, trigger="cloudflare"):
        return gate.decide("workflow_dispatch", trigger=trigger, event_schedule="", own_run=self.OWN, list_runs=runs)

    def test_on_time_dispatch_runs(self):
        runs = FakeRuns(schedule=[run(500, "2026-10-24T09:10:00Z")])  # 前の日の予定の回
        self.assertTrue(self.decide(runs)[0])

    def test_skips_when_github_ran_the_same_slot_first(self):
        runs = FakeRuns(schedule=[run(900, "2026-10-25T05:00:10Z")])
        self.assertFalse(self.decide(runs)[0])

    def test_failed_schedule_run_does_not_stop_the_dispatch(self):
        runs = FakeRuns(schedule=[run(900, "2026-10-25T05:00:10Z", conclusion="failure")])
        self.assertTrue(self.decide(runs)[0])

    def test_skips_a_duplicate_on_time_dispatch_of_the_same_slot(self):
        runs = FakeRuns(workflow_dispatch=[run(799, "2026-10-25T05:00:05Z", title="X (定時)")])
        ok, reason = self.decide(runs)
        self.assertFalse(ok)
        self.assertIn("799", reason)

    def test_other_target_date_or_failed_dispatch_does_not_stop(self):
        own = run(801, "2026-10-25T04:30:20Z", title="Keiba Data Fetch (Afternoon) (定時 2026-10-26)", status="in_progress", conclusion=None)
        runs = FakeRuns(workflow_dispatch=[
            run(780, "2026-10-25T04:00:00Z", title="Keiba Data Fetch (Afternoon) (定時 2026-10-25)"),  # 手で出した前の日の分
            run(790, "2026-10-25T04:30:05Z", title="Keiba Data Fetch (Afternoon) (定時 2026-10-26)", conclusion="failure"),
        ])
        ok, _ = gate.decide("workflow_dispatch", trigger="cloudflare", event_schedule="", own_run=own, list_runs=runs)
        self.assertTrue(ok)

    def test_manual_dispatch_never_checks(self):
        runs = FakeRuns(schedule=[run(900, "2026-10-25T05:00:10Z")])
        self.assertTrue(self.decide(runs, trigger="")[0])
        self.assertEqual(runs.calls, [])


class MainTest(unittest.TestCase):
    def test_unreadable_api_runs_and_writes_the_output(self):
        import os
        import tempfile
        from unittest.mock import patch

        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "out.txt"
            env = {
                "GITHUB_EVENT_NAME": "schedule",
                "EVENT_SCHEDULE": PRE_RACE,
                "GITHUB_REPOSITORY": "owner/repo",
                "GITHUB_RUN_ID": "1",
                "GITHUB_WORKFLOW_REF": "owner/repo/.github/workflows/keiba-sns-pre-race.yml@refs/heads/main",
                "GITHUB_OUTPUT": str(output),
            }
            with patch.dict(os.environ, env, clear=False), patch.object(gate, "_api", side_effect=OSError("network")):
                self.assertEqual(gate.main(), 0)
            self.assertEqual(output.read_text(encoding="utf-8"), "run=true\n")


if __name__ == "__main__":
    unittest.main()
