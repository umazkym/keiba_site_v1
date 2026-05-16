export const LAST_RACE_STORAGE_KEY = 'uma-free:last-race';

export const RACE_MEMORY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type StoredRaceView = {
    href: string;
    date: string;
    venueName: string;
    raceNumber: number;
    raceName: string;
    courseLabel?: string;
    viewedAt: number;
};
