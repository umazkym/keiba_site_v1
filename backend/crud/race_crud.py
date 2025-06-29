# C:\Users\tnszk\program\GitHub\backend\crud\race_crud.py
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import models
from datetime import date
from typing import Dict, Any, List, Optional
from collections import defaultdict
from scripts import predictor # predictorをインポート

def get_predictions_by_date(db: Session, target_date: date) -> Dict[str, Any]:
    """
    指定された日付のレースと予測をDBから取得し、スキーマに合わせた構造で返す。
    ※ここでは全期間の対戦成績を返す
    """
    races_with_preds = db.query(models.Race)\
        .options(
            joinedload(models.Race.predictions),
            joinedload(models.Race.matchup) # 全期間の成績をロード
        )\
        .filter(models.Race.race_date == target_date)\
        .order_by(models.Race.venue_name, models.Race.race_number)\
        .all()

    if not races_with_preds:
        return {"jra": [], "nar": []}
        
    jra_venues: Dict[str, List[models.Race]] = defaultdict(list)
    nar_venues: Dict[str, List[models.Race]] = defaultdict(list)

    for race in races_with_preds:
        if race.predictions:
            race.predictions.sort(
                key=lambda p: p.deviation_score if p.deviation_score is not None else -float('inf'), 
                reverse=True
            )
        
        if race.venue_name and race.course_type and race.distance:
            advantages = db.query(models.HorseNumberAdvantage).filter(
                models.HorseNumberAdvantage.venue_name == race.venue_name,
                models.HorseNumberAdvantage.course_type == race.course_type,
                models.HorseNumberAdvantage.distance == race.distance
            ).order_by(models.HorseNumberAdvantage.horse_number).all()
            setattr(race, 'horse_number_advantages', advantages)
        else:
            setattr(race, 'horse_number_advantages', [])

        if race.race_type == '中央':
            jra_venues[race.venue_name].append(race)
        elif race.race_type == '地方':
            nar_venues[race.venue_name].append(race)

    jra_result = [{"venue_name": v_name, "races": race_list} for v_name, race_list in jra_venues.items()]
    nar_result = [{"venue_name": v_name, "races": race_list} for v_name, race_list in nar_venues.items()]

    return {"jra": jra_result, "nar": nar_result}

def get_special_pick_for_date(db: Session, target_date: date) -> Optional[models.Prediction]:
    """
    指定された日付の予測の中から、最も偏差値が高いものを1件取得する
    """
    return db.query(models.Prediction)\
        .join(models.Race, models.Prediction.race_id == models.Race.id)\
        .filter(models.Race.race_date == target_date)\
        .filter(models.Prediction.deviation_score.isnot(None)) \
        .order_by(desc(models.Prediction.deviation_score))\
        .first()

# ★★★ 新規追加: 期間フィルタリングされた対戦成績を動的に計算する関数 ★★★
def get_filtered_matchups_for_race(db: Session, race_id: str, start_date: date, end_date: date) -> Optional[Dict[str, Any]]:
    """
    指定されたレースの出走馬と期間に基づいて、対戦成績を動的に計算する。
    """
    # 1. レースIDから出走馬のIDリストを取得
    horse_results = db.query(models.Result.horse_id).filter(models.Result.race_id == race_id).all()
    if not horse_results:
        return None
    
    horse_ids = [r.horse_id for r in horse_results]

    # 2. predictorの既存のロジックを再利用して、フィルタリングされた対戦成績を計算
    #    (DBには保存せず、計算結果だけを返す)
    matchup_data = predictor.calculate_matchups(db, horse_ids, start_date, end_date)
    
    return matchup_data