import Link from 'next/link';
import { FrameNumberBadge, RaceNumberBadge } from '@/components/RaceNumberBadge';
import { FinishBadge } from '@/components/RaceParts';
import { ResponsiveDataTable } from '@/components/ResponsiveDataTable';
import { SectionHeader } from '@/components/SectionHeader';
import type {
    DataRecentRun,
    RateSummary,
    SegmentStat,
} from '@/lib/types';

// データ画面の共通部品（2026-09-25 段階5）：集計の数字は Barlow の大きな数字、率には必ず対象数を並べる。
// 表の文字はスマホでも14px以上、着順はレース画面と同じ丸い印（1着は紺の塗り、2・3着は紺の輪）。

function formatRate(value: number): string {
    return `${value.toFixed(1)}%`;
}

export function RateSummaryStrip({
    summary,
    label = '集計成績',
}: {
    summary: RateSummary;
    label?: string;
}) {
    const items: { label: string; value: string; unit: string }[] = [
        { label: '対象', value: summary.sample_size.toLocaleString('ja-JP'), unit: '走' },
        { label: '1着', value: summary.wins.toLocaleString('ja-JP'), unit: '回' },
        { label: '勝率', value: summary.win_rate.toFixed(1), unit: '%' },
        { label: '3着以内率', value: summary.place_rate.toFixed(1), unit: '%' },
        {
            label: '平均人気',
            value: summary.average_popularity == null ? '—' : summary.average_popularity.toFixed(1),
            unit: summary.average_popularity == null ? '' : '番人気',
        },
    ];
    return (
        <section aria-label={label}>
            <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
                {items.map((item) => (
                    <div key={item.label} className="flex flex-col gap-1 rounded-[14px] bg-white px-3 py-3 ring-1 ring-inset ring-slate-200 sm:px-4 sm:py-4">
                        <dt className="text-[12px] font-bold text-slate-500 sm:text-[12.5px]">{item.label}</dt>
                        <dd className="flex items-baseline gap-0.5 whitespace-nowrap font-num text-[24px] font-bold leading-none tabular-nums text-slate-900 sm:text-[30px]">
                            {item.value}
                            {item.unit && <span className="font-sans text-[12px] font-bold text-slate-600 sm:text-[13px]">{item.unit}</span>}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

export function SegmentStatsTable({
    title,
    description,
    items,
    linkPrefix,
    minimumNotice = 2,
    labelKind = 'plain',
}: {
    title: string;
    description?: string;
    items: SegmentStat[];
    linkPrefix?: string;
    minimumNotice?: number;
    labelKind?: 'plain' | 'frame';
}) {
    if (items.length === 0) return null;

    return (
        <section className="overflow-hidden rounded-[14px] bg-white ring-1 ring-inset ring-slate-200">
            <SectionHeader
                title={title}
                description={description}
                className="mx-4 pt-4 sm:mx-5"
                compact
            />
            <ResponsiveDataTable label={`${title}の条件別成績`}>
                <table className="w-full min-w-[480px] text-[14px]">
                    <thead className="bg-slate-50 text-[12.5px] text-slate-500">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-bold">条件</th>
                            <th className="px-3 py-2.5 text-right font-bold">対象</th>
                            <th className="px-3 py-2.5 text-right font-bold">勝率</th>
                            <th className="px-3 py-2.5 text-right font-bold">3着以内率</th>
                            <th className="px-4 py-2.5 text-right font-bold">平均人気</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {items.map((item) => {
                            return (
                                <tr key={item.key}>
                                    <th className="px-4 py-3 text-left font-bold text-slate-900">
                                        {labelKind === 'frame' && Number.isInteger(Number(item.key)) ? (
                                            <span className="inline-flex items-center gap-2">
                                                <FrameNumberBadge frameNumber={Number(item.key)} />
                                                <span>{item.label}</span>
                                            </span>
                                        ) : linkPrefix ? (
                                            <Link
                                                prefetch={false}
                                                href={`${linkPrefix}${item.key}`}
                                                className="text-brand-700 underline decoration-brand-200 decoration-2 underline-offset-4 transition-colors duration-150 hover:decoration-brand-600"
                                            >
                                                {item.label}
                                            </Link>
                                        ) : item.label}
                                    </th>
                                    <td className="px-3 py-3 text-right font-num text-[15px] tabular-nums text-slate-600">
                                        {item.sample_size.toLocaleString('ja-JP')}
                                    </td>
                                    <td className="px-3 py-3 text-right font-num text-[15.5px] font-bold tabular-nums text-slate-900">
                                        {formatRate(item.win_rate)}
                                    </td>
                                    <td className="px-3 py-3 text-right font-num text-[15.5px] font-bold tabular-nums text-navy">
                                        {formatRate(item.place_rate)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-num text-[15px] tabular-nums text-slate-600">
                                        {item.average_popularity == null ? '—' : item.average_popularity.toFixed(1)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </ResponsiveDataTable>
            <p className="border-t border-slate-200 px-4 py-2.5 text-[12.5px] leading-[1.6] text-slate-500 sm:px-5">
                対象{minimumNotice}走以上の条件を表示しています。率は対象の数と合わせて確認してください。
            </p>
        </section>
    );
}

export function RecentRunsTable({
    title,
    runs,
    showHorse = false,
}: {
    title: string;
    runs: DataRecentRun[];
    showHorse?: boolean;
}) {
    if (runs.length === 0) return null;
    return (
        <section className="overflow-hidden rounded-[14px] bg-white ring-1 ring-inset ring-slate-200">
            <SectionHeader title={title} className="mx-4 pt-4 sm:mx-5" compact />
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
                            <tr key={`${run.race_id}-${run.horse_id ?? ''}`} className="hover:bg-slate-50/60">
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
        </section>
    );
}
