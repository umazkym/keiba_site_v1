# C:\Users\tnszk\program\GitHub\backend\schemas\race_schema.py

from pydantic import BaseModel
from datetime import date
from typing import List, Optional

# orm_mode=True はPydantic V2以降では from_attributes=True と書くのが推奨です
class Config:
    from_attributes = True

class HorsePrediction(BaseModel):
    horse_name: str
    horse_number: int
    deviation_score: float
    mark: str
    start_1c_indicator: Optional[float]

    class Config(Config):
        pass

class RacePrediction(BaseModel):
    # ★★★ 修正点1: 'race_id' をモデルに合わせて 'id' に変更 ★★★
    id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    # ★★★ 修正点2: DBにNULLがありうるカラムをOptionalにする ★★★
    course_type: Optional[str]
    distance: Optional[int]
    
    predictions: List[HorsePrediction]

    class Config(Config):
        pass

class VenueRaces(BaseModel):
    venue_name: str
    races: List[RacePrediction]

class RaceDayPrediction(BaseModel):
    jra: List[VenueRaces]
    nar: List[VenueRaces]