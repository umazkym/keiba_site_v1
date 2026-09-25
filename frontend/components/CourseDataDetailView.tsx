import Link from 'next/link';
import { DataDirectoryNav } from '@/components/DataDirectoryNav';
import { DataEntityTracker } from '@/components/DataEntityTracker';
import { DataFavoriteButton } from '@/components/DataFavoriteButton';
import { CourseGlyph } from '@/components/CourseGlyph';
import { LineIcon } from '@/components/LineIcon';
import { SectionHeader } from '@/components/SectionHeader';
import { getWakuClasses } from '@/lib/waku';
import { RateSummaryStrip, RecentRunsTable, SegmentStatsTable } from '@/components/DataStats';
import type { CourseDataDetail, SegmentStat } from '@/lib/types';


// 枠番・馬番の表は番号の順に並べる（API は対象の数の順で返すため、8枠→6枠→7枠…と並んでいた）
const sortByNumberKey = (items: SegmentStat[]) => [...items].sort((a, b) => {
    const left = Number(a.key);
    const right = Number(b.key);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
    return 0;
});

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

// 枠番別の3着以内率の棒（ポートフォリオの「枠番別の複勝率」）。最も高い枠はインディゴ、棒の下に枠色の番号と頭数。
function WakuPlaceRateBars({ items }: { items: SegmentStat[] }) {
    const waku = items
        .filter((item) => Number.isInteger(Number(item.key)) && Number(item.key) >= 1 && Number(item.key) <= 8)
        .sort((a, b) => Number(a.key) - Number(b.key));
    if (waku.length < 4) return null;
    const max = Math.max(...waku.map((item) => item.place_rate));
    if (!(max > 0)) return null;
    return (
        <section className="rounded-[14px] bg-white p-4 ring-1 ring-inset ring-slate-200 sm:p-5" aria-labelledby="course-waku-bars-heading">
            <SectionHeader id="course-waku-bars-heading" title="枠番別の3着以内率" description="棒の下の数字は集計した頭数です。" compact />
            <div className="mt-2 flex h-[176px] items-end gap-1.5 sm:h-[200px] sm:gap-3">
                {waku.map((item) => {
                    const isBest = item.place_rate === max;
                    const height = Math.max(5, Math.round((item.place_rate / max) * 78));
                    const wakuClass = getWakuClasses(Number(item.key));
                    return (
                        <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                            <div className="flex w-full max-w-[44px] flex-1 flex-col items-center justify-end gap-1">
                                <span className={`font-num text-[13.5px] font-bold tabular-nums sm:text-[15px] ${isBest ? 'text-brand-700' : 'text-slate-700'}`}>
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
                            <span className="font-num text-[11.5px] font-semibold text-slate-500">{item.sample_size}</span>
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

export function CourseDataDetailView({ detail, relatedArticleHref }: { detail: CourseDataDetail; relatedArticleHref: string | null }) {
    const entity = detail.entity;
    return (
        <article className="mx-auto max-w-6xl px-3.5 pb-14 pt-3 sm:px-5">
            <DataDirectoryNav current="course" />

            <DataEntityTracker
                entityType="course"
                entityId={entity.id}
                name={entity.name}
                subtitle={entity.subtitle}
                url={entity.url}
                sampleSize={entity.sample_size}
                indexable={entity.indexable}
            />
            <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                    <CourseGlyph
                        venue={detail.venue_name}
                        width={150}
                        activeCourseType={detail.course_type}
                        className="block h-auto w-[96px] shrink-0 sm:w-[150px]"
                        title={`${detail.venue_name}競馬場のコース図`}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-[13px] font-bold text-slate-500">{detail.venue_name}競馬場 コースデータ</p>
                        <h1 className="font-display text-[23px] font-extrabold leading-snug text-slate-900 [overflow-wrap:anywhere] sm:text-[32px]">
                            {entity.name}の枠順・脚質・騎手傾向
                        </h1>
                        <p className="text-[12.5px] text-slate-500 sm:text-[13px]">
                            集計期間 {detail.analysis_start_date ?? '—'}〜{detail.analysis_end_date ?? '—'}
                            {' · '}対象 <span className="font-num font-semibold">{entity.sample_size.toLocaleString('ja-JP')}</span>頭
                        </p>
                    </div>
                </div>
                <DataFavoriteButton
                    entityType="course"
                    entityId={entity.id}
                    name={entity.name}
                    subtitle={entity.subtitle}
                    url={entity.url}
                />
            </header>
            <p className="mt-3 max-w-3xl text-[14px] leading-[1.75] text-slate-700 sm:text-[15px]">
                同じ競馬場・コース種別・距離のレース結果を集計し、枠番・馬番・位置取り・人気ごとの成績と、成績の良い騎手・調教師を並べています。
            </p>

            <div className="mt-5">
                <RateSummaryStrip summary={detail.overall} label={`${entity.name}の全体集計`} />
            </div>

            <div className="mt-6">
                <WakuPlaceRateBars items={detail.segments.waku ?? []} />
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <SegmentStatsTable
                    title="枠番別"
                    description="公式1〜8枠別の成績です。"
                    items={sortByNumberKey(detail.segments.waku ?? [])}
                    minimumNotice={10}
                    labelKind="frame"
                />
                <SegmentStatsTable
                    title="馬番別"
                    description="頭数構成の違いがあるため、枠番別と合わせて確認します。"
                    items={sortByNumberKey(detail.segments.horse_numbers ?? [])}
                    minimumNotice={10}
                />
                <SegmentStatsTable
                    title="馬場状態別"
                    description="良・稍重・重・不良別の成績傾向。"
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
                    title="注目の騎手成績"
                    description="10走以上の騎手を3着以内率順で表示。タップで騎手データへ。"
                    items={detail.top_jockeys}
                    linkPrefix="/jockeys/data/"
                    minimumNotice={10}
                />
                <SegmentStatsTable
                    title="注目の調教師成績"
                    description="10走以上の調教師を3着以内率順で表示。タップで調教師データへ。"
                    items={detail.top_trainers}
                    linkPrefix="/trainers/"
                    minimumNotice={10}
                />
            </div>

            {detail.payout_stats.length > 0 && (
                <section className="mt-6 overflow-hidden rounded-[14px] bg-white ring-1 ring-inset ring-slate-200">
                    <SectionHeader
                        title="配当・払戻の分布"
                        description="このコース条件で記録された過去の払戻額です。"
                        className="mx-4 pt-4 sm:mx-5"
                        compact
                    />
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[460px] text-[14px]">
                            <thead className="bg-slate-50 text-[12.5px] text-slate-500">
                                <tr>
                                    <th className="px-4 py-2.5 text-left font-bold">券種</th>
                                    <th className="px-3 py-2.5 text-right font-bold">対象</th>
                                    <th className="px-3 py-2.5 text-right font-bold">平均払戻</th>
                                    <th className="px-4 py-2.5 text-right font-bold">最高払戻</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {detail.payout_stats.map((item) => (
                                    <tr key={item.bet_type}>
                                        <th className="px-4 py-3 text-left font-bold text-slate-900">
                                            {BET_TYPE_LABELS[item.bet_type] ?? item.bet_type}
                                        </th>
                                        <td className="px-3 py-3 text-right font-num text-[15px] tabular-nums text-slate-600">
                                            {item.sample_size.toLocaleString('ja-JP')}
                                        </td>
                                        <td className="px-3 py-3 text-right font-num text-[15.5px] font-bold tabular-nums text-slate-900">
                                            {item.average_payout.toLocaleString('ja-JP')}<span className="font-sans text-[12px]">円</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-num text-[15.5px] font-bold tabular-nums text-ai-deep">
                                            {item.max_payout.toLocaleString('ja-JP')}<span className="font-sans text-[12px]">円</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <div className="mt-6">
                <RecentRunsTable title="このコースの最近の勝ち馬" runs={detail.recent_races} showHorse />
            </div>

            <section className="mt-6 flex flex-wrap gap-2.5 border-t border-slate-200 pt-5">
                <Link prefetch={false} href="/races/today" className="ui-btn ui-btn--primary gap-1.5">
                    <LineIcon name="race" size={18} className="block" />
                    今日のレースで確認する
                </Link>
                {relatedArticleHref && (
                    <Link href={relatedArticleHref} className="ui-btn ui-btn--secondary gap-1.5">
                        <LineIcon name="book" size={18} className="block" />
                        関連記事を読む
                    </Link>
                )}
                <Link href="/compare" className="ui-btn ui-btn--secondary gap-1.5">
                    <LineIcon name="compare" size={18} className="block" />
                    競走馬の成績を比べる
                </Link>
            </section>
        </article>
    );
}
