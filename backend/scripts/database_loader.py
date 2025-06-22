# C:\Users\tnszk\program\keiba-ai-site\backend\scripts\database_loader.py
from sqlalchemy.orm import Session
from database import models
from typing import Dict, Any

def upsert_race_data(db: Session, parsed_data: Dict[str, Any]):
    """
    解析済みのレース結果データをデータベースに登録・更新（Upsert）する。
    """
    race_info = parsed_data['race_info']
    horse_results = parsed_data['horse_results']

    # Raceテーブルの確認・登録
    db_race = db.query(models.Race).filter(models.Race.id == race_info['id']).first()
    if not db_race:
        db_race = models.Race(**race_info)
        db.add(db_race)
    
    # Horse, Resultテーブルの登録
    for hr in horse_results:
        # Horse
        db_horse = db.query(models.Horse).filter(models.Horse.id == hr['horse_id']).first()
        if not db_horse:
            db_horse = models.Horse(id=hr['horse_id'], name=hr['horse_name'])
            db.add(db_horse)
        
        # Result (重複チェック)
        db_result = db.query(models.Result).filter(
            models.Result.race_id == race_info['id'],
            models.Result.horse_id == hr['horse_id']
        ).first()
        if not db_result:
            new_result = models.Result(
                race_id=race_info['id'],
                horse_id=hr['horse_id'],
                rank=hr['rank'],
                gate_number=hr['gate_number'],
                horse_number=hr['horse_number'],
                finish_time_sec=hr['finish_time_sec'],
                corner_positions=hr['corner_positions']
            )
            db.add(new_result)

    db.commit()

def save_prediction(db: Session, prediction_data: Dict[str, Any]):
    """ 予測結果をDBに保存 """
    # ... 既存の予測があれば削除し、新しい予測を登録するロジック
    db.query(models.Prediction).filter(models.Prediction.race_id == prediction_data['race_id']).delete()
    
    for horse_pred in prediction_data['predictions']:
        new_pred = models.Prediction(
            race_id=prediction_data['race_id'],
            **horse_pred
        )
        db.add(new_pred)
    
    db.commit()