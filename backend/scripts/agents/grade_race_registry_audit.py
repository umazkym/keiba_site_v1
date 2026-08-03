#!/usr/bin/env python3
"""共有重賞レジストリと直近の公開対象日程を検証する。"""

from __future__ import annotations

import argparse
import json
import os
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Mapping, Sequence

os.environ.setdefault("KEIBA_NEWS_REMOTE_SCHEDULE_ENABLED", "false")
os.environ.setdefault("KEIBA_NEWS_DB_ENRICH_ENABLED", "false")

import news_topic_planner as planner


class RegistryAuditError(RuntimeError):
    pass


def normalize_alias(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", str(value or ""))
    normalized = re.sub(r"20\d{2}年?", "", normalized)
    return re.sub(r"[\s　・･（）()【】「」『』｜|:：_\-]", "", normalized).lower()


def load_registry(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RegistryAuditError(f"重賞レジストリを読めません: {path}") from exc
    if not isinstance(payload, list):
        raise RegistryAuditError("重賞レジストリは配列である必要があります。")
    return [row for row in payload if isinstance(row, dict)]


def exact_entity_keys(registry: Sequence[Mapping[str, Any]], race_name: str) -> set[str]:
    target = normalize_alias(race_name)
    return {
        str(row.get("entity_key") or "")
        for row in registry
        for alias in [row.get("name"), *(row.get("aliases") or [])]
        if normalize_alias(str(alias or "")) == target and row.get("entity_key")
    }


def audit_registry(
    registry: Sequence[Mapping[str, Any]],
    schedule: Sequence[planner.RaceDemand],
    now: datetime,
) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    entity_rows: dict[str, list[int]] = defaultdict(list)
    alias_entities: dict[str, set[str]] = defaultdict(set)

    for index, row in enumerate(registry):
        entity_key = str(row.get("entity_key") or "").strip()
        if not re.fullmatch(r"[a-z0-9-]+", entity_key):
            errors.append({"type": "invalid_entity_key", "index": index, "entity_key": entity_key})
            continue
        circuit = str(row.get("circuit") or "").strip().lower()
        if circuit not in {"jra", "nar", "overseas"}:
            errors.append({"type": "invalid_circuit", "index": index, "entity_key": entity_key, "circuit": circuit})
        archive_slug = str(row.get("archive_slug") or entity_key).strip()
        if not re.fullmatch(r"[a-z0-9-]+", archive_slug):
            errors.append({
                "type": "invalid_archive_slug",
                "index": index,
                "entity_key": entity_key,
                "archive_slug": archive_slug,
            })
        entity_rows[entity_key].append(index)
        aliases = [row.get("name"), *(row.get("aliases") or [])]
        for alias in aliases:
            normalized = normalize_alias(str(alias or ""))
            if normalized:
                alias_entities[normalized].add(entity_key)

    for entity_key, indexes in sorted(entity_rows.items()):
        if len(indexes) > 1:
            errors.append({"type": "duplicate_entity_key", "entity_key": entity_key, "indexes": indexes})
    for alias, entity_keys in sorted(alias_entities.items()):
        if len(entity_keys) > 1:
            errors.append({"type": "ambiguous_alias", "alias": alias, "entity_keys": sorted(entity_keys)})

    eligible_schedule = [entry for entry in schedule if planner.is_race_article_eligible(entry)]
    schedule_occurrences: dict[tuple[str, str, int], list[tuple[planner.RaceDemand, int]]] = defaultdict(list)
    for entry in eligible_schedule:
        days_to_race = planner.days_until_race(entry, now)
        if days_to_race < -planner.focus_window()[1] or days_to_race > 370:
            continue
        identity = (
            planner.race_demand_circuit(entry),
            normalize_alias(entry.name),
            planner.race_demand_date(entry, now).year,
        )
        schedule_occurrences[identity].append((entry, days_to_race))

    ambiguous_occurrences: set[tuple[str, str, int]] = set()
    for identity, occurrences in schedule_occurrences.items():
        dates = {planner.race_demand_date(entry, now).isoformat() for entry, _days in occurrences}
        if len(dates) <= 1:
            continue
        ambiguous_occurrences.add(identity)
        due = any(planner.due_grade_race_milestones(entry, days, now=now) for entry, days in occurrences)
        issue = {
            "type": "ambiguous_schedule_occurrence",
            "circuit": identity[0],
            "race_name": occurrences[0][0].name,
            "season_year": identity[2],
            "race_dates": sorted(dates),
        }
        (errors if due else warnings).append(issue)

    coverage_rows: list[dict[str, Any]] = []
    derived_materials: dict[str, set[str]] = defaultdict(set)
    next_due_dates: list[str] = []
    for identity, occurrences in sorted(
        schedule_occurrences.items(),
        key=lambda item: min(planner.race_demand_date(entry, now) for entry, _days in item[1]),
    ):
        if identity in ambiguous_occurrences:
            continue
        entry, days_to_race = occurrences[0]
        if not planner.is_race_article_eligible(entry):
            continue
        resolution = planner.resolve_grade_race_schedule_identity(entry, registry=list(registry))
        due_milestones = planner.due_grade_race_milestones(entry, days_to_race, now=now)
        due_now = bool(due_milestones)
        lead_days = planner.race_article_initial_lead_days(entry)
        if not due_now and lead_days is not None and days_to_race >= 0:
            due_date = planner.race_demand_date(entry, now) - timedelta(days=lead_days)
            if due_date >= now.date():
                next_due_dates.append(due_date.isoformat())
        status = resolution.source if resolution.resolved else ("blocked" if due_now else "skipped")
        row = {
            "race_name": entry.name,
            "race_date": planner.race_demand_date(entry, now).isoformat(),
            "days_to_race": days_to_race,
            "grade": planner.normalize_grade_label(entry.grade),
            "circuit": planner.race_demand_circuit(entry),
            "entity_key": resolution.entity_key,
            "entity_key_source": resolution.source,
            "archive_slug": resolution.archive_slug,
            "due_now": due_now,
            "due_milestones": [milestone for milestone, _stage, _intent, _status in due_milestones],
            "status": status,
        }
        coverage_rows.append(row)
        if resolution.source == "deterministic_schedule":
            material = f"{resolution.circuit}|{resolution.normalized_name}"
            derived_materials[resolution.entity_key].add(material)
            warnings.append({
                "type": "derived_scheduled_entity",
                "race_name": entry.name,
                "race_date": row["race_date"],
                "entity_key": resolution.entity_key,
                "due_now": due_now,
            })
        elif not resolution.resolved:
            issue = {
                "type": "unresolved_due_scheduled_entity" if due_now else "unresolved_future_scheduled_entity",
                "race_name": entry.name,
                "race_date": row["race_date"],
                "reason": resolution.error,
            }
            (errors if due_now else warnings).append(issue)

    for entity_key, materials in sorted(derived_materials.items()):
        if len(materials) > 1:
            errors.append({
                "type": "deterministic_entity_key_collision",
                "entity_key": entity_key,
                "materials": sorted(materials),
            })

    focus_rows = [row for row in coverage_rows if planner.is_in_focus_window(int(row["days_to_race"]))]
    curated_count = sum(row["entity_key_source"] == "curated_registry" for row in coverage_rows)
    derived_count = sum(row["entity_key_source"] == "deterministic_schedule" for row in coverage_rows)
    skipped_count = sum(row["status"] == "skipped" for row in coverage_rows) + len(ambiguous_occurrences)

    normalized_aliases = sorted(alias_entities)
    for shorter in normalized_aliases:
        if len(shorter) < 4:
            continue
        containing = [longer for longer in normalized_aliases if longer != shorter and shorter in longer]
        if containing:
            warnings.append({
                "type": "substring_alias_overlap",
                "alias": shorter,
                "containing_aliases": containing[:10],
            })

    return {
        "generated_at": now.isoformat(),
        "registry_entities": len(entity_rows),
        "schedule_coverage": coverage_rows,
        "focus_races": focus_rows,
        "curated_count": curated_count,
        "derived_count": derived_count,
        "skipped_count": skipped_count,
        "blocking_count": len(errors),
        "next_publication_due": min(next_due_dates) if next_due_dates else "",
        "errors": errors,
        "warnings": warnings,
    }


def render_summary(report: Mapping[str, Any]) -> str:
    lines = [
        "# 重賞レジストリ事前監査",
        "",
        f"- 登録エンティティ: {report.get('registry_entities', 0)}件",
        f"- 将来日程カバレッジ: {len(report.get('schedule_coverage') or [])}件",
        f"- 直近公開対象: {len(report.get('focus_races') or [])}件",
        f"- 台帳解決: {report.get('curated_count', 0)}件",
        f"- 日程からの自動解決: {report.get('derived_count', 0)}件",
        f"- 見送り: {report.get('skipped_count', 0)}件",
        f"- 停止理由: {report.get('blocking_count', 0)}件",
        f"- 次回公開期限: {report.get('next_publication_due') or 'なし'}",
        f"- 警告: {len(report.get('warnings') or [])}件",
        "",
    ]
    for row in report.get("focus_races") or []:
        lines.append(
            f"- {row.get('race_date')} {row.get('race_name')}: "
            f"{row.get('entity_key') or row.get('status')}"
        )
    for error in report.get("errors") or []:
        lines.append(f"- ERROR: {json.dumps(error, ensure_ascii=False)}")
    skipped_warnings = [
        row for row in report.get("warnings") or []
        if row.get("type") in {"unresolved_future_scheduled_entity", "ambiguous_schedule_occurrence"}
    ]
    if skipped_warnings:
        lines.extend(["", "## 見送った日程（先頭10件）", ""])
        for warning in skipped_warnings[:10]:
            lines.append(f"- {json.dumps(warning, ensure_ascii=False)}")
    derived_rows = [
        row for row in report.get("schedule_coverage") or []
        if row.get("entity_key_source") == "deterministic_schedule"
    ]
    if derived_rows:
        lines.extend(["", "## 自動解決された今後の重賞（先頭10件）", ""])
        for row in derived_rows[:10]:
            lines.append(f"- {row.get('race_date')} {row.get('race_name')}: {row.get('entity_key')}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--now", help="JSTの基準日時")
    args = parser.parse_args()

    if args.now:
        os.environ["KEIBA_NEWS_NOW"] = args.now
        planner._RACE_SCHEDULE_CACHE.clear()
    now = planner.current_jst()
    registry = load_registry(Path(args.registry))
    schedule = planner.available_race_demands(now)
    report = audit_registry(registry, schedule, now)

    output_path = Path(args.output)
    summary_path = Path(args.summary)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary_path.write_text(render_summary(report), encoding="utf-8")
    print(json.dumps({
        "errors": len(report["errors"]),
        "focus_races": len(report["focus_races"]),
        "curated": report["curated_count"],
        "derived": report["derived_count"],
        "skipped": report["skipped_count"],
        "next_publication_due": report["next_publication_due"],
    }, ensure_ascii=False))
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
