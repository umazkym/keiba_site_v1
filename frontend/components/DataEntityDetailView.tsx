import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { DataEntityTracker } from '@/components/DataEntityTracker';
import { DataFavoriteButton } from '@/components/DataFavoriteButton';
import { HorseCompareButton } from '@/components/HorseCompareButton';
import { RateSummaryStrip, RecentRunsTable, SegmentStatsTable } from '@/components/DataStats';
import type { DataEntityDetail } from '@/lib/types';


const entityLabels = {
    horse: '競走馬',
    jockey: '騎手',
    trainer: '調教師',
} as const;

export function DataEntityDetailView({
    detail,
    entityType,
}: {
    detail: DataEntityDetail;
    entityType: keyof typeof entityLabels;
}) {
    const entity = detail.entity;
    const pageUrl = entity.url;
    const buildCalendarUrl = (race: DataEntityDetail['upcoming_races'][number]) => {
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
    return (
        <article className="mx-auto max-w-6xl px-3 pb-14 pt-4 sm:px-4">
            <DataEntityTracker
                entityType={entityType}
                entityId={entity.id}
                name={entity.name}
                subtitle={entity.subtitle}
                url={pageUrl}
                sampleSize={entity.sample_size}
                indexable={entity.indexable}
            />
            <header className="border-b border-slate-200 pb-5">
                <p className="text-xs font-bold text-slate-500">
                    {entityLabels[entityType]}データ
                </p>
                <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                            {entity.name}
                        </h1>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                            過去のレース結果を条件別に再集計しています。母数と更新日を合わせて確認してください。
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <DataFavoriteButton
                            entityType={entityType}
                            entityId={entity.id}
                            name={entity.name}
                            subtitle={entity.subtitle}
                            url={pageUrl}
                        />
                        {entityType === 'horse' && (
                            <HorseCompareButton
                                horseId={entity.id}
                                horseName={entity.name}
                                url={pageUrl}
                            />
                        )}
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                    <span>集計対象 {entity.sample_size.toLocaleString('ja-JP')}走</span>
                    <span>最終出走 {entity.last_race_date ?? '確認できません'}</span>
                    <span>{entity.indexable ? '公開基準を満たすデータ' : '母数または直近活動を確認中'}</span>
                </div>
            </header>

            <div className="mt-5">
                <RateSummaryStrip summary={detail.overall} label={`${entity.name}の集計成績`} />
            </div>

            {detail.upcoming_races.length > 0 && (
                <section className="mt-6 overflow-hidden rounded-xl border border-blue-200 bg-blue-50">
                    <div className="flex items-center gap-2 border-b border-blue-200 px-4 py-3">
                        <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
                        <h2 className="font-black text-slate-950">直近の出走データ</h2>
                    </div>
                    <div className="divide-y divide-blue-100 bg-white">
                        {detail.upcoming_races.map((race) => (
                            <div
                                key={`${race.race_id}-${race.horse_id ?? ''}`}
                                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-blue-50"
                            >
                                <Link prefetch={false} href={race.url} className="min-w-0 flex-1">
                                    <span className="block text-xs font-bold text-slate-500">
                                        {race.race_date} {race.venue_name}{race.race_number}R
                                    </span>
                                    <span className="mt-0.5 block font-bold text-slate-900">{race.race_name}</span>
                                </Link>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="hidden text-right text-xs font-bold text-slate-600 sm:block">
                                        {race.deviation_score == null ? race.course_label : `AI偏差値 ${race.deviation_score.toFixed(1)}`}
                                    </span>
                                    <a
                                        href={buildCalendarUrl(race)}
                                        download={`${race.race_date}-${race.race_id}.ics`}
                                        className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-primary transition-colors duration-150 hover:bg-blue-50"
                                    >
                                        予定に追加
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <SegmentStatsTable
                    title="コース別"
                    description="競馬場・コース種別・距離を組み合わせた成績です。"
                    items={detail.segments.courses ?? []}
                    linkPrefix="/courses/"
                />
                <SegmentStatsTable
                    title="距離別"
                    description="距離ごとの出走結果を比較します。"
                    items={detail.segments.distances ?? []}
                />
                <SegmentStatsTable
                    title="馬場状態別"
                    description="良・稍重・重・不良などの馬場状態別集計です。"
                    items={detail.segments.grounds ?? []}
                />
                <SegmentStatsTable
                    title="人気別"
                    description="当時の人気帯と結果を並べています。"
                    items={detail.segments.popularities ?? []}
                />
            </div>

            <div className="mt-6">
                <RecentRunsTable
                    title={entityType === 'horse' ? '近走成績' : '最近の騎乗・管理成績'}
                    runs={detail.recent_runs}
                    showHorse={entityType !== 'horse'}
                />
            </div>

            {entityType === 'horse' && detail.prediction_history.length > 0 && (
                <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                        <h2 className="text-lg font-black text-slate-950">AI偏差値の履歴</h2>
                        <p className="mt-1 text-xs leading-6 text-slate-600">
                            過去に予測を公開したレースだけを表示します。
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {detail.prediction_history.map((item) => (
                            <Link
                                key={item.race_id}
                                prefetch={false}
                                href={item.url}
                                className="grid min-h-14 grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-slate-50"
                            >
                                <span className="min-w-0">
                                    <span className="block text-xs font-bold text-slate-500">
                                        {item.race_date} {item.venue_name}{item.race_number}R
                                    </span>
                                    <span className="block truncate font-bold text-slate-800">{item.race_name}</span>
                                </span>
                                <span className="font-mono text-sm font-black tabular-nums text-amber-700">
                                    {item.deviation_score == null ? '—' : item.deviation_score.toFixed(1)}
                                </span>
                                <span className="w-8 text-right font-mono text-sm font-bold text-slate-600">
                                    {item.rank == null ? '—' : `${item.rank}着`}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}
