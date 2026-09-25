import Link from 'next/link';
import { DataEntityTracker } from '@/components/DataEntityTracker';
import { DataFavoriteButton } from '@/components/DataFavoriteButton';
import { DataSegmentTabs, type DataSegmentTab } from '@/components/DataSegmentTabs';
import { CourseGlyph } from '@/components/CourseGlyph';
import { LineIcon } from '@/components/LineIcon';
import { SectionHeader } from '@/components/SectionHeader';
import { getWakuClasses } from '@/lib/waku';
import {
    normalizeGroundStats,
    RecentRunsTable,
    SegmentStatsTable,
    sortByNumberKey,
    StatTiles,
    type StatTileItem,
} from '@/components/DataStats';
import type { CourseDataDetail, PayoutStat, SegmentStat } from '@/lib/types';

// コースの詳細（2026-09-25 スマホの見直し）
// - 見本の構成：見出し → タイル → 枠番別の3着以内率の棒（主役）→ 条件別の成績 → 成績の良い騎手・調教師 → 最近の勝ち馬 → ボタン
// - 条件別（枠番・馬番・馬場・位置取り・人気・払戻）と騎手・調教師は、スマホだけタブで1枚にまとめる（表は全部 HTML に残す）
// - スマホは左右の余白を足さない（外枠の16pxだけ）。まとまりの間は12px。PC は sm: で今までの間隔
// - 表の上下の説明文（対象〇走以上・並び順・位置取りの区分）は置かない（2026-09-26 利用者の指定）

// 券種の並び（API は対象の数の順で返すため、複勝→ワイド→3連単…と並んでいた）
const BET_TYPE_LABELS: Record<string, string> = {
    tansho: '単勝',
    fukusho: '複勝',
    wakuren: '枠連',
    umaren: '馬連',
    wide: 'ワイド',
    umatan: '馬単',
    sanrenpuku: '3連複',
    sanrentan: '3連単',
};
const BET_TYPE_ORDER = Object.keys(BET_TYPE_LABELS);
const betTypeIndex = (betType: string) => {
    const index = BET_TYPE_ORDER.indexOf(betType);
    return index === -1 ? BET_TYPE_ORDER.length : index;
};

const isWakuItem = (item: SegmentStat) => Number.isInteger(Number(item.key)) && Number(item.key) >= 1 && Number(item.key) <= 8;

const pickBest = (items: SegmentStat[], value: (item: SegmentStat) => number) => items.reduce<SegmentStat | null>(
    (best, item) => (best == null || value(item) > value(best) ? item : best),
    null,
);

// 枠番別の3着以内率の棒（ポートフォリオの「枠番別の複勝率」）。最も高い枠はインディゴ、棒の下に枠色の番号と頭数。
function WakuPlaceRateBars({ items }: { items: SegmentStat[] }) {
    const waku = items.filter(isWakuItem).sort((a, b) => Number(a.key) - Number(b.key));
    if (waku.length < 4) return null;
    const max = Math.max(...waku.map((item) => item.place_rate));
    if (!(max > 0)) return null;
    return (
        <section className="rounded-[14px] border border-slate-200 bg-white px-4 py-3.5 sm:p-5" aria-labelledby="course-waku-bars-heading">
            <SectionHeader id="course-waku-bars-heading" title="枠番別の3着以内率" />
            <div className="mt-2 flex h-[150px] items-end gap-1.5 sm:h-[200px] sm:gap-3">
                {waku.map((item) => {
                    const isBest = item.place_rate === max;
                    const height = Math.max(5, Math.round((item.place_rate / max) * 72));
                    const wakuClass = getWakuClasses(Number(item.key));
                    return (
                        <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                            <div className="flex w-full max-w-[44px] flex-1 flex-col items-center justify-end gap-1">
                                <span className={`font-num text-[13.5px] font-semibold tabular-nums sm:text-[15px] ${isBest ? 'text-brand-700' : 'text-slate-700'}`}>
                                    {item.place_rate.toFixed(1)}
                                </span>
                                <div
                                    className={`w-full rounded-t-[6px] ${isBest ? 'bg-brand-600' : 'bg-brand-200'}`}
                                    style={{ height: `${height}%` }}
                                    aria-hidden="true"
                                />
                            </div>
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-[6px] border-[1.5px] font-num text-[13px] font-bold ${wakuClass}`}>
                                {item.key}
                            </span>
                            {/* 説明文の代わりに単位を付けて「頭数」と分かるようにする */}
                            <span className="whitespace-nowrap font-num text-[11.5px] font-semibold text-slate-500">{item.sample_size}頭</span>
                        </div>
                    );
                })}
            </div>
            <p className="sr-only">
                {waku.map((item) => `${item.key}枠 ${item.place_rate.toFixed(1)}%（${item.sample_size}頭）`).join('、')}
            </p>
        </section>
    );
}

// 配当・払戻。スマホは「券種・平均・最高」の3列で幅に収め、対象の数は券種の横に小さく出す（PC は4列）
function PayoutStatsTable({ stats, inTabs = false }: { stats: PayoutStat[]; inTabs?: boolean }) {
    if (stats.length === 0) return null;
    const sorted = [...stats].sort((a, b) => betTypeIndex(a.bet_type) - betTypeIndex(b.bet_type));
    return (
        <section
            aria-labelledby="course-payout-heading"
            className={inTabs
                ? 'sm:overflow-hidden sm:rounded-[14px] sm:border sm:border-slate-200 sm:bg-white'
                : 'overflow-hidden rounded-[14px] border border-slate-200 bg-white'}
        >
            <SectionHeader
                id="course-payout-heading"
                title="配当・払戻の分布"
                className={inTabs ? 'sr-only sm:not-sr-only sm:mx-5 sm:pt-4' : 'mx-4 pt-3.5 sm:mx-5 sm:pt-4'}
            />
            <div className={`overflow-x-auto ${inTabs ? 'sm:mt-3' : 'mt-2.5 sm:mt-3'}`}>
                <table className="w-full text-[14px] sm:min-w-[460px]">
                    <thead className="bg-slate-50 text-[12.5px] text-slate-500">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-bold">券種</th>
                            <th className="hidden px-3 py-2.5 text-right font-bold sm:table-cell">対象</th>
                            <th className="px-2 py-2.5 text-right font-bold sm:px-3">平均払戻</th>
                            <th className="py-2.5 pl-2 pr-4 text-right font-bold sm:px-4">最高払戻</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {sorted.map((item) => (
                            <tr key={item.bet_type}>
                                <th className="whitespace-nowrap px-4 py-2 text-left font-bold text-slate-900 sm:py-3">
                                    {BET_TYPE_LABELS[item.bet_type] ?? item.bet_type}
                                    <span className="ml-1.5 font-num text-[12px] font-semibold text-slate-500 sm:hidden">
                                        {item.sample_size.toLocaleString('ja-JP')}件
                                    </span>
                                </th>
                                <td className="hidden px-3 py-3 text-right font-num text-[15px] tabular-nums text-slate-600 sm:table-cell">
                                    {item.sample_size.toLocaleString('ja-JP')}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right font-num text-[15.5px] font-semibold tabular-nums text-slate-900 sm:px-3 sm:py-3">
                                    {item.average_payout.toLocaleString('ja-JP')}<span className="font-sans text-[12px]">円</span>
                                </td>
                                <td className="whitespace-nowrap py-2 pl-2 pr-4 text-right font-num text-[15.5px] font-semibold tabular-nums text-ai-deep sm:px-4 sm:py-3">
                                    {item.max_payout.toLocaleString('ja-JP')}<span className="font-sans text-[12px]">円</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// コースのタイル（見本）：集計対象・3着以内率の最も高い枠・勝率の最も高い枠・3連単の平均払戻。
// コース全体の勝率や平均人気は、どのコースでもほぼ同じ値になり読み取れることが無いため出さない。
function buildCourseTiles(detail: CourseDataDetail): StatTileItem[] {
    const waku = (detail.segments.waku ?? []).filter(isWakuItem);
    const bestPlace = pickBest(waku, (item) => item.place_rate);
    const bestWin = pickBest(waku, (item) => item.win_rate);
    const sanrentan = detail.payout_stats.find((item) => item.bet_type === 'sanrentan');
    const tiles: StatTileItem[] = [
        { label: '集計対象', value: detail.overall.sample_size.toLocaleString('ja-JP'), unit: '頭' },
    ];
    if (bestPlace) {
        tiles.push({ label: `${bestPlace.key}枠の3着以内率`, value: bestPlace.place_rate.toFixed(1), unit: '%', note: `${bestPlace.sample_size.toLocaleString('ja-JP')}頭` });
    }
    if (bestWin) {
        tiles.push({ label: `${bestWin.key}枠の勝率`, value: bestWin.win_rate.toFixed(1), unit: '%', note: `${bestWin.sample_size.toLocaleString('ja-JP')}頭` });
    }
    if (sanrentan) {
        tiles.push({ label: '3連単の平均払戻', value: sanrentan.average_payout.toLocaleString('ja-JP'), unit: '円', note: `${sanrentan.sample_size.toLocaleString('ja-JP')}件` });
    }
    // 枠番・払戻のデータが無いときは、コース全体の率で埋める
    if (tiles.length < 3) {
        tiles.push(
            { label: '勝率', value: detail.overall.win_rate.toFixed(1), unit: '%' },
            { label: '3着以内率', value: detail.overall.place_rate.toFixed(1), unit: '%' },
        );
    }
    return tiles;
}

export function CourseDataDetailView({ detail, relatedArticleHref }: { detail: CourseDataDetail; relatedArticleHref: string | null }) {
    const entity = detail.entity;
    // 見本の見出し「中山 芝2200m」（場名とコースの間を空ける）
    const displayName = entity.name.startsWith(detail.venue_name)
        ? `${detail.venue_name} ${entity.name.slice(detail.venue_name.length)}`
        : entity.name;

    const segmentSpecs = [
        { key: 'waku', label: '枠番', title: '枠番別', firstLabel: '枠', items: sortByNumberKey(detail.segments.waku ?? []), labelKind: 'frame' as const },
        { key: 'horse_numbers', label: '馬番', title: '馬番別', firstLabel: '馬番', items: sortByNumberKey(detail.segments.horse_numbers ?? []) },
        { key: 'grounds', label: '馬場', title: '馬場状態別', firstLabel: '馬場', items: normalizeGroundStats(detail.segments.grounds ?? []) },
        { key: 'running_styles', label: '位置取り', title: '位置取り別', firstLabel: '位置取り', items: detail.segments.running_styles ?? [] },
        { key: 'popularities', label: '人気', title: '人気別', firstLabel: '人気', items: sortByNumberKey(detail.segments.popularities ?? []) },
    ].filter((spec) => spec.items.length > 0);

    const conditionTabs: DataSegmentTab[] = segmentSpecs.map((spec) => ({
        key: spec.key,
        label: spec.label,
        panel: (
            <SegmentStatsTable
                inTabs
                headingId={`course-segment-${spec.key}-heading`}
                title={spec.title}
                firstLabel={spec.firstLabel}
                items={spec.items}
                labelKind={spec.labelKind}
            />
        ),
    }));
    if (detail.payout_stats.length > 0) {
        conditionTabs.push({ key: 'payouts', label: '払戻', panel: <PayoutStatsTable stats={detail.payout_stats} inTabs /> });
    }

    const peopleSpecs = [
        { key: 'jockeys', label: '騎手', title: 'このコースで成績の良い騎手', firstLabel: '騎手', items: detail.top_jockeys, linkPrefix: '/jockeys/data/' },
        { key: 'trainers', label: '調教師', title: 'このコースで成績の良い調教師', firstLabel: '調教師', items: detail.top_trainers, linkPrefix: '/trainers/' },
    ].filter((spec) => spec.items.length > 0);

    return (
        <article className="mx-auto flex max-w-6xl flex-col gap-3 pb-2 pt-1.5 sm:block sm:px-5 sm:pb-14 sm:pt-3">
            <DataEntityTracker
                entityType="course"
                entityId={entity.id}
                name={entity.name}
                subtitle={entity.subtitle}
                url={entity.url}
                sampleSize={entity.sample_size}
                indexable={entity.indexable}
            />
            {/* 保存はスマホでは右上に小さく置き、行を増やさない */}
            <header className="relative flex items-center gap-4 sm:items-end sm:justify-between sm:gap-5">
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
                    <CourseGlyph
                        venue={detail.venue_name}
                        width={150}
                        activeCourseType={detail.course_type}
                        className="block h-auto w-[96px] shrink-0 sm:w-[150px]"
                        title={`${detail.venue_name}競馬場のコース図`}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="pr-24 text-[13px] font-bold text-slate-500 sm:pr-0">{detail.venue_name}競馬場 コースデータ</p>
                        {/* 見本どおり「中山 芝2200m」を大きく、検索の語句（枠順・脚質・騎手）は h1 の2行目に小さく残す */}
                        <h1 className="font-display font-bold leading-tight text-slate-900 [overflow-wrap:anywhere]">
                            <span className="block text-[26px] sm:text-[32px]">{displayName}</span>
                            <span className="mt-0.5 block text-[15px] font-bold text-slate-600 sm:text-[18px]">枠順・脚質・騎手の傾向</span>
                        </h1>
                        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-slate-500 sm:text-[13px]">
                            <span className="whitespace-nowrap">集計期間 {detail.analysis_start_date ?? '—'}〜{detail.analysis_end_date ?? '—'}</span>
                            <span className="whitespace-nowrap">対象 <span className="font-num font-semibold">{entity.sample_size.toLocaleString('ja-JP')}</span>頭</span>
                        </p>
                    </div>
                </div>
                <div className="absolute -top-1 right-0 sm:static sm:shrink-0">
                    <DataFavoriteButton
                        entityType="course"
                        entityId={entity.id}
                        name={entity.name}
                        subtitle={entity.subtitle}
                        url={entity.url}
                        headPlacement
                    />
                </div>
            </header>
            {/* ページの導入文（検索・審査のため1文だけ残す） */}
            <p className="max-w-3xl text-[14px] leading-[1.75] text-slate-700 sm:mt-3 sm:text-[15px]">
                {entity.name}の枠番・馬番・位置取り・人気・騎手別の成績です。
            </p>

            <div className="sm:mt-5">
                <StatTiles items={buildCourseTiles(detail)} label={`${entity.name}の集計`} />
            </div>

            <div className="empty:hidden sm:mt-6">
                <WakuPlaceRateBars items={detail.segments.waku ?? []} />
            </div>

            <DataSegmentTabs
                title="条件別の成績"
                className="sm:mt-6"
                tabs={conditionTabs}
            />

            {peopleSpecs.length === 1 && (
                <SegmentStatsTable
                    className="sm:mt-6"
                    headingId={`course-${peopleSpecs[0].key}-heading`}
                    title={peopleSpecs[0].title}
                    firstLabel={peopleSpecs[0].firstLabel}
                    items={peopleSpecs[0].items}
                    linkPrefix={peopleSpecs[0].linkPrefix}
                />
            )}
            {peopleSpecs.length > 1 && (
                <DataSegmentTabs
                    title="成績の良い騎手・調教師"
                    className="sm:mt-6"
                    tabs={peopleSpecs.map((spec) => ({
                        key: spec.key,
                        label: spec.label,
                        panel: (
                            <SegmentStatsTable
                                inTabs
                                headingId={`course-${spec.key}-heading`}
                                title={spec.title}
                                firstLabel={spec.firstLabel}
                                items={spec.items}
                                linkPrefix={spec.linkPrefix}
                            />
                        ),
                    }))}
                />
            )}

            <RecentRunsTable className="sm:mt-6" title="このコースの最近の勝ち馬" runs={detail.recent_races} showHorse showOdds />

            {/* 見本：副ボタン1つを幅いっぱいに。見出しの前の線は付けない（PC は今までの線と間隔） */}
            <section className="flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:flex-wrap sm:border-t sm:border-slate-200 sm:pt-5">
                <Link prefetch={false} href="/races/today" className="ui-btn ui-btn--secondary w-full sm:w-auto">
                    今日のレースを確認する
                    <LineIcon name="arrowR" size={18} className="block" />
                </Link>
                {relatedArticleHref && (
                    <Link prefetch={false} href={relatedArticleHref} className="ui-btn ui-btn--secondary w-full gap-1.5 sm:w-auto">
                        <LineIcon name="book" size={18} className="block" />
                        関連記事を読む
                    </Link>
                )}
            </section>
        </article>
    );
}
