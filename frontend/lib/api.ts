import {
    ArticleRacePreviewResponse,
    CourseDataDetail,
    DataEntityDetail,
    DataEntityDirectory,
    DataEntityType,
    DataSearchResponse,
    DataSitemapEntry,
    GrowthDataSummary,
    HorseComparisonRequest,
    HorseComparisonResponse,
    MatchupData,
    PredictionAccuracySummary,
    RaceDataFeatures,
    RaceDayPrediction,
    RaceSeriesData,
    SpecialPick,
    TopPayoutHit,
    WeeklyGradeRace,
} from "./types";
import { getApiBaseUrl } from "./api-base";
import {
    normalizeDataEntitySummary,
    normalizeDataSearchResult,
    splitPersonDisplayName,
} from "./data-directory";

const API_BASE_URL = getApiBaseUrl();
const RECENT_RACE_REVALIDATE_SECONDS = 300;
const DEFAULT_RACE_REVALIDATE_SECONDS = 3600;
const BUILD_FETCH_TIMEOUT_MS = 8000;
const RUNTIME_FETCH_TIMEOUT_MS = 20000;

function isNextProductionBuild(): boolean {
    return (
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.IS_NEXT_PRODUCTION_BUILD === 'true' ||
        process.env.NEXT_PHASE?.includes('build') === true
    );
}

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
    return formatJstDate(date);
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

function getArticlePreviewRevalidate(date: string): number {
    return date < formatJstDate(new Date())
        ? DEFAULT_RACE_REVALIDATE_SECONDS
        : RECENT_RACE_REVALIDATE_SECONDS;
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
    retries?: number,
    delayMs: number = 3000,
    timeoutMs?: number,
): Promise<Response> {
    const isBuild = isNextProductionBuild();
    const effectiveRetries = retries ?? (isBuild ? 0 : 1);
    const effectiveTimeoutMs = timeoutMs ?? (isBuild
        ? BUILD_FETCH_TIMEOUT_MS
        : RUNTIME_FETCH_TIMEOUT_MS);

    for (let attempt = 0; attempt <= effectiveRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);
        try {
            const res = await fetch(url, {
                ...options,
                signal: options.signal ?? controller.signal,
            });
            // 5xx エラーの場合はリトライ対象（コールドスタートでの一時的な失敗）
            if (res.status >= 500 && attempt < effectiveRetries) {
                console.warn(`[fetchWithRetry] ${url} returned ${res.status}, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${effectiveRetries + 1})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            return res;
        } catch (error) {
            if (attempt < effectiveRetries) {
                const reason = error instanceof Error ? error.name : 'UnknownError';
                console.warn(`[fetchWithRetry] ${url} failed with ${reason}, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${effectiveRetries + 1})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }
    throw new Error(`Failed to fetch ${url}`);
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

export async function getArticleRacePreview(
    raceDate: string,
    raceName: string,
): Promise<ArticleRacePreviewResponse | null> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raceDate) || !raceName.trim()) return null;

    try {
        const res = await fetchWithRetry(
            `${API_BASE_URL}/api/v1/predictions/article-preview/${raceDate}?race_name=${encodeURIComponent(raceName.trim())}`,
            { next: { revalidate: getArticlePreviewRevalidate(raceDate) } },
        );
        if (!res.ok) {
            console.warn(`Could not fetch article race preview for ${raceDate}. Status: ${res.status}`);
            return null;
        }

        const data = await res.json();
        if (
            !data
            || !['available', 'race_only', 'not_found'].includes(data.status)
            || !Array.isArray(data.top_predictions)
        ) {
            console.error('[getArticleRacePreview] Invalid response body:', data);
            return null;
        }
        return data as ArticleRacePreviewResponse;
    } catch (error) {
        console.error('[getArticleRacePreview] Failed:', error);
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

export async function getFilteredMatchups(
    raceId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
): Promise<MatchupData | null> {
    try {
        const res = await fetchWithRetry(
            `${API_BASE_URL}/api/v1/predictions/matchups/${raceId}?start_date=${startDate}&end_date=${endDate}`,
            { next: { revalidate: 3600 }, signal },
            signal ? 0 : undefined,
        );
        if (!res.ok) {
            console.warn(`Could not fetch filtered matchups for ${raceId}. Status: ${res.status}`);
            return null;
        }
        return res.json();
    } catch (error: any) {
        if (signal?.aborted || error?.name === 'AbortError') throw error;
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

async function getDataApiJson<T>(
    path: string,
    options: { revalidate?: number; cache?: RequestCache } = {},
): Promise<T | null> {
    try {
        const requestOptions: RequestInit & { next?: { revalidate?: number } } = options.cache
            ? { cache: options.cache }
            : { next: { revalidate: options.revalidate ?? 3600 } };
        const response = await fetchWithRetry(
            `${API_BASE_URL}/api/v1/data${path}`,
            requestOptions,
        );
        if (!response.ok) {
            if (response.status !== 404) {
                console.warn(`[getDataApiJson] ${path} returned ${response.status}`);
            }
            return null;
        }
        return response.json() as Promise<T>;
    } catch (error) {
        console.error(`[getDataApiJson] ${path} failed:`, error);
        return null;
    }
}

export async function getGrowthDataSummary(): Promise<GrowthDataSummary | null> {
    const summary = await getDataApiJson<GrowthDataSummary>('/summary', { revalidate: 21600 });
    if (!summary) return null;
    return {
        ...summary,
        featured_courses: summary.featured_courses.map(normalizeDataEntitySummary),
        active_horses: summary.active_horses.map(normalizeDataEntitySummary),
        active_jockeys: summary.active_jockeys.map(normalizeDataEntitySummary),
        active_trainers: summary.active_trainers.map(normalizeDataEntitySummary),
    };
}

export async function getDataEntityDirectory(
    entityType: Exclude<DataEntityType, 'grade'>,
    options: { limit?: number; offset?: number; indexableOnly?: boolean } = {},
): Promise<DataEntityDirectory | null> {
    const params = new URLSearchParams({
        limit: String(Math.max(1, Math.min(options.limit ?? 24, 100))),
        offset: String(Math.max(0, options.offset ?? 0)),
        indexable_only: String(options.indexableOnly ?? false),
    });
    const directory = await getDataApiJson<DataEntityDirectory>(
        `/directories/${entityType}?${params.toString()}`,
        { revalidate: 3600 },
    );
    if (!directory) return null;
    return {
        ...directory,
        items: directory.items.map(normalizeDataEntitySummary),
    };
}

export async function getCompleteCourseDirectory(
    options: { indexableOnly?: boolean; maximumItems?: number } = {},
): Promise<DataEntityDirectory | null> {
    const pageSize = 100;
    const maximumItems = Math.max(pageSize, Math.min(options.maximumItems ?? 500, 500));
    const firstPage = await getDataEntityDirectory('course', {
        limit: pageSize,
        offset: 0,
        indexableOnly: options.indexableOnly,
    });
    if (!firstPage) return null;

    const cappedTotal = Math.min(firstPage.total, maximumItems);
    const remainingOffsets: number[] = [];
    for (let offset = pageSize; offset < cappedTotal; offset += pageSize) {
        remainingOffsets.push(offset);
    }
    const remainingPages = await Promise.all(
        remainingOffsets.map((offset) => getDataEntityDirectory('course', {
            limit: pageSize,
            offset,
            indexableOnly: options.indexableOnly,
        })),
    );
    const seen = new Set<string>();
    const items = [firstPage, ...remainingPages.filter((page) => page !== null)]
        .flatMap((page) => page?.items ?? [])
        .filter((item) => {
            if (seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });

    return {
        ...firstPage,
        limit: maximumItems,
        items,
    };
}

export async function searchDataEntities(
    query: string,
    limit: number = 20,
): Promise<DataSearchResponse | null> {
    const normalized = query.trim();
    if (!normalized) return { query: '', total: 0, items: [] };
    const params = new URLSearchParams({
        q: normalized,
        limit: String(Math.max(1, Math.min(limit, 40))),
    });
    const result = await getDataApiJson<DataSearchResponse>(
        `/search?${params.toString()}`,
        { cache: 'no-store' },
    );
    if (!result) return null;
    return {
        ...result,
        items: result.items.map(normalizeDataSearchResult),
    };
}

export async function getDataEntityDetail(
    entityType: 'horse' | 'jockey' | 'trainer',
    entityId: string,
): Promise<DataEntityDetail | null> {
    const paths = {
        horse: 'horses',
        jockey: 'jockeys',
        trainer: 'trainers',
    };
    const detail = await getDataApiJson<DataEntityDetail>(
        `/${paths[entityType]}/${encodeURIComponent(entityId)}`,
        { revalidate: 3600 },
    );
    if (!detail) return null;
    return {
        ...detail,
        entity: normalizeDataEntitySummary(detail.entity),
    };
}

export async function getCourseDataDetail(
    venueSlug: string,
    courseSlug: string,
): Promise<CourseDataDetail | null> {
    const detail = await getDataApiJson<CourseDataDetail>(
        `/courses/${encodeURIComponent(venueSlug)}/${encodeURIComponent(courseSlug)}`,
        { revalidate: 21600 },
    );
    if (!detail) return null;
    return {
        ...detail,
        entity: normalizeDataEntitySummary(detail.entity),
        top_trainers: detail.top_trainers.map((item) => ({
            ...item,
            label: splitPersonDisplayName(item.label, 'trainer').name,
        })),
    };
}

export async function getRaceSeriesData(name: string): Promise<RaceSeriesData | null> {
    if (!name.trim()) return null;
    return getDataApiJson<RaceSeriesData>(
        `/race-series?name=${encodeURIComponent(name.trim())}`,
        { revalidate: 21600 },
    );
}

export async function getRaceDataFeatures(raceId: string): Promise<RaceDataFeatures | null> {
    if (!raceId.trim()) return null;
    return getDataApiJson<RaceDataFeatures>(
        `/races/${encodeURIComponent(raceId)}/features`,
        { revalidate: 3600 },
    );
}

export async function compareHorseData(
    payload: HorseComparisonRequest,
): Promise<HorseComparisonResponse | null> {
    try {
        const response = await fetchWithRetry(
            `${API_BASE_URL}/api/v1/data/compare/horses`,
            {
                method: 'POST',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            },
        );
        if (!response.ok) {
            if (response.status !== 404) {
                console.warn(`[compareHorseData] returned ${response.status}`);
            }
            return null;
        }
        return response.json() as Promise<HorseComparisonResponse>;
    } catch (error) {
        console.error('[compareHorseData] failed:', error);
        return null;
    }
}

export async function getDataSitemapEntries(): Promise<DataSitemapEntry[]> {
    return (
        await getDataApiJson<DataSitemapEntry[]>('/sitemap', { revalidate: 21600 })
    ) ?? [];
}
