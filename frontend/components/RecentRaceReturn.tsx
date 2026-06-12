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
                <div className="flex flex-col gap-1.5 p-2 sm:flex-row sm:items-center sm:p-2.5">
                    <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-[10px] font-bold text-secondary">本日のレース分析</p>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <div className="truncate text-xs sm:text-sm font-bold text-slate-900">
                                予測データを確認
                            </div>
                            <p className="truncate text-[10px] sm:text-xs text-slate-500">
                                AI偏差値、枠順傾向、展開予測
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-1.5 sm:shrink-0">
                        <Link
                            href="/races/today"
                            className="btn-primary flex-1 justify-center px-2.5 py-1 text-[11px] min-h-[30px] sm:flex-none sm:text-xs sm:px-3 sm:py-1.5 sm:min-h-[36px]"
                        >
                            今日の分析へ
                        </Link>
                        <Link
                            href="/articles"
                            className="inline-flex min-h-[30px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 sm:flex-none sm:text-xs sm:px-3 sm:py-1.5 sm:min-h-[36px]"
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
            <div className="p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5">
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-secondary mb-0.5">前回見ていたレース</p>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {formatRaceDate(recentRace.date)} {recentRace.venueName} {recentRace.raceNumber}R
                            <span className="hidden sm:inline text-xs font-normal text-slate-500 ml-1"> {recentRace.raceName}</span>
                        </div>
                        {recentRace.courseLabel && (
                            <span className="text-[10px] sm:text-xs text-slate-500 truncate font-medium">
                                ({recentRace.courseLabel})
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-1.5 sm:shrink-0">
                    <Link
                        href={recentRace.href}
                        className="btn-primary flex-1 sm:flex-none justify-center text-[11px] sm:text-xs px-2.5 py-1 min-h-[30px] sm:min-h-[36px] sm:px-3 sm:py-1.5"
                    >
                        続きから見る
                    </Link>
                    <Link
                        href="/races/today"
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-2.5 py-1 min-h-[30px] sm:min-h-[36px] text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 sm:px-3 sm:py-1.5"
                    >
                        今日へ
                    </Link>
                </div>
            </div>
        </section>
    );
}
