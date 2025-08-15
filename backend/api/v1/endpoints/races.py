# C:\Users\tnszk\program\GitHub\backend\api\v1\endpoints\races.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.database import get_db
from crud import race_crud
from schemas import race_schema
from datetime import date, timedelta
from typing import Optional, List

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

# ★★★ 新規追加: 高配当的中ランキングのエンドポイント ★★★
@router.get("/hits/top-payouts", response_model=List[race_schema.TopPayoutHit])
def read_top_payout_hits(db: Session = Depends(get_db)):
    """
    過去1週間のAI予測による高配当的中トップ5を取得する。
    """
    top_hits = race_crud.get_top_payout_hits(db=db, days=7, limit=5)
    return top_hits

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

@router.get("/matchups/{race_id}", response_model=race_schema.Matchup)
def read_filtered_matchups_for_race(
    race_id: str,
    start_date: date = Query(date(2000, 1, 1), description="集計開始日"),
    end_date: date = Query(date.today(), description="集計終了日"),
    db: Session = Depends(get_db)
):
    """
    指定されたレースIDと期間に基づいて、フィルタリングされた対戦成績を動的に計算して返す。
    """
    matchup_data = race_crud.get_filtered_matchups_for_race(
        db=db, 
        race_id=race_id, 
        start_date=start_date, 
        end_date=end_date
    )
    if matchup_data is None:
        raise HTTPException(status_code=404, detail=f"Matchup data for race {race_id} not found")

    return race_schema.Matchup(matchup_data=matchup_data)