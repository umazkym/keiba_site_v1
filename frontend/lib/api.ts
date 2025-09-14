import { RaceDayPrediction, SpecialPick, MatchupData, TopPayoutHit } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// ==============================================================================
// ▼▼▼▼▼【ここから修正】▼▼▼▼▼
/**
 * 日付に基づいてキャッシュの有効期間（秒）を決定するヘルパー関数
 * @param dateString - 'YYYY-MM-DD'形式の日付文字列
 * @returns number - キャッシュの秒数
 */
const getRevalidateSeconds = (dateString: string): number => {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const targetDate = new Date(dateString + 'T00:00:00Z'); // タイムゾーンをUTCとして解釈

    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0) {
        // 今日以降のデータは5分間キャッシュ
        return 300; // 5 minutes
    } else {
        // 過去のデータは変更されないため、24時間キャッシュ
        return 86400; // 24 hours
    }
};

export async function getPredictionsForDate(date: string): Promise<RaceDayPrediction> {
    try {
        const revalidateSeconds = getRevalidateSeconds(date);
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/${date}`, {
            // cache: 'no-store' を削除し、next.revalidateオプションを使用
            next: { revalidate: revalidateSeconds }
        });

        if (!res.ok) {
            if (res.status === 404) {
                console.log(`No predictions found for date ${date}, returning empty data.`);
                return { jra: [], nar: [] };
            }
            throw new Error(`Failed to fetch data from API. Status: ${res.status}`);
        }
        return res.json();
    } catch (error: any) {
        console.error("A network or fetch error occurred in getPredictionsForDate:", error.message);
        throw new Error('Failed to fetch data from API. バックエンドサーバーが起動しているか確認してください。');
    }
}

export async function getSpecialPick(date: string): Promise<SpecialPick | null> {
    try {
        const revalidateSeconds = getRevalidateSeconds(date);
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/special-pick/${date}`, {
            next: { revalidate: revalidateSeconds }
        });
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
        // このAPIは動的にデータを生成するため、キャッシュ時間は短めに設定
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/matchups/${raceId}?start_date=${startDate}&end_date=${endDate}`, {
            next: { revalidate: 600 } // 10分キャッシュ
        });
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

export async function getTopPayoutHits(): Promise<TopPayoutHit[]> {
    try {
        // 的中ランキングは頻繁に更新されないため、1時間キャッシュ
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/hits/top-payouts`, {
            next: { revalidate: 3600 } // 1 hour
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch top hits. Status: ${res.status}`);
        }
        return res.json();
    } catch (error: any) {
        console.error("An error occurred in getTopPayoutHits:", error.message);
        return []; // エラー時は空配列を返す
    }
}
// ▲▲▲▲▲【修正ここまで】▲▲▲▲▲