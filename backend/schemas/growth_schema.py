from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


EntityType = Literal["course", "horse", "jockey", "trainer", "grade"]


class RateSummary(BaseModel):
    sample_size: int = 0
    wins: int = 0
    places: int = 0
    win_rate: float = 0.0
    place_rate: float = 0.0
    average_rank: Optional[float] = None
    average_popularity: Optional[float] = None


class SegmentStat(RateSummary):
    key: str
    label: str


class EntitySummary(BaseModel):
    entity_type: EntityType
    id: str
    name: str
    subtitle: str
    affiliation: Optional[str] = None
    url: str
    sample_size: int
    last_race_date: Optional[date] = None
    indexable: bool
    venue_name: Optional[str] = None
    venue_slug: Optional[str] = None
    course_type: Optional[str] = None
    distance: Optional[int] = None
    race_count: Optional[int] = None


class EntityDirectoryResponse(BaseModel):
    entity_type: EntityType
    total: int
    limit: int
    offset: int
    items: List[EntitySummary] = Field(default_factory=list)


class SearchResult(BaseModel):
    entity_type: EntityType
    id: str
    name: str
    description: str
    affiliation: Optional[str] = None
    url: str
    sample_size: int
    indexable: bool


class SearchResponse(BaseModel):
    query: str
    total: int
    items: List[SearchResult] = Field(default_factory=list)


class RecentRun(BaseModel):
    race_id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    course_label: str
    horse_id: Optional[str] = None
    horse_name: Optional[str] = None
    horse_number: Optional[int] = None
    rank: Optional[int] = None
    popularity: Optional[int] = None
    odds: Optional[float] = None
    waku_number: Optional[int] = None
    horse_weight: Optional[int] = None
    horse_weight_diff: Optional[int] = None
    agari_3f: Optional[float] = None
    corner_positions: List[int] = Field(default_factory=list)
    url: str


class UpcomingRace(BaseModel):
    race_id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    course_label: str
    horse_id: Optional[str] = None
    horse_name: Optional[str] = None
    horse_number: Optional[int] = None
    deviation_score: Optional[float] = None
    mark: Optional[str] = None
    url: str


class PredictionHistoryItem(BaseModel):
    race_id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    deviation_score: Optional[float] = None
    mark: str
    rank: Optional[int] = None
    url: str


class EntityDetailResponse(BaseModel):
    entity: EntitySummary
    overall: RateSummary
    segments: Dict[str, List[SegmentStat]] = Field(default_factory=dict)
    recent_runs: List[RecentRun] = Field(default_factory=list)
    upcoming_races: List[UpcomingRace] = Field(default_factory=list)
    prediction_history: List[PredictionHistoryItem] = Field(default_factory=list)
    as_of: datetime


class PayoutStat(BaseModel):
    bet_type: str
    sample_size: int
    average_payout: float
    max_payout: int


class CourseDetailResponse(BaseModel):
    entity: EntitySummary
    venue_name: str
    venue_slug: str
    course_type: str
    distance: int
    analysis_start_date: Optional[date] = None
    analysis_end_date: Optional[date] = None
    overall: RateSummary
    segments: Dict[str, List[SegmentStat]] = Field(default_factory=dict)
    top_jockeys: List[SegmentStat] = Field(default_factory=list)
    top_trainers: List[SegmentStat] = Field(default_factory=list)
    payout_stats: List[PayoutStat] = Field(default_factory=list)
    recent_races: List[RecentRun] = Field(default_factory=list)
    as_of: datetime


class GrowthCounts(BaseModel):
    races: int
    results: int
    horses: int
    jockeys: int
    trainers: int
    course_conditions: int
    first_race_date: Optional[date] = None
    last_race_date: Optional[date] = None


class GrowthSummaryResponse(BaseModel):
    counts: GrowthCounts
    featured_courses: List[EntitySummary] = Field(default_factory=list)
    active_horses: List[EntitySummary] = Field(default_factory=list)
    active_jockeys: List[EntitySummary] = Field(default_factory=list)
    active_trainers: List[EntitySummary] = Field(default_factory=list)
    as_of: datetime


class SeriesRace(BaseModel):
    race_id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    course_label: str
    field_size: Optional[int] = None
    winner_name: Optional[str] = None
    winner_popularity: Optional[int] = None
    top_prediction_name: Optional[str] = None
    top_prediction_rank: Optional[int] = None
    url: str


class RaceSeriesResponse(BaseModel):
    name: str
    sample_size: int
    winner_popularity: List[SegmentStat] = Field(default_factory=list)
    history: List[SeriesRace] = Field(default_factory=list)
    as_of: datetime


class RunnerFeature(BaseModel):
    horse_id: str
    horse_name: str
    horse_number: Optional[int] = None
    jockey_id: Optional[str] = None
    jockey_name: Optional[str] = None
    trainer_id: Optional[str] = None
    trainer_name: Optional[str] = None
    deviation_score: Optional[float] = None
    mark: Optional[str] = None
    horse_overall: RateSummary
    horse_condition: RateSummary
    jockey_condition: RateSummary
    trainer_condition: RateSummary


class RaceFeatureResponse(BaseModel):
    race_id: str
    race_date: date
    venue_name: str
    race_number: int
    race_name: str
    course_label: str
    runners: List[RunnerFeature] = Field(default_factory=list)
    as_of: datetime


class HorseComparisonRequest(BaseModel):
    horse_ids: List[str] = Field(min_length=2, max_length=5)
    venue_name: str = Field(min_length=1, max_length=20)
    course_type: Literal["芝", "ダート", "障害"]
    distance: int = Field(ge=200, le=5000)
    ground_condition: Optional[str] = Field(default=None, max_length=20)

    @field_validator("horse_ids")
    @classmethod
    def validate_horse_ids(cls, values: List[str]) -> List[str]:
        normalized = [value.strip() for value in values]
        if any(not value for value in normalized):
            raise ValueError("horse_ids must not contain empty values")
        if len(set(normalized)) != len(normalized):
            raise ValueError("horse_ids must contain unique values")
        return normalized

    @field_validator("venue_name")
    @classmethod
    def normalize_venue_name(cls, value: str) -> str:
        normalized = value.strip().replace("競馬場", "")
        if not normalized:
            raise ValueError("venue_name must not be empty")
        return normalized

    @field_validator("ground_condition")
    @classmethod
    def normalize_ground_condition(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class HorseComparisonCondition(BaseModel):
    venue_name: str
    course_type: Literal["芝", "ダート", "障害"]
    distance: int
    ground_condition: Optional[str] = None


class HorseComparisonItem(BaseModel):
    horse_id: str
    horse_name: str
    url: str
    overall: RateSummary
    matched_condition: RateSummary
    recent_runs: List[RecentRun] = Field(default_factory=list)
    sample_quality: Literal["insufficient", "reference", "comparable"]
    wilson_lower_bound: Optional[float] = None


class HorseComparisonResponse(BaseModel):
    conditions: HorseComparisonCondition
    horses: List[HorseComparisonItem] = Field(default_factory=list)
    analysis_start_date: Optional[date] = None
    analysis_end_date: Optional[date] = None
    data_as_of_date: Optional[date] = None
    as_of: datetime


class DataSitemapEntry(BaseModel):
    url: str
    entity_type: EntityType
    last_modified: Optional[date] = None
