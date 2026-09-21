#!/usr/bin/env python3
"""広告設定を変更せず、AdSenseとGA4の集計を別々に日次保管する。"""
from __future__ import annotations
import argparse
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

try:
    from . import monetization_history as history
except ImportError:
    import monetization_history as history

BASELINE = history.Period(date(2026, 8, 17), date(2026, 9, 13))
ADSENSE_REPORTS = (
    ("daily", ("DATE",)),
    ("platform", ("DATE", "PLATFORM_TYPE_CODE")),
    ("format", ("DATE", "AD_FORMAT_CODE", "AD_PLACEMENT_CODE")),
    ("ad_unit", ("DATE", "AD_UNIT_ID")),
    ("traffic_source", ("DATE", "TRAFFIC_SOURCE_CODE")),
    # 全画面広告の偏りを日次で追えるよう、個人を識別しない集計軸を保存する。
    ("format_browser", ("DATE", "AD_FORMAT_CODE", "BROWSER_TYPE_CODE")),
    ("format_os", ("DATE", "AD_FORMAT_CODE", "OS_TYPE_CODE")),
    ("format_country", ("DATE", "AD_FORMAT_CODE", "COUNTRY_CODE")),
    ("format_traffic_source", ("DATE", "AD_FORMAT_CODE", "TRAFFIC_SOURCE_CODE")),
    # 異常クリックを認定バイヤーとクリエイティブ種別まで分解する。
    ("buyer_creative_format", ("DATE", "BUYER_NETWORK_NAME", "SERVED_AD_TYPE_CODE", "AD_FORMAT_CODE")),
    ("content_platform", ("DATE", "CONTENT_PLATFORM_CODE")),
)
PUBLISHER_AD_METRICS = ["publisherAdClicks", "publisherAdImpressions", "totalAdRevenue"]
GA4_REPORTS = (
    {"name": "daily", "dimensions": ["date"], "metrics": ["sessions", "screenPageViews", "totalUsers"]},
    {"name": "acquisition", "dimensions": ["date", "sessionSourceMedium", "deviceCategory"],
     "metrics": ["sessions", "screenPageViews", "totalUsers"]},
    {"name": "events_hourly", "dimensions": ["date", "hour", "eventName", "deviceCategory", "sessionSourceMedium"],
     "metrics": ["eventCount", "totalUsers"]},
    {"name": "publisher_format_browser", "dimensions": ["date", "adFormat", "browser"],
     "metrics": PUBLISHER_AD_METRICS},
    {"name": "publisher_format_os", "dimensions": ["date", "adFormat", "operatingSystem"],
     "metrics": PUBLISHER_AD_METRICS},
    {"name": "publisher_format_source", "dimensions": ["date", "adFormat", "sessionSourceMedium"],
     "metrics": PUBLISHER_AD_METRICS},
    {"name": "publisher_page", "dimensions": ["date", "pagePath", "adFormat"],
     "metrics": PUBLISHER_AD_METRICS},
    {"name": "publisher_ad_unit", "dimensions": ["date", "adUnitName", "adFormat"],
     "metrics": PUBLISHER_AD_METRICS},
)

def recent_period(today: date) -> history.Period:
    return history.Period(today - timedelta(days=7), today - timedelta(days=1))

def row_key(row: dict[str, Any]) -> str:
    return json.dumps([row.get("source"), row.get("dataset"), row.get("date"), row.get("dimensions", {})], sort_keys=True, ensure_ascii=False)

def merge_rows(previous: list[dict[str, Any]], result: dict[str, Any], source: str,
               period: history.Period) -> list[dict[str, Any]]:
    # 完全取得できた区間だけ置き換える。失敗・欠損をゼロに変換しない。
    complete = {name for name, report in result.get("reports", {}).items() if report.get("status") == "complete"}
    retained = [row for row in previous if not (row.get("source") == source
        and row.get("dataset") in complete and period.start.isoformat() <= str(row.get("date") or "") <= period.end.isoformat())]
    combined = {row_key(row): row for row in retained}
    for row in result.get("rows", []):
        combined[row_key(row)] = row
    return sorted(combined.values(), key=row_key)

def collect(source: str, period: history.Period, raw_dir: Path,
            collectors: dict[str, Callable[..., dict[str, Any]]] | None = None) -> dict[str, Any]:
    collectors = collectors or {"adsense": history.collect_adsense, "ga4": history.collect_ga4}
    try:
        options = {"report_definitions": ADSENSE_REPORTS, "include_payments": False} if source == "adsense" else {"report_definitions": GA4_REPORTS}
        result = collectors[source](period, raw_dir, **options)
        reports = result.get("reports", {})
        result["status"] = "complete" if reports and all(r.get("status") == "complete" for r in reports.values()) else "partial"
        return result
    except Exception as exc:
        return {"status": "failed", "rows": [], "reports": {}, "error": history.safe_error(exc)}

def collect_snapshot(today: date, output: Path, previous: dict[str, Any] | None = None,
                     collectors: dict[str, Callable[..., dict[str, Any]]] | None = None) -> dict[str, Any]:
    previous = previous or {}
    period = recent_period(today)
    rows = list(previous.get("rows", []))
    baseline = dict(previous.get("baseline", {}))
    sources = {}
    for source in ("adsense", "ga4"):
        if baseline.get(source, {}).get("status") != "complete":
            result = collect(source, BASELINE, output / "raw" / "baseline", collectors)
            result["rows"] = merge_rows(baseline.get(source, {}).get("rows", []), result, source, BASELINE)
            baseline[source] = result
        result = collect(source, period, output / "raw" / "recent", collectors)
        rows = merge_rows(rows, result, source, period)
        sources[source] = {key: value for key, value in result.items() if key != "rows"}
    cutoff = (today - timedelta(days=90)).isoformat()
    rows = [row for row in rows if str(row.get("date") or "") >= cutoff]
    return {"schemaVersion": 1, "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "recentPeriod": {"start": period.start.isoformat(), "end": period.end.isoformat()},
        "baselinePeriod": {"start": BASELINE.start.isoformat(), "end": BASELINE.end.isoformat()},
        "metricPolicy": "AdSenseとGA4は別計測。推定値・遅延・欠損を保持し、不正認定や配信制御に使用しない。",
        "sources": sources, "baseline": baseline, "rows": rows}

def number(value: Any) -> str:
    return "未取得" if value is None else f"{value:,.2f}" if isinstance(value, float) else str(value)

def ctr(metrics: dict[str, Any]) -> float | None:
    clicks, impressions = metrics.get("clicks"), metrics.get("impressions")
    return clicks / impressions * 100 if clicks is not None and impressions is not None and impressions > 0 else None

def period_stats(rows: list[dict[str, Any]], period: history.Period, complete: bool) -> dict[str, Any] | None:
    if not complete:
        return None
    selected = [row for row in rows if row.get("source") == "adsense" and row.get("dataset") == "daily"
                and period.start.isoformat() <= str(row.get("date") or "") <= period.end.isoformat()]
    totals = {metric: sum((row.get("metrics", {}).get(metric) or 0) for row in selected)
              for metric in ("clicks", "impressions", "estimated_earnings")}
    return {**totals, "days": period.days, "earningsPerDay": totals["estimated_earnings"] / period.days,
            "ctr": ctr(totals)}


def render_summary(snapshot: dict[str, Any]) -> str:
    period = snapshot["recentPeriod"]
    lines = ["# UMA-FREE 広告の日次記録", "", f"再取得期間: {period['start']}〜{period['end']}", "",
        "AdSenseはアカウントのタイムゾーン、GA4はプロパティのタイムゾーンです。直近日の値は確定値ではありません。",
        "停止前28日（2026-08-17〜2026-09-13）の原本と集計はsnapshot.jsonのbaselineに保存します。", "",
        "| 媒体 | 今回の取得状態 |", "|---|---|"]
    for source in ("adsense", "ga4"):
        lines.append(f"| {source} | {snapshot['sources'][source]['status']} |")
    lines += ["", "失敗時は過去の取得値を残します。未取得をゼロ件とは扱いません。広告設定の変更・遮断・不正判定は行いません。", "",
        "## AdSense（GA4の広告イベントと合算しない）", "",
        "| 日付 | 表示 | クリック | CTR % | 推定収益 JPY |", "|---|---:|---:|---:|---:|"]
    for row in sorted(snapshot["rows"], key=lambda r: str(r.get("date"))):
        if row.get("source") != "adsense" or row.get("dataset") != "daily" or not period["start"] <= str(row.get("date") or "") <= period["end"]:
            continue
        m = row.get("metrics", {})
        lines.append(f"| {row['date']} | {number(m.get('impressions'))} | {number(m.get('clicks'))} | {number(ctr(m))} | {number(m.get('estimated_earnings'))} |")
    baseline = snapshot["baseline"].get("adsense", {})
    base = period_stats(baseline.get("rows", []), BASELINE, baseline.get("reports", {}).get("daily", {}).get("status") == "complete")
    recent = history.Period(date.fromisoformat(period["start"]), date.fromisoformat(period["end"]))
    now = period_stats(snapshot["rows"], recent, snapshot["sources"]["adsense"].get("reports", {}).get("daily", {}).get("status") == "complete")
    comparisons = [("停止前28日", base), ("今回の再取得期間", now)]
    resumed = snapshot.get("resumedOn")
    if resumed and date.fromisoformat(resumed) <= recent.end:
        after = history.Period(max(date.fromisoformat(resumed), recent.start), recent.end)
        comparisons.append(("再開後（今回再取得の範囲）", period_stats(snapshot["rows"], after, now is not None)))
    lines += ["", "## 停止前との比較", "", "| 期間 | 日数 | 推定収益/日 JPY | 加重CTR % |", "|---|---:|---:|---:|"]
    for label, stats in comparisons:
        lines.append(f"| {label} | {stats['days'] if stats else '未取得'} | {number(stats['earningsPerDay']) if stats else '未取得'} | {number(stats['ctr']) if stats else '未取得'} |")
    if not resumed:
        lines += ["", "再開日は未登録です。実際の再開を確認後にUMA_ADS_RESUMED_ONをYYYY-MM-DDで設定すると、再開後との比較を表示します。停止終了予定日からの自動推定はしません。"]
    lines += ["", "CTRは合計クリック÷合計表示で計算します。広告が表示されていない日のCTRは算出できません。", "GA4の流入・広告イベントはsnapshot.jsonおよびraw/ga4系原本に別々に保存します。広告形式×ブラウザ・OS・流入元・ページ・広告ユニットも日次保存します。", ""]
    return "\n".join(lines)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--today", type=date.fromisoformat)
    args = parser.parse_args()
    today = args.today or datetime.now(history.JST).date()
    previous = None
    if args.previous and args.previous.is_file():
        previous = json.loads(args.previous.read_text(encoding="utf-8"))
        if previous.get("schemaVersion") != 1:
            raise ValueError("前回データの形式が不明です。上書きせず終了します。")
    snapshot = collect_snapshot(today, args.output_dir, previous)
    resumed_on = os.environ.get("UMA_ADS_RESUMED_ON") or (previous or {}).get("resumedOn")
    if resumed_on:
        snapshot["resumedOn"] = date.fromisoformat(resumed_on).isoformat()
    history.write_json(args.output_dir / "snapshot.json", snapshot)
    history.write_json(args.output_dir / "source-status.json", {"sources": snapshot["sources"],
        "baseline": {source: {"status": data["status"]} for source, data in snapshot["baseline"].items()}})
    (args.output_dir / "summary.md").write_text(render_summary(snapshot), encoding="utf-8")
    complete = all(data["status"] == "complete" for data in snapshot["sources"].values())
    complete = complete and all(data["status"] == "complete" for data in snapshot["baseline"].values())
    print(f"日次保存: {'complete' if complete else 'partial'}。原本・状態・集計を保存しました。")
    return 0 if complete else 1

if __name__ == "__main__":
    raise SystemExit(main())
