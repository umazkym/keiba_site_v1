# C:\Users\tnszk\program\GitHub\backend\api\v1\endpoints\races.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from crud import race_crud
from schemas import race_schema
from datetime import date

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