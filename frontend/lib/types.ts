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
    // ★★★ 追加: 結果をマージするためrankプロパティを追加 ★★★
    rank: number | null; 
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
    predictions: HorsePrediction[];
    matchup: MatchupData | null;
    horse_number_advantages: HorseNumberAdvantage[];
    // ★★★ 修正: resultsプロパティを追加 ★★★
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

// ★★★ 新規追加: 高配当的中の型 ★★★
export interface TopPayoutHit {
    race_id: string;
    race_date: string; // dateはstringで受け取る
    venue_name: string;
    race_number: number;
    race_name: string;
    bet_type: string;
    winning_numbers: string;
    payout: number;
}