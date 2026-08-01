#!/usr/bin/env python3
"""共有重賞レジストリと直近の公開対象日程を検証する。"""

from __future__ import annotations

import argparse
import json
import os
import re
import unicodedata
from collections import defaultdict
from datetime import datetime
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

    focus_rows: list[dict[str, Any]] = []
    for entry, days_to_race in planner.focus_races(now, schedule=schedule):
        if not planner.is_race_article_eligible(entry):
            continue
        matches = exact_entity_keys(registry, entry.name)
        status = "ok" if len(matches) == 1 else "blocked"
        focus_rows.append({
            "race_name": entry.name,
            "race_date": planner.race_demand_date(entry, now).isoformat(),
            "days_to_race": days_to_race,
            "grade": planner.normalize_grade_label(entry.grade),
            "entity_key": next(iter(matches)) if len(matches) == 1 else "",
            "status": status,
        })
        if len(matches) == 0:
            errors.append({"type": "missing_scheduled_entity", "race_name": entry.name})
        elif len(matches) > 1:
            errors.append({
                "type": "ambiguous_scheduled_entity",
                "race_name": entry.name,
                "entity_keys": sorted(matches),
            })

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
        "focus_races": focus_rows,
        "errors": errors,
        "warnings": warnings,
    }


def render_summary(report: Mapping[str, Any]) -> str:
    lines = [
        "# 重賞レジストリ事前監査",
        "",
        f"- 登録エンティティ: {report.get('registry_entities', 0)}件",
        f"- 直近公開対象: {len(report.get('focus_races') or [])}件",
        f"- エラー: {len(report.get('errors') or [])}件",
        f"- alias重複注意: {len(report.get('warnings') or [])}件",
        "",
    ]
    for row in report.get("focus_races") or []:
        lines.append(
            f"- {row.get('race_date')} {row.get('race_name')}: "
            f"{row.get('entity_key') or row.get('status')}"
        )
    for error in report.get("errors") or []:
        lines.append(f"- ERROR: {json.dumps(error, ensure_ascii=False)}")
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
    print(json.dumps({"errors": len(report["errors"]), "focus_races": len(report["focus_races"])}, ensure_ascii=False))
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
