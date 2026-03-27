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
# 【OOMクラッシュ修正 - 2026-03-21】
#
# 症状: /predictions/2026-03-22 へのリクエストが毎回 503 を返す
# ログ: "Memory limit of 512 MiB exceeded with 583 MiB used"
#       → リクエストのたびにコンテナがOOMキルされ、無限再起動ループ
#
# 原因: joinedload(models.Race.matchup) が全レースのmatchupを一括ロード
#       16頭レース = 120通りの対戦組み合わせ × 対戦履歴 × ORMオーバーヘッド
#       47レース分を一括展開すると97MB超 → 他のデータと合計で512MB超過
#
# 修正: joinedload(matchup) を削除
#       matchupは /matchups/{race_id} エンドポイントで個別提供済み。
#       フロントエンドはレース詳細ページで個別に呼ぶため影響なし。
#       スキーマの matchup: Optional[Matchup] は None を返す形に変更。
# ==============================================================================

_JST = timezone(timedelta(hours=9))
_RESULTS_DONE_HOUR_JST = 6


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
    """同一プロセス内のキャッシュを強制削除（GitHub Actions→Render間は不可）"""
    _predictions_cache.invalidate(f"pred_{target_date.isoformat()}")


def _get_cache_ttl(target_date: date, has_data: bool) -> int:
    """日付・時刻・データ有無に応じた TTL（秒）を返す"""
    if not has_data:
        return 60  # 空データは60秒のみ（パイプライン完了後に自動更新）

    today = date.today()

    if target_date < today - timedelta(days=1):
        return 14400  # 2日以上前: 4時間

    if target_date == today - timedelta(days=1):
        now_jst = datetime.now(_JST)
        if now_jst.hour >= _RESULTS_DONE_HOUR_JST:
            return 14400  # 昨日・結果確定後: 4時間
        else:
            return 300    # 昨日・結果未確定: 5分

    if target_date == today:
        return 900   # 当日: 15分

    return 1800  # 翌日以降: 30分


def _serialize_race_for_cache(race, advantages: list) -> dict:
    """
    SQLAlchemy オブジェクトを純粋な dict に変換してキャッシュする。

    ★ matchup は含めない（OOM修正）
       matchupデータは /matchups/{race_id} エンドポイントで個別提供する。
       メインレスポンスに含めるとOOMクラッシュの原因になる。
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
        # ★ matchup を None に固定（OOMクラッシュ修正）
        # matchup は /matchups/{race_id} エンドポイントで個別取得する設計
        'matchup': None,
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
    """
    cache_key = f"pred_{target_date.isoformat()}"
    cached = _predictions_cache.get(cache_key)
    if cached is not None:
        return cached

    valid_race_ids_query = db.query(models.Prediction.race_id)\
        .join(models.Race, models.Race.id == models.Prediction.race_id)\
        .filter(models.Race.race_date == target_date)\
        .distinct()

    # ★ joinedload(models.Race.matchup) を削除（OOMクラッシュ修正）
    # matchupは /matchups/{race_id} エンドポイントで個別提供するため不要
    races_with_preds = db.query(models.Race)\
        .options(
            joinedload(models.Race.predictions),
            joinedload(models.Race.results).joinedload(models.Result.horse),
            # joinedload(models.Race.matchup) ← 削除: OOMの原因
        )\
        .filter(models.Race.id.in_(valid_race_ids_query))\
        .order_by(models.Race.venue_name, models.Race.race_number)\
        .all()

    if not races_with_preds:
        empty = {"jra": [], "nar": []}
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


# ============================================================
# JRA中央競馬 重賞レース名辞書
# parser.py の _normalize_race_name() がDBに保存する前に
# グレード接尾辞（G1）等を除去するため、race_name には
# グレード情報が含まれない。そのため、レース名からグレードを
# 判定する固定辞書を用いる。
# ============================================================
_JRA_GRADE_RACES: Dict[str, str] = {
    # ─── G1 ───
    "フェブラリーS": "G1", "フェブラリーステークス": "G1",
    "高松宮記念": "G1",
    "大阪杯": "G1",
    "桜花賞": "G1",
    "皐月賞": "G1",
    "天皇賞（春）": "G1", "天皇賞・春": "G1", "天皇賞（春": "G1",
    "NHKマイルC": "G1", "NHKマイルカップ": "G1",
    "ヴィクトリアマイル": "G1", "ヴィクトリアM": "G1",
    "オークス": "G1", "優駿牝馬": "G1",
    "日本ダービー": "G1", "東京優駿": "G1",
    "安田記念": "G1",
    "宝塚記念": "G1",
    "スプリンターズS": "G1", "スプリンターズステークス": "G1",
    "秋華賞": "G1",
    "菊花賞": "G1",
    "天皇賞（秋）": "G1", "天皇賞・秋": "G1", "天皇賞（秋": "G1",
    "エリザベス女王杯": "G1",
    "マイルCS": "G1", "マイルチャンピオンシップ": "G1",
    "ジャパンC": "G1", "ジャパンカップ": "G1",
    "チャンピオンズC": "G1", "チャンピオンズカップ": "G1",
    "阪神JF": "G1", "阪神ジュベナイルフィリーズ": "G1",
    "朝日杯FS": "G1", "朝日杯フューチュリティステークス": "G1",
    "有馬記念": "G1",
    "ホープフルS": "G1", "ホープフルステークス": "G1",
    # ─── G2 ───
    "日経新春杯": "G2",
    "アメリカJCC": "G2", "AJCC": "G2", "アメリカジョッキークラブカップ": "G2",
    "京都記念": "G2",
    "共同通信杯": "G2",
    "京都牝馬S": "G2", "京都牝馬ステークス": "G2",
    "小倉大賞典": "G2",
    "阪急杯": "G2",
    "中山記念": "G2",
    "弥生賞": "G2", "弥生賞ディープインパクト記念": "G2",
    "チューリップ賞": "G2",
    "フィリーズレビュー": "G2",
    "金鯱賞": "G2",
    "スプリングS": "G2", "スプリングステークス": "G2",
    "日経賞": "G2",
    "阪神大賞典": "G2",
    "産経大阪杯": "G2",
    "読売マイラーズC": "G2", "マイラーズC": "G2", "マイラーズカップ": "G2",
    "青葉賞": "G2",
    "フローラS": "G2", "フローラステークス": "G2",
    "京王杯SC": "G2", "京王杯スプリングカップ": "G2",
    "目黒記念": "G2",
    "札幌記念": "G2",
    "セントウルS": "G2", "セントウルステークス": "G2",
    "ローズS": "G2", "ローズステークス": "G2",
    "オールカマー": "G2",
    "神戸新聞杯": "G2",
    "毎日王冠": "G2",
    "京都大賞典": "G2",
    "府中牝馬S": "G2", "府中牝馬ステークス": "G2",
    "富士S": "G2", "富士ステークス": "G2",
    "スワンS": "G2", "スワンステークス": "G2",
    "アルゼンチン共和国杯": "G2",
    "デイリー杯2歳S": "G2", "デイリー杯２歳ステークス": "G2",
    "京阪杯": "G2",
    "ステイヤーズS": "G2", "ステイヤーズステークス": "G2",
    "阪神C": "G2", "阪神カップ": "G2",
    "中日新聞杯": "G2",
    "東海S": "G2", "東海ステークス": "G2",
    "きさらぎ賞": "G2",
    # ─── G3 ───
    "中山金杯": "G3", "京都金杯": "G3",
    "シンザン記念": "G3",
    "愛知杯": "G3",
    "フェアリーS": "G3", "フェアリーステークス": "G3",
    "シルクロードS": "G3", "シルクロードステークス": "G3",
    "根岸S": "G3", "根岸ステークス": "G3",
    "東京新聞杯": "G3",
    "クイーンC": "G3", "クイーンカップ": "G3",
    "ダイヤモンドS": "G3", "ダイヤモンドステークス": "G3",
    "オーシャンS": "G3", "オーシャンステークス": "G3",
    "中山牝馬S": "G3", "中山牝馬ステークス": "G3",
    "毎日杯": "G3",
    "マーチS": "G3", "マーチステークス": "G3",
    "高松宮杯": "G3",
    "ダービー卿CT": "G3", "ダービー卿チャレンジトロフィー": "G3",
    "阪神牝馬S": "G3", "阪神牝馬ステークス": "G3",
    "アーリントンC": "G3", "アーリントンカップ": "G3",
    "福島牝馬S": "G3", "福島牝馬ステークス": "G3",
    "新潟大賞典": "G3",
    "京都新聞杯": "G3",
    "平安S": "G3", "平安ステークス": "G3",
    "葵S": "G3", "葵ステークス": "G3",
    "鳴尾記念": "G3",
    "函館スプリントS": "G3", "函館スプリントステークス": "G3",
    "エプソムC": "G3", "エプソムカップ": "G3",
    "マーメイドS": "G3", "マーメイドステークス": "G3",
    "ユニコーンS": "G3", "ユニコーンステークス": "G3",
    "ラジオNIKKEI賞": "G3",
    "CBC賞": "G3",
    "プロキオンS": "G3", "プロキオンステークス": "G3",
    "七夕賞": "G3",
    "函館記念": "G3",
    "中京記念": "G3",
    "アイビスSD": "G3", "アイビスサマーダッシュ": "G3",
    "小倉記念": "G3",
    "レパードS": "G3", "レパードステークス": "G3",
    "関屋記念": "G3",
    "エルムS": "G3", "エルムステークス": "G3",
    "北九州記念": "G3",
    "新潟2歳S": "G3", "新潟２歳ステークス": "G3",
    "キーンランドC": "G3", "キーンランドカップ": "G3",
    "新潟記念": "G3",
    "小倉2歳S": "G3", "小倉２歳ステークス": "G3",
    "紫苑S": "G3", "紫苑ステークス": "G3",
    "京成杯オータムH": "G3", "京成杯AH": "G3",
    "シリウスS": "G3", "シリウスステークス": "G3",
    "サウジアラビアRC": "G3", "サウジアラビアロイヤルカップ": "G3",
    "サムソナイトS": "G3",
    "京成杯": "G3",
    "カペラS": "G3", "カペラステークス": "G3",
    "ターコイズS": "G3", "ターコイズステークス": "G3",
    "チャレンジC": "G3", "チャレンジカップ": "G3",
    "ファルコンS": "G3", "ファルコンステークス": "G3",
    "福島記念": "G3",
    "武蔵野S": "G3", "武蔵野ステークス": "G3",
    "みやこS": "G3", "みやこステークス": "G3",
    "ファンタジーS": "G3", "ファンタジーステークス": "G3",
    "京王杯2歳S": "G3", "京王杯２歳ステークス": "G3",
}


def _detect_grade(race_name: str) -> str:
    """
    レース名からグレード (G1/G2/G3) を判定する（3層防御）。

    Layer 1: race_name 内のグレード接尾辞を正規表現で検出
             → パーサー修正後の新データで機能（例: "高松宮記念（G1）"）
    Layer 2: 辞書の完全一致・前方一致
             → パーサー修正前の旧データで機能（例: "日経賞"）
    Layer 3: 辞書の部分一致（フォールバック）
             → 表記ゆれ対策
    """
    if not race_name:
        return ""
    name = race_name.strip()

    # ── Layer 1: race_name にグレード接尾辞が含まれるか ──
    # 新しいデータ: "高松宮記念（G1）" / "日経賞(G2)" 等
    import re as _re
    grade_match = _re.search(r'[（(](G[1-3])[）)]', name)
    if grade_match:
        return grade_match.group(1)

    # GI/GII/GIII 表記にも対応
    for kw, grade in [('GⅠ', 'G1'), ('GI', 'G1'), ('Ｇ１', 'G1'),
                      ('GⅡ', 'G2'), ('GII', 'G2'), ('Ｇ２', 'G2'),
                      ('GⅢ', 'G3'), ('GIII', 'G3'), ('Ｇ３', 'G3')]:
        if kw in name:
            return grade

    # ── Layer 2: 辞書の完全一致 → 前方一致 ──
    # 旧データ（グレード接尾辞が除去済み）のための照合
    # グレード接尾辞を除いた部分で照合する
    name_without_grade = _re.sub(r'\s*[（(]G[1-3][）)]$', '', name)

    if name_without_grade in _JRA_GRADE_RACES:
        return _JRA_GRADE_RACES[name_without_grade]

    # 前方一致（長い順に走査して最も具体的なキーを優先）
    for key, grade in sorted(_JRA_GRADE_RACES.items(), key=lambda x: -len(x[0])):
        if name_without_grade.startswith(key) or key.startswith(name_without_grade):
            return grade

    # ── Layer 3: 部分一致（フォールバック） ──
    for key, grade in sorted(_JRA_GRADE_RACES.items(), key=lambda x: -len(x[0])):
        if key in name_without_grade or name_without_grade in key:
            return grade

    return ""


def get_weekly_grade_races(db: Session) -> List[Dict[str, Any]]:
    """
    今週の重賞レース（中央競馬のG1/G2/G3）を返す。

    「今週」の定義:
    - 月〜木: その週の土曜〜日曜
    - 金〜日: 当日〜その週の日曜

    グレード判定:
      DB上の race_name にはグレード接尾辞がないため、
      全レースを取得してから _detect_grade() で
      固定辞書を用いてフィルタリングする。
    """
    JST = timezone(timedelta(hours=9))
    today = datetime.now(JST).date()
    weekday = today.weekday()  # 0=月, 6=日

    if weekday <= 3:  # 月〜木
        days_to_saturday = 5 - weekday
        start_date = today + timedelta(days=days_to_saturday)
        end_date = start_date + timedelta(days=1)  # 日曜
    else:  # 金〜日
        start_date = today
        days_to_sunday = 6 - weekday
        end_date = today + timedelta(days=days_to_sunday)

    # 重賞は通常 10R 以降で行われるため、候補を絞る
    results = db.query(
        models.Race.id,
        models.Race.race_date,
        models.Race.venue_name,
        models.Race.race_number,
        models.Race.race_name,
    ).filter(
        models.Race.race_date.between(start_date, end_date),
        models.Race.race_type == '中央',
        models.Race.predictions.any(),
        models.Race.venue_name.isnot(None),
        models.Race.race_number.isnot(None),
        models.Race.race_name.isnot(None),
        models.Race.race_number >= 9,
    ).order_by(models.Race.race_date, models.Race.race_number).all()

    grade_priority = {"G1": 0, "G2": 1, "G3": 2}
    races = []
    for r in results:
        grade = _detect_grade(r.race_name)
        if not grade:  # 辞書にマッチしない = 非重賞
            continue
        races.append({
            "race_id": r.id,
            "race_date": r.race_date,
            "venue_name": r.venue_name,
            "race_number": r.race_number,
            "race_name": r.race_name,
            "grade": grade,
        })

    races.sort(key=lambda x: (grade_priority.get(x["grade"], 9), x["race_date"]))
    return races