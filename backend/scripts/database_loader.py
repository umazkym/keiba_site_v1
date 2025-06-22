# C:\Users\tnszk\program\GitHub\backend\scripts\database_loader.py

from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from database import models
from core.config import JRA_VENUES, NAR_VENUES, VENUE_CODE_MAP
from typing import Dict, Any, List

def upsert_data(db: Session, model_class, data_list: List[Dict], unique_keys: List[str]):
    if not data_list: return
    data_list_cleaned = [d for d in data_list if d and all(k in d and d[k] is not None for k in unique_keys)]
    if not data_list_cleaned: return

    stmt = sqlite_insert(model_class).values(data_list_cleaned)
    update_cols = {c.name: getattr(stmt.excluded, c.name) for c in model_class.__table__.columns if not c.primary_key}
    
    on_conflict_stmt = stmt.on_conflict_do_update(
        index_elements=unique_keys,
        set_=update_cols
    )
    db.execute(on_conflict_stmt)

def load_shutuba_data(db: Session, shutuba_data: Dict[str, Any], race_id: str, race_date: str, is_nar: bool):
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
    upsert_data(db, models.Race, [race_to_save], ['id'])

    jockeys, trainers, horses, results = [], [], [], []
    for h in shutuba_data.get('horses', []):
        if h.get('jockey_id'): jockeys.append({'id': h['jockey_id'], 'name': h['jockey_name']})
        if h.get('trainer_id'): trainers.append({'id': h['trainer_id'], 'name': h['trainer_name']})
        if h.get('horse_id'):
            horses.append({'id': h['horse_id'], 'name': h['horse_name'], 'sex': h['sex'], 'age': h['age']})
            results.append({
                'race_id': race_id, 'horse_id': h['horse_id'], 'jockey_id': h.get('jockey_id'),
                'trainer_id': h.get('trainer_id'), 'waku_number': h.get('waku_number'),
                'horse_number': h.get('horse_number'), 'weight_carried': h.get('weight_carried'),
                'horse_weight': h.get('horse_weight'), 'horse_weight_diff': h.get('horse_weight_diff'),
            })

    upsert_data(db, models.Jockey, jockeys, ['id'])
    upsert_data(db, models.Trainer, trainers, ['id'])
    upsert_data(db, models.Horse, horses, ['id'])
    upsert_data(db, models.Result, results, ['race_id', 'horse_id'])
    
    db.commit()

def load_past_results(db: Session, results: List[Dict[str, Any]], horse_id: str):
    if not results: return
    
    races_data = []
    for r in results:
        venue = r.get('venue_name')
        race_type = None
        if venue:
            if any(jra_venue in venue for jra_venue in JRA_VENUES): race_type = '中央'
            elif any(nar_venue in venue for nar_venue in NAR_VENUES): race_type = '地方'
        
        race_dict = {
            'id': r.get('race_id'), 'race_date': r.get('race_date'), 'venue_name': venue,
            'race_type': race_type, 'race_number': r.get('race_number'), 'race_name': r.get('race_name'),
            'course_type': r.get('course_type'), 'distance': r.get('distance'),
            'weather': r.get('weather'), 'ground_condition': r.get('ground_condition'),
            'total_horses': r.get('total_horses')
        }
        if race_dict.get('id') and race_dict.get('race_type'):
            races_data.append(race_dict)

    results_data = []
    for r in results:
        result_dict = {k: v for k, v in r.items() if k in models.Result.__table__.columns.keys()}
        result_dict['horse_id'] = horse_id
        if 'race_id' in r:
            result_dict['race_id'] = r['race_id']
        
        if result_dict.get('race_id') and result_dict.get('horse_id'):
             results_data.append(result_dict)

    upsert_data(db, models.Race, races_data, ['id'])
    upsert_data(db, models.Result, results_data, ['race_id', 'horse_id'])

    db.commit()

def save_prediction(db: Session, race_id: str, predictions: List[Dict[str, Any]]):
    db.query(models.Prediction).filter(models.Prediction.race_id == race_id).delete()
    preds_to_load = []
    for p in predictions:
        p['race_id'] = race_id
        preds_to_load.append(p)
    if preds_to_load:
        db.bulk_insert_mappings(models.Prediction, preds_to_load)
    db.commit()