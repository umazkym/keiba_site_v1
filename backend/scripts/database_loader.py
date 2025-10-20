# backend/scripts/database_loader.py

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from database import models
from core.config import JRA_VENUES, NAR_VENUES, VENUE_CODE_MAP
from typing import Dict, Any, List
import datetime
import pandas as pd
import re

def _normalize_race_name_for_db(race_name: str) -> str:
    """
    レース名をDB保存前に正規化する。

    処理内容：
    1. 改行・タブ・複数の空白を正規化
    2. グレード情報（（G1）など）を末尾から除去
    3. 先頭と末尾の空白を除去

    Parameters
    ----------
    race_name : str
        DBに保存するレース名

    Returns
    -------
    str
        正規化されたレース名。Noneが渡された場合は空文字列を返す
    """
    if not race_name or not isinstance(race_name, str):
        return ""

    # ステップ1: 改行・タブを空白に置換し、複数の連続空白を1つに統一
    normalized = re.sub(r'[\n\r\t]+', ' ', race_name)
    normalized = re.sub(r'\s+', ' ', normalized)

    # ステップ2: グレード情報（末尾の括弧）を除去
    # パターン: （G1）、（G2）、（G3）、（OP）など、または (G1), (G2) など
    normalized = re.sub(r'\s*[（(](?:G[1-3]|OP|重賞)[）)]$', '', normalized)

    # ステップ3: 先頭と末尾の空白を除去
    normalized = normalized.strip()

    return normalized

def _bulk_upsert(db: Session, model, data: List[Dict[str, Any]], index_elements: List[str]):
    if not data:
        return
    
    table = model.__table__
    stmt = pg_insert(table).values(data)
    stmt = stmt.on_conflict_do_nothing(index_elements=index_elements)
    db.execute(stmt)

def _bulk_upsert_races(db: Session, data: List[Dict[str, Any]]):
    """
    racesテーブル専用のUPSERT関数。
    重複キー(id)があった場合は、レコードを新しい情報で更新する。
    """
    if not data:
        return

    table = models.Race.__table__
    stmt = pg_insert(table).values(data)

    update_columns = {
        c.name: getattr(stmt.excluded, c.name)
        for c in table.c
        if c.name != 'id' and c.name in data[0]
    }

    stmt = stmt.on_conflict_do_update(
        index_elements=['id'],
        set_=update_columns
    )
    
    db.execute(stmt)

def _bulk_upsert_people(db: Session, model, data: List[Dict[str, Any]]):
    """
    JockeyとTrainerのUPSERT用関数。デッドロックを回避するよう修正。
    まずON CONFLICT DO NOTHINGで一括挿入を試み、その後必要に応じて個別に更新する。
    """
    if not data:
        return

    unique_data_map = {}
    for item in data:
        item_id = item.get('id')
        if not item_id:
            continue
        
        if item_id not in unique_data_map or \
           (item.get('name') and len(item.get('name')) > len(unique_data_map[item_id].get('name', ''))):
            unique_data_map[item_id] = item

    if not unique_data_map:
        return
        
    final_data_to_insert = list(unique_data_map.values())
    
    table = model.__table__
    stmt = pg_insert(table).values(final_data_to_insert)
    stmt = stmt.on_conflict_do_nothing(index_elements=['id'])
    db.execute(stmt)
    
    ids_to_check = [item['id'] for item in final_data_to_insert]
    existing_records = db.query(model).filter(model.id.in_(ids_to_check)).all()
    
    existing_map = {record.id: record for record in existing_records}
    
    for item in final_data_to_insert:
        item_id = item['id']
        if item_id in existing_map:
            existing_record = existing_map[item_id]
            new_name = item.get('name')
            if new_name and (not existing_record.name or len(existing_record.name) < len(new_name)):
                existing_record.name = new_name

def _bulk_upsert_horses(db: Session, data: List[Dict[str, Any]]):
    if not data:
        return

    table = models.Horse.__table__
    stmt = pg_insert(table).values(data)
    
    update_data = {
        'name': stmt.excluded.name,
        'sex': stmt.excluded.sex,
        'age': stmt.excluded.age
    }
    
    stmt = stmt.on_conflict_do_update(
        index_elements=['id'],
        set_=update_data
    )
    
    try:
        db.execute(stmt)
    except Exception as e:
        print(f"[ERROR] Failed to upsert horse data: {e}")
        db.rollback()

def _bulk_upsert_results(db: Session, data: List[Dict[str, Any]]):
    if not data:
        return

    table = models.Result.__table__
    stmt = pg_insert(table).values(data)
    
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
    horses_to_save, jockeys_to_save, trainers_to_save = [], [], []

    for h in shutuba_data.get('horses', []):
        if h.get('horse_id') and h.get('horse_name'):
            sex = h.get('sex')
            age = h.get('age')
            
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

    _bulk_upsert_horses(db, horses_to_save)
    
    _bulk_upsert_people(db, models.Jockey, jockeys_to_save)
    _bulk_upsert_people(db, models.Trainer, trainers_to_save)
    
    race_info = shutuba_data.get('race_info', {})
    
    date_from_parser = race_info.get('race_date')
    final_race_date = date_from_parser if date_from_parser else race_date

    venue_code = race_id[4:6]
    venue_name = VENUE_CODE_MAP.get(venue_code, '不明')
    race_to_save = {
        'id': race_id,
        'race_date': final_race_date,
        'race_type': '地方' if is_nar else '中央',
        'venue_name': venue_name,
        'race_number': race_info.get('race_number'),
        'race_name': _normalize_race_name_for_db(race_info.get('race_name', '')),
        'course_type': race_info.get('course_type'),
        'distance': race_info.get('distance'),
        'weather': race_info.get('weather'),
        'ground_condition': race_info.get('ground_condition'),
        'total_horses': race_info.get('total_horses')
    }
    _bulk_upsert_races(db, [race_to_save])

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


def load_past_results(db: Session, horse_name: str, results: List[Dict[str, Any]], horse_id: str):
    if not horse_name or not results:
        return

    horse_to_save = [{'id': horse_id, 'name': horse_name}]
    _bulk_upsert_horses(db, horse_to_save)

    races_to_save = []
    results_to_save = []
    jockeys_to_save = []
    trainers_to_save = []

    for r in results:
        if r.get('jockey_id'):
            jockeys_to_save.append({'id': r['jockey_id'], 'name': r.get('jockey_name')})
        if r.get('trainer_id'):
            trainers_to_save.append({'id': r['trainer_id'], 'name': r.get('trainer_name')})

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
            'race_type': race_type, 'race_number': r.get('race_number'), 'race_name': _normalize_race_name_for_db(r.get('race_name', '')),
            'course_type': r.get('course_type'), 'distance': r.get('distance'),
            'weather': r.get('weather'), 'ground_condition': r.get('ground_condition'),
            'total_horses': r.get('total_horses')
        }
        if race_dict.get('id') and race_dict.get('race_type'):
            races_to_save.append(race_dict)

        result_dict = {k: v for k, v in r.items() if k in models.Result.__table__.columns.keys()}
        result_dict['horse_id'] = horse_id
        if 'race_id' in r: result_dict['race_id'] = r['race_id']
        
        if result_dict.get('race_id') and result_dict.get('horse_id'):
            results_to_save.append(result_dict)

    if jockeys_to_save:
        _bulk_upsert_people(db, models.Jockey, jockeys_to_save)
    if trainers_to_save:
        _bulk_upsert_people(db, models.Trainer, trainers_to_save)
    
    _bulk_upsert(db, models.Race, races_to_save, ['id'])
    
    _bulk_upsert_results(db, results_to_save)
    
    db.commit()

def save_prediction(db: Session, race_id: str, predictions: List[Dict[str, Any]]):
    db.query(models.Prediction).filter(models.Prediction.race_id == race_id).delete()
    db.commit() 
    
    preds_to_load = [{'race_id': race_id, **p} for p in predictions]
    if preds_to_load:
        db.bulk_insert_mappings(models.Prediction, preds_to_load)
    db.commit()

def save_horse_number_advantages(db: Session, advantages: List[Dict[str, Any]]):
    if not advantages: return

    for adv in advantages:
        stmt = pg_insert(models.HorseNumberAdvantage).values(adv)
        stmt = stmt.on_conflict_do_update(
            index_elements=['venue_name', 'course_type', 'distance', 'horse_number'],
            set_={'advantage_score': stmt.excluded.advantage_score}
        )
        db.execute(stmt)
    db.commit()

# ==============================================================================
# ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
# 変更点：
# 1. 存在しないレースを新規作成するロジックを削除。
#    この関数は「更新」に専念させ、責務を明確にする。
# 2. `results`テーブルにデータを保存する前に、関連する馬が`horses`テーブルに存在するか確認し、
#    存在しない場合は最低限の情報（IDと名前）で登録するロジックを追加し、堅牢性を高める。
def load_race_result_data(db: Session, race_data: Dict[str, Any], race_id: str, race_date: datetime.date, is_nar: bool):
    if not race_id:
        return

    jockeys_to_save, trainers_to_save = [], []
    for h in race_data.get('results', []):
        if h.get('jockey_id'): 
            jockeys_to_save.append({'id': h['jockey_id'], 'name': h.get('jockey_name')})
        if h.get('trainer_id'):
            trainers_to_save.append({'id': h['trainer_id'], 'name': h.get('trainer_name')})
    
    _bulk_upsert_people(db, models.Jockey, jockeys_to_save)
    _bulk_upsert_people(db, models.Trainer, trainers_to_save)

    race_info = race_data.get('race_info', {})
    race_record = db.query(models.Race).filter(models.Race.id == race_id).first()
    
    # レコードが存在する場合のみ更新処理を行う
    if race_record:
        for key, value in race_info.items():
            if value is not None and hasattr(race_record, key):
                # race_nameの場合は正規化してから設定
                if key == 'race_name' and isinstance(value, str):
                    value = _normalize_race_name_for_db(value)
                setattr(race_record, key, value)
    else:
        # レースが存在しない場合は警告を出して終了（データの不整合を防ぐ）
        print(f"  -> [Warning] Race record for {race_id} not found in DB. Skipping results update.")
        return

    if race_data.get('returns'):
        db.query(models.RaceReturn).filter(models.RaceReturn.race_id == race_id).delete()
        
        returns_to_load = []
        for bet_type, returns_list in race_data['returns'].items():
            for item in returns_list:
                if item.get('payout') is not None and item.get('number_1') is not None:
                    returns_to_load.append({
                        'race_id': race_id,
                        'bet_type': bet_type,
                        'number_1': item.get('number_1'),
                        'number_2': item.get('number_2'),
                        'number_3': item.get('number_3'),
                        'payout': item['payout'],
                        'popularity': item.get('popularity')
                    })
        
        if returns_to_load:
            _bulk_upsert(db, models.RaceReturn, returns_to_load, ['race_id', 'bet_type', 'number_1', 'number_2', 'number_3'])

    results_from_parser = race_data.get('results', [])
    if not results_from_parser:
        db.commit() 
        return
        
    # 結果を保存する前に、関連する馬がすべてhorsesテーブルに存在することを保証する
    horse_ids_in_results = {r['horse_id'] for r in results_from_parser if r.get('horse_id')}
    existing_horses = {h.id for h in db.query(models.Horse.id).filter(models.Horse.id.in_(horse_ids_in_results))}
    missing_horses = [
        {'id': r['horse_id'], 'name': r.get('horse_name', '不明')}
        for r in results_from_parser if r.get('horse_id') and r['horse_id'] not in existing_horses
    ]
    if missing_horses:
        _bulk_upsert_horses(db, missing_horses)

    for res_data in results_from_parser:
        horse_id = res_data.get('horse_id')
        if not horse_id:
            continue

        result_record = db.query(models.Result).filter(
            models.Result.race_id == race_id,
            models.Result.horse_id == horse_id
        ).first()

        update_data = {
            k: (None if pd.isna(v) else v) for k, v in res_data.items() 
            if hasattr(models.Result, k)
        }

        if result_record:
            for key, value in update_data.items():
                if key in update_data:
                    setattr(result_record, key, value)
        else:
            new_result = models.Result(race_id=race_id, **update_data)
            db.add(new_result)
    
    db.commit()
# ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
# ==============================================================================