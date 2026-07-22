import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { formatDate } from "@/lib/utils";
import { Suspense } from 'react';
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { getRaceArticleMeta } from '@/lib/articles';
import {
    getDaysFromToday,
    getRaceDetailPath,
    getRaceIndexPolicy,
} from '@/lib/race-url';
import { getRacePageData, hasRaceDayData } from '@/lib/race-page-data';

// 動的日付ルートを初回アクセス時に生成し、以降はISRキャッシュから配信する。
// fetch側の5分・1時間設定のうち短い方が実際の再検証間隔になる。
export const revalidate = 3600;
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

const RacePageSkeleton = () => (
    <div className="py-4">
        <div className="glass mb-5 p-2 sm:p-3">
            <div className="animate-pulse flex items-center justify-between max-w-[280px] sm:max-w-sm mx-auto">
                <div className="bg-slate-200 h-9 w-10 text-white px-4 py-2.5 rounded-xl shadow-sm"></div>
                <div className="flex-grow flex justify-center">
                    <div className="bg-slate-200 h-9 w-32 rounded-lg"></div>
                </div>
                <div className="bg-slate-200 h-9 w-10 text-white px-4 py-2.5 rounded-xl shadow-sm"></div>
            </div>
        </div>
        <RaceTabsSkeleton />
    </div>
);

export default async function RacePage({ params }: { params: { date: string } }) {
    let jsonLd = null;
    const articlesMeta = getRaceArticleMeta();
    const formattedDate = formatDate(params.date);
    const {
        predictions: predictionData,
        specialPick: specialPickData,
        topHits: topHitsData,
        gradeRaces: weeklyGradeRaces,
    } = await getRacePageData(params.date);
    const hasData = hasRaceDayData(predictionData);
    const daysFromToday = getDaysFromToday(params.date);
    const isDataArrivalWindow = daysFromToday >= -1 && daysFromToday <= 2;

    // 当日周辺はデータ投入前でも200を返し、クライアント側で再取得できる状態を保つ。
    // 古い実在しない日付だけを404にする。
    if (!hasData && !isDataArrivalWindow) {
        notFound();
    }

    const mainRace = predictionData.jra?.[0]?.races?.[0] || predictionData.nar?.[0]?.races?.[0];

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
                    { label: `${formattedDate}のレース分析`, href: '' },
                ]}
            />

            <Suspense fallback={<RacePageSkeleton />}>
                <RacePageClient
                    initialDate={params.date}
                    initialPredictionData={predictionData}
                    initialSpecialPick={specialPickData}
                    initialTopHits={topHitsData}
                    weeklyGradeRaces={weeklyGradeRaces}
                    articlesMeta={articlesMeta}
                />
            </Suspense>
        </>
    );
}
