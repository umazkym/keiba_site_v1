# C:\Users\tnszk\program\GitHub\backend\scripts\database_loader.py
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from database import models
from core.config import JRA_VENUES, NAR_VENUES, VENUE_CODE_MAP
from typing import Dict, Any, List
import datetime

def _bulk_upsert(db: Session, model, data: List[Dict[str, Any]], index_elements: List[str]):
    """
    汎用的なバルクUPSERT関数。
    コンフリクトが発生した場合は何もしない（主にJockey, Trainerで使用）。
    """
    if not data:
        return
    
    table = model.__table__
    stmt = pg_insert(table).values(data)
    stmt = stmt.on_conflict_do_nothing(index_elements=index_elements)
    db.execute(stmt)

def _bulk_upsert_horses(db: Session, data: List[Dict[str, Any]]):
    """
    馬（horses）テーブル専用のバルクUPSERT関数。
    コンフリクトが発生した場合、sexとageを新しい情報で更新する。
    """
    if not data:
        return

    print(f"  -> Upserting {len(data)} horse records (sex and age will be updated)...")
    
    table = models.Horse.__table__
    stmt = pg_insert(table).values(data)
    
    # 更新するカラムを辞書で定義
    update_data = {
        'name': stmt.excluded.name,
        'sex': stmt.excluded.sex,
        'age': stmt.excluded.age
    }
    
    # 既存のレコードと衝突した場合（idが一致した場合）の更新処理を定義
    stmt = stmt.on_conflict_do_update(
        index_elements=['id'],
        set_=update_data
    )
    
    try:
        db.execute(stmt)
        print("     ... Success.")
    except Exception as e:
        print(f"[ERROR] Failed to upsert horse data: {e}")
        db.rollback() # エラーが発生した場合はロールバック

def _bulk_upsert_results(db: Session, data: List[Dict[str, Any]]):
    """
    競走成績（results）テーブル専用のバルクUPSERT関数。
    コンフリクトが発生した場合、既存のレコードを更新する。
    """
    if not data:
        return

    table = models.Result.__table__
    stmt = pg_insert(table).values(data)
    
    # id, race_id, horse_id 以外のカラムを更新対象とする
    update_columns = {
        c.name: getattr(stmt.excluded, c.name)
        for c in table.c
        if c.name not in ['id', 'race_id', 'horse_id']
    }
    
    stmt = stmt.on_conflict_do_update(
        index_elements=['race_id', 'horse_id'],
        set_=update_columns
    )
    db.execute(stmt)

def load_shutuba_data(db: Session, shutuba_data: Dict[str, Any], race_id: str, race_date: datetime.date, is_nar: bool):
    """出馬表のデータを解析し、関連テーブルに保存する"""
    horses_to_save, jockeys_to_save, trainers_to_save = [], [], []

    print(f"  -> Loading shutuba data for race {race_id}...")
    for h in shutuba_data.get('horses', []):
        if h.get('horse_id'):
            # パーサーがsex, ageを正しく取得できているか確認するためのログ
            sex = h.get('sex')
            age = h.get('age')
            if sex is None or age is None:
                print(f"    [DEBUG CONSOLE] Horse '{h.get('horse_name', 'N/A')}' (ID: {h['horse_id']}) is missing sex or age. sex={sex}, age={age}")
            
            horses_to_save.append({
                'id': h['horse_id'], 
                'name': h['horse_name'], 
                'sex': sex, 
                'age': age
            })
        if h.get('jockey_id'):
            jockeys_to_save.append({'id': h['jockey_id'], 'name': h['jockey_name']})
        if h.get('trainer_id'):
            trainers_to_save.append({'id': h['trainer_id'], 'name': h['trainer_name']})

    # 馬情報は更新ロジックを持つ専用関数を呼び出す
    _bulk_upsert_horses(db, horses_to_save)
    
    # 騎手と調教師は既存のままでOK
    _bulk_upsert(db, models.Jockey, jockeys_to_save, ['id'])
    _bulk_upsert(db, models.Trainer, trainers_to_save, ['id'])
    
    race_info = shutuba_data.get('race_info', {})
    venue_code = race_id[4:6]
    venue_name = VENUE_CODE_MAP.get(venue_code, '不明')
    race_to_save = {
        'id': race_id, 'race_date': race_date, 'race_type': '地方' if is_nar else '中央',
        'venue_name': venue_name, 'race_number': race_info.get('race_number'),
        'race_name': race_info.get('race_name'), 'course_type': race_info.get('course_type'),
        'distance': race_info.get('distance'), 'weather': race_info.get('weather'),
        'ground_condition': race_info.get('ground_condition'), 'total_horses': race_info.get('total_horses')
    }
    _bulk_upsert(db, models.Race, [race_to_save], ['id'])

    results_to_save = []
    for h in shutuba_data.get('horses', []):
        if h.get('horse_id'):
            results_to_save.append({
                'race_id': race_id, 'horse_id': h['horse_id'], 'jockey_id': h.get('jockey_id'),
                'trainer_id': h.get('trainer_id'), 'waku_number': h.get('waku_number'),
                'horse_number': h.get('horse_number'), 'weight_carried': h.get('weight_carried'),
                'horse_weight': h.get('horse_weight'), 'horse_weight_diff': h.get('horse_weight_diff'),
            })
    _bulk_upsert_results(db, results_to_save)
    
    db.commit()


def load_past_results(db: Session, results: List[Dict[str, Any]], horse_id: str):
    """馬の過去成績データをDBにロードする"""
    if not results: return
    
    races_to_save = []
    results_to_save = []

    for r in results:
        venue = r.get('venue_name')
        
        race_type = None
        if venue:
            if any(jra_venue in venue for jra_venue in JRA_VENUES):
                race_type = '中央'
            elif any(nar_venue in venue for nar_venue in NAR_VENUES):
                race_type = '地方'
        
        if race_type is None:
            continue

        race_dict = {
            'id': r.get('race_id'), 'race_date': r.get('race_date'), 'venue_name': venue,
            'race_type': race_type, 'race_number': r.get('race_number'), 'race_name': r.get('race_name'),
            'course_type': r.get('course_type'), 'distance': r.get('distance'),
            'weather': r.get('weather'), 'ground_condition': r.get('ground_condition'),
            'total_horses': r.get('total_horses')
        }
        if race_dict.get('id'):
            if race_dict['race_type'] is not None:
                races_to_save.append(race_dict)

        result_dict = {k: v for k, v in r.items() if k in models.Result.__table__.columns.keys()}
        result_dict['horse_id'] = horse_id
        if 'race_id' in r: result_dict['race_id'] = r['race_id']
        
        if result_dict.get('race_id') and result_dict.get('horse_id'):
            results_to_save.append(result_dict)

    # 先にレース情報を保存し、次に成績を保存する
    _bulk_upsert(db, models.Race, races_to_save, ['id'])
    db.commit() # レース情報を確定
    
    _bulk_upsert_results(db, results_to_save)
    db.commit()


def save_prediction(db: Session, race_id: str, predictions: List[Dict[str, Any]]):
    """予測結果をDBに保存する"""
    db.query(models.Prediction).filter(models.Prediction.race_id == race_id).delete()
    db.commit() 
    
    preds_to_load = [{'race_id': race_id, **p} for p in predictions]
    if preds_to_load:
        db.bulk_insert_mappings(models.Prediction, preds_to_load)
    db.commit()


def save_horse_number_advantages(db: Session, advantages: List[Dict[str, Any]]):
    """馬番有利不利データをDBに保存する"""
    if not advantages: return

    for adv in advantages:
        stmt = pg_insert(models.HorseNumberAdvantage).values(adv)
        stmt = stmt.on_conflict_do_update(
            index_elements=['venue_name', 'course_type', 'distance', 'horse_number'],
            set_={'advantage_score': stmt.excluded.advantage_score}
        )
        db.execute(stmt)
    db.commit()


def load_race_result_data(db: Session, race_data: Dict[str, Any], race_id: str, race_date: datetime.date, is_nar: bool):
    """レース結果データを解析し、関連テーブルに保存する"""
    horses_to_save, jockeys_to_save, trainers_to_save = [], [], []
    for h in race_data.get('results', []):
        if h.get('horse_id'):
            # ここではsex, ageの情報は取得できないのでnameのみ
            horses_to_save.append({'id': h['horse_id'], 'name': h['horse_name']})
        if h.get('jockey_id'): 
            jockeys_to_save.append({'id': h['jockey_id'], 'name': h.get('jockey_name')})
        if h.get('trainer_id'):
            trainers_to_save.append({'id': h['trainer_id'], 'name': h.get('trainer_name')})
    
    _bulk_upsert(db, models.Horse, horses_to_save, ['id'])
    _bulk_upsert(db, models.Jockey, jockeys_to_save, ['id'])
    _bulk_upsert(db, models.Trainer, trainers_to_save, ['id'])

    race_info = race_data.get('race_info', {})
    venue_code = race_id[4:6]
    venue_name = VENUE_CODE_MAP.get(venue_code, '不明')
    race_to_save = {
        'id': race_id, 'race_date': race_date, 'race_type': '地方' if is_nar else '中央',
        'venue_name': venue_name, 'race_number': race_info.get('race_number'),
        'race_name': race_info.get('race_name'), 'course_type': race_info.get('course_type'),
        'distance': race_info.get('distance'), 'weather': race_info.get('weather'),
        'ground_condition': race_info.get('ground_condition'), 'total_horses': race_info.get('total_horses')
    }
    _bulk_upsert(db, models.Race, [race_to_save], ['id'])
    db.commit() # レース情報を先に確定

    results_to_save = []
    for h in race_data.get('results', []):
        if h.get('horse_id'):
            results_to_save.append({
                'race_id': race_id, 'horse_id': h.get('horse_id'), 'jockey_id': h.get('jockey_id'),
                'trainer_id': h.get('trainer_id'), 'rank': h.get('rank'), 'waku_number': h.get('waku_number'),
                'horse_number': h.get('horse_number'), 'finish_time_sec': h.get('finish_time_sec'),
                'weight_carried': h.get('weight_carried'), 'popularity': h.get('popularity'),
                'odds': h.get('odds'), 'corner_positions': h.get('corner_positions')
            })
    _bulk_upsert_results(db, results_to_save)
    db.commit()
