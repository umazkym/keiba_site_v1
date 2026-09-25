'use client';

// 競走馬・騎手・調教師の「出走予定」。
// API は「結果が未登録のレース」を返すため、結果の取り込み前（朝7時ごろまで）は前日のレースも含まれる。
// さらにページは1日キャッシュされるため、表示する時点の日本の日付より前のレースはここで外す（2026-09-25）。
// サーバーの描画と食い違わないよう、最初は全件を描き、読み込み後に日付で絞る。
import { useEffect, useState } from 'react';
import { LineIcon } from '@/components/LineIcon';
import { UpcomingRaceTrackedLink } from '@/components/UpcomingRaceTrackedLink';
import { getJstTodayString } from '@/lib/race-url';
import type { DataUpcomingRace } from '@/lib/types';

const buildCalendarUrl = (race: DataUpcomingRace) => {
    const compactDate = race.race_date.replace(/-/g, '');
    const content = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//UMA-FREE//Race Reminder//JA',
        'BEGIN:VEVENT',
        `UID:${race.race_id}@uma-free.com`,
        `DTSTART;VALUE=DATE:${compactDate}`,
        `DTEND;VALUE=DATE:${compactDate}`,
        `SUMMARY:${race.venue_name}${race.race_number}R ${race.race_name}`,
        `DESCRIPTION:UMA-FREEで${race.course_label}の分析を確認`,
        `URL:https://uma-free.com${race.url}`,
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
};

export function DataUpcomingRaces({
    races,
    entityType,
}: {
    races: DataUpcomingRace[];
    entityType: 'horse' | 'jockey' | 'trainer';
}) {
    const [today, setToday] = useState<string | null>(null);
    useEffect(() => {
        setToday(getJstTodayString());
    }, []);

    const visibleRaces = today ? races.filter((race) => race.race_date.slice(0, 10) >= today) : races;
    if (visibleRaces.length === 0) return null;

    return (
        <section className="mt-6 overflow-hidden rounded-[14px] bg-white ring-1 ring-inset ring-brand-200" aria-labelledby="entity-upcoming-heading">
            <div className="flex items-center gap-2 border-b border-brand-200 bg-brand-50/70 px-4 py-3 sm:px-5">
                <LineIcon name="calendar" size={20} className="block text-brand-700" />
                <h2 id="entity-upcoming-heading" className="font-display text-[17px] font-extrabold text-slate-900 sm:text-[19px]">出走予定</h2>
            </div>
            <div className="divide-y divide-slate-200">
                {visibleRaces.map((race) => (
                    <div
                        key={`${race.race_id}-${race.horse_id ?? ''}`}
                        className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-brand-50/50 sm:px-5"
                    >
                        <UpcomingRaceTrackedLink
                            href={race.url}
                            raceDate={race.race_date}
                            venueName={race.venue_name}
                            raceNumber={race.race_number}
                            raceName={race.race_name}
                            entityType={entityType}
                            raceId={race.race_id}
                        />
                        <div className="flex shrink-0 items-center gap-3">
                            <span className="hidden text-right text-[13px] font-bold text-slate-600 sm:block">
                                {race.deviation_score == null
                                    ? race.course_label
                                    : <>AI偏差値 <span className="font-num text-[16px] text-ai-deep">{race.deviation_score.toFixed(1)}</span></>}
                            </span>
                            <a
                                href={buildCalendarUrl(race)}
                                download={`${race.race_date}-${race.race_id}.ics`}
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[13.5px] font-bold text-brand-700 ring-1 ring-inset ring-brand-200 transition-colors duration-150 hover:bg-brand-50"
                            >
                                <LineIcon name="calendar" size={16} className="block" />
                                予定に追加
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
