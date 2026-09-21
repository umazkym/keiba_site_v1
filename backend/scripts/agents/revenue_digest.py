"""週次の収益分析を、通知向けの安全なMarkdownへ整形する。"""

from __future__ import annotations

import math
from collections.abc import Mapping
from datetime import date
from typing import Any


_COMPLETE = "complete"
_INCOMPLETE_STATUSES = {"partial", "failed", "unavailable"}


def _number(value: Any) -> float | None:
    """0を有効値として残し、null・真偽値・非有限値を未取得にする。"""

    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _period_dates(period: Mapping[str, Any], days: int) -> tuple[list[str] | None, str | None]:
    start = period.get("start_date")
    end = period.get("end_date")
    if not isinstance(start, str) or not isinstance(end, str):
        return None, "period_dates_missing"
    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        return None, "period_dates_invalid"
    if (end_date - start_date).days != days - 1:
        return None, "period_dates_invalid"
    return [
        (start_date.fromordinal(start_date.toordinal() + offset)).isoformat()
        for offset in range(days)
    ], None


def _adsense_report_status(analysis: Mapping[str, Any]) -> str:
    source = (analysis.get("source_status") or {}).get("adsense")
    if not isinstance(source, Mapping):
        return "unavailable"
    reports = source.get("reports")
    daily = reports.get("daily") if isinstance(reports, Mapping) else None
    candidate = daily if isinstance(daily, Mapping) else source
    status = str(candidate.get("status") or "unavailable").lower()
    return status if status in {_COMPLETE, *_INCOMPLETE_STATUSES} else "unavailable"


def _adsense_period_quality(
    analysis: Mapping[str, Any], period: Mapping[str, Any], days: int, prefix: str
) -> tuple[bool, list[str]]:
    expected_dates, date_error = _period_dates(period, days)
    reason_codes: list[str] = []
    if date_error:
        reason_codes.append(f"{prefix}_{date_error}")
    else:
        coverage = period.get("date_coverage")
        covered = coverage.get("adsense") if isinstance(coverage, Mapping) else None
        if not isinstance(covered, list) or set(covered) != set(expected_dates or []):
            reason_codes.append(f"{prefix}_adsense_date_coverage_incomplete")

    report_status = _adsense_report_status(analysis)
    if report_status != _COMPLETE:
        reason_codes.append(f"adsense_daily_report_{report_status}")
    return not reason_codes, reason_codes


def _adsense_metric_coverage(
    period: Mapping[str, Any], days: int, prefix: str, metric: str
) -> tuple[bool, list[str]]:
    """AdSenseの加算値が各日に実在するかを、行日付とは別に確認する。"""

    expected_dates, date_error = _period_dates(period, days)
    if date_error:
        return False, [f"{prefix}_{date_error}"]
    coverage = period.get("adsense_metric_coverage")
    if not isinstance(coverage, Mapping):
        return False, [f"{prefix}_adsense_metric_coverage_unavailable"]
    covered = coverage.get(metric)
    if not isinstance(covered, list) or set(covered) != set(expected_dates or []):
        return False, [f"{prefix}_adsense_{metric}_coverage_incomplete"]
    return True, []


def _format_yen(value: float) -> str:
    return f"{value:,.0f}円"


def _format_pv(value: float) -> str:
    return f"{math.ceil(value):,} PV"


def _action_category(cause: Mapping[str, Any] | None) -> str:
    category = str((cause or {}).get("category") or "")
    if category == "data_quality":
        return "data_quality"
    if category == "grade_race_replacement":
        return "content"
    if category == "workflow_failure":
        return "workflow"
    if category in {"revenue_efficiency", "traffic_cross", "search_opportunity"}:
        return "traffic"
    return "routine"


_ACTION_TEXT = {
    "data_quality": "計測データの取得状態と欠損日を確認する",
    "content": "重賞記事の掲載状況を確認する",
    "workflow": "定期処理の実行結果を確認する",
    "traffic": "流入と広告効率の内訳を確認する",
    "routine": "週次分析の根拠を確認する",
}

_PUBLIC_NEXT_TEXT = {
    "data_quality": "今回の対象は計測データの取得状態です。全記事チェックは不要です。",
    "content": "今回の対象は重賞記事の掲載状況です。全記事チェックは不要です。",
    "workflow": "今回の対象は定期処理の結果です。全記事チェックは不要です。",
    "traffic": "今回の対象は流入と広告効率の内訳です。全記事チェックは不要です。",
    "routine": "今回の対象は週次の収益確認です。全記事チェックは不要で、自動収集を継続します。",
}


def _core_non_adsense_source_incomplete(analysis: Mapping[str, Any]) -> bool:
    """正式週の判断に使うGA4・GSCの取得異常を、媒体名を出さずに拾う。"""

    source_status = analysis.get("source_status")
    if not isinstance(source_status, Mapping):
        return True
    for name in ("ga4", "gsc"):
        source = source_status.get(name)
        if not isinstance(source, Mapping) or str(source.get("status") or "").lower() != _COMPLETE:
            return True
    return False


def build_weekly_digest(
    analysis: Mapping[str, Any],
    goal_jpy: float = 10_000,
) -> dict[str, Any]:
    """収益分析から私用詳細通知と公開可能な簡易通知を生成する。

    金額の正本はAdSense JPYだけであり、GA4収益は一切加算しない。日付または
    AdSense日次レポートが不完全な期間では、30日換算ペースと必要PVを未判定にする。
    """

    current = analysis.get("current_week")
    current = current if isinstance(current, Mapping) else {}
    rolling = analysis.get("rolling_28_days")
    rolling = rolling if isinstance(rolling, Mapping) else {}
    goal = _number(goal_jpy)
    if goal is None or goal < 0:
        raise ValueError("goal_jpyは0以上の有限な数値を指定してください。")

    week_dates_complete, week_reasons = _adsense_period_quality(
        analysis, current, 7, "current_week"
    )
    rolling_dates_complete, rolling_reasons = _adsense_period_quality(
        analysis, rolling, 28, "rolling_28_days"
    )
    reason_codes = list(dict.fromkeys([*week_reasons, *rolling_reasons]))
    week_earnings_complete, week_earnings_reasons = _adsense_metric_coverage(
        current, 7, "current_week", "estimated_earnings"
    )
    rolling_earnings_complete, rolling_earnings_reasons = _adsense_metric_coverage(
        rolling, 28, "rolling_28_days", "estimated_earnings"
    )
    rolling_page_views_complete, rolling_page_views_reasons = _adsense_metric_coverage(
        rolling, 28, "rolling_28_days", "page_views"
    )
    reason_codes.extend([
        *week_earnings_reasons,
        *rolling_earnings_reasons,
        *rolling_page_views_reasons,
    ])
    week_complete = week_dates_complete and week_earnings_complete
    rolling_complete = rolling_dates_complete and rolling_earnings_complete

    current_revenue = _number(current.get("adsense_revenue_jpy"))
    if current_revenue is None:
        reason_codes.append("current_week_adsense_revenue_missing")
        week_complete = False

    rolling_revenue = _number(rolling.get("adsense_revenue_jpy"))
    if rolling_revenue is None:
        reason_codes.append("rolling_28_days_adsense_revenue_missing")
        rolling_complete = False

    pace = rolling_revenue / 28 * 30 if rolling_complete and rolling_revenue is not None else None
    if pace is None:
        reason_codes.append("monthly_pace_unavailable")

    shortfall = max(goal - pace, 0) if pace is not None else None
    rpm = _number(rolling.get("page_rpm_jpy"))
    required_pv: float | None = None
    if shortfall is not None:
        if not rolling_page_views_complete:
            pass
        elif rpm is None:
            reason_codes.append("rolling_28_days_rpm_missing")
        elif rpm <= 0:
            reason_codes.append("rolling_28_days_rpm_nonpositive")
        else:
            required_pv = shortfall / rpm * 1000

    non_adsense_source_incomplete = _core_non_adsense_source_incomplete(analysis)
    if non_adsense_source_incomplete:
        reason_codes.append("core_non_adsense_source_incomplete")

    raw_causes = analysis.get("root_causes")
    causes = [row for row in raw_causes if isinstance(row, Mapping)] if isinstance(raw_causes, list) else []
    categories: list[str] = []
    if (
        not week_complete
        or not rolling_complete
        or not rolling_page_views_complete
        or non_adsense_source_incomplete
    ):
        categories.append("data_quality")
    for cause in causes:
        category = _action_category(cause)
        if category not in categories:
            categories.append(category)
    if not categories:
        categories.append("routine")
    categories = categories[:3]
    for category in categories:
        reason_codes.append(f"action_{category}")
    reason_codes = sorted(set(reason_codes))

    period_end = str(current.get("end_date") or (analysis.get("formal_week") or {}).get("end_date") or "未判定")
    title = f"UMA-FREE 週次収益ダイジェスト（{period_end}時点）"
    current_text = _format_yen(current_revenue) if week_complete and current_revenue is not None else "未判定"
    pace_text = _format_yen(pace) if pace is not None else "未判定"
    shortfall_text = _format_yen(shortfall) if shortfall is not None else "未判定"
    required_pv_text = _format_pv(required_pv) if required_pv is not None else "未判定"
    if shortfall is not None and shortfall == 0:
        required_pv_text = "0 PV"

    body_lines = [
        f"# {title}",
        "",
        f"- 集計期間（今週）: {current.get('start_date') or '未判定'}〜{period_end}",
        f"- 集計期間（直近28日）: {rolling.get('start_date') or '未判定'}〜{rolling.get('end_date') or '未判定'}",
        "- 月間目標: 10,000円" if goal == 10_000 else f"- 月間目標: {_format_yen(goal)}",
        f"- 今週のAdSense収益: {current_text}",
        f"- 直近28日からの30日換算ペース: {pace_text}",
        f"- 目標までの不足額: {shortfall_text}",
        f"- 不足額を補う目安のPV（直近28日の実績RPM使用）: {required_pv_text}",
        "",
        "30日換算ペースと必要PVは、直近の実績を単純換算した目安であり、収益の予測や到達保証ではありません。",
        "",
        "## 今週対応すべきこと",
        "",
    ]
    body_lines.extend(f"{index}. {_ACTION_TEXT[category]}" for index, category in enumerate(categories, start=1))
    body_lines.extend([
        "",
        "## 優先改善",
        "",
        f"- {_ACTION_TEXT[categories[0]]}",
        "",
        "## 取得状態",
        "",
        f"- 今週のAdSense日次: {'確認済み' if week_complete else '未判定'}",
        f"- 直近28日のAdSense日次: {'確認済み' if rolling_complete else '未判定'}",
        f"- GA4・GSCの取得状態: {'確認済み' if not non_adsense_source_incomplete else '未判定'}",
        "- 金額はAdSense（JPY）のみを使用し、GA4の別通貨収益は加算していません。",
    ])

    if pace is None:
        public_goal = "データ不足で未判定"
    elif pace >= goal:
        public_goal = "単純換算では目標水準に到達（実月収の確定達成ではありません）"
    else:
        public_goal = "まだ届いていません（直近実績の単純換算）"
    attention_categories = {"data_quality", "workflow", "traffic", "content"}
    needs_attention = any(category in attention_categories for category in categories)
    priority_category = next(
        (category for category in categories if category in attention_categories), categories[0]
    )
    public_title = f"UMA-FREE 週次状況（{period_end}時点）"
    public_lines = [
        f"# {public_title}",
        "",
        f"- 対象期間: {current.get('start_date') or '未判定'}〜{period_end}",
        f"- 目標への進み具合: {public_goal}",
        f"- あなたの対応: {'確認が必要' if needs_attention else '確認不要'}",
        f"- 次に進めること: {_PUBLIC_NEXT_TEXT[priority_category]}",
    ]

    return {
        "title": title,
        "body": "\n".join(body_lines) + "\n",
        "public_title": public_title,
        "public_body": "\n".join(public_lines) + "\n",
        "period_end": period_end,
        "needs_attention": needs_attention,
        "reason_codes": reason_codes,
    }
