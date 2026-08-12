import { getDaysFromToday, isValidRaceDate } from '@/lib/race-url';


export const RECENT_RACE_REVALIDATE_SECONDS = 300;
export const HISTORICAL_RACE_REVALIDATE_SECONDS = 86400;
export const ARCHIVE_RACE_REVALIDATE_SECONDS = 2592000;

export type RaceCacheTier = 'recent' | 'historical' | 'archive';

export interface RaceCachePolicy {
    tier: RaceCacheTier;
    revalidateSeconds: number;
    cacheControl: string;
}

export function getRaceCachePolicy(date: string): RaceCachePolicy {
    if (!isValidRaceDate(date)) {
        return {
            tier: 'recent',
            revalidateSeconds: RECENT_RACE_REVALIDATE_SECONDS,
            cacheControl: 'private, no-store',
        };
    }

    const daysFromToday = getDaysFromToday(date);
    if (daysFromToday <= -15) {
        return {
            tier: 'archive',
            revalidateSeconds: ARCHIVE_RACE_REVALIDATE_SECONDS,
            cacheControl: 'public, max-age=0, s-maxage=2592000, stale-while-revalidate=7776000, stale-if-error=7776000',
        };
    }
    if (daysFromToday <= -2) {
        return {
            tier: 'historical',
            revalidateSeconds: HISTORICAL_RACE_REVALIDATE_SECONDS,
            cacheControl: 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800',
        };
    }
    return {
        tier: 'recent',
        revalidateSeconds: RECENT_RACE_REVALIDATE_SECONDS,
        cacheControl: 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600, stale-if-error=3600',
    };
}

export function isArchiveRaceDate(date: string): boolean {
    return getRaceCachePolicy(date).tier === 'archive';
}
