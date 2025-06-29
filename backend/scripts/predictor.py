# C:\Users\tnszk\program\GitHub\backend\scripts\predictor.py
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import models
import pandas as pd
import numpy as np
import math
from datetime import date, timedelta
from typing import Optional, List, Dict, Any
from collections import defaultdict
from . import database_loader

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

def calculate_and_save_matchups_for_race(db: Session, race_id: str, horse_ids: List[str]):
    """
    指定されたレースの対戦成績を計算し、DBに保存する
    """
    if len(horse_ids) < 2:
        return

    past_results = db.query(models.Result, models.Race.venue_name, models.Race.race_date)\
        .join(models.Race, models.Result.race_id == models.Race.id)\
        .filter(models.Result.horse_id.in_(horse_ids))\
        .all()

    races_grouped = defaultdict(list)
    for res, venue_name, race_date in past_results:
        races_grouped[res.race_id].append({
            'horse_id': res.horse_id, 'rank': res.rank,
            'venue_name': venue_name, 'race_date': race_date.strftime('%Y-%m-%d')
        })

    matchup_matrix = defaultdict(lambda: {'win': 0, 'loss': 0, 'draw': 0, 'history': []})
    for past_race_id, participants in races_grouped.items():
        if len(participants) < 2: continue
        
        for i in range(len(participants)):
            for j in range(i + 1, len(participants)):
                p1 = participants[i]
                p2 = participants[j]
                
                if p1.get('rank') is not None and p2.get('rank') is not None:
                    key1 = f"{p1['horse_id']}_vs_{p2['horse_id']}"
                    key2 = f"{p2['horse_id']}_vs_{p1['horse_id']}"
                    
                    history_entry = {
                        'race_id': past_race_id, 'race_date': participants[0]['race_date'],
                        'venue_name': participants[0]['venue_name'],
                        'p1_horse_id': p1['horse_id'], 'p1_rank': p1['rank'],
                        'p2_horse_id': p2['horse_id'], 'p2_rank': p2['rank']
                    }

                    if p1['rank'] < p2['rank']:
                        matchup_matrix[key1]['win'] += 1
                        matchup_matrix[key2]['loss'] += 1
                    elif p2['rank'] < p1['rank']:
                        matchup_matrix[key1]['loss'] += 1
                        matchup_matrix[key2]['win'] += 1
                    else:
                        matchup_matrix[key1]['draw'] += 1
                        matchup_matrix[key2]['draw'] += 1
                    
                    matchup_matrix[key1]['history'].append(history_entry)
                    matchup_matrix[key2]['history'].append(history_entry)
    
    # DBに保存
    if matchup_matrix:
        existing = db.query(models.Matchup).filter(models.Matchup.race_id == race_id).first()
        if existing:
            existing.matchup_data = dict(matchup_matrix)
        else:
            new_matchup = models.Matchup(race_id=race_id, matchup_data=dict(matchup_matrix))
            db.add(new_matchup)
        db.commit()

# メモリ対策：期間を限定して馬番有利不利を計算する関数
def calculate_and_save_horse_number_advantage_for_period(db: Session, start_date: date, end_date: date):
    """
    指定期間のレース結果から、コース別の馬番有利不利指数を計算し、既存のデータに加算して更新する。
    """
    print(f"Calculating horse number advantages for period: {start_date} to {end_date}...")
    
    results_query = db.query(
        models.Race.id,
        models.Race.venue_name,
        models.Race.course_type,
        models.Race.distance,
        models.Race.total_horses,
        models.Result.horse_number,
        models.Result.rank
    ).join(models.Result, models.Race.id == models.Result.race_id)\
    .filter(models.Race.race_date.between(start_date, end_date))\
    .filter(models.Result.rank.isnot(None))\
    .filter(models.Race.total_horses.isnot(None))\
    .filter(models.Race.course_type.in_(['芝', 'ダ']))

    df = pd.read_sql(results_query.statement, db.bind)
    
    if df.empty:
        print("No new race results found in the specified period.")
        return

    ai_scores = []
    for race_id, group in df.groupby('id'):
        n = group['total_horses'].iloc[0]
        if n is None or n < 2:
            continue
            
        e = (n + 1) / 2.0
        sd = math.sqrt((n**2 - 1) / 12.0)
        if sd == 0:
            continue
            
        group['advantage_score'] = (e - group['rank']) / sd
        ai_scores.append(group)

    if not ai_scores:
        print("Could not calculate any AI scores for the period.")
        return
        
    df_with_ai = pd.concat(ai_scores)

    advantage_groups = df_with_ai.groupby([
        'venue_name', 
        'course_type', 
        'distance', 
        'horse_number'
    ])['advantage_score'].agg(['mean', 'count']).reset_index()

    advantages_to_save = []
    for _, row in advantage_groups.iterrows():
        # 既存のレコードを検索
        existing_advantage = db.query(models.HorseNumberAdvantage).filter_by(
            venue_name=row['venue_name'],
            course_type=row['course_type'],
            distance=row['distance'],
            horse_number=row['horse_number']
        ).first()

        new_score = row['mean']
        
        if existing_advantage:
            # ここでは単純に新しいスコアで上書きする
            # より高度な実装としては、加重平均などが考えられる
            existing_advantage.advantage_score = new_score
        else:
            # 新規作成
            advantages_to_save.append({
                'venue_name': row['venue_name'],
                'course_type': row['course_type'],
                'distance': row['distance'],
                'horse_number': row['horse_number'],
                'advantage_score': new_score
            })
    
    if advantages_to_save:
        database_loader.save_horse_number_advantages(db, advantages_to_save)
        print(f"Saved/Updated {len(advantages_to_save)} horse number advantage records.")
    
    db.commit()