"""収益監視の結果だけを公開できる日本語通知に変換する。"""
from __future__ import annotations

import argparse
import json
import math
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

try:
    from . import monetization_history as history
except ImportError:
    import monetization_history as history


DAILY_MESSAGES = {
    "adsense_fetch_failed": "広告の集計を取得できませんでした。Googleとの接続や権限の確認が必要です。",
    "ga4_fetch_failed": "アクセスの集計を取得できませんでした。Googleとの接続や権限の確認が必要です。",
    "adsense_data_missing": "広告の記録に不足があります。未取得を収益ゼロとは扱わず、次回も確認します。",
    "ga4_data_missing": "アクセスの記録に不足があります。訪問がなくなったとは断定できません。",
    "ad_delivery_drop": "訪問が続いている一方で、広告表示が大きく減っています。AdSenseの配信状態を確認してください。",
    "traffic_drop": "訪問が同じ曜日の前回より大きく減っています。サイトの表示と集客の自動処理を確認してください。",
    "attribution_missing": "どこから来たか分からない訪問が多い状態です。流入計測の修正後も続いているか確認してください。",
    "monitor_failed": "監視処理を完了できませんでした。サイトの障害とは限りません。実行履歴の確認が必要です。",
}


def finite_number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) and value >= 0 else None


def daily_rows(result: dict, source: str) -> dict[str, dict]:
    grouped: dict[str, list[dict]] = {}
    for row in result.get("rows", []):
        if row.get("source") == source and row.get("dataset") == "daily":
            grouped.setdefault(str(row.get("date")), []).append(row.get("metrics") or {})
    # 二重取得の行を足して通常値に見せない。
    return {day: rows[0] for day, rows in grouped.items() if len(rows) == 1}


def complete(result: dict, dataset: str) -> bool:
    return result.get("reports", {}).get(dataset, {}).get("status") == "complete"


def notice(kind: str, end: date, reasons: list[str], body: str) -> dict:
    return {
        "schema_version": "revenue-notification.v1", "kind": kind,
        "period_end": end.isoformat(), "needs_attention": bool(reasons),
        "reason_codes": sorted(set(reasons)),
        "title": "UMA-FREE：対応が必要です" if reasons else "UMA-FREE：自動確認の結果",
        "body": body, "public_safe": True,
    }


def build_daily_notice(results: dict[str, dict], today: date) -> dict:
    # 媒体の反映待ちを考慮し、当日と前日は異常判定に使わない。
    end = today - timedelta(days=2)
    current = [end - timedelta(days=1), end]
    previous = [day - timedelta(days=7) for day in current]
    reasons: list[str] = []
    ads, ga = results.get("adsense", {}), results.get("ga4", {})
    ads_rows, ga_rows = daily_rows(ads, "adsense"), daily_rows(ga, "ga4")
    ads_ok, ga_ok = complete(ads, "daily"), complete(ga, "daily")
    if not ads_ok:
        reasons.append("adsense_fetch_failed")
    if not ga_ok or not complete(ga, "acquisition"):
        reasons.append("ga4_fetch_failed")

    days = current + previous
    values = lambda rows, key: [finite_number(rows.get(day.isoformat(), {}).get(key)) for day in days]
    ad_values, sessions = values(ads_rows, "impressions"), values(ga_rows, "sessions")
    if ads_ok and any(value is None for value in ad_values):
        reasons.append("adsense_data_missing")
    if ga_ok and any(value is None for value in sessions):
        reasons.append("ga4_data_missing")
    if ga_ok and all(value is not None for value in sessions):
        if all(sessions[i + 2] >= 50 and sessions[i] <= sessions[i + 2] * 0.2 for i in (0, 1)):
            reasons.append("traffic_drop")
        if ads_ok and all(value is not None for value in ad_values):
            if all(ad_values[i + 2] >= 50 and sessions[i] >= 20
                   and sessions[i] >= sessions[i + 2] * 0.5
                   and ad_values[i] <= ad_values[i + 2] * 0.2 for i in (0, 1)):
                reasons.append("ad_delivery_drop")

    if complete(ga, "acquisition"):
        unassigned_days = []
        for day in current:
            rows = [row for row in ga.get("rows", []) if row.get("source") == "ga4"
                    and row.get("dataset") == "acquisition" and row.get("date") == day.isoformat()]
            metrics = [finite_number((row.get("metrics") or {}).get("sessions")) for row in rows]
            valid = bool(rows) and all(value is not None for value in metrics) and all(
                (row.get("dimensions") or {}).get("sessionSourceMedium") is not None for row in rows)
            if not valid:
                reasons.append("ga4_data_missing")
                continue
            denominator = sum(metrics)
            missing = sum(value for row, value in zip(rows, metrics)
                          if row["dimensions"]["sessionSourceMedium"] == "(not set)")
            unassigned_days.append(denominator >= 30 and missing / denominator > 0.2)
        if len(unassigned_days) == 2 and all(unassigned_days):
            reasons.append("attribution_missing")

    lines = ["## 自動確認の結果", "", f"確認した期間：{current[0]}〜{end}。集計の反映待ちを考慮しています。", ""]
    if reasons:
        lines += ["あなたの対応：確認が必要です。", ""]
        lines += [f"- {DAILY_MESSAGES[reason]}" for reason in sorted(set(reasons))]
    else:
        lines += ["あなたの対応：今回の監視では、大きな異常を検出していません。確認は不要です。",
                  "広告・アクセスの集計は引き続き自動で確認します。"]
    lines += ["", "この通知には金額やアクセス数を掲載していません。広告設定を自動で変更する処理ではありません。"]
    return notice("daily", end, reasons, "\n".join(lines))


def failed_notice(kind: str, end: date) -> dict:
    return notice(kind, end, ["monitor_failed"],
                  "## 自動確認を完了できませんでした\n\nあなたの対応：実行履歴を確認してください。\n\n"
                  + DAILY_MESSAGES["monitor_failed"] + "\n\n金額・アクセス数・認証情報はこの通知に掲載していません。")


def collect_daily(today: date) -> dict:
    period = history.Period(today - timedelta(days=15), today - timedelta(days=2))
    results = {}
    # 詳しい原本は一時領域でのみ扱い、公開artifactやIssueへ渡さない。
    with tempfile.TemporaryDirectory(prefix="uma-revenue-monitor-") as directory:
        for source, collector, options in (
            ("adsense", history.collect_adsense, {"report_definitions": (("daily", ("DATE",)),), "include_payments": False}),
            ("ga4", history.collect_ga4, {"report_definitions": (
                {"name": "daily", "dimensions": ["date"], "metrics": ["sessions"]},
                {"name": "acquisition", "dimensions": ["date", "sessionSourceMedium"], "metrics": ["sessions"]},
            )}),
        ):
            try:
                results[source] = collector(period, Path(directory), **options)
            except Exception:
                # 公開ログへAPI応答や認証エラー本文を流さない。
                results[source] = {"reports": {}, "rows": []}
    return build_daily_notice(results, today)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", choices=("daily", "weekly"), required=True)
    parser.add_argument("--analysis", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--today", type=date.fromisoformat)
    parser.add_argument("--workflow-status", choices=("success", "incomplete"), default="success")
    args = parser.parse_args()
    today = args.today or datetime.now(history.JST).date()
    try:
        if args.kind == "daily":
            payload = collect_daily(today)
        else:
            try:
                from .revenue_digest import build_weekly_digest
            except ImportError:
                from revenue_digest import build_weekly_digest
            analysis = json.loads(args.analysis.read_text(encoding="utf-8"))
            digest = build_weekly_digest(analysis)
            payload = notice("weekly", date.fromisoformat(digest["period_end"]),
                             digest["reason_codes"], digest["public_body"])
            payload["title"] = digest["public_title"]
            payload["needs_attention"] = digest["needs_attention"]
    except Exception:
        payload = failed_notice(args.kind, today - timedelta(days=2) if args.kind == "daily"
                                else history.latest_complete_sunday(today))
    if args.workflow_status == "incomplete":
        payload["reason_codes"] = sorted(set(payload["reason_codes"] + ["workflow_incomplete"]))
        payload["needs_attention"] = True
        payload["body"] = payload["body"].replace("あなたの対応: 確認不要", "あなたの対応: 確認が必要")
        payload["body"] += "\n\n自動処理の一部が完了していません。あなたの対応：実行結果の確認が必要です。"
    args.output_dir.mkdir(parents=True, exist_ok=True)
    history.write_json(args.output_dir / "notification.json", payload)
    (args.output_dir / "summary.md").write_text(payload["body"] + "\n", encoding="utf-8")
    print("公開用の簡易通知を作成しました。詳細な数値は出力していません。")
    failures = {"monitor_failed", "adsense_fetch_failed", "ga4_fetch_failed"}
    return 1 if failures.intersection(payload["reason_codes"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
