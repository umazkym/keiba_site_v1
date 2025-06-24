# C:\Users\tnszk\program\GitHub\backend\api\v1\endpoints\races.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from crud import race_crud
from schemas import race_schema
from datetime import date
from typing import Optional # ★★★ Optional をインポート ★★★

router = APIRouter()

@router.get("/{target_date}", response_model=race_schema.RaceDayPrediction)
def read_predictions_for_date(target_date: date, db: Session = Depends(get_db)):
    """
    指定された日付のJRAおよびNARのレース予測を取得するエンドポイント。
    """
    predictions = race_crud.get_predictions_by_date(db=db, target_date=target_date)
    if not predictions["jra"] and not predictions["nar"]:
        raise HTTPException(status_code=404, detail=f"Predictions for date {target_date} not found")
    return predictions

@router.get("/special-pick/{target_date}", response_model=Optional[race_schema.SpecialPick])
def read_special_pick(target_date: date, db: Session = Depends(get_db)):
    """
    指定された日付の「注目馬」を取得するエンドポイント
    """
    pick = race_crud.get_special_pick_for_date(db=db, target_date=target_date)
    if not pick or not pick.race:
        return None
    
    commentary = f"{pick.race.venue_name}{pick.race.race_number}Rに出走する{pick.horse_name}に注目。AIは偏差値{pick.deviation_score:.2f}と高く評価しています。"
    
    return race_schema.SpecialPick(
        horse_id=pick.horse_id,
        horse_name=pick.horse_name,
        race_id=pick.race_id,
        race_name=pick.race.race_name,
        venue_name=pick.race.venue_name,
        race_number=pick.race.race_number,
        deviation_score=pick.deviation_score,
        commentary=commentary
    )