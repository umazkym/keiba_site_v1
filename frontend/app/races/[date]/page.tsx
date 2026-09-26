import type { Metadata } from "next";
import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatDate } from "@/lib/utils";
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { CourseGlyph } from '@/components/CourseGlyph';
import { RaceDateNav } from '@/components/RaceDateNav';
import { RaceDayBoard } from '@/components/RaceDayBoard';
import { RaceDayExtras } from '@/components/RaceDayExtras';
import { SectionHeader } from '@/components/SectionHeader';
import { ArticleThumb } from '@/components/ArticleThumb';
import { LineIcon } from '@/components/LineIcon';
import { buildRaceDaySummary } from '@/lib/race-day-summary';
import { formatRaceDateLabel } from '@/lib/race-display';
import { getLatestArticles } from '@/lib/articles';
import { getArticleCategoryStyle, pickArticleThumbs } from '@/lib/article-visual';
import {
    getDaysFromToday,
    getJstTodayString,
    getRaceDetailPath,
    getRaceIndexPolicy,
} from '@/lib/race-url';
import { getStrictPredictionsForDate, hasRaceDayData } from '@/lib/race-page-data';

// 動的日付ルートを初回アクセス時に生成し、以降はISRキャッシュから配信する。
// fetch側の5分・1時間設定のうち短い方が実際の再検証間隔になる。
export const revalidate = 2592000;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

export async function generateMetadata(
    { params }: {
        params: { date: string };
    }
): Promise<Metadata> {
    const formattedDate = formatDate(params.date);
    const indexPolicy = getRaceIndexPolicy(params.date);

    return {
        title: `${formattedDate}のAI競馬データ分析`,
        description: `${formattedDate}の中央・地方競馬の全レースをAIが無料でデータ分析。馬券検討に役立つ統計情報を毎日更新。`,
        alternates: {
            canonical: `/races/${params.date}`,
        },
        robots: {
            index: indexPolicy.index,
            follow: indexPolicy.follow,
        },
    };
}

export default async function RacePage({ params }: { params: { date: string } }) {
    let jsonLd = null;
    const formattedDate = formatDate(params.date);
    // ボードに要るのはその日の予測だけ。注目馬・高配当・重賞は見本に無いため外し、その取得もやめた（2026-09-25）
    const predictionData = await getStrictPredictionsForDate(params.date);
    const hasData = hasRaceDayData(predictionData);
    const daysFromToday = getDaysFromToday(params.date);
    const isDataArrivalWindow = daysFromToday >= -1 && daysFromToday <= 2;

    // 当日周辺はデータ投入前でも200を返し、クライアント側で再取得できる状態を保つ。
    // 古い実在しない日付だけを404にする。
    if (!hasData && !isDataArrivalWindow) {
        notFound();
    }

    const mainRace = predictionData.jra?.[0]?.races?.[0] || predictionData.nar?.[0]?.races?.[0];

    // ボードに渡すのは一覧に必要な値だけ（全馬の予測データはクライアントへ送らない）。
    const summary = buildRaceDaySummary(predictionData, params.date);
    // コース図はサーバーで描いて渡す（コースのデータはクライアントへ送らない）
    const glyphs: Record<string, ReactNode> = {};
    [...summary.jra, ...summary.nar].forEach((venue) => {
        glyphs[venue.venue] = <CourseGlyph venue={venue.venue} className="block h-auto w-full" />;
    });

    // レースが無い日（見本）：主ボタンは翌日へ。まだ公開前の先の日は今日へ（翌日以降はデータが無く404になりうるため）
    const today = getJstTodayString();
    const emptyTarget = daysFromToday >= 1 ? today : shiftDate(params.date, 1);
    const emptyPrimary = {
        href: `/races/${emptyTarget}`,
        label: emptyTarget === today ? '今日のレース分析へ' : '翌日のレース分析へ',
    };
    // その下に最新の分析記事3件（記事はファイルを読むだけで、APIは呼ばない）
    const emptyAside = hasData ? null : <LatestArticlesPanel />;

    if (mainRace) {
        jsonLd = {
                "@context": "https://schema.org",
                "@type": "SportsEvent",
                "name": `${mainRace.venue_name} ${mainRace.race_number}R - ${mainRace.race_name}`,
                "startDate": `${mainRace.race_date}T15:45:00+09:00`,
                "endDate": `${mainRace.race_date}T16:00:00+09:00`,
                "location": {
                    "@type": "Place",
                    "name": `${mainRace.venue_name}競馬場`,
                    "address": `${mainRace.venue_name}競馬場`
                },
                "description": `AIによる${mainRace.venue_name} ${mainRace.race_number}R ${mainRace.race_name}の競馬データ分析。`,
                "eventStatus": "https://schema.org/EventScheduled",
                "url": `https://uma-free.com${getRaceDetailPath(mainRace.race_date, mainRace.venue_name, mainRace.race_number)}`,
                "image": [
                    "https://uma-free.com/new-logo.png"
                ],
                "organizer": {
                    "@type": "Organization",
                    "name": "UMA-FREE",
                    "url": "https://uma-free.com"
                },
                "offers": {
                    "@type": "Offer",
                    "url": `https://uma-free.com${getRaceDetailPath(mainRace.race_date, mainRace.venue_name, mainRace.race_number)}`,
                    "price": "0",
                    "priceCurrency": "JPY",
                    "availability": "https://schema.org/InStock",
                    "validFrom": `${mainRace.race_date}T00:00:00+09:00`,
                    "validThrough": `${mainRace.race_date}T23:59:59+09:00`
                },
                "performer": mainRace.predictions.map(p => ({
                    "@type": "SportsTeam",
                    "name": p.horse_name
                })),
                "competitor": mainRace.predictions.map(p => ({
                    "@type": "SportsTeam",
                    "name": p.horse_name
                }))
        };
    }

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: 'レース分析', url: 'https://uma-free.com/races/today' },
                    { name: `${formattedDate}のレース分析`, url: `https://uma-free.com/races/${params.date}` },
                ]}
            />

            <Breadcrumb
                items={[
                    { label: 'ホーム', href: '/' },
                    { label: 'レース分析', href: '/races/today' },
                    { label: `${formatRaceDateLabel(params.date)}のレース分析`, href: '' },
                ]}
            />

            {/* ボード専用の class（race-day-board-page）。レース画面の .race-page-scope の規格（スマホの行間1.6など）を受け継がないよう分けた。
                スマホの左右の余白は外枠（main）の16pxだけ。下の余白はスマホでは持たない（広告→フッターを32pxに） */}
            <div className="race-day-board-page site-shell-wide flex flex-col gap-3 sm:pb-6 md:gap-5">
                <RaceDayBoard
                    initialSummary={summary}
                    title={`${formatRaceDateLabel(params.date)}のレース分析`}
                    dateNav={<RaceDateNav date={params.date} />}
                    glyphs={glyphs}
                    refetchIfEmpty={!hasData && isDataArrivalWindow}
                    emptyPrimary={emptyPrimary}
                    emptyAside={emptyAside}
                />

                <RaceDayExtras
                    date={params.date}
                    hasRaces={hasData}
                    hasNarRaces={summary.nar.length > 0}
                />
            </div>
        </>
    );
}

const shiftDate = (date: string, days: number) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const formatShortDate = (date: string) => {
    const matched = date.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (!matched) return date;
    return `${Number(matched[1])}/${Number(matched[2])}`;
};

// レースが無い日の「最新の分析記事」（見本の noRaceDay）。行の形はホームの記事の一覧と同じ
function LatestArticlesPanel() {
    const articles = getLatestArticles(3);
    if (articles.length === 0) return null;
    const thumbs = pickArticleThumbs(articles);
    return (
        <section aria-labelledby="race-day-articles-heading" className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
            <SectionHeader
                id="race-day-articles-heading"
                title="最新の分析記事"
                action={(
                    <Link prefetch={false} href="/articles" className="inline-flex items-center gap-1 whitespace-nowrap text-[13.5px] font-bold text-brand-700 transition-colors duration-150 hover:text-brand-600">
                        すべて見る
                        <LineIcon name="chevR" size={16} className="block" />
                    </Link>
                )}
                className="!mb-1 md:!mb-4"
                compact
            />
            <ul className="flex flex-col md:grid md:grid-cols-3 md:gap-5">
                {articles.map((article, index) => {
                    const categoryStyle = getArticleCategoryStyle(article.category);
                    return (
                        <li key={article.slug} className="border-b border-slate-200 last:border-b-0 md:border-b-0">
                            <Link
                                prefetch={false}
                                href={`/articles/${article.slug}`}
                                className="group flex gap-3 py-3 md:flex-col md:gap-2.5 md:py-0"
                            >
                                <ArticleThumb
                                    thumb={thumbs[index]}
                                    sizes="(min-width: 1024px) 260px, (min-width: 768px) 30vw, 104px"
                                    className="h-[70px] w-[104px] shrink-0 rounded-[10px] md:aspect-[16/9] md:h-auto md:w-full md:rounded-xl"
                                />
                                <span className="flex min-w-0 flex-col gap-1.5 md:contents">
                                    <span className="line-clamp-2 text-[14px] font-bold leading-normal text-slate-900 group-hover:text-brand-700 md:order-2 md:text-[15px] md:leading-[1.55]">
                                        {article.title}
                                    </span>
                                    <span className="flex items-center gap-2 text-[12px] text-slate-500 md:order-1">
                                        <span className={`inline-flex items-center rounded-[5px] bg-white px-1.5 py-px text-[11px] font-bold ring-1 ring-inset ${categoryStyle.tagClass}`}>
                                            {article.category}
                                        </span>
                                        {formatShortDate(article.date)}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
