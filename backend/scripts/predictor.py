# C:\Users\tnszk\program\GitHub\backend\scripts\predictor.py

from sqlalchemy.orm import Session
from sqlalchemy import func
from database import models
import pandas as pd
import numpy as np
import math
from datetime import date, timedelta
from typing import Optional, List, Dict, Any # <- この行を修正・追加

def _calculate_1c_indicator(db: Session, horse_id: str, race_date: date) -> float | None:
    """ 1Cスタート指標を計算 """
    past_results = db.query(models.Result.corner_positions, models.Race.total_horses)\
        .join(models.Race)\
        .filter(models.Result.horse_id == horse_id, models.Race.race_date < race_date)\
        .all()
    
    if not past_results: return None

    z_scores = []
    for res in past_results:
        positions = res.corner_positions
        n = res.total_horses
        if not positions or not n or n < 2: continue
        
        # 最初の有効なコーナー通過順位
        start_pos = next((p for p in positions if p is not None), None)
        if start_pos is None: continue
        
        e = (n + 1) / 2.0
        sd = math.sqrt((n**2 - 1) / 12.0)
        if sd == 0: continue
        
        z_scores.append((e - start_pos) / sd)
    
    return np.mean(z_scores) if z_scores else None

def _calculate_performance_scores(db: Session, horse_id: str, race_date: date) -> float | None:
    """ 基タイム差などからパフォーマンススコアを計算 """
    
    # 開催日の2年前から2日前までのデータを取得
    start_date_filter = race_date - timedelta(days=2*365)
    end_date_filter = race_date - timedelta(days=2)
    
    # 1. タイム差の基準となる平均タイムを計算
    # (場所, コース, 距離)ごとの平均タイム
    avg_times_base_q = db.query(
        models.Race.venue_name, models.Race.course_type, models.Race.distance,
        func.avg(models.Result.finish_time_sec).label('avg_time')
    ).join(models.Result).group_by(
        models.Race.venue_name, models.Race.course_type, models.Race.distance
    ).subquery()
    
    # 2. 対象馬の過去成績を取得し、平均タイムと結合
    past_results = db.query(models.Result, models.Race, avg_times_base_q.c.avg_time)\
        .join(models.Race, models.Result.race_id == models.Race.id)\
        .outerjoin(avg_times_base_q, (models.Race.venue_name == avg_times_base_q.c.venue_name) & \
                                     (models.Race.course_type == avg_times_base_q.c.course_type) & \
                                     (models.Race.distance == avg_times_base_q.c.distance))\
        .filter(models.Result.horse_id == horse_id)\
        .filter(models.Race.race_date.between(start_date_filter, end_date_filter))\
        .all()
        
    if not past_results: return None

    # 3. パフォーマンススコアの計算 (提供コードのロジックを再現)
    half_life_days = 180.0
    decay_const = math.log(2.0) / half_life_days
    
    scores = []
    weights = []
    
    for res, race, avg_time in past_results:
        if res.finish_time_sec and avg_time:
            # 基タイム差 (値が大きいほど優秀)
            base_time_diff = avg_time - res.finish_time_sec
            
            # 日付による重み付け
            days_diff = (race_date - race.race_date).days
            weight = math.exp(-decay_const * max(days_diff, 0))
            
            scores.append(base_time_diff)
            weights.append(weight)

    if not scores: return None
    
    # 加重平均を計算
    weighted_avg_score = np.average(scores, weights=weights)
    return weighted_avg_score

def create_predictions_for_race(db: Session, race_id: str) -> Optional[List[Dict[str, Any]]]:
    """ 1レース分の予測を生成し、偏差値と印を付与する """
    
    # 1. レース情報と出走馬情報を取得
    target_race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not target_race: return None
    
    # 出走馬情報は、既に出走表からDBに保存されていると仮定する
    # この部分は、pipelineでshutuba→resultの順でデータ取得することを前提とする
    shutuba_horses = db.query(models.Result.horse_id, models.Horse.name, models.Result.horse_number)\
        .join(models.Horse)\
        .filter(models.Result.race_id == race_id)\
        .order_by(models.Result.horse_number)\
        .all()
        
    if not shutuba_horses: return None

    all_horse_scores = []
    for horse in shutuba_horses:
        # 2. 各馬のパフォーマンススコアと1C指標を計算
        perf_score = _calculate_performance_scores(db, horse.horse_id, target_race.race_date)
        start_1c = _calculate_1c_indicator(db, horse.horse_id, target_race.race_date)
        
        all_horse_scores.append({
            'horse_id': horse.horse_id,
            'horse_name': horse.name,
            'horse_number': horse.horse_number,
            'raw_score': perf_score if perf_score is not None else np.nan,
            'start_1c_indicator': start_1c
        })
        
    df = pd.DataFrame(all_horse_scores)

    # 3. 偏差値計算
    valid_scores = df['raw_score'].dropna()
    if len(valid_scores) < 2:
        df['deviation_score'] = 50.0
    else:
        mean = valid_scores.mean()
        std = valid_scores.std(ddof=0)
        if std == 0:
            df['deviation_score'] = 50.0
        else:
            df['deviation_score'] = df['raw_score'].apply(lambda x: 50.0 + 10 * (x - mean) / std if pd.notna(x) else 50.0)

    df['deviation_score'] = df['deviation_score'].round(2)
    
    # 4. 印を付与
    df = df.sort_values('deviation_score', ascending=False).reset_index(drop=True)
    marks = ["◎", "〇", "▲", "△", "☆"]
    df['mark'] = df.index.map(lambda i: marks[i] if i < len(marks) else "")
    
    return df.to_dict('records')