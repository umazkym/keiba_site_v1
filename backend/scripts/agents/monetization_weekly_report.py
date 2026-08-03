#!/usr/bin/env python3
"""既存の読取専用GA4・GSC・Clarity成果物をmonetization-report.v1へ統合する。"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


SCHEMA_VERSION = "monetization-report.v1"


def load_optional_json(path: Path | None, label: str, warnings: list[str]) -> dict[str, Any] | None:
    if path is None or not path.exists():
        warnings.append(f"{label}成果物がないため、このソースの軸は未集計です。")
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        warnings.append(f"{label}成果物を読めません: {exc}")
        return None
    if not isinstance(payload, dict):
        warnings.append(f"{label}成果物のルートがオブジェクトではありません。")
        return None
    return payload


def build_report(
    *,
    ga4: Mapping[str, Any] | None,
    gsc: Mapping[str, Any] | None,
    clarity_dir: Path | None,
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
    if not revenue.get("available"):
        warnings.append("publisherAdRevenueは未取得です。GA4–AdSenseリンク後のデータだけで評価してください。")
    if not quality_gate.get("ready_for_new_experiment", False):
        warnings.append("計測品質ゲート未達のため、新しい収益実験を開始しません。")

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": {
            "ga4": ga_period or None,
            "gsc": gsc_periods or None,
            "clarity": "latest_72_hours" if clarity_available else None,
        },
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
            name: events.get(name, {"event_count": 0, "users": 0})
            for name in (
                "ad_experiment_exposure",
                "article_bridge_experiment_exposure",
                "article_ad_placement_exposure",
            )
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
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    warnings: list[str] = []
    ga4 = load_optional_json(args.ga4_report, "GA4", warnings)
    gsc = load_optional_json(args.gsc_report, "GSC", warnings)
    report = build_report(
        ga4=ga4,
        gsc=gsc,
        clarity_dir=args.clarity_dir,
        initial_warnings=warnings,
    )
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.summary.write_text(render_summary(report), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
