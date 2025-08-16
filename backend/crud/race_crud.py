# C:\Users\tnszk\program\GitHub\backend\crud\race_crud.py
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, func, case, and_ # 必要な関数をインポート
from database import models
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
from scripts import predictor

def get_predictions_by_date(db: Session, target_date: date) -> Dict[str, Any]:
    # ... この関数は変更ありません ...
    races_with_preds = db.query(models.Race)\
        .options(
            joinedload(models.Race.predictions),
            joinedload(models.Race.results).joinedload(models.Result.horse)
        )\
        .filter(models.Race.race_date == target_date)\
        .order_by(models.Race.venue_name, models.Race.race_number)\
        .all()

    if not races_with_preds:
        return {"jra": [], "nar": []}

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
        if race.predictions:
            race.predictions.sort(
                key=lambda p: p.deviation_score if p.deviation_score is not None else -float('inf'),
                reverse=True
            )
        
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
    # ... この関数は変更ありません ...
    return db.query(models.Prediction)\
        .join(models.Race, models.Prediction.race_id == models.Race.id)\
        .filter(models.Race.race_date == target_date)\
        .filter(models.Prediction.deviation_score.isnot(None)) \
        .order_by(desc(models.Prediction.deviation_score))\
        .first()


def get_filtered_matchups_for_race(db: Session, race_id: str, start_date: date, end_date: date) -> Optional[Dict[str, Any]]:
    # ... この関数は変更ありません ...
    horse_results = db.query(models.Result.horse_id).filter(models.Result.race_id == race_id).all()
    if not horse_results:
        return None

    horse_ids = [r.horse_id for r in horse_results]
    matchup_data = predictor.calculate_matchups(db, horse_ids, start_date, end_date)
    return matchup_data


def get_top_payout_hits(db: Session, days: int = 7, limit: int = 5) -> List[Dict[str, Any]]:
    """
    過去N日間のAI予測による高配当的中トップN件を、単一の効率的なクエリで取得します。
    """
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)

    # 1. サブクエリ: 各レースIDごとに、AI予測上位5頭の馬番と枠番の配列を作成します。
    # これにより、メインのクエリで各レースの予測情報を効率的に参照できます。
    top_preds_sq = db.query(
        models.Prediction.race_id,
        func.array_agg(models.Prediction.horse_number).label('top_horse_numbers'),
        func.array_agg(models.Prediction.waku_number).label('top_waku_numbers')
    ).filter(
        models.Prediction.mark.in_(['◎', '〇', '▲', '△', '☆'])
    ).group_by(models.Prediction.race_id).subquery('top_preds_sq')

    # 2. 的中条件をSQLのCASE文で構築します。
    # これにより、Python側でループ処理をする代わりに、データベース側で高速に的中判定が実行されます。
    hit_condition = case(
        ( # 枠連の的中判定
            models.RaceReturn.bet_type == 'wakuren',
            and_(
                models.RaceReturn.number_1 == func.any(top_preds_sq.c.top_waku_numbers),
                models.RaceReturn.number_2 == func.any(top_preds_sq.c.top_waku_numbers)
            )
        ),
        ( # 単勝・複勝の的中判定
            models.RaceReturn.bet_type.in_(['tansho', 'fukusho']),
            models.RaceReturn.number_1 == func.any(top_preds_sq.c.top_horse_numbers)
        ),
        ( # 馬連・ワイド・馬単の的中判定
            models.RaceReturn.bet_type.in_(['umaren', 'wide', 'umatan']),
            and_(
                models.RaceReturn.number_1 == func.any(top_preds_sq.c.top_horse_numbers),
                models.RaceReturn.number_2 == func.any(top_preds_sq.c.top_horse_numbers)
            )
        ),
        ( # 3連複・3連単の的中判定
            models.RaceReturn.bet_type.in_(['sanrenpuku', 'sanrentan']),
            and_(
                models.RaceReturn.number_1 == func.any(top_preds_sq.c.top_horse_numbers),
                models.RaceReturn.number_2 == func.any(top_preds_sq.c.top_horse_numbers),
                models.RaceReturn.number_3 == func.any(top_preds_sq.c.top_horse_numbers)
            )
        ),
        else_=False # 上記以外の券種は対象外
    )

    # 3. メインクエリ: 必要な情報をJOINで結合し、的中条件でフィルタリング後、配当順にソートして取得します。
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
    ).select_from(models.RaceReturn).join( # RaceReturnを起点にJOIN
        models.Race, models.RaceReturn.race_id == models.Race.id
    ).join( # サブクエリをJOIN
        top_preds_sq, models.RaceReturn.race_id == top_preds_sq.c.race_id
    ).filter(
        models.Race.race_date.between(start_date, end_date), # 期間で絞り込み
        hit_condition  # 的中したデータのみに絞り込み
    ).order_by(
        desc(models.RaceReturn.payout) # 配当が高い順にソート
    ).limit(limit) # 上位N件に制限

    results = query.all()

    # 4. 取得した結果をAPIのレスポンス形式に整形します。
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