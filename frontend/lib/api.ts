import { RaceDayPrediction, SpecialPick, MatchupData, TopPayoutHit, WeeklyGradeRace, PredictionAccuracySummary } from "./types";
import { getApiBaseUrl } from "./api-base";

const API_BASE_URL = getApiBaseUrl();
const RECENT_RACE_REVALIDATE_SECONDS = 300;
const DEFAULT_RACE_REVALIDATE_SECONDS = 3600;

function formatJstDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number): string {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
}

function getRaceDataRevalidate(date: string): number {
    const today = formatJstDate(new Date());
    const recentDates = new Set([
        addDays(today, -1),
        today,
        addDays(today, 1),
    ]);

    return recentDates.has(date)
        ? RECENT_RACE_REVALIDATE_SECONDS
        : DEFAULT_RACE_REVALIDATE_SECONDS;
}

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

export async function getPredictionsForDate(
    date: string,
    options: { bypassCache?: boolean; throwOnError?: boolean; revalidateSeconds?: number } = {},
): Promise<RaceDayPrediction | null> {
    try {
        const requestOptions: RequestInit & { next?: { revalidate?: number } } = options.bypassCache
            ? { cache: 'no-store' }
            : { next: { revalidate: options.revalidateSeconds ?? getRaceDataRevalidate(date) } };
        const res = await fetchWithRetry(
            `${API_BASE_URL}/api/v1/predictions/${date}`,
            requestOptions,
        );
        if (!res.ok) {
            if (res.status === 404) {
                console.log(`No predictions found for date ${date}, returning empty data.`);
                return { jra: [], nar: [] };
            }
            const message = `Failed to fetch data from API. Status: ${res.status}`;
            console.error(message);
            if (options.throwOnError) {
                throw new Error(message);
            }
            return null;
        }
        const data = await res.json();
        // ★ 防御的バリデーション: APIが200 OKでも予期しない構造のレスポンスを返す場合がある
        // （CDNキャッシュ破損、プロキシ介入、バックエンドの一時的な不整合等）
        // jra/nar プロパティが欠落している場合はフォールバックし、
        // TypeError: Cannot read properties of undefined (reading 'push'/'length') を防止する
        if (!data || typeof data !== 'object') {
            console.error(`[getPredictionsForDate] Invalid response body for ${date}:`, data);
            if (options.throwOnError) {
                throw new Error(`Invalid prediction response for ${date}`);
            }
            return null;
        }
        return {
            jra: Array.isArray(data.jra) ? data.jra : [],
            nar: Array.isArray(data.nar) ? data.nar : [],
        };
    } catch (error: any) {
        console.error("A network or fetch error occurred in getPredictionsForDate:", error.message);
        if (options.throwOnError) {
            throw error;
        }
        return null;
    }
}

export async function getSpecialPick(
    date: string,
    options: { revalidateSeconds?: number } = {},
): Promise<SpecialPick | null> {
    try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/v1/predictions/special-pick/${date}`, { next: { revalidate: options.revalidateSeconds ?? getRaceDataRevalidate(date) } });
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

export async function getPredictionAccuracySummary(days: number = 30): Promise<PredictionAccuracySummary | null> {
    try {
        const safeDays = Math.max(7, Math.min(days, 180));
        const res = await fetchWithRetry(`${API_BASE_URL}/api/v1/predictions/stats/accuracy?days=${safeDays}`, { next: { revalidate: 3600 } });
        if (!res.ok) {
            if (res.status === 404) {
                return null;
            }
            console.warn(`Could not fetch prediction accuracy summary. Status: ${res.status}`);
            return null;
        }
        return res.json();
    } catch (error: any) {
        console.error("An error occurred in getPredictionAccuracySummary:", error.message);
        return null;
    }
}
