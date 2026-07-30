import Link from 'next/link';
import { FrameNumberBadge, RaceNumberBadge } from '@/components/RaceNumberBadge';
import type {
    DataRecentRun,
    RateSummary,
    SegmentStat,
} from '@/lib/types';


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
            <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-lg font-black text-slate-950">{title}</h2>
                {description && <p className="mt-1 text-xs leading-6 text-slate-600">{description}</p>}
            </div>
            <div className="overflow-x-auto">
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
                        {items.map((item) => (
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
                        ))}
                    </tbody>
                </table>
            </div>
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
            <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-lg font-black text-slate-950">{title}</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                            <th className="px-4 py-2 text-left">日付・レース</th>
                            {showHorse && <th className="px-3 py-2 text-left">馬</th>}
                            <th className="px-3 py-2 text-center">馬番</th>
                            <th className="px-3 py-2 text-left">条件</th>
                            <th className="px-3 py-2 text-right">着順</th>
                            <th className="px-3 py-2 text-right">人気</th>
                            <th className="px-4 py-2 text-right">馬体重</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {runs.map((run) => (
                            <tr key={`${run.race_id}-${run.horse_id ?? ''}`}>
                                <td className="px-4 py-3">
                                    <Link
                                        prefetch={false}
                                        href={run.url}
                                        className="font-bold text-slate-800 transition-colors duration-150 hover:text-primary"
                                    >
                                        <span className="block text-xs text-slate-500">
                                            {run.race_date} {run.venue_name}{run.race_number}R
                                        </span>
                                        <span className="mt-0.5 block max-w-[240px] truncate">{run.race_name}</span>
                                    </Link>
                                </td>
                                {showHorse && (
                                    <td className="px-3 py-3 font-bold text-slate-700">
                                        {run.horse_id ? (
                                            <Link prefetch={false} href={`/horses/${encodeURIComponent(run.horse_id)}`} className="hover:text-primary">
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
                                <td className="px-3 py-3 text-slate-600">{run.course_label}</td>
                                <td className="px-3 py-3 text-right font-mono font-black tabular-nums text-slate-950">
                                    {run.rank ?? '—'}
                                </td>
                                <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">
                                    {run.popularity ?? '—'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                                    {run.horse_weight == null
                                        ? '—'
                                        : `${run.horse_weight}kg${run.horse_weight_diff == null ? '' : ` (${run.horse_weight_diff >= 0 ? '+' : ''}${run.horse_weight_diff})`}`}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
