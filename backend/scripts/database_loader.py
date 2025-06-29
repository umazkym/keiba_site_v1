# C:\Users\tnszk\program\GitHub\backend\scripts\database_loader.py
from sqlalchemy.orm import Session
from database import models
from core.config import JRA_VENUES, NAR_VENUES, VENUE_CODE_MAP
from typing import Dict, Any, List

def upsert_race(db: Session, race_data: Dict[str, Any]):
    race = db.query(models.Race).filter(models.Race.id == race_data['id']).first()
    if race:
        for key, value in race_data.items():
            setattr(race, key, value)
    else:
        race = models.Race(**race_data)
        db.add(race)

def upsert_horse(db: Session, horse_data: Dict[str, Any]):
    horse = db.query(models.Horse).filter(models.Horse.id == horse_data['id']).first()
    if not horse:
        horse = models.Horse(**horse_data)
        db.add(horse)

def upsert_jockey(db: Session, jockey_data: Dict[str, Any]):
    jockey = db.query(models.Jockey).filter(models.Jockey.id == jockey_data['id']).first()
    if not jockey:
        jockey = models.Jockey(**jockey_data)
        db.add(jockey)

def upsert_trainer(db: Session, trainer_data: Dict[str, Any]):
    trainer = db.query(models.Trainer).filter(models.Trainer.id == trainer_data['id']).first()
    if not trainer:
        trainer = models.Trainer(**trainer_data)
        db.add(trainer)

def upsert_result(db: Session, result_data: Dict[str, Any]):
    result = db.query(models.Result).filter_by(race_id=result_data['race_id'], horse_id=result_data['horse_id']).first()
    if result:
        for key, value in result_data.items():
            setattr(result, key, value)
    else:
        result = models.Result(**result_data)
        db.add(result)

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
    upsert_race(db, race_to_save)

    for h in shutuba_data.get('horses', []):
        if h.get('jockey_id'): upsert_jockey(db, {'id': h['jockey_id'], 'name': h['jockey_name']})
        if h.get('trainer_id'): upsert_trainer(db, {'id': h['trainer_id'], 'name': h['trainer_name']})
        if h.get('horse_id'):
            upsert_horse(db, {'id': h['horse_id'], 'name': h['horse_name'], 'sex': h['sex'], 'age': h['age']})
            result_payload = {
                'race_id': race_id, 'horse_id': h['horse_id'], 'jockey_id': h.get('jockey_id'),
                'trainer_id': h.get('trainer_id'), 'waku_number': h.get('waku_number'),
                'horse_number': h.get('horse_number'), 'weight_carried': h.get('weight_carried'),
                'horse_weight': h.get('horse_weight'), 'horse_weight_diff': h.get('horse_weight_diff'),
            }
            upsert_result(db, result_payload)
    
    db.commit()

def load_past_results(db: Session, results: List[Dict[str, Any]], horse_id: str):
    if not results: return
    
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
        if race_dict.get('id'):
             upsert_race(db, race_dict)

        result_dict = {k: v for k, v in r.items() if k in models.Result.__table__.columns.keys()}
        result_dict['horse_id'] = horse_id
        if 'race_id' in r:
            result_dict['race_id'] = r['race_id']
        
        if result_dict.get('race_id') and result_dict.get('horse_id'):
            upsert_result(db, result_dict)

    db.commit()

def save_prediction(db: Session, race_id: str, predictions: List[Dict[str, Any]]):
    db.query(models.Prediction).filter(models.Prediction.race_id == race_id).delete()
    db.commit() # 古いデータを確実に削除
    
    preds_to_load = []
    for p in predictions:
        p['race_id'] = race_id
        preds_to_load.append(p)
    if preds_to_load:
        db.bulk_insert_mappings(models.Prediction, preds_to_load)
    db.commit()

def save_horse_number_advantages(db: Session, advantages: List[Dict[str, Any]]):
    if not advantages:
        return
    for adv in advantages:
        existing = db.query(models.HorseNumberAdvantage).filter_by(
            venue_name=adv['venue_name'],
            course_type=adv['course_type'],
            distance=adv['distance'],
            horse_number=adv['horse_number']
        ).first()
        if existing:
            existing.advantage_score = adv['advantage_score']
        else:
            db.add(models.HorseNumberAdvantage(**adv))
    db.commit()


def load_race_result_data(db: Session, race_data: Dict[str, Any], race_id: str, race_date: str, is_nar: bool):
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
    upsert_race(db, race_to_save)

    for h in race_data.get('results', []):
        if h.get('horse_id'):
            upsert_horse(db, {'id': h['horse_id'], 'name': h['horse_name']})
            result_entry = {
                'race_id': race_id,
                'horse_id': h.get('horse_id'),
                'jockey_id': h.get('jockey_id'),
                'rank': h.get('rank'),
                'waku_number': h.get('waku_number'),
                'horse_number': h.get('horse_number'),
                'finish_time_sec': h.get('finish_time_sec'),
                'weight_carried': h.get('weight_carried'),
                'popularity': h.get('popularity'),
                'odds': h.get('odds')
            }
            upsert_result(db, result_entry)
    
    db.commit()