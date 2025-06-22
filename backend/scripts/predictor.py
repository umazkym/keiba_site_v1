# C:\Users\tnszk\program\GitHub\backend\scripts\predictor.py
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import models
import pandas as pd
import numpy as np
import math
from datetime import date, timedelta
from typing import Optional, List, Dict, Any

def _calculate_1c_indicator(db: Session, horse_id: str, race_date: date) -> Optional[float]:
    past_results = db.query(models.Result.corner_positions, models.Race.total_horses)\
        .join(models.Race, models.Result.race_id == models.Race.id)\
        .filter(models.Result.horse_id == horse_id, models.Race.race_date < race_date)\
        .all()
    if not past_results: return None
    z_scores = []
    for res in past_results:
        positions = res.corner_positions
        n = res.total_horses
        if not positions or not isinstance(positions, list) or not n or n < 2: continue
        start_pos = next((p for p in positions[:2] if isinstance(p, int) and p > 0), None)
        if start_pos is None: continue
        e = (n + 1) / 2.0
        sd = math.sqrt((n**2 - 1) / 12.0)
        if sd == 0: continue
        z_scores.append((e - start_pos) / sd)
    return np.mean(z_scores) if z_scores else None

def _calculate_performance_scores(db: Session, horse_id: str, race_date: date) -> Optional[float]:
    start_date_filter = race_date - timedelta(days=2*365)
    end_date_filter = race_date - timedelta(days=2)
    avg_times_base_q = db.query(
        models.Race.venue_name, models.Race.course_type, models.Race.distance,
        func.avg(models.Result.finish_time_sec).label('avg_time')
    ).join(models.Result).filter(models.Race.course_type.in_(['芝', 'ダ'])).group_by(
        models.Race.venue_name, models.Race.course_type, models.Race.distance
    ).subquery()
    past_results = db.query(models.Result, models.Race, avg_times_base_q.c.avg_time)\
        .join(models.Race, models.Result.race_id == models.Race.id)\
        .outerjoin(avg_times_base_q, (models.Race.venue_name == avg_times_base_q.c.venue_name) & \
                                     (models.Race.course_type == avg_times_base_q.c.course_type) & \
                                     (models.Race.distance == avg_times_base_q.c.distance))\
        .filter(models.Result.horse_id == horse_id)\
        .filter(models.Race.race_date.between(start_date_filter, end_date_filter))\
        .all()
    if not past_results: return None
    half_life_days = 180.0
    decay_const = math.log(2.0) / half_life_days
    scores, weights = [], []
    for res, race, avg_time in past_results:
        if res.finish_time_sec and avg_time:
            base_time_diff = avg_time - res.finish_time_sec
            days_diff = (race_date - race.race_date).days
            weight = math.exp(-decay_const * max(days_diff, 0))
            scores.append(base_time_diff)
            weights.append(weight)
    if not scores: return None
    return np.average(scores, weights=weights)

def create_predictions_for_race(db: Session, race_id: str) -> Optional[List[Dict[str, Any]]]:
    target_race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not target_race: return None
    shutuba_horses = db.query(
        models.Result.horse_id, models.Horse.name, 
        models.Result.horse_number, models.Result.waku_number
    ).join(models.Horse, models.Result.horse_id == models.Horse.id)\
     .filter(models.Result.race_id == race_id)\
     .order_by(models.Result.horse_number).all()
    if not shutuba_horses: return None
    is_unpredictable = False
    if target_race.race_name and ("新馬" in target_race.race_name or "障害" in target_race.race_name or target_race.course_type == '障'):
        is_unpredictable = True
    all_horse_scores = []
    for horse in shutuba_horses:
        perf_score = None if is_unpredictable else _calculate_performance_scores(db, horse.horse_id, target_race.race_date)
        start_1c = _calculate_1c_indicator(db, horse.horse_id, target_race.race_date)
        all_horse_scores.append({
            'horse_id': horse.horse_id, 'horse_name': horse.name, 
            'horse_number': horse.horse_number, 'waku_number': horse.waku_number,
            'raw_score': perf_score if perf_score is not None else np.nan,
            'start_1c_indicator': start_1c
        })
    df = pd.DataFrame(all_horse_scores)
    valid_scores = df['raw_score'].dropna()
    if is_unpredictable or len(valid_scores) < 2:
        df['deviation_score'] = None
        df['mark'] = "—"
    else:
        mean = valid_scores.mean()
        std = valid_scores.std(ddof=0)
        if std == 0:
            df['deviation_score'] = 50.0
        else:
            df['deviation_score'] = df['raw_score'].apply(lambda x: 50.0 + 10 * (x - mean) / std if pd.notna(x) else None)
        df['deviation_score'] = df['deviation_score'].round(2)
        df = df.sort_values('deviation_score', ascending=False, na_position='last').reset_index(drop=True)
        marks = ["◎", "〇", "▲", "△", "☆"]
        df['mark'] = df.index.map(lambda i: marks[i] if pd.notna(df.loc[i, 'deviation_score']) and i < len(marks) else "")
    df_final = df.replace({np.nan: None})
    return df_final.to_dict('records')