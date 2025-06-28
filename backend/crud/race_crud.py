# C:\Users\tnszk\program\GitHub\backend\crud\race_crud.py
from sqlalchemy.orm import Session, joinedload
from database import models
from datetime import date
from typing import Dict, Any, List, Optional
from collections import defaultdict

def get_predictions_by_date(db: Session, target_date: date) -> Dict[str, Any]:
    """
    指定された日付のレースと予測をDBから取得し、スキーマに合わせた構造で返す。
    ★★★ 馬番有利不利データも付与する ★★★
    """
    races_with_preds = db.query(models.Race)\
        .options(
            joinedload(models.Race.predictions),
            joinedload(models.Race.matchup)
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
        
        # ★★★ 修正箇所: `total_horses`の条件を削除 ★★★
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
        .order_by(models.Prediction.deviation_score.desc())\
        .first()