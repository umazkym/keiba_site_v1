import Link from 'next/link';
import { DataEntityTracker } from '@/components/DataEntityTracker';
import { DataFavoriteButton } from '@/components/DataFavoriteButton';
import { DataSegmentTabs } from '@/components/DataSegmentTabs';
import { LineIcon, type LineIconName } from '@/components/LineIcon';
import { HorseCompareButton } from '@/components/HorseCompareButton';
import {
    normalizeGroundStats,
    RateSummaryStrip,
    RecentRunsTable,
    SegmentStatsTable,
    sortByNumberKey,
} from '@/components/DataStats';
import { FinishBadge } from '@/components/RaceParts';
import { DataUpcomingRaces } from '@/components/DataUpcomingRaces';
import type { DataEntityDetail, SegmentStat } from '@/lib/types';

// 競走馬・騎手・調教師の詳細（2026-09-25 スマホの見直し）
// - 見本の構成：見出し → 通算のタイル → 予定 → 条件別の成績 → 最近の成績。データの案内（DataHubNav）は見本に無いので置かない
// - スマホは左右の余白を足さない（外枠の16pxだけ）。まとまりの間は12px（親の gap）。PC は sm: で今までの間隔
// - 条件別の表はスマホだけタブで1枚にまとめる（表は全部 HTML に残す）。PC は今までどおり表ごとのカード

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

// 導入文で名前の後ろに付ける呼び方
const nameSuffixes: Record<keyof typeof entityLabels, string> = {
    horse: '',
    jockey: '騎手',
    trainer: '調教師',
};

const lastRaceLabels: Record<keyof typeof entityLabels, string> = {
    horse: '最終出走',
    jockey: '最終騎乗',
    trainer: '最終出走',
};

const recentTitles: Record<keyof typeof entityLabels, string> = {
    horse: '近走成績',
    jockey: '最近の騎乗',
    trainer: '管理馬の最近の成績',
};

// 条件別の表に出す最小の対象数（API の minimum_sample と同じ）
const MINIMUM_SAMPLE = 2;

const JST_DATE = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' });
const formatLastRace = (value: string | null) => {
    if (!value) return '確認できません';
    const date = new Date(`${value.slice(0, 10)}T00:00:00+09:00`);
    return Number.isNaN(date.getTime()) ? value : JST_DATE.format(date);
};

type SegmentTabSpec = {
    key: string;
    label: string;
    title: string;
    firstLabel: string;
    items: SegmentStat[];
    linkPrefix?: string;
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
    const isHorse = entityType === 'horse';

    const segmentTabs: SegmentTabSpec[] = [
        { key: 'courses', label: 'コース', title: 'コース別', firstLabel: 'コース', items: detail.segments.courses ?? [], linkPrefix: '/courses/' },
        { key: 'distances', label: '距離', title: '距離別', firstLabel: '距離', items: sortByNumberKey(detail.segments.distances ?? []) },
        { key: 'grounds', label: '馬場', title: '馬場状態別', firstLabel: '馬場', items: normalizeGroundStats(detail.segments.grounds ?? []) },
        { key: 'popularities', label: '人気', title: '人気別', firstLabel: '人気', items: sortByNumberKey(detail.segments.popularities ?? []) },
    ].filter((tab) => tab.items.length > 0);

    const favoriteButton = (
        <DataFavoriteButton
            entityType={entityType}
            entityId={entity.id}
            name={entity.name}
            subtitle={entity.subtitle}
            url={pageUrl}
            headPlacement={!isHorse}
        />
    );

    return (
        <article className="site-shell-data flex flex-col gap-3 pb-2 pt-1.5 sm:block sm:px-5 sm:pb-14 sm:pt-3">
            <DataEntityTracker
                entityType={entityType}
                entityId={entity.id}
                name={entity.name}
                subtitle={entity.subtitle}
                url={pageUrl}
                sampleSize={entity.sample_size}
                indexable={entity.indexable}
            />
            {/* 保存はスマホでは名前の右上に小さく置き、行を増やさない（競走馬は比較のボタンもあるので下に並べる） */}
            <header
                className={isHorse
                    ? 'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4'
                    : 'relative flex items-center gap-4 sm:items-end sm:justify-between'}
            >
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy/10 sm:h-[72px] sm:w-[72px]" aria-hidden="true">
                        <LineIcon name={entityIcons[entityType]} size={30} className="block h-7 w-7 text-navy sm:h-9 sm:w-9" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className={`text-[13px] font-bold text-slate-500 ${isHorse ? '' : 'pr-20 sm:pr-0'}`}>{entityLabels[entityType]}データ</p>
                        <h1 className="flex flex-wrap items-center gap-2 font-display text-[26px] font-bold leading-tight text-slate-900 sm:text-[34px]">
                            <span className="[overflow-wrap:anywhere]">{entity.name}</span>
                            {entity.affiliation && (
                                <span className="rounded-[6px] bg-white px-2 py-0.5 font-sans text-[12.5px] font-bold text-slate-700 ring-1 ring-inset ring-slate-300 sm:text-[13.5px]">
                                    {entity.affiliation}所属
                                </span>
                            )}
                        </h1>
                        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-slate-500 sm:text-[13px]">
                            <span className="whitespace-nowrap">集計対象 <span className="font-num font-semibold">{entity.sample_size.toLocaleString('ja-JP')}</span>走</span>
                            <span className="whitespace-nowrap">{lastRaceLabels[entityType]} {formatLastRace(entity.last_race_date)}</span>
                        </p>
                    </div>
                </div>
                {isHorse ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                        {favoriteButton}
                        <HorseCompareButton
                            horseId={entity.id}
                            horseName={entity.name}
                            url={pageUrl}
                        />
                    </div>
                ) : (
                    <div className="absolute -top-1 right-0 sm:static sm:shrink-0">
                        {favoriteButton}
                    </div>
                )}
            </header>
            {/* ページの導入文（検索・審査のため1文だけ残す） */}
            <p className="max-w-3xl text-[14px] leading-[1.75] text-slate-700 sm:mt-3 sm:text-[15px]">
                {entity.name}{nameSuffixes[entityType]}のコース・距離・馬場・人気別の成績です。
            </p>

            <div className="sm:mt-5">
                <RateSummaryStrip summary={detail.overall} label={`${entity.name}の全集計成績`} />
            </div>

            <DataUpcomingRaces races={detail.upcoming_races} entityType={entityType} className="sm:mt-6" />

            <DataSegmentTabs
                title="条件別の成績"
                className="sm:mt-6"
                note={`対象${MINIMUM_SAMPLE}走以上の条件だけを表示しています。`}
                tabs={segmentTabs.map((tab) => ({
                    key: tab.key,
                    label: tab.label,
                    panel: (
                        <SegmentStatsTable
                            inTabs
                            headingId={`entity-segment-${tab.key}-heading`}
                            title={tab.title}
                            firstLabel={tab.firstLabel}
                            items={tab.items}
                            linkPrefix={tab.linkPrefix}
                        />
                    ),
                }))}
            />

            <RecentRunsTable
                className="sm:mt-6"
                title={recentTitles[entityType]}
                runs={detail.recent_runs}
                showHorse={!isHorse}
            />

            {isHorse && detail.prediction_history.length > 0 && (
                <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white sm:mt-6" aria-labelledby="entity-prediction-history-heading">
                    <div className="px-4 pb-2 pt-3.5 sm:px-5 sm:pt-4">
                        <h2 id="entity-prediction-history-heading" className="font-display text-[18px] font-bold text-slate-900 sm:text-[19px]">AI偏差値の履歴</h2>
                        <p className="mt-1 text-[13px] leading-[1.6] text-slate-600">
                            UMA-FREEでAI偏差値を公開したレースの数値と着順です。
                        </p>
                    </div>
                    <div className="divide-y divide-slate-200 border-t border-slate-200">
                        {detail.prediction_history.map((item) => {
                            const rowClassName =
                                'grid min-h-12 grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-slate-50 sm:px-5';
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
