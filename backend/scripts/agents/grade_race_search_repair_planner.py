#!/usr/bin/env python3
"""GSC重賞急落レポートから安全な既存記事救済WriteOrderを作る。"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


def parse_frontmatter(path: Path) -> dict[str, str]:
    try:
        content = path.read_text(encoding="utf-8")
    except OSError:
        return {}
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    fields: dict[str, str] = {}
    for line in parts[1].splitlines():
        match = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", line.strip())
        if match:
            fields[match.group(1)] = match.group(2).strip().strip("'\"")
    return fields


def cooldown_elapsed(fields: Mapping[str, str], now: datetime, cooldown_hours: int) -> bool:
    raw = str(fields.get("gsc_grade_race_last_repaired_at") or "").strip()
    if not raw:
        return True
    try:
        previous = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return True
    if previous.tzinfo is None:
        previous = previous.replace(tzinfo=timezone.utc)
    elapsed = (now.astimezone(timezone.utc) - previous.astimezone(timezone.utc)).total_seconds() / 3600
    return elapsed >= cooldown_hours


def pending_repair_slugs(orders_dir: Path) -> set[str]:
    slugs: set[str] = set()
    for path in orders_dir.glob("*.json"):
        try:
            order = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if order.get("operation") == "grade_race_search_repair" and order.get("rewrite_target_slug"):
            slugs.add(str(order["rewrite_target_slug"]))
    return slugs


def build_repair_orders(
    report: Mapping[str, Any],
    articles_dir: Path,
    orders_dir: Path,
    report_path: Path,
    *,
    max_orders: int,
    cooldown_hours: int,
    now: datetime,
) -> list[dict[str, Any]]:
    pending = pending_repair_slugs(orders_dir)
    orders: list[dict[str, Any]] = []
    for candidate in report.get("repair_candidates") or []:
        if not isinstance(candidate, dict):
            continue
        slug = str(candidate.get("target_slug") or "").strip()
        entity_key = str(candidate.get("entity_key") or "").strip()
        season_year = str(candidate.get("season_year") or "").strip()
        scheduled_race_date = str(candidate.get("scheduled_race_date") or "").strip()[:10]
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,199}", slug) or not entity_key or slug in pending:
            continue
        article_path = articles_dir / f"{slug}.md"
        fields = parse_frontmatter(article_path)
        if (
            fields.get("entity_type") != "grade_race"
            or fields.get("entity_key") != entity_key
            or fields.get("season_year") != season_year
            or not scheduled_race_date
            or fields.get("scheduled_race_date", "")[:10] != scheduled_race_date
            or not cooldown_elapsed(fields, now, cooldown_hours)
        ):
            continue
        alert_types = [str(value) for value in candidate.get("alert_types") or [] if value]
        order = {
            "operation": "grade_race_search_repair",
            "rewrite_target_slug": slug,
            "target_keyword": fields.get("target_keyword") or fields.get("title") or slug,
            "theme_cluster": "grade_race_search_repair",
            "entity_type": "grade_race",
            "entity_key": entity_key,
            "season_year": season_year,
            "priority": 130,
            "reference_data": {
                "period": f"{(report.get('window') or {}).get('start', '')}/{(report.get('window') or {}).get('end', '')}",
                "condition": "Search Console重賞検索急落の安全な意図調整",
                "sample_size": 0,
                "key_metrics": [],
                "article_type": "grade_race_search_repair",
                "entity_type": "grade_race",
                "entity_key": entity_key,
                "season_year": season_year,
                "scheduled_race_date": scheduled_race_date,
                "source_race_entity_key": entity_key,
                "repair_alert_types": alert_types,
                "gsc_repair_report_path": str(report_path.resolve()),
            },
        }
        orders.append(order)
        if len(orders) >= max_orders:
            break
    return orders


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--articles-dir", required=True)
    parser.add_argument("--orders-dir", required=True)
    parser.add_argument("--max-orders", type=int, default=1)
    parser.add_argument("--cooldown-hours", type=int, default=48)
    parser.add_argument("--now")
    args = parser.parse_args()

    report_path = Path(args.report)
    report = json.loads(report_path.read_text(encoding="utf-8"))
    now = datetime.fromisoformat(args.now) if args.now else datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    orders_dir = Path(args.orders_dir)
    orders_dir.mkdir(parents=True, exist_ok=True)
    orders = build_repair_orders(
        report,
        Path(args.articles_dir),
        orders_dir,
        report_path,
        max_orders=max(0, args.max_orders),
        cooldown_hours=max(1, args.cooldown_hours),
        now=now,
    )
    timestamp = now.astimezone(timezone.utc).strftime("%Y%m%d_%H%M%S")
    for index, order in enumerate(orders, start=1):
        output = orders_dir / f"{timestamp}_grade_race_search_repair_{index}.json"
        output.write_text(json.dumps(order, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"[GradeRaceSearchRepair] WriteOrder作成: {output}")
    print(json.dumps({"repair_orders": len(orders)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
