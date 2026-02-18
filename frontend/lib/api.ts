import { RaceDayPrediction, SpecialPick, MatchupData, TopPayoutHit } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function getPredictionsForDate(date: string): Promise<RaceDayPrediction | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/${date}`, { cache: 'no-store' });
        if (!res.ok) {
            if (res.status === 404) {
                console.log(`No predictions found for date ${date}, returning empty data.`);
                return { jra: [], nar: [] };
            }
            console.error(`Failed to fetch data from API. Status: ${res.status}`);
            return null;
        }
        return res.json();
    } catch (error: any) {
        console.error("A network or fetch error occurred in getPredictionsForDate:", error.message);
        return null;
    }
}

export async function getSpecialPick(date: string): Promise<SpecialPick | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/special-pick/${date}`, { cache: 'no-store' });
        if (!res.ok) {
            console.warn(`Could not fetch special pick for ${date}. Status: ${res.status}`);
            return null;
        }
        const data = await res.json();
        return data || null;
    } catch (error: any) {
        console.error("A network or fetch error occurred in getSpecialPick:", error.message);
        return null;
    }
}

export async function getFilteredMatchups(raceId: string, startDate: string, endDate: string): Promise<MatchupData | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/matchups/${raceId}?start_date=${startDate}&end_date=${endDate}`, { cache: 'no-store' });
        if (!res.ok) {
            console.warn(`Could not fetch filtered matchups for ${raceId}. Status: ${res.status}`);
            return null;
        }
        return res.json();
    } catch (error: any) {
        console.error("A network or fetch error occurred in getFilteredMatchups:", error.message);
        return null;
    }
}

// ★★★ 新規追加: 高配当データマッチ実績を取得する関数 ★★★
export async function getTopPayoutHits(): Promise<TopPayoutHit[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/hits/top-payouts`, { cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`Failed to fetch top hits. Status: ${res.status}`);
        }
        return res.json();
    } catch (error: any) {
        console.error("An error occurred in getTopPayoutHits:", error.message);
        return []; // エラー時は空配列を返す
    }
}