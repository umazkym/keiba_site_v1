from __future__ import annotations

import math
import re
import threading
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import quote

from sqlalchemy import and_, case, desc, func, or_
from sqlalchemy.orm import Session, load_only

from database import models


_VENUE_SLUGS: Dict[str, str] = {
    "札幌": "sapporo",
    "函館": "hakodate",
    "福島": "fukushima",
    "新潟": "niigata",
    "東京": "tokyo",
    "中山": "nakayama",
    "中京": "chukyo",
    "京都": "kyoto",
    "阪神": "hanshin",
    "小倉": "kokura",
    "門別": "monbetsu",
    "盛岡": "morioka",
    "水沢": "mizusawa",
    "浦和": "urawa",
    "船橋": "funabashi",
    "大井": "ohi",
    "川崎": "kawasaki",
    "金沢": "kanazawa",
    "笠松": "kasamatsu",
    "名古屋": "nagoya",
    "園田": "sonoda",
    "姫路": "himeji",
    "高知": "kochi",
    "佐賀": "saga",
    "帯広": "obihiro",
    "帯広ば": "obihiro",
    "ばんえい帯広": "obihiro",
}
_SLUG_VENUES = {slug: venue for venue, slug in _VENUE_SLUGS.items()}
_SLUG_VENUES["obihiro"] = "帯広ば"

_COURSE_TYPE_TO_SLUG = {
    "芝": "turf",
    "ダ": "dirt",
    "ダート": "dirt",
    "障": "obstacle",
    "障害": "obstacle",
}
_COURSE_SLUG_TO_TYPES = {
    "turf": ("芝",),
    "dirt": ("ダ", "ダート"),
    "obstacle": ("障", "障害"),
}
_ENTITY_MIN_SAMPLE = {
    "horse": 5,
    "jockey": 50,
    "trainer": 50,
    "course": 100,
}
_CACHE_MAX_ENTRIES = 512


class _TTLCache:
    def __init__(self) -> None:
        self._items: Dict[str, Tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any:
        with self._lock:
            item = self._items.get(key)
            if item is None:
                return None
            expires_at, value = item
            if expires_at <= time.monotonic():
                self._items.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        with self._lock:
            if len(self._items) >= _CACHE_MAX_ENTRIES:
                oldest_key = min(self._items, key=lambda item_key: self._items[item_key][0])
                self._items.pop(oldest_key, None)
            self._items[key] = (time.monotonic() + ttl_seconds, value)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


_cache = _TTLCache()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def _round_optional(value: Any, digits: int = 1) -> Optional[float]:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(numeric):
        return None
    return round(numeric, digits)


def _metric_columns() -> Tuple[Any, ...]:
    return (
        func.count(models.Result.id),
        func.sum(case((models.Result.rank == 1, 1), else_=0)),
        func.sum(case((models.Result.rank <= 3, 1), else_=0)),
        func.avg(models.Result.rank),
        func.avg(models.Result.popularity),
    )


def _rate_from_row(row: Sequence[Any]) -> Dict[str, Any]:
    sample_size = int(row[0] or 0)
    wins = int(row[1] or 0)
    places = int(row[2] or 0)
    return {
        "sample_size": sample_size,
        "wins": wins,
        "places": places,
        "win_rate": _safe_rate(wins, sample_size),
        "place_rate": _safe_rate(places, sample_size),
        "average_rank": _round_optional(row[3]),
        "average_popularity": _round_optional(row[4]),
    }


def _empty_rate() -> Dict[str, Any]:
    return _rate_from_row((0, 0, 0, None, None))


def _course_type_label(course_type: Optional[str]) -> str:
    if course_type in ("ダ", "ダート"):
        return "ダート"
    if course_type in ("障", "障害"):
        return "障害"
    return course_type or "条件不明"


def _course_label(course_type: Optional[str], distance: Optional[int]) -> str:
    type_label = _course_type_label(course_type)
    return f"{type_label}{distance}m" if distance else type_label


def _venue_slug(venue_name: str) -> str:
    normalized = (venue_name or "").strip().replace("競馬場", "")
    return _VENUE_SLUGS.get(normalized, quote(normalized.lower(), safe=""))


def _course_slug(course_type: Optional[str], distance: Optional[int]) -> str:
    prefix = _COURSE_TYPE_TO_SLUG.get(course_type or "", "course")
    return f"{prefix}-{distance}m" if distance else prefix


def _race_url(race_date: date, venue_name: str, race_number: int) -> str:
    return f"/races/{race_date.isoformat()}/{_venue_slug(venue_name)}/{race_number}"


def _dataset_range(db: Session) -> Tuple[Optional[date], Optional[date]]:
    row = db.query(func.min(models.Race.race_date), func.max(models.Race.race_date)).one()
    return row[0], row[1]


def _is_recent(last_race_date: Optional[date], dataset_last_date: Optional[date]) -> bool:
    if not last_race_date or not dataset_last_date:
        return False
    return last_race_date >= dataset_last_date - timedelta(days=365)


def _base_rate(
    db: Session,
    filters: Iterable[Any],
) -> Dict[str, Any]:
    row = (
        db.query(*_metric_columns())
        .select_from(models.Result)
        .join(models.Race, models.Result.race_id == models.Race.id)
        .filter(models.Result.rank.isnot(None), *filters)
        .one()
    )
    return _rate_from_row(row)


def _segment_stats(
    db: Session,
    filters: Iterable[Any],
    group_columns: Sequence[Any],
    label_builder: Callable[[Sequence[Any]], Tuple[str, str]],
    *,
    joins: Sequence[Tuple[Any, Any]] = (),
    minimum_sample: int = 1,
    limit: int = 12,
) -> List[Dict[str, Any]]:
    query = (
        db.query(*group_columns, *_metric_columns())
        .select_from(models.Result)
        .join(models.Race, models.Result.race_id == models.Race.id)
    )
    for target, condition in joins:
        query = query.join(target, condition)
    rows = (
        query.filter(models.Result.rank.isnot(None), *filters)
        .group_by(*group_columns)
        .having(func.count(models.Result.id) >= minimum_sample)
        .all()
    )

    items: List[Dict[str, Any]] = []
    prefix_size = len(group_columns)
    for row in rows:
        group_values = row[:prefix_size]
        key, label = label_builder(group_values)
        items.append({
            "key": key,
            "label": label,
            **_rate_from_row(row[prefix_size:]),
        })
    items.sort(key=lambda item: (-item["sample_size"], -item["place_rate"], item["label"]))
    return items[:limit]


def _entity_summary(
    entity_type: str,
    entity_id: str,
    name: str,
    subtitle: str,
    sample_size: int,
    last_race_date: Optional[date],
    indexable: bool,
    url: str,
) -> Dict[str, Any]:
    return {
        "entity_type": entity_type,
        "id": entity_id,
        "name": name,
        "subtitle": subtitle,
        "url": url,
        "sample_size": int(sample_size or 0),
        "last_race_date": last_race_date,
        "indexable": indexable,
    }


def _directory_people_or_horses(
    db: Session,
    entity_type: str,
    *,
    limit: int,
    offset: int,
    indexable_only: bool,
) -> Dict[str, Any]:
    model = {
        "horse": models.Horse,
        "jockey": models.Jockey,
        "trainer": models.Trainer,
    }[entity_type]
    id_column = model.id
    name_column = model.name
    relation_column = {
        "horse": models.Result.horse_id,
        "jockey": models.Result.jockey_id,
        "trainer": models.Result.trainer_id,
    }[entity_type]
    minimum_sample = _ENTITY_MIN_SAMPLE[entity_type]
    _, dataset_last = _dataset_range(db)
    active_cutoff = dataset_last - timedelta(days=365) if dataset_last else None

    sample_count = func.count(models.Result.id)
    last_date = func.max(models.Race.race_date)
    query = (
        db.query(id_column, name_column, sample_count.label("sample_size"), last_date.label("last_race_date"))
        .select_from(model)
        .join(models.Result, relation_column == id_column)
        .join(models.Race, models.Result.race_id == models.Race.id)
        .filter(models.Result.rank.isnot(None), name_column.isnot(None))
        .group_by(id_column, name_column)
        .having(sample_count >= minimum_sample)
    )
    if indexable_only and active_cutoff:
        query = query.having(last_date >= active_cutoff)

    total = query.count()
    rows = (
        query.order_by(desc(last_date), desc(sample_count), name_column)
        .offset(offset)
        .limit(limit)
        .all()
    )
    label = {"horse": "競走馬", "jockey": "騎手", "trainer": "調教師"}[entity_type]
    path = {"horse": "horses", "jockey": "jockeys/data", "trainer": "trainers"}[entity_type]
    items = [
        _entity_summary(
            entity_type,
            str(row[0]),
            row[1],
            f"{label}データ・過去{int(row[2])}走",
            int(row[2]),
            row[3],
            int(row[2]) >= minimum_sample and _is_recent(row[3], dataset_last),
            f"/{path}/{quote(str(row[0]), safe='')}",
        )
        for row in rows
    ]
    return {
        "entity_type": entity_type,
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items,
    }


def _directory_courses(
    db: Session,
    *,
    limit: int,
    offset: int,
    indexable_only: bool,
) -> Dict[str, Any]:
    sample_count = func.count(models.Result.id)
    last_date = func.max(models.Race.race_date)
    race_count = func.count(func.distinct(models.Race.id))
    _, dataset_last = _dataset_range(db)
    query = (
        db.query(
            models.Race.venue_name,
            models.Race.course_type,
            models.Race.distance,
            sample_count.label("sample_size"),
            race_count.label("race_count"),
            last_date.label("last_race_date"),
        )
        .select_from(models.Race)
        .join(models.Result, models.Result.race_id == models.Race.id)
        .filter(
            models.Result.rank.isnot(None),
            models.Race.course_type.isnot(None),
            models.Race.distance.isnot(None),
        )
        .group_by(models.Race.venue_name, models.Race.course_type, models.Race.distance)
        .having(sample_count >= (_ENTITY_MIN_SAMPLE["course"] if indexable_only else 10))
    )
    total = query.count()
    rows = (
        query.order_by(desc(last_date), desc(sample_count))
        .offset(offset)
        .limit(limit)
        .all()
    )
    items = []
    for venue_name, course_type, distance, samples, races, latest in rows:
        venue_slug = _venue_slug(venue_name)
        course_slug = _course_slug(course_type, distance)
        samples_int = int(samples or 0)
        items.append(_entity_summary(
            "course",
            f"{venue_slug}/{course_slug}",
            f"{venue_name}{_course_label(course_type, distance)}",
            f"過去{int(races or 0)}レース・{samples_int}頭",
            samples_int,
            latest,
            samples_int >= _ENTITY_MIN_SAMPLE["course"],
            f"/courses/{venue_slug}/{course_slug}",
        ))
    return {
        "entity_type": "course",
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items,
    }


def list_entities(
    db: Session,
    entity_type: str,
    *,
    limit: int = 24,
    offset: int = 0,
    indexable_only: bool = False,
) -> Dict[str, Any]:
    if entity_type not in {"course", "horse", "jockey", "trainer"}:
        raise ValueError("unsupported entity type")
    safe_limit = max(1, min(limit, 5000))
    safe_offset = max(0, offset)
    cache_key = f"directory:{entity_type}:{safe_limit}:{safe_offset}:{int(indexable_only)}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached
    if entity_type == "course":
        result = _directory_courses(
            db,
            limit=safe_limit,
            offset=safe_offset,
            indexable_only=indexable_only,
        )
    else:
        result = _directory_people_or_horses(
            db,
            entity_type,
            limit=safe_limit,
            offset=safe_offset,
            indexable_only=indexable_only,
        )
    _cache.set(cache_key, result, 3600)
    return result


def search_entities(
    db: Session,
    query_text: str,
    *,
    limit: int = 20,
) -> Dict[str, Any]:
    query = re.sub(r"\s+", "", (query_text or "").strip())
    safe_limit = max(1, min(limit, 40))
    if not query:
        return {"query": "", "total": 0, "items": []}
    cache_key = f"search:{query}:{safe_limit}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    items: List[Dict[str, Any]] = []
    for entity_type, model, relation_column, path, label in [
        ("horse", models.Horse, models.Result.horse_id, "horses", "競走馬"),
        ("jockey", models.Jockey, models.Result.jockey_id, "jockeys/data", "騎手"),
        ("trainer", models.Trainer, models.Result.trainer_id, "trainers", "調教師"),
    ]:
        sample_count = func.count(models.Result.id)
        last_date = func.max(models.Race.race_date)
        rows = (
            db.query(model.id, model.name, sample_count, last_date)
            .select_from(model)
            .join(models.Result, relation_column == model.id)
            .join(models.Race, models.Result.race_id == models.Race.id)
            .filter(
                models.Result.rank.isnot(None),
                func.lower(model.name).like(f"%{query.lower()}%"),
            )
            .group_by(model.id, model.name)
            .order_by(
                case((func.lower(model.name) == query.lower(), 0), else_=1),
                desc(last_date),
                desc(sample_count),
            )
            .limit(max(4, safe_limit // 2))
            .all()
        )
        _, dataset_last = _dataset_range(db)
        for entity_id, name, samples, latest in rows:
            samples_int = int(samples or 0)
            items.append({
                "entity_type": entity_type,
                "id": str(entity_id),
                "name": name,
                "description": f"{label}データ・集計対象{samples_int}走",
                "url": f"/{path}/{quote(str(entity_id), safe='')}",
                "sample_size": samples_int,
                "indexable": (
                    samples_int >= _ENTITY_MIN_SAMPLE[entity_type]
                    and _is_recent(latest, dataset_last)
                ),
            })

    course_rows = list_entities(db, "course", limit=5000, indexable_only=False)["items"]
    for item in course_rows:
        normalized_name = re.sub(r"\s+", "", item["name"]).lower()
        if query.lower() in normalized_name:
            items.append({
                "entity_type": "course",
                "id": item["id"],
                "name": item["name"],
                "description": item["subtitle"],
                "url": item["url"],
                "sample_size": item["sample_size"],
                "indexable": item["indexable"],
            })

    items.sort(
        key=lambda item: (
            0 if re.sub(r"\s+", "", item["name"]).lower() == query.lower() else 1,
            0 if re.sub(r"\s+", "", item["name"]).lower().startswith(query.lower()) else 1,
            -item["sample_size"],
            item["name"],
        )
    )
    result = {"query": query_text.strip(), "total": len(items), "items": items[:safe_limit]}
    _cache.set(cache_key, result, 600)
    return result


def _recent_runs(
    db: Session,
    filters: Iterable[Any],
    *,
    limit: int = 12,
) -> List[Dict[str, Any]]:
    rows = (
        db.query(models.Result, models.Race, models.Horse)
        .options(
            load_only(
                models.Race.id,
                models.Race.race_date,
                models.Race.venue_name,
                models.Race.race_number,
                models.Race.race_name,
                models.Race.course_type,
                models.Race.distance,
            )
        )
        .select_from(models.Result)
        .join(models.Race, models.Result.race_id == models.Race.id)
        .join(models.Horse, models.Result.horse_id == models.Horse.id)
        .filter(models.Result.rank.isnot(None), *filters)
        .order_by(desc(models.Race.race_date), desc(models.Race.race_number))
        .limit(limit)
        .all()
    )
    return [
        {
            "race_id": race.id,
            "race_date": race.race_date,
            "venue_name": race.venue_name,
            "race_number": race.race_number,
            "race_name": race.race_name,
            "course_label": _course_label(race.course_type, race.distance),
            "horse_id": horse.id,
            "horse_name": horse.name,
            "horse_number": result.horse_number,
            "rank": result.rank,
            "popularity": result.popularity,
            "odds": result.odds,
            "waku_number": result.waku_number,
            "horse_weight": result.horse_weight,
            "horse_weight_diff": result.horse_weight_diff,
            "agari_3f": result.agari_3f,
            "corner_positions": result.corner_positions if isinstance(result.corner_positions, list) else [],
            "url": _race_url(race.race_date, race.venue_name, race.race_number),
        }
        for result, race, horse in rows
    ]


def _upcoming_races(
    db: Session,
    filters: Iterable[Any],
    *,
    limit: int = 12,
) -> List[Dict[str, Any]]:
    _, dataset_last = _dataset_range(db)
    if dataset_last is None:
        return []
    cutoff = dataset_last - timedelta(days=1)
    rows = (
        db.query(models.Result, models.Race, models.Horse, models.Prediction)
        .options(
            load_only(
                models.Race.id,
                models.Race.race_date,
                models.Race.venue_name,
                models.Race.race_number,
                models.Race.race_name,
                models.Race.course_type,
                models.Race.distance,
            )
        )
        .select_from(models.Result)
        .join(models.Race, models.Result.race_id == models.Race.id)
        .join(models.Horse, models.Result.horse_id == models.Horse.id)
        .outerjoin(
            models.Prediction,
            and_(
                models.Prediction.race_id == models.Result.race_id,
                models.Prediction.horse_id == models.Result.horse_id,
            ),
        )
        .filter(
            models.Result.rank.is_(None),
            models.Race.race_date >= cutoff,
            *filters,
        )
        .order_by(models.Race.race_date, models.Race.venue_name, models.Race.race_number)
        .limit(limit)
        .all()
    )
    return [
        {
            "race_id": race.id,
            "race_date": race.race_date,
            "venue_name": race.venue_name,
            "race_number": race.race_number,
            "race_name": race.race_name,
            "course_label": _course_label(race.course_type, race.distance),
            "horse_id": horse.id,
            "horse_name": horse.name,
            "horse_number": result.horse_number,
            "deviation_score": prediction.deviation_score if prediction else None,
            "mark": prediction.mark if prediction else None,
            "url": _race_url(race.race_date, race.venue_name, race.race_number),
        }
        for result, race, horse, prediction in rows
    ]


def _prediction_history(
    db: Session,
    horse_id: str,
    *,
    limit: int = 12,
) -> List[Dict[str, Any]]:
    rows = (
        db.query(models.Prediction, models.Race, models.Result.rank)
        .options(
            load_only(
                models.Race.id,
                models.Race.race_date,
                models.Race.venue_name,
                models.Race.race_number,
                models.Race.race_name,
            )
        )
        .select_from(models.Prediction)
        .join(models.Race, models.Prediction.race_id == models.Race.id)
        .outerjoin(
            models.Result,
            and_(
                models.Result.race_id == models.Prediction.race_id,
                models.Result.horse_id == models.Prediction.horse_id,
            ),
        )
        .filter(models.Prediction.horse_id == horse_id)
        .order_by(desc(models.Race.race_date), desc(models.Race.race_number))
        .limit(limit)
        .all()
    )
    return [
        {
            "race_id": prediction.race_id,
            "race_date": race.race_date,
            "venue_name": race.venue_name,
            "race_number": race.race_number,
            "race_name": race.race_name,
            "deviation_score": prediction.deviation_score,
            "mark": prediction.mark,
            "rank": rank,
            "url": _race_url(race.race_date, race.venue_name, race.race_number),
        }
        for prediction, race, rank in rows
    ]


def _entity_segments(
    db: Session,
    filters: Iterable[Any],
) -> Dict[str, List[Dict[str, Any]]]:
    filter_list = list(filters)
    return {
        "courses": _segment_stats(
            db,
            filter_list,
            (models.Race.venue_name, models.Race.course_type, models.Race.distance),
            lambda values: (
                f"{_venue_slug(values[0])}/{_course_slug(values[1], values[2])}",
                f"{values[0]}{_course_label(values[1], values[2])}",
            ),
            minimum_sample=2,
            limit=12,
        ),
        "grounds": _segment_stats(
            db,
            filter_list + [models.Race.ground_condition.isnot(None)],
            (models.Race.ground_condition,),
            lambda values: (str(values[0]), str(values[0])),
            minimum_sample=2,
            limit=8,
        ),
        "distances": _segment_stats(
            db,
            filter_list + [models.Race.distance.isnot(None)],
            (models.Race.distance,),
            lambda values: (str(values[0]), f"{values[0]}m"),
            minimum_sample=2,
            limit=12,
        ),
        "popularities": _segment_stats(
            db,
            filter_list + [models.Result.popularity.isnot(None)],
            (models.Result.popularity,),
            lambda values: (str(values[0]), f"{values[0]}番人気"),
            minimum_sample=2,
            limit=12,
        ),
    }


def get_entity_detail(
    db: Session,
    entity_type: str,
    entity_id: str,
) -> Optional[Dict[str, Any]]:
    if entity_type not in {"horse", "jockey", "trainer"}:
        raise ValueError("unsupported entity type")
    cache_key = f"detail:{entity_type}:{entity_id}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    model = {
        "horse": models.Horse,
        "jockey": models.Jockey,
        "trainer": models.Trainer,
    }[entity_type]
    entity = db.query(model).filter(model.id == entity_id).first()
    if entity is None:
        return None
    relation_column = {
        "horse": models.Result.horse_id,
        "jockey": models.Result.jockey_id,
        "trainer": models.Result.trainer_id,
    }[entity_type]
    entity_filter = relation_column == entity_id
    overall = _base_rate(db, [entity_filter])
    last_race_date = (
        db.query(func.max(models.Race.race_date))
        .select_from(models.Result)
        .join(models.Race, models.Result.race_id == models.Race.id)
        .filter(models.Result.rank.isnot(None), entity_filter)
        .scalar()
    )
    _, dataset_last = _dataset_range(db)
    label = {"horse": "競走馬", "jockey": "騎手", "trainer": "調教師"}[entity_type]
    path = {"horse": "horses", "jockey": "jockeys/data", "trainer": "trainers"}[entity_type]
    summary = _entity_summary(
        entity_type,
        str(entity.id),
        entity.name,
        f"{label}データ・集計対象{overall['sample_size']}走",
        overall["sample_size"],
        last_race_date,
        (
            overall["sample_size"] >= _ENTITY_MIN_SAMPLE[entity_type]
            and _is_recent(last_race_date, dataset_last)
        ),
        f"/{path}/{quote(str(entity.id), safe='')}",
    )
    result = {
        "entity": summary,
        "overall": overall,
        "segments": _entity_segments(db, [entity_filter]),
        "recent_runs": _recent_runs(db, [entity_filter], limit=12),
        "upcoming_races": _upcoming_races(db, [entity_filter], limit=12),
        "prediction_history": (
            _prediction_history(db, str(entity.id), limit=12)
            if entity_type == "horse"
            else []
        ),
        "as_of": _now(),
    }
    _cache.set(cache_key, result, 3600)
    return result


def _parse_course(venue_slug: str, course_slug: str) -> Optional[Tuple[str, Tuple[str, ...], int]]:
    venue_name = _SLUG_VENUES.get(venue_slug.lower())
    match = re.fullmatch(r"(turf|dirt|obstacle)-(\d{3,4})m", course_slug.lower())
    if not venue_name or not match:
        return None
    distance = int(match.group(2))
    if distance < 800 or distance > 5000:
        return None
    return venue_name, _COURSE_SLUG_TO_TYPES[match.group(1)], distance


def _running_style_stats(
    db: Session,
    filters: Iterable[Any],
) -> List[Dict[str, Any]]:
    rows = (
        db.query(models.Result.rank, models.Result.popularity, models.Result.corner_positions, models.Race.total_horses)
        .select_from(models.Result)
        .join(models.Race, models.Result.race_id == models.Race.id)
        .filter(
            models.Result.rank.isnot(None),
            models.Result.corner_positions.isnot(None),
            *filters,
        )
        .all()
    )
    buckets: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"sample_size": 0, "wins": 0, "places": 0, "rank_sum": 0.0, "rank_count": 0, "pop_sum": 0.0, "pop_count": 0}
    )
    for rank, popularity, positions, total_horses in rows:
        if not isinstance(positions, list) or not positions:
            continue
        try:
            last_position = int(positions[-1])
        except (TypeError, ValueError):
            continue
        field_size = max(int(total_horses or 0), last_position, 1)
        ratio = last_position / field_size
        label = "逃げ・先行" if ratio <= 0.25 else ("中団" if ratio <= 0.6 else "後方")
        bucket = buckets[label]
        bucket["sample_size"] += 1
        bucket["wins"] += int(rank == 1)
        bucket["places"] += int(rank <= 3)
        bucket["rank_sum"] += rank
        bucket["rank_count"] += 1
        if popularity is not None:
            bucket["pop_sum"] += popularity
            bucket["pop_count"] += 1

    items = []
    for label in ("逃げ・先行", "中団", "後方"):
        bucket = buckets.get(label)
        if not bucket or bucket["sample_size"] < 10:
            continue
        sample_size = bucket["sample_size"]
        items.append({
            "key": label,
            "label": label,
            "sample_size": sample_size,
            "wins": bucket["wins"],
            "places": bucket["places"],
            "win_rate": _safe_rate(bucket["wins"], sample_size),
            "place_rate": _safe_rate(bucket["places"], sample_size),
            "average_rank": round(bucket["rank_sum"] / bucket["rank_count"], 1),
            "average_popularity": (
                round(bucket["pop_sum"] / bucket["pop_count"], 1)
                if bucket["pop_count"]
                else None
            ),
        })
    return items


def get_course_detail(
    db: Session,
    venue_slug: str,
    course_slug: str,
) -> Optional[Dict[str, Any]]:
    parsed = _parse_course(venue_slug, course_slug)
    if parsed is None:
        return None
    venue_name, course_types, distance = parsed
    cache_key = f"course:{venue_slug}:{course_slug}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    first_date, last_date = _dataset_range(db)
    if last_date is None:
        return None
    analysis_start = max(first_date or last_date, last_date - timedelta(days=365 * 5))
    filters = [
        models.Race.venue_name == venue_name,
        models.Race.course_type.in_(course_types),
        models.Race.distance == distance,
        models.Race.race_date >= analysis_start,
    ]
    overall = _base_rate(db, filters)
    if overall["sample_size"] == 0:
        return None

    course_type = "芝" if "芝" in course_types else ("ダート" if "ダ" in course_types else "障害")
    name = f"{venue_name}{course_type}{distance}m"
    summary = _entity_summary(
        "course",
        f"{venue_slug}/{course_slug}",
        name,
        f"直近5年・集計対象{overall['sample_size']}頭",
        overall["sample_size"],
        last_date,
        overall["sample_size"] >= _ENTITY_MIN_SAMPLE["course"],
        f"/courses/{venue_slug}/{course_slug}",
    )

    top_jockeys = _segment_stats(
        db,
        filters + [models.Result.jockey_id.isnot(None)],
        (models.Jockey.id, models.Jockey.name),
        lambda values: (str(values[0]), str(values[1] or "騎手名不明")),
        joins=((models.Jockey, models.Result.jockey_id == models.Jockey.id),),
        minimum_sample=10,
        limit=10,
    )
    top_jockeys.sort(key=lambda item: (-item["place_rate"], -item["sample_size"], item["label"]))
    top_trainers = _segment_stats(
        db,
        filters + [models.Result.trainer_id.isnot(None)],
        (models.Trainer.id, models.Trainer.name),
        lambda values: (str(values[0]), str(values[1] or "調教師名不明")),
        joins=((models.Trainer, models.Result.trainer_id == models.Trainer.id),),
        minimum_sample=10,
        limit=10,
    )
    top_trainers.sort(key=lambda item: (-item["place_rate"], -item["sample_size"], item["label"]))

    segments = {
        "waku": _segment_stats(
            db,
            filters + [models.Result.waku_number.isnot(None)],
            (models.Result.waku_number,),
            lambda values: (str(values[0]), f"{values[0]}枠"),
            minimum_sample=10,
            limit=8,
        ),
        "horse_numbers": _segment_stats(
            db,
            filters + [models.Result.horse_number.isnot(None)],
            (models.Result.horse_number,),
            lambda values: (str(values[0]), f"{values[0]}番"),
            minimum_sample=10,
            limit=18,
        ),
        "grounds": _segment_stats(
            db,
            filters + [models.Race.ground_condition.isnot(None)],
            (models.Race.ground_condition,),
            lambda values: (str(values[0]), str(values[0])),
            minimum_sample=10,
            limit=8,
        ),
        "popularities": _segment_stats(
            db,
            filters + [models.Result.popularity.isnot(None)],
            (models.Result.popularity,),
            lambda values: (str(values[0]), f"{values[0]}番人気"),
            minimum_sample=10,
            limit=18,
        ),
        "running_styles": _running_style_stats(db, filters),
    }

    payout_rows = (
        db.query(
            models.RaceReturn.bet_type,
            func.count(models.RaceReturn.id),
            func.avg(models.RaceReturn.payout),
            func.max(models.RaceReturn.payout),
        )
        .select_from(models.RaceReturn)
        .join(models.Race, models.RaceReturn.race_id == models.Race.id)
        .filter(*filters)
        .group_by(models.RaceReturn.bet_type)
        .order_by(desc(func.count(models.RaceReturn.id)))
        .all()
    )
    payout_stats = [
        {
            "bet_type": bet_type,
            "sample_size": int(samples or 0),
            "average_payout": round(float(average or 0), 0),
            "max_payout": int(max_payout or 0),
        }
        for bet_type, samples, average, max_payout in payout_rows
    ]
    result = {
        "entity": summary,
        "venue_name": venue_name,
        "venue_slug": venue_slug,
        "course_type": course_type,
        "distance": distance,
        "analysis_start_date": analysis_start,
        "analysis_end_date": last_date,
        "overall": overall,
        "segments": segments,
        "top_jockeys": top_jockeys[:10],
        "top_trainers": top_trainers[:10],
        "payout_stats": payout_stats,
        "recent_races": _recent_runs(
            db,
            filters + [models.Result.rank == 1],
            limit=10,
        ),
        "as_of": _now(),
    }
    _cache.set(cache_key, result, 21600)
    return result


def get_growth_summary(db: Session) -> Dict[str, Any]:
    cache_key = "growth-summary"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached
    first_date, last_date = _dataset_range(db)
    course_conditions = (
        db.query(
            models.Race.venue_name,
            models.Race.course_type,
            models.Race.distance,
        )
        .filter(models.Race.course_type.isnot(None), models.Race.distance.isnot(None))
        .group_by(models.Race.venue_name, models.Race.course_type, models.Race.distance)
        .having(func.count(models.Race.id) >= 10)
        .count()
    )
    result = {
        "counts": {
            "races": db.query(func.count(models.Race.id)).scalar() or 0,
            "results": db.query(func.count(models.Result.id)).scalar() or 0,
            "horses": db.query(func.count(models.Horse.id)).scalar() or 0,
            "jockeys": db.query(func.count(models.Jockey.id)).scalar() or 0,
            "trainers": db.query(func.count(models.Trainer.id)).scalar() or 0,
            "course_conditions": course_conditions,
            "first_race_date": first_date,
            "last_race_date": last_date,
        },
        "featured_courses": list_entities(db, "course", limit=8, indexable_only=True)["items"],
        "active_horses": list_entities(db, "horse", limit=8, indexable_only=True)["items"],
        "active_jockeys": list_entities(db, "jockey", limit=8, indexable_only=True)["items"],
        "active_trainers": list_entities(db, "trainer", limit=8, indexable_only=True)["items"],
        "as_of": _now(),
    }
    _cache.set(cache_key, result, 21600)
    return result


def _normalize_series_name(value: str) -> str:
    normalized = re.sub(r"[（(].*?[）)]", "", value or "")
    normalized = re.sub(r"第\d+回", "", normalized)
    normalized = re.sub(r"(Jpn|J・G|G)[ⅠⅡⅢIVX1-3]+", "", normalized, flags=re.IGNORECASE)
    normalized = normalized.replace("ステークス", "S").replace("カップ", "C")
    return re.sub(r"[\s　・\-]", "", normalized).strip()


def _series_query_token(value: str) -> str:
    normalized = re.sub(r"[（(].*?[）)]", "", value or "")
    normalized = re.sub(r"第\d+回", "", normalized)
    normalized = re.sub(r"(Jpn|J・G|G)[ⅠⅡⅢIVX1-3]+", "", normalized, flags=re.IGNORECASE)
    return re.sub(r"[\s　・\-]", "", normalized).strip()


def get_race_series(db: Session, race_name: str) -> Optional[Dict[str, Any]]:
    normalized = _normalize_series_name(race_name)
    query_token = _series_query_token(race_name)
    if len(normalized) < 2:
        return None
    cache_key = f"series:{normalized}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    candidates = (
        db.query(models.Race)
        .options(
            load_only(
                models.Race.id,
                models.Race.race_date,
                models.Race.venue_name,
                models.Race.race_number,
                models.Race.race_name,
                models.Race.course_type,
                models.Race.distance,
                models.Race.total_horses,
            )
        )
        .filter(models.Race.race_name.contains(query_token[: max(2, min(len(query_token), 12))]))
        .order_by(desc(models.Race.race_date))
        .limit(80)
        .all()
    )
    races = [
        race for race in candidates
        if normalized in _normalize_series_name(race.race_name)
        or _normalize_series_name(race.race_name) in normalized
    ][:30]
    if not races:
        return None

    race_ids = [race.id for race in races]
    winner_rows = (
        db.query(models.Result, models.Horse)
        .join(models.Horse, models.Result.horse_id == models.Horse.id)
        .filter(models.Result.race_id.in_(race_ids), models.Result.rank == 1)
        .all()
    )
    winners = {result.race_id: (result, horse) for result, horse in winner_rows}
    prediction_rows = (
        db.query(models.Prediction, models.Result.rank)
        .outerjoin(
            models.Result,
            and_(
                models.Result.race_id == models.Prediction.race_id,
                models.Result.horse_id == models.Prediction.horse_id,
            ),
        )
        .filter(models.Prediction.race_id.in_(race_ids), models.Prediction.deviation_score.isnot(None))
        .order_by(models.Prediction.race_id, desc(models.Prediction.deviation_score))
        .all()
    )
    top_predictions: Dict[str, Tuple[models.Prediction, Optional[int]]] = {}
    for prediction, rank in prediction_rows:
        top_predictions.setdefault(prediction.race_id, (prediction, rank))

    popularity_counts: Dict[int, int] = defaultdict(int)
    history = []
    for race in races:
        winner_pair = winners.get(race.id)
        winner_result, winner_horse = winner_pair if winner_pair else (None, None)
        if winner_result and winner_result.popularity:
            popularity_counts[int(winner_result.popularity)] += 1
        top_pair = top_predictions.get(race.id)
        top_prediction, top_rank = top_pair if top_pair else (None, None)
        history.append({
            "race_id": race.id,
            "race_date": race.race_date,
            "venue_name": race.venue_name,
            "race_number": race.race_number,
            "race_name": race.race_name,
            "course_label": _course_label(race.course_type, race.distance),
            "field_size": race.total_horses,
            "winner_name": winner_horse.name if winner_horse else None,
            "winner_popularity": winner_result.popularity if winner_result else None,
            "top_prediction_name": top_prediction.horse_name if top_prediction else None,
            "top_prediction_rank": top_rank,
            "url": _race_url(race.race_date, race.venue_name, race.race_number),
        })

    winner_count = sum(popularity_counts.values())
    popularity_stats = [
        {
            "key": str(popularity),
            "label": f"{popularity}番人気",
            "sample_size": count,
            "wins": count,
            "places": count,
            "win_rate": _safe_rate(count, winner_count),
            "place_rate": _safe_rate(count, winner_count),
            "average_rank": 1.0,
            "average_popularity": float(popularity),
        }
        for popularity, count in sorted(popularity_counts.items())
    ]
    result = {
        "name": race_name,
        "sample_size": len(races),
        "winner_popularity": popularity_stats,
        "history": history,
        "as_of": _now(),
    }
    _cache.set(cache_key, result, 21600)
    return result


def _bulk_rates(
    db: Session,
    id_column: Any,
    entity_ids: Sequence[str],
    extra_filters: Sequence[Any] = (),
) -> Dict[str, Dict[str, Any]]:
    if not entity_ids:
        return {}
    rows = (
        db.query(id_column, *_metric_columns())
        .select_from(models.Result)
        .join(models.Race, models.Result.race_id == models.Race.id)
        .filter(
            id_column.in_(entity_ids),
            models.Result.rank.isnot(None),
            *extra_filters,
        )
        .group_by(id_column)
        .all()
    )
    return {str(row[0]): _rate_from_row(row[1:]) for row in rows}


def get_race_features(db: Session, race_id: str) -> Optional[Dict[str, Any]]:
    cache_key = f"race-features:{race_id}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached
    race = (
        db.query(models.Race)
        .options(
            load_only(
                models.Race.id,
                models.Race.race_date,
                models.Race.venue_name,
                models.Race.race_number,
                models.Race.race_name,
                models.Race.course_type,
                models.Race.distance,
            )
        )
        .filter(models.Race.id == race_id)
        .first()
    )
    if race is None:
        return None
    rows = (
        db.query(
            models.Result,
            models.Horse,
            models.Jockey,
            models.Trainer,
            models.Prediction,
        )
        .select_from(models.Result)
        .join(models.Horse, models.Result.horse_id == models.Horse.id)
        .outerjoin(models.Jockey, models.Result.jockey_id == models.Jockey.id)
        .outerjoin(models.Trainer, models.Result.trainer_id == models.Trainer.id)
        .outerjoin(
            models.Prediction,
            and_(
                models.Prediction.race_id == models.Result.race_id,
                models.Prediction.horse_id == models.Result.horse_id,
            ),
        )
        .filter(models.Result.race_id == race_id)
        .order_by(models.Result.horse_number)
        .all()
    )
    horse_ids = [horse.id for _, horse, _, _, _ in rows]
    jockey_ids = [jockey.id for _, _, jockey, _, _ in rows if jockey]
    trainer_ids = [trainer.id for _, _, _, trainer, _ in rows if trainer]
    condition_filters = [
        models.Race.venue_name == race.venue_name,
        models.Race.course_type == race.course_type,
        models.Race.distance == race.distance,
        models.Race.race_date < race.race_date,
    ]
    horse_overall = _bulk_rates(
        db,
        models.Result.horse_id,
        horse_ids,
        [models.Race.race_date < race.race_date],
    )
    horse_condition = _bulk_rates(db, models.Result.horse_id, horse_ids, condition_filters)
    jockey_condition = _bulk_rates(db, models.Result.jockey_id, jockey_ids, condition_filters)
    trainer_condition = _bulk_rates(db, models.Result.trainer_id, trainer_ids, condition_filters)
    runners = []
    for result, horse, jockey, trainer, prediction in rows:
        runners.append({
            "horse_id": horse.id,
            "horse_name": horse.name,
            "horse_number": result.horse_number,
            "jockey_id": jockey.id if jockey else None,
            "jockey_name": jockey.name if jockey else None,
            "trainer_id": trainer.id if trainer else None,
            "trainer_name": trainer.name if trainer else None,
            "deviation_score": prediction.deviation_score if prediction else None,
            "mark": prediction.mark if prediction else None,
            "horse_overall": horse_overall.get(horse.id, _empty_rate()),
            "horse_condition": horse_condition.get(horse.id, _empty_rate()),
            "jockey_condition": jockey_condition.get(jockey.id, _empty_rate()) if jockey else _empty_rate(),
            "trainer_condition": trainer_condition.get(trainer.id, _empty_rate()) if trainer else _empty_rate(),
        })
    result = {
        "race_id": race.id,
        "race_date": race.race_date,
        "venue_name": race.venue_name,
        "race_number": race.race_number,
        "race_name": race.race_name,
        "course_label": _course_label(race.course_type, race.distance),
        "runners": runners,
        "as_of": _now(),
    }
    _cache.set(cache_key, result, 3600)
    return result


def get_data_sitemap(db: Session) -> List[Dict[str, Any]]:
    cache_key = "data-sitemap"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached
    entries: List[Dict[str, Any]] = []
    for entity_type in ("course", "horse", "jockey", "trainer"):
        directory = list_entities(
            db,
            entity_type,
            limit=5000,
            offset=0,
            indexable_only=True,
        )
        entries.extend({
            "url": item["url"],
            "entity_type": entity_type,
            "last_modified": item["last_race_date"],
        } for item in directory["items"])
    _cache.set(cache_key, entries, 86400)
    return entries
