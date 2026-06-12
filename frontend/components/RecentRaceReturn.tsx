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

    const sectionClass = `card min-h-0 overflow-hidden border-slate-200 bg-white ${className}`;

    if (!recentRace) {
        return (
            <section className={sectionClass}>
                <div className="flex items-center gap-2 p-2 sm:p-2.5">
                    <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-[10px] font-bold leading-none text-secondary">本日のレース分析</p>
                        <div className="min-w-0">
                            <div className="truncate text-xs font-bold leading-tight text-slate-900 sm:text-sm">
                                予測データを確認
                            </div>
                            <p className="truncate text-[10px] leading-tight text-slate-500 sm:text-xs">
                                AI偏差値、枠順傾向、展開予測
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/races/today"
                        className="recent-return-primary shrink-0"
                    >
                        今日へ
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className={sectionClass}>
            <div className="flex items-center gap-2 p-2 sm:p-2.5">
                <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-[10px] font-bold leading-none text-secondary">前回見ていたレース</p>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-bold leading-tight text-slate-900 sm:text-sm">
                            {formatRaceDate(recentRace.date)} {recentRace.venueName} {recentRace.raceNumber}R
                            <span className="hidden sm:inline text-xs font-normal text-slate-500 ml-1"> {recentRace.raceName}</span>
                        </div>
                        {recentRace.courseLabel && (
                            <span className="block truncate text-[10px] font-medium leading-tight text-slate-500 sm:text-xs">
                                ({recentRace.courseLabel})
                            </span>
                        )}
                    </div>
                </div>
                <Link
                    href={recentRace.href}
                    className="recent-return-primary shrink-0"
                >
                    続きから
                </Link>
                <Link
                    href="/races/today"
                    className="hidden sm:inline-flex sm:flex-none items-center justify-center px-3 py-1.5 min-h-[36px] text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                    今日へ
                </Link>
            </div>
        </section>
    );
}
