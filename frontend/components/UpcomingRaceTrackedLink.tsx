'use client';

import Link from 'next/link';
import { sendUpcomingRaceClickEvent } from '@/lib/analytics';


function jstDateString(date: Date): string {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function relativeDateBucket(raceDate: string): 'today' | 'tomorrow' | 'later' {
    const today = jstDateString(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = jstDateString(tomorrowDate);
    if (raceDate === today) return 'today';
    if (raceDate === tomorrow) return 'tomorrow';
    return 'later';
}

export function UpcomingRaceTrackedLink({
    href,
    raceDate,
    venueName,
    raceNumber,
    raceName,
    entityType,
    raceId,
}: {
    href: string;
    raceDate: string;
    venueName: string;
    raceNumber: number;
    raceName: string;
    entityType: 'horse' | 'jockey' | 'trainer';
    raceId: string;
}) {
    return (
        <Link
            prefetch={false}
            href={href}
            onClick={() => {
                sendUpcomingRaceClickEvent({
                    entity_type: entityType,
                    relative_date_bucket: relativeDateBucket(raceDate),
                    link_placement: 'entity_detail',
                    target_race_id: raceId,
                });
            }}
            className="min-w-0 flex-1"
        >
            <span className="block text-xs font-bold text-slate-500">
                {raceDate} {venueName}{raceNumber}R
            </span>
            <span className="mt-0.5 block font-black text-slate-900 hover:text-blue-600">{raceName}</span>
        </Link>
    );
}
