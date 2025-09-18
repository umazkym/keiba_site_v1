import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RaceDayPrediction } from "@/lib/types";
import { Suspense } from 'react';
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";

export const revalidate = 3600; // 1時間ごとにページの再生成を試みる

export async function generateStaticParams() {
    const today = new Date();
    const paths = [];

    for (let i = -3; i <= 2; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        paths.push({ date: dateString });
    }

    return paths;
}

// メタデータ生成関数は、タイトルと説明など基本的な情報のみを返します
export async function generateMetadata({ params }: { params: { date: string } }): Promise<Metadata> {
    const formattedDate = formatDate(params.date);
    return {
        title: `${formattedDate}のAI競馬予測 | UMA-FREE`,
        description: `${formattedDate}の中央・地方競馬の全レースをAIが完全無料で予測。馬券検討に役立つデータを毎日更新。`,
        alternates: {
            canonical: `/races/${params.date}`,
        },
    };
}

const RacePageSkeleton = () => (
    <div className="container py-4">
        <div className="sticky top-16 z-40 bg-white/80 backdrop-blur-sm border-b shadow-md mb-4 p-2">
            <div className="animate-pulse flex items-center justify-between">
                <div className="bg-gray-300 h-9 w-16 rounded-md"></div>
                <div className="flex-grow flex justify-center">
                    <div className="bg-gray-300 h-9 w-64 rounded-md"></div>
                </div>
                <div className="w-12"></div>
            </div>
        </div>
        <RaceTabsSkeleton />
    </div>
);

export default async function RacePage({ params }: { params: { date: string } }) {
    let predictionData: RaceDayPrediction | null = null;
    let jsonLd = null;

    try {
        predictionData = await getPredictionsForDate(params.date);
        
        // ▼▼▼ ここから構造化データ生成ロジックを追加 ▼▼▼
        const mainRace = predictionData?.jra?.[0]?.races?.[0] || predictionData?.nar?.[0]?.races?.[0];

        if (mainRace) {
            jsonLd = {
                "@context": "https://schema.org",
                "@type": "SportsEvent",
                "name": `${mainRace.venue_name} ${mainRace.race_number}R - ${mainRace.race_name}`,
                "startDate": `${mainRace.race_date}T15:45:00+09:00`, // JRAのG1レースなどを想定した仮の時刻
                "location": {
                    "@type": "Place",
                    "name": `${mainRace.venue_name}競馬場`,
                },
                "description": `AIによる${mainRace.venue_name} ${mainRace.race_number}R ${mainRace.race_name}の競馬予測データ。`,
                "eventStatus": "https://schema.org/EventScheduled",
                "url": `https://uma-free.com/races/${mainRace.race_date}?venue=${encodeURIComponent(mainRace.venue_name)}&race=${mainRace.race_number}`
            };
        }
        // ▲▲▲ 構造化データ生成ロジックここまで ▲▲▲

    } catch (error) {
        console.error(`[Build Warning] Failed to fetch initial data for ${params.date}. Error:`, error);
    }

    return (
        <>
            {/* ▼▼▼ scriptタグをページに直接埋め込む ▼▼▼ */}
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            {/* ▲▲▲ scriptタグここまで ▲▲▲ */}

            <Suspense fallback={<RacePageSkeleton />}>
                <RacePageClient
                    initialDate={params.date}
                    initialPredictionData={predictionData}
                />
            </Suspense>
        </>
    );
}

