# C:\Users\tnszk\program\GitHub\backend\schemas\race_schema.py
from pydantic import BaseModel, ConfigDict
from datetime import date
from typing import List, Optional, Dict, Any

class ResultSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    horse_id: Optional[str] = None
    horse_number: Optional[int]
    rank: Optional[int]
    horse_name: Optional[str]

class HorsePrediction(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    horse_id: str
    horse_name: str
    horse_number: int
    waku_number: Optional[int]
    deviation_score: Optional[float]
    mark: str
    start_1c_indicator: Optional[float]
    unpredictable_reason: Optional[str] = None # ★★★ 追加 ★★★

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
    ai_analysis_text: Optional[str] = None # ★★★ 追加 ★★★
    predictions: List[HorsePrediction]
    matchup: Optional[Matchup]
    horse_number_advantages: List[HorseNumberAdvantage]
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

class TopPayoutHit(BaseModel):
    race_id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    bet_type: str
    winning_numbers: str
    payout: int


class WeeklyGradeRace(BaseModel):
    race_id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    race_type: Optional[str] = None
    grade: str  # "G1", "G2", "G3", "Jpn1", "Jpn2", "Jpn3", "地方重賞"


class AccuracyRate(BaseModel):
    label: str
    races: int
    rate: float
    hits: int
    total: int


class AccuracyCondition(BaseModel):
    label: str
    races: int
    top1_place_rate: float
    top3_place_rate: float


class AccuracyMissCase(BaseModel):
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    horse_name: str
    deviation_score: float
    rank: Optional[int]
    course_type: Optional[str]
    distance: Optional[int]


class PredictionAccuracySummary(BaseModel):
    start_date: date
    end_date: date
    race_count: int
    top1_win: AccuracyRate
    top1_place: AccuracyRate
    top3_place: AccuracyRate
    by_course_type: List[AccuracyCondition]
    by_distance: List[AccuracyCondition]
    recent_misses: List[AccuracyMissCase]
