# C:\Users\tnszk\program\keiba-ai-site\backend\crud\race_crud.py
from sqlalchemy.orm import Session
from database import models
from schemas import race_schema
from datetime import date

def get_predictions_by_date(db: Session, target_date: date):
    # 指定された日付のレースIDを取得
    race_ids_on_date = db.query(models.Race.id).filter(models.Race.race_date == target_date).all()
    race_ids = [r[0] for r in race_ids_on_date]
    
    if not race_ids:
        return {"jra": [], "nar": []}

    # レース情報とそれに対応する予測結果をまとめて取得
    races = db.query(models.Race).filter(models.Race.id.in_(race_ids)).all()
    predictions = db.query(models.Prediction).filter(models.Prediction.race_id.in_(race_ids)).all()
    
    # データを構造化
    jra_venues = {}
    nar_venues = {}

    # 予測データをレースIDごとにマッピング
    preds_map = {}
    for p in predictions:
        if p.race_id not in preds_map:
            preds_map[p.race_id] = []
        preds_map[p.race_id].append(p)

    for race in races:
        # 予測を偏差値順にソート
        sorted_preds = sorted(preds_map.get(race.id, []), key=lambda x: x.deviation_score, reverse=True)
        
        race_pred_data = {
            "race_id": race.id,
            "race_date": race.race_date,
            "venue_name": race.venue_name,
            "race_number": race.race_number,
            "race_name": race.race_name,
            "course_type": race.course_type,
            "distance": race.distance,
            "predictions": sorted_preds
        }

        if race.race_type == '中央':
            if race.venue_name not in jra_venues:
                jra_venues[race.venue_name] = []
            jra_venues[race.venue_name].append(race_pred_data)
        elif race.race_type == '地方':
            if race.venue_name not in nar_venues:
                nar_venues[race.venue_name] = []
            nar_venues[race.venue_name].append(race_pred_data)
    
    # 最終的な出力形式に整形
    jra_result = [{"venue_name": v, "races": sorted(r, key=lambda x: x['race_number'])} for v, r in jra_venues.items()]
    nar_result = [{"venue_name": v, "races": sorted(r, key=lambda x: x['race_number'])} for v, r in nar_venues.items()]

    return {"jra": jra_result, "nar": nar_result}

# データ登録用のCRUD関数もここに追加していく (例: create_race, create_resultなど)
# (scripts/database_loader.pyから呼び出す)