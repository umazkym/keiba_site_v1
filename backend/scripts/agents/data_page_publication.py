"""データ詳細ページを品質と運用余力に応じて段階公開する。"""

from __future__ import annotations

import argparse
import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlsplit

from crud import growth_crud
from database import models
from database.database import Base, SessionLocal, engine


JST = timezone(timedelta(hours=9))
ENTITY_TYPES = ("course", "horse", "jockey", "trainer")
MINIMUM_SAMPLES = {
    "horse": 5,
    "jockey": 50,
    "trainer": 50,
    "course": 100,
}


def _normalize_page_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    path = parsed.path.rstrip("/") or "/"
    return path


def _gsc_demand_from_rows(rows: Iterable[Mapping[str, Any]]) -> dict[str, dict[str, float]]:
    demand: dict[str, dict[str, float]] = {}
    for row in rows:
        keys = row.get("keys")
        if not isinstance(keys, list) or not keys:
            continue
        path = _normalize_page_url(str(keys[0]))
        if not path.startswith(("/courses/", "/horses/", "/jockeys/data/", "/trainers/")):
            continue
        current = demand.setdefault(path, {"clicks": 0.0, "impressions": 0.0})
        current["clicks"] += float(row.get("clicks") or 0.0)
        current["impressions"] += float(row.get("impressions") or 0.0)
    return demand


def fetch_gsc_demand(site_url: str) -> tuple[dict[str, dict[str, float]], str | None]:
    try:
        from scripts.agents.gsc_seo_analyzer import (
            calculate_windows,
            create_search_console_executor,
            fetch_search_analytics_rows,
        )

        current_window, _previous_window = calculate_windows()
        execute = create_search_console_executor(site_url)
        rows = fetch_search_analytics_rows(
            execute,
            window=current_window,
            dimensions=["page"],
            max_rows=25000,
        )
        return _gsc_demand_from_rows(rows), None
    except Exception as exc:  # noqa: BLE001 - GSC障害時も安全側で公開判定を継続する
        return {}, str(exc)


def _freshness_points(last_race_date: date | None, dataset_last: date | None) -> int:
    if last_race_date is None or dataset_last is None:
        return 0
    days = max(0, (dataset_last - last_race_date).days)
    if days <= 30:
        return 30
    if days <= 90:
        return 20
    if days <= 180:
        return 10
    if days <= 365:
        return 5
    return 0


def _demand_points(metrics: Mapping[str, float]) -> int:
    clicks = float(metrics.get("clicks") or 0.0)
    impressions = float(metrics.get("impressions") or 0.0)
    if clicks >= 1:
        return 20
    if impressions >= 50:
        return 15
    if impressions >= 10:
        return 10
    if impressions >= 1:
        return 5
    return 0


def calculate_quality_score(
    item: Mapping[str, Any],
    *,
    dataset_last: date | None,
    demand: Mapping[str, float] | None = None,
) -> tuple[float, dict[str, Any]]:
    entity_type = str(item["entity_type"])
    sample_size = max(0, int(item.get("sample_size") or 0))
    minimum_sample = MINIMUM_SAMPLES[entity_type]
    ratio = sample_size / minimum_sample if minimum_sample else 0.0
    sample_points = min(40.0, 20.0 * math.log2(ratio + 1.0))
    last_race_date = item.get("last_race_date")
    if isinstance(last_race_date, str):
        last_race_date = date.fromisoformat(last_race_date)
    freshness_points = _freshness_points(last_race_date, dataset_last)
    demand_metrics = dict(demand or {})
    demand_points = _demand_points(demand_metrics)
    completeness_fields = (
        item.get("id"),
        item.get("name"),
        item.get("url"),
        last_race_date,
    )
    completeness_points = sum(2.5 for value in completeness_fields if value)
    score = round(
        min(100.0, sample_points + freshness_points + demand_points + completeness_points),
        2,
    )
    return score, {
        "sample_points": round(sample_points, 2),
        "freshness_points": freshness_points,
        "demand_points": demand_points,
        "completeness_points": completeness_points,
        "gsc_clicks": float(demand_metrics.get("clicks") or 0.0),
        "gsc_impressions": float(demand_metrics.get("impressions") or 0.0),
        "minimum_sample": minimum_sample,
        "sample_size": sample_size,
    }


def determine_capacity_mode(metrics: Mapping[str, Any]) -> tuple[str, list[str]]:
    reasons: list[str] = []
    if not metrics.get("cloud_run_metrics_available"):
        return "red", ["Cloud Run指標を取得できません"]
    if not metrics.get("db_network_metrics_available"):
        return "red", ["DB VM送信量を取得できません"]

    projected_vcpu = float(metrics.get("projected_monthly_vcpu_seconds") or 0.0)
    projected_memory = float(metrics.get("projected_monthly_gib_seconds") or 0.0)
    projected_requests = float(metrics.get("projected_monthly_requests") or 0.0)
    projected_egress_bytes = float(
        metrics.get("projected_monthly_internet_egress_bytes") or 0.0
    )
    projected_egress_gib = projected_egress_bytes / (1024 ** 3)
    error_rate = float(metrics.get("error_rate") or 0.0)
    p95_ms = float(metrics.get("p95_latency_ms") or 0.0)
    saturated = bool(metrics.get("max_instance_saturated"))
    cache_hit = metrics.get("cloudflare_cache_hit_ratio")
    db_sent_gib_24h = float(metrics.get("db_sent_gib_24h") or 0.0)
    db_sent_gib_7d = float(metrics.get("db_sent_gib_7d") or 0.0)

    if db_sent_gib_24h >= 2:
        reasons.append(f"DB送信量が24時間で2GiB以上: {db_sent_gib_24h:.2f}GiB")
    if db_sent_gib_7d >= 10:
        reasons.append(f"DB送信量が7日で10GiB以上: {db_sent_gib_7d:.2f}GiB")

    if saturated:
        reasons.append("最大インスタンス数への到達を検出")
    if projected_vcpu >= 120000:
        reasons.append(f"月間換算vCPU秒が上限超過: {projected_vcpu:.0f}")
    if projected_memory >= 240000:
        reasons.append(f"月間換算GiB秒が上限超過: {projected_memory:.0f}")
    if projected_requests >= 1400000:
        reasons.append(f"月間換算リクエスト数が上限超過: {projected_requests:.0f}")
    if projected_egress_gib >= 10:
        reasons.append(f"月間換算インターネット送信量が10GiB以上: {projected_egress_gib:.2f}GiB")
    if error_rate >= 0.01:
        reasons.append(f"5xx率が1%以上: {error_rate:.3%}")
    if p95_ms >= 2500:
        reasons.append(f"p95が2.5秒以上: {p95_ms:.0f}ms")
    if reasons:
        return "red", reasons

    if db_sent_gib_24h >= 0.5:
        return "yellow", [f"DB送信量が24時間で0.5GiB以上: {db_sent_gib_24h:.2f}GiB"]

    cloud_run_green = (
        projected_vcpu < 72000
        and projected_memory < 144000
        and projected_requests < 800000
        and projected_egress_gib < 2
        and error_rate < 0.005
        and p95_ms < 1500
        and db_sent_gib_24h < 0.5
    )
    if cache_hit is None:
        return "yellow", ["Cloudflare指標がないため25件/日に制限"]
    cache_hit_value = float(cache_hit)
    if cloud_run_green and cache_hit_value >= 0.80:
        return "green", []
    if cache_hit_value >= 0.65:
        return "yellow", ["余力を確保するため25件/日に制限"]
    return "red", [f"Cloudflareキャッシュヒット率が65%未満: {cache_hit_value:.1%}"]


def _iter_quality_candidates(db: Any) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for entity_type in ENTITY_TYPES:
        offset = 0
        while True:
            page = growth_crud.list_entities(
                db,
                entity_type,
                limit=1000,
                offset=offset,
                indexable_only=True,
            )
            page_items = list(page["items"])
            candidates.extend(page_items)
            offset += len(page_items)
            if not page_items or offset >= int(page["total"]):
                break
    return candidates


def sync_candidates(
    db: Any,
    *,
    demand_by_path: Mapping[str, Mapping[str, float]],
    evaluated_at: datetime,
) -> list[models.DataPagePublication]:
    candidates = _iter_quality_candidates(db)
    dataset_last_values = [
        item.get("last_race_date")
        for item in candidates
        if item.get("last_race_date") is not None
    ]
    dataset_last = max(dataset_last_values) if dataset_last_values else None
    existing = {
        (row.entity_type, row.entity_id): row
        for row in db.query(models.DataPagePublication).all()
    }
    synced: list[models.DataPagePublication] = []
    for item in candidates:
        key = (str(item["entity_type"]), str(item["id"]))
        url = str(item["url"])
        score, factors = calculate_quality_score(
            item,
            dataset_last=dataset_last,
            demand=demand_by_path.get(url),
        )
        row = existing.get(key)
        if row is None:
            row = models.DataPagePublication(
                entity_type=key[0],
                entity_id=key[1],
                url=url,
                status="candidate",
                first_eligible_at=evaluated_at,
                created_at=evaluated_at,
            )
            db.add(row)
        row.url = url
        row.quality_score = score
        row.score_factors = factors
        row.last_seen_data_at = item.get("last_race_date")
        row.last_evaluated_at = evaluated_at
        row.updated_at = evaluated_at
        # 保留解除の基準（50）と公開の基準（MINIMUM_PUBLICATION_QUALITY_SCORE=65）は別物。
        # ここは「品質低下による保留を解いて候補へ戻す」だけで、公開はしない。
        if row.status == "held" and score >= 50:
            row.status = "candidate"
        synced.append(row)
    db.flush()
    return synced


def _publication_priority(row: models.DataPagePublication) -> tuple[Any, ...]:
    factors = row.score_factors or {}
    demand_priority = (
        1 if float(factors.get("gsc_clicks") or 0.0) >= 1 else 0,
        1 if float(factors.get("gsc_impressions") or 0.0) >= 10 else 0,
    )
    return (
        demand_priority[0],
        demand_priority[1],
        1 if row.entity_type == "course" else 0,
        float(row.quality_score or 0.0),
        row.last_seen_data_at or date.min,
        row.url,
    )


# データ詳細ページは「少数精選」で運用する。
# 2026-08-16の実測では、公開59ページの収益寄与は全体の0.3%（$0.09）にとどまり、
# 一方でDB転送とCPUの大半を消費していた。さらにGSCのnoindex除外6,018件の主因でもある。
# 量を追わず、標本数と鮮度が十分なものだけを少しずつ公開する。
PUBLICATION_DAILY_LIMITS = {"green": 10, "yellow": 3, "red": 0}
# 未公開ページはnoindexのためGSC需要スコア（最大20点）を獲得できず、候補の実質上限は80点。
# 65は「標本数と鮮度が十分」を意味する水準。
MINIMUM_PUBLICATION_QUALITY_SCORE = 65
DEFAULT_INITIAL_SEED_LIMIT = 50


def publish_candidates(
    db: Any,
    *,
    candidates: Sequence[models.DataPagePublication],
    capacity_mode: str,
    evaluated_at: datetime,
    initial_seed_limit: int = DEFAULT_INITIAL_SEED_LIMIT,
) -> tuple[list[models.DataPagePublication], bool]:
    published_count = (
        db.query(models.DataPagePublication)
        .filter(models.DataPagePublication.status == "published")
        .count()
    )
    initial_seed = published_count == 0
    eligible = [
        row for row in candidates
        if row.status == "candidate"
        and float(row.quality_score or 0.0) >= MINIMUM_PUBLICATION_QUALITY_SCORE
    ]
    eligible.sort(key=_publication_priority, reverse=True)

    if initial_seed and capacity_mode != "red":
        preferred = [
            row for row in eligible
            if row.entity_type == "course"
            or float((row.score_factors or {}).get("gsc_clicks") or 0.0) >= 1
            or float((row.score_factors or {}).get("gsc_impressions") or 0.0) >= 10
        ]
        preferred_ids = {row.id for row in preferred if row.id is not None}
        remaining = [row for row in eligible if row.id not in preferred_ids]
        selected = (preferred + remaining)[:max(1, min(initial_seed_limit, DEFAULT_INITIAL_SEED_LIMIT))]
    elif initial_seed:
        # 指標未取得または高負荷時は、初回であっても公開を開始しない。
        selected = []
    else:
        daily_limit = PUBLICATION_DAILY_LIMITS[capacity_mode]
        selected = eligible[:daily_limit]

    for row in selected:
        row.status = "published"
        row.first_published_at = row.first_published_at or evaluated_at
        row.updated_at = evaluated_at
    db.flush()
    return selected, initial_seed


def _load_capacity_metrics(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {"cloud_run_metrics_available": False}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {
            "cloud_run_metrics_available": False,
            "load_error": str(exc),
        }
    return payload if isinstance(payload, dict) else {"cloud_run_metrics_available": False}


def build_report(
    *,
    capacity_mode: str,
    capacity_reasons: Sequence[str],
    metrics: Mapping[str, Any],
    candidates: Sequence[models.DataPagePublication],
    published: Sequence[models.DataPagePublication],
    initial_seed: bool,
    gsc_warning: str | None,
    dry_run: bool,
) -> dict[str, Any]:
    status_counts: dict[str, int] = {}
    for row in candidates:
        status_counts[row.status] = status_counts.get(row.status, 0) + 1
    return {
        "schema_version": "data-page-publication.v1",
        "generated_at": datetime.now(JST).isoformat(),
        "dry_run": dry_run,
        "initial_seed": initial_seed,
        "capacity_mode": capacity_mode,
        "capacity_reasons": list(capacity_reasons),
        "capacity_metrics": dict(metrics),
        "gsc_warning": gsc_warning,
        "candidate_count": len(candidates),
        "status_counts": status_counts,
        "published_now": [
            {
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "url": row.url,
                "quality_score": row.quality_score,
            }
            for row in published
        ],
    }


def render_summary(report: Mapping[str, Any]) -> str:
    reasons = report.get("capacity_reasons") or []
    lines = [
        "# データページ段階公開",
        "",
        f"- 実行モード: {'dry-run' if report.get('dry_run') else 'apply'}",
        f"- 容量判定: {report.get('capacity_mode')}",
        f"- 初回シード: {'はい' if report.get('initial_seed') else 'いいえ'}",
        f"- 候補総数: {report.get('candidate_count')}",
        f"- 今回の公開数: {len(report.get('published_now') or [])}",
    ]
    if reasons:
        lines.append(f"- 判定理由: {' / '.join(str(reason) for reason in reasons)}")
    if report.get("gsc_warning"):
        lines.append("- GSC: 取得失敗のため需要加点なしで継続")
    return "\n".join(lines) + "\n"


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-url", default="sc-domain:uma-free.com")
    parser.add_argument("--capacity-metrics-json", type=Path)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    parser.add_argument("--initial-seed-limit", type=int, default=500)
    parser.add_argument("--skip-gsc", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    Base.metadata.create_all(
        bind=engine,
        tables=[models.DataPagePublication.__table__],
        checkfirst=True,
    )
    demand, gsc_warning = ({}, None) if args.skip_gsc else fetch_gsc_demand(args.site_url)
    metrics = _load_capacity_metrics(args.capacity_metrics_json)
    capacity_mode, capacity_reasons = determine_capacity_mode(metrics)
    evaluated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db = SessionLocal()
    try:
        candidates = sync_candidates(
            db,
            demand_by_path=demand,
            evaluated_at=evaluated_at,
        )
        published, initial_seed = publish_candidates(
            db,
            candidates=candidates,
            capacity_mode=capacity_mode,
            evaluated_at=evaluated_at,
            initial_seed_limit=args.initial_seed_limit,
        )
        report = build_report(
            capacity_mode=capacity_mode,
            capacity_reasons=capacity_reasons,
            metrics=metrics,
            candidates=candidates,
            published=published,
            initial_seed=initial_seed,
            gsc_warning=gsc_warning,
            dry_run=args.dry_run,
        )
        if args.dry_run:
            db.rollback()
        else:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=str) + "\n",
        encoding="utf-8",
    )
    args.summary.write_text(render_summary(report), encoding="utf-8")
    print(render_summary(report), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
