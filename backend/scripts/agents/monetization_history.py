#!/usr/bin/env python3
"""UMA-FREEの収益・流入履歴を読み取り専用で収集し、週次判断用に正規化する。

外部サービスはすべてGET相当の読取APIだけを使用する。媒体ごとの失敗は
``source-status.v2.json``へ残し、取得済みの原本と他媒体の分析を破棄しない。
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import statistics
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence


SCHEMA_VERSION = "monetization-history.v2"
SOURCE_STATUS_VERSION = "source-status.v2"
ANALYSIS_VERSION = "monetization-cycle-analysis.v1"
BUSINESS_START_DATE = date(2026, 3, 14)
GA4_ADSENSE_LINK_DATE = date(2026, 3, 15)
FIRST_COMPLETE_WEEK_START = date(2026, 3, 16)
JST = timezone(timedelta(hours=9))
RETRIEVED_AT = datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class Period:
    start: date
    end: date

    def __post_init__(self) -> None:
        if self.start > self.end:
            raise ValueError("start-dateはend-date以前で指定してください。")
        if self.start < BUSINESS_START_DATE:
            raise ValueError("収益履歴の開始日は2026-03-14以降にしてください。")

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("日付はYYYY-MM-DD形式で指定してください。") from exc


def latest_complete_sunday(today: date | None = None) -> date:
    base = today or datetime.now(JST).date()
    days_since_sunday = (base.weekday() + 1) % 7
    candidate = base - timedelta(days=days_since_sunday)
    return candidate - timedelta(days=7) if candidate >= base else candidate


def resolve_period(mode: str, start: date | None, end: date | None) -> Period:
    resolved_end = end or latest_complete_sunday()
    if mode == "backfill":
        resolved_start = start or BUSINESS_START_DATE
    else:
        # 週次成果物にも3/14以降の累積を持たせるため、既定は事業開始日から再取得する。
        # 各APIは原本を月単位またはページ単位へ分割し、行上限を監視する。
        resolved_start = start or BUSINESS_START_DATE
    return Period(resolved_start, resolved_end)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_json(path: Path | None) -> Any:
    if path is None or not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8-sig"))


def numeric(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def safe_error(exc: BaseException) -> str:
    """外部API例外を成果物へ残す前に、既知の秘密値と認証ヘッダーを除去する。"""

    message = str(exc)
    for name, value in os.environ.items():
        upper_name = name.upper()
        if not value or not any(marker in upper_name for marker in (
            "TOKEN", "SECRET", "PASSWORD", "API_KEY", "CLIENT_ID",
        )):
            continue
        message = message.replace(value, "[REDACTED]")
    message = re.sub(
        r"(?i)(authorization\s*[:=]\s*bearer\s+)[^\s,;]+",
        r"\1[REDACTED]",
        message,
    )
    message = re.sub(
        r"(?i)((?:access|refresh|id)_token\s*[:=]\s*)[^\s,;&]+",
        r"\1[REDACTED]",
        message,
    )
    return f"{type(exc).__name__}: {message}"


def iso_date_from_ga4(value: str) -> str:
    raw = str(value or "")
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
    return raw


def common_row(
    source: str,
    dataset: str,
    row_date: str | None,
    source_timezone: str,
    freshness: str,
    lineage: str,
    dimensions: Mapping[str, Any],
    metrics: Mapping[str, Any],
    *,
    status: str = "complete",
) -> dict[str, Any]:
    return {
        "source": source,
        "dataset": dataset,
        "date": row_date,
        "source_timezone": source_timezone,
        "retrieved_at": RETRIEVED_AT,
        "freshness": freshness,
        "status": status,
        "lineage": lineage,
        "dimensions": dict(dimensions),
        "metrics": dict(metrics),
    }


def oauth_credentials(prefix: str, scopes: Sequence[str]):
    names = {
        "client_id": f"{prefix}_OAUTH_CLIENT_ID",
        "client_secret": f"{prefix}_OAUTH_CLIENT_SECRET",
        "refresh_token": f"{prefix}_OAUTH_REFRESH_TOKEN",
    }
    values = {key: os.getenv(env_name, "").strip() for key, env_name in names.items()}
    missing = [names[key] for key, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"読取OAuthが未設定です: {', '.join(missing)}")
    try:
        from google.oauth2.credentials import Credentials
    except ImportError as exc:
        raise RuntimeError("google-authが必要です。backend/requirements.txtを確認してください。") from exc
    return Credentials(
        token=None,
        refresh_token=values["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=values["client_id"],
        client_secret=values["client_secret"],
        scopes=list(scopes),
    )


def google_default_credentials(scopes: Sequence[str]):
    try:
        import google.auth
    except ImportError as exc:
        raise RuntimeError("google-authが必要です。backend/requirements.txtを確認してください。") from exc
    credentials, _project = google.auth.default(scopes=list(scopes))
    return credentials


def build_google_service(api: str, version: str, credentials: Any):
    try:
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise RuntimeError("google-api-python-clientが必要です。") from exc
    return build(api, version, credentials=credentials, cache_discovery=False)


def month_chunks(period: Period) -> Iterable[Period]:
    cursor = period.start
    while cursor <= period.end:
        next_month = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
        chunk_end = min(period.end, next_month - timedelta(days=1))
        yield Period(cursor, chunk_end)
        cursor = chunk_end + timedelta(days=1)


ADSENSE_METRICS = (
    "ESTIMATED_EARNINGS",
    "PAGE_VIEWS",
    "IMPRESSIONS",
    "CLICKS",
    "PAGE_VIEWS_RPM",
    "IMPRESSIONS_RPM",
    "AD_REQUESTS",
    "AD_REQUESTS_COVERAGE",
    "ACTIVE_VIEW_MEASURABILITY",
    "ACTIVE_VIEW_VIEWABILITY",
)

ADSENSE_REPORTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("daily", ("DATE",)),
    ("platform", ("DATE", "PLATFORM_TYPE_CODE")),
    ("format", ("DATE", "AD_FORMAT_CODE")),
    ("placement", ("DATE", "AD_PLACEMENT_CODE")),
    ("ad_unit", ("DATE", "AD_UNIT_ID")),
    ("url_channel", ("DATE", "URL_CHANNEL_ID")),
    ("custom_channel", ("DATE", "CUSTOM_CHANNEL_ID")),
    ("traffic_source", ("DATE", "TRAFFIC_SOURCE_CODE")),
)


def parse_adsense_report(dataset: str, payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    headers = list(payload.get("headers") or [])
    names = [str(header.get("name") or "") for header in headers]
    header_types = [str(header.get("type") or "") for header in headers]
    rows: list[dict[str, Any]] = []
    for raw_row in payload.get("rows") or []:
        cells = list(raw_row.get("cells") or [])
        values = [cell.get("value") for cell in cells]
        dimensions: dict[str, Any] = {}
        metrics: dict[str, Any] = {}
        row_date: str | None = None
        for index, name in enumerate(names):
            value = values[index] if index < len(values) else None
            if header_types[index] == "DIMENSION":
                if name == "DATE":
                    row_date = str(value or "") or None
                else:
                    dimensions[name.lower()] = value
            else:
                metrics[name.lower()] = numeric(value)
        rows.append(common_row(
            "adsense",
            dataset,
            row_date,
            "account_timezone",
            "estimated_until_finalized",
            "AdSense Management API v2 accounts.reports.generate",
            dimensions,
            metrics,
        ))
    return rows


def collect_adsense(period: Period, raw_dir: Path, service: Any | None = None) -> dict[str, Any]:
    credentials = oauth_credentials("ADSENSE", ["https://www.googleapis.com/auth/adsense.readonly"])
    service = service or build_google_service("adsense", "v2", credentials)
    account = os.getenv("ADSENSE_ACCOUNT", "").strip()
    if not account:
        accounts = service.accounts().list(pageSize=100).execute(num_retries=3).get("accounts") or []
        if len(accounts) != 1:
            raise RuntimeError("AdSenseアカウントを一意に特定できません。ADSENSE_ACCOUNTを設定してください。")
        account = str(accounts[0].get("name") or "")
    if not account.startswith("accounts/"):
        account = f"accounts/{account}"

    all_rows: list[dict[str, Any]] = []
    report_status: dict[str, Any] = {}
    for dataset, dimensions in ADSENSE_REPORTS:
        dataset_rows: list[dict[str, Any]] = []
        errors: list[str] = []
        for chunk in month_chunks(period):
            try:
                payload = service.accounts().reports().generate(
                    account=account,
                    dateRange="CUSTOM",
                    startDate_year=chunk.start.year,
                    startDate_month=chunk.start.month,
                    startDate_day=chunk.start.day,
                    endDate_year=chunk.end.year,
                    endDate_month=chunk.end.month,
                    endDate_day=chunk.end.day,
                    dimensions=list(dimensions),
                    metrics=list(ADSENSE_METRICS),
                    reportingTimeZone="ACCOUNT_TIME_ZONE",
                    currencyCode="JPY",
                    limit=100000,
                ).execute(num_retries=3)
                write_json(raw_dir / "adsense" / dataset / f"{chunk.start}_{chunk.end}.json", payload)
                dataset_rows.extend(parse_adsense_report(dataset, payload))
                matched = int(payload.get("totalMatchedRows") or len(payload.get("rows") or []))
                if matched > len(payload.get("rows") or []):
                    errors.append(f"{chunk.start}〜{chunk.end}: 行上限で切り捨て")
            except Exception as exc:  # 媒体内の互換性差を他レポートへ波及させない。
                errors.append(f"{chunk.start}〜{chunk.end}: {safe_error(exc)}")
        all_rows.extend(dataset_rows)
        report_status[dataset] = {
            "status": "complete" if not errors else "partial" if dataset_rows else "failed",
            "row_count": len(dataset_rows),
            "errors": errors,
        }

    payments_payload: Mapping[str, Any] = {}
    try:
        payments_payload = service.accounts().payments().list(parent=account).execute(num_retries=3)
        write_json(raw_dir / "adsense" / "payments.json", payments_payload)
        payment_rows = []
        for payment in payments_payload.get("payments") or []:
            amount = payment.get("amount") or ""
            payment_rows.append(common_row(
                "adsense",
                "payments",
                str(payment.get("date") or "")[:10] or None,
                "account_timezone",
                "finalized_payment",
                "AdSense Management API v2 accounts.payments.list",
                {"name": payment.get("name")},
                {
                    "payment_amount": numeric(str(amount).split()[0]) if amount else None,
                    "currency": str(amount).split()[-1] if amount else None,
                },
            ))
        all_rows.extend(payment_rows)
        report_status["payments"] = {"status": "complete", "row_count": len(payment_rows)}
    except Exception as exc:
        report_status["payments"] = {"status": "failed", "errors": [safe_error(exc)]}
    return {"rows": all_rows, "reports": report_status, "payments": payments_payload}


GA4_REPORTS: tuple[dict[str, Any], ...] = (
    {
        "name": "daily",
        "dimensions": ["date"],
        "metrics": ["sessions", "screenPageViews", "activeUsers", "totalUsers", "newUsers", "engagedSessions", "userEngagementDuration", "totalAdRevenue"],
    },
    {
        "name": "acquisition",
        "dimensions": ["date", "sessionDefaultChannelGroup", "sessionSourceMedium", "sessionCampaignName"],
        "metrics": ["sessions", "screenPageViews", "activeUsers", "engagedSessions", "totalAdRevenue"],
    },
    {
        "name": "landing_device",
        "dimensions": ["date", "landingPagePlusQueryString", "deviceCategory"],
        "metrics": ["sessions", "screenPageViews", "activeUsers", "engagedSessions", "totalAdRevenue"],
    },
    {
        "name": "new_returning",
        "dimensions": ["date", "newVsReturning", "deviceCategory"],
        "metrics": ["sessions", "screenPageViews", "activeUsers", "engagedSessions", "totalAdRevenue"],
    },
    {
        "name": "events",
        "dimensions": ["date", "eventName"],
        "metrics": ["eventCount", "totalUsers"],
    },
    {
        "name": "article_funnel",
        "dimensions": ["date", "pagePath", "eventName"],
        "metrics": ["eventCount", "totalUsers"],
    },
)

GA4_CUSTOM_REPORTS: tuple[dict[str, Any], ...] = (
    {
        "name": "page_type",
        "dimensions": ["date", "customEvent:page_type"],
        "metrics": ["sessions", "screenPageViews", "activeUsers", "totalAdRevenue"],
    },
    {
        "name": "content_group",
        "dimensions": ["date", "customEvent:content_group"],
        "metrics": ["sessions", "screenPageViews", "activeUsers", "totalAdRevenue"],
    },
    {
        "name": "campaign_attribution",
        "dimensions": ["date", "customEvent:campaign_id", "customEvent:entry_source"],
        "metrics": ["eventCount", "totalUsers"],
    },
)


def paged_ga4_report(
    service: Any,
    property_id: str,
    period: Period,
    dimensions: Sequence[str],
    metrics: Sequence[str],
    *,
    page_size: int = 100000,
    max_rows: int = 500000,
) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    offset = 0
    metadata: dict[str, Any] = {}
    while offset < max_rows:
        body = {
            "dateRanges": [{"startDate": period.start.isoformat(), "endDate": period.end.isoformat()}],
            "dimensions": [{"name": value} for value in dimensions],
            "metrics": [{"name": value} for value in metrics],
            "limit": str(min(page_size, max_rows - offset)),
            "offset": str(offset),
            "keepEmptyRows": False,
        }
        response = service.properties().runReport(
            property=f"properties/{property_id}", body=body
        ).execute(num_retries=3)
        metadata = {key: value for key, value in response.items() if key != "rows"}
        page_rows = list(response.get("rows") or [])
        rows.extend(page_rows)
        if len(page_rows) < min(page_size, max_rows - offset):
            break
        offset += len(page_rows)
    return {**metadata, "rows": rows, "truncated": offset >= max_rows}


def parse_ga4_report(dataset: str, payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    dimension_names = [str(row.get("name") or "") for row in payload.get("dimensionHeaders") or []]
    metric_names = [str(row.get("name") or "") for row in payload.get("metricHeaders") or []]
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), Mapping) else {}
    currency_code = str(metadata.get("currencyCode") or "").upper() or None
    source_timezone = str(metadata.get("timeZone") or "") or "GA4_property_timezone"
    rows: list[dict[str, Any]] = []
    for raw_row in payload.get("rows") or []:
        dimension_values = list(raw_row.get("dimensionValues") or [])
        metric_values = list(raw_row.get("metricValues") or [])
        dimensions = {
            name: (dimension_values[index].get("value") if index < len(dimension_values) else None)
            for index, name in enumerate(dimension_names)
            if name != "date"
        }
        raw_date = next((
            dimension_values[index].get("value")
            for index, name in enumerate(dimension_names)
            if name == "date" and index < len(dimension_values)
        ), None)
        metrics = {
            name: numeric(metric_values[index].get("value")) if index < len(metric_values) else None
            for index, name in enumerate(metric_names)
        }
        row = common_row(
            "ga4",
            dataset,
            iso_date_from_ga4(str(raw_date or "")) or None,
            source_timezone,
            "processed_yesterday",
            "Google Analytics Data API v1beta properties.runReport",
            dimensions,
            metrics,
        )
        # totalAdRevenueはプロパティの表示通貨で返る。AdSenseのJPYと
        # 換算せず直接比較しないよう、各正規化行にも通貨を保持する。
        row["source_currency"] = currency_code
        rows.append(row)
    return rows


def collect_ga4(period: Period, raw_dir: Path, service: Any | None = None) -> dict[str, Any]:
    property_id = os.getenv("GA4_PROPERTY_ID", "").removeprefix("properties/").strip()
    if not property_id:
        raise RuntimeError("GA4_PROPERTY_IDが未設定です。")
    service = service or build_google_service(
        "analyticsdata",
        "v1beta",
        google_default_credentials(["https://www.googleapis.com/auth/analytics.readonly"]),
    )
    all_rows: list[dict[str, Any]] = []
    report_status: dict[str, Any] = {}
    currency_codes: set[str] = set()
    reports = list(GA4_REPORTS)
    custom_start = max(period.start, date(2026, 8, 3))
    if custom_start <= period.end:
        reports.extend({**report, "period": Period(custom_start, period.end)} for report in GA4_CUSTOM_REPORTS)
    else:
        for report in GA4_CUSTOM_REPORTS:
            report_status[report["name"]] = {
                "status": "unavailable",
                "row_count": 0,
                "reason": "カスタム定義登録前のため取得対象外",
            }
    for report in reports:
        report_period = report.get("period") or period
        try:
            payload = paged_ga4_report(
                service,
                property_id,
                report_period,
                report["dimensions"],
                report["metrics"],
            )
            write_json(raw_dir / "ga4" / f"{report['name']}.json", payload)
            parsed = parse_ga4_report(report["name"], payload)
            all_rows.extend(parsed)
            currency_code = str((payload.get("metadata") or {}).get("currencyCode") or "").upper()
            if currency_code:
                currency_codes.add(currency_code)
            report_status[report["name"]] = {
                "status": "partial" if payload.get("truncated") else "complete",
                "row_count": len(parsed),
                "truncated": bool(payload.get("truncated")),
                "currency_code": currency_code or None,
            }
        except Exception as exc:
            report_status[report["name"]] = {
                "status": "failed",
                "row_count": 0,
                "reason": safe_error(exc),
            }
    return {
        "rows": all_rows,
        "reports": report_status,
        "property_id": property_id,
        "currency_code": next(iter(currency_codes)) if len(currency_codes) == 1 else None,
        "currency_codes": sorted(currency_codes),
    }


GSC_REPORTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("daily", ("date",)),
    ("page_daily", ("date", "page")),
    ("page_query_device", ("page", "query", "device")),
    ("query_country", ("query", "country")),
    ("search_appearance", ("searchAppearance",)),
)


def fetch_gsc_rows(
    service: Any,
    site_url: str,
    period: Period,
    dimensions: Sequence[str],
    *,
    max_rows: int = 250000,
) -> tuple[list[dict[str, Any]], bool]:
    page_size = 25000
    rows: list[dict[str, Any]] = []
    start_row = 0
    while start_row < max_rows:
        body = {
            "startDate": period.start.isoformat(),
            "endDate": period.end.isoformat(),
            "dimensions": list(dimensions),
            "type": "web",
            "dataState": "final",
            "rowLimit": min(page_size, max_rows - start_row),
            "startRow": start_row,
        }
        response = service.searchanalytics().query(siteUrl=site_url, body=body).execute(num_retries=3)
        page_rows = list(response.get("rows") or [])
        rows.extend(page_rows)
        if len(page_rows) < body["rowLimit"]:
            return rows, False
        start_row += len(page_rows)
    return rows, True


def parse_gsc_rows(dataset: str, dimensions: Sequence[str], rows: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    parsed: list[dict[str, Any]] = []
    for raw_row in rows:
        keys = list(raw_row.get("keys") or [])
        dimension_values = {
            name: (keys[index] if index < len(keys) else None)
            for index, name in enumerate(dimensions)
            if name != "date"
        }
        raw_date = next((keys[index] for index, name in enumerate(dimensions) if name == "date" and index < len(keys)), None)
        parsed.append(common_row(
            "gsc",
            dataset,
            str(raw_date) if raw_date else None,
            "America/Los_Angeles",
            "finalized",
            "Google Search Console Search Analytics API",
            dimension_values,
            {
                "clicks": numeric(raw_row.get("clicks")),
                "impressions": numeric(raw_row.get("impressions")),
                "ctr": numeric(raw_row.get("ctr")),
                "position": numeric(raw_row.get("position")),
            },
        ))
    return parsed


def collect_gsc(period: Period, raw_dir: Path, service: Any | None = None) -> dict[str, Any]:
    site_url = os.getenv("GSC_SITE_URL", "sc-domain:uma-free.com").strip()
    service = service or build_google_service(
        "searchconsole",
        "v1",
        google_default_credentials(["https://www.googleapis.com/auth/webmasters.readonly"]),
    )
    all_rows: list[dict[str, Any]] = []
    report_status: dict[str, Any] = {}
    for dataset, dimensions in GSC_REPORTS:
        try:
            raw_rows, truncated = fetch_gsc_rows(service, site_url, period, dimensions)
            write_json(raw_dir / "gsc" / f"{dataset}.json", {
                "period": {"start": period.start.isoformat(), "end": period.end.isoformat()},
                "dimensions": list(dimensions),
                "data_state": "final",
                "rows": raw_rows,
                "truncated": truncated,
            })
            parsed = parse_gsc_rows(dataset, dimensions, raw_rows)
            all_rows.extend(parsed)
            report_status[dataset] = {
                "status": "partial" if truncated else "complete",
                "row_count": len(parsed),
                "truncated": truncated,
            }
        except Exception as exc:
            report_status[dataset] = {
                "status": "failed",
                "row_count": 0,
                "reason": safe_error(exc),
            }
    return {"rows": all_rows, "reports": report_status, "site_url": site_url}


YOUTUBE_REPORTS: tuple[dict[str, Any], ...] = (
    {
        "name": "daily",
        "dimensions": "day",
        "metrics": "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares",
    },
    {
        "name": "video_period",
        "dimensions": "video",
        "metrics": "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares",
        "sort": "-views",
        "max_results": 200,
        "single_page": True,
    },
    {
        "name": "traffic_source",
        "dimensions": "day,insightTrafficSourceType",
        "metrics": "views,estimatedMinutesWatched",
    },
    {
        "name": "device",
        "dimensions": "day,deviceType",
        "metrics": "views,estimatedMinutesWatched",
    },
)


def parse_youtube_report(dataset: str, payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    headers = list(payload.get("columnHeaders") or [])
    names = [str(header.get("name") or "") for header in headers]
    kinds = [str(header.get("columnType") or "") for header in headers]
    parsed: list[dict[str, Any]] = []
    for values in payload.get("rows") or []:
        dimensions: dict[str, Any] = {}
        metrics: dict[str, Any] = {}
        row_date: str | None = None
        for index, name in enumerate(names):
            value = values[index] if index < len(values) else None
            if kinds[index] == "DIMENSION":
                if name == "day":
                    row_date = str(value or "") or None
                else:
                    dimensions[name] = value
            else:
                metrics[name] = numeric(value)
        parsed.append(common_row(
            "youtube",
            dataset,
            row_date,
            "YouTube_Analytics_date",
            "processed_with_recent_delay",
            "YouTube Analytics API v2 reports.query",
            dimensions,
            metrics,
        ))
    return parsed


def collect_youtube(period: Period, raw_dir: Path, service: Any | None = None) -> dict[str, Any]:
    credentials = oauth_credentials(
        "YOUTUBE_ANALYTICS",
        [
            "https://www.googleapis.com/auth/yt-analytics.readonly",
            "https://www.googleapis.com/auth/youtube.readonly",
        ],
    )
    service = service or build_google_service("youtubeAnalytics", "v2", credentials)
    all_rows: list[dict[str, Any]] = []
    report_status: dict[str, Any] = {}
    for report in YOUTUBE_REPORTS:
        try:
            payload: dict[str, Any] = {"rows": []}
            start_index = 1
            page_size = int(report.get("max_results") or 200)
            while True:
                page = service.reports().query(
                    ids="channel==MINE",
                    startDate=period.start.isoformat(),
                    endDate=period.end.isoformat(),
                    dimensions=report["dimensions"],
                    metrics=report["metrics"],
                    sort=str(report.get("sort") or report["dimensions"]),
                    startIndex=start_index,
                    maxResults=page_size,
                ).execute(num_retries=3)
                if not payload.get("columnHeaders"):
                    payload.update({key: value for key, value in page.items() if key != "rows"})
                page_rows = list(page.get("rows") or [])
                payload["rows"].extend(page_rows)
                if report.get("single_page") or len(page_rows) < page_size:
                    break
                start_index += len(page_rows)
            write_json(raw_dir / "youtube" / f"{report['name']}.json", payload)
            parsed = parse_youtube_report(report["name"], payload)
            all_rows.extend(parsed)
            report_status[report["name"]] = {"status": "complete", "row_count": len(parsed)}
        except Exception as exc:
            report_status[report["name"]] = {
                "status": "failed",
                "row_count": 0,
                "reason": safe_error(exc),
            }
    report_status["thumbnail_reach"] = {
        "status": "unavailable",
        "row_count": 0,
        "reason": (
            "YouTube Analytics Query APIのチャンネルレポートではサムネイル表示・CTRを"
            "取得できないため、Reporting APIのReach一括レポートまたはStudio出力が必要"
        ),
    }
    return {"rows": all_rows, "reports": report_status}


def collect_github(period: Period, raw_dir: Path) -> dict[str, Any]:
    try:
        import requests
    except ImportError as exc:
        raise RuntimeError("GitHub履歴取得にはrequestsが必要です。") from exc
    repository = os.getenv("GITHUB_REPOSITORY", "umazkym/keiba_site_v1").strip()
    token = (os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("GITHUB_TOKENまたはGH_TOKENが未設定です。")
    session = requests.Session()
    session.headers.update({
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "uma-free-readonly-monetization-cycle",
    })
    workflows = (
        "Keiba Article Auto Pipeline",
        "Keiba YouTube Video Pipeline",
        "Keiba SNS Morning Post",
        "Keiba SNS Afternoon Post",
        "Keiba SNS Evening Post",
        "Keiba SNS Pre Race",
        "Keiba SNS Hit Immediate",
        "Keiba Data Fetch Morning",
        "Deploy Frontend to Cloud Run",
    )
    all_runs: list[dict[str, Any]] = []
    page = 1
    while page <= 10:
        response = session.get(
            f"https://api.github.com/repos/{repository}/actions/runs",
            params={
                "created": f">={period.start.isoformat()}",
                "per_page": 100,
                "page": page,
                "exclude_pull_requests": "true",
            },
            timeout=30,
        )
        response.raise_for_status()
        page_runs = response.json().get("workflow_runs") or []
        all_runs.extend(run for run in page_runs if run.get("name") in workflows)
        if len(page_runs) < 100:
            break
        page += 1

    failures = [run for run in all_runs if run.get("conclusion") in {"failure", "cancelled", "timed_out", "action_required"}]
    failure_jobs: list[dict[str, Any]] = []
    for run in failures[:100]:
        response = session.get(
            f"https://api.github.com/repos/{repository}/actions/runs/{run['id']}/jobs",
            params={"per_page": 100},
            timeout=30,
        )
        if response.ok:
            for job in response.json().get("jobs") or []:
                failed_steps = [
                    str(step.get("name") or "")
                    for step in job.get("steps") or []
                    if step.get("conclusion") in {"failure", "cancelled", "timed_out"}
                ]
                if failed_steps or job.get("conclusion") != "success":
                    failure_jobs.append({
                        "run_id": run.get("id"),
                        "workflow": run.get("name"),
                        "created_at": run.get("created_at"),
                        "job": job.get("name"),
                        "conclusion": job.get("conclusion"),
                        "failed_steps": failed_steps,
                        "url": run.get("html_url"),
                    })
    raw_payload = {"repository": repository, "runs": all_runs, "failure_jobs": failure_jobs}
    write_json(raw_dir / "github" / "workflow_runs.json", raw_payload)
    rows = [common_row(
        "github_actions",
        "workflow_runs",
        str(run.get("created_at") or "")[:10] or None,
        "UTC",
        "api_snapshot",
        "GitHub Actions REST API workflow runs",
        {
            "workflow": run.get("name"),
            "event": run.get("event"),
            "conclusion": run.get("conclusion"),
            "head_sha": run.get("head_sha"),
            "url": run.get("html_url"),
        },
        {"run_count": 1, "failed": 0 if run.get("conclusion") == "success" else 1},
    ) for run in all_runs]
    return {
        "rows": rows,
        "failure_jobs": failure_jobs,
        "truncated_failures": len(failures) > 100,
        "reports": {"workflow_runs": {"status": "complete", "row_count": len(rows)}},
    }


def import_clarity(path: Path | None) -> dict[str, Any]:
    if path is None or not path.exists():
        raise RuntimeError("Clarity原本ディレクトリがありません。")
    manifest = load_json(path / "manifest.json") or {}
    rows: list[dict[str, Any]] = []
    generated_at = str(manifest.get("generatedAtUtc") or "")
    snapshot_date = generated_at[:10] or None
    for csv_path in path.rglob("*.csv"):
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            csv_rows = list(csv.DictReader(handle))
        dataset = csv_path.relative_to(path).with_suffix("").as_posix()
        for raw_row in csv_rows:
            dimensions: dict[str, Any] = {}
            metrics: dict[str, Any] = {}
            for key, value in raw_row.items():
                parsed = numeric(value)
                if parsed is None:
                    dimensions[str(key)] = value
                else:
                    metrics[str(key)] = parsed
            rows.append(common_row(
                "clarity",
                dataset,
                snapshot_date,
                "rolling_24h",
                "last_72_hours_only",
                f"Clarity Data Export API: {csv_path.relative_to(path).as_posix()}",
                dimensions,
                metrics,
            ))
    return {
        "rows": rows,
        "manifest": manifest,
        "reports": {
            "snapshot": {
                "status": "complete" if manifest else "partial",
                "row_count": len(rows),
                "history_limit": "公式APIは直近72時間まで",
            }
        },
    }


def import_infrastructure(path: Path | None) -> dict[str, Any]:
    if path is None or not path.exists():
        raise RuntimeError("Cloud Run・Cloudflare指標JSONがありません。")
    payload = load_json(path)
    if not isinstance(payload, Mapping):
        raise RuntimeError("Cloud Run・Cloudflare指標JSONの形式が不正です。")
    generated = str(payload.get("generated_at") or payload.get("retrieved_at") or RETRIEVED_AT)
    metrics = {
        str(key): numeric(value)
        for key, value in payload.items()
        if numeric(value) is not None
    }
    row = common_row(
        "infrastructure",
        "cloud_run_cloudflare_7d",
        generated[:10],
        "UTC",
        "rolling_7d_snapshot",
        f"cloud_run_capacity.py: {path.name}",
        {
            "schema_version": payload.get("schema_version"),
            "required_services": payload.get("required_services"),
        },
        metrics,
        status="complete" if payload.get("cloud_run_metrics_available") else "partial",
    )
    return {
        "rows": [row],
        "reports": {
            "cloud_run_cloudflare_7d": {
                "status": row["status"],
                "row_count": 1,
            }
        },
    }


def source_summary(result: Mapping[str, Any]) -> dict[str, Any]:
    reports = dict(result.get("reports") or {})
    states = [str(report.get("status") or "unavailable") for report in reports.values()]
    if states and all(state == "complete" for state in states):
        status = "complete"
    elif any(state in {"complete", "partial"} for state in states):
        status = "partial"
    elif any(state == "failed" for state in states):
        status = "failed"
    else:
        status = "unavailable"
    return {
        "status": status,
        "row_count": len(result.get("rows") or []),
        "reports": reports,
    }


def run_source(
    name: str,
    collector: Callable[[], Mapping[str, Any]],
    source_results: dict[str, Any],
    source_status: dict[str, Any],
) -> None:
    try:
        result = dict(collector())
        source_results[name] = result
        source_status[name] = source_summary(result)
    except Exception as exc:
        source_results[name] = {"rows": [], "reports": {}}
        source_status[name] = {
            "status": "unavailable",
            "row_count": 0,
            "reason": safe_error(exc),
        }


def rows_for(
    history: Mapping[str, Any],
    source: str,
    dataset: str | None = None,
    period: Period | None = None,
) -> list[dict[str, Any]]:
    rows = []
    for row in history.get("rows") or []:
        if row.get("source") != source:
            continue
        if dataset is not None and row.get("dataset") != dataset:
            continue
        row_date = row.get("date")
        if period and row_date:
            parsed = date.fromisoformat(str(row_date)[:10])
            if parsed < period.start or parsed > period.end:
                continue
        rows.append(dict(row))
    return rows


def sum_metric(rows: Sequence[Mapping[str, Any]], metric: str) -> float | None:
    values = [numeric((row.get("metrics") or {}).get(metric)) for row in rows]
    present = [value for value in values if value is not None]
    return sum(present) if present else None


def average_metric(rows: Sequence[Mapping[str, Any]], metric: str) -> float | None:
    values = [numeric((row.get("metrics") or {}).get(metric)) for row in rows]
    present = [value for value in values if value is not None]
    return statistics.fmean(present) if present else None


def ga4_currency_code(history: Mapping[str, Any]) -> str | None:
    """GA4のプロパティ通貨を正規化行または取得詳細から解決する。"""

    row_codes = {
        str(row.get("source_currency") or "").upper()
        for row in history.get("rows") or []
        if row.get("source") == "ga4" and row.get("source_currency")
    }
    if len(row_codes) == 1:
        return next(iter(row_codes))
    details = (history.get("source_details") or {}).get("ga4") or {}
    direct = str(details.get("currency_code") or "").upper()
    if direct:
        return direct
    detail_codes = {
        str(value).upper()
        for value in details.get("currency_codes") or []
        if value
    }
    return next(iter(detail_codes)) if len(detail_codes) == 1 else None


def period_metrics(history: Mapping[str, Any], period: Period) -> dict[str, Any]:
    adsense = rows_for(history, "adsense", "daily", period)
    ga4 = rows_for(history, "ga4", "daily", period)
    gsc = rows_for(history, "gsc", "daily", period)
    github = rows_for(history, "github_actions", "workflow_runs", period)
    earnings = sum_metric(adsense, "estimated_earnings")
    ad_pv = sum_metric(adsense, "page_views")
    impressions = sum_metric(adsense, "impressions")
    sessions = sum_metric(ga4, "sessions")
    ga_pv = sum_metric(ga4, "screenPageViews")
    ga_revenue = sum_metric(ga4, "totalAdRevenue")
    ga_currency = ga4_currency_code(history)
    return {
        "start_date": period.start.isoformat(),
        "end_date": period.end.isoformat(),
        "adsense_revenue_jpy": earnings,
        "adsense_page_views": ad_pv,
        "adsense_impressions": impressions,
        "adsense_clicks": sum_metric(adsense, "clicks"),
        "page_rpm_jpy": earnings / ad_pv * 1000 if earnings is not None and ad_pv else None,
        "impressions_per_page_view": impressions / ad_pv if impressions is not None and ad_pv else None,
        "active_view_viewability": average_metric(adsense, "active_view_viewability"),
        "ga4_sessions": sessions,
        "ga4_page_views": ga_pv,
        "ga4_ad_revenue": ga_revenue,
        "ga4_revenue_currency": ga_currency,
        "ga4_ad_revenue_jpy": ga_revenue if ga_currency == "JPY" else None,
        "page_views_per_session": ga_pv / sessions if ga_pv is not None and sessions else None,
        "revenue_per_1000_sessions": earnings / sessions * 1000 if earnings is not None and sessions else None,
        "gsc_clicks": sum_metric(gsc, "clicks"),
        "gsc_impressions": sum_metric(gsc, "impressions"),
        "workflow_failures": sum_metric(github, "failed"),
        "date_coverage": {
            "adsense": sorted({row.get("date") for row in adsense if row.get("date")}),
            "ga4": sorted({row.get("date") for row in ga4 if row.get("date")}),
            "gsc": sorted({row.get("date") for row in gsc if row.get("date")}),
        },
    }


def pct_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous in {None, 0}:
        return None
    return current / previous - 1


def revenue_decomposition(
    current: Mapping[str, Any], previous: Mapping[str, Any]
) -> dict[str, Any]:
    current_sessions = numeric(current.get("ga4_sessions"))
    previous_sessions = numeric(previous.get("ga4_sessions"))
    current_pv_per_session = numeric(current.get("page_views_per_session"))
    previous_pv_per_session = numeric(previous.get("page_views_per_session"))
    current_revenue = numeric(current.get("adsense_revenue_jpy"))
    previous_revenue = numeric(previous.get("adsense_revenue_jpy"))
    current_ga4_pv = numeric(current.get("ga4_page_views"))
    previous_ga4_pv = numeric(previous.get("ga4_page_views"))
    current_revenue_per_pv = (
        current_revenue / current_ga4_pv
        if current_revenue is not None and current_ga4_pv
        else None
    )
    previous_revenue_per_pv = (
        previous_revenue / previous_ga4_pv
        if previous_revenue is not None and previous_ga4_pv
        else None
    )
    return {
        "identity": "AdSense収益 = GA4セッション × GA4 PV/セッション × AdSense収益/GA4 PV",
        "current": {
            "sessions": current_sessions,
            "page_views_per_session": current_pv_per_session,
            "revenue_per_page_view_jpy": current_revenue_per_pv,
        },
        "previous": {
            "sessions": previous_sessions,
            "page_views_per_session": previous_pv_per_session,
            "revenue_per_page_view_jpy": previous_revenue_per_pv,
        },
        "week_over_week": {
            "sessions": pct_change(current_sessions, previous_sessions),
            "page_views_per_session": pct_change(current_pv_per_session, previous_pv_per_session),
            "revenue_per_page_view": pct_change(current_revenue_per_pv, previous_revenue_per_pv),
            "revenue": pct_change(current_revenue, previous_revenue),
        },
        "note": "GA4とAdSenseのPV定義差を含むため、寄与の方向を見る診断値です。",
    }


def clarity_snapshot_summary(history: Mapping[str, Any]) -> dict[str, Any]:
    rows = [
        row for row in rows_for(history, "clarity")
        if str(row.get("dataset") or "").startswith("csv/overview/")
        or str(row.get("dataset") or "").startswith("overview/")
    ]

    def metric_from(suffix: str, name: str) -> float | None:
        for row in rows:
            if str(row.get("dataset") or "").endswith(suffix):
                return numeric((row.get("metrics") or {}).get(name))
        return None

    sessions = metric_from("08_Traffic", "totalSessionCount")
    bots = metric_from("08_Traffic", "totalBotSessionCount")
    total_time = metric_from("09_EngagementTime", "totalTime")
    active_time = metric_from("09_EngagementTime", "activeTime")
    return {
        "history_limit": "latest_72_hours",
        "sessions": sessions,
        "bot_sessions": bots,
        "human_session_estimate": sessions - bots if sessions is not None and bots is not None else None,
        "distinct_users": metric_from("08_Traffic", "distinctUserCount"),
        "dead_click_rate": (
            metric_from("01_DeadClickCount", "sessionsWithMetricPercentage") or 0
        ) / 100 if metric_from("01_DeadClickCount", "sessionsWithMetricPercentage") is not None else None,
        "quickback_rate": (
            metric_from("04_QuickbackClick", "sessionsWithMetricPercentage") or 0
        ) / 100 if metric_from("04_QuickbackClick", "sessionsWithMetricPercentage") is not None else None,
        "script_error_rate": (
            metric_from("05_ScriptErrorCount", "sessionsWithMetricPercentage") or 0
        ) / 100 if metric_from("05_ScriptErrorCount", "sessionsWithMetricPercentage") is not None else None,
        "rage_click_rate": (
            metric_from("03_RageClickCount", "sessionsWithMetricPercentage") or 0
        ) / 100 if metric_from("03_RageClickCount", "sessionsWithMetricPercentage") is not None else None,
        "average_scroll_depth": (
            metric_from("07_ScrollDepth", "averageScrollDepth") or 0
        ) / 100 if metric_from("07_ScrollDepth", "averageScrollDepth") is not None else None,
        "active_time_share": active_time / total_time if active_time is not None and total_time else None,
        "note": "Clarity公式APIの直近72時間スナップショットで、週次・累積値ではありません。",
    }


def search_opportunities(history: Mapping[str, Any], limit: int = 50) -> list[dict[str, Any]]:
    source_rows = rows_for(history, "gsc", "page_query_device")
    bands: dict[str, list[float]] = defaultdict(list)

    def band(position: float | None) -> str:
        if position is None:
            return "unknown"
        if position <= 3:
            return "1-3"
        if position <= 7:
            return "4-7"
        if position <= 10:
            return "8-10"
        if position <= 20:
            return "11-20"
        return "21+"

    for row in source_rows:
        ctr = numeric((row.get("metrics") or {}).get("ctr"))
        position = numeric((row.get("metrics") or {}).get("position"))
        if ctr is not None:
            bands[band(position)].append(ctr)
    medians = {name: statistics.median(values) for name, values in bands.items() if values}
    opportunities: list[dict[str, Any]] = []
    for row in source_rows:
        metrics = row.get("metrics") or {}
        dimensions = row.get("dimensions") or {}
        impressions = numeric(metrics.get("impressions")) or 0
        ctr = numeric(metrics.get("ctr")) or 0
        position = numeric(metrics.get("position"))
        benchmark = medians.get(band(position), ctr)
        missed = max(0.0, impressions * (benchmark - ctr))
        if missed <= 0:
            continue
        opportunities.append({
            "page": dimensions.get("page"),
            "query": dimensions.get("query"),
            "device": dimensions.get("device"),
            "clicks": numeric(metrics.get("clicks")) or 0,
            "impressions": impressions,
            "ctr": ctr,
            "position": position,
            "benchmark_ctr": benchmark,
            "estimated_missed_clicks": round(missed, 2),
        })
    opportunities.sort(key=lambda item: (-item["estimated_missed_clicks"], -item["impressions"]))
    return opportunities[:limit]


def git_first_commit_date(article_path: Path, repo_root: Path) -> str | None:
    try:
        completed = subprocess.run(
            [
                "git",
                "-c",
                f"safe.directory={repo_root.as_posix()}",
                "-C",
                str(repo_root),
                "log",
                "--follow",
                "--diff-filter=A",
                "--format=%aI",
                "--",
                str(article_path.relative_to(repo_root)),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    values = [line.strip() for line in completed.stdout.splitlines() if line.strip()]
    return values[-1][:10] if values else None


def load_grade_schedule(path: Path | None) -> list[dict[str, Any]]:
    payload = load_json(path)
    if isinstance(payload, list):
        return [dict(row) for row in payload if isinstance(row, Mapping)]
    if isinstance(payload, Mapping):
        for key in ("schedule_coverage", "races", "rows"):
            value = payload.get(key)
            if isinstance(value, list):
                return [dict(row) for row in value if isinstance(row, Mapping)]
    return []


def grade_race_publish_lead_days(
    grade: Any,
    circuit: Any,
    historical_impressions: Any = None,
    *,
    demand_profile_known: bool = False,
) -> int | None:
    """記事Plannerと同じ需要別の初回公開期限を返す。"""

    normalized_grade = re.sub(r"[\s　]+", "", str(grade or "")).upper()
    normalized_circuit = str(circuit or "").strip().lower()
    impressions = numeric(historical_impressions) or 0
    if normalized_grade in {"G1", "JPNI", "JPN1"}:
        return 21
    if normalized_grade in {"G2", "JPNII", "JPN2"}:
        return 14
    if normalized_circuit == "jra" and normalized_grade == "G3":
        return 10
    if impressions >= 300:
        return 9
    if demand_profile_known and impressions < 50:
        return None
    return 3


def grade_article_weekly_replacement(
    history: Mapping[str, Any],
    articles: Sequence[Mapping[str, Any]],
    current_period: Period,
    previous_period: Period,
) -> dict[str, Any]:
    """前週で終了した重賞記事流入を今週の記事が置換できた割合を算出する。"""

    grade_urls = {
        str(row.get("canonical_url") or "").rstrip("/")
        for row in articles
        if row.get("canonical_url")
    }
    grade_slugs = {
        str(row.get("source_slug") or "")
        for row in articles
        if row.get("source_slug")
    }

    def aggregate(period: Period) -> tuple[float, dict[str, float]]:
        by_page: dict[str, float] = defaultdict(float)
        for row in rows_for(history, "gsc", "page_daily", period):
            page = str((row.get("dimensions") or {}).get("page") or "").rstrip("/")
            if page not in grade_urls and not any(slug and f"/articles/{slug}" in page for slug in grade_slugs):
                continue
            by_page[page] += numeric((row.get("metrics") or {}).get("clicks")) or 0
        return sum(by_page.values()), by_page

    current_clicks, current_pages = aggregate(current_period)
    previous_clicks, previous_pages = aggregate(previous_period)
    replacement_rate = current_clicks / previous_clicks if previous_clicks else None
    losses = sorted(
        (
            {"page": page, "lost_clicks": previous - current_pages.get(page, 0)}
            for page, previous in previous_pages.items()
            if previous > current_pages.get(page, 0)
        ),
        key=lambda row: -row["lost_clicks"],
    )
    gains = sorted(
        (
            {"page": page, "gained_clicks": current - previous_pages.get(page, 0)}
            for page, current in current_pages.items()
            if current > previous_pages.get(page, 0)
        ),
        key=lambda row: -row["gained_clicks"],
    )
    return {
        "definition": "対象週の重賞記事GSCクリック ÷ 前週の重賞記事GSCクリック",
        "current_grade_article_clicks": current_clicks,
        "previous_grade_article_clicks": previous_clicks,
        "replacement_rate": replacement_rate,
        "unreplaced_clicks": max(0.0, previous_clicks - current_clicks),
        "top_expired_or_lost_pages": losses[:10],
        "top_new_or_gained_pages": gains[:10],
        "target_rate": 0.5,
        "status": (
            "unavailable" if replacement_rate is None
            else "healthy" if replacement_rate >= 0.5
            else "critical" if replacement_rate < 0.2
            else "review"
        ),
        "caveat": "開催日・レース規模による需要差を含むため、記事障害だけの因果効果ではありません。",
    }


def workflow_failure_impact(
    history: Mapping[str, Any],
    period: Period,
) -> dict[str, Any]:
    jobs = (history.get("source_details") or {}).get("github_actions", {}).get("failure_jobs", [])
    relevant = []
    for job in jobs:
        created = str(job.get("created_at") or "")[:10]
        if not created:
            continue
        parsed = date.fromisoformat(created)
        if period.start <= parsed <= period.end:
            relevant.append(dict(job))
    failed = [
        job for job in relevant
        if not job.get("conclusion")
        or str(job.get("conclusion")).lower() in {"failure", "cancelled", "timed_out", "action_required"}
    ]

    def run_key(job: Mapping[str, Any]) -> str:
        return str(
            job.get("run_id")
            or job.get("url")
            or f"{job.get('workflow')}::{job.get('created_at')}"
        )

    article_failures = [job for job in failed if job.get("workflow") == "Keiba Article Auto Pipeline"]
    draft_failures = [
        job for job in article_failures
        if any("Generate Draft and Review" in str(step) for step in job.get("failed_steps") or [])
    ]
    failed_runs = {run_key(job) for job in failed}
    article_failure_runs = {run_key(job) for job in article_failures}
    draft_failure_runs = {run_key(job) for job in draft_failures}
    return {
        "all_failure_jobs": len(failed),
        "all_failure_runs": len(failed_runs),
        "article_pipeline_failures": len(article_failure_runs),
        "draft_review_failures": len(draft_failure_runs),
        "ignored_nonfailure_job_rows": len(relevant) - len(failed),
        "failure_jobs": failed,
        "article_failure_dates": sorted({str(job.get("created_at"))[:10] for job in article_failures}),
        "repeated_draft_review_failure": len(draft_failure_runs) >= 2,
        "note": "失敗日と流入減の同時発生は因果確定ではなく、公開欠損と合わせて評価します。",
    }


def traffic_cross_analysis(
    history: Mapping[str, Any],
    current_period: Period,
    previous_period: Period,
) -> dict[str, Any]:
    def summarize(period: Period) -> dict[str, float]:
        result: dict[str, float] = defaultdict(float)
        for row in rows_for(history, "ga4", "acquisition", period):
            dimensions = row.get("dimensions") or {}
            metrics = row.get("metrics") or {}
            channel = str(dimensions.get("sessionDefaultChannelGroup") or "")
            source_medium = str(dimensions.get("sessionSourceMedium") or "").lower()
            sessions = numeric(metrics.get("sessions")) or 0
            result[f"channel::{channel}"] += sessions
            if "youtube" in source_medium:
                result["source::youtube"] += sessions
                campaign = str(dimensions.get("sessionCampaignName") or "").strip().lower()
                if campaign and campaign not in {"(not set)", "(direct)"}:
                    result["source::youtube_attributed"] += sessions
            if any(platform in source_medium for platform in ("twitter", "t.co", "threads", "bluesky", "facebook", "instagram")):
                result["source::social"] += sessions
                campaign = str(dimensions.get("sessionCampaignName") or "").strip().lower()
                if campaign and campaign not in {"(not set)", "(direct)"}:
                    result["source::social_attributed"] += sessions
        for row in rows_for(history, "ga4", "campaign_attribution", period):
            serialized = json.dumps(row.get("dimensions") or {}, ensure_ascii=False).lower()
            metrics = row.get("metrics") or {}
            if "youtube" in serialized or "daily_race_video" in serialized:
                result["campaign::youtube_events"] += numeric(metrics.get("eventCount")) or 0
                result["campaign::youtube_users"] += numeric(metrics.get("totalUsers")) or 0
            if any(platform in serialized for platform in ("race_post_v2", "twitter", "threads", "bluesky")):
                result["campaign::social_events"] += numeric(metrics.get("eventCount")) or 0
                result["campaign::social_users"] += numeric(metrics.get("totalUsers")) or 0
        for row in rows_for(history, "youtube", "daily", period):
            result["youtube_views"] += numeric((row.get("metrics") or {}).get("views")) or 0
            result["youtube_watch_minutes"] += numeric((row.get("metrics") or {}).get("estimatedMinutesWatched")) or 0
        for row in rows_for(history, "adsense", "traffic_source", period):
            if "youtube" not in json.dumps(row.get("dimensions") or {}, ensure_ascii=False).lower():
                continue
            result["youtube_adsense_revenue_jpy"] += numeric((row.get("metrics") or {}).get("estimated_earnings")) or 0
        return dict(result)

    current = summarize(current_period)
    previous = summarize(previous_period)
    keys = sorted(set(current) | set(previous))
    youtube_sessions = current.get("source::youtube", 0)
    youtube_attributed = current.get("source::youtube_attributed", 0)
    social_sessions = current.get("source::social", 0)
    social_attributed = current.get("source::social_attributed", 0)
    return {
        "current": current,
        "previous": previous,
        "week_over_week": {
            key: pct_change(current.get(key), previous.get(key))
            for key in keys
        },
        "youtube_site_recovery": {
            "organic_video_sessions": current.get("channel::Organic Video", 0),
            "youtube_source_sessions": current.get("source::youtube", 0),
            "youtube_views": current.get("youtube_views", 0),
            "utm_attributed_sessions": youtube_attributed,
            "utm_missing_rate": (
                max(0.0, 1 - youtube_attributed / youtube_sessions)
                if youtube_sessions else None
            ),
            "attributed_entry_events": current.get("campaign::youtube_events", 0),
            "attributed_entry_users": current.get("campaign::youtube_users", 0),
            "race_funnel_attribution_status": (
                "available" if current.get("campaign::youtube_events", 0) > 0 else "unavailable"
            ),
            "site_recovery_supported": current.get("source::youtube", 0) >= 50,
            "minimum_weekly_site_sessions": 50,
        },
        "social_site_attribution": {
            "social_source_sessions": social_sessions,
            "utm_attributed_sessions": social_attributed,
            "utm_missing_rate": (
                max(0.0, 1 - social_attributed / social_sessions)
                if social_sessions else None
            ),
            "attributed_entry_events": current.get("campaign::social_events", 0),
            "attributed_entry_users": current.get("campaign::social_users", 0),
        },
    }


def assess_grade_races(
    history: Mapping[str, Any],
    inventory_path: Path | None,
    schedule_path: Path | None,
    repo_root: Path,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    inventory_payload = load_json(inventory_path) or {}
    articles = [
        dict(row) for row in inventory_payload.get("articles") or []
        if isinstance(row, Mapping) and row.get("entity_type") == "grade_race"
    ]
    schedule = load_grade_schedule(schedule_path)
    by_key_date = {
        (str(row.get("entity_key") or ""), str(row.get("scheduled_race_date") or "")[:10]): row
        for row in articles
        if row.get("entity_key") and row.get("scheduled_race_date")
    }
    for article in articles:
        key = (str(article.get("entity_key") or ""), str(article.get("scheduled_race_date") or "")[:10])
        if key not in {(str(row.get("entity_key") or ""), str(row.get("race_date") or row.get("scheduled_race_date") or "")[:10]) for row in schedule}:
            schedule.append({
                "entity_key": key[0],
                "race_name": article.get("title"),
                "race_date": key[1],
                "grade": "",
                "circuit": "",
                "schedule_source": "article_inventory",
            })

    gsc_page_rows = rows_for(history, "gsc", "page_daily")
    ga4_landing_rows = rows_for(history, "ga4", "landing_device")
    ga4_funnel_rows = rows_for(history, "ga4", "article_funnel")
    ga4_currency = ga4_currency_code(history)
    results: list[dict[str, Any]] = []
    for race in schedule:
        race_date_text = str(race.get("race_date") or race.get("scheduled_race_date") or "")[:10]
        try:
            race_date = date.fromisoformat(race_date_text)
        except ValueError:
            continue
        if race_date < BUSINESS_START_DATE:
            continue
        entity_key = str(race.get("entity_key") or "")
        article = by_key_date.get((entity_key, race_date_text))
        canonical = str((article or {}).get("canonical_url") or "")
        source_slug = str((article or {}).get("source_slug") or "")
        article_path = next(iter((repo_root / "frontend" / "content" / "articles").rglob(f"{source_slug}.md")), None) if source_slug else None
        first_commit = git_first_commit_date(article_path, repo_root) if article_path else None
        event_period = Period(max(BUSINESS_START_DATE, race_date - timedelta(days=21)), race_date + timedelta(days=3))
        gsc_rows = [
            row for row in gsc_page_rows
            if canonical and str((row.get("dimensions") or {}).get("page") or "").rstrip("/") == canonical.rstrip("/")
            and row.get("date") and event_period.start <= date.fromisoformat(str(row["date"])[:10]) <= event_period.end
        ]
        ga_rows = [
            row for row in ga4_landing_rows
            if source_slug and source_slug in str((row.get("dimensions") or {}).get("landingPagePlusQueryString") or "")
            and row.get("date") and event_period.start <= date.fromisoformat(str(row["date"])[:10]) <= event_period.end
        ]
        funnel_rows = [
            row for row in ga4_funnel_rows
            if source_slug and source_slug in str((row.get("dimensions") or {}).get("pagePath") or "")
            and row.get("date") and event_period.start <= date.fromisoformat(str(row["date"])[:10]) <= event_period.end
        ]
        funnel_counts: dict[str, float] = defaultdict(float)
        for row in funnel_rows:
            event_name = str((row.get("dimensions") or {}).get("eventName") or "")
            funnel_counts[event_name] += numeric((row.get("metrics") or {}).get("eventCount")) or 0
        impressions = sum_metric(gsc_rows, "impressions") or 0
        clicks = sum_metric(gsc_rows, "clicks") or 0
        sessions = sum_metric(ga_rows, "sessions") or 0
        revenue = sum_metric(ga_rows, "totalAdRevenue")
        demand_profile = race.get("search_demand") if isinstance(race.get("search_demand"), Mapping) else {}
        demand_keys = (
            "historical_impressions",
            "past_gsc_impressions",
            "gsc_impressions",
            "impressions",
        )
        historical_impressions = next(
            (
                race.get(key)
                for key in demand_keys
                if race.get(key) is not None
            ),
            demand_profile.get("impressions"),
        )
        demand_profile_known = bool(demand_profile) or any(race.get(key) is not None for key in demand_keys)
        initial_lead_days = grade_race_publish_lead_days(
            race.get("grade"),
            race.get("circuit"),
            historical_impressions,
            demand_profile_known=demand_profile_known,
        )
        expected_by = race_date - timedelta(days=initial_lead_days) if initial_lead_days is not None else None
        if initial_lead_days is None:
            classification = "記事対象外（過去需要50未満）" if article is None else "需要対象外だが記事あり"
        elif article is None:
            classification = "記事なし"
        elif first_commit and expected_by and date.fromisoformat(first_commit) > expected_by:
            classification = "公開が遅い"
        elif impressions <= 0:
            classification = "公開済みだが検索表示なし"
        elif clicks / impressions < 0.02:
            classification = "表示はあるがCTR不足"
        elif sessions <= 0:
            classification = "検索流入はあるがGA4到達未確認"
        elif funnel_rows and funnel_counts.get("article_race_click", 0) <= 0:
            classification = "流入はあるがレース遷移不足"
        elif revenue in {None, 0}:
            classification = "流入はあるが収益効率不足"
        else:
            classification = "検索・回遊・収益が良好"
        results.append({
            "entity_key": entity_key,
            "race_name": race.get("race_name") or race.get("name") or (article or {}).get("title"),
            "race_date": race_date_text,
            "grade": race.get("grade"),
            "circuit": race.get("circuit"),
            "schedule_source": race.get("schedule_source") or "schedule_input",
            "article_url": canonical,
            "article_slug": source_slug,
            "first_commit_date": first_commit,
            "initial_publish_lead_days": initial_lead_days,
            "expected_initial_publish_date": expected_by.isoformat() if expected_by else None,
            "historical_gsc_impressions": numeric(historical_impressions),
            "demand_profile_known": demand_profile_known,
            "gsc_impressions_d21_d3": impressions,
            "gsc_clicks_d21_d3": clicks,
            "gsc_ctr_d21_d3": clicks / impressions if impressions else None,
            "ga4_sessions_d21_d3": sessions,
            "ga4_ad_revenue_d21_d3": revenue,
            "ga4_revenue_currency": ga4_currency,
            "article_read_complete_d21_d3": funnel_counts.get("article_read_complete"),
            "article_race_click_d21_d3": funnel_counts.get("article_race_click"),
            "prediction_table_view_d21_d3": funnel_counts.get("prediction_table_view"),
            "ad_impression_d21_d3": funnel_counts.get("ad_impression_custom"),
            "classification": classification,
        })
    results.sort(key=lambda row: (row["race_date"], str(row.get("race_name") or "")))
    benchmark_metrics = ("gsc_impressions_d21_d3", "gsc_clicks_d21_d3", "ga4_sessions_d21_d3", "ga4_ad_revenue_d21_d3")
    by_grade: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in results:
        by_grade[str(row.get("grade") or "未分類")].append(row)
    for row in results:
        peers = by_grade[str(row.get("grade") or "未分類")]
        medians: dict[str, float | None] = {}
        for metric_name in benchmark_metrics:
            values = [numeric(peer.get(metric_name)) for peer in peers]
            present = [value for value in values if value is not None]
            medians[metric_name] = statistics.median(present) if present else None
        row["benchmark"] = {
            "peer_definition": "同一gradeの取得済み重賞中央値",
            **medians,
        }
    return results, {
        "inventory_grade_articles": len(articles),
        "schedule_rows": len(schedule),
        "assessment_rows": len(results),
        "missing_article_detection": "complete" if schedule_path and schedule else "partial",
        "note": "外部日程入力がない場合、記事台帳に存在する重賞だけを評価します。",
    }


def rank_root_causes(
    source_status: Mapping[str, Any],
    current: Mapping[str, Any],
    previous: Mapping[str, Any],
    grade_rows: Sequence[Mapping[str, Any]],
    search_rows: Sequence[Mapping[str, Any]],
    clarity: Mapping[str, Any] | None = None,
    grade_replacement: Mapping[str, Any] | None = None,
    workflow_impact: Mapping[str, Any] | None = None,
    traffic_cross: Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    causes: list[dict[str, Any]] = []
    core_sources = ("adsense", "ga4", "gsc")
    unavailable = [
        name for name in core_sources
        if (source_status.get(name) or {}).get("status") in {"failed", "unavailable"}
        or (
            (source_status.get(name) or {}).get("status") == "partial"
            and not (source_status.get(name) or {}).get("row_count")
        )
    ]
    if unavailable:
        causes.append({
            "priority": 1,
            "category": "data_quality",
            "hypothesis": "主要媒体の欠損により収益変動の帰属が不完全",
            "confidence": "high",
            "evidence": f"取得不能または実質空の主要媒体: {', '.join(unavailable)}",
            "counterevidence": "取得済み媒体の合計値は引き続き利用可能",
            "recommended_action": "欠損媒体の読取権限または原本を復旧する",
        })

    replacement = grade_replacement or {}
    replacement_rate = numeric(replacement.get("replacement_rate"))
    previous_grade_clicks = numeric(replacement.get("previous_grade_article_clicks")) or 0
    if replacement_rate is not None and previous_grade_clicks >= 10 and replacement_rate < 0.5:
        repeated_failures = bool((workflow_impact or {}).get("repeated_draft_review_failure"))
        causes.append({
            "priority": 2,
            "category": "grade_race_replacement",
            "hypothesis": "終了した重賞記事の検索流入を次の重賞記事で補充できず、週次収益の基礎流入が縮小した",
            "confidence": "high" if repeated_failures else "medium",
            "evidence": (
                f"重賞記事クリック補充率 {replacement_rate:.1%}"
                f"（前週 {previous_grade_clicks:.0f}件 → 対象週 "
                f"{numeric(replacement.get('current_grade_article_clicks')) or 0:.0f}件）、"
                f"未補充 {numeric(replacement.get('unreplaced_clicks')) or 0:.0f}件。"
                f"記事Draft/Review失敗 {int((workflow_impact or {}).get('draft_review_failures') or 0)}件"
            ),
            "counterevidence": "レースごとの需要規模と開催週の季節性が異なるため、障害だけの因果効果とは断定しない",
            "recommended_action": "需要別公開期限を過ぎた重賞の未処理WriteOrderを1件ずつ復旧し、翌週の補充率を再測定する",
        })

    workflow_failures = (workflow_impact or {}).get("article_pipeline_failures") or current.get("workflow_failures") or 0
    if workflow_failures:
        causes.append({
            "priority": 3,
            "category": "reliability",
            "hypothesis": "自動運用失敗が記事・SNS・動画の流入機会を減らした可能性",
            "confidence": "high" if (workflow_impact or {}).get("repeated_draft_review_failure") else "medium",
            "evidence": (
                f"対象週の記事Workflow失敗: {float(workflow_failures):.0f}件 / "
                f"Draft・Review失敗: {int((workflow_impact or {}).get('draft_review_failures') or 0)}件"
            ),
            "counterevidence": "失敗と収益低下の同時発生だけでは因果は確定できない",
            "recommended_action": "課金枯渇時の回路遮断と未処理WriteOrder保持を確認し、復旧後に古い高優先注文から再開する",
        })
    script_error_rate = numeric((clarity or {}).get("script_error_rate"))
    if script_error_rate is not None and script_error_rate >= 0.01:
        causes.append({
            "priority": 3,
            "category": "reliability",
            "hypothesis": "画面内スクリプトエラーが回遊を阻害している可能性",
            "confidence": "medium",
            "evidence": f"Clarity直近72時間のScriptErrorセッション率: {script_error_rate:.2%}",
            "counterevidence": "Clarityは72時間スナップショットであり、収益対象週全体ではない",
            "recommended_action": "該当録画・URLとCloud Runリリース時刻を照合する",
        })
    grade_misses = [row for row in grade_rows if row.get("classification") in {"記事なし", "公開が遅い", "公開済みだが検索表示なし"}]
    if grade_misses:
        causes.append({
            "priority": 4,
            "category": "grade_race_coverage",
            "hypothesis": "重賞日程に対する公開時期または検索露出が不足",
            "confidence": "medium",
            "evidence": f"未達重賞: {len(grade_misses)}件",
            "counterevidence": "検索需要が小さいレースでは記事不足が収益要因とは限らない",
            "recommended_action": "需要の大きい未達重賞1件だけを次週候補にする",
        })
    if search_rows:
        top = search_rows[0]
        causes.append({
            "priority": 5,
            "category": "search_ctr",
            "hypothesis": "上位表示済みページのCTR不足で検索流入を取りこぼしている",
            "confidence": "medium",
            "evidence": f"推定逸失クリック最大: {top.get('estimated_missed_clicks', 0):.1f}件 / {top.get('page')}",
            "counterevidence": "順位帯中央値との差は因果効果ではなく改善余地の推定",
            "recommended_action": "既存URL1件の検索意図とスニペットを限定監査する",
        })

    youtube_recovery = (traffic_cross or {}).get("youtube_site_recovery") or {}
    traffic_wow = (traffic_cross or {}).get("week_over_week") or {}
    youtube_view_change = numeric(traffic_wow.get("youtube_views"))
    if youtube_view_change is not None and youtube_view_change > 0 and not youtube_recovery.get("site_recovery_supported"):
        causes.append({
            "priority": 4,
            "category": "video_conversion",
            "hypothesis": "YouTube視聴は増えているが、サイト流入は検索減を埋める規模に達していない",
            "confidence": "high",
            "evidence": (
                f"YouTube視聴前週比 {youtube_view_change:.1%}、"
                f"YouTube参照セッション {numeric(youtube_recovery.get('youtube_source_sessions')) or 0:.0f}件"
            ),
            "counterevidence": "参照元が渡らない遷移と従来のUTMなしリンクは過小計測になり得る",
            "recommended_action": "新規動画URLへ固定UTMを付け、トップ→race_view→prediction_table_viewの到達率を週次比較する",
        })
    revenue_change = pct_change(
        numeric(current.get("adsense_revenue_jpy")),
        numeric(previous.get("adsense_revenue_jpy")),
    )
    if revenue_change is not None and revenue_change < -0.1:
        causes.append({
            "priority": 6,
            "category": "revenue_efficiency",
            "hypothesis": "流入量または広告効率の低下で週次収益が減少",
            "confidence": "high",
            "evidence": f"前週比 {revenue_change:.1%}",
            "counterevidence": "曜日・開催・端末構成の差を分解してから施策判断が必要",
            "recommended_action": "PV、PV/セッション、収益/PVの寄与を分解する",
        })
    causes.sort(key=lambda row: (row["priority"], row["category"]))
    return causes[:5]


def build_analysis(
    history: Mapping[str, Any],
    week_ending: date,
    inventory_path: Path | None,
    schedule_path: Path | None,
    repo_root: Path,
) -> dict[str, Any]:
    if week_ending.weekday() != 6:
        raise ValueError("week-endingは日曜日を指定してください。")
    if week_ending < date(2026, 3, 22):
        raise ValueError("最初の完全週は2026-03-16〜2026-03-22です。")
    current_period = Period(week_ending - timedelta(days=6), week_ending)
    previous_period = Period(
        max(BUSINESS_START_DATE, week_ending - timedelta(days=13)),
        week_ending - timedelta(days=7),
    )
    trend_period = Period(max(BUSINESS_START_DATE, week_ending - timedelta(days=27)), week_ending)
    cumulative_period = Period(BUSINESS_START_DATE, week_ending)
    current = period_metrics(history, current_period)
    previous = period_metrics(history, previous_period)
    trend = period_metrics(history, trend_period)
    cumulative = period_metrics(history, cumulative_period)
    expected_dates = {(current_period.start + timedelta(days=index)).isoformat() for index in range(7)}
    coverage = current["date_coverage"]
    formal_sources = {
        source: set(coverage.get(source) or []) == expected_dates
        for source in ("adsense", "ga4", "gsc")
    }
    grade_rows, grade_quality = assess_grade_races(
        history, inventory_path, schedule_path, repo_root
    )
    inventory_payload = load_json(inventory_path) or {}
    grade_articles = [
        dict(row)
        for row in inventory_payload.get("articles") or []
        if isinstance(row, Mapping) and row.get("entity_type") == "grade_race"
    ] if isinstance(inventory_payload, Mapping) else []
    grade_replacement = grade_article_weekly_replacement(
        history, grade_articles, current_period, previous_period
    )
    workflow_impact = workflow_failure_impact(history, current_period)
    traffic_cross = traffic_cross_analysis(history, current_period, previous_period)
    opportunities = search_opportunities(history)
    clarity = clarity_snapshot_summary(history)
    root_causes = rank_root_causes(
        history.get("source_status") or {},
        current,
        previous,
        grade_rows,
        opportunities,
        clarity,
        grade_replacement,
        workflow_impact,
        traffic_cross,
    )
    adsense_revenue = numeric(current.get("adsense_revenue_jpy"))
    ga4_revenue = numeric(current.get("ga4_ad_revenue"))
    ga4_currency = str(current.get("ga4_revenue_currency") or "") or None
    currencies_comparable = ga4_currency == "JPY"
    revenue_gap = (
        abs(adsense_revenue - ga4_revenue) / adsense_revenue
        if currencies_comparable and adsense_revenue not in {None, 0} and ga4_revenue is not None
        else None
    )
    previous_gsc_clicks = numeric(previous.get("gsc_clicks"))
    previous_adsense_revenue = numeric(previous.get("adsense_revenue_jpy"))
    revenue_per_gsc_click = (
        previous_adsense_revenue / previous_gsc_clicks
        if previous_adsense_revenue is not None and previous_gsc_clicks not in {None, 0}
        else None
    )
    unreplaced_grade_clicks = numeric(grade_replacement.get("unreplaced_clicks"))
    grade_opportunity = {
        "estimated_revenue_jpy": (
            unreplaced_grade_clicks * revenue_per_gsc_click
            if unreplaced_grade_clicks is not None and revenue_per_gsc_click is not None
            else None
        ),
        "unreplaced_grade_article_clicks": unreplaced_grade_clicks,
        "previous_week_revenue_per_gsc_click_jpy": revenue_per_gsc_click,
        "method": "未補充重賞記事クリック × 前週AdSense収益/GSCクリック",
        "confidence": "low",
        "caveat": "検索クリック以外の流入とレース需要差を含む粗い機会推定で、予測収益ではありません。",
    }
    return {
        "schema_version": ANALYSIS_VERSION,
        "generated_at": RETRIEVED_AT,
        "business_boundaries": {
            "revenue_start": BUSINESS_START_DATE.isoformat(),
            "ga4_adsense_link_start": GA4_ADSENSE_LINK_DATE.isoformat(),
            "first_complete_week_start": FIRST_COMPLETE_WEEK_START.isoformat(),
        },
        "formal_week": {
            "start_date": current_period.start.isoformat(),
            "end_date": current_period.end.isoformat(),
            "formal": all(formal_sources.values()),
            "source_date_completeness": formal_sources,
            "expected_dates": sorted(expected_dates),
        },
        "current_week": current,
        "previous_week": previous,
        "rolling_28_days": trend,
        "cumulative_since_2026_03_14": cumulative,
        "week_over_week": {
            key: pct_change(numeric(current.get(key)), numeric(previous.get(key)))
            for key in (
                "adsense_revenue_jpy",
                "adsense_page_views",
                "page_rpm_jpy",
                "ga4_sessions",
                "ga4_page_views",
                "gsc_clicks",
                "gsc_impressions",
            )
        },
        "revenue_decomposition": revenue_decomposition(current, previous),
        "clarity_72h_snapshot": clarity,
        "revenue_reconciliation": {
            "adsense_revenue_jpy": adsense_revenue,
            "ga4_ad_revenue": ga4_revenue,
            "ga4_revenue_currency": ga4_currency,
            "ga4_ad_revenue_jpy": ga4_revenue if currencies_comparable else None,
            "difference_rate": revenue_gap,
            "status": (
                "currency_mismatch"
                if ga4_revenue is not None and not currencies_comparable
                else "review"
                if revenue_gap is not None and revenue_gap > 0.05
                else "ok"
                if revenue_gap is not None
                else "unavailable"
            ),
            "rule": "同一通貨の場合のみ比較し、5%超は失敗ではなく要照合",
            "note": (
                "GA4はプロパティ通貨の帰属分析値、AdSenseはJPYの収益正本です。"
                "通貨不一致時は為替換算なしで差分率を算出しません。"
            ),
        },
        "search_opportunities": opportunities,
        "grade_race_assessment": grade_rows,
        "grade_race_quality": grade_quality,
        "grade_article_weekly_replacement": grade_replacement,
        "estimated_grade_article_opportunity": grade_opportunity,
        "workflow_failure_impact": workflow_impact,
        "traffic_cross_analysis": traffic_cross,
        "github_failure_jobs": workflow_impact.get("failure_jobs") or [],
        "root_causes": root_causes,
        "selected_hypothesis": root_causes[0] if root_causes else None,
        "automatic_action": "none",
        "safe_local_action_policy": {
            "maximum_changes_per_week": 1,
            "allowed": [
                "分析・取得・計測コードの不具合修正",
                "イベント名を変えない計測欠損修正",
                "根拠が確認できた重賞日程・識別台帳修正",
                "既存記事1件のtitle・description・導入・既存H2限定修正",
            ],
            "forbidden": [
                "広告配置・広告数変更",
                "アフィリエイトURL変更",
                "外部投稿・記事公開",
                "本番DB・Secrets変更",
                "git commit・push・deploy",
            ],
        },
        "source_status": history.get("source_status") or {},
    }


def render_markdown(analysis: Mapping[str, Any]) -> str:
    formal = analysis.get("formal_week") or {}
    current = analysis.get("current_week") or {}
    previous = analysis.get("previous_week") or {}
    wow = analysis.get("week_over_week") or {}

    def value(name: str, suffix: str = "") -> str:
        raw = current.get(name)
        return "未取得" if raw is None else f"{raw:,.2f}{suffix}"

    lines = [
        "# UMA-FREE 週次収益改善サイクル",
        "",
        f"- 対象週: {formal.get('start_date')}〜{formal.get('end_date')}",
        f"- 正式週: {'はい' if formal.get('formal') else 'いいえ（参考集計）'}",
        "- 収益開始日: 2026-03-14 / GA4–AdSense連携境界: 2026-03-15",
        "",
        "## 主要指標",
        "",
        "| 指標 | 対象週 | 前週 | 変化率 |",
        "| --- | ---: | ---: | ---: |",
    ]
    labels = {
        "adsense_revenue_jpy": "AdSense推定収益（円）",
        "adsense_page_views": "AdSense PV",
        "page_rpm_jpy": "Page RPM（円）",
        "ga4_sessions": "GA4セッション",
        "ga4_page_views": "GA4 PV",
        "gsc_clicks": "GSCクリック",
        "gsc_impressions": "GSC表示",
    }
    for key, label in labels.items():
        current_value = current.get(key)
        previous_value = previous.get(key)
        change = wow.get(key)
        lines.append(
            f"| {label} | {'未取得' if current_value is None else f'{current_value:,.2f}'} | "
            f"{'未取得' if previous_value is None else f'{previous_value:,.2f}'} | "
            f"{'未取得' if change is None else f'{change:.1%}'} |"
        )
    replacement = analysis.get("grade_article_weekly_replacement") or {}
    workflow_impact = analysis.get("workflow_failure_impact") or {}
    youtube_recovery = ((analysis.get("traffic_cross_analysis") or {}).get("youtube_site_recovery") or {})
    opportunity = analysis.get("estimated_grade_article_opportunity") or {}
    reconciliation = analysis.get("revenue_reconciliation") or {}
    replacement_rate = numeric(replacement.get("replacement_rate"))
    estimated_revenue = numeric(opportunity.get("estimated_revenue_jpy"))
    youtube_utm_missing = numeric(youtube_recovery.get("utm_missing_rate"))
    lines.extend([
        "",
        "## 重賞記事の週次補充と障害影響",
        "",
        f"- 重賞記事GSCクリック: 前週 {numeric(replacement.get('previous_grade_article_clicks')) or 0:,.0f}件 → 対象週 {numeric(replacement.get('current_grade_article_clicks')) or 0:,.0f}件",
        f"- 週次補充率: {'未取得' if replacement_rate is None else f'{replacement_rate:.1%}'}（目安50%以上）",
        f"- 記事Pipeline失敗: {int(workflow_impact.get('article_pipeline_failures') or 0)}件 / Draft・Review失敗: {int(workflow_impact.get('draft_review_failures') or 0)}件",
        f"- 粗い収益機会推定: {'未取得' if estimated_revenue is None else f'{estimated_revenue:,.0f}円'}（予測値ではなく、前週の収益/GSCクリックによる参考値）",
        "",
        "## YouTubeからサイトへの回復寄与",
        "",
        f"- YouTube視聴: {numeric(youtube_recovery.get('youtube_views')) or 0:,.0f}回",
        f"- YouTube参照セッション: {numeric(youtube_recovery.get('youtube_source_sessions')) or 0:,.0f}件",
        f"- YouTube UTM欠損率: {'未取得' if youtube_utm_missing is None else format(youtube_utm_missing, '.1%')}",
        f"- YouTube→レース到達の媒体帰属: {youtube_recovery.get('race_funnel_attribution_status') or 'unavailable'}",
        f"- 週50セッションの暫定確認線: {'到達' if youtube_recovery.get('site_recovery_supported') else '未到達'}",
        "- 動画視聴の増加だけでは検索流入減の代替を意味しません。トップ到達後のrace_view・prediction_table_viewまで確認します。",
        "",
        "## 収益値の扱い",
        "",
        f"- AdSense収益正本: {numeric(reconciliation.get('adsense_revenue_jpy')) or 0:,.0f}円",
        f"- GA4広告収益（帰属分析値）: {numeric(reconciliation.get('ga4_ad_revenue')) or 0:,.2f} {reconciliation.get('ga4_revenue_currency') or '通貨未取得'}",
        f"- 照合状態: {reconciliation.get('status') or 'unavailable'}",
        "- 通貨が異なる場合、為替換算なしの差分率は算出しません。",
    ])
    lines.extend(["", "## 原因候補", ""])
    for index, cause in enumerate(analysis.get("root_causes") or [], start=1):
        lines.append(
            f"{index}. **{cause.get('hypothesis')}**（確信度: {cause.get('confidence')}）  "
            f"根拠: {cause.get('evidence')} / 反証: {cause.get('counterevidence')}"
        )
    if not analysis.get("root_causes"):
        lines.append("- 判断可能な原因候補はありません。")
    lines.extend(["", "## 今週の1仮説", ""])
    selected = analysis.get("selected_hypothesis")
    if selected:
        lines.append(f"- {selected.get('hypothesis')}")
        lines.append(f"- 次の安全な確認: {selected.get('recommended_action')}")
    else:
        lines.append("- データ取得を優先し、変更は行いません。")
    lines.extend(["", "## 取得品質", ""])
    for source, status in (analysis.get("source_status") or {}).items():
        lines.append(f"- {source}: `{status.get('status')}`（{status.get('row_count', 0)}行）")
    lines.extend([
        "",
        "このレポートは相関と因果を分けて扱います。広告設定、公開、外部投稿、Git操作は自動変更しません。",
        "",
    ])
    return "\n".join(lines)


def deduplicate_history_rows(rows: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """再実行・ページ境界の重複を同一の正規化内容で除去する。"""

    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        identity = json.dumps({
            "source": row.get("source"),
            "dataset": row.get("dataset"),
            "date": row.get("date"),
            "dimensions": row.get("dimensions") or {},
            "metrics": row.get("metrics") or {},
        }, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        if identity in seen:
            continue
        seen.add(identity)
        unique.append(dict(row))
    return unique


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UMA-FREEの収益履歴と週次改善レポートを生成します。")
    parser.add_argument("--mode", choices=("backfill", "weekly"), default="weekly")
    parser.add_argument("--start-date", type=parse_iso_date)
    parser.add_argument("--end-date", type=parse_iso_date)
    parser.add_argument("--week-ending", type=parse_iso_date)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--article-inventory", type=Path)
    parser.add_argument("--grade-schedule", type=Path)
    parser.add_argument("--clarity-dir", type=Path)
    parser.add_argument("--infrastructure-json", type=Path)
    parser.add_argument("--skip-adsense", action="store_true")
    parser.add_argument("--skip-ga4", action="store_true")
    parser.add_argument("--skip-gsc", action="store_true")
    parser.add_argument("--skip-youtube", action="store_true")
    parser.add_argument("--skip-github", action="store_true")
    parser.add_argument("--fail-on-partial", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[3]
    period = resolve_period(args.mode, args.start_date, args.end_date)
    week_ending = args.week_ending or latest_complete_sunday(period.end + timedelta(days=1))
    output_dir = args.output_dir.resolve()
    raw_dir = output_dir / "raw"
    output_dir.mkdir(parents=True, exist_ok=True)

    source_results: dict[str, Any] = {}
    source_status: dict[str, Any] = {}
    collectors: list[tuple[str, bool, Callable[[], Mapping[str, Any]]]] = [
        ("adsense", args.skip_adsense, lambda: collect_adsense(period, raw_dir)),
        ("ga4", args.skip_ga4, lambda: collect_ga4(period, raw_dir)),
        ("gsc", args.skip_gsc, lambda: collect_gsc(period, raw_dir)),
        ("youtube", args.skip_youtube, lambda: collect_youtube(period, raw_dir)),
        ("github_actions", args.skip_github, lambda: collect_github(period, raw_dir)),
        ("clarity", args.clarity_dir is None, lambda: import_clarity(args.clarity_dir)),
        (
            "infrastructure",
            args.infrastructure_json is None,
            lambda: import_infrastructure(args.infrastructure_json),
        ),
        # 媒体側SNS分析APIは提供可否が媒体ごとに異なる。Workflow結果とGA4 UTMを
        # 正本にし、媒体インプレッションは未取得を0へ変換しない。
        ("sns_platform_analytics", True, lambda: {}),
    ]
    for name, skipped, collector in collectors:
        if skipped:
            source_results[name] = {"rows": [], "reports": {}}
            source_status[name] = {
                "status": "unavailable",
                "row_count": 0,
                "reason": "明示的にスキップまたは原本未指定",
            }
        else:
            print(f"[{name}] 読み取り開始")
            run_source(name, collector, source_results, source_status)
            print(f"[{name}] {source_status[name]['status']} / {source_status[name]['row_count']}行")

    history_rows = deduplicate_history_rows([
        row
        for result in source_results.values()
        for row in result.get("rows") or []
    ])
    history = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": RETRIEVED_AT,
        "mode": args.mode,
        "period": {"start_date": period.start.isoformat(), "end_date": period.end.isoformat()},
        "business_boundaries": {
            "revenue_start": BUSINESS_START_DATE.isoformat(),
            "ga4_adsense_link_start": GA4_ADSENSE_LINK_DATE.isoformat(),
            "first_complete_week_start": FIRST_COMPLETE_WEEK_START.isoformat(),
        },
        "currency": "JPY",
        "formal_week_timezone": "Asia/Tokyo",
        "source_status": source_status,
        "source_details": source_results,
        "rows": history_rows,
    }
    status_payload = {
        "schema_version": SOURCE_STATUS_VERSION,
        "generated_at": RETRIEVED_AT,
        "period": history["period"],
        "sources": source_status,
        "partial_artifact_policy": True,
        "missing_values_are_zero": False,
    }
    analysis = build_analysis(
        history,
        week_ending,
        args.article_inventory,
        args.grade_schedule,
        repo_root,
    )
    write_json(output_dir / "monetization-history.v2.json", history)
    write_json(output_dir / "source-status.v2.json", status_payload)
    write_json(output_dir / "monetization-cycle-analysis.v1.json", analysis)
    (output_dir / "UMA-FREE_週次収益改善.md").write_text(
        render_markdown(analysis), encoding="utf-8"
    )
    print(json.dumps({
        "history_rows": len(history_rows),
        "formal_week": analysis["formal_week"]["formal"],
        "output_dir": str(output_dir),
    }, ensure_ascii=False))
    required_sources = {"adsense", "ga4", "gsc", "youtube", "github_actions"}
    if args.fail_on_partial and any(
        source_status.get(name, {}).get("status") != "complete"
        for name in required_sources
    ):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
