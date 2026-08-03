import importlib.util
import json
import os
import sys
import unittest
from datetime import datetime
from pathlib import Path


os.environ["KEIBA_NEWS_REMOTE_SCHEDULE_ENABLED"] = "false"
os.environ["KEIBA_NEWS_DB_ENRICH_ENABLED"] = "false"
SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts" / "agents"
sys.path.insert(0, str(SCRIPT_DIR))
SPEC = importlib.util.spec_from_file_location(
    "grade_race_registry_audit_test_target",
    SCRIPT_DIR / "grade_race_registry_audit.py",
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("grade_race_registry_audit.pyを読み込めません。")
registry_audit = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = registry_audit
SPEC.loader.exec_module(registry_audit)


class GradeRaceRegistryAuditTest(unittest.TestCase):
    def test_detects_alias_collision_but_resolves_trusted_upcoming_entity(self) -> None:
        registry = [
            {"entity_key": "one", "name": "確認重賞", "aliases": ["確認重賞"], "circuit": "jra"},
            {"entity_key": "two", "name": "別重賞", "aliases": ["確認重賞"], "circuit": "jra"},
        ]
        schedule = [
            registry_audit.planner.RaceDemand(
                "未登録重賞",
                ("未登録重賞",),
                8,
                2,
                "G3",
                30,
                year=2026,
                source_kind="jra",
            )
        ]
        report = registry_audit.audit_registry(
            registry,
            schedule,
            datetime.fromisoformat("2026-08-01T12:00:00+09:00"),
        )
        error_types = {row["type"] for row in report["errors"]}
        self.assertIn("ambiguous_alias", error_types)
        self.assertNotIn("missing_scheduled_entity", error_types)
        self.assertEqual(report["derived_count"], 1)

    def test_unresolved_future_is_warning_but_due_race_is_blocking(self) -> None:
        registry: list[dict[str, object]] = []
        future_schedule = [
            registry_audit.planner.RaceDemand(
                "未確認の将来重賞",
                ("未確認の将来重賞",),
                8,
                20,
                "G3",
                30,
                year=2026,
                source_kind="web",
            )
        ]
        future_report = registry_audit.audit_registry(
            registry,
            future_schedule,
            datetime.fromisoformat("2026-08-01T12:00:00+09:00"),
        )
        self.assertFalse(future_report["errors"])
        self.assertIn(
            "unresolved_future_scheduled_entity",
            {row["type"] for row in future_report["warnings"]},
        )

        due_schedule = [
            registry_audit.planner.RaceDemand(
                "未確認の直前重賞",
                ("未確認の直前重賞",),
                8,
                2,
                "G3",
                30,
                year=2026,
                source_kind="web",
            )
        ]
        due_report = registry_audit.audit_registry(
            registry,
            due_schedule,
            datetime.fromisoformat("2026-08-01T12:00:00+09:00"),
        )
        self.assertIn(
            "unresolved_due_scheduled_entity",
            {row["type"] for row in due_report["errors"]},
        )

    def test_real_registry_covers_current_three_and_future_schedule_is_resolvable(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        registry = json.loads(
            (repo_root / "frontend" / "content" / "reference" / "grade-race-entities.json")
            .read_text(encoding="utf-8")
        )
        now = datetime.fromisoformat("2026-08-03T08:00:00+09:00")
        report = registry_audit.audit_registry(
            registry,
            registry_audit.planner.available_race_demands(now),
            now,
        )
        self.assertFalse(report["errors"])
        focus = {row["race_name"]: row for row in report["focus_races"]}
        for race_name in ("はまなす賞", "ジュニアグランプリ", "九州チャンピオンシップ"):
            self.assertEqual(focus[race_name]["entity_key_source"], "curated_registry")
        self.assertGreater(report["derived_count"], 0)


if __name__ == "__main__":
    unittest.main()
