'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
    LAST_RACE_STORAGE_KEY,
    RACE_MEMORY_MAX_AGE_MS,
    StoredRaceView,
} from '@/lib/race-memory';

type RecentRaceReturnProps = {
    className?: string;
};

const formatRaceDate = (date: string) => {
    const [, month, day] = date.split('-');
    if (!month || !day) return date;
    return `${Number(month)}/${Number(day)}`;
};

const isStoredRaceView = (value: unknown): value is StoredRaceView => {
    if (!value || typeof value !== 'object') return false;
    const race = value as Partial<StoredRaceView>;
    return (
        typeof race.href === 'string' &&
        race.href.startsWith('/races/') &&
        typeof race.date === 'string' &&
        typeof race.venueName === 'string' &&
        typeof race.raceNumber === 'number' &&
        typeof race.raceName === 'string' &&
        typeof race.viewedAt === 'number'
    );
};

export function RecentRaceReturn({ className = '' }: RecentRaceReturnProps) {
    const [recentRace, setRecentRace] = useState<StoredRaceView | null>(null);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(LAST_RACE_STORAGE_KEY);
            if (!raw) {
                setRecentRace(null);
                return;
            }

            const parsed = JSON.parse(raw);
            if (!isStoredRaceView(parsed)) {
                window.localStorage.removeItem(LAST_RACE_STORAGE_KEY);
                setRecentRace(null);
                return;
            }

            if (Date.now() - parsed.viewedAt > RACE_MEMORY_MAX_AGE_MS) {
                window.localStorage.removeItem(LAST_RACE_STORAGE_KEY);
                setRecentRace(null);
                return;
            }

            const currentHref = `${window.location.pathname}${window.location.search}`;
            setRecentRace(parsed.href === currentHref ? null : parsed);
        } catch {
            setRecentRace(null);
        }
    }, []);

    if (!recentRace) return null;

    return (
        <section className={`card border-slate-200 bg-white overflow-hidden ${className}`}>
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-secondary mb-1">前回見ていたレース</p>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {formatRaceDate(recentRace.date)} {recentRace.venueName} {recentRace.raceNumber}R
                        <span className="hidden sm:inline"> {recentRace.raceName}</span>
                    </h2>
                    {recentRace.courseLabel && (
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                            {recentRace.courseLabel}
                        </p>
                    )}
                </div>
                <div className="flex gap-2 sm:shrink-0">
                    <Link
                        href={recentRace.href}
                        className="btn-primary flex-1 sm:flex-none justify-center text-xs sm:text-sm px-4 py-2.5 min-h-[40px]"
                    >
                        続きから見る
                    </Link>
                    <Link
                        href="/races/today"
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 min-h-[40px] text-xs sm:text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                        今日へ
                    </Link>
                </div>
            </div>
        </section>
    );
}
