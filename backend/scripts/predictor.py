# C:\Users\zk-ht\Keiba\keiba_site_v1\backend\scripts\predictor.py

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
import traceback # エラー詳細表示のためにインポート

def _calculate_1c_indicator(db: Session, horse_id: str, race_date: date, debug: bool = False) -> Optional[float] | Dict[str, Any]:
    """
    指定された馬の過去のレース結果から1コーナー（またはそれに準ずる序盤のコーナー）での
    位置取り傾向をZスコアで計算する。
    """
    try:
        past_results = db.query(models.Result.corner_positions, models.Race.total_horses)\
            .join(models.Race, models.Result.race_id == models.Race.id)\
            .filter(models.Result.horse_id == horse_id, models.Race.race_date < race_date)\
            .all()

        past_races_found = len(past_results)
        if not past_results:
            return {'z_score': None, 'past_races_found': 0, 'valid_corner_races': 0} if debug else None

        z_scores = []
        for res in past_results:
            positions = res.corner_positions
            n = res.total_horses
            
            if not positions or not isinstance(positions, list) or not n or n < 2:
                continue
            
            if not any(isinstance(p, int) and p > 0 for p in positions):
                continue
                
            start_pos = next((p for p in positions[:2] if isinstance(p, int) and p > 0), None)
            if start_pos is None:
                continue
            
            e = (n + 1) / 2.0
            sd = math.sqrt((n**2 - 1) / 12.0)
            if sd == 0:
                continue
            
            z_scores.append((e - start_pos) / sd)

        valid_corner_races = len(z_scores)
        mean_z_score = np.mean(z_scores) if z_scores else None

        if debug:
            return {
                'z_score': mean_z_score,
                'past_races_found': past_races_found,
                'valid_corner_races': valid_corner_races
            }
        else:
            return mean_z_score
    except Exception:
        # 計算中に予期せぬエラーが発生した場合でも None を返す
        return {'z_score': None, 'past_races_found': 0, 'valid_corner_races': 0} if debug else None

def _get_bulk_performance_data(db: Session, horse_ids: List[str], race_date: date) -> Dict[str, List[Any]]:
    """
    指定された馬リストの過去成績データを一括で取得する。
    """
    if not horse_ids:
        return {}
    try:
        start_date_filter = race_date - timedelta(days=2*365)
        end_date_filter = race_date - timedelta(days=2)
        
        avg_times_base_q = db.query(
            models.Race.venue_name, models.Race.course_type, models.Race.distance,
            func.avg(models.Result.finish_time_sec).label('avg_time')
        ).join(models.Result).filter(models.Race.course_type.in_(['芝', 'ダ'])).group_by(
            models.Race.venue_name, models.Race.course_type, models.Race.distance
        ).subquery()

        all_past_results = db.query(models.Result, models.Race, avg_times_base_q.c.avg_time)\
            .join(models.Race, models.Result.race_id == models.Race.id)\
            .outerjoin(avg_times_base_q, (models.Race.venue_name == avg_times_base_q.c.venue_name) & \
                                        (models.Race.course_type == avg_times_base_q.c.course_type) & \
                                        (models.Race.distance == avg_times_base_q.c.distance))\
            .filter(models.Result.horse_id.in_(horse_ids))\
            .filter(models.Race.race_date.between(start_date_filter, end_date_filter))\
            .all()
        
        results_by_horse = defaultdict(list)
        for res, race, avg_time in all_past_results:
            results_by_horse[res.horse_id].append((res, race, avg_time))
            
        return results_by_horse
    except Exception:
        # データ取得でエラーが発生した場合は空の辞書を返す
        return {}


def _calculate_scores_from_data(horse_past_results: List[Any], race_date: date) -> Optional[float]:
    """
    取得済みの過去成績データからパフォーマンススコアを計算する（DBアクセスなし）。
    """
    try:
        if not horse_past_results: return None
        half_life_days = 180.0
        decay_const = math.log(2.0) / half_life_days
        scores, weights = [], []
        for res, race, avg_time in horse_past_results:
            if res.finish_time_sec and avg_time:
                base_time_diff = avg_time - res.finish_time_sec
                days_diff = (race_date - race.race_date).days
                weight = math.exp(-decay_const * max(days_diff, 0))
                scores.append(base_time_diff)
                weights.append(weight)
        if not scores: return None
        return np.average(scores, weights=weights)
    except Exception:
        # スコア計算でエラーが発生した場合はNoneを返す
        return None

# ==============================================================================
# ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
def create_predictions_for_race(race_id: str, db: Session) -> Optional[List[Dict[str, Any]]]:
    """
    レースの予測を生成するメイン関数。
    エラーハンドリングを強化し、予測不能な場合でも安全に終了するように修正。
    """
    # この関数内で使う出走馬情報を最初に取得し、エラー発生時にも再利用できるようにする
    shutuba_horses = []
    try:
        target_race = db.query(models.Race).filter(models.Race.id == race_id).first()
        if not target_race: return None
        
        shutuba_horses = db.query(
            models.Result.horse_id, models.Horse.name,
            models.Result.horse_number, models.Result.waku_number
        ).join(models.Horse, models.Result.horse_id == models.Horse.id)\
         .filter(models.Result.race_id == race_id)\
         .all()
            
        if not shutuba_horses: return None
        
        all_horse_scores = []
        for h in shutuba_horses:
            if h.horse_id and h.horse_number:
                all_horse_scores.append({
                    'horse_id': h.horse_id,
                    'horse_name': h.name,
                    'horse_number': h.horse_number,
                    'waku_number': h.waku_number,
                })

        if not all_horse_scores: return None

        unpredictable_reason = None
        if target_race.race_name:
            if "新馬" in target_race.race_name:
                unpredictable_reason = "新馬戦のため、予測対象外です。"
            elif "障害" in target_race.race_name or target_race.course_type == '障':
                unpredictable_reason = "障害戦のため、予測対象外です。"
                
        horse_ids = [h['horse_id'] for h in all_horse_scores]
        
        all_past_data = {}
        if not unpredictable_reason and horse_ids:
            all_past_data = _get_bulk_performance_data(db, horse_ids, target_race.race_date)

        for horse_data in all_horse_scores:
            horse_past_results = all_past_data.get(horse_data['horse_id'], [])
            perf_score = _calculate_scores_from_data(horse_past_results, target_race.race_date)
            start_1c_z_score = _calculate_1c_indicator(db, horse_data['horse_id'], target_race.race_date, debug=False)
            horse_data['raw_score'] = perf_score if perf_score is not None else np.nan
            horse_data['start_1c_z_score'] = start_1c_z_score

        df = pd.DataFrame(all_horse_scores)
        
        valid_scores = df['raw_score'].dropna()
        if not unpredictable_reason and len(valid_scores) < 2:
            unpredictable_reason = "比較可能な過去データを持つ馬が2頭未満のため、予測対象外です。"

        valid_1c_scores = df['start_1c_z_score'].dropna()
        if len(valid_1c_scores) > 1:
            min_val, max_val = valid_1c_scores.min(), valid_1c_scores.max()
            if abs(max_val - min_val) < 1e-9:
                df['start_1c_indicator'] = 50.0
            else:
                df['start_1c_indicator'] = df['start_1c_z_score'].apply(
                    lambda z: 1.0 + (z - min_val) * 99 / (max_val - min_val) if pd.notna(z) else None
                )
        else:
            df['start_1c_indicator'] = None

        if unpredictable_reason:
            df['deviation_score'] = None
            df['mark'] = "—"
            df['unpredictable_reason'] = unpredictable_reason
        else:
            mean = valid_scores.mean()
            std = valid_scores.std(ddof=0)
            if std == 0 or np.isnan(std):
                df['deviation_score'] = 50.0
            else:
                df['deviation_score'] = df['raw_score'].apply(lambda x: 50.0 + 10 * (x - mean) / std if pd.notna(x) else None)
            
            df['deviation_score'] = df['deviation_score'].round(2)
            df = df.sort_values('deviation_score', ascending=False, na_position='last').reset_index(drop=True)
            marks = ["◎", "〇", "▲", "△", "☆"]
            df['mark'] = df.index.map(lambda i: marks[i] if pd.notna(df.loc[i, 'deviation_score']) and i < len(marks) else "")
            df['unpredictable_reason'] = None

        df = df.drop(columns=['start_1c_z_score', 'raw_score'], errors='ignore')
        
        final_columns = [c.name for c in models.Prediction.__table__.columns if c.name in df.columns]
        df_final = df[final_columns].replace({np.nan: None})
        
        return df_final.to_dict('records')
    except Exception as e:
        print(f"--- [CRITICAL PREDICTION ERROR] Race ID: {race_id} ---")
        traceback.print_exc()
        print("--------------------------------------------------")
        # エラー発生時は、予測不能としてマークしたデータを返すことで、パイプラインを止めない
        # ★★★ 修正: DB再クエリをやめ、関数冒頭で取得した shutuba_horses を使う ★★★
        if not shutuba_horses:
            return None 

        error_predictions = []
        for h in shutuba_horses:
            if h.horse_id and h.horse_number: # 馬IDと馬番を保証
                error_predictions.append({
                    'horse_id': h.horse_id,
                    'horse_name': h.name,
                    'horse_number': h.horse_number,
                    'waku_number': h.waku_number,
                    'deviation_score': None,
                    'mark': '—',
                    'start_1c_indicator': None,
                    'unpredictable_reason': f"予測計算中にエラーが発生"
                })
        return error_predictions
# ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

def calculate_matchups(db: Session, horse_ids: List[str], start_date: date, end_date: date) -> Dict[str, Any]:
    # (...以下、変更なし...)
    if len(horse_ids) < 2:
        return {}
    past_results = db.query(models.Result, models.Race.venue_name, models.Race.race_date)\
        .join(models.Race, models.Result.race_id == models.Race.id)\
        .filter(models.Result.horse_id.in_(horse_ids))\
        .filter(models.Race.race_date.between(start_date, end_date)) \
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
    return dict(matchup_matrix)

def calculate_and_save_matchups_for_race(db: Session, race_id: str, horse_ids: List[str]):
    start_date = date(2000, 1, 1)
    end_date = date.today()
    matchup_data = calculate_matchups(db, horse_ids, start_date, end_date)
    if matchup_data:
        existing = db.query(models.Matchup).filter(models.Matchup.race_id == race_id).first()
        if existing:
            existing.matchup_data = matchup_data
        else:
            new_matchup = models.Matchup(race_id=race_id, matchup_data=matchup_data)
            db.add(new_matchup)
        db.commit()

def calculate_and_save_horse_number_advantage_for_period(db: Session, start_date: date, end_date: date):
    print(f"Calculating horse number advantages for period: {start_date} to {end_date}...")
    results_query = db.query(
        models.Race.id,
        models.Race.venue_name,
        models.Race.course_type,
        models.Race.distance,
        models.Race.total_horses,
        models.Result.horse_number,
        models.Result.rank
    ).join(models.Result, models.Race.id == models.Race.id)\
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
        advantages_to_save.append({
            'venue_name': row['venue_name'],
            'course_type': row['course_type'],
            'distance': int(row['distance']),
            'horse_number': int(row['horse_number']),
            'advantage_score': float(row['mean'])
        })
    if advantages_to_save:
        database_loader.save_horse_number_advantages(db, advantages_to_save)
        print(f"Saved/Updated {len(advantages_to_save)} horse number advantage records.")
    db.commit()