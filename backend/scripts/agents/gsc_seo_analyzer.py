#!/usr/bin/env python3
"""Search Consoleの確定データから記事SEO改善候補を抽出する。"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence
from urllib.parse import urlsplit, urlunsplit
from zoneinfo import ZoneInfo


READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
PAGE_SIZE = 25_000
MAX_ROWS = 50_000
MIN_IMPRESSIONS = 100.0
MIN_CANNIBALIZATION_IMPRESSIONS = 20.0
MIN_POSITION = 4.0
MAX_POSITION = 20.0
CURRENT_WINDOW_DAYS = 28
FINALIZATION_LAG_DAYS = 3
JST = ZoneInfo("Asia/Tokyo")
PACIFIC = ZoneInfo("America/Los_Angeles")


class GscAnalyzerError(RuntimeError):
    """GSC監査を安全に継続できない場合の例外。"""


@dataclass(frozen=True)
class DateWindow:
    start: date
    end: date

    def as_dict(self) -> dict[str, str]:
        return {
            "start_date": self.start.isoformat(),
            "end_date": self.end.isoformat(),
        }


def calculate_windows(
    now: datetime | None = None,
    *,
    lag_days: int = FINALIZATION_LAG_DAYS,
    window_days: int = CURRENT_WINDOW_DAYS,
) -> tuple[DateWindow, DateWindow]:
    """GSCのPacific Time基準で、確定済みの連続28日×2期間を返す。"""

    base = (now or datetime.now(PACIFIC)).astimezone(PACIFIC).date()
    current_end = base - timedelta(days=lag_days)
    current_start = current_end - timedelta(days=window_days - 1)
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=window_days - 1)
    return (
        DateWindow(start=current_start, end=current_end),
        DateWindow(start=previous_start, end=previous_end),
    )


def normalize_url(value: str) -> str:
    """クエリ・fragment・末尾slashを除去し、GSCと記事在庫を同じURLへ正規化する。"""

    raw = str(value or "").strip()
    if not raw:
        return ""
    parsed = urlsplit(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/")
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, "", ""))


def position_bucket(position: float) -> str | None:
    if 4 <= position <= 6:
        return "4-6"
    if 6 < position <= 10:
        return "7-10"
    if 10 < position <= 15:
        return "11-15"
    if 15 < position <= 20:
        return "16-20"
    return None


def classify_search_intent(query: str) -> str:
    """自由入力の検索語を、収益監査で比較できる低カーディナリティへまとめる。"""

    normalized = str(query or "").strip().lower().replace("　", " ")
    compact = normalized.replace(" ", "")
    if any(token in compact for token in ("uma-free", "umafree", "ウマフリー")):
        return "brand"
    if any(token in compact for token in ("結果", "着順", "払戻")):
        return "result"
    if any(token in compact for token in ("予想", "ai偏差値", "本命", "展開")):
        return "prediction"
    if any(token in compact for token in ("出走", "枠順", "追い切り", "調教", "登録馬")):
        return "race_preparation"
    if any(token in compact for token in ("稍重", "重馬場", "馬体重", "オッズ", "コース", "傾向")):
        return "evergreen_research"
    if any(token in compact for token in ("カップ", "記念", "ステークス", "ダービー", "賞", "g1", "g2", "g3", "jpn")):
        return "race_name"
    return "other"


def page_revenue_group(article: Mapping[str, Any]) -> str:
    if str(article.get("entity_type") or "") == "grade_race":
        return "grade_race"
    theme = str(article.get("theme_cluster") or "")
    if theme in {"course_guide", "ground_condition", "evergreen_guide"}:
        return "evergreen_guide"
    return "article"


def build_query_device_opportunities(
    rows: Sequence[Mapping[str, Any]],
    inventory_by_url: Mapping[str, Mapping[str, Any]],
    *,
    revenue_indices: Mapping[str, float] | None = None,
) -> list[dict[str, Any]]:
    """同順位帯・同端末・同意図のCTR中央値との差を収益指数で重み付けする。"""

    indices = {
        "grade_race": 1.0,
        "evergreen_guide": 1.0,
        "article": 1.0,
        **dict(revenue_indices or {}),
    }
    normalized_rows: list[dict[str, Any]] = []
    cohort_ctrs: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    for row in rows:
        keys = row.get("keys") or []
        if len(keys) < 3:
            continue
        canonical_url = normalize_url(str(keys[0]))
        article = inventory_by_url.get(canonical_url)
        query = str(keys[1] or "").strip()
        device = str(keys[2] or "unknown").strip().lower()
        impressions = max(0.0, float(row.get("impressions") or 0.0))
        clicks = max(0.0, float(row.get("clicks") or 0.0))
        position = float(row.get("position") or 0.0)
        bucket = position_bucket(position)
        if not article or not query or not bucket or impressions <= 0:
            continue
        ctr = clicks / impressions
        intent = classify_search_intent(query)
        cohort_key = (bucket, device, intent)
        cohort_ctrs[cohort_key].append(ctr)
        normalized_rows.append({
            "canonical_url": canonical_url,
            "source_slug": str(article.get("source_slug") or ""),
            "query": query,
            "device": device,
            "search_intent": intent,
            "position_bucket": bucket,
            "impressions": impressions,
            "clicks": clicks,
            "ctr": ctr,
            "position": position,
            "revenue_group": page_revenue_group(article),
        })

    medians = {key: statistics.median(values) for key, values in cohort_ctrs.items() if values}
    opportunities: list[dict[str, Any]] = []
    for item in normalized_rows:
        benchmark = medians[(item["position_bucket"], item["device"], item["search_intent"])]
        revenue_index = max(0.0, float(indices.get(item["revenue_group"], 1.0)))
        expected_click_gain = item["impressions"] * max(0.0, benchmark - item["ctr"])
        score = expected_click_gain * revenue_index
        if score <= 0:
            continue
        opportunities.append({
            **item,
            "ctr": round(item["ctr"], 6),
            "cohort_median_ctr": round(benchmark, 6),
            "revenue_index": round(revenue_index, 3),
            "estimated_click_gain": round(expected_click_gain, 3),
            "opportunity_score": round(score, 3),
            "impressions": round(item["impressions"], 3),
            "clicks": round(item["clicks"], 3),
            "position": round(item["position"], 3),
        })
    opportunities.sort(key=lambda item: (-item["opportunity_score"], -item["impressions"], item["query"]))
    return opportunities


def _weighted_metrics(rows: Iterable[Mapping[str, Any]]) -> dict[str, float]:
    clicks = 0.0
    impressions = 0.0
    weighted_position = 0.0
    for row in rows:
        row_impressions = max(0.0, float(row.get("impressions") or 0.0))
        clicks += max(0.0, float(row.get("clicks") or 0.0))
        impressions += row_impressions
        weighted_position += float(row.get("position") or 0.0) * row_impressions
    return {
        "clicks": clicks,
        "impressions": impressions,
        "ctr": clicks / impressions if impressions else 0.0,
        "position": weighted_position / impressions if impressions else 0.0,
    }


def aggregate_page_rows(rows: Sequence[Mapping[str, Any]]) -> dict[str, dict[str, float]]:
    grouped: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for row in rows:
        keys = row.get("keys") or []
        if not keys:
            continue
        page_url = normalize_url(str(keys[0]))
        if page_url:
            grouped[page_url].append(row)
    return {page: _weighted_metrics(page_rows) for page, page_rows in grouped.items()}


def fetch_search_analytics_rows(
    execute: Callable[[dict[str, Any]], Mapping[str, Any]],
    *,
    window: DateWindow,
    dimensions: Sequence[str],
    page_size: int = PAGE_SIZE,
    max_rows: int = MAX_ROWS,
) -> list[dict[str, Any]]:
    """Search Analytics APIを25,000行単位で最大50,000行まで取得する。"""

    collected: list[dict[str, Any]] = []
    start_row = 0
    while start_row < max_rows:
        limit = min(page_size, max_rows - start_row)
        body = {
            "startDate": window.start.isoformat(),
            "endDate": window.end.isoformat(),
            "dimensions": list(dimensions),
            "type": "web",
            "aggregationType": "auto",
            "dataState": "final",
            "rowLimit": limit,
            "startRow": start_row,
        }
        response = execute(body)
        page_rows = list(response.get("rows") or [])
        collected.extend(dict(row) for row in page_rows)
        if len(page_rows) < limit:
            break
        start_row += limit
    return collected


def create_search_console_executor(site_url: str) -> Callable[[dict[str, Any]], Mapping[str, Any]]:
    """Application Default Credentialsから読取専用GSC executorを作る。"""

    try:
        import google.auth
        from googleapiclient.discovery import build
    except ImportError as exc:  # pragma: no cover - CI/本番依存の説明用
        raise GscAnalyzerError(
            "google-api-python-client と google-auth が必要です。"
        ) from exc

    credentials, _project_id = google.auth.default(scopes=[READONLY_SCOPE])
    service = build(
        "searchconsole",
        "v1",
        credentials=credentials,
        cache_discovery=False,
    )

    def execute(body: dict[str, Any]) -> Mapping[str, Any]:
        try:
            return (
                service.searchanalytics()
                .query(siteUrl=site_url, body=body)
                .execute(num_retries=3)
            )
        except Exception as exc:  # noqa: BLE001 - API例外をCLI境界で統一する
            status = getattr(getattr(exc, "resp", None), "status", None)
            detail = f" HTTP {status}" if status else ""
            raise GscAnalyzerError(
                f"Search Console APIの取得に失敗しました。{detail}: {exc}"
            ) from exc

    return execute


def load_inventory(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise GscAnalyzerError(f"記事在庫JSONを読み込めません: {path}") from exc

    raw_articles = payload.get("articles") if isinstance(payload, dict) else None
    if not isinstance(raw_articles, list):
        raise GscAnalyzerError("記事在庫JSONにarticles配列がありません。")

    articles: list[dict[str, Any]] = []
    seen_canonicals: set[str] = set()
    seen_slugs: set[str] = set()
    for raw in raw_articles:
        if not isinstance(raw, dict):
            continue
        canonical_url = normalize_url(str(raw.get("canonical_url") or ""))
        source_slug = str(raw.get("source_slug") or "").strip()
        if (
            not canonical_url
            or not source_slug
            or source_slug in seen_slugs
            or canonical_url in seen_canonicals
            or raw.get("published") is not True
            or raw.get("self_canonical") is not True
            or raw.get("indexable") is not True
        ):
            continue
        if not urlsplit(canonical_url).path.startswith("/articles/"):
            continue
        articles.append({**raw, "canonical_url": canonical_url, "source_slug": source_slug})
        seen_canonicals.add(canonical_url)
        seen_slugs.add(source_slug)
    return articles


def _parse_date(value: Any) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def is_active_grade_race(article: Mapping[str, Any], as_of_date: date) -> bool:
    if str(article.get("entity_type") or "") != "grade_race":
        return False
    scheduled = _parse_date(article.get("scheduled_race_date"))
    if not scheduled:
        return False
    days_to_race = (scheduled - as_of_date).days
    return -3 <= days_to_race <= 7


def _round_metrics(metrics: Mapping[str, float] | None) -> dict[str, float]:
    value = metrics or {}
    return {
        "clicks": round(float(value.get("clicks") or 0.0), 3),
        "impressions": round(float(value.get("impressions") or 0.0), 3),
        "ctr": round(float(value.get("ctr") or 0.0), 6),
        "position": round(float(value.get("position") or 0.0), 3),
    }


def _query_rows_for_page(
    rows: Sequence[Mapping[str, Any]],
    canonical_url: str,
    *,
    limit: int = 8,
) -> list[dict[str, Any]]:
    matched: list[dict[str, Any]] = []
    for row in rows:
        keys = row.get("keys") or []
        if len(keys) < 2 or normalize_url(str(keys[0])) != canonical_url:
            continue
        query = str(keys[1] or "").strip()
        if not query:
            continue
        matched.append(
            {
                "query": query,
                "clicks": round(float(row.get("clicks") or 0.0), 3),
                "impressions": round(float(row.get("impressions") or 0.0), 3),
                "ctr": round(float(row.get("ctr") or 0.0), 6),
                "position": round(float(row.get("position") or 0.0), 3),
            }
        )
    matched.sort(key=lambda item: (-item["impressions"], -item["clicks"], item["query"]))
    return matched[:limit]


def detect_cannibalization(
    query_rows: Sequence[Mapping[str, Any]],
    inventory_by_url: Mapping[str, Mapping[str, Any]],
) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for row in query_rows:
        keys = row.get("keys") or []
        if len(keys) < 2:
            continue
        canonical_url = normalize_url(str(keys[0]))
        query = str(keys[1] or "").strip()
        impressions = float(row.get("impressions") or 0.0)
        article = inventory_by_url.get(canonical_url)
        if (
            not query
            or not article
            or impressions < MIN_CANNIBALIZATION_IMPRESSIONS
        ):
            continue
        grouped[query][canonical_url] = {
            "canonical_url": canonical_url,
            "source_slug": article["source_slug"],
            "impressions": round(impressions, 3),
            "clicks": round(float(row.get("clicks") or 0.0), 3),
            "position": round(float(row.get("position") or 0.0), 3),
        }

    results = [
        {
            "query": query,
            "pages": sorted(
                pages.values(),
                key=lambda item: (-item["impressions"], item["canonical_url"]),
            ),
        }
        for query, pages in grouped.items()
        if len(pages) >= 2
    ]
    results.sort(
        key=lambda item: (
            -sum(float(page["impressions"]) for page in item["pages"]),
            item["query"],
        )
    )
    return results


def analyze_report(
    *,
    site_url: str,
    inventory: Sequence[Mapping[str, Any]],
    current_window: DateWindow,
    previous_window: DateWindow,
    current_page_rows: Sequence[Mapping[str, Any]],
    previous_page_rows: Sequence[Mapping[str, Any]],
    current_query_rows: Sequence[Mapping[str, Any]],
    as_of_date: date,
    current_query_device_rows: Sequence[Mapping[str, Any]] | None = None,
    revenue_indices: Mapping[str, float] | None = None,
) -> dict[str, Any]:
    inventory_by_url = {
        normalize_url(str(article.get("canonical_url") or "")): article
        for article in inventory
        if normalize_url(str(article.get("canonical_url") or ""))
    }
    current_pages = aggregate_page_rows(current_page_rows)
    previous_pages = aggregate_page_rows(previous_page_rows)
    query_device_opportunities = build_query_device_opportunities(
        current_query_device_rows or [],
        inventory_by_url,
        revenue_indices=revenue_indices,
    )
    opportunity_by_url: dict[str, float] = defaultdict(float)
    for opportunity in query_device_opportunities:
        opportunity_by_url[opportunity["canonical_url"]] += float(opportunity["opportunity_score"])

    eligible_for_cohort: list[tuple[Mapping[str, Any], dict[str, float], str]] = []
    for canonical_url, article in inventory_by_url.items():
        if is_active_grade_race(article, as_of_date):
            continue
        metrics = current_pages.get(canonical_url)
        if not metrics:
            continue
        bucket = position_bucket(metrics["position"])
        if (
            metrics["impressions"] >= MIN_IMPRESSIONS
            and MIN_POSITION <= metrics["position"] <= MAX_POSITION
            and bucket
        ):
            eligible_for_cohort.append((article, metrics, bucket))

    cohort_values: dict[str, list[float]] = defaultdict(list)
    for _article, metrics, bucket in eligible_for_cohort:
        cohort_values[bucket].append(metrics["ctr"])
    cohort_medians = {
        bucket: statistics.median(values)
        for bucket, values in cohort_values.items()
        if values
    }

    candidates: list[dict[str, Any]] = []
    seasonal_grade_demand: list[dict[str, Any]] = []

    def build_item(
        article: Mapping[str, Any],
        metrics: Mapping[str, float],
        bucket: str | None,
        benchmark_ctr: float,
    ) -> dict[str, Any]:
        canonical_url = normalize_url(str(article["canonical_url"]))
        missed_clicks = max(
            0.0,
            float(metrics["impressions"])
            * (benchmark_ctr - float(metrics["ctr"])),
        )
        previous = previous_pages.get(canonical_url)
        return {
            "source_slug": article["source_slug"],
            "canonical_path": article.get("canonical_path") or urlsplit(canonical_url).path,
            "canonical_url": canonical_url,
            "title": str(article.get("title") or ""),
            "entity_type": str(article.get("entity_type") or ""),
            "entity_key": str(article.get("entity_key") or ""),
            "season_year": str(article.get("season_year") or ""),
            "scheduled_race_date": str(article.get("scheduled_race_date") or ""),
            "position_bucket": bucket or "outside-range",
            "cohort_median_ctr": round(benchmark_ctr, 6),
            "estimated_missed_clicks": round(missed_clicks, 3),
            "opportunity_score": round(opportunity_by_url.get(canonical_url, 0.0), 3),
            "current": _round_metrics(metrics),
            "previous": _round_metrics(previous),
            "changes": {
                "clicks": round(metrics["clicks"] - float((previous or {}).get("clicks") or 0.0), 3),
                "impressions": round(
                    metrics["impressions"] - float((previous or {}).get("impressions") or 0.0),
                    3,
                ),
                "ctr": round(metrics["ctr"] - float((previous or {}).get("ctr") or 0.0), 6),
                "position": round(
                    metrics["position"] - float((previous or {}).get("position") or 0.0),
                    3,
                ),
            },
            "top_queries": _query_rows_for_page(current_query_rows, canonical_url),
        }

    for article, metrics, bucket in eligible_for_cohort:
        benchmark_ctr = cohort_medians.get(bucket, metrics["ctr"])
        item = build_item(article, metrics, bucket, benchmark_ctr)
        if item["estimated_missed_clicks"] > 0:
            candidates.append(item)

    empty_metrics = {
        "clicks": 0.0,
        "impressions": 0.0,
        "ctr": 0.0,
        "position": 0.0,
    }
    for canonical_url, article in inventory_by_url.items():
        if not is_active_grade_race(article, as_of_date):
            continue
        metrics = current_pages.get(canonical_url, empty_metrics)
        bucket = position_bucket(metrics["position"])
        benchmark_ctr = cohort_medians.get(bucket, metrics["ctr"]) if bucket else metrics["ctr"]
        item = build_item(article, metrics, bucket, benchmark_ctr)
        item["seasonal_reason"] = "開催7日前から開催後3日までの重賞記事"
        seasonal_grade_demand.append(item)

    candidates.sort(
        key=lambda item: (
            -float(item["opportunity_score"] or item["estimated_missed_clicks"]),
            -float(item["current"]["impressions"]),
            item["canonical_url"],
        )
    )
    seasonal_grade_demand.sort(
        key=lambda item: (
            str(item.get("scheduled_race_date") or ""),
            -float(item["current"]["impressions"]),
        )
    )

    matched_urls = set(inventory_by_url)
    unmatched_pages = [
        {"canonical_url": page, **_round_metrics(metrics)}
        for page, metrics in current_pages.items()
        if urlsplit(page).path.startswith("/articles/") and page not in matched_urls
    ]
    unmatched_pages.sort(key=lambda item: (-item["impressions"], item["canonical_url"]))

    total_current = _weighted_metrics(current_pages.values())
    return {
        "schema_version": 1,
        "generated_at": datetime.now(JST).isoformat(),
        "site_url": site_url,
        "as_of_date_jst": as_of_date.isoformat(),
        "periods": {
            "current": current_window.as_dict(),
            "previous": previous_window.as_dict(),
        },
        "settings": {
            "data_state": "final",
            "min_impressions": MIN_IMPRESSIONS,
            "min_position": MIN_POSITION,
            "max_position": MAX_POSITION,
            "cannibalization_min_impressions": MIN_CANNIBALIZATION_IMPRESSIONS,
            "seasonal_grade_window_days": {"before": 7, "after": 3},
            "rewrite_cooldown_days": 28,
            "opportunity_formula": "impressions * max(0, cohort_median_ctr - ctr) * page_group_revenue_index",
            "opportunity_cohort": ["position_bucket", "device", "search_intent"],
            "page_group_revenue_indices": {
                "grade_race": float((revenue_indices or {}).get("grade_race", 1.0)),
                "evergreen_guide": float((revenue_indices or {}).get("evergreen_guide", 1.0)),
                "article": float((revenue_indices or {}).get("article", 1.0)),
            },
        },
        "summary": {
            "inventory_articles": len(inventory),
            "matched_pages": sum(1 for page in current_pages if page in matched_urls),
            "candidate_count": len(candidates),
            "seasonal_grade_count": len(seasonal_grade_demand),
            "cannibalization_count": 0,
            "current_totals": _round_metrics(total_current),
        },
        "cohort_median_ctr": {
            key: round(value, 6) for key, value in sorted(cohort_medians.items())
        },
        "candidates": candidates[:10],
        "query_device_opportunities": query_device_opportunities[:50],
        "seasonal_grade_demand": seasonal_grade_demand,
        "cannibalization": [],
        "unmatched_pages": unmatched_pages[:20],
    }


def finalize_cannibalization(
    report: dict[str, Any],
    query_rows: Sequence[Mapping[str, Any]],
    inventory: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    inventory_by_url = {
        normalize_url(str(article.get("canonical_url") or "")): article
        for article in inventory
        if normalize_url(str(article.get("canonical_url") or ""))
    }
    cannibalization = detect_cannibalization(query_rows, inventory_by_url)
    report["cannibalization"] = cannibalization
    report["summary"]["cannibalization_count"] = len(cannibalization)
    return report


def render_markdown_summary(report: Mapping[str, Any]) -> str:
    periods = report["periods"]
    summary = report["summary"]
    lines = [
        "# GSC週次SEO監査",
        "",
        f"- 対象: `{report['site_url']}`",
        (
            f"- 現期間: {periods['current']['start_date']}〜"
            f"{periods['current']['end_date']}（確定データ）"
        ),
        (
            f"- 比較期間: {periods['previous']['start_date']}〜"
            f"{periods['previous']['end_date']}"
        ),
        f"- 改善候補: {summary['candidate_count']}件",
        f"- 季節重賞（通常改稿から除外）: {summary['seasonal_grade_count']}件",
        f"- カニバリ候補: {summary['cannibalization_count']}件",
        "",
        "## 改善候補",
        "",
        "| 順位 | 記事 | 表示 | CTR | 平均順位 | 機会スコア |",
        "| ---: | --- | ---: | ---: | ---: | ---: |",
    ]
    candidates = list(report.get("candidates") or [])
    if candidates:
        for index, item in enumerate(candidates, start=1):
            current = item["current"]
            lines.append(
                "| "
                f"{index} | `{item['source_slug']}` | "
                f"{current['impressions']:.0f} | "
                f"{current['ctr'] * 100:.2f}% | "
                f"{current['position']:.1f} | "
                f"{item['opportunity_score'] or item['estimated_missed_clicks']:.1f} |"
            )
    else:
        lines.append("| - | 候補なし | - | - | - | - |")

    lines.extend(["", "## 季節重賞", ""])
    seasonal = list(report.get("seasonal_grade_demand") or [])
    if seasonal:
        for item in seasonal:
            lines.append(
                f"- `{item['source_slug']}`: {item['scheduled_race_date']} "
                f"（表示 {item['current']['impressions']:.0f}）"
            )
    else:
        lines.append("- 該当なし")

    lines.extend(["", "## カニバリ候補", ""])
    cannibalization = list(report.get("cannibalization") or [])
    if cannibalization:
        for item in cannibalization[:10]:
            slugs = ", ".join(f"`{page['source_slug']}`" for page in item["pages"])
            lines.append(f"- `{item['query']}`: {slugs}")
    else:
        lines.append("- 該当なし")
    lines.append("")
    return "\n".join(lines)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    parser.add_argument(
        "--site-url",
        default="sc-domain:uma-free.com",
        help="Search Consoleプロパティ。Domain propertyはsc-domain:で指定。",
    )
    parser.add_argument(
        "--as-of-date",
        help="季節重賞判定用のJST日付。テスト時以外は省略。",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        inventory = load_inventory(args.inventory)
        if not inventory:
            raise GscAnalyzerError("監査対象となる自己canonical記事がありません。")
        current_window, previous_window = calculate_windows()
        execute = create_search_console_executor(args.site_url)
        current_page_rows = fetch_search_analytics_rows(
            execute,
            window=current_window,
            dimensions=["page"],
        )
        previous_page_rows = fetch_search_analytics_rows(
            execute,
            window=previous_window,
            dimensions=["page"],
        )
        current_query_rows = fetch_search_analytics_rows(
            execute,
            window=current_window,
            dimensions=["page", "query"],
        )
        current_query_device_rows = fetch_search_analytics_rows(
            execute,
            window=current_window,
            dimensions=["page", "query", "device"],
        )
        if not current_page_rows:
            raise GscAnalyzerError(
                "確定期間のページ集計が空です。プロパティ、権限、データ蓄積状況を確認してください。"
            )
        # 比較期間のpage×queryは改稿候補の決定に使わないため取得しない。
        as_of_date = (
            date.fromisoformat(args.as_of_date)
            if args.as_of_date
            else datetime.now(JST).date()
        )
        report = analyze_report(
            site_url=args.site_url,
            inventory=inventory,
            current_window=current_window,
            previous_window=previous_window,
            current_page_rows=current_page_rows,
            previous_page_rows=previous_page_rows,
            current_query_rows=current_query_rows,
            current_query_device_rows=current_query_device_rows,
            as_of_date=as_of_date,
        )
        report["quality"] = {
            "query_device_row_count": len(current_query_device_rows),
            "row_limit_reached": len(current_query_device_rows) >= MAX_ROWS,
            "bigquery_export_recommended": len(current_query_device_rows) >= MAX_ROWS,
            "note": "Search Consoleのディメンション別合計は匿名化等により一致しない場合があります。",
        }
        finalize_cannibalization(report, current_query_rows, inventory)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.summary.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        args.summary.write_text(render_markdown_summary(report), encoding="utf-8")
        print(
            "[GSC SEO] "
            f"候補={report['summary']['candidate_count']}, "
            f"季節重賞={report['summary']['seasonal_grade_count']}, "
            f"カニバリ={report['summary']['cannibalization_count']}"
        )
        return 0
    except (GscAnalyzerError, ValueError) as exc:
        print(f"[GSC SEO] ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
