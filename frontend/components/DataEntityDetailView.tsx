import Link from 'next/link';
import { DataDirectoryNav } from '@/components/DataDirectoryNav';
import { DataEntityTracker } from '@/components/DataEntityTracker';
import { DataFavoriteButton } from '@/components/DataFavoriteButton';
import { LineIcon, type LineIconName } from '@/components/LineIcon';
import { HorseCompareButton } from '@/components/HorseCompareButton';
import { RateSummaryStrip, RecentRunsTable, SegmentStatsTable } from '@/components/DataStats';
import { FinishBadge } from '@/components/RaceParts';
import { DataUpcomingRaces } from '@/components/DataUpcomingRaces';
import type { DataEntityDetail } from '@/lib/types';


const entityLabels = {
    horse: '競走馬',
    jockey: '騎手',
    trainer: '調教師',
} as const;

const entityIcons: Record<keyof typeof entityLabels, LineIconName> = {
    horse: 'race',
    jockey: 'user',
    trainer: 'user',
};

const JST_DATE = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' });
const formatLastRace = (value: string | null) => {
    if (!value) return '確認できません';
    const date = new Date(`${value.slice(0, 10)}T00:00:00+09:00`);
    return Number.isNaN(date.getTime()) ? value : JST_DATE.format(date);
};

export function DataEntityDetailView({
    detail,
    entityType,
}: {
    detail: DataEntityDetail;
    entityType: keyof typeof entityLabels;
}) {
    const entity = detail.entity;
    const pageUrl = entity.url;
    return (
        <article className="site-shell-data px-3.5 pb-14 pt-3 sm:px-5">
            <DataDirectoryNav current={entityType} />

            <DataEntityTracker
                entityType={entityType}
                entityId={entity.id}
                name={entity.name}
                subtitle={entity.subtitle}
                url={pageUrl}
                sampleSize={entity.sample_size}
                indexable={entity.indexable}
            />
            <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy/10 sm:h-[72px] sm:w-[72px]" aria-hidden="true">
                        <LineIcon name={entityIcons[entityType]} size={30} className="block h-7 w-7 text-navy sm:h-9 sm:w-9" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-[13px] font-bold text-slate-500">{entityLabels[entityType]}データ</p>
                        <h1 className="flex flex-wrap items-center gap-2 font-display text-[26px] font-extrabold leading-tight text-slate-900 sm:text-[34px]">
                            <span className="[overflow-wrap:anywhere]">{entity.name}</span>
                            {entity.affiliation && (
                                <span className="rounded-[6px] bg-white px-2 py-0.5 font-sans text-[12.5px] font-bold text-slate-700 ring-1 ring-inset ring-slate-300 sm:text-[13.5px]">
                                    {entity.affiliation}所属
                                </span>
                            )}
                        </h1>
                        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-slate-500 sm:text-[13px]">
                            <span>集計対象 <span className="font-num font-semibold">{entity.sample_size.toLocaleString('ja-JP')}</span>走</span>
                            <span>最終出走 {formatLastRace(entity.last_race_date)}</span>
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
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
            </header>
            <p className="mt-3 max-w-3xl text-[14px] leading-[1.75] text-slate-700 sm:text-[15px]">
                コース・距離・馬場状態・人気別の成績を、対象の出走数とあわせて集計しています。
            </p>

            <div className="mt-5">
                <RateSummaryStrip summary={detail.overall} label={`${entity.name}の全集計成績`} />
            </div>

            {detail.upcoming_races.length > 0 && (
                <DataUpcomingRaces races={detail.upcoming_races} entityType={entityType} />
            )}

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <SegmentStatsTable
                    title="コース別"
                    description="競馬場・コース種別・距離を組み合わせた成績です。タップでコース詳細へ。"
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
                <section className="mt-6 overflow-hidden rounded-[14px] bg-white ring-1 ring-inset ring-slate-200" aria-labelledby="entity-prediction-history-heading">
                    <div className="px-4 pb-2 pt-4 sm:px-5">
                        <h2 id="entity-prediction-history-heading" className="font-display text-[17px] font-extrabold text-slate-900 sm:text-[19px]">AI偏差値の履歴</h2>
                        <p className="mt-1 text-[13px] leading-[1.6] text-slate-600">
                            UMA-FREEでAI偏差値を公開したレースの数値と着順です。
                        </p>
                    </div>
                    <div className="divide-y divide-slate-200 border-t border-slate-200">
                        {detail.prediction_history.map((item) => {
                            const rowClassName =
                                'grid min-h-14 grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-slate-50 sm:px-5';
                            const body = (
                                <>
                                    <span className="min-w-0">
                                        <span className="block text-[12.5px] font-semibold text-slate-500">
                                            {item.race_date} {item.venue_name}{item.race_number}R
                                        </span>
                                        <span className="block truncate text-[14.5px] font-bold text-slate-900">{item.race_name}</span>
                                    </span>
                                    <span className="whitespace-nowrap text-right text-[12px] font-bold text-slate-500">
                                        AI偏差値
                                        <span className="ml-1.5 font-num text-[18px] tabular-nums text-ai-deep">
                                            {item.deviation_score == null ? '—' : item.deviation_score.toFixed(1)}
                                        </span>
                                    </span>
                                    <span className="flex w-10 justify-end">
                                        <FinishBadge rank={item.rank} size={28} />
                                    </span>
                                </>
                            );

                            // レースページを提供していない期間はリンクにしない。
                            if (!item.url) {
                                return (
                                    <div key={item.race_id} className={rowClassName}>
                                        {body}
                                    </div>
                                );
                            }

                            return (
                                <Link
                                    key={item.race_id}
                                    prefetch={false}
                                    href={item.url}
                                    rel="nofollow"
                                    className={rowClassName}
                                >
                                    {body}
                                </Link>
                            );
                        })}
                    </div>
                </section>
            )}
        </article>
    );
}
