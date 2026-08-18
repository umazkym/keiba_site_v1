// frontend/lib/types.ts

// レース結果の型
export interface Result {
    horse_number: number;
    rank: number | null;
    horse_name: string | null;
}

export interface HorsePrediction {
    horse_id: string;
    horse_name: string;
    horse_number: number;
    waku_number: number | null;
    deviation_score: number | null;
    mark: string;
    start_1c_indicator: number | null;
    rank: number | null;
    unpredictable_reason?: string | null; // ★★★ 追加 ★★★
    detail_page_indexable?: boolean;
}

export interface MatchupRecord {
    win: number;
    loss: number;
    draw: number;
    history: {
        race_id: string;
        race_date: string;
        venue_name: string;
        p1_horse_id: string;
        p1_rank: number;
        p2_horse_id: string;
        p2_rank: number;
    }[];
}

export interface MatchupData {
    matchup_data: Record<string, MatchupRecord>;
}

export interface HorseNumberAdvantage {
    horse_number: number;
    advantage_score: number;
}

export interface RacePrediction {
    id: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    // race_name はAPI側で表示用に整形済み（末尾の「重賞」「Jpn3」等を除去）。
    // 重賞かどうかはこのフィールドで判定すること。
    grade?: string | null;
    course_type: string | null;
    distance: number | null;
    ai_analysis_text?: string | null; // ★★★ 追加 ★★★
    predictions: HorsePrediction[];
    matchup: MatchupData | null;
    horse_number_advantages: HorseNumberAdvantage[];
    results: Result[];
}

export interface VenueRaces {
    venue_name: string;
    races: RacePrediction[];
}

export interface RaceDayPrediction {
    jra: VenueRaces[];
    nar: VenueRaces[];
}

export interface SpecialPick {
    horse_id: string;
    horse_name: string;
    race_id: string;
    race_name: string;
    venue_name: string;
    race_number: number;
    deviation_score: number;
    commentary: string;
}

export interface TopPayoutHit {
    race_id: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    bet_type: string;
    winning_numbers: string;
    payout: number;
}

export interface WeeklyGradeRace {
    race_id: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    race_type?: "中央" | "地方" | string | null;
    grade: string; // "G1", "G2", "G3", "Jpn1", "Jpn2", "Jpn3", "地方重賞"
}

export interface RaceDetailPrediction {
    race_type: string;
    venue_name: string;
    race: RacePrediction;
    race_numbers: number[];
}

export interface ArticleRacePreviewPrediction {
    horse_number: number;
    horse_name: string;
    deviation_score: number | null;
    mark: string;
}

export interface ArticleRacePreviewRace {
    id: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    course_type: string | null;
    distance: number | null;
    race_url: string;
}

export interface ArticleRacePreviewResponse {
    status: 'available' | 'race_only' | 'not_found';
    race: ArticleRacePreviewRace | null;
    top_predictions: ArticleRacePreviewPrediction[];
    as_of: string;
}

export interface AccuracyRate {
    label: string;
    races: number;
    rate: number;
    hits: number;
    total: number;
}

export interface AccuracyCondition {
    label: string;
    races: number;
    top1_place_rate: number;
    top3_place_rate: number;
}

export interface AccuracyMissCase {
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    horse_name: string;
    deviation_score: number;
    rank: number | null;
    course_type: string | null;
    distance: number | null;
}

export interface PredictionAccuracySummary {
    start_date: string;
    end_date: string;
    race_count: number;
    top1_win: AccuracyRate;
    top1_place: AccuracyRate;
    top3_place: AccuracyRate;
    by_course_type: AccuracyCondition[];
    by_distance: AccuracyCondition[];
    by_venue: AccuracyCondition[];
    by_score_band: AccuracyCondition[];
    recent_misses: AccuracyMissCase[];
}

export type DataEntityType = 'course' | 'horse' | 'jockey' | 'trainer' | 'grade';
export type SearchPublicationStatus = 'candidate' | 'published' | 'held' | 'retired';

export interface RateSummary {
    sample_size: number;
    wins: number;
    places: number;
    win_rate: number;
    place_rate: number;
    average_rank: number | null;
    average_popularity: number | null;
}

export interface SegmentStat extends RateSummary {
    key: string;
    label: string;
}

export interface DataEntitySummary {
    entity_type: DataEntityType;
    id: string;
    name: string;
    subtitle: string;
    affiliation?: string | null;
    url: string;
    sample_size: number;
    last_race_date: string | null;
    quality_eligible: boolean;
    search_publication_status: SearchPublicationStatus;
    indexable: boolean;
    venue_name?: string | null;
    venue_slug?: string | null;
    course_type?: string | null;
    distance?: number | null;
    race_count?: number | null;
}

export interface DataEntityDirectory {
    entity_type: DataEntityType;
    total: number;
    limit: number;
    offset: number;
    items: DataEntitySummary[];
}

export interface DataSearchResult {
    entity_type: DataEntityType;
    id: string;
    name: string;
    description: string;
    affiliation?: string | null;
    url: string;
    sample_size: number;
    quality_eligible: boolean;
    search_publication_status: SearchPublicationStatus;
    indexable: boolean;
}

export interface DataSearchResponse {
    query: string;
    total: number;
    items: DataSearchResult[];
}

export interface DataRecentRun {
    race_id: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    course_label: string;
    horse_id: string | null;
    horse_name: string | null;
    horse_number: number | null;
    rank: number | null;
    popularity: number | null;
    odds: number | null;
    waku_number: number | null;
    horse_weight: number | null;
    horse_weight_diff: number | null;
    agari_3f: number | null;
    corner_positions: number[];
    /** RACE_PAGE_MIN_DATE より前のレースはページが存在しないため null。 */
    url: string | null;
}

export interface DataUpcomingRace {
    race_id: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    course_label: string;
    horse_id: string | null;
    horse_name: string | null;
    horse_number: number | null;
    deviation_score: number | null;
    mark: string | null;
    url: string;
}

export interface PredictionHistoryItem {
    race_id: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    deviation_score: number | null;
    mark: string;
    rank: number | null;
    /** RACE_PAGE_MIN_DATE より前のレースはページが存在しないため null。 */
    url: string | null;
}

export interface DataEntityDetail {
    entity: DataEntitySummary;
    overall: RateSummary;
    segments: Record<string, SegmentStat[]>;
    recent_runs: DataRecentRun[];
    upcoming_races: DataUpcomingRace[];
    prediction_history: PredictionHistoryItem[];
    as_of: string;
}

export interface PayoutStat {
    bet_type: string;
    sample_size: number;
    average_payout: number;
    max_payout: number;
}

export interface CourseDataDetail {
    entity: DataEntitySummary;
    venue_name: string;
    venue_slug: string;
    course_type: string;
    distance: number;
    analysis_start_date: string | null;
    analysis_end_date: string | null;
    overall: RateSummary;
    segments: Record<string, SegmentStat[]>;
    top_jockeys: SegmentStat[];
    top_trainers: SegmentStat[];
    payout_stats: PayoutStat[];
    recent_races: DataRecentRun[];
    as_of: string;
}

export interface GrowthCounts {
    races: number;
    results: number;
    horses: number;
    jockeys: number;
    trainers: number;
    course_conditions: number;
    first_race_date: string | null;
    last_race_date: string | null;
}

export interface GrowthDataSummary {
    counts: GrowthCounts;
    featured_courses: DataEntitySummary[];
    active_horses: DataEntitySummary[];
    active_jockeys: DataEntitySummary[];
    active_trainers: DataEntitySummary[];
    as_of: string;
}

export interface SeriesRace {
    race_id: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    course_label: string;
    field_size: number | null;
    winner_name: string | null;
    winner_popularity: number | null;
    top_prediction_name: string | null;
    top_prediction_rank: number | null;
    /** RACE_PAGE_MIN_DATE より前のレースはページが存在しないため null。 */
    url: string | null;
}

export interface RaceSeriesData {
    name: string;
    sample_size: number;
    winner_popularity: SegmentStat[];
    history: SeriesRace[];
    as_of: string;
}

export interface RunnerFeature {
    horse_id: string;
    horse_name: string;
    horse_number: number | null;
    jockey_id: string | null;
    jockey_name: string | null;
    trainer_id: string | null;
    trainer_name: string | null;
    horse_detail_page_indexable?: boolean;
    jockey_detail_page_indexable?: boolean;
    trainer_detail_page_indexable?: boolean;
    deviation_score: number | null;
    mark: string | null;
    horse_overall: RateSummary;
    horse_condition: RateSummary;
    jockey_condition: RateSummary;
    trainer_condition: RateSummary;
}

export interface RaceDataFeatures {
    race_id: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    course_label: string;
    runners: RunnerFeature[];
    as_of: string;
}

export type HorseComparisonSampleQuality = 'insufficient' | 'reference' | 'comparable';

export interface HorseComparisonRequest {
    horse_ids: string[];
    venue_name: string;
    course_type: '芝' | 'ダート' | '障害';
    distance: number;
    ground_condition?: string | null;
}

export interface HorseComparisonCondition {
    venue_name: string;
    course_type: '芝' | 'ダート' | '障害';
    distance: number;
    ground_condition: string | null;
}

export interface HorseComparisonItem {
    horse_id: string;
    horse_name: string;
    url: string;
    overall: RateSummary;
    matched_condition: RateSummary;
    recent_runs: DataRecentRun[];
    sample_quality: HorseComparisonSampleQuality;
    wilson_lower_bound: number | null;
}

export interface HorseComparisonResponse {
    conditions: HorseComparisonCondition;
    horses: HorseComparisonItem[];
    analysis_start_date: string | null;
    analysis_end_date: string | null;
    data_as_of_date: string | null;
    as_of: string;
}

export interface DataSitemapEntry {
    url: string;
    entity_type: DataEntityType;
    last_modified: string | null;
}

export interface DataSitemapManifestEntry {
    entity_type: Exclude<DataEntityType, 'grade'>;
    shard: number;
    count: number;
    last_modified: string | null;
}
