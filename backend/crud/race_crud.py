from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, func, case, and_
from database import models
from datetime import date, timedelta, datetime, timezone
from typing import Dict, Any, List, Optional
from collections import defaultdict
import time
import threading

# ==============================================================================
# TTLキャッシュ（Neon通信量削減）
#
# 【前回実装から修正した4つのバグ】
#
# バグ①「空結果の永続キャッシュ」:
#   パイプライン未実行時に空結果を長時間キャッシュ → 404 が固定化。
#   修正: 空データは TTL 60秒のみ。
#
# バグ②「昨日ページ・レース結果が反映されない」:
#   結果パイプラインは 06:00 JST に完了。06:00 前に 24h キャッシュしていた。
#   修正: 昨日の 06:00 JST 前は 5分TTL、以降は 4時間TTL。
#
# バグ③「メモリ膨張（Render 512MB 超えリスク）」:
#   無制限に蓄積 → 最悪 365MB。
#   修正: 最大 50 エントリ（LRU） → 上限約 100MB。
#
# バグ④「プロセス間キャッシュ無効化が不可能」:
#   GitHub Actions と Render は別プロセス → in-memory 共有不可。
#   修正: TTL を短くすることで許容範囲に収める（バグ①②で解消）。
#         同一プロセス内向けに invalidate_predictions_cache() を公開。
# ==============================================================================

_JST = timezone(timedelta(hours=9))
_RESULTS_DONE_HOUR_JST = 6  # 結果パイプライン完了予定時刻


class _TTLCache:
    """スレッドセーフ・最大エントリ数制限付きTTLキャッシュ（外部依存なし）"""

    def __init__(self, max_entries: int = 50):
        self._store: dict = {}
        self._lock = threading.Lock()
        self._max_entries = max_entries

    def get(self, key: str):
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() < expires_at:
                return value
            del self._store[key]
            return None

    def set(self, key: str, value, ttl_seconds: int):
        with self._lock:
            if key not in self._store and len(self._store) >= self._max_entries:
                oldest = min(self._store, key=lambda k: self._store[k][1])
                del self._store[oldest]
            self._store[key] = (value, time.monotonic() + ttl_seconds)

    def invalidate(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def clear(self):
        with self._lock:
            self._store.clear()


_predictions_cache = _TTLCache(max_entries=50)
_top_payout_cache = _TTLCache(max_entries=10)


def invalidate_predictions_cache(target_date: date) -> None:
    """
    指定日のキャッシュを強制削除する。
    NOTE: 同一プロセス内（例: テスト）のみ有効。
    GitHub Actions → Render の in-memory cache は別プロセスのため不可。
    """
    _predictions_cache.invalidate(f"pred_{target_date.isoformat()}")


def _get_cache_ttl(target_date: date, has_data: bool) -> int:
    """
    日付・時刻・データ有無に応じた TTL（秒）を返す。

    空データ → 60秒（パイプライン完了後に自動更新させる）
    昨日 06:00 JST 前 → 5分（結果未確定）
    昨日 06:00 JST 後 → 4時間（結果確定済み）
    当日 → 15分（予測は朝パイプライン後に安定）
    翌日以降 → 30分（午後パイプラインで更新される）
    2日以上前 → 4時間（完全確定）
    """
    if not has_data:
        return 60

    today = date.today()

    if target_date < today - timedelta(days=1):
        return 14400  # 2日以上前: 4時間

    if target_date == today - timedelta(days=1):
        # 昨日: 結果パイプライン完了前後で TTL を変える
        now_jst = datetime.now(_JST)
        if now_jst.hour >= _RESULTS_DONE_HOUR_JST:
            return 14400  # 06:00以降: 4時間
        else:
            return 300    # 06:00前: 5分

    if target_date == today:
        return 900  # 当日: 15分

    return 1800  # 翌日以降: 30分


def _serialize_race_for_cache(race, advantages: list) -> dict:
    """
    SQLAlchemy オブジェクトを純粋な dict に変換してキャッシュする。
    セッションが閉じた後も参照可能。Pydantic の from_attributes=True は
    dict からも検証できるので response_model との互換性は維持される。
    """
    return {
        'id': race.id,
        'race_date': race.race_date,
        'venue_name': race.venue_name,
        'race_number': race.race_number,
        'race_name': race.race_name,
        'course_type': race.course_type,
        'distance': race.distance,
        'ai_analysis_text': race.ai_analysis_text,
        'predictions': [
            {
                'horse_id': p.horse_id,
                'horse_name': p.horse_name,
                'horse_number': p.horse_number,
                'waku_number': p.waku_number,
                'deviation_score': p.deviation_score,
                'mark': p.mark,
                'start_1c_indicator': p.start_1c_indicator,
                'unpredictable_reason': p.unpredictable_reason,
            }
            for p in sorted(
                race.predictions,
                key=lambda p: p.deviation_score if p.deviation_score is not None else -float('inf'),
                reverse=True
            )
        ],
        'matchup': (
            {'matchup_data': race.matchup.matchup_data}
            if race.matchup else None
        ),
        'horse_number_advantages': [
            {'horse_number': a.horse_number, 'advantage_score': a.advantage_score}
            for a in advantages
        ],
        'results': [
            {
                'horse_number': r.horse_number,
                'rank': r.rank,
                'horse_name': r.horse.name if r.horse else 'N/A',
            }
            for r in race.results
        ],
    }


def get_predictions_by_date(db: Session, target_date: date) -> Dict[str, Any]:
    """
    指定日のレース予測を返す（TTLキャッシュ付き）。

    キャッシュヒット時はDBへの接続ゼロ。
    空データは 60秒のみキャッシュ（バグ①修正）。
    """
    cache_key = f"pred_{target_date.isoformat()}"
    cached = _predictions_cache.get(cache_key)
    if cached is not None:
        return cached

    valid_race_ids_query = db.query(models.Prediction.race_id)\
        .join(models.Race, models.Race.id == models.Prediction.race_id)\
        .filter(models.Race.race_date == target_date)\
        .distinct()

    races_with_preds = db.query(models.Race)\
        .options(
            joinedload(models.Race.predictions),
            joinedload(models.Race.results).joinedload(models.Result.horse),
            joinedload(models.Race.matchup),
        )\
        .filter(models.Race.id.in_(valid_race_ids_query))\
        .order_by(models.Race.venue_name, models.Race.race_number)\
        .all()

    if not races_with_preds:
        empty = {"jra": [], "nar": []}
        # ★ バグ①修正: 空は 60 秒のみ（パイプライン完了後に自動更新）
        _predictions_cache.set(cache_key, empty, 60)
        return empty

    race_conditions = {
        (race.venue_name, race.course_type, race.distance)
        for race in races_with_preds
        if race.venue_name and race.course_type and race.distance
    }

    advantages_map = defaultdict(list)
    if race_conditions:
        filters = [
            (models.HorseNumberAdvantage.venue_name == v_name) &
            (models.HorseNumberAdvantage.course_type == c_type) &
            (models.HorseNumberAdvantage.distance == dist)
            for v_name, c_type, dist in race_conditions
        ]
        for adv in db.query(models.HorseNumberAdvantage).filter(or_(*filters)).all():
            advantages_map[(adv.venue_name, adv.course_type, adv.distance)].append(adv)
        for key in advantages_map:
            advantages_map[key].sort(key=lambda x: x.horse_number)

    jra_venues: Dict[str, List] = defaultdict(list)
    nar_venues: Dict[str, List] = defaultdict(list)

    for race in races_with_preds:
        advantages = advantages_map.get(
            (race.venue_name, race.course_type, race.distance), []
        ) if race.venue_name and race.course_type and race.distance else []

        race_dict = _serialize_race_for_cache(race, advantages)

        if race.race_type == '中央':
            jra_venues[race.venue_name].append(race_dict)
        elif race.race_type == '地方':
            nar_venues[race.venue_name].append(race_dict)

    jra_result = [{"venue_name": v, "races": r} for v, r in jra_venues.items()]
    nar_result = [{"venue_name": v, "races": r} for v, r in nar_venues.items()]
    result = {"jra": jra_result, "nar": nar_result}

    has_data = bool(jra_result or nar_result)
    _predictions_cache.set(cache_key, result, _get_cache_ttl(target_date, has_data))
    return result


def get_special_pick_for_date(db: Session, target_date: date) -> Optional[models.Prediction]:
    return db.query(models.Prediction)\
        .join(models.Race, models.Prediction.race_id == models.Race.id)\
        .filter(models.Race.race_date == target_date)\
        .filter(models.Prediction.deviation_score.isnot(None))\
        .order_by(desc(models.Prediction.deviation_score))\
        .first()


def get_filtered_matchups_for_race(
    db: Session, race_id: str, start_date: date, end_date: date
) -> Optional[Dict[str, Any]]:
    horse_results = db.query(models.Result.horse_id).filter(
        models.Result.race_id == race_id
    ).all()
    if not horse_results:
        return None
    horse_ids = [r.horse_id for r in horse_results]
    from crud.matchup_calculator import calculate_matchups
    return calculate_matchups(db, horse_ids, start_date, end_date)


def _build_hit_condition(top_preds_sq):
    return case(
        (
            models.RaceReturn.bet_type == 'wakuren',
            and_(
                models.RaceReturn.number_1 == func.any(top_preds_sq.c.top_waku_numbers),
                models.RaceReturn.number_2 == func.any(top_preds_sq.c.top_waku_numbers)
            )
        ),
        (
            models.RaceReturn.bet_type.in_(['tansho', 'fukusho']),
            models.RaceReturn.number_1 == func.any(top_preds_sq.c.top_horse_numbers)
        ),
        (
            models.RaceReturn.bet_type.in_(['umaren', 'wide', 'umatan']),
            and_(
                models.RaceReturn.number_1 == func.any(top_preds_sq.c.top_horse_numbers),
                models.RaceReturn.number_2 == func.any(top_preds_sq.c.top_horse_numbers)
            )
        ),
        (
            models.RaceReturn.bet_type.in_(['sanrenpuku', 'sanrentan']),
            and_(
                models.RaceReturn.number_1 == func.any(top_preds_sq.c.top_horse_numbers),
                models.RaceReturn.number_2 == func.any(top_preds_sq.c.top_horse_numbers),
                models.RaceReturn.number_3 == func.any(top_preds_sq.c.top_horse_numbers)
            )
        ),
        else_=False
    )


_BET_TYPE_MAP_JA = {
    'tansho': '単勝', 'fukusho': '複勝', 'wakuren': '枠連', 'umaren': '馬連',
    'wide': 'ワイド', 'umatan': '馬単', 'sanrenpuku': '3連複', 'sanrentan': '3連単'
}


def _format_hit(hit, str_date: bool = False) -> dict:
    delim = '→' if hit.bet_type in ['umatan', 'sanrentan'] else '-'
    nums = [str(n) for n in [hit.number_1, hit.number_2, hit.number_3] if n is not None]
    return {
        "race_id": hit.race_id,
        "race_date": hit.race_date.strftime('%Y-%m-%d') if str_date else hit.race_date,
        "venue_name": hit.venue_name,
        "race_number": hit.race_number,
        "race_name": hit.race_name,
        "bet_type": _BET_TYPE_MAP_JA.get(hit.bet_type, hit.bet_type),
        "winning_numbers": delim.join(nums),
        "payout": hit.payout
    }


def get_top_payout_hits(db: Session, days: int = 7, limit: int = 5) -> List[Dict[str, Any]]:
    cache_key = f"top_hits_{days}_{limit}"
    cached = _top_payout_cache.get(cache_key)
    if cached is not None:
        return cached

    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)

    top_preds_sq = db.query(
        models.Prediction.race_id,
        func.array_agg(models.Prediction.horse_number).label('top_horse_numbers'),
        func.array_agg(models.Prediction.waku_number).label('top_waku_numbers')
    ).filter(
        models.Prediction.mark.in_(['◎', '〇', '▲', '△', '☆'])
    ).group_by(models.Prediction.race_id).subquery('top_preds_sq')

    results = db.query(
        models.Race.id.label("race_id"),
        models.Race.race_date, models.Race.venue_name,
        models.Race.race_number, models.Race.race_name,
        models.RaceReturn.bet_type, models.RaceReturn.payout,
        models.RaceReturn.number_1, models.RaceReturn.number_2, models.RaceReturn.number_3,
    ).select_from(models.RaceReturn)\
     .join(models.Race, models.RaceReturn.race_id == models.Race.id)\
     .join(top_preds_sq, models.RaceReturn.race_id == top_preds_sq.c.race_id)\
     .filter(
         models.Race.race_date.between(start_date, end_date),
         _build_hit_condition(top_preds_sq)
     )\
     .order_by(desc(models.RaceReturn.payout))\
     .limit(limit)\
     .all()

    hits = [_format_hit(r) for r in results]
    _top_payout_cache.set(cache_key, hits, 1800)
    return hits


def get_high_payout_hits_for_date(db: Session, target_date: date) -> List[Dict[str, Any]]:
    top_preds_sq = db.query(
        models.Prediction.race_id,
        func.array_agg(models.Prediction.horse_number).label('top_horse_numbers'),
        func.array_agg(models.Prediction.waku_number).label('top_waku_numbers')
    ).filter(
        models.Prediction.mark.in_(['◎', '〇', '▲', '△', '☆'])
    ).group_by(models.Prediction.race_id).subquery('top_preds_sq')

    results = db.query(
        models.Race.id.label("race_id"),
        models.Race.race_date, models.Race.venue_name,
        models.Race.race_number, models.Race.race_name,
        models.RaceReturn.bet_type, models.RaceReturn.payout,
        models.RaceReturn.number_1, models.RaceReturn.number_2, models.RaceReturn.number_3,
    ).select_from(models.RaceReturn)\
     .join(models.Race, models.RaceReturn.race_id == models.Race.id)\
     .join(top_preds_sq, models.RaceReturn.race_id == top_preds_sq.c.race_id)\
     .filter(
         models.Race.race_date == target_date,
         models.RaceReturn.payout >= 10000,
         _build_hit_condition(top_preds_sq)
     )\
     .order_by(desc(models.RaceReturn.payout))\
     .all()

    return [_format_hit(r, str_date=True) for r in results]


def get_all_race_urls(db: Session) -> List[Dict[str, Any]]:
    query = db.query(
        models.Race.race_date, models.Race.venue_name, models.Race.race_number
    ).filter(
        models.Race.predictions.any(),
        models.Race.venue_name.isnot(None),
        models.Race.race_number.isnot(None),
    ).order_by(models.Race.race_date.desc())

    return [
        {"race_date": r.race_date.strftime('%Y-%m-%d'),
         "venue_name": r.venue_name, "race_number": r.race_number}
        for r in query.yield_per(500)
    ]


def get_heavy_stakes_race_urls(db: Session) -> List[Dict[str, Any]]:
    results = db.query(
        models.Race.race_date, models.Race.venue_name,
        models.Race.race_number, models.Race.race_name
    ).filter(
        models.Race.predictions.any(),
        models.Race.venue_name.isnot(None),
        models.Race.race_number.isnot(None),
        models.Race.race_name.isnot(None),
        or_(
            models.Race.race_name.like('%G1%'),
            models.Race.race_name.like('%G2%'),
            models.Race.race_name.like('%G3%'),
            models.Race.race_name.like('%GⅠ%'),
            models.Race.race_name.like('%GⅡ%'),
            models.Race.race_name.like('%GⅢ%'),
            models.Race.race_name.like('%Ｇ１%'),
            models.Race.race_name.like('%Ｇ２%'),
            models.Race.race_name.like('%Ｇ３%'),
            models.Race.race_name.like('%J・G%'),
        )
    ).order_by(models.Race.race_date.desc()).all()

    return [
        {"race_date": r.race_date.strftime('%Y-%m-%d'),
         "venue_name": r.venue_name, "race_number": r.race_number}
        for r in results
    ]