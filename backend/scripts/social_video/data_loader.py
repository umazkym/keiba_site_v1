from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import quote

import requests


SITE_BASE_URL = "https://uma-free.com"
DEFAULT_API_BASE_URL = "https://keiba-site-v1-761440273070.us-west1.run.app"
JST = timezone(timedelta(hours=9))


@dataclass
class HorseVideoData:
    horse_name: str
    horse_number: int
    waku_number: Optional[int]
    mark: str
    deviation_score: Optional[float]
    start_1c_indicator: Optional[float]
    position_label: str = "-"


@dataclass
class RaceVideoData:
    id: str
    race_date: str
    venue_name: str
    race_number: int
    race_name: str
    course_type: Optional[str]
    distance: Optional[int]
    grade: Optional[str] = None
    predictions: List[HorseVideoData] = field(default_factory=list)
    horse_number_advantages: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def display_name(self) -> str:
        name = self.race_name.strip() if self.race_name else ""
        return name or f"{self.race_number}R"

    @property
    def course_label(self) -> str:
        parts: List[str] = []
        if self.course_type:
            parts.append(str(self.course_type))
        if self.distance:
            parts.append(f"{self.distance}m")
        return "".join(parts) or "条件確認中"

    @property
    def is_grade_race(self) -> bool:
        return bool(self.grade)


def infer_waku_number(horse_number: int, total_horses: int) -> Optional[int]:
    """フロントエンドのgetWakuNumberと同じ規則で枠番を補完する。"""
    if horse_number <= 0 or total_horses <= 0 or horse_number > total_horses:
        return None
    if total_horses <= 8:
        return horse_number

    quotient, remainder = divmod(total_horses, 8)
    current_horse = 1
    for waku_index in range(8):
        count = quotient + (1 if (7 - waku_index) < remainder else 0)
        if current_horse <= horse_number < current_horse + count:
            return waku_index + 1
        current_horse += count
    return None

@dataclass
class VenueVideoData:
    venue_name: str
    race_type: str
    races: List[RaceVideoData]

    @property
    def grade_races(self) -> List[RaceVideoData]:
        return [race for race in self.races if race.is_grade_race]


def get_jst_today() -> date:
    return datetime.now(JST).date()


def get_target_date(default_days_ahead: int = 1) -> str:
    return (get_jst_today() + timedelta(days=default_days_ahead)).isoformat()


def build_race_url(date_str: str, venue_name: str = "", race_number: Any = "") -> str:
    params: List[str] = [
        "utm_source=youtube",
        "utm_medium=video",
        f"utm_campaign={date_str.replace('-', '')}_preview",
    ]
    if venue_name:
        params.append(f"venue={quote(str(venue_name))}")
    if race_number:
        params.append(f"race={quote(str(race_number))}")
    return f"{SITE_BASE_URL}/races/{date_str}?{'&'.join(params)}"


def build_video_url(date_str: str, utm_content: str, venue_name: str = "", race_number: Any = "") -> str:
    base = build_race_url(date_str, venue_name=venue_name, race_number=race_number)
    return f"{base}&utm_content={quote(utm_content)}"


def _api_base_url() -> str:
    return (os.getenv("API_BASE_URL") or os.getenv("NEXT_PUBLIC_API_URL") or DEFAULT_API_BASE_URL).rstrip("/")


def _request_prediction_endpoint(endpoint: str, retries: int = 3, delay_seconds: int = 15) -> Optional[Any]:
    url = f"{_api_base_url()}/api/v1/predictions/{endpoint.lstrip('/')}"
    last_error = ""
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(url, timeout=90)
            if response.status_code == 404:
                return None
            if response.ok:
                return response.json()
            last_error = f"status={response.status_code}, body={response.text[:120]}"
        except requests.RequestException as exc:
            last_error = str(exc)
        if attempt < retries:
            time.sleep(delay_seconds)
    raise RuntimeError(f"API取得に失敗しました: {url} ({last_error})")


def fetch_race_day_payload(target_date: str) -> Dict[str, Any]:
    payload = _request_prediction_endpoint(target_date)
    if not isinstance(payload, dict):
        return {"jra": [], "nar": []}
    return {
        "jra": payload.get("jra") if isinstance(payload.get("jra"), list) else [],
        "nar": payload.get("nar") if isinstance(payload.get("nar"), list) else [],
    }


def fetch_weekly_grade_races() -> List[Dict[str, Any]]:
    payload = _request_prediction_endpoint("weekly-grade-races", retries=2, delay_seconds=5)
    return payload if isinstance(payload, list) else []


def _grade_key(item: Dict[str, Any]) -> str:
    return f"{item.get('race_date')}::{item.get('venue_name')}::{item.get('race_number')}"


def _build_grade_map(weekly_grade_races: Iterable[Dict[str, Any]], target_date: str) -> Dict[str, Dict[str, Any]]:
    result: Dict[str, Dict[str, Any]] = {}
    for race in weekly_grade_races:
        if str(race.get("race_date")) != target_date:
            continue
        result[_grade_key(race)] = race
    return result


def _to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _position_labels(predictions: List[HorseVideoData]) -> None:
    values = [horse.start_1c_indicator for horse in predictions if horse.start_1c_indicator is not None]
    if not values:
        return
    min_score = min(values)
    max_score = max(values)
    score_range = max_score - min_score
    for horse in predictions:
        if horse.start_1c_indicator is None:
            horse.position_label = "-"
            continue
        if score_range < 0.01:
            horse.position_label = "中団"
            continue
        ratio = (horse.start_1c_indicator - min_score) / score_range
        if ratio < 0.35:
            horse.position_label = "後方"
        elif ratio > 0.65:
            horse.position_label = "先行"
        else:
            horse.position_label = "中団"


def _normalize_race(raw: Dict[str, Any], grade_map: Dict[str, Dict[str, Any]]) -> RaceVideoData:
    race_number = _to_int(raw.get("race_number"))
    grade_info = grade_map.get(_grade_key(raw))
    predictions: List[HorseVideoData] = []
    for item in raw.get("predictions") or []:
        if not isinstance(item, dict):
            continue
        predictions.append(
            HorseVideoData(
                horse_name=str(item.get("horse_name") or "?"),
                horse_number=_to_int(item.get("horse_number")),
                waku_number=_to_int(item.get("waku_number")) if item.get("waku_number") is not None else None,
                mark=str(item.get("mark") or ""),
                deviation_score=_to_float(item.get("deviation_score")),
                start_1c_indicator=_to_float(item.get("start_1c_indicator")),
            )
        )
    total_horses = len([horse for horse in predictions if horse.horse_number > 0])
    for horse in predictions:
        if horse.waku_number is None or not 1 <= horse.waku_number <= 8:
            horse.waku_number = infer_waku_number(horse.horse_number, total_horses)
    _position_labels(predictions)
    predictions.sort(key=lambda horse: (horse.horse_number <= 0, horse.horse_number))
    return RaceVideoData(
        id=str(raw.get("id") or f"{raw.get('venue_name', '')}-{race_number}"),
        race_date=str(raw.get("race_date") or ""),
        venue_name=str(raw.get("venue_name") or ""),
        race_number=race_number,
        race_name=str(raw.get("race_name") or ""),
        course_type=raw.get("course_type"),
        distance=_to_int(raw.get("distance")) if raw.get("distance") is not None else None,
        grade=str(grade_info.get("grade") or "") if grade_info else None,
        predictions=predictions,
        horse_number_advantages=raw.get("horse_number_advantages") or [],
    )


def normalize_venues(payload: Dict[str, Any], weekly_grade_races: List[Dict[str, Any]], target_date: str) -> List[VenueVideoData]:
    grade_map = _build_grade_map(weekly_grade_races, target_date)
    venues: List[VenueVideoData] = []
    for race_type, key in (("中央", "jra"), ("地方", "nar")):
        for raw_venue in payload.get(key) or []:
            if not isinstance(raw_venue, dict):
                continue
            races = [_normalize_race(raw_race, grade_map) for raw_race in raw_venue.get("races") or [] if isinstance(raw_race, dict)]
            races = sorted([race for race in races if race.race_number > 0], key=lambda race: race.race_number)
            if races:
                venues.append(VenueVideoData(venue_name=str(raw_venue.get("venue_name") or ""), race_type=race_type, races=races))
    return venues


def load_venues_for_date(target_date: str) -> List[VenueVideoData]:
    payload = fetch_race_day_payload(target_date)
    weekly_grade_races = fetch_weekly_grade_races()
    return normalize_venues(payload, weekly_grade_races, target_date)


def top_by_deviation(race: RaceVideoData, limit: int = 3) -> List[HorseVideoData]:
    scored = [horse for horse in race.predictions if horse.deviation_score is not None]
    return sorted(scored, key=lambda horse: horse.deviation_score or -999, reverse=True)[:limit]


def top_by_position(race: RaceVideoData, limit: int = 2) -> List[HorseVideoData]:
    scored = [horse for horse in race.predictions if horse.start_1c_indicator is not None]
    return sorted(scored, key=lambda horse: horse.start_1c_indicator or -999, reverse=True)[:limit]


def pick_shorts_targets(venues: List[VenueVideoData], max_shorts: int) -> List[RaceVideoData]:
    candidates: List[RaceVideoData] = []
    for venue in venues:
        candidates.extend(venue.races)

    def priority(race: RaceVideoData) -> tuple[int, float, int]:
        top_score = max((horse.deviation_score or 0 for horse in race.predictions), default=0)
        grade_weight = 0 if race.is_grade_race else 1
        main_weight = 0 if race.race_number in {10, 11, 12} else 1
        return (grade_weight, main_weight, -top_score)

    return sorted(candidates, key=priority)[:max(0, max_shorts)]
