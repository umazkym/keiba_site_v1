# C:\Users\tnszk\program\GitHub\backend\schemas\race_schema.py

from pydantic import BaseModel
from datetime import date
from typing import List, Optional

# Pydantic V2以降では from_attributes=True と書くのが推奨
class Config:
    from_attributes = True

class HorsePrediction(BaseModel):
    horse_name: str
    horse_number: int
    # ★★★ float を Optional[float] に変更 ★★★
    deviation_score: Optional[float]
    mark: str
    start_1c_indicator: Optional[float]

    class Config(Config):
        pass

class RacePrediction(BaseModel):
    id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
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