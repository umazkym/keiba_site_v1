import time
import traceback
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
from .race_classification import prediction_exclusion_reason
from tqdm import tqdm
import os

# 環境判定: GitHub Actions のみバッチサイズを絞る
# Cloud Run (K_SERVICE) は API サーバーのためこの関数は呼ばれない
_IS_GITHUB_ACTIONS = os.getenv("GITHUB_ACTIONS") == "true"


def _calculate_1c_indicator(
    db: Session, horse_id: str, race_date: date, debug: bool = False
) -> Optional[float] | Dict[str, Any]:
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
        return mean_z_score
    except Exception:
        return {'z_score': None, 'past_races_found': 0, 'valid_corner_races': 0} if debug else None


_cached_avg_times_dict = None

def _get_avg_times_dict(db: Session) -> Dict[tuple, float]:
    global _cached_avg_times_dict
    import gc
    if _cached_avg_times_dict is not None:
        return _cached_avg_times_dict
    
    avg_times_rows = db.query(
        models.Race.venue_name,
        models.Race.course_type,
        models.Race.distance,
        func.avg(models.Result.finish_time_sec).label('avg_time')
    ).join(models.Result).filter(
        models.Race.course_type.in_(['芝', 'ダ'])
    ).group_by(
        models.Race.venue_name,
        models.Race.course_type,
        models.Race.distance
    ).all()

    _cached_avg_times_dict = {
        (row.venue_name, row.course_type, row.distance): float(row.avg_time)
        for row in avg_times_rows
        if row.avg_time is not None
    }
    del avg_times_rows
    gc.collect()
    return _cached_avg_times_dict

def _get_bulk_performance_data(
    db: Session, horse_ids: List[str], race_date: date
) -> Dict[str, List[Any]]:
    """
    指定された馬リストの過去成績データを一括取得する。

    ★最適化1: avg_times をモジュールレベルでキャッシュし、毎レースの再集計を回避。（コンピュートCU大幅削減）
    ★最適化2: ORMで全体オブジェクトを取らず、必要な数カラムのみをSELECT。（DB転送量大幅削減）
    """
    import gc
    if not horse_ids:
        return {}
    try:
        start_date_filter = race_date - timedelta(days=365)
        end_date_filter = race_date - timedelta(days=2)

        # キャッシュされた辞書を取得
        avg_times_dict = _get_avg_times_dict(db)

        results_by_horse: Dict[str, List] = defaultdict(list)

        # GitHub Actions は小バッチ（メモリ節約）
        BATCH_SIZE = 5 if _IS_GITHUB_ACTIONS else 10

        for i in range(0, len(horse_ids), BATCH_SIZE):
            batch_horse_ids = horse_ids[i:i + BATCH_SIZE]

            # フルORMオブジェクトではなく必要なカラムだけを抽出（通信量の大幅削減）
            batch_results = db.query(
                models.Result.horse_id.label('horse_id'),
                models.Result.finish_time_sec.label('finish_time_sec'),
                models.Race.race_date.label('race_date'),
                models.Race.venue_name.label('venue_name'),
                models.Race.course_type.label('course_type'),
                models.Race.distance.label('distance')
            )\
            .join(models.Race, models.Result.race_id == models.Race.id)\
            .filter(models.Result.horse_id.in_(batch_horse_ids))\
            .filter(models.Race.race_date.between(start_date_filter, end_date_filter))\
            .all()

            for row in batch_results:
                avg_time = avg_times_dict.get(
                    (row.venue_name, row.course_type, row.distance)
                )
                # rowから必要な値を取り出し、tuple として保存
                results_by_horse[row.horse_id].append((row.finish_time_sec, row.race_date, avg_time))

            del batch_results
            gc.collect()

        return results_by_horse

    except Exception as e:
        print(f"[WARNING] _get_bulk_performance_data でエラー発生: {e}")
        traceback.print_exc()
        return {}


def _calculate_scores_from_data(
    horse_past_results: List[Any], race_date: date
) -> Optional[float]:
    try:
        if not horse_past_results:
            return None
        half_life_days = 180.0
        decay_const = math.log(2.0) / half_life_days
        scores, weights = [], []
        # ここは _get_bulk_performance_data の戻り値構造に合わせて変更
        for finish_time_sec, hist_race_date, avg_time in horse_past_results:
            if finish_time_sec and avg_time:
                base_time_diff = avg_time - finish_time_sec
                days_diff = (race_date - hist_race_date).days
                weight = math.exp(-decay_const * max(days_diff, 0))
                scores.append(base_time_diff)
                weights.append(weight)
        if not scores:
            return None
        return float(np.average(scores, weights=weights))
    except Exception:
        return None


def create_predictions_for_race(race_id: str, db: Session) -> Optional[List[Dict[str, Any]]]:
    shutuba_horses = []
    try:
        target_race = db.query(models.Race).filter(models.Race.id == race_id).first()
        if not target_race:
            return None

        shutuba_horses = db.query(
            models.Result.horse_id, models.Horse.name,
            models.Result.horse_number, models.Result.waku_number
        ).join(models.Horse, models.Result.horse_id == models.Horse.id)\
         .filter(models.Result.race_id == race_id)\
         .all()

        if not shutuba_horses:
            return None

        all_horse_scores = []
        for h in shutuba_horses:
            if h.horse_id and h.horse_number:
                all_horse_scores.append({
                    'horse_id': h.horse_id,
                    'horse_name': h.name,
                    'horse_number': h.horse_number,
                    'waku_number': h.waku_number,
                })

        if not all_horse_scores:
            return None

        unpredictable_reason = prediction_exclusion_reason(
            target_race.race_name,
            target_race.course_type,
        ) or None

        horse_ids = [h['horse_id'] for h in all_horse_scores]

        all_past_data = {}
        if not unpredictable_reason and horse_ids:
            all_past_data = _get_bulk_performance_data(db, horse_ids, target_race.race_date)

        for horse_data in all_horse_scores:
            horse_past_results = all_past_data.get(horse_data['horse_id'], [])
            perf_score = _calculate_scores_from_data(horse_past_results, target_race.race_date)
            start_1c_z_score = _calculate_1c_indicator(
                db, horse_data['horse_id'], target_race.race_date, debug=False
            )
            horse_data['raw_score'] = perf_score if perf_score is not None else np.nan
            horse_data['start_1c_z_score'] = start_1c_z_score

        df = pd.DataFrame(all_horse_scores)
        del all_horse_scores
        del all_past_data

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
                df['deviation_score'] = df['raw_score'].apply(
                    lambda x: 50.0 + 10 * (x - mean) / std if pd.notna(x) else None
                )
            df['deviation_score'] = df['deviation_score'].round(2)
            df = df.sort_values(
                'deviation_score', ascending=False, na_position='last'
            ).reset_index(drop=True)
            marks = ["◎", "〇", "▲", "△", "☆"]
            df['mark'] = df.index.map(
                lambda i: marks[i] if pd.notna(df.loc[i, 'deviation_score']) and i < len(marks) else ""
            )
            df['unpredictable_reason'] = None

        df = df.drop(columns=['start_1c_z_score', 'raw_score'], errors='ignore')
        final_columns = [c.name for c in models.Prediction.__table__.columns if c.name in df.columns]
        df_final = df[final_columns].replace({np.nan: None})
        result = df_final.to_dict('records')

        del df
        del df_final
        import gc
        gc.collect()

        return result

    except Exception as e:
        print(f"--- [CRITICAL PREDICTION ERROR] Race ID: {race_id} ---")
        traceback.print_exc()
        if not shutuba_horses:
            return None

        return [
            {
                'horse_id': h.horse_id,
                'horse_name': h.name,
                'horse_number': h.horse_number,
                'waku_number': h.waku_number,
                'deviation_score': None,
                'mark': '—',
                'start_1c_indicator': None,
                'unpredictable_reason': "予測計算中にエラーが発生"
            }
            for h in shutuba_horses
            if h.horse_id and h.horse_number
        ]


def calculate_matchups(
    db: Session, horse_ids: List[str], start_date: date, end_date: date
) -> Dict[str, Any]:
    if len(horse_ids) < 2:
        return {}
    # ★最適化: フルORMオブジェクトを取らず、必要なカラムだけ取得（通信量の大幅削減）
    past_results = db.query(
        models.Result.race_id.label('race_id'),
        models.Result.horse_id.label('horse_id'),
        models.Result.rank.label('rank'),
        models.Race.venue_name.label('venue_name'),
        models.Race.race_date.label('race_date')
    )\
    .join(models.Race, models.Result.race_id == models.Race.id)\
    .filter(models.Result.horse_id.in_(horse_ids))\
    .filter(models.Race.race_date.between(start_date, end_date))\
    .all()
    
    races_grouped = defaultdict(list)
    for row in past_results:
        races_grouped[row.race_id].append({
            'horse_id': row.horse_id, 'rank': row.rank,
            'venue_name': row.venue_name, 'race_date': row.race_date.strftime('%Y-%m-%d')
        })
    matchup_matrix = defaultdict(lambda: {'win': 0, 'loss': 0, 'draw': 0, 'history': []})
    for past_race_id, participants in races_grouped.items():
        if len(participants) < 2:
            continue
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


def calculate_and_save_matchups_for_race(
    db: Session, race_id: str, horse_ids: List[str]
):
    """
    対戦成績を計算してDBに保存する。
    start_date を直近5年に短縮（旧: date(2000,1,1)）。
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=365 * 5)
    matchup_data = calculate_matchups(db, horse_ids, start_date, end_date)
    if matchup_data:
        existing = db.query(models.Matchup).filter(models.Matchup.race_id == race_id).first()
        if existing:
            existing.matchup_data = matchup_data
        else:
            db.add(models.Matchup(race_id=race_id, matchup_data=matchup_data))
        db.commit()


def calculate_and_save_all_horse_number_advantages(db: Session):
    """HISTORY モード時のみ呼ばれる重い処理。全データから馬番有利不利を再計算。"""
    import gc
    print("Calculating horse number advantages for all data in the database...")

    try:
        num_deleted = db.query(models.HorseNumberAdvantage).delete(synchronize_session=False)
        db.commit()
        print(f" -> Deleted {num_deleted} existing advantage records.")
    except Exception as e:
        db.rollback()
        raise e

    results_query = db.query(
        models.Race.id,
        models.Race.venue_name,
        models.Race.course_type,
        models.Race.distance,
        models.Race.total_horses,
        models.Result.horse_number,
        models.Result.rank
    ).join(models.Result, models.Race.id == models.Result.race_id)\
    .filter(models.Result.rank.isnot(None))\
    .filter(models.Race.total_horses.isnot(None))\
    .filter(models.Race.course_type.in_(['芝', 'ダ']))

    try:
        chunk_size = 2000
        total_rows = results_query.count()
        if total_rows == 0:
            print("No data to process.")
            return

        advantage_dict = defaultdict(lambda: {'sum': 0.0, 'count': 0})

        chunks = pd.read_sql(results_query.statement, db.bind, chunksize=chunk_size)
        with tqdm(total=total_rows, desc=" -> Processing race data in chunks") as pbar:
            for chunk_df in chunks:
                ai_scores = []
                for _, group in chunk_df.groupby('id'):
                    n = group['total_horses'].iloc[0]
                    if pd.isna(n) or int(n) < 2:
                        continue
                    n = int(n)
                    e = (n + 1) / 2.0
                    sd = math.sqrt((n**2 - 1) / 12.0)
                    if sd == 0:
                        continue
                    group = group.copy()
                    group['advantage_score'] = (e - group['rank']) / sd
                    ai_scores.append(group)

                if ai_scores:
                    chunk_scores_df = pd.concat(ai_scores, ignore_index=True)
                    for (venue, course, dist, horse_num), gd in chunk_scores_df.groupby(
                        ['venue_name', 'course_type', 'distance', 'horse_number']
                    ):
                        key = (venue, course, dist, horse_num)
                        advantage_dict[key]['sum'] += gd['advantage_score'].sum()
                        advantage_dict[key]['count'] += len(gd)
                    del chunk_scores_df
                    del ai_scores

                rows_in_chunk = len(chunk_df)
                del chunk_df
                gc.collect()
                pbar.update(rows_in_chunk)

        if not advantage_dict:
            print("No advantage data calculated.")
            return

        advantage_summary = pd.DataFrame([
            {'venue_name': k[0], 'course_type': k[1], 'distance': k[2],
             'horse_number': k[3], 'sum': v['sum'], 'count': v['count']}
            for k, v in advantage_dict.items()
        ])
        del advantage_dict
        gc.collect()

        advantage_summary['advantage_score'] = advantage_summary['sum'] / advantage_summary['count']
        advantage_summary['advantage_score'] = advantage_summary.groupby(
            ['venue_name', 'course_type', 'distance']
        )['advantage_score'].transform(lambda x: x - x.mean())

        advantages_to_save = advantage_summary[[
            'venue_name', 'course_type', 'distance', 'horse_number', 'advantage_score'
        ]].to_dict('records')
        del advantage_summary
        gc.collect()

        if advantages_to_save:
            database_loader.save_horse_number_advantages(db, advantages_to_save)
            print(f" -> Saved {len(advantages_to_save)} new horse number advantage records.")

        db.commit()

    except Exception as e:
        print(f"An error occurred during advantage calculation: {e}")
        traceback.print_exc()
        db.rollback()
    finally:
        gc.collect()
