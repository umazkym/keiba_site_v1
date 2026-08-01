import importlib.util
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
    def test_detects_alias_collision_and_missing_upcoming_entity(self) -> None:
        registry = [
            {"entity_key": "one", "name": "確認重賞", "aliases": ["確認重賞"]},
            {"entity_key": "two", "name": "別重賞", "aliases": ["確認重賞"]},
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
        self.assertIn("missing_scheduled_entity", error_types)


if __name__ == "__main__":
    unittest.main()
