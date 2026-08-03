"""ローカル分析スナップショットを monetization-report.v1 へ正規化する。

入力ファイルは読み取り専用で扱い、媒体ごとの期間と母数を保持したまま、
共通期間の日次比較、SEO・ページ群・広告・回遊・アフィリエイトを集計する。
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import statistics
import struct
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo


REPORT_SCHEMA_VERSION = "monetization-report.v1"
JST = ZoneInfo("Asia/Tokyo")
DEFAULT_COMMON_START = date(2026, 7, 7)
DEFAULT_COMMON_END = date(2026, 7, 31)

PAGE_REVENUE_INDEX: dict[str, float] = {
    "home": 1.20,
    "article": 1.00,
    "article_index": 0.75,
    "race_day": 0.90,
    "race_detail": 1.10,
    "course": 0.85,
    "horse": 0.85,
    "data_hub": 0.80,
    "other": 0.60,
}

POSITION_BUCKETS = (
    (1.0, 3.99, "1-3"),
    (4.0, 6.99, "4-6"),
    (7.0, 10.0, "7-10"),
    (10.01, 15.0, "11-15"),
    (15.01, 20.0, "16-20"),
    (20.01, math.inf, "21+"),
)

RACE_NAME_MARKERS = (
    "カップ",
    "記念",
    "ステークス",
    "ダッシュ",
    "トロフィー",
    "ダービー",
    "大賞典",
    "杯",
    "賞",
)

NAR_MARKERS = (
    "地方競馬",
    "門別",
    "盛岡",
    "水沢",
    "浦和",
    "船橋",
    "大井",
    "川崎",
    "金沢",
    "笠松",
    "名古屋",
    "園田",
    "姫路",
    "高知",
    "佐賀",
)


@dataclass(frozen=True)
class CsvSource:
    path: Path
    encoding: str
    rows: list[list[str]]


def _detect_encoding(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "cp932", "utf-16"):
        try:
            raw.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", raw, 0, 1, "対応する文字コードを判定できません")


def read_csv_source(path: Path) -> CsvSource:
    raw = path.read_bytes()
    encoding = _detect_encoding(raw)
    text = raw.decode(encoding)
    return CsvSource(path=path, encoding=encoding, rows=list(csv.reader(text.splitlines())))


def _number(value: Any, default: float = 0.0) -> float:
    text = str(value or "").strip().replace(",", "").replace("¥", "")
    if text.endswith("%"):
        text = text[:-1]
    try:
        return float(text)
    except (TypeError, ValueError):
        return default


def _integer(value: Any) -> int:
    return int(round(_number(value)))


def _rate(value: Any) -> float:
    text = str(value or "").strip()
    if text.endswith("%"):
        return _number(text) / 100
    return _number(text)


def _weighted_average(rows: Iterable[Mapping[str, Any]], value_key: str, weight_key: str) -> float:
    numerator = 0.0
    denominator = 0.0
    for row in rows:
        weight = max(0.0, _number(row.get(weight_key)))
        numerator += _number(row.get(value_key)) * weight
        denominator += weight
    return numerator / denominator if denominator else 0.0


def _position_bucket(position: float) -> str:
    for lower, upper, label in POSITION_BUCKETS:
        if lower <= position <= upper:
            return label
    return "unknown"


def _safe_date(value: str) -> date | None:
    text = str(value or "").strip()
    for pattern in ("%Y-%m-%d", "%Y年%m月%d日"):
        try:
            return datetime.strptime(text, pattern).date()
        except ValueError:
            continue
    return None


def _path_from_url(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return "/"
    parsed = urlsplit(raw if "://" in raw else f"https://uma-free.com{raw if raw.startswith('/') else '/' + raw}")
    path = parsed.path or "/"
    return path.rstrip("/") or "/"


def classify_page(value: str) -> str:
    """URLを分析用の排他的ページ群へ分類する。"""

    path = _path_from_url(value)
    if path == "/":
        return "home"
    if path == "/articles":
        return "article_index"
    if path.startswith("/articles/"):
        return "article"
    if re.fullmatch(r"/races/\d{4}-\d{2}-\d{2}/[^/]+/\d{1,2}", path):
        return "race_detail"
    if path.startswith("/races/"):
        return "race_day"
    if path == "/courses" or path.startswith("/courses/"):
        return "course"
    if path == "/horses" or path.startswith("/horses/"):
        return "horse"
    if (
        path == "/keiba-data"
        or path.startswith("/keiba-data/")
        or path == "/my-data"
        or path.startswith("/my-data/")
        or path == "/compare"
        or path.startswith("/compare/")
        or path == "/jockeys"
        or path.startswith("/jockeys/")
        or path == "/trainers"
        or path.startswith("/trainers/")
        or path.startswith("/grade-races/")
    ):
        return "data_hub"
    return "other"


def classify_query(query: str) -> dict[str, str]:
    """検索語を主分類、JRA/NAR、開催段階へ分類する。"""

    normalized = re.sub(r"\s+", " ", str(query or "").strip().lower())
    if re.search(r"uma[- ]?free|ウマフリー", normalized):
        primary = "brand"
    elif any(marker in normalized for marker in ("結果", "着順", "払戻", "払い戻し")):
        primary = "result"
    elif any(marker in normalized for marker in ("予想", "ai予想", "本命", "穴馬", "買い目")):
        primary = "prediction"
    elif any(marker in normalized for marker in ("出走予定", "想定", "枠順", "馬番", "日程", "いつ")):
        primary = "race_preparation"
    elif re.search(r"20\d{2}", normalized) and any(marker in normalized for marker in RACE_NAME_MARKERS):
        primary = "race_entity"
    elif any(marker in normalized for marker in (
        "稍重", "重馬場", "不良馬場", "馬体重", "オッズ", "脚質", "コース", "傾向", "特徴", "データ", "過去",
    )):
        primary = "evergreen_research"
    elif any(marker in normalized for marker in RACE_NAME_MARKERS):
        primary = "race_entity"
    else:
        primary = "evergreen_research"

    if any(marker.lower() in normalized for marker in NAR_MARKERS):
        circuit = "nar"
    elif any(marker in normalized for marker in ("jra", "中央競馬", "東京", "中山", "京都", "阪神", "中京", "新潟", "福島", "小倉", "札幌", "函館")):
        circuit = "jra"
    else:
        circuit = "unknown"

    if any(marker in normalized for marker in ("結果", "着順", "払戻", "払い戻し")):
        race_phase = "post_race"
    elif any(marker in normalized for marker in ("当日", "今日", "直前", "馬場")):
        race_phase = "race_day"
    elif any(marker in normalized for marker in ("枠順", "馬番")):
        race_phase = "draw_confirmed"
    elif any(marker in normalized for marker in ("予想", "追い切り")):
        race_phase = "final_48h"
    elif any(marker in normalized for marker in ("出走予定", "想定")):
        race_phase = "field_building"
    else:
        race_phase = "evergreen"

    return {"primary": primary, "circuit": circuit, "race_phase": race_phase}


def _png_dimensions(raw: bytes) -> tuple[int, int] | None:
    if len(raw) < 24 or raw[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", raw[16:24])


def inventory_files(root: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for path in sorted((item for item in root.rglob("*") if item.is_file()), key=lambda item: str(item)):
        raw = path.read_bytes()
        suffix = path.suffix.lower()
        record: dict[str, Any] = {
            "path": path.relative_to(root).as_posix(),
            "extension": suffix or "none",
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "status": "empty" if not raw else "ok",
        }
        if suffix == ".csv" and raw:
            source = read_csv_source(path)
            record.update({"encoding": source.encoding, "csv_rows": len(source.rows)})
        elif suffix == ".pdf" and raw:
            try:
                from pypdf import PdfReader  # type: ignore

                record["pdf_pages"] = len(PdfReader(str(path)).pages)
            except Exception as error:  # pragma: no cover - 依存なし環境向け
                record["pdf_pages"] = None
                record["inspection_warning"] = f"PDFページ数を取得できません: {error}"
        elif suffix == ".png" and raw:
            dimensions = _png_dimensions(raw)
            if dimensions:
                record["width_px"], record["height_px"] = dimensions
        records.append(record)
    return records


def _find_file(root: Path, *parts: str) -> Path:
    matches = [
        path
        for path in root.rglob("*")
        if path.is_file() and all(part.lower() in path.name.lower() for part in parts)
    ]
    if len(matches) != 1:
        raise FileNotFoundError(f"ファイルを一意に特定できません: {parts} -> {matches}")
    return matches[0]


def _dict_rows(source: CsvSource, header_index: int = 0) -> list[dict[str, str]]:
    rows = source.rows[header_index:]
    if not rows:
        return []
    headers = rows[0]
    output: list[dict[str, str]] = []
    for row in rows[1:]:
        if not any(str(cell).strip() for cell in row):
            continue
        padded = row + [""] * max(0, len(headers) - len(row))
        output.append(dict(zip(headers, padded)))
    return output


def parse_adsense(root: Path) -> dict[str, Any]:
    daily_source = read_csv_source(root / "googleadsense" / "report_1.csv")
    daily_rows = []
    for row in _dict_rows(daily_source):
        day = _safe_date(row.get("Date", ""))
        if not day:
            continue
        daily_rows.append({
            "date": day.isoformat(),
            "estimated_revenue_jpy": _number(row.get("Estimated earnings (JPY)")),
            "page_views": _integer(row.get("Page views")),
            "page_rpm_jpy": _number(row.get("Page RPM (JPY)")),
            "ad_impressions": _integer(row.get("Impressions")),
            "impression_rpm_jpy": _number(row.get("Impression RPM (JPY)")),
            "active_view_viewable_rate": _rate(row.get("Active View Viewable")),
            "clicks": _integer(row.get("Clicks")),
        })

    ad_unit_rows = []
    for row in _dict_rows(read_csv_source(root / "googleadsense" / "report_2.csv")):
        ad_unit_rows.append({
            "ad_unit": row.get("Ad unit", ""),
            "estimated_revenue_jpy": _number(row.get("Estimated earnings (JPY)")),
            "ad_impressions": _integer(row.get("Impressions")),
            "impression_rpm_jpy": _number(row.get("Impression RPM (JPY)")),
            "active_view_viewable_rate": _rate(row.get("Active View Viewable")),
            "clicks": _integer(row.get("Clicks")),
        })

    totals = {
        "estimated_revenue_jpy": round(sum(row["estimated_revenue_jpy"] for row in daily_rows), 2),
        "page_views": sum(row["page_views"] for row in daily_rows),
        "ad_impressions": sum(row["ad_impressions"] for row in daily_rows),
        "clicks": sum(row["clicks"] for row in daily_rows),
    }
    totals["page_rpm_jpy"] = round(
        totals["estimated_revenue_jpy"] / totals["page_views"] * 1000 if totals["page_views"] else 0,
        2,
    )
    totals["impression_rpm_jpy"] = round(
        totals["estimated_revenue_jpy"] / totals["ad_impressions"] * 1000 if totals["ad_impressions"] else 0,
        2,
    )
    totals["active_view_viewable_rate"] = round(
        _weighted_average(daily_rows, "active_view_viewable_rate", "ad_impressions"),
        6,
    )
    return {
        "period": {"start_date": daily_rows[0]["date"], "end_date": daily_rows[-1]["date"]},
        "totals": totals,
        "daily": daily_rows,
        "ad_units": ad_unit_rows,
        "manual_ad_units": {
            "estimated_revenue_jpy": round(sum(row["estimated_revenue_jpy"] for row in ad_unit_rows), 2),
            "ad_impressions": sum(row["ad_impressions"] for row in ad_unit_rows),
        },
    }


def _gsc_rows(source: CsvSource) -> list[dict[str, Any]]:
    if not source.rows:
        return []
    output: list[dict[str, Any]] = []
    for raw in source.rows[1:]:
        if len(raw) < 5 or not raw[0].strip():
            continue
        output.append({
            "dimension": raw[0].strip(),
            "clicks": _integer(raw[1]),
            "impressions": _integer(raw[2]),
            "ctr": _rate(raw[3]),
            "position": _number(raw[4]),
        })
    return output


def _aggregate_gsc_groups(rows: Sequence[Mapping[str, Any]], classification_key: str) -> list[dict[str, Any]]:
    grouped: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[str(row[classification_key])].append(row)
    total_clicks = sum(_number(row.get("clicks")) for row in rows)
    output = []
    for name, items in grouped.items():
        clicks = sum(_integer(row.get("clicks")) for row in items)
        impressions = sum(_integer(row.get("impressions")) for row in items)
        output.append({
            classification_key: name,
            "rows": len(items),
            "clicks": clicks,
            "click_share": round(clicks / total_clicks, 6) if total_clicks else 0,
            "impressions": impressions,
            "ctr": round(clicks / impressions, 6) if impressions else 0,
            "position": round(_weighted_average(items, "position", "impressions"), 3),
        })
    return sorted(output, key=lambda item: (-item["clicks"], -item["impressions"], item[classification_key]))


def _seo_opportunities(query_rows: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    cohorts: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    for row in query_rows:
        key = (str(row["intent"]), str(row["position_bucket"]), "all")
        cohorts[key].append(_number(row["ctr"]))
    medians = {key: statistics.median(values) for key, values in cohorts.items() if values}

    opportunities = []
    for row in query_rows:
        key = (str(row["intent"]), str(row["position_bucket"]), "all")
        benchmark = medians.get(key, _number(row["ctr"]))
        missed_clicks = max(0.0, _number(row["impressions"]) * (benchmark - _number(row["ctr"])))
        revenue_index = PAGE_REVENUE_INDEX["article"]
        opportunities.append({
            "query": row["dimension"],
            "intent": row["intent"],
            "circuit": row["circuit"],
            "race_phase": row["race_phase"],
            "position_bucket": row["position_bucket"],
            "clicks": row["clicks"],
            "impressions": row["impressions"],
            "ctr": row["ctr"],
            "position": row["position"],
            "cohort_device": "all",
            "cohort_median_ctr": round(benchmark, 6),
            "page_revenue_index": revenue_index,
            "estimated_missed_clicks": round(missed_clicks, 3),
            "opportunity_score": round(missed_clicks * revenue_index, 3),
        })
    opportunities.sort(key=lambda item: (-item["opportunity_score"], -item["impressions"], item["query"]))
    return opportunities[:50]


def parse_gsc(root: Path) -> dict[str, Any]:
    directory = next((root / "googlesearchconsole").iterdir())
    devices = _gsc_rows(read_csv_source(directory / "デバイス.csv"))
    pages = _gsc_rows(read_csv_source(directory / "ページ.csv"))
    queries = _gsc_rows(read_csv_source(directory / "クエリ.csv"))
    daily_raw = _gsc_rows(read_csv_source(directory / "平均読み込み時間のチャート.csv"))

    daily = [{"date": row["dimension"], **{key: value for key, value in row.items() if key != "dimension"}} for row in daily_raw]
    page_rows = [{**row, "page_type": classify_page(str(row["dimension"]))} for row in pages]
    query_rows = []
    for row in queries:
        classified = classify_query(str(row["dimension"]))
        query_rows.append({
            **row,
            "intent": classified["primary"],
            "circuit": classified["circuit"],
            "race_phase": classified["race_phase"],
            "position_bucket": _position_bucket(_number(row["position"])),
        })

    return {
        "period": {"start_date": daily[0]["date"], "end_date": daily[-1]["date"]},
        "device_totals": {
            "clicks": sum(row["clicks"] for row in devices),
            "impressions": sum(row["impressions"] for row in devices),
        },
        "devices": devices,
        "daily": daily,
        "page_groups": _aggregate_gsc_groups(page_rows, "page_type"),
        "query_intents": _aggregate_gsc_groups(query_rows, "intent"),
        "opportunities": _seo_opportunities(query_rows),
        "pages": page_rows,
        "queries": query_rows,
    }


def _ga4_segments(source: CsvSource) -> list[dict[str, Any]]:
    segments: list[list[list[str]]] = []
    current: list[list[str]] = []
    for row in source.rows:
        is_comment = bool(row and row[0].startswith("#"))
        is_blank = not row or not any(cell.strip() for cell in row)
        if is_comment or is_blank:
            if current:
                segments.append(current)
                current = []
            continue
        current.append(row)
    if current:
        segments.append(current)

    output = []
    for segment in segments:
        header = segment[0]
        rows = []
        for raw in segment[1:]:
            padded = raw + [""] * max(0, len(header) - len(raw))
            rows.append(dict(zip(header, padded)))
        output.append({"headers": header, "rows": rows})
    return output


def _find_ga4_segment(segments: Sequence[Mapping[str, Any]], first_header: str) -> Mapping[str, Any] | None:
    return next((segment for segment in segments if segment.get("headers", [""])[0] == first_header), None)


def parse_ga4(root: Path) -> dict[str, Any]:
    snapshot_path = _find_file(root / "googleanalytics", "レポートのスナップショット")
    acquisition_path = _find_file(root / "googleanalytics", "集客サマリー")
    environment_path = _find_file(root / "googleanalytics", "ユーザーの環境の概要")
    landing_path = _find_file(root / "googleanalytics", "ランディング")

    snapshot = _ga4_segments(read_csv_source(snapshot_path))
    acquisition = _ga4_segments(read_csv_source(acquisition_path))
    environment = _ga4_segments(read_csv_source(environment_path))
    landing = _ga4_segments(read_csv_source(landing_path))

    headline_segment = _find_ga4_segment(snapshot, "アクティブ ユーザー")
    headline_row = (headline_segment or {}).get("rows", [{}])[0] if (headline_segment or {}).get("rows") else {}
    headline = {
        "active_users": _integer(headline_row.get("アクティブ ユーザー")),
        "new_users": _integer(headline_row.get("新規ユーザー数")),
        "average_engagement_seconds_per_active_user": _number(
            headline_row.get("アクティブ ユーザーあたりの平均エンゲージメント時間")
        ),
        "events": _integer(headline_row.get("イベント数")),
    }

    channel_segment = _find_ga4_segment(
        acquisition,
        "セッションのメインのチャネル グループ（デフォルト チャネル グループ）",
    )
    channels = [
        {"channel": row.get(channel_segment["headers"][0], ""), "sessions": _integer(row.get("セッション"))}
        for row in (channel_segment or {}).get("rows", [])
    ]
    headline["sessions"] = sum(row["sessions"] for row in channels)

    source_segment = _find_ga4_segment(snapshot, "セッションの参照元 / メディア")
    session_sources = [
        {"source_medium": row.get(source_segment["headers"][0], ""), "sessions": _integer(row.get("セッション"))}
        for row in (source_segment or {}).get("rows", [])
    ]

    device_segment = _find_ga4_segment(environment, "デバイス カテゴリ")
    devices = [
        {"device": row.get(device_segment["headers"][0], ""), "active_users": _integer(row.get("アクティブ ユーザー"))}
        for row in (device_segment or {}).get("rows", [])
    ]
    screen_segment = _find_ga4_segment(environment, "画面の解像度")
    screens = [
        {"screen_resolution": row.get(screen_segment["headers"][0], ""), "active_users": _integer(row.get("アクティブ ユーザー"))}
        for row in (screen_segment or {}).get("rows", [])[:30]
    ]

    returning_segment = _find_ga4_segment(snapshot, "N 日目")
    new_returning = [
        {
            "day_index": _integer(row.get("N 日目")),
            "new": _integer(row.get("new")),
            "returning": _integer(row.get("returning")),
        }
        for row in (returning_segment or {}).get("rows", [])
    ]

    landing_segment = landing[0] if landing else {"headers": [], "rows": []}
    landing_rows = []
    landing_header = landing_segment.get("headers", [""])[0] if landing_segment.get("headers") else ""
    for row in landing_segment.get("rows", []):
        path = row.get(landing_header, "")
        landing_rows.append({
            "path": path,
            "page_type": classify_page(path),
            "google_clicks": _integer(row.get("Google のオーガニック検索のクリック数")),
            "google_impressions": _integer(row.get("Google のオーガニック検索の表示回数")),
            "active_users": _integer(row.get("アクティブ ユーザー")),
            "engaged_sessions": _integer(row.get("エンゲージのあったセッション数")),
            "engagement_rate": _rate(row.get("エンゲージメント率")),
            "average_engagement_seconds": _number(row.get("アクティブ ユーザーあたりの平均エンゲージメント時間")),
            "events": _integer(row.get("イベント数")),
            "publisher_ad_revenue": _number(row.get("広告収益")),
        })

    landing_groups: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for row in landing_rows:
        landing_groups[row["page_type"]].append(row)
    page_groups = []
    for page_type, rows in landing_groups.items():
        active_users = sum(_integer(row.get("active_users")) for row in rows)
        page_groups.append({
            "page_type": page_type,
            "rows": len(rows),
            "google_clicks": sum(_integer(row.get("google_clicks")) for row in rows),
            "google_impressions": sum(_integer(row.get("google_impressions")) for row in rows),
            "active_user_appearances": active_users,
            "engaged_sessions": sum(_integer(row.get("engaged_sessions")) for row in rows),
            "weighted_engagement_seconds": round(_weighted_average(rows, "average_engagement_seconds", "active_users"), 2),
            "events_per_active_user_appearance": round(
                sum(_integer(row.get("events")) for row in rows) / active_users if active_users else 0,
                2,
            ),
            "publisher_ad_revenue": round(sum(_number(row.get("publisher_ad_revenue")) for row in rows), 2),
        })
    page_groups.sort(key=lambda item: (-item["google_clicks"], item["page_type"]))

    return {
        "period": {"start_date": "2026-07-06", "end_date": "2026-08-02"},
        "headline": headline,
        "channels": channels,
        "session_sources": session_sources,
        "devices": devices,
        "top_screen_resolutions": screens,
        "daily_new_returning": new_returning,
        "landing_page_groups": page_groups,
        "publisher_revenue_available": any(row["publisher_ad_revenue"] != 0 for row in landing_rows),
    }


def _clarity_data_rows(source: CsvSource) -> list[list[str]]:
    for index, row in enumerate(source.rows):
        if index >= 4 and len(row) >= 3 and any(cell.strip() for cell in row):
            return [candidate for candidate in source.rows[index + 1 :] if any(cell.strip() for cell in candidate)]
    return []


def parse_clarity(root: Path) -> dict[str, Any]:
    directory = root / "clarity"
    event_path = _find_file(directory, "スマート イベント")
    insight_path = _find_file(directory, "インサイト")
    error_path = _find_file(directory, "JavaScript")
    page_path = _find_file(directory, "上位のページ")
    landing_path = _find_file(directory, "上位の閲覧開始ページ")

    events = []
    for row in _clarity_data_rows(read_csv_source(event_path)):
        if len(row) >= 4:
            events.append({"event": row[1], "sessions": _integer(row[2]), "session_share": _rate(row[3])})
    insights = []
    for row in _clarity_data_rows(read_csv_source(insight_path)):
        if len(row) >= 4:
            insights.append({"insight": row[1], "sessions": _integer(row[2]), "session_share": _rate(row[3])})
    errors = []
    for row in _clarity_data_rows(read_csv_source(error_path)):
        if len(row) >= 4:
            errors.append({"error": row[1], "sessions": _integer(row[2]), "session_share": _rate(row[3])})

    def parse_pages(path: Path) -> list[dict[str, Any]]:
        output = []
        for row in _clarity_data_rows(read_csv_source(path)):
            if len(row) >= 3:
                output.append({"url": row[1], "page_type": classify_page(row[1]), "sessions": _integer(row[2])})
        return output

    event_by_name = {row["event"]: row for row in events}
    race_view_sessions = _integer(event_by_name.get("race_view", {}).get("sessions"))
    affiliate_impression_sessions = _integer(event_by_name.get("affiliate_impression", {}).get("sessions"))
    affiliate_click_sessions = _integer(event_by_name.get("affiliate_click", {}).get("sessions"))
    # 構成比は小数第2位へ丸められているため、小標本の 1 / 0.02%=5,000 のような
    # 逆算値は不安定になる。最もセッション数が多いイベントを母数推定に使う。
    implied_base = max(events, key=lambda row: row["sessions"], default=None)
    implied_sessions = (
        implied_base["sessions"] / implied_base["session_share"]
        if implied_base and implied_base["sessions"] > 0 and implied_base["session_share"] > 0
        else 0
    )
    return {
        "period": {"start_date": "2026-07-07", "end_date": "2026-08-03"},
        "implied_sessions": round(implied_sessions),
        "events": events,
        "insights": insights,
        "javascript_errors": errors,
        "top_pages": parse_pages(page_path),
        "top_landing_pages": parse_pages(landing_path),
        "funnels": {
            "race_view_to_prediction_table_view": round(
                _integer(event_by_name.get("prediction_table_view", {}).get("sessions")) / race_view_sessions,
                6,
            ) if race_view_sessions else None,
            "race_view_to_race_navigation": round(
                _integer(event_by_name.get("race_navigation", {}).get("sessions")) / race_view_sessions,
                6,
            ) if race_view_sessions else None,
            "affiliate_session_ctr": round(affiliate_click_sessions / affiliate_impression_sessions, 6)
            if affiliate_impression_sessions else None,
        },
    }


def parse_rakuten(root: Path) -> dict[str, Any]:
    source = read_csv_source(_find_file(root / "rakutenlinkshare", "TG318200"))
    header_index = next(
        index
        for index, row in enumerate(source.rows)
        if row and row[0].strip() == "日付"
    )
    headers = source.rows[header_index]
    rows = []
    for raw in source.rows[header_index + 1 :]:
        if not raw or not raw[0].strip():
            continue
        padded = raw + [""] * max(0, len(headers) - len(raw))
        mapped = dict(zip(headers, padded))
        day = _safe_date(mapped.get("日付", ""))
        if not day:
            continue
        rows.append({
            "date": day.isoformat(),
            "impressions": _integer(mapped.get("表示数")),
            "clicks": _integer(mapped.get("クリック数")),
            "occurrences": _integer(mapped.get("発生件数")),
            "occurrence_amount_jpy": _number(mapped.get("発生金額")),
            "confirmed_occurrences": _integer(mapped.get("確定件数")),
            "confirmed_amount_jpy": _number(mapped.get("確定金額")),
        })
    return {
        "period": {"start_date": rows[0]["date"], "end_date": rows[-1]["date"]},
        "totals": {
            "impressions": sum(row["impressions"] for row in rows),
            "clicks": sum(row["clicks"] for row in rows),
            "occurrences": sum(row["occurrences"] for row in rows),
            "occurrence_amount_jpy": round(sum(row["occurrence_amount_jpy"] for row in rows), 2),
            "confirmed_occurrences": sum(row["confirmed_occurrences"] for row in rows),
            "confirmed_amount_jpy": round(sum(row["confirmed_amount_jpy"] for row in rows), 2),
        },
        "daily": rows,
    }


def _join_common_daily(
    adsense: Mapping[str, Any],
    gsc: Mapping[str, Any],
    rakuten: Mapping[str, Any],
    start: date,
    end: date,
) -> list[dict[str, Any]]:
    sources = {
        "adsense": {row["date"]: row for row in adsense["daily"]},
        "gsc": {row["date"]: row for row in gsc["daily"]},
        "rakuten": {row["date"]: row for row in rakuten["daily"]},
    }
    output = []
    day = start
    while day <= end:
        key = day.isoformat()
        ad = sources["adsense"].get(key, {})
        search = sources["gsc"].get(key, {})
        affiliate = sources["rakuten"].get(key, {})
        output.append({
            "date": key,
            "weekday": day.strftime("%a"),
            "adsense_revenue_jpy": _number(ad.get("estimated_revenue_jpy")),
            "page_views": _integer(ad.get("page_views")),
            "ad_impressions": _integer(ad.get("ad_impressions")),
            "page_rpm_jpy": _number(ad.get("page_rpm_jpy")),
            "active_view_viewable_rate": _number(ad.get("active_view_viewable_rate")),
            "gsc_clicks": _integer(search.get("clicks")),
            "gsc_impressions": _integer(search.get("impressions")),
            "gsc_ctr": _number(search.get("ctr")),
            "gsc_position": _number(search.get("position")),
            "affiliate_clicks": _integer(affiliate.get("clicks")),
            "affiliate_occurrences": _integer(affiliate.get("occurrences")),
        })
        day = date.fromordinal(day.toordinal() + 1)
    return output


def _correlation(rows: Sequence[Mapping[str, Any]], key_a: str, key_b: str) -> float | None:
    values = [(_number(row.get(key_a)), _number(row.get(key_b))) for row in rows]
    if len(values) < 3:
        return None
    a_values = [item[0] for item in values]
    b_values = [item[1] for item in values]
    a_mean = statistics.mean(a_values)
    b_mean = statistics.mean(b_values)
    numerator = sum((a - a_mean) * (b - b_mean) for a, b in values)
    denominator = math.sqrt(
        sum((a - a_mean) ** 2 for a in a_values) * sum((b - b_mean) ** 2 for b in b_values)
    )
    return round(numerator / denominator, 4) if denominator else None


def build_report(
    input_dir: Path,
    *,
    common_start: date = DEFAULT_COMMON_START,
    common_end: date = DEFAULT_COMMON_END,
) -> dict[str, Any]:
    inventory = inventory_files(input_dir)
    adsense = parse_adsense(input_dir)
    gsc = parse_gsc(input_dir)
    ga4 = parse_ga4(input_dir)
    clarity = parse_clarity(input_dir)
    rakuten = parse_rakuten(input_dir)
    daily = _join_common_daily(adsense, gsc, rakuten, common_start, common_end)

    implied_sessions = _integer(clarity["implied_sessions"])
    baseline_revenue = _number(adsense["totals"]["estimated_revenue_jpy"])
    revenue_per_1000_sessions = baseline_revenue / implied_sessions * 1000 if implied_sessions else 0
    base_model = {
        "human_sessions": implied_sessions,
        "page_views_per_session": round(_number(adsense["totals"]["page_views"]) / implied_sessions, 4) if implied_sessions else 0,
        "ad_revenue_per_page_view_jpy": round(baseline_revenue / _number(adsense["totals"]["page_views"]), 6)
        if adsense["totals"]["page_views"] else 0,
        "revenue_per_1000_human_sessions_jpy": round(revenue_per_1000_sessions, 2),
    }
    scenarios = [
        {"scenario": "現状基準", "session_multiplier": 1.0, "depth_multiplier": 1.0, "yield_multiplier": 1.0},
        {"scenario": "流入改善", "session_multiplier": 1.25, "depth_multiplier": 1.0, "yield_multiplier": 1.0},
        {"scenario": "回遊改善", "session_multiplier": 1.0, "depth_multiplier": 1.20, "yield_multiplier": 1.0},
        {"scenario": "複合改善", "session_multiplier": 1.50, "depth_multiplier": 1.20, "yield_multiplier": 1.10},
    ]
    for scenario in scenarios:
        multiplier = scenario["session_multiplier"] * scenario["depth_multiplier"] * scenario["yield_multiplier"]
        scenario["revenue_multiplier"] = round(multiplier, 3)
        scenario["estimated_revenue_jpy"] = round(baseline_revenue * multiplier, 2)

    warnings = [
        "媒体ごとに期間・ディメンション・プライバシーしきい値が異なるため、媒体合計を直接割らない。",
        "Search Consoleのページ・クエリ・デバイス合計差は仕様上の差として保持し、強制的に一致させない。",
        "GA4のページ別アクティブユーザーはページ間で重複し、サイト全体のユニークユーザーへ足し上げない。",
        "Clarityのスマートイベント数はイベント総数ではなく、イベントが発生したセッション数である。",
        "GA4ランディングページ出力の広告収益は全行0であり、AdSenseリンク後の将来データだけで収益帰属する。",
        "楽天TrafficGateのクリック数とClarity affiliate_clickは定義・期間・実装開始日が異なるため同一クリックとして扱わない。",
        "スナップショットのSEO機会スコアはクエリ×デバイス行がないためdevice=all。週次APIではquery×deviceで再計算する。",
    ]
    empty_files = [record["path"] for record in inventory if record["status"] == "empty"]
    if empty_files:
        warnings.append(f"空ファイルを欠損として記録: {', '.join(empty_files)}")

    manual_revenue = _number(adsense["manual_ad_units"]["estimated_revenue_jpy"])
    return {
        "schema_version": REPORT_SCHEMA_VERSION,
        "generated_at": datetime.now(JST).isoformat(),
        "period": {
            "common": {"start_date": common_start.isoformat(), "end_date": common_end.isoformat()},
            "sources": {
                "adsense": adsense["period"],
                "gsc": gsc["period"],
                "ga4": ga4["period"],
                "clarity": clarity["period"],
                "rakuten_linkshare": rakuten["period"],
            },
        },
        "sample_quality": {
            "source_file_count": len(inventory),
            "empty_file_count": len(empty_files),
            "common_daily_rows": len(daily),
            "warnings": warnings,
        },
        "sources": inventory,
        "revenue": {
            "adsense": adsense,
            "manual_ad_revenue_share": round(manual_revenue / baseline_revenue, 6) if baseline_revenue else 0,
            "offerwall_baseline_jpy_30d": 279,
            "offerwall_baseline_share": round(279 / baseline_revenue, 6) if baseline_revenue else 0,
            "model": base_model,
            "scenarios": scenarios,
        },
        "traffic": {"ga4": ga4},
        "seo": gsc,
        "page_groups": {
            "search_console": gsc["page_groups"],
            "ga4_landing": ga4["landing_page_groups"],
        },
        "ad_placements": adsense["ad_units"],
        "funnels": clarity["funnels"],
        "engagement": clarity,
        "affiliate": {
            "rakuten_linkshare": rakuten,
            "clarity_affiliate_click_sessions": next(
                (row["sessions"] for row in clarity["events"] if row["event"] == "affiliate_click"),
                0,
            ),
        },
        "daily": daily,
        "cross_source": {
            "correlations_common_period": {
                "gsc_clicks_vs_adsense_revenue": _correlation(daily, "gsc_clicks", "adsense_revenue_jpy"),
                "gsc_clicks_vs_page_views": _correlation(daily, "gsc_clicks", "page_views"),
                "page_views_vs_adsense_revenue": _correlation(daily, "page_views", "adsense_revenue_jpy"),
            },
            "note": "相関は因果効果を示さず、曜日・レース日程・広告単価の共変動を含む。",
        },
        "experiments": [
            {
                "experiment_id": "MOBILE-RACE-ENGAGED-AD-2026-08",
                "status": "prepared_gate_closed",
                "minimum_days": 14,
                "minimum_sessions_per_variant": 1000,
                "maximum_days": 28,
                "start_gate": "高速: 3完全日・主要欠損とUnassignedが各2%未満・合計500セッション、または標準: 7完全日・各5%未満",
            },
            {
                "experiment_id": "ARTICLE-RACE-BRIDGE-2026-08",
                "status": "implementation_only",
                "minimum_days": 14,
                "minimum_sessions_per_variant": 500,
                "start_gate": "先行する広告実験終了後かつ適格記事あり",
            },
            {
                "experiment_id": "ARTICLE-AFTER-BODY-PLACEMENT-2026-08",
                "status": "implementation_only",
                "minimum_days": 14,
                "minimum_sessions_per_variant": 500,
                "start_gate": "記事ブリッジ実験終了後",
            },
            {
                "experiment_id": "AFF-RAKUTEN-QUALIFIED-NAR-2026-08",
                "status": "measurement_reconciliation_required",
                "qualified_click_review": 200,
                "stop_at_zero_occurrences_clicks": 400,
                "start_gate": "広告実験終了後かつクリック定義一致",
            },
        ],
    }


def render_markdown(report: Mapping[str, Any]) -> str:
    adsense = report["revenue"]["adsense"]["totals"]
    gsc = report["seo"]
    ga4 = report["traffic"]["ga4"]
    clarity = report["engagement"]
    affiliate = report["affiliate"]["rakuten_linkshare"]["totals"]
    page_groups = {row["page_type"]: row for row in gsc["page_groups"]}
    article_share = page_groups.get("article", {}).get("click_share", 0)
    race_share = page_groups.get("race_detail", {}).get("click_share", 0)
    mobile_clicks = next((row["clicks"] for row in gsc["devices"] if row["dimension"] == "モバイル"), 0)
    device_clicks = gsc["device_totals"]["clicks"]
    top_opportunities = gsc["opportunities"][:10]

    lines = [
        "# UMA-FREE 全流入・回遊・広告収益分析",
        "",
        f"生成日時: {report['generated_at']}",
        f"共通比較期間: {report['period']['common']['start_date']}〜{report['period']['common']['end_date']}",
        "",
        "## 結論",
        "",
        "UMA-FREEの強みは、重賞・馬場等の記事で検索需要を獲得し、個別レースの高密度な予想表へ接続した後、複数レースを巡回できる点にある。収益を伸ばす主経路は広告数の増加ではなく、記事流入の質、記事から正確なレースへの到達、再訪、読了位置の視認性である。",
        "",
        "## 基準値",
        "",
        f"- AdSense: 推定収益{adsense['estimated_revenue_jpy']:,.0f}円、{adsense['page_views']:,}PV、{adsense['ad_impressions']:,}広告表示、Page RPM {adsense['page_rpm_jpy']:,.0f}円。",
        f"- Search Console: ページ別クリックのうち記事{article_share:.1%}、個別レース{race_share:.1%}。デバイス別クリックのうちモバイル{mobile_clicks / device_clicks if device_clicks else 0:.1%}。",
        f"- GA4: {ga4['headline']['active_users']:,}アクティブユーザー、{ga4['headline']['new_users']:,}新規ユーザー、{ga4['headline']['sessions']:,}セッション。",
        f"- Clarity: 約{clarity['implied_sessions']:,}セッション相当。race_view→prediction_table_view {clarity['funnels']['race_view_to_prediction_table_view']:.1%}、race_navigation {clarity['funnels']['race_view_to_race_navigation']:.1%}。",
        f"- 楽天リンクシェア: {affiliate['clicks']:,}クリック、発生{affiliate['occurrences']:,}件。",
        "",
        "## 多角的な示唆",
        "",
        "1. 記事は獲得面、個別レースは回遊面であり、同じKPIで評価しない。記事は検索CTRとレース到達、レースは予想表閲覧・巡回・収益/セッションで評価する。",
        "2. モバイル検索が主流のため、タイトル改善だけでなく、390px前後でレース導線、予想表、広告予約高が安定していることが収益条件になる。",
        "3. 手動広告の収益比率は全体の一部であり、広告密度を上げるより、既存配置の視認性とページ深度を上げる方が安全である。",
        "4. GA4 UnassignedとPublisher Ad Revenue未取得が媒体別収益判断の最大の制約である。高速または標準の品質ゲートを優先する。",
        "5. 楽天の外部クリックとサイト内クリック計測の乖離が大きいため、露出追加は成果条件・期間・リンクID・リダイレクト定義を一致させてから行う。",
        "",
        "## SEO機会スコア上位",
        "",
        "|検索語|意図|表示|CTR|順位|推定取りこぼしクリック|",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for row in top_opportunities:
        lines.append(
            f"|{row['query']}|{row['intent']}|{row['impressions']:,}|{row['ctr']:.2%}|{row['position']:.2f}|{row['estimated_missed_clicks']:.1f}|"
        )
    lines.extend([
        "",
        "## 実装順序",
        "",
        "1. GA4–AdSenseリンク、カスタム定義、チャネルを設定し、高速3完全日または標準7完全日の条件でUnassignedと欠損率を確認する。",
        "2. MOBILE-RACE-ENGAGED-AD-2026-08だけを開始し、14日・各群1,000人間セッションで判断する。",
        "3. GSC機会スコアに沿って代表URLを段階更新し、同一重賞のURLを増やさない。",
        "4. 記事ブリッジは適格性保存と表示実験を分離し、広告実験終了後に適格記事だけで比較する。",
        "5. 記事広告は広告数を増やさず、読了位置の順序だけを後続実験で比較する。",
        "6. 楽天は計測定義を一致させた後、地方競馬の適格導線だけで評価する。",
        "",
        "## 品質注記",
        "",
    ])
    lines.extend(f"- {warning}" for warning in report["sample_quality"]["warnings"])
    return "\n".join(lines) + "\n"


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    parser.add_argument("--common-start", type=date.fromisoformat, default=DEFAULT_COMMON_START)
    parser.add_argument("--common-end", type=date.fromisoformat, default=DEFAULT_COMMON_END)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    report = build_report(args.input_dir, common_start=args.common_start, common_end=args.common_end)
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.summary.write_text(render_markdown(report), encoding="utf-8")
    print(
        f"{REPORT_SCHEMA_VERSION}: files={report['sample_quality']['source_file_count']}, "
        f"daily={report['sample_quality']['common_daily_rows']}, "
        f"revenue={report['revenue']['adsense']['totals']['estimated_revenue_jpy']:.0f} JPY"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
