from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import quote, urlencode

import requests


SITE_BASE_URL = "https://uma-free.com"
YOUTUBE_CAMPAIGN_NAME = "daily_race_video_v2"
DEFAULT_API_BASE_URL = "https://keiba-site-v1-761440273070.us-west1.run.app"
JST = timezone(timedelta(hours=9))
PROJECT_ROOT = Path(__file__).resolve().parents[3]
VENUE_SLUGS_PATH = PROJECT_ROOT / "frontend" / "lib" / "venue-slugs.json"


@dataclass
class HorseVideoData:
    horse_name: str
    horse_number: int
    waku_number: Optional[int]
    mark: str
    deviation_score: Optional[float]
    start_1c_indicator: Optional[float]
    position_label: str = "-"
    unpredictable_reason: str = ""


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
    omission_reason: str = ""

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
    excluded_races: List[RaceVideoData] = field(default_factory=list)

    @property
    def grade_races(self) -> List[RaceVideoData]:
        return [race for race in self.races if race.is_grade_race]


def get_jst_today() -> date:
    return datetime.now(JST).date()


def get_target_date(default_days_ahead: int = 1) -> str:
    return (get_jst_today() + timedelta(days=default_days_ahead)).isoformat()


def normalize_venue_name(venue_name: str) -> str:
    return re.sub(r"\s+", "", str(venue_name or "").strip().removesuffix("競馬場"))


@lru_cache(maxsize=1)
def load_venue_slug_registry() -> Dict[str, Dict[str, str]]:
    try:
        payload = json.loads(VENUE_SLUGS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"競馬場slugレジストリを読み込めません: {VENUE_SLUGS_PATH} ({exc})") from exc
    aliases = payload.get("aliases")
    labels = payload.get("labels")
    if not isinstance(aliases, dict) or not isinstance(labels, dict):
        raise RuntimeError(f"競馬場slugレジストリの形式が不正です: {VENUE_SLUGS_PATH}")
    return {
        "aliases": {str(key): str(value) for key, value in aliases.items()},
        "labels": {str(key): str(value) for key, value in labels.items()},
    }


def venue_name_to_slug(venue_name: str) -> str:
    normalized = normalize_venue_name(venue_name)
    aliases = load_venue_slug_registry()["aliases"]
    return aliases.get(normalized, quote(normalized.lower(), safe=""))


def build_race_path(date_str: str, venue_name: str = "", race_number: Any = "") -> str:
    if venue_name and race_number:
        try:
            normalized_race_number = int(race_number)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"レース番号が不正です: {race_number}") from exc
        return f"/races/{date_str}/{venue_name_to_slug(venue_name)}/{normalized_race_number}"
    return f"/races/{date_str}"


def build_video_url(
    date_str: str = "",
    utm_content: str = "",
    venue_name: str = "",
    race_number: Any = "",
    scope: str = "date",
) -> str:
    """動画の内容に対応するページへ誘導し、動画別の流入帰属を保持するURLを返す。

    scope="race" は1レースだけを扱う動画向けで、そのレースの詳細ページへ着地させる。
    scope="date" は複数レースをまとめた動画向けで、その日のレース一覧へ着地させる。
    対象日が分からない場合だけトップページへ戻す。
    """
    params = {
        "utm_source": "youtube",
        "utm_medium": "video",
        "utm_campaign": YOUTUBE_CAMPAIGN_NAME,
    }
    if utm_content:
        params["utm_content"] = utm_content

    query = urlencode(params)
    if not date_str:
        return f"{SITE_BASE_URL}?{query}"

    if scope == "race" and venue_name and race_number:
        path = build_race_path(date_str, venue_name, race_number)
    else:
        path = build_race_path(date_str)
    return f"{SITE_BASE_URL}{path}?{query}"


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
                unpredictable_reason=str(item.get("unpredictable_reason") or "").strip(),
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
    return enrich_missing_race_grades(venues)


def enrich_missing_race_grades(
    venues: List[VenueVideoData],
) -> List[VenueVideoData]:
    """近日重賞APIの期間外でも、既存の重賞辞書と名称表記から補完する。"""
    try:
        from crud.race_crud import _detect_grade
    except Exception as exc:
        # DBエンジン初期化失敗などがあっても、API取得済みの一般レースは利用する。
        print(
            "レース名による重賞補完を利用できません: "
            f"{type(exc).__name__}"
        )
        return venues

    for venue in venues:
        for race in venue.races:
            if race.grade:
                continue
            detected = _detect_grade(race.race_name, venue.race_type)
            if detected:
                race.grade = detected
    return venues


def merge_expected_races(
    venues: List[VenueVideoData],
    expected_races: Iterable[Any],
    target_date: str,
    expected_grades: Optional[Dict[str, str]] = None,
) -> List[VenueVideoData]:
    """DBに存在する全レースを基準に、予測未生成レースを空データとして補う。

    公開APIは予測を1件も持たないレースを返さないため、そのままでは
    欠損レースを把握できない。ここで空レースを補い、後段でそのレースだけを
    除外できるようにする。重賞判定はPredictionの有無に依存させない。
    """
    grade_by_race_id = expected_grades or {}
    venue_map = {
        (venue.race_type, normalize_venue_name(venue.venue_name)): venue
        for venue in venues
    }
    existing_races_by_id = {
        race.id: race
        for venue in venues
        for race in venue.races
    }
    existing_race_ids = set(existing_races_by_id)

    for expected in expected_races:
        race_id = str(getattr(expected, "id", "") or "")
        race_type = str(getattr(expected, "race_type", "") or "")
        venue_name = str(getattr(expected, "venue_name", "") or "")
        race_number = _to_int(getattr(expected, "race_number", 0))
        if race_id in existing_race_ids:
            existing_race = existing_races_by_id[race_id]
            if not existing_race.grade and grade_by_race_id.get(race_id):
                existing_race.grade = grade_by_race_id[race_id]
            continue
        if not race_id or not race_type or not venue_name or race_number <= 0:
            continue

        key = (race_type, normalize_venue_name(venue_name))
        venue = venue_map.get(key)
        if venue is None:
            venue = VenueVideoData(venue_name=venue_name, race_type=race_type, races=[])
            venues.append(venue)
            venue_map[key] = venue

        venue.races.append(
            RaceVideoData(
                id=race_id,
                race_date=target_date,
                venue_name=venue_name,
                race_number=race_number,
                race_name=str(getattr(expected, "race_name", "") or ""),
                course_type=getattr(expected, "course_type", None),
                distance=_to_int(getattr(expected, "distance", None))
                if getattr(expected, "distance", None) is not None
                else None,
                grade=grade_by_race_id.get(race_id) or None,
                predictions=[],
            )
        )
        existing_race_ids.add(race_id)
        existing_races_by_id[race_id] = venue.races[-1]

    for venue in venues:
        venue.races.sort(key=lambda race: race.race_number)
    return sorted(venues, key=lambda venue: (venue.race_type, venue_name_to_slug(venue.venue_name)))


def _load_venues_for_date_from_database(
    target_date: str,
    *,
    force_refresh: bool = False,
) -> List[VenueVideoData]:
    """IAPトンネル後の本番DBを正本として翌日の全レースを取得する。"""
    from crud import race_crud
    from database import models
    from database.database import SessionLocal

    parsed_date = date.fromisoformat(target_date)
    db = SessionLocal()
    try:
        if force_refresh:
            race_crud.invalidate_predictions_cache(parsed_date)
        expected_races = (
            db.query(models.Race)
            .filter(
                models.Race.race_date == parsed_date,
                models.Race.race_type.in_(["中央", "地方"]),
            )
            .order_by(models.Race.venue_name, models.Race.race_number)
            .all()
        )
        payload = race_crud.get_predictions_by_date(db, parsed_date)
        weekly_grade_races = race_crud.get_weekly_grade_races(db)
        venues = normalize_venues(payload, weekly_grade_races, target_date)
        expected_grades = {
            race.id: race_crud._detect_grade(race.race_name, race.race_type)
            for race in expected_races
        }
        return merge_expected_races(
            venues,
            expected_races,
            target_date,
            expected_grades=expected_grades,
        )
    finally:
        db.close()


def load_venues_for_date(
    target_date: str,
    *,
    force_refresh: bool = False,
    diagnostics: Optional[Dict[str, Any]] = None,
) -> List[VenueVideoData]:
    load_diagnostics = diagnostics if diagnostics is not None else {}
    if os.getenv("DATABASE_URL"):
        try:
            venues = _load_venues_for_date_from_database(
                target_date,
                force_refresh=force_refresh,
            )
            load_diagnostics.update(
                {
                    "data_source": "database",
                    "fallback_used": False,
                    "database_error_type": "",
                }
            )
            return venues
        except Exception as exc:
            # 接続文字列や認証情報をログへ出さず、公開APIへ読み取り経路だけを切り替える。
            load_diagnostics.update(
                {
                    "data_source": "api_fallback",
                    "fallback_used": True,
                    "database_error_type": type(exc).__name__,
                }
            )
            print(
                "本番DBから動画データを取得できないため、公開予測APIへ切り替えます: "
                f"{type(exc).__name__}"
            )
    else:
        load_diagnostics.update(
            {
                "data_source": "api",
                "fallback_used": False,
                "database_error_type": "",
            }
        )

    try:
        payload = fetch_race_day_payload(target_date)
        weekly_grade_races = fetch_weekly_grade_races()
        return normalize_venues(payload, weekly_grade_races, target_date)
    except Exception as exc:
        raise RuntimeError(
            f"公開予測APIから動画データを取得できません: {type(exc).__name__}"
        ) from exc


def top_by_deviation(race: RaceVideoData, limit: int = 3) -> List[HorseVideoData]:
    scored = [horse for horse in race.predictions if horse.deviation_score is not None]
    return sorted(scored, key=lambda horse: horse.deviation_score or -999, reverse=True)[:limit]


def top_by_position(race: RaceVideoData, limit: int = 2) -> List[HorseVideoData]:
    scored = [horse for horse in race.predictions if horse.start_1c_indicator is not None]
    return sorted(scored, key=lambda horse: horse.start_1c_indicator or -999, reverse=True)[:limit]


def grade_priority(grade: Optional[str]) -> int:
    normalized = str(grade or "").upper().replace(" ", "")
    normalized = (
        normalized.replace("Ｇ", "G")
        .replace("Ⅰ", "1")
        .replace("Ⅱ", "2")
        .replace("Ⅲ", "3")
        .replace("J・G", "JG")
        .replace("J-G", "JG")
    )
    priorities = {
        "G1": 0,
        "JPN1": 1,
        "JG1": 1,
        "G2": 2,
        "JPN2": 3,
        "JG2": 3,
        "G3": 4,
        "JPN3": 5,
        "JG3": 5,
    }
    if normalized in priorities:
        return priorities[normalized]
    return 6 if normalized else 99


def race_feature_priority(race: RaceVideoData) -> tuple[int, int, int, int, str, str]:
    grade_rank = grade_priority(race.grade)
    is_graded = grade_rank < 99
    main_rank = 0 if race.race_number == 11 else 1
    field_size = len([horse for horse in race.predictions if horse.horse_number > 0])
    return (
        grade_rank,
        0 if is_graded else main_rank,
        -field_size,
        race.race_number,
        venue_name_to_slug(race.venue_name),
        race.id,
    )


def pick_featured_race(venue: VenueVideoData) -> Optional[RaceVideoData]:
    return min(venue.races, key=race_feature_priority) if venue.races else None


def order_venues_for_publication(venues: List[VenueVideoData]) -> List[VenueVideoData]:
    def venue_priority(venue: VenueVideoData) -> tuple:
        featured = pick_featured_race(venue)
        return race_feature_priority(featured) if featured else (999, 999, 0, 999, venue.venue_name, "")

    return sorted(venues, key=venue_priority)


def order_venues_for_daily_compilation(venues: List[VenueVideoData]) -> List[VenueVideoData]:
    """日次統合動画向けに、中央競馬を先にして開催場単位で並べる。"""

    race_type_priority = {"中央": 0, "地方": 1}
    return sorted(
        venues,
        key=lambda venue: (
            race_type_priority.get(str(venue.race_type).strip(), 2),
            venue_name_to_slug(venue.venue_name),
        ),
    )


def pick_shorts_targets(venues: List[VenueVideoData], max_shorts: int) -> List[RaceVideoData]:
    candidates: List[RaceVideoData] = []
    for venue in venues:
        candidates.extend(venue.races)
    return sorted(candidates, key=race_feature_priority)[:max(0, max_shorts)]


def pick_daily_short_races(venues: List[VenueVideoData]) -> List[RaceVideoData]:
    """重賞を全件、重賞がなければ各開催場のメインレースを1件ずつ選ぶ。"""

    ordered_venues = order_venues_for_daily_compilation(venues)
    grade_races = [
        race
        for venue in ordered_venues
        for race in venue.races
        if race.is_grade_race
    ]
    if grade_races:
        return sorted(
            grade_races,
            key=lambda race: (
                grade_priority(race.grade),
                0 if any(
                    venue.race_type == "中央" and venue.venue_name == race.venue_name
                    for venue in ordered_venues
                ) else 1,
                venue_name_to_slug(race.venue_name),
                race.race_number,
                race.id,
            ),
        )

    main_races: List[RaceVideoData] = []
    for venue in ordered_venues:
        if not venue.races:
            continue
        race_11 = next((race for race in venue.races if race.race_number == 11), None)
        main_races.append(race_11 or max(venue.races, key=lambda race: race.race_number))
    return main_races
