# C:\Users\tnszk\program\GitHub\backend\schemas\race_schema.py
from pydantic import BaseModel, ConfigDict
from datetime import date
from typing import List, Optional, Dict, Any

# ★★★ 新規追加: レース結果のスキーマ ★★★
class ResultSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    horse_number: int
    rank: Optional[int]
    horse_name: Optional[str] # 表示用に馬名を追加

class HorsePrediction(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    horse_id: str
    horse_name: str
    horse_number: int
    waku_number: Optional[int]
    deviation_score: Optional[float]
    mark: str
    start_1c_indicator: Optional[float]

class Matchup(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    matchup_data: Dict[str, Any]

class HorseNumberAdvantage(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    horse_number: int
    advantage_score: float

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
    matchup: Optional[Matchup]
    horse_number_advantages: List[HorseNumberAdvantage]
    # ★★★ 修正: フロントエンドで結果を扱えるようにresultsプロパティを追加 ★★★
    results: List[ResultSchema]

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

# ★★★ 新規追加: 的中配当ランキング用のスキーマ ★★★
class TopPayoutHit(BaseModel):
    race_id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    bet_type: str
    winning_numbers: str
    payout: int