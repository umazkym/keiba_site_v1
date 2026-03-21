import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate, getSpecialPick, getTopPayoutHits } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RaceDayPrediction, SpecialPick, TopPayoutHit } from "@/lib/types";
import { Suspense } from 'react';
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { getAllArticlesMeta } from '@/lib/articles';

// ============================================================
// ISR: 15分ごとにVercel CDNキャッシュを再生成
// searchParams を除去したことでこの設定が正しく有効になる
// ============================================================
export const revalidate = 900;

export async function generateMetadata(
    // ============================================================
    // [変更] searchParams 引数を完全に削除
    // 変更前: searchParams から venue/race を取り出して動的タイトルを生成
    //         → Next.jsが「このページは動的」と判定しISRが無効化されていた
    // 変更後: params.date のみに依存した静的タイトルを返す
    //         → ページ全体がISRキャッシュの対象になる
    // ============================================================
    { params }: { params: { date: string } }
): Promise<Metadata> {
    const formattedDate = formatDate(params.date);

    return {
        title: `${formattedDate}のAI競馬データ分析 | UMA-FREE`,
        description: `${formattedDate}の中央・地方競馬の全レースをAIが完全無料でデータ分析。馬券検討に役立つ統計情報を毎日更新。`,
        alternates: {
            // venue/race なしの日付URLをcanonicalとして統一
            canonical: `/races/${params.date}`,
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}

const RacePageSkeleton = () => (
    <div className="py-4">
        <div className="sticky top-14 sm:top-16 z-40 glass mb-5 p-2 sm:p-3">
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
    let predictionData: RaceDayPrediction | null = null;
    let specialPickData: SpecialPick | null = null;
    let topHitsData: TopPayoutHit[] = [];
    let jsonLd = null;
    const articlesMeta = getAllArticlesMeta();

    try {
        const [predictions, specialPick, topHits] = await Promise.all([
            getPredictionsForDate(params.date),
            getSpecialPick(params.date),
            getTopPayoutHits(),
        ]);
        predictionData = predictions;
        specialPickData = specialPick;
        topHitsData = topHits;

        if (!predictionData || (predictionData.jra.length === 0 && predictionData.nar.length === 0)) {
            console.log(`[Data Info] No prediction data found for ${params.date}. Returning 404.`);
            notFound();
        }

        const mainRace = predictionData?.jra?.[0]?.races?.[0] || predictionData?.nar?.[0]?.races?.[0];

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
                // [変更] JSON-LD URLも日付ベースのcanonicalに統一
                "url": `https://uma-free.com/races/${mainRace.race_date}`,
                "image": ["https://uma-free.com/new-logo.png"],
                "organizer": {
                    "@type": "Organization",
                    "name": "UMA-FREE",
                    "url": "https://uma-free.com"
                },
                "offers": {
                    "@type": "Offer",
                    "url": `https://uma-free.com/races/${mainRace.race_date}`,
                    "price": "0",
                    "priceCurrency": "JPY",
                    "availability": "https://schema.org/InStock",
                    "validFrom": `${mainRace.race_date}T00:00:00+09:00`,
                    "validThrough": `${mainRace.race_date}T23:59:59+09:00`
                },
                "performer": mainRace.predictions.map((p: { horse_name: string }) => ({
                    "@type": "SportsTeam",
                    "name": p.horse_name
                })),
                "competitor": mainRace.predictions.map((p: { horse_name: string }) => ({
                    "@type": "SportsTeam",
                    "name": p.horse_name
                }))
            };
        }

    } catch (error) {
        console.error(`[Build Warning] Failed to fetch initial data for ${params.date}. Error:`, error);
        notFound();
    }

    if (!predictionData) {
        notFound();
    }

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}

            <Breadcrumb />

            <Suspense fallback={<RacePageSkeleton />}>
                <RacePageClient
                    initialDate={params.date}
                    initialPredictionData={predictionData}
                    initialSpecialPick={specialPickData}
                    initialTopHits={topHitsData}
                    articlesMeta={articlesMeta}
                />
            </Suspense>
        </>
    );
}