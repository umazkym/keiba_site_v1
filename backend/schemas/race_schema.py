# C:\Users\tnszk\program\GitHub\backend\schemas\race_schema.py

from pydantic import BaseModel, ConfigDict
from datetime import date
from typing import List, Optional

class HorsePrediction(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    horse_name: str
    horse_number: int
    waku_number: Optional[int] # ★★★ waku_number を追加 ★★★
    deviation_score: Optional[float]
    mark: str
    start_1c_indicator: Optional[float]

class RacePrediction(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    course_type: Optional[str]
    distance: Optional[int]
    predictions: List[HorsePrediction]

class VenueRaces(BaseModel):
    venue_name: str
    races: List[RacePrediction]

class RaceDayPrediction(BaseModel):
    jra: List[VenueRaces]
    nar: List[VenueRaces]

class SpecialPick(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    horse_id: str
    horse_name: str
    race_id: str
    race_name: str
    venue_name: str
    race_number: int
    deviation_score: float
    commentary: str