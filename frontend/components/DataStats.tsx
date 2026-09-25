import Link from 'next/link';
import { FrameNumberBadge, RaceNumberBadge } from '@/components/RaceNumberBadge';
import { FinishBadge } from '@/components/RaceParts';
import { LineIcon } from '@/components/LineIcon';
import { ResponsiveDataTable } from '@/components/ResponsiveDataTable';
import { SectionHeader } from '@/components/SectionHeader';
import type {
    DataRecentRun,
    RateSummary,
    SegmentStat,
} from '@/lib/types';

// データ画面の共通部品（2026-09-25 段階5）：集計の数字は Barlow の大きな数字、率には必ず対象数を並べる。
// 表の文字はスマホでも14px以上、着順はレース画面と同じ丸い印（1着は紺の塗り、2・3着は紺の輪）。
// 2026-09-25 スマホの見直し：カードの線は border（内側の影は表の背景に塗りつぶされて消えていた）、表の行は44px、
// 最近の成績はスマホだけ見本の1行リストにする（表は PC だけ）。

function formatRate(value: number): string {
    return `${value.toFixed(1)}%`;
}

// 番号・距離の順に並べる（API は対象の数の順で返すため、人気別が「8番人気→10番人気→9番人気」と並んでいた）
export function sortByNumberKey(items: SegmentStat[]): SegmentStat[] {
    return [...items].sort((a, b) => {
        const left = Number(a.key);
        const right = Number(b.key);
        if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
        return 0;
    });
}

// 馬場はデータベースの略した書き方（稍・不）を正式な呼び名にし、良→稍重→重→不良の順にする
const GROUND_LABELS: Record<string, string> = { 稍: '稍重', 不: '不良' };
const GROUND_ORDER = ['良', '稍重', '重', '不良'];
export function normalizeGroundStats(items: SegmentStat[]): SegmentStat[] {
    return items
        .map((item) => ({ ...item, label: GROUND_LABELS[item.label] ?? item.label }))
        .sort((a, b) => {
            const left = GROUND_ORDER.indexOf(a.label);
            const right = GROUND_ORDER.indexOf(b.label);
            if (left === -1 || right === -1) return 0;
            return left - right;
        });
}

export type StatTileItem = {
    label: string;
    value: string;
    unit?: string;
    /** 数字の下の小さい補足（例：76頭） */
    note?: string;
};

const TILE_GRID: Record<number, string> = {
    1: 'grid-cols-2',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
};

// 集計の数字のタイル。スマホは3列（4つのときは2列×2）、PC は1列に並べる
export function StatTiles({ items, label }: { items: StatTileItem[]; label: string }) {
    if (items.length === 0) return null;
    const gridClass = TILE_GRID[items.length] ?? 'grid-cols-3 sm:grid-cols-5';
    return (
        <section aria-label={label}>
            <dl className={`grid ${gridClass} gap-2 sm:gap-3`}>
                {items.map((item) => (
                    <div key={item.label} className="flex flex-col gap-1 rounded-[14px] bg-white px-3 py-2.5 ring-1 ring-inset ring-slate-200 sm:px-4 sm:py-4">
                        <dt className="text-[12px] font-bold text-slate-500 sm:text-[12.5px]">{item.label}</dt>
                        <dd className="flex items-baseline gap-0.5 whitespace-nowrap font-num text-[24px] font-bold leading-none tabular-nums text-slate-900 sm:text-[30px]">
                            {item.value}
                            {item.unit && <span className="font-sans text-[12px] font-bold text-slate-600 sm:text-[13px]">{item.unit}</span>}
                        </dd>
                        {item.note && <dd className="font-num text-[11.5px] font-semibold text-slate-500">{item.note}</dd>}
                    </div>
                ))}
            </dl>
        </section>
    );
}

// 競走馬・騎手・調教師の通算（見本：出走・勝率・3着以内率・平均着順・平均人気）
export function RateSummaryStrip({
    summary,
    label = '集計成績',
}: {
    summary: RateSummary;
    label?: string;
}) {
    const items: StatTileItem[] = [
        { label: '出走', value: summary.sample_size.toLocaleString('ja-JP'), unit: '走' },
        { label: '勝率', value: summary.win_rate.toFixed(1), unit: '%' },
        { label: '3着以内率', value: summary.place_rate.toFixed(1), unit: '%' },
        {
            label: '平均着順',
            value: summary.average_rank == null ? '—' : summary.average_rank.toFixed(1),
            unit: summary.average_rank == null ? '' : '着',
        },
        {
            label: '平均人気',
            value: summary.average_popularity == null ? '—' : summary.average_popularity.toFixed(1),
            unit: summary.average_popularity == null ? '' : '番人気',
        },
    ];
    return <StatTiles items={items} label={label} />;
}

// 条件別の成績の表。inTabs のときはスマホで DataSegmentTabs のカードの中に入る（自分のカードと見出しを出さない）。
export function SegmentStatsTable({
    title,
    description,
    items,
    linkPrefix,
    labelKind = 'plain',
    firstLabel = '条件',
    headingId,
    inTabs = false,
    className = '',
}: {
    title: string;
    description?: string;
    items: SegmentStat[];
    linkPrefix?: string;
    labelKind?: 'plain' | 'frame';
    /** 1列目の見出し（コース・騎手・距離など） */
    firstLabel?: string;
    headingId?: string;
    inTabs?: boolean;
    className?: string;
}) {
    if (items.length === 0) return null;

    const sectionClass = inTabs
        ? 'sm:overflow-hidden sm:rounded-[14px] sm:border sm:border-slate-200 sm:bg-white'
        : 'overflow-hidden rounded-[14px] border border-slate-200 bg-white';

    return (
        <section aria-labelledby={headingId} className={`${sectionClass} ${className}`.trim()}>
            <SectionHeader
                id={headingId}
                title={title}
                description={description}
                className={inTabs ? 'sr-only sm:not-sr-only sm:mx-5 sm:pt-4' : 'mx-4 pt-3.5 sm:mx-5 sm:pt-4'}
            />
            {inTabs && description && (
                <p aria-hidden="true" className="px-4 pb-2 text-[12.5px] leading-5 text-slate-500 sm:hidden">
                    {description}
                </p>
            )}
            <ResponsiveDataTable
                label={`${title}の条件別成績`}
                firstColumnDivider={false}
                className={inTabs ? 'sm:mt-3' : 'mt-2.5 sm:mt-3'}
            >
                {/* スマホは4列を画面幅に収める（以前は最小480pxで、3着以内率が右で切れていた）。平均人気は640px以上で出す */}
                <table className="w-full text-[14px] sm:min-w-[480px]">
                    <thead className="bg-slate-50 text-[12.5px] text-slate-500">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-bold">{firstLabel}</th>
                            <th className="px-2 py-2.5 text-right font-bold sm:px-3">対象</th>
                            <th className="px-2 py-2.5 text-right font-bold sm:px-3">勝率</th>
                            <th className="py-2.5 pl-2 pr-4 text-right font-bold sm:px-3">3着以内率</th>
                            <th className="hidden px-4 py-2.5 text-right font-bold sm:table-cell">平均人気</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {items.map((item) => {
                            return (
                                <tr key={item.key}>
                                    <th className="px-4 py-2 text-left font-bold text-slate-900 sm:py-3">
                                        {labelKind === 'frame' && Number.isInteger(Number(item.key)) ? (
                                            <span className="inline-flex items-center gap-2">
                                                <FrameNumberBadge frameNumber={Number(item.key)} />
                                                <span>{item.label}</span>
                                            </span>
                                        ) : linkPrefix ? (
                                            // 見た目は文字のまま、押せる範囲だけ行の高さまで広げる（hit-44）
                                            <Link
                                                prefetch={false}
                                                href={`${linkPrefix}${item.key}`}
                                                className="hit-44 text-brand-700 underline decoration-brand-200 decoration-2 underline-offset-4 transition-colors duration-150 hover:decoration-brand-600"
                                            >
                                                {item.label}
                                            </Link>
                                        ) : item.label}
                                    </th>
                                    <td className="px-2 py-2 text-right font-num text-[15px] tabular-nums text-slate-600 sm:px-3 sm:py-3">
                                        {item.sample_size.toLocaleString('ja-JP')}
                                    </td>
                                    <td className="px-2 py-2 text-right font-num text-[15.5px] font-bold tabular-nums text-slate-900 sm:px-3 sm:py-3">
                                        {formatRate(item.win_rate)}
                                    </td>
                                    <td className="py-2 pl-2 pr-4 text-right font-num text-[15.5px] font-bold tabular-nums text-navy sm:px-3 sm:py-3">
                                        {formatRate(item.place_rate)}
                                    </td>
                                    <td className="hidden px-4 py-3 text-right font-num text-[15px] tabular-nums text-slate-600 sm:table-cell">
                                        {item.average_popularity == null ? '—' : item.average_popularity.toFixed(1)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </ResponsiveDataTable>
        </section>
    );
}

// スマホの1行（見本の「最近の騎乗」）：着順の丸・馬名（競走馬のページではレース名）・日付と場とレース・右に人気
function RecentRunRow({
    run,
    showHorse,
    showOdds,
}: {
    run: DataRecentRun;
    showHorse: boolean;
    showOdds: boolean;
}) {
    const date = run.race_date.slice(5, 10).replace('-', '/');
    const raceLabel = `${date} ${run.venue_name}${run.race_number}R`;
    const primary = showHorse ? (run.horse_name ?? '—') : run.race_name;
    const secondary = showHorse
        ? `${raceLabel} ${run.race_name} · ${run.course_label}`
        : `${raceLabel} · ${run.course_label}`;
    const popularity = run.popularity == null ? '—' : `${run.popularity}番人気`;
    const odds = showOdds && run.odds != null ? ` · ${run.odds.toFixed(1)}倍` : '';
    const body = (
        <>
            <span className="flex w-7 shrink-0 justify-center">
                <FinishBadge rank={run.rank} size={28} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14.5px] font-bold text-slate-900">{primary}</span>
                <span className="truncate text-[12.5px] text-slate-500">{secondary}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap font-num text-[14px] tabular-nums text-slate-700">
                {popularity}{odds}
            </span>
        </>
    );
    const rowClassName = 'flex min-h-12 items-center gap-3 py-2';
    // 行ごと1つのリンク（レースのページ。無い期間は競走馬のページ）。PC の表では馬名とレースを別々にリンクする
    const href = run.url ?? (showHorse && run.horse_id ? `/horses/${encodeURIComponent(run.horse_id)}` : null);
    if (!href) return <div className={rowClassName}>{body}</div>;
    return (
        <Link
            prefetch={false}
            href={href}
            rel={run.url ? 'nofollow' : undefined}
            className={`${rowClassName} transition-colors duration-150 hover:bg-slate-50`}
        >
            {body}
        </Link>
    );
}

export function RecentRunsTable({
    title,
    runs,
    showHorse = false,
    showOdds = false,
    mobileLimit = 5,
    className = '',
}: {
    title: string;
    runs: DataRecentRun[];
    showHorse?: boolean;
    /** スマホの1行に単勝オッズも出す（コースの最近の勝ち馬） */
    showOdds?: boolean;
    /** スマホで最初に見せる件数。残りは「もっと見る」の中に入れる（HTML には全件残る） */
    mobileLimit?: number;
    className?: string;
}) {
    if (runs.length === 0) return null;
    const firstRuns = runs.slice(0, mobileLimit);
    const restRuns = runs.slice(mobileLimit);
    const rowKey = (run: DataRecentRun) => `${run.race_id}-${run.horse_id ?? ''}`;
    return (
        <section className={`overflow-hidden rounded-[14px] border border-slate-200 bg-white ${className}`.trim()}>
            <SectionHeader title={title} className="mx-4 pt-3.5 sm:mx-5 sm:pt-4" />
            {/* スマホ：見本の1行リスト。表（幅720px）は横にはみ出し、着順と人気が画面の外に出ていた */}
            <div className="mt-1 px-4 sm:hidden">
                <div className="divide-y divide-slate-200">
                    {firstRuns.map((run) => (
                        <RecentRunRow key={rowKey(run)} run={run} showHorse={showHorse} showOdds={showOdds} />
                    ))}
                </div>
                {restRuns.length > 0 && (
                    <details className="group border-t border-slate-200">
                        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-1 text-[13.5px] font-bold text-brand-700 [&::-webkit-details-marker]:hidden">
                            <span className="group-open:hidden">もっと見る（{restRuns.length}件）</span>
                            <span className="hidden group-open:inline">閉じる</span>
                            <LineIcon name="chevD" size={16} className="block transition-transform duration-150 group-open:rotate-180" />
                        </summary>
                        <div className="divide-y divide-slate-200 border-t border-slate-200">
                            {restRuns.map((run) => (
                                <RecentRunRow key={rowKey(run)} run={run} showHorse={showHorse} showOdds={showOdds} />
                            ))}
                        </div>
                    </details>
                )}
            </div>
            <div className="mt-3 hidden sm:block">
                <ResponsiveDataTable label={`${title}の一覧`}>
                    <table className="w-full min-w-[720px] text-[14px]">
                        <thead className="bg-slate-50 text-[12.5px] text-slate-500">
                            <tr>
                                <th className="px-4 py-2.5 text-left font-bold">日付・レース</th>
                                {showHorse && <th className="px-3 py-2.5 text-left font-bold">競走馬</th>}
                                <th className="px-3 py-2.5 text-center font-bold">枠・馬番</th>
                                <th className="px-3 py-2.5 text-left font-bold">コース・条件</th>
                                <th className="px-3 py-2.5 text-center font-bold">着順</th>
                                <th className="px-3 py-2.5 text-right font-bold">人気</th>
                                <th className="px-4 py-2.5 text-right font-bold">馬体重</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {runs.map((run) => {
                                // レースページを提供していない期間はリンクにせず、文字だけ残す。
                                const raceLabel = (
                                    <>
                                        <span className="block text-[12.5px] font-semibold text-slate-500">
                                            {run.race_date} {run.venue_name}{run.race_number}R
                                        </span>
                                        <span className="mt-0.5 block max-w-[240px] truncate text-[14.5px] font-bold" title={run.race_name}>
                                            {run.race_name}
                                        </span>
                                    </>
                                );
                                return (
                                <tr key={rowKey(run)} className="hover:bg-slate-50/60">
                                    <td className="px-4 py-3">
                                        {run.url ? (
                                            <Link
                                                prefetch={false}
                                                href={run.url}
                                                rel="nofollow"
                                                className="text-slate-900 transition-colors duration-150 hover:text-brand-700"
                                            >
                                                {raceLabel}
                                            </Link>
                                        ) : (
                                            <div className="text-slate-900">{raceLabel}</div>
                                        )}
                                    </td>
                                    {showHorse && (
                                        <td className="max-w-[160px] truncate px-3 py-3 font-bold text-slate-900">
                                            {run.horse_id ? (
                                                <Link prefetch={false} href={`/horses/${encodeURIComponent(run.horse_id)}`} className="hover:text-brand-700" title={run.horse_name ?? ''}>
                                                    {run.horse_name ?? '—'}
                                                </Link>
                                            ) : '—'}
                                        </td>
                                    )}
                                    <td className="px-3 py-3 text-center">
                                        <RaceNumberBadge
                                            horseNumber={run.horse_number}
                                            frameNumber={run.waku_number}
                                        />
                                    </td>
                                    <td className="max-w-[180px] truncate px-3 py-3 text-[13.5px] font-bold text-slate-700" title={run.course_label}>
                                        {run.course_label}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <FinishBadge rank={run.rank} size={28} />
                                    </td>
                                    <td className="px-3 py-3 text-right font-num text-[15px] tabular-nums text-slate-700">
                                        {run.popularity == null ? '—' : `${run.popularity}番人気`}
                                    </td>
                                    <td className="px-4 py-3 text-right font-num text-[14.5px] tabular-nums text-slate-600">
                                        {run.horse_weight == null
                                            ? '—'
                                            : `${run.horse_weight}kg${run.horse_weight_diff == null ? '' : ` (${run.horse_weight_diff >= 0 ? '+' : ''}${run.horse_weight_diff})`}`}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </ResponsiveDataTable>
            </div>
        </section>
    );
}
