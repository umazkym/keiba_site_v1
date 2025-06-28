export interface HorsePrediction {
    horse_id: string;
    horse_name: string;
    horse_number: number;
    waku_number: number | null;
    deviation_score: number | null;
    mark: string;
    start_1c_indicator: number | null;
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

// ★★★ 馬番有利不利データの型定義を追加 ★★★
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
    predictions: HorsePrediction[];
    matchup: MatchupData | null;
    // ★★★ 馬番有利不利データのプロパティを追加 ★★★
    horse_number_advantages: HorseNumberAdvantage[];
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