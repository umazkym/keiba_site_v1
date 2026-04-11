import { RaceDayPrediction, SpecialPick, MatchupData, TopPayoutHit, WeeklyGradeRace } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// ▼▼▼▼▼【ISR導入】▼▼▼▼▼
// レースデータはcronジョブで1日2〜3回（06:00, 13:30 JST）のみ更新される。
// リアルタイム性は不要なため、ISR (Incremental Static Regeneration) で
// revalidate値を設定し、キャッシュヒット時は即座にレスポンスを返す。
//
// revalidate値の根拠（GitHub Actionsのデータ更新スケジュールに基づく）:
//   データ更新: 毎日05:00(結果), 10:00(当日予測), 13:30(翌日予測) の最大3回
//   3600秒 (1時間) = レース予測・注目馬（★ Neon Free Tier Transfer削減のため1800→3600に延長）
//   3600秒 (1時間) = 高配当ランキング・重賞情報（日次/週次集計データ）
//   86400秒 (24時間) = サイトマップ（日次更新で十分）
// ※ stale-while-revalidate方式のため、キャッシュ切れ時もユーザーにはstaleデータが返り、
//   バックグラウンドで新データが取得される。500エラーにはならない。
// ▲▲▲▲▲【ISR導入ここまで】▲▲▲▲▲

// ▼▼▼▼▼【コールドスタート対策】▼▼▼▼▼
// Cloud Run (Scale to Zero) + Neon (Scale to Zero) の同時ウェイクアップで
// 初回リクエストが10-20秒かかりタイムアウトする問題への対策。
// 失敗時に一定時間待ってからリトライすることで、2回目にはウォームアップ完了済み。
// ▲▲▲▲▲【コールドスタート対策ここまで】▲▲▲▲▲
async function fetchWithRetry(
    url: string,
    options: RequestInit & { next?: { revalidate?: number } },
    retries: number = 1,
    delayMs: number = 3000
): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, options);
            // 5xx エラーの場合はリトライ対象（コールドスタートでの一時的な失敗）
            if (res.status >= 500 && attempt < retries) {
                console.warn(`[fetchWithRetry] ${url} returned ${res.status}, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${retries + 1})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            return res;
        } catch (error) {
            if (attempt < retries) {
                console.warn(`[fetchWithRetry] ${url} fetch failed, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${retries + 1})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            throw error;
        }
    }
    // フォールバック（到達しないはずだが型安全のため）
    return fetch(url, options);
}

export async function getPredictionsForDate(date: string): Promise<RaceDayPrediction | null> {
    try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/v1/predictions/${date}`, { next: { revalidate: 3600 } });
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
        const res = await fetchWithRetry(`${API_BASE_URL}/api/v1/predictions/special-pick/${date}`, { next: { revalidate: 3600 } });
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
        const res = await fetchWithRetry(`${API_BASE_URL}/api/v1/predictions/matchups/${raceId}?start_date=${startDate}&end_date=${endDate}`, { next: { revalidate: 3600 } });
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

// 高配当データマッチ実績を取得する関数
export async function getTopPayoutHits(): Promise<TopPayoutHit[]> {
    try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/v1/predictions/hits/top-payouts`, { next: { revalidate: 3600 } });
        if (!res.ok) {
            throw new Error(`Failed to fetch top hits. Status: ${res.status}`);
        }
        return res.json();
    } catch (error: any) {
        console.error("An error occurred in getTopPayoutHits:", error.message);
        return []; // エラー時は空配列を返す
    }
}

// ★★★ 新規追加: サイトマップ/検索エンジン向け 全レースURL取得関数 ★★★
export async function getAllRaceUrls(): Promise<{ race_date: string; venue_name: string; race_number: number }[]> {
    try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/v1/predictions/sitemap/all-race-urls`, { next: { revalidate: 86400 } });
        if (!res.ok) {
            console.error(`Failed to fetch all race urls. Status: ${res.status}`);
            return [];
        }
        return res.json();
    } catch (error: any) {
        console.error("An error occurred in getAllRaceUrls:", error.message);
        return [];
    }
}

export async function getWeeklyGradeRaces(): Promise<WeeklyGradeRace[]> {
    try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/v1/predictions/weekly-grade-races`, { next: { revalidate: 3600 } });
        if (!res.ok) {
            console.warn(`Could not fetch weekly grade races. Status: ${res.status}`);
            return [];
        }
        return res.json();
    } catch (error: any) {
        console.error("An error occurred in getWeeklyGradeRaces:", error.message);
        return [];
    }
}