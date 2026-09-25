'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
    LAST_RACE_STORAGE_KEY,
    RACE_MEMORY_MAX_AGE_MS,
    StoredRaceView,
} from '@/lib/race-memory';
import { sendRecentRaceReturnClickEvent } from '@/lib/analytics';
import { RacePlate } from '@/components/RaceParts';
import { LineIcon } from '@/components/LineIcon';

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

    // 見たレースが無いときは何も出さない（今日のレースへの入口はヒーローと固定CTAが持つ）
    if (!recentRace) {
        return null;
    }

    return (
        <Link
            href={recentRace.href}
            prefetch={false}
            onClick={() => sendRecentRaceReturnClickEvent({
                destination_path: recentRace.href,
                race_date: recentRace.date,
                venue_name: recentRace.venueName,
                race_number: recentRace.raceNumber,
                age_hours: Math.max(0, Math.floor((Date.now() - recentRace.viewedAt) / 3_600_000)),
            })}
            className={`flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2 pl-2 pr-3 transition-colors duration-150 hover:border-brand-300 ${className}`}
        >
            <RacePlate venue={recentRace.venueName} raceNumber={recentRace.raceNumber} size="xs" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[11.5px] font-bold text-slate-500">前回の続き · {formatRaceDate(recentRace.date)}</span>
                <span className="truncate text-[14px] font-bold text-slate-900">
                    {recentRace.raceName}の出走表に戻る
                </span>
            </span>
            <LineIcon name="chevR" size={18} className="block shrink-0 text-slate-500" />
        </Link>
    );
}
