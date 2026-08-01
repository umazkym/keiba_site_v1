#!/usr/bin/env python3
"""重賞検索の順位急落・表示減・記事重複・更新段階不整合を日次監視する。"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from gsc_seo_analyzer import (
    FINALIZATION_LAG_DAYS,
    DateWindow,
    create_search_console_executor,
    fetch_search_analytics_rows,
)


PACIFIC = ZoneInfo("America/Los_Angeles")
WINDOW_DAYS = 10
MIN_DROP_BASE_IMPRESSIONS = 50.0
IMPRESSION_DROP_RATIO = 0.80
MIN_POSITION_BASE_IMPRESSIONS = 20.0
POSITION_WORSENING = 30.0


class GradeRaceMonitorError(RuntimeError):
    pass


@dataclass
class DailyMetrics:
    clicks: float = 0.0
    impressions: float = 0.0
    weighted_position: float = 0.0
    pages: set[str] = field(default_factory=set)

    def add(self, row: Mapping[str, Any], page: str) -> None:
        impressions = max(0.0, float(row.get("impressions") or 0))
        self.clicks += max(0.0, float(row.get("clicks") or 0))
        self.impressions += impressions
        self.weighted_position += float(row.get("position") or 0) * impressions
        if page:
            self.pages.add(page)

    @property
    def position(self) -> float:
        return self.weighted_position / self.impressions if self.impressions else 0.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "clicks": round(self.clicks, 3),
            "impressions": round(self.impressions, 3),
            "ctr": round(self.clicks / self.impressions, 6) if self.impressions else 0.0,
            "position": round(self.position, 3),
            "pages": sorted(self.pages),
        }


def normalize_race_text(value: str) -> str:
    return re.sub(r"[\s　・（）()【】「」『』]", "", str(value or "")).lower().replace("ステークス", "s").replace("カップ", "c")


def load_registry(path: Path) -> list[dict[str, Any]]:
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise GradeRaceMonitorError(f"重賞レジストリを読めません: {path}") from exc
    if not isinstance(rows, list):
        raise GradeRaceMonitorError("重賞レジストリは配列である必要があります。")
    return [row for row in rows if isinstance(row, dict) and row.get("entity_key")]


def entity_aliases(registry: Sequence[Mapping[str, Any]]) -> list[tuple[str, str, str]]:
    aliases: list[tuple[str, str, str]] = []
    for entity in registry:
        entity_key = str(entity.get("entity_key") or "")
        display_name = str(entity.get("name") or entity_key)
        values = [display_name, *(entity.get("aliases") or [])]
        for alias in values:
            normalized = normalize_race_text(str(alias))
            if normalized:
                aliases.append((normalized, entity_key, display_name))
    return sorted(set(aliases), key=lambda item: len(item[0]), reverse=True)


def match_entity(query: str, aliases: Sequence[tuple[str, str, str]]) -> tuple[str, str] | None:
    normalized = normalize_race_text(query)
    for alias, entity_key, display_name in aliases:
        if alias in normalized:
            return entity_key, display_name
    return None


def aggregate_rows(
    rows: Sequence[Mapping[str, Any]],
    registry: Sequence[Mapping[str, Any]],
) -> dict[str, dict[str, DailyMetrics]]:
    aliases = entity_aliases(registry)
    grouped: dict[str, dict[str, DailyMetrics]] = defaultdict(lambda: defaultdict(DailyMetrics))
    for row in rows:
        keys = row.get("keys") or []
        if len(keys) < 3:
            continue
        row_date, query, page = str(keys[0]), str(keys[1]), str(keys[2])
        matched = match_entity(query, aliases)
        if not matched:
            continue
        entity_key, _display_name = matched
        grouped[entity_key][row_date].add(row, page)
    return grouped


def latest_two_dates(rows: Sequence[Mapping[str, Any]]) -> tuple[str, str] | None:
    dates = sorted({str((row.get("keys") or [""])[0]) for row in rows if row.get("keys")})
    return (dates[-2], dates[-1]) if len(dates) >= 2 else None


def detect_search_alerts(
    rows: Sequence[Mapping[str, Any]],
    registry: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    date_pair = latest_two_dates(rows)
    if not date_pair:
        return []
    previous_date, latest_date = date_pair
    grouped = aggregate_rows(rows, registry)
    names = {str(row.get("entity_key")): str(row.get("name") or row.get("entity_key")) for row in registry}
    alerts: list[dict[str, Any]] = []
    for entity_key, daily in sorted(grouped.items()):
        previous = daily.get(previous_date, DailyMetrics())
        latest = daily.get(latest_date, DailyMetrics())
        if (
            previous.impressions >= MIN_DROP_BASE_IMPRESSIONS
            and latest.impressions <= previous.impressions * (1 - IMPRESSION_DROP_RATIO)
        ):
            alerts.append({
                "type": "impression_drop",
                "entity_key": entity_key,
                "race_name": names.get(entity_key, entity_key),
                "previous_date": previous_date,
                "latest_date": latest_date,
                "previous": previous.as_dict(),
                "latest": latest.as_dict(),
            })
        if (
            previous.impressions >= MIN_POSITION_BASE_IMPRESSIONS
            and latest.impressions > 0
            and latest.position - previous.position >= POSITION_WORSENING
        ):
            alerts.append({
                "type": "position_worsening",
                "entity_key": entity_key,
                "race_name": names.get(entity_key, entity_key),
                "previous_date": previous_date,
                "latest_date": latest_date,
                "previous": previous.as_dict(),
                "latest": latest.as_dict(),
            })

        article_pages = {
            urlsplit(page).path
            for metrics in daily.values()
            for page in metrics.pages
            if urlsplit(page).path.startswith("/articles/")
        }
        if len(article_pages) >= 2:
            alerts.append({
                "type": "multiple_article_pages",
                "entity_key": entity_key,
                "race_name": names.get(entity_key, entity_key),
                "pages": sorted(article_pages),
            })
    return alerts


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


def redirected_slugs(path: Path) -> set[str]:
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    return {
        str(slug)
        for row in rows if isinstance(row, dict)
        for slug in row.get("redirect_slugs", [])
    }


def detect_content_alerts(articles_dir: Path, redirects_path: Path) -> list[dict[str, Any]]:
    redirects = redirected_slugs(redirects_path)
    grouped: dict[tuple[str, str], list[str]] = defaultdict(list)
    alerts: list[dict[str, Any]] = []
    for path in articles_dir.glob("*.md"):
        if path.stem in redirects:
            continue
        fields = parse_frontmatter(path)
        if fields.get("draft", "false").lower() == "true" or fields.get("entity_type") != "grade_race":
            continue
        entity_key = fields.get("entity_key", "")
        season_year = fields.get("season_year", "")
        if not entity_key:
            alerts.append({"type": "missing_entity_key", "slug": path.stem})
        if entity_key and season_year:
            grouped[(entity_key, season_year)].append(path.stem)

        scheduled_text = fields.get("scheduled_race_date", "")[:10]
        # 同一URLを段階更新するため、現在の段階が成立した時点は最終更新日で判定する。
        # 初回公開日だけを見ると、D-10にfield_buildingで公開しD-2にdraw_confirmedへ
        # 正しく更新した記事まで「早すぎる枠順断定」と誤検知してしまう。
        article_text = (
            fields.get("last_updated", "")
            or fields.get("date", "")
            or fields.get("article_published_time", "")
        )[:10]
        try:
            scheduled = date.fromisoformat(scheduled_text)
            article_date = date.fromisoformat(article_text)
        except ValueError:
            continue
        stage = fields.get("update_stage", "")
        if stage in {"post_race", "result_review"} and article_date < scheduled:
            alerts.append({"type": "premature_post_race", "slug": path.stem, "scheduled_race_date": scheduled_text})
        if stage == "draw_confirmed" and article_date < scheduled - timedelta(days=3):
            alerts.append({"type": "premature_draw_claim", "slug": path.stem, "scheduled_race_date": scheduled_text})
        if stage in {"draw_confirmed", "final_48h", "race_morning"} and fields.get("draw_status") != "confirmed":
            alerts.append({"type": "draw_without_confirmed_data", "slug": path.stem, "scheduled_race_date": scheduled_text})
        if stage in {"post_race", "result_review"} and fields.get("result_confirmed", "").lower() != "true":
            alerts.append({"type": "post_race_without_confirmed_result", "slug": path.stem, "scheduled_race_date": scheduled_text})

    for (entity_key, season_year), slugs in sorted(grouped.items()):
        if len(slugs) >= 2:
            alerts.append({
                "type": "duplicate_published_articles",
                "entity_key": entity_key,
                "season_year": season_year,
                "slugs": sorted(slugs),
            })
    return alerts


def render_summary(report: Mapping[str, Any]) -> str:
    search_alerts = list(report.get("search_alerts") or [])
    content_alerts = list(report.get("content_alerts") or [])
    lines = [
        "# 重賞検索の日次監視",
        "",
        f"- 対象期間: {report['window']['start']}〜{report['window']['end']}",
        f"- 検索警告: {len(search_alerts)}件",
        f"- 記事構造警告: {len(content_alerts)}件",
        "",
    ]
    for alert in search_alerts:
        label = {
            "impression_drop": "表示回数が80%以上減少",
            "position_worsening": "平均順位が30位以上悪化",
            "multiple_article_pages": "同一重賞に複数記事URL",
        }.get(alert.get("type"), str(alert.get("type")))
        lines.append(f"- {alert.get('race_name', alert.get('entity_key'))}: {label}")
    for alert in content_alerts:
        lines.append(f"- {alert.get('slug', alert.get('entity_key', '記事'))}: {alert.get('type')}")
    if not search_alerts and not content_alerts:
        lines.append("- 警告はありません。")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-url", default="sc-domain:uma-free.com")
    parser.add_argument("--registry", required=True)
    parser.add_argument("--articles-dir", required=True)
    parser.add_argument("--redirects", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--rows", help="テスト・再解析用のGSC rows JSON")
    parser.add_argument("--now", help="Pacific Timeの基準日時")
    args = parser.parse_args()

    base = datetime.fromisoformat(args.now).astimezone(PACIFIC) if args.now else datetime.now(PACIFIC)
    end = base.date() - timedelta(days=FINALIZATION_LAG_DAYS)
    window = DateWindow(start=end - timedelta(days=WINDOW_DAYS - 1), end=end)
    if args.rows:
        rows = json.loads(Path(args.rows).read_text(encoding="utf-8"))
    else:
        executor = create_search_console_executor(args.site_url)
        rows = fetch_search_analytics_rows(
            executor,
            window=window,
            dimensions=["date", "query", "page"],
        )

    registry = load_registry(Path(args.registry))
    report = {
        "generated_at": base.isoformat(),
        "window": {"start": window.start.isoformat(), "end": window.end.isoformat()},
        "rows": len(rows),
        "search_alerts": detect_search_alerts(rows, registry),
        "content_alerts": detect_content_alerts(Path(args.articles_dir), Path(args.redirects)),
    }
    output = Path(args.output)
    summary = Path(args.summary)
    output.parent.mkdir(parents=True, exist_ok=True)
    summary.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary.write_text(render_summary(report), encoding="utf-8")
    print(json.dumps({"search_alerts": len(report["search_alerts"]), "content_alerts": len(report["content_alerts"])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
