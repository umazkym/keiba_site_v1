#!/usr/bin/env python3
"""GA4から無料データ機能の週次・28日ファネルを読み取り専用で集計する。"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    from googleapiclient.errors import HttpError
except ModuleNotFoundError:
    class HttpError(Exception):
        """Google API依存関係がないローカル単体テスト用の代替例外。"""


EVENT_NAMES = (
    "race_view",
    "prediction_table_view",
    "race_navigation",
    "article_read_complete",
    "article_race_click",
    "recent_race_return_click",
    "pwa_install_prompt_view",
    "pwa_install_result",
    "ad_experiment_exposure",
    "article_bridge_experiment_exposure",
    "article_ad_placement_exposure",
    "ad_impression_custom",
    "ad_viewable_custom",
    "affiliate_impression",
    "affiliate_click",
    "data_hub_action_click",
    "data_search_result_click",
    "compare_result_view",
    "compare_condition_change",
    "compare_race_click",
    "upcoming_race_click",
    "saved_user_return",
    "pricing_survey_view",
    "pricing_survey_response",
)
DATA_PATH_PREFIXES = (
    "/keiba-data",
    "/compare",
    "/my-data",
    "/horses",
    "/jockeys",
    "/trainers",
    "/courses",
)
DEFAULT_MEASUREMENT_RELEASE_ID = "2026-08-01-ga-route-v2"
NOT_SET_VALUES = {"", "(not set)", "not set", "unknown"}


def _metric_value(response: dict[str, Any], index: int = 0) -> float:
    rows = response.get("rows") or []
    if not rows:
        return 0.0
    raw = rows[0].get("metricValues", [])[index].get("value", "0")
    return float(raw or 0)


def _event_filter(event_name: str) -> dict[str, Any]:
    return {
        "filter": {
            "fieldName": "eventName",
            "stringFilter": {"matchType": "EXACT", "value": event_name},
        }
    }


def _custom_filter(field_name: str, value: str) -> dict[str, Any]:
    return {
        "filter": {
            "fieldName": field_name,
            "stringFilter": {"matchType": "EXACT", "value": value},
        }
    }


def _run_report(
    service: Any,
    property_id: str,
    *,
    start_date: str,
    end_date: str,
    metrics: list[str],
    dimensions: list[str] | None = None,
    dimension_filter: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "dateRanges": [{"startDate": start_date, "endDate": end_date}],
        "metrics": [{"name": metric} for metric in metrics],
        "limit": "10000",
    }
    if dimensions:
        body["dimensions"] = [{"name": dimension} for dimension in dimensions]
    if dimension_filter:
        body["dimensionFilter"] = dimension_filter
    return (
        service.properties()
        .runReport(property=f"properties/{property_id}", body=body)
        .execute()
    )


def _safe_custom_count(
    service: Any,
    property_id: str,
    *,
    start_date: str,
    end_date: str,
    event_name: str,
    custom_field: str,
    custom_value: str,
) -> dict[str, Any]:
    try:
        response = _run_report(
            service,
            property_id,
            start_date=start_date,
            end_date=end_date,
            metrics=["eventCount", "totalUsers"],
            dimension_filter={
                "andGroup": {
                    "expressions": [
                        _event_filter(event_name),
                        _custom_filter(custom_field, custom_value),
                    ]
                }
            },
        )
        return {
            "available": True,
            "event_count": int(_metric_value(response, 0)),
            "users": int(_metric_value(response, 1)),
        }
    except HttpError as error:
        return {
            "available": False,
            "event_count": None,
            "users": None,
            "reason": f"{custom_field}をGA4カスタム定義として利用できません: HTTP {error.resp.status}",
        }


def _safe_event_breakdown(
    service: Any,
    property_id: str,
    *,
    start_date: str,
    end_date: str,
    event_name: str,
    dimension: str,
) -> dict[str, Any]:
    try:
        response = _run_report(
            service,
            property_id,
            start_date=start_date,
            end_date=end_date,
            metrics=["eventCount", "totalUsers"],
            dimensions=[dimension],
            dimension_filter=_event_filter(event_name),
        )
        rows = []
        for row in response.get("rows") or []:
            dimensions = row.get("dimensionValues") or []
            metrics = row.get("metricValues") or []
            rows.append({
                "value": dimensions[0].get("value", "(not set)") if dimensions else "(not set)",
                "event_count": int(float(metrics[0].get("value", "0"))) if metrics else 0,
                "users": int(float(metrics[1].get("value", "0"))) if len(metrics) > 1 else 0,
            })
        return {
            "available": True,
            "event_name": event_name,
            "dimension": dimension,
            "rows": rows,
        }
    except HttpError as error:
        return {
            "available": False,
            "event_name": event_name,
            "dimension": dimension,
            "reason": f"{dimension}を{event_name}で利用できません: HTTP {error.resp.status}",
            "rows": [],
        }


def _safe_breakdown(
    service: Any,
    property_id: str,
    *,
    start_date: str,
    end_date: str,
    dimension: str,
) -> dict[str, Any]:
    """未登録のカスタム定義があっても週次レポート全体を止めずに記録する。"""

    try:
        response = _run_report(
            service,
            property_id,
            start_date=start_date,
            end_date=end_date,
            metrics=["sessions", "screenPageViews", "publisherAdRevenue", "activeUsers"],
            dimensions=[dimension],
        )
        rows = []
        for row in response.get("rows") or []:
            metric_values = row.get("metricValues") or []
            rows.append({
                "value": row.get("dimensionValues", [{}])[0].get("value", "(not set)"),
                "sessions": int(float(metric_values[0].get("value", "0"))) if len(metric_values) > 0 else 0,
                "page_views": int(float(metric_values[1].get("value", "0"))) if len(metric_values) > 1 else 0,
                "publisher_ad_revenue": round(float(metric_values[2].get("value", "0")), 4) if len(metric_values) > 2 else 0.0,
                "active_users": int(float(metric_values[3].get("value", "0"))) if len(metric_values) > 3 else 0,
            })
        return {"available": True, "dimension": dimension, "rows": rows}
    except HttpError as error:
        return {
            "available": False,
            "dimension": dimension,
            "reason": f"{dimension}をGA4レポートで利用できません: HTTP {error.resp.status}",
            "rows": [],
        }


def _normalize_ga4_date(value: str) -> str:
    raw = str(value or "").strip()
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    return raw


def _is_not_set(value: str) -> bool:
    return str(value or "").strip().lower() in NOT_SET_VALUES


def evaluate_measurement_quality_gate(
    *,
    channel_rows: list[dict[str, Any]],
    page_view_rows: list[dict[str, Any]],
    target_release_id: str,
    required_complete_days: int = 7,
    max_missing_rate: float = 0.05,
    max_unassigned_rate: float = 0.05,
) -> dict[str, Any]:
    """完全日ごとの流入元・共通パラメータ品質を評価する。"""

    daily: dict[str, dict[str, Any]] = {}

    def get_day(raw_date: str) -> dict[str, Any]:
        normalized_date = _normalize_ga4_date(raw_date)
        return daily.setdefault(
            normalized_date,
            {
                "date": normalized_date,
                "sessions": 0,
                "unassigned_sessions": 0,
                "page_views": 0,
                "target_release_page_views": 0,
                "missing_page_type_page_views": 0,
                "missing_content_group_page_views": 0,
            },
        )

    for row in channel_rows:
        day = get_day(str(row.get("date") or ""))
        sessions = max(0, int(float(row.get("sessions") or 0)))
        day["sessions"] += sessions
        channel = str(row.get("channel") or "").strip().lower()
        if channel in {"unassigned", "(not set)", "not set", ""}:
            day["unassigned_sessions"] += sessions

    for row in page_view_rows:
        day = get_day(str(row.get("date") or ""))
        page_views = max(0, int(float(row.get("page_views") or 0)))
        day["page_views"] += page_views
        if str(row.get("measurement_release_id") or "").strip() != target_release_id:
            continue
        day["target_release_page_views"] += page_views
        if _is_not_set(str(row.get("page_type") or "")):
            day["missing_page_type_page_views"] += page_views
        if _is_not_set(str(row.get("content_group") or "")):
            day["missing_content_group_page_views"] += page_views

    evaluated_days: list[dict[str, Any]] = []
    for day_key in sorted(key for key in daily if key):
        day = daily[day_key]
        sessions = int(day["sessions"])
        page_views = int(day["page_views"])
        target_views = int(day["target_release_page_views"])
        unassigned_rate = (
            day["unassigned_sessions"] / sessions if sessions > 0 else None
        )
        release_missing_rate = (
            (page_views - target_views) / page_views if page_views > 0 else None
        )
        page_type_missing_rate = (
            day["missing_page_type_page_views"] / target_views
            if target_views > 0
            else None
        )
        content_group_missing_rate = (
            day["missing_content_group_page_views"] / target_views
            if target_views > 0
            else None
        )
        rates = (
            unassigned_rate,
            release_missing_rate,
            page_type_missing_rate,
            content_group_missing_rate,
        )
        passed = all(rate is not None for rate in rates) and all(
            float(rate) < (
                max_unassigned_rate if index == 0 else max_missing_rate
            )
            for index, rate in enumerate(rates)
        )
        evaluated_days.append({
            **day,
            "unassigned_rate": round(unassigned_rate, 6) if unassigned_rate is not None else None,
            "measurement_release_missing_rate": round(release_missing_rate, 6) if release_missing_rate is not None else None,
            "page_type_missing_rate": round(page_type_missing_rate, 6) if page_type_missing_rate is not None else None,
            "content_group_missing_rate": round(content_group_missing_rate, 6) if content_group_missing_rate is not None else None,
            "passed": passed,
        })

    consecutive_pass_days = 0
    previous_date: date | None = None
    for day in evaluated_days:
        try:
            current_date = date.fromisoformat(day["date"])
        except ValueError:
            consecutive_pass_days = 0
            previous_date = None
            continue
        is_consecutive = previous_date is None or current_date == previous_date + timedelta(days=1)
        if day["passed"] and is_consecutive:
            consecutive_pass_days += 1
        elif day["passed"]:
            consecutive_pass_days = 1
        else:
            consecutive_pass_days = 0
        previous_date = current_date

    ready = consecutive_pass_days >= required_complete_days
    latest_day = evaluated_days[-1] if evaluated_days else None
    return {
        "ready_for_new_experiment": ready,
        "target_release_id": target_release_id,
        "required_complete_days": required_complete_days,
        "consecutive_pass_days": consecutive_pass_days,
        "max_missing_rate": max_missing_rate,
        "max_unassigned_rate": max_unassigned_rate,
        "observed_unassigned_rate": latest_day.get("unassigned_rate") if latest_day else None,
        "latest_complete_date": latest_day.get("date") if latest_day else None,
        "daily": evaluated_days,
        "reason": (
            f"直近{consecutive_pass_days}完全日が全基準を満たしています。"
            if ready
            else f"連続合格は{consecutive_pass_days}日です。{required_complete_days}日へ到達するまで新しい収益実験を開始しません。"
        ),
    }


def collect_measurement_quality_gate(
    service: Any,
    property_id: str,
    *,
    start_date: str,
    end_date: str,
    target_release_id: str,
) -> dict[str, Any]:
    try:
        channel_response = _run_report(
            service,
            property_id,
            start_date=start_date,
            end_date=end_date,
            metrics=["sessions"],
            dimensions=["date", "sessionDefaultChannelGroup"],
        )
        page_view_response = _run_report(
            service,
            property_id,
            start_date=start_date,
            end_date=end_date,
            metrics=["eventCount"],
            dimensions=[
                "date",
                "customEvent:measurement_release_id",
                "customEvent:page_type",
                "customEvent:content_group",
            ],
            dimension_filter=_event_filter("page_view"),
        )
    except HttpError as error:
        return {
            "ready_for_new_experiment": False,
            "target_release_id": target_release_id,
            "required_complete_days": 7,
            "consecutive_pass_days": 0,
            "max_missing_rate": 0.05,
            "max_unassigned_rate": 0.05,
            "daily": [],
            "reason": f"日別計測品質を取得できません: HTTP {error.resp.status}",
        }

    channel_rows: list[dict[str, Any]] = []
    for row in channel_response.get("rows") or []:
        dimensions = row.get("dimensionValues") or []
        metrics = row.get("metricValues") or []
        channel_rows.append({
            "date": dimensions[0].get("value", "") if len(dimensions) > 0 else "",
            "channel": dimensions[1].get("value", "") if len(dimensions) > 1 else "",
            "sessions": metrics[0].get("value", "0") if metrics else "0",
        })

    page_view_rows: list[dict[str, Any]] = []
    for row in page_view_response.get("rows") or []:
        dimensions = row.get("dimensionValues") or []
        metrics = row.get("metricValues") or []
        page_view_rows.append({
            "date": dimensions[0].get("value", "") if len(dimensions) > 0 else "",
            "measurement_release_id": dimensions[1].get("value", "") if len(dimensions) > 1 else "",
            "page_type": dimensions[2].get("value", "") if len(dimensions) > 2 else "",
            "content_group": dimensions[3].get("value", "") if len(dimensions) > 3 else "",
            "page_views": metrics[0].get("value", "0") if metrics else "0",
        })

    return evaluate_measurement_quality_gate(
        channel_rows=channel_rows,
        page_view_rows=page_view_rows,
        target_release_id=target_release_id,
    )


def collect_report(
    service: Any,
    property_id: str,
    *,
    start_date: str,
    end_date: str,
) -> dict[str, Any]:
    event_response = _run_report(
        service,
        property_id,
        start_date=start_date,
        end_date=end_date,
        metrics=["eventCount", "totalUsers"],
        dimensions=["eventName"],
        dimension_filter={
            "filter": {
                "fieldName": "eventName",
                "inListFilter": {"values": list(EVENT_NAMES)},
            }
        },
    )
    events: dict[str, dict[str, int]] = {
        name: {"event_count": 0, "users": 0}
        for name in EVENT_NAMES
    }
    for row in event_response.get("rows") or []:
        name = row["dimensionValues"][0]["value"]
        events[name] = {
            "event_count": int(float(row["metricValues"][0]["value"] or 0)),
            "users": int(float(row["metricValues"][1]["value"] or 0)),
        }

    path_expressions = [
        {
            "filter": {
                "fieldName": "pagePath",
                "stringFilter": {"matchType": "BEGINS_WITH", "value": prefix},
            }
        }
        for prefix in DATA_PATH_PREFIXES
    ]
    path_filter = {"orGroup": {"expressions": path_expressions}}
    session_response = _run_report(
        service,
        property_id,
        start_date=start_date,
        end_date=end_date,
        metrics=["sessions"],
        dimension_filter=path_filter,
    )
    data_sessions = int(_metric_value(session_response))

    revenue: dict[str, Any]
    try:
        revenue_response = _run_report(
            service,
            property_id,
            start_date=start_date,
            end_date=end_date,
            metrics=["publisherAdRevenue", "sessions"],
            dimension_filter=path_filter,
        )
        publisher_revenue = _metric_value(revenue_response, 0)
        revenue_sessions = int(_metric_value(revenue_response, 1))
        revenue = {
            "available": True,
            "publisher_ad_revenue": round(publisher_revenue, 2),
            "sessions": revenue_sessions,
            "revenue_per_1000_sessions": (
                round(publisher_revenue / revenue_sessions * 1000, 2)
                if revenue_sessions > 0
                else None
            ),
        }
    except HttpError as error:
        revenue = {
            "available": False,
            "reason": f"AdSense連携指標を取得できません: HTTP {error.resp.status}",
        }

    favorite_add = _safe_custom_count(
        service,
        property_id,
        start_date=start_date,
        end_date=end_date,
        event_name="data_favorite",
        custom_field="customEvent:action",
        custom_value="add",
    )
    pricing_intent = _safe_custom_count(
        service,
        property_id,
        start_date=start_date,
        end_date=end_date,
        event_name="pricing_survey_response",
        custom_field="customEvent:response",
        custom_value="use_at_390",
    )
    attributed_race_views = _safe_custom_count(
        service,
        property_id,
        start_date=start_date,
        end_date=end_date,
        event_name="race_view",
        custom_field="customEvent:entry_source",
        custom_value="data_upcoming",
    )
    monetization_breakdowns = {
        "page_type": _safe_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            dimension="customEvent:page_type",
        ),
        "content_group": _safe_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            dimension="customEvent:content_group",
        ),
        "race_phase": _safe_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            dimension="customEvent:race_phase",
        ),
        "measurement_release_id": _safe_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            dimension="customEvent:measurement_release_id",
        ),
        "ad_placement": _safe_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            dimension="customEvent:ad_placement",
        ),
        "experiment_variant": _safe_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            dimension="customEvent:variant",
        ),
        "session_channel": _safe_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            dimension="sessionDefaultChannelGroup",
        ),
        "device": _safe_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            dimension="deviceCategory",
        ),
        "new_returning": _safe_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            dimension="newVsReturning",
        ),
    }
    affiliate_breakdowns = {
        "click_provider": _safe_event_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            event_name="affiliate_click", dimension="customEvent:provider",
        ),
        "click_context": _safe_event_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            event_name="affiliate_click", dimension="customEvent:context",
        ),
        "click_campaign": _safe_event_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            event_name="affiliate_click", dimension="customEvent:campaign_id",
        ),
        "click_link": _safe_event_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            event_name="affiliate_click", dimension="customEvent:link_id",
        ),
        "impression_context": _safe_event_breakdown(
            service, property_id, start_date=start_date, end_date=end_date,
            event_name="affiliate_impression", dimension="customEvent:context",
        ),
    }
    measurement_quality_gate = collect_measurement_quality_gate(
        service,
        property_id,
        start_date=start_date,
        end_date=end_date,
        target_release_id=(
            os.environ.get("MONETIZATION_MEASUREMENT_RELEASE_ID")
            or DEFAULT_MEASUREMENT_RELEASE_ID
        ).strip(),
    )

    compare_count = events["compare_result_view"]["event_count"]
    saved_return_users = events["saved_user_return"]["users"]
    survey_views = events["pricing_survey_view"]["event_count"]
    upcoming_clicks = events["upcoming_race_click"]["event_count"]
    saved_return_rate = (
        saved_return_users / favorite_add["users"] * 100
        if favorite_add["available"] and favorite_add["users"]
        else None
    )
    upcoming_conversion_rate = (
        attributed_race_views["event_count"] / upcoming_clicks * 100
        if attributed_race_views["available"] and upcoming_clicks > 0
        else None
    )
    pricing_intent_rate = (
        pricing_intent["event_count"] / survey_views * 100
        if pricing_intent["available"] and survey_views > 0
        else None
    )

    gates = {
        "data_sessions": {
            "value": data_sessions,
            "target": 1000,
            "status": "pass" if data_sessions >= 1000 else "fail",
            "measurement_quality": "exact",
        },
        "comparison_completions": {
            "value": compare_count,
            "target": 100,
            "status": "pass" if compare_count >= 100 else "fail",
            "measurement_quality": "exact",
        },
        "favorite_additions": {
            "value": favorite_add["event_count"],
            "target": 50,
            "status": (
                "pass"
                if favorite_add["available"] and favorite_add["event_count"] >= 50
                else "fail"
                if favorite_add["available"]
                else "unavailable"
            ),
            "measurement_quality": "exact" if favorite_add["available"] else "unavailable",
        },
        "saved_user_return_rate": {
            "value": round(saved_return_rate, 2) if saved_return_rate is not None else None,
            "target": 15.0,
            "status": (
                "pass_proxy"
                if saved_return_rate is not None and saved_return_rate >= 15
                else "fail_proxy"
                if saved_return_rate is not None
                else "unavailable"
            ),
            "measurement_quality": "proxy",
            "note": "厳密な7日コホートはGA4探索で別途確認する。",
        },
        "upcoming_to_race_rate": {
            "value": round(upcoming_conversion_rate, 2) if upcoming_conversion_rate is not None else None,
            "target": 8.0,
            "status": (
                "pass"
                if upcoming_conversion_rate is not None and upcoming_conversion_rate >= 8
                else "fail"
                if upcoming_conversion_rate is not None
                else "unavailable"
            ),
            "measurement_quality": "exact" if upcoming_conversion_rate is not None else "unavailable",
        },
        "pricing_intent": {
            "value": pricing_intent["event_count"],
            "rate": round(pricing_intent_rate, 2) if pricing_intent_rate is not None else None,
            "target_count": 30,
            "target_rate": 5.0,
            "status": (
                "pass"
                if pricing_intent_rate is not None
                and pricing_intent["event_count"] >= 30
                and pricing_intent_rate >= 5
                else "fail"
                if pricing_intent_rate is not None
                else "unavailable"
            ),
            "measurement_quality": "exact" if pricing_intent_rate is not None else "unavailable",
        },
    }
    gate_statuses = {gate["status"] for gate in gates.values()}
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "property_id": property_id,
        "period": {"start_date": start_date, "end_date": end_date},
        "data_sessions": data_sessions,
        "events": events,
        "custom_metrics": {
            "favorite_add": favorite_add,
            "pricing_intent": pricing_intent,
            "attributed_race_views": attributed_race_views,
        },
        "publisher_revenue": revenue,
        "monetization_breakdowns": monetization_breakdowns,
        "affiliate_breakdowns": affiliate_breakdowns,
        "affiliate_measurement_contract": {
            "trafficgate_click": "TrafficGateが記録した外部リダイレクト回数。反復クリックを含み得る。",
            "ga4_affiliate_click": "サイトのCTA押下ごとのイベント総数。provider、context、campaign_id、link_idで分解する。",
            "clarity_affiliate_click": "affiliate_clickが1回以上発生した録画対象セッション数。クリック総数ではない。",
            "comparison_rule": "同じJST日付範囲・provider=rakuten_keibaで比較し、Clarityをクリック数の分母にしない。",
        },
        "measurement_quality_gate": measurement_quality_gate,
        "gates": gates,
        "human_review_ready": not bool(
            gate_statuses & {"fail", "fail_proxy", "unavailable"}
        ),
        "automatic_action": "none",
        "note": "AIは候補を報告するだけで、価格・広告・公開・課金状態を変更しません。",
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# UMA-FREE データ価値ファネル",
        "",
        f"- 期間: {report['period']['start_date']}〜{report['period']['end_date']}",
        f"- データ関連セッション: {report['data_sessions']:,}",
        f"- 人による課金開発レビュー準備: {'可' if report['human_review_ready'] else '未達'}",
        "",
        "## 開始ゲート",
        "",
        "| 指標 | 実績 | 目標 | 状態 | 品質 |",
        "| --- | ---: | ---: | --- | --- |",
    ]
    for name, gate in report["gates"].items():
        value = gate.get("value")
        if name == "pricing_intent":
            value_text = f"{value if value is not None else '—'}件 / {gate.get('rate') if gate.get('rate') is not None else '—'}%"
            target_text = f"{gate['target_count']}件 / {gate['target_rate']}%"
        else:
            value_text = "—" if value is None else str(value)
            target_text = str(gate["target"])
        lines.append(
            f"| `{name}` | {value_text} | {target_text} | `{gate['status']}` | {gate['measurement_quality']} |"
        )
    revenue = report["publisher_revenue"]
    lines.extend(["", "## 収益効率", ""])
    if revenue.get("available"):
        rpm = revenue.get("revenue_per_1000_sessions")
        lines.append(
            f"- データ関連のパブリッシャー広告収益／1,000セッション: {rpm if rpm is not None else '—'}"
        )
    else:
        lines.append(f"- {revenue.get('reason', '広告収益指標を取得できません。')}")
    lines.extend([
        "",
        "保存再訪率は週次レポート上の近似値です。課金開発判断時はGA4探索の7日コホートを人が確認します。",
        "",
        "このレポートは読み取り専用です。価格、広告、公開、課金状態を自動変更しません。",
        "",
    ])
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="GA4データ価値ファネルを生成します。")
    parser.add_argument(
        "--property-id",
        default=os.environ.get("GA4_PROPERTY_ID", ""),
    )
    parser.add_argument("--days", type=int, default=28)
    parser.add_argument("--end-date", type=date.fromisoformat, default=None)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    property_id = str(args.property_id).removeprefix("properties/").strip()
    if not property_id:
        raise RuntimeError("GA4_PROPERTY_IDが未設定です。")
    if not 1 <= args.days <= 90:
        raise ValueError("--daysは1〜90で指定してください。")
    try:
        import google.auth
        from googleapiclient.discovery import build
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "GA4取得にはbackend/requirements.txtのGoogle API依存関係が必要です。"
        ) from error
    end_date = args.end_date or (date.today() - timedelta(days=1))
    start_date = end_date - timedelta(days=args.days - 1)
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/analytics.readonly"]
    )
    service = build(
        "analyticsdata",
        "v1beta",
        credentials=credentials,
        cache_discovery=False,
    )
    report = collect_report(
        service,
        property_id,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
    )
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    args.summary.write_text(render_markdown(report), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
