import Link from 'next/link';
import { FrameNumberBadge, RaceNumberBadge } from '@/components/RaceNumberBadge';
import { ResponsiveDataTable } from '@/components/ResponsiveDataTable';
import { SectionHeader } from '@/components/SectionHeader';
import type {
    DataRecentRun,
    RateSummary,
    SegmentStat,
} from '@/lib/types';


function formatRate(value: number): string {
    return `${value.toFixed(1)}%`;
}

/** 着順カラーバッジ取得 */
function getRankBadge(rank: number | null | undefined) {
    if (rank == null) return <span className="text-slate-400">—</span>;
    if (rank === 1) {
        return (
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-amber-300 bg-amber-100 px-1.5 font-mono text-xs font-black text-amber-950 shadow-2xs">
                1着
            </span>
        );
    }
    if (rank === 2) {
        return (
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-slate-300 bg-slate-200 px-1.5 font-mono text-xs font-black text-slate-900 shadow-2xs">
                2着
            </span>
        );
    }
    if (rank === 3) {
        return (
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-orange-200 bg-orange-100 px-1.5 font-mono text-xs font-bold text-orange-950 shadow-2xs">
                3着
            </span>
        );
    }
    if (rank <= 5) {
        return (
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-1.5 font-mono text-xs font-bold text-slate-800">
                {rank}着
            </span>
        );
    }
    return <span className="font-mono text-xs text-slate-500">{rank}着</span>;
}

export function RateSummaryStrip({
    summary,
    label = '集計成績',
}: {
    summary: RateSummary;
    label?: string;
}) {
    const items = [
        { label: '対象', value: `${summary.sample_size.toLocaleString('ja-JP')}走` },
        { label: '1着', value: `${summary.wins.toLocaleString('ja-JP')}回` },
        { label: '勝率', value: formatRate(summary.win_rate) },
        { label: '3着以内率', value: formatRate(summary.place_rate) },
        {
            label: '平均人気',
            value: summary.average_popularity == null ? '—' : `${summary.average_popularity.toFixed(1)}番`,
        },
    ];
    return (
        <section aria-label={label} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                <h2 className="text-sm font-black text-slate-800">{label}</h2>
            </div>
            <dl className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-5 sm:divide-y-0">
                {items.map((item) => (
                    <div key={item.label} className="px-3 py-3 text-center">
                        <dt className="text-[11px] font-bold text-slate-500">{item.label}</dt>
                        <dd className="mt-1 font-mono text-base font-black tabular-nums text-slate-950">
                            {item.value}
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
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <SectionHeader
                title={title}
                description={description}
                className="mx-3 pt-3 sm:mx-4"
                compact
            />
            <ResponsiveDataTable label={`${title}の条件別成績`}>
                <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                            <th className="px-4 py-2 text-left">条件</th>
                            <th className="px-3 py-2 text-right">対象</th>
                            <th className="px-3 py-2 text-right">勝率</th>
                            <th className="px-3 py-2 text-right">3着以内率</th>
                            <th className="px-4 py-2 text-right">平均人気</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map((item) => {
                            return (
                                <tr key={item.key}>
                                    <th className="px-4 py-3 text-left font-bold text-slate-800">
                                        {labelKind === 'frame' && Number.isInteger(Number(item.key)) ? (
                                            <span className="inline-flex items-center gap-2">
                                                <FrameNumberBadge frameNumber={Number(item.key)} />
                                                <span>{item.label}</span>
                                            </span>
                                        ) : linkPrefix ? (
                                            <Link
                                                prefetch={false}
                                                href={`${linkPrefix}${item.key}`}
                                                className="transition-colors duration-150 hover:text-primary"
                                            >
                                                {item.label}
                                            </Link>
                                        ) : item.label}
                                    </th>
                                    <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">
                                        {item.sample_size.toLocaleString('ja-JP')}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                        {formatRate(item.win_rate)}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                        {formatRate(item.place_rate)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                                        {item.average_popularity == null ? '—' : item.average_popularity.toFixed(1)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </ResponsiveDataTable>
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] leading-5 text-slate-500">
                対象{minimumNotice}走以上の条件を表示。率だけでなく対象数も合わせて確認してください。
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
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <SectionHeader title={title} className="mx-3 pt-3 sm:mx-4" compact />
            <ResponsiveDataTable label={`${title}の一覧`}>
                <table className="w-full min-w-[740px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                            <th className="px-4 py-2 text-left">日付・レース</th>
                            {showHorse && <th className="px-3 py-2 text-left">競走馬</th>}
                            <th className="px-3 py-2 text-center">枠・馬番</th>
                            <th className="px-3 py-2 text-left">コース・条件</th>
                            <th className="px-3 py-2 text-center">着順</th>
                            <th className="px-3 py-2 text-right">人気</th>
                            <th className="px-4 py-2 text-right">馬体重</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {runs.map((run) => {
                            // レースページを提供していない期間はリンクにせず、文字だけ残す。
                            const raceLabel = (
                                <>
                                    <span className="block text-xs font-semibold text-slate-500">
                                        {run.race_date} {run.venue_name}{run.race_number}R
                                    </span>
                                    <span className="mt-0.5 block max-w-[240px] truncate text-sm font-black" title={run.race_name}>
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
                                            className="font-bold text-slate-900 transition-colors duration-150 hover:text-blue-600"
                                        >
                                            {raceLabel}
                                        </Link>
                                    ) : (
                                        <div className="font-bold text-slate-900">{raceLabel}</div>
                                    )}
                                </td>
                                {showHorse && (
                                    <td className="px-3 py-3 font-bold text-slate-800 max-w-[160px] truncate">
                                        {run.horse_id ? (
                                            <Link prefetch={false} href={`/horses/${encodeURIComponent(run.horse_id)}`} className="hover:text-blue-600" title={run.horse_name ?? ''}>
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
                                <td className="px-3 py-3 text-xs font-bold text-slate-700 max-w-[180px] truncate" title={run.course_label}>
                                    {run.course_label}
                                </td>
                                <td className="px-3 py-3 text-center">
                                    {getRankBadge(run.rank)}
                                </td>
                                <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">
                                    {run.popularity == null ? '—' : `${run.popularity}人気`}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-slate-600">
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
