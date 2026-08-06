#!/usr/bin/env python3
"""既存の読取専用GA4・GSC・Clarity成果物をmonetization-report.v1へ統合する。"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping


SCHEMA_VERSION = "monetization-report.v1"


def load_optional_payload(path: Path | None, label: str, warnings: list[str]) -> Any:
    if path is None or not path.exists():
        warnings.append(f"{label}成果物がないため、このソースの軸は未集計です。")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        warnings.append(f"{label}成果物を読めません: {exc}")
        return None


def load_optional_json(path: Path | None, label: str, warnings: list[str]) -> dict[str, Any] | None:
    payload = load_optional_payload(path, label, warnings)
    if not isinstance(payload, dict):
        warnings.append(f"{label}成果物のルートがオブジェクトではありません。")
        return None
    return payload


def _parse_iso_date(value: Any) -> date | None:
    raw = str(value or "").strip()
    try:
        parsed = date.fromisoformat(raw)
    except ValueError:
        return None
    return parsed if parsed.isoformat() == raw else None


def _period_bounds(payload: Mapping[str, Any] | None) -> tuple[str, str] | None:
    if not payload:
        return None
    period = payload.get("period")
    if isinstance(period, Mapping):
        start = str(period.get("start_date") or period.get("start") or "")
        end = str(period.get("end_date") or period.get("end") or "")
        if start and end:
            return start, end
    periods = payload.get("periods")
    if isinstance(periods, Mapping) and isinstance(periods.get("current"), Mapping):
        current = periods["current"]
        start = str(current.get("start_date") or current.get("start") or "")
        end = str(current.get("end_date") or current.get("end") or "")
        if start and end:
            return start, end
    return None


def _adsense_daily_dates(payload: Any) -> set[str]:
    if payload is None:
        return set()
    rows = payload
    if isinstance(payload, Mapping):
        rows = payload.get("rows") or payload.get("daily") or []
    if not isinstance(rows, list):
        return set()
    result: set[str] = set()
    for row in rows:
        if not isinstance(row, Mapping):
            continue
        value = row.get("date") or row.get("day")
        parsed = _parse_iso_date(value)
        if parsed:
            result.add(parsed.isoformat())
    return result


def resolve_formal_week(
    week_ending: str | None,
    *,
    ga4: Mapping[str, Any] | None = None,
    gsc: Mapping[str, Any] | None = None,
    adsense_daily: Any = None,
) -> dict[str, Any]:
    if not week_ending:
        return {
            "requested": False,
            "formal": False,
            "reason": "week_ending未指定のため、従来互換の参考集計です。",
            "start_date": None,
            "end_date": None,
            "expected_dates": [],
            "incomplete_sources": [],
        }
    end = _parse_iso_date(week_ending)
    if not end:
        raise ValueError("week_endingはYYYY-MM-DD形式の実在日で指定してください。")
    if end.weekday() != 6:
        raise ValueError("week_endingは完全週の最終日である日曜日を指定してください。")
    start = end - timedelta(days=6)
    expected_dates = [(start + timedelta(days=offset)).isoformat() for offset in range(7)]
    expected_bounds = (start.isoformat(), end.isoformat())
    incomplete_sources: list[str] = []
    checked_sources: list[str] = []

    for label, payload in (("GA4", ga4), ("GSC", gsc)):
        if payload is not None:
            checked_sources.append(label)
            if _period_bounds(payload) != expected_bounds:
                incomplete_sources.append(label)

    if adsense_daily is not None:
        checked_sources.append("AdSense")
        if _adsense_daily_dates(adsense_daily) != set(expected_dates):
            incomplete_sources.append("AdSense")

    formal = bool(checked_sources) and not incomplete_sources
    return {
        "requested": True,
        "formal": formal,
        "reason": (
            "月曜から日曜の7日と提供済み日次ソースが一致しています。"
            if formal
            else (
                "対象期間または日次行が7完全日と一致しないソースがあります。"
                if incomplete_sources
                else "7完全日を確認できるソースがありません。"
            )
        ),
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "expected_dates": expected_dates,
        "checked_sources": checked_sources,
        "incomplete_sources": incomplete_sources,
    }


def build_report(
    *,
    ga4: Mapping[str, Any] | None,
    gsc: Mapping[str, Any] | None,
    clarity_dir: Path | None,
    week_ending: str | None = None,
    adsense_daily: Any = None,
    youtube: Any = None,
    social_workflows: Any = None,
    week_over_week: Any = None,
    root_causes: Any = None,
    applied_local_actions: Any = None,
    initial_warnings: list[str] | None = None,
) -> dict[str, Any]:
    warnings = list(initial_warnings or [])
    clarity_available = bool(clarity_dir and clarity_dir.exists() and (clarity_dir / "summary.md").exists())
    if not clarity_available:
        warnings.append("Clarity成果物がないため、録画・ヒートマップの定性確認は未統合です。")

    ga_period = dict((ga4 or {}).get("period") or {})
    gsc_periods = dict((gsc or {}).get("periods") or {})
    events = dict((ga4 or {}).get("events") or {})
    revenue = dict((ga4 or {}).get("publisher_revenue") or {})
    breakdowns = dict((ga4 or {}).get("monetization_breakdowns") or {})
    affiliate_breakdowns = dict((ga4 or {}).get("affiliate_breakdowns") or {})
    affiliate_contract = dict((ga4 or {}).get("affiliate_measurement_contract") or {})
    quality_gate = dict((ga4 or {}).get("measurement_quality_gate") or {})
    release_policy = str(os.getenv("MONETIZATION_RELEASE_POLICY") or "experiment").strip()
    fixed_rollout_id = str(os.getenv("MONETIZATION_FIXED_ROLLOUT_ID") or "").strip()
    if not revenue.get("available"):
        warnings.append("totalAdRevenueは未取得です。GA4–AdSenseリンク後のデータだけで評価してください。")
    if release_policy != "fixed" and not quality_gate.get("ready_for_new_experiment", False):
        warnings.append("計測品質ゲート未達のため、新しい収益実験を開始しません。")
    formal_week = resolve_formal_week(
        week_ending,
        ga4=ga4,
        gsc=gsc,
        adsense_daily=adsense_daily,
    )
    if formal_week["requested"] and not formal_week["formal"]:
        incomplete_label = ", ".join(formal_week["incomplete_sources"]) or "期間確認ソースなし"
        warnings.append(f"正式週の条件を満たさないため参考集計として出力します: {incomplete_label}")
    experiment_events = {
        name: events.get(name, {"event_count": 0, "users": 0})
        for name in (
            "ad_experiment_exposure",
            "article_bridge_experiment_exposure",
            "article_ad_placement_exposure",
        )
    }

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": {
            "ga4": ga_period or None,
            "gsc": gsc_periods or None,
            "clarity": "latest_72_hours" if clarity_available else None,
        },
        "formal_week": formal_week,
        "sample_quality": {
            "ga4_page_users_are_non_additive": True,
            "gsc_dimension_totals_may_differ": True,
            "clarity_events_are_event_sessions_not_event_counts": True,
            "measurement_quality_gate": quality_gate,
        },
        "page_groups": breakdowns.get("page_type", {"available": False}),
        "traffic_sources": breakdowns.get("session_channel", {"available": False}),
        "devices": breakdowns.get("device", {"available": False}),
        "new_returning": breakdowns.get("new_returning", {"available": False}),
        "ad_placements": breakdowns.get("ad_placement", {"available": False}),
        "revenue": revenue,
        "funnel": {
            name: events.get(name, {"event_count": 0, "users": 0})
            for name in (
                "race_view",
                "prediction_table_view",
                "race_navigation",
                "article_read_complete",
                "article_race_click",
                "recent_race_return_click",
                "pwa_install_prompt_view",
                "pwa_install_result",
            )
        },
        "experiments": {
            **experiment_events,
            "release_policy": release_policy,
            "fixed_rollout_id": fixed_rollout_id or None,
            "fixed_rollout_approved_at": os.getenv("MONETIZATION_FIXED_ROLLOUT_APPROVED_AT") or None,
            "exposures": experiment_events,
        },
        "affiliate": {
            "events": {
                name: events.get(name, {"event_count": 0, "users": 0})
                for name in ("affiliate_impression", "affiliate_click")
            },
            "breakdowns": affiliate_breakdowns,
            "measurement_contract": affiliate_contract,
        },
        "search": {
            "summary": dict((gsc or {}).get("summary") or {}),
            "opportunities": list((gsc or {}).get("query_device_opportunities") or [])[:20],
            "quality": dict((gsc or {}).get("quality") or {}),
        },
        "clarity": {"available": clarity_available, "artifact_directory": str(clarity_dir or "")},
        "adsense_daily": adsense_daily if adsense_daily is not None else {"available": False},
        "youtube": youtube if youtube is not None else {"available": False},
        "social_workflows": social_workflows if social_workflows is not None else {"available": False},
        "week_over_week": week_over_week if week_over_week is not None else {"available": False},
        "root_causes": root_causes if root_causes is not None else [],
        "applied_local_actions": applied_local_actions if applied_local_actions is not None else [],
        "warnings": list(dict.fromkeys(warnings)),
        "automatic_action": "none",
    }


def render_summary(report: Mapping[str, Any]) -> str:
    revenue = report.get("revenue") or {}
    search = report.get("search") or {}
    quality_gate = (
        (report.get("sample_quality") or {}).get("measurement_quality_gate") or {}
    )
    lines = [
        "# UMA-FREE 週次収益統合レポート",
        "",
        f"- 契約: `{report['schema_version']}`",
        f"- 自動変更: `{report['automatic_action']}`",
        f"- GSC機会候補: {len(search.get('opportunities') or [])}件",
        (
            "- 新規収益実験ゲート: "
            f"{'合格' if quality_gate.get('ready_for_new_experiment') else '保留'} "
            f"({quality_gate.get('consecutive_pass_days', 0)}/"
            f"{quality_gate.get('required_complete_days', 7)}完全日)"
        ),
        f"- ゲート経路: `{quality_gate.get('gate_mode', 'unknown')}`",
    ]
    formal_week = report.get("formal_week") or {}
    if formal_week.get("requested"):
        lines.insert(
            4,
            f"- 対象週: {formal_week.get('start_date')}〜{formal_week.get('end_date')} "
            f"（{'正式週' if formal_week.get('formal') else '参考集計'}）",
        )
    experiments = report.get("experiments") or {}
    if experiments.get("release_policy") == "fixed":
        lines.insert(5, f"- 収益運用: 固定ベースライン `{experiments.get('fixed_rollout_id') or '未設定'}`")
    accelerated_gate = quality_gate.get("accelerated_gate") or {}
    if accelerated_gate:
        lines.append(
            "- 高速ゲート対象セッション: "
            f"{accelerated_gate.get('observed_sessions', 0)}/"
            f"{accelerated_gate.get('minimum_sessions', 500)}"
        )
    if quality_gate.get("target_release_id"):
        lines.append(f"- 対象計測リリース: `{quality_gate['target_release_id']}`")
    if quality_gate.get("latest_complete_date"):
        lines.append(f"- 最終確認日: {quality_gate['latest_complete_date']}")
    if revenue.get("available"):
        lines.append(
            f"- パブリッシャー広告収益/1,000セッション: {revenue.get('revenue_per_1000_sessions', '—')}"
        )
    else:
        lines.append("- パブリッシャー広告収益: 未取得")
    lines.extend(["", "## 警告", ""])
    for warning in report.get("warnings") or []:
        lines.append(f"- {warning}")
    lines.extend([
        "",
        "このレポートは読み取り専用です。広告、記事公開、実験状態を自動変更しません。",
        "",
    ])
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ga4-report", type=Path)
    parser.add_argument("--gsc-report", type=Path)
    parser.add_argument("--clarity-dir", type=Path)
    parser.add_argument("--week-ending", help="正式週の最終日（日曜日、YYYY-MM-DD）")
    parser.add_argument("--adsense-daily", type=Path)
    parser.add_argument("--youtube-report", type=Path)
    parser.add_argument("--social-workflows", type=Path)
    parser.add_argument("--week-over-week", type=Path)
    parser.add_argument("--root-causes", type=Path)
    parser.add_argument("--applied-local-actions", type=Path)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    warnings: list[str] = []
    ga4 = load_optional_json(args.ga4_report, "GA4", warnings)
    gsc = load_optional_json(args.gsc_report, "GSC", warnings)
    adsense_daily = load_optional_payload(args.adsense_daily, "AdSense日次", warnings)
    youtube = load_optional_payload(args.youtube_report, "YouTube", warnings)
    social_workflows = load_optional_payload(args.social_workflows, "SNS Workflow", warnings)
    week_over_week = load_optional_payload(args.week_over_week, "週次比較", warnings)
    root_causes = load_optional_payload(args.root_causes, "原因分析", warnings)
    applied_local_actions = load_optional_payload(args.applied_local_actions, "適用済みローカル修正", warnings)
    report = build_report(
        ga4=ga4,
        gsc=gsc,
        clarity_dir=args.clarity_dir,
        week_ending=args.week_ending,
        adsense_daily=adsense_daily,
        youtube=youtube,
        social_workflows=social_workflows,
        week_over_week=week_over_week,
        root_causes=root_causes,
        applied_local_actions=applied_local_actions,
        initial_warnings=warnings,
    )
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.summary.write_text(render_summary(report), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
