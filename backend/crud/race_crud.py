# C:\Users\tnszk\program\GitHub\backend\crud\race_crud.py
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, func, case, and_
from database import models
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
from scripts import predictor

def get_predictions_by_date(db: Session, target_date: date) -> Dict[str, Any]:
    # 最初に、その日に有効な予測を持つレースIDのリストを取得する
    valid_race_ids_query = db.query(models.Prediction.race_id)\
        .join(models.Race, models.Race.id == models.Prediction.race_id)\
        .filter(models.Race.race_date == target_date)\
        .distinct()

    # 有効なレースIDを持つレースのみを対象にクエリを実行する
    races_with_preds = db.query(models.Race)\
        .options(
            joinedload(models.Race.predictions),
            joinedload(models.Race.results).joinedload(models.Result.horse)
        )\
        .filter(models.Race.id.in_(valid_race_ids_query))\
        .order_by(models.Race.venue_name, models.Race.race_number)\
        .all()

    if not races_with_preds:
        return {"jra": [], "nar": []}

    # venue_name, course_type, distance のいずれかがNoneのレースを除外する
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
        all_advantages = db.query(models.HorseNumberAdvantage).filter(or_(*filters)).all()
        
        for adv in all_advantages:
            key = (adv.venue_name, adv.course_type, adv.distance)
            advantages_map[key].append(adv)

    jra_venues: Dict[str, List[models.Race]] = defaultdict(list)
    nar_venues: Dict[str, List[models.Race]] = defaultdict(list)

    for race in races_with_preds:
        # この時点で race.predictions は必ず存在するので、Noneチェックは不要
        race.predictions.sort(
            key=lambda p: p.deviation_score if p.deviation_score is not None else -float('inf'),
            reverse=True
        )
        
        advantages = []
        if race.venue_name and race.course_type and race.distance:
            key = (race.venue_name, race.course_type, race.distance)
            advantages = advantages_map.get(key, [])
        
        advantages.sort(key=lambda x: x.horse_number)
        setattr(race, 'horse_number_advantages', advantages)

        for r in race.results:
            setattr(r, 'horse_name', r.horse.name if r.horse else 'N/A')

        if race.race_type == '中央':
            jra_venues[race.venue_name].append(race)
        elif race.race_type == '地方':
            nar_venues[race.venue_name].append(race)

    jra_result = [{"venue_name": v_name, "races": race_list} for v_name, race_list in jra_venues.items()]
    nar_result = [{"venue_name": v_name, "races": race_list} for v_name, race_list in nar_venues.items()]

    return {"jra": jra_result, "nar": nar_result}


def get_special_pick_for_date(db: Session, target_date: date) -> Optional[models.Prediction]:
    # (...以下、変更なし...)
    return db.query(models.Prediction)\
        .join(models.Race, models.Prediction.race_id == models.Race.id)\
        .filter(models.Race.race_date == target_date)\
        .filter(models.Prediction.deviation_score.isnot(None)) \
        .order_by(desc(models.Prediction.deviation_score))\
        .first()


def get_filtered_matchups_for_race(db: Session, race_id: str, start_date: date, end_date: date) -> Optional[Dict[str, Any]]:
    horse_results = db.query(models.Result.horse_id).filter(models.Result.race_id == race_id).all()
    if not horse_results:
        return None

    horse_ids = [r.horse_id for r in horse_results]
    matchup_data = predictor.calculate_matchups(db, horse_ids, start_date, end_date)
    return matchup_data


def get_top_payout_hits(db: Session, days: int = 7, limit: int = 5) -> List[Dict[str, Any]]:
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)

    top_preds_sq = db.query(
        models.Prediction.race_id,
        func.array_agg(models.Prediction.horse_number).label('top_horse_numbers'),
        func.array_agg(models.Prediction.waku_number).label('top_waku_numbers')
    ).filter(
        models.Prediction.mark.in_(['◎', '〇', '▲', '△', '☆'])
    ).group_by(models.Prediction.race_id).subquery('top_preds_sq')

    hit_condition = case(
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

    query = db.query(
        models.Race.id.label("race_id"),
        models.Race.race_date,
        models.Race.venue_name,
        models.Race.race_number,
        models.Race.race_name,
        models.RaceReturn.bet_type,
        models.RaceReturn.payout,
        models.RaceReturn.number_1,
        models.RaceReturn.number_2,
        models.RaceReturn.number_3,
    ).select_from(models.RaceReturn).join(
        models.Race, models.RaceReturn.race_id == models.Race.id
    ).join(
        top_preds_sq, models.RaceReturn.race_id == top_preds_sq.c.race_id
    ).filter(
        models.Race.race_date.between(start_date, end_date),
        hit_condition
    ).order_by(
        desc(models.RaceReturn.payout)
    ).limit(limit)

    results = query.all()

    all_hits = []
    BET_TYPE_MAP_JA = {
        'tansho': '単勝', 'fukusho': '複勝', 'wakuren': '枠連', 'umaren': '馬連',
        'wide': 'ワイド', 'umatan': '馬単', 'sanrenpuku': '3連複', 'sanrentan': '3連単'
    }

    for hit in results:
        delimiter = '→' if hit.bet_type in ['umatan', 'sanrentan'] else '-'
        numbers_str_list = [str(n) for n in [hit.number_1, hit.number_2, hit.number_3] if n is not None]
        winning_numbers_str = delimiter.join(numbers_str_list)

        all_hits.append({
            "race_id": hit.race_id,
            "race_date": hit.race_date,
            "venue_name": hit.venue_name,
            "race_number": hit.race_number,
            "race_name": hit.race_name,
            "bet_type": BET_TYPE_MAP_JA.get(hit.bet_type, hit.bet_type),
            "winning_numbers": winning_numbers_str,
            "payout": hit.payout
        })

    return all_hits

def get_high_payout_hits_for_date(db: Session, target_date: date) -> List[Dict[str, Any]]:
    """
    指定された日付のAI予測による高配当（10,000円以上）の的中を全て取得する。
    """
    # AI予測の上位5頭（◎, 〇, ▲, △, ☆）の馬番・枠番を取得
    top_preds_sq = db.query(
        models.Prediction.race_id,
        func.array_agg(models.Prediction.horse_number).label('top_horse_numbers'),
        func.array_agg(models.Prediction.waku_number).label('top_waku_numbers')
    ).filter(
        models.Prediction.mark.in_(['◎', '〇', '▲', '△', '☆'])
    ).group_by(models.Prediction.race_id).subquery('top_preds_sq')

    # AI予測の上位5頭で的中した馬券の条件を定義
    hit_condition = case(
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

    # 的中したレースの中から、指定日で10,000円以上の払い戻しがあったものを検索
    query = db.query(
        models.Race.id.label("race_id"),
        models.Race.race_date,
        models.Race.venue_name,
        models.Race.race_number,
        models.Race.race_name,
        models.RaceReturn.bet_type,
        models.RaceReturn.payout,
        models.RaceReturn.number_1,
        models.RaceReturn.number_2,
        models.RaceReturn.number_3,
    ).select_from(models.RaceReturn).join(
        models.Race, models.RaceReturn.race_id == models.Race.id
    ).join(
        top_preds_sq, models.RaceReturn.race_id == top_preds_sq.c.race_id
    ).filter(
        models.Race.race_date == target_date,
        models.RaceReturn.payout >= 10000, # 払い戻しが10,000円以上
        hit_condition
    ).order_by(
        desc(models.RaceReturn.payout) # 払い戻しが高い順にソート
    )

    results = query.all()
    
    # フロントエンドで使いやすいようにデータを整形
    all_hits = []
    BET_TYPE_MAP_JA = {
        'tansho': '単勝', 'fukusho': '複勝', 'wakuren': '枠連', 'umaren': '馬連',
        'wide': 'ワイド', 'umatan': '馬単', 'sanrenpuku': '3連複', 'sanrentan': '3連単'
    }

    for hit in results:
        delimiter = '→' if hit.bet_type in ['umatan', 'sanrentan'] else '-'
        numbers_str_list = [str(n) for n in [hit.number_1, hit.number_2, hit.number_3] if n is not None]
        winning_numbers_str = delimiter.join(numbers_str_list)

        all_hits.append({
            "race_id": hit.race_id,
            "race_date": hit.race_date.strftime('%Y-%m-%d'),
            "venue_name": hit.venue_name,
            "race_number": hit.race_number,
            "race_name": hit.race_name,
            "bet_type": BET_TYPE_MAP_JA.get(hit.bet_type, hit.bet_type),
            "winning_numbers": winning_numbers_str,
            "payout": hit.payout
        })

    return all_hits

def get_all_race_urls(db: Session) -> List[Dict[str, Any]]:
    """
    サイトマップ生成のために、全レースの日付、会場、レース番号を取得する。

    ▼▼▼【修正: インデックス未登録エラーを回避するため、より厳密なフィルタリングを追加】▼▼▼
    - 予測データが存在し、かつ venue_name と race_number が有効なレースのみを対象にする
    - これにより、不完全なレースデータがサイトマップに含まれるのを防ぐ
    ▲▲▲【修正ここまで】▲▲▲
    """
    results = db.query(
        models.Race.race_date,
        models.Race.venue_name,
        models.Race.race_number
    ).filter(
        models.Race.predictions.any(),  # 予測データが存在するレースのみ
        # ▼▼▼【修正: venue_name と race_number が NULL でないことを確認】▼▼▼
        models.Race.venue_name.isnot(None),  # 会場名が存在する
        models.Race.race_number.isnot(None),  # レース番号が存在する
        # ▲▲▲【修正ここまで】▲▲▲
    ).order_by(
        models.Race.race_date.desc()
    ).all()

    return [
        {
            "race_date": result.race_date.strftime('%Y-%m-%d'),
            "venue_name": result.venue_name,
            "race_number": result.race_number
        }
        for result in results
    ]

import re

def get_heavy_stakes_race_urls(db: Session) -> List[Dict[str, Any]]:
    """
    サイトマップ生成のために、重賞レース（G1, G2, G3等）のURL情報のみを取得するエンドポイント。
    AdSense対策として、高品質なページのみをインデックスさせるために使用します。
    """
    results = db.query(
        models.Race.race_date,
        models.Race.venue_name,
        models.Race.race_number,
        models.Race.race_name
    ).filter(
        models.Race.predictions.any(),
        models.Race.venue_name.isnot(None),
        models.Race.race_number.isnot(None)
    ).order_by(
        models.Race.race_date.desc()
    ).all()

    heavy_stakes_urls = []
    # G1, G2, G3, GⅠ, GⅡ, GⅢ, J・G1 などをマッチする正規表現
    pattern = re.compile(r'[GＧ][1-3１-３Ⅰ-Ⅲ]|J・G', re.IGNORECASE)
    
    for r in results:
        if r.race_name and pattern.search(r.race_name):
            heavy_stakes_urls.append({
                "race_date": r.race_date.strftime('%Y-%m-%d'),
                "venue_name": r.venue_name,
                "race_number": r.race_number
            })
            
    return heavy_stakes_urls