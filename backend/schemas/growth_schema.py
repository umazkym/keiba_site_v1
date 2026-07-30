from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


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
    url: str
    sample_size: int
    last_race_date: Optional[date] = None
    indexable: bool


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


class DataSitemapEntry(BaseModel):
    url: str
    entity_type: EntityType
    last_modified: Optional[date] = None
