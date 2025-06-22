# C:\Users\tnszk\program\GitHub\backend\crud\race_crud.py

from sqlalchemy.orm import Session, joinedload
from database import models
from schemas import race_schema # schemaもインポート
from datetime import date
from typing import Dict, Any, List

def get_predictions_by_date(db: Session, target_date: date) -> Dict[str, Any]:
    """
    指定された日付のレースと予測をDBから取得し、スキーマに合わせた構造で返す。
    """
    # options(joinedload(...)) を使うことで、関連する予測データも一度のクエリで効率的に取得する
    races_with_preds = db.query(models.Race)\
        .options(joinedload(models.Race.predictions))\
        .filter(models.Race.race_date == target_date)\
        .order_by(models.Race.venue_name, models.Race.race_number)\
        .all()

    if not races_with_preds:
        return {"jra": [], "nar": []}
        
    jra_venues: Dict[str, List[models.Race]] = {}
    nar_venues: Dict[str, List[models.Race]] = {}

    for race in races_with_preds:
        # 取得した予測データを偏差値の降順でソートする
        if race.predictions:
            race.predictions.sort(key=lambda p: p.deviation_score, reverse=True)
        
        # race_type に基づいて中央と地方に振り分ける
        if race.race_type == '中央':
            if race.venue_name not in jra_venues:
                jra_venues[race.venue_name] = []
            jra_venues[race.venue_name].append(race)
        elif race.race_type == '地方':
            if race.venue_name not in nar_venues:
                nar_venues[race.venue_name] = []
            nar_venues[race.venue_name].append(race)

    # PydanticスキーマがDBオブジェクトから自動的に辞書へ変換してくれる
    jra_result = [{"venue_name": v_name, "races": race_list} for v_name, race_list in jra_venues.items()]
    nar_result = [{"venue_name": v_name, "races": race_list} for v_name, race_list in nar_venues.items()]

    return {"jra": jra_result, "nar": nar_result}