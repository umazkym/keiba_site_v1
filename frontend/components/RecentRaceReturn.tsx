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

    const sectionClass = `card min-h-[92px] overflow-hidden border-slate-200 bg-white sm:min-h-[62px] ${className}`;

    if (!recentRace) {
        return (
            <section className={sectionClass}>
                <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:p-3">
                    <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-[11px] font-bold text-secondary">本日のレース分析</p>
                        <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                            中央・地方の予測データを確認
                        </h2>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-xs">
                            AI偏差値、枠順傾向、展開材料を無料で見られます。
                        </p>
                    </div>
                    <div className="flex gap-2 sm:shrink-0">
                        <Link
                            href="/races/today"
                            className="btn-primary flex-1 justify-center px-3 py-2 text-xs min-h-[36px] sm:flex-none sm:text-sm"
                        >
                            今日の分析へ
                        </Link>
                        <Link
                            href="/articles"
                            className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 sm:flex-none sm:text-sm"
                        >
                            記事を読む
                        </Link>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className={sectionClass}>
            <div className="p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-secondary mb-0.5">前回見ていたレース</p>
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
                        className="btn-primary flex-1 sm:flex-none justify-center text-xs sm:text-sm px-3 py-2 min-h-[36px]"
                    >
                        続きから見る
                    </Link>
                    <Link
                        href="/races/today"
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 min-h-[36px] text-xs sm:text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                        今日へ
                    </Link>
                </div>
            </div>
        </section>
    );
}
