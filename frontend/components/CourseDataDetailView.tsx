import Link from 'next/link';
import { DataEntityTracker } from '@/components/DataEntityTracker';
import { DataFavoriteButton } from '@/components/DataFavoriteButton';
import { RateSummaryStrip, RecentRunsTable, SegmentStatsTable } from '@/components/DataStats';
import type { CourseDataDetail } from '@/lib/types';


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

export function CourseDataDetailView({ detail }: { detail: CourseDataDetail }) {
    const entity = detail.entity;
    return (
        <article className="mx-auto max-w-6xl px-3 pb-14 pt-4 sm:px-4">
            <DataEntityTracker
                entityType="course"
                entityId={entity.id}
                name={entity.name}
                subtitle={entity.subtitle}
                url={entity.url}
                sampleSize={entity.sample_size}
                indexable={entity.indexable}
            />
            <header className="border-b border-slate-200 pb-5">
                <p className="text-xs font-bold text-slate-500">
                    {detail.venue_name}競馬場・コースデータ
                </p>
                <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                            {entity.name}の枠順・脚質・騎手データ
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                            過去結果を同じ競馬場・コース種別・距離で再集計しています。
                            馬場状態、人気、枠順、位置取りの順に確認できます。
                        </p>
                    </div>
                    <DataFavoriteButton
                        entityType="course"
                        entityId={entity.id}
                        name={entity.name}
                        subtitle={entity.subtitle}
                        url={entity.url}
                    />
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                    集計期間 {detail.analysis_start_date ?? '—'}〜{detail.analysis_end_date ?? '—'}
                    {' / '}対象 {entity.sample_size.toLocaleString('ja-JP')}頭
                </p>
            </header>

            <div className="mt-5">
                <RateSummaryStrip summary={detail.overall} label={`${entity.name}の全体集計`} />
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <SegmentStatsTable
                    title="枠番別"
                    description="同じコース条件における枠番ごとの成績です。"
                    items={detail.segments.waku ?? []}
                    minimumNotice={10}
                    labelKind="frame"
                />
                <SegmentStatsTable
                    title="馬番別"
                    description="頭数構成の違いがあるため、枠番別と合わせて確認します。"
                    items={detail.segments.horse_numbers ?? []}
                    minimumNotice={10}
                />
                <SegmentStatsTable
                    title="馬場状態別"
                    items={detail.segments.grounds ?? []}
                    minimumNotice={10}
                />
                <SegmentStatsTable
                    title="位置取り別"
                    description="最終コーナーの位置を頭数比で3区分しています。"
                    items={detail.segments.running_styles ?? []}
                    minimumNotice={10}
                />
                <SegmentStatsTable
                    title="人気別"
                    items={detail.segments.popularities ?? []}
                    minimumNotice={10}
                />
                <SegmentStatsTable
                    title="騎手別"
                    description="10走以上の騎手を3着以内率順で表示します。"
                    items={detail.top_jockeys}
                    linkPrefix="/jockeys/data/"
                    minimumNotice={10}
                />
                <SegmentStatsTable
                    title="調教師別"
                    description="10走以上の調教師を3着以内率順で表示します。"
                    items={detail.top_trainers}
                    linkPrefix="/trainers/"
                    minimumNotice={10}
                />
            </div>

            {detail.payout_stats.length > 0 && (
                <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                        <h2 className="text-lg font-black text-slate-950">払戻分布</h2>
                        <p className="mt-1 text-xs leading-6 text-slate-600">
                            的中を示すものではなく、同条件で記録された払戻額の分布です。
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[500px] text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-600">
                                <tr>
                                    <th className="px-4 py-2 text-left">券種</th>
                                    <th className="px-3 py-2 text-right">対象</th>
                                    <th className="px-3 py-2 text-right">平均払戻</th>
                                    <th className="px-4 py-2 text-right">最高払戻</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {detail.payout_stats.map((item) => (
                                    <tr key={item.bet_type}>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800">
                                            {BET_TYPE_LABELS[item.bet_type] ?? item.bet_type}
                                        </th>
                                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">
                                            {item.sample_size.toLocaleString('ja-JP')}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                            {item.average_payout.toLocaleString('ja-JP')}円
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                            {item.max_payout.toLocaleString('ja-JP')}円
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <div className="mt-6">
                <RecentRunsTable title="最近の勝ち馬" runs={detail.recent_races} showHorse />
            </div>

            <section className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
                <Link
                    prefetch={false}
                    href="/races/today"
                    className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary"
                >
                    今日のレースを確認
                </Link>
                <Link
                    href={`/articles/courses/${detail.venue_slug}/${detail.entity.id.split('/')[1]}`}
                    className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors duration-150 hover:text-primary"
                >
                    関連記事
                </Link>
            </section>
        </article>
    );
}
