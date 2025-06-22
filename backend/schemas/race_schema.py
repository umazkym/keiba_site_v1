# C:\Users\tnszk\program\keiba-ai-site\backend\schemas\race_schema.py
from pydantic import BaseModel
from datetime import date
from typing import List, Optional

# 予測結果の単一馬データ
class HorsePrediction(BaseModel):
    horse_name: str
    horse_number: int
    deviation_score: float
    mark: str
    start_1c_indicator: Optional[float]

    class Config:
        orm_mode = True

# 1レースごとの完全な予測データ
class RacePrediction(BaseModel):
    race_id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    course_type: str
    distance: int
    predictions: List[HorsePrediction]

    class Config:
        orm_mode = True

# 開催地ごとのレースリスト
class VenueRaces(BaseModel):
    venue_name: str
    races: List[RacePrediction]

# JRA/NARごとのデータ
class RaceDayPrediction(BaseModel):
    jra: List[VenueRaces]
    nar: List[VenueRaces]