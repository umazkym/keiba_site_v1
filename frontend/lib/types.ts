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
    source?: "api" | "schedule";
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
    recent_misses: AccuracyMissCase[];
}
