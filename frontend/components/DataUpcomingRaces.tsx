'use client';

// 競走馬・騎手・調教師の「出走予定」。
// API は「結果が未登録のレース」を返すため、結果の取り込み前（朝7時ごろまで）は前日のレースも含まれる。
// さらにページは1日キャッシュされるため、表示する時点の日本の日付より前のレースはここで外す（2026-09-25）。
// サーバーの描画と食い違わないよう、最初は全件を描き、読み込み後に日付で絞る。
import { useEffect, useState } from 'react';
import { GuideHorse } from '@/components/BrandLogo';
import { LineIcon } from '@/components/LineIcon';
import { SectionHeader } from '@/components/SectionHeader';
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

// 見出し：騎手は見本の「今日の騎乗」に合わせるが、API は翌日以降の予定も返すため「騎乗予定」とする（2026-09-25）
const HEADINGS = {
    horse: '出走予定',
    jockey: '騎乗予定',
    trainer: '管理馬の出走予定',
} as const;

const EMPTY_TITLES = {
    horse: '出走予定はまだありません',
    jockey: '騎乗予定はまだありません',
    trainer: '管理馬の出走予定はまだありません',
} as const;

export function DataUpcomingRaces({
    races,
    entityType,
    className = '',
}: {
    races: DataUpcomingRace[];
    entityType: 'horse' | 'jockey' | 'trainer';
    className?: string;
}) {
    const [today, setToday] = useState<string | null>(null);
    useEffect(() => {
        setToday(getJstTodayString());
    }, []);

    const visibleRaces = today ? races.filter((race) => race.race_date.slice(0, 10) >= today) : races;
    const headingId = `entity-upcoming-heading-${entityType}`;

    // 予定が無いとき：騎手・調教師は見本の空の状態（眠る馬と1行）を出す。競走馬は引退馬が多いので出さない
    if (visibleRaces.length === 0) {
        if (entityType === 'horse') return null;
        return (
            <section className={`rounded-[14px] border border-slate-200 bg-white px-4 py-3.5 sm:px-5 sm:py-4 ${className}`.trim()} aria-labelledby={headingId}>
                <SectionHeader id={headingId} title={HEADINGS[entityType]} />
                <div className="mt-2 flex items-center gap-3">
                    <GuideHorse size={44} mood="sleep" className="block h-11 w-11 shrink-0" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="text-[14.5px] font-bold text-slate-900">{EMPTY_TITLES[entityType]}</p>
                        <p className="text-[12.5px] leading-5 text-slate-500">出馬表が確定すると、ここにレースが出ます。</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className={`overflow-hidden rounded-[14px] border border-slate-200 bg-white ${className}`.trim()} aria-labelledby={headingId}>
            <SectionHeader id={headingId} title={HEADINGS[entityType]} className="mx-4 pt-3.5 sm:mx-5 sm:pt-4" />
            <div className="mt-1 divide-y divide-slate-200 sm:mt-2">
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
