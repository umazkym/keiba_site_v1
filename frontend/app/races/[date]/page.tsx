import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RaceDayPrediction } from "@/lib/types";
import { Suspense } from 'react';
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

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

export async function generateMetadata(
    { params, searchParams }: {
        params: { date: string };
        searchParams: { [key: string]: string | string[] | undefined };
    }
): Promise<Metadata> {
    const formattedDate = formatDate(params.date);
    const venue = searchParams.venue as string;
    const race = searchParams.race as string;

    let title = `${formattedDate}のAI競馬予測 | UMA-FREE`;
    let description = `${formattedDate}の中央・地方競馬の全レースをAIが完全無料で予測。馬券検討に役立つデータを毎日更新。`;
    let canonicalUrl = `/races/${params.date}`;

    if (venue && race) {
        const venueName = decodeURIComponent(venue);
        title = `${formattedDate} ${venueName} ${race}R のAI競馬予測 | UMA-FREE`;
        description = `AIによる${formattedDate} ${venueName}競馬場 ${race}Rの無料予測。偏差値、対戦成績、枠順データで詳細分析。`;
        canonicalUrl = `/races/${params.date}?venue=${venue}&race=${race}`;
    }

    return {
        title: title,
        description: description,
        alternates: {
            canonical: canonicalUrl,
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
                "description": `AIによる${mainRace.venue_name} ${mainRace.race_number}R ${mainRace.race_name}の競馬予測データ。`,
                "eventStatus": "https://schema.org/EventScheduled",
                "url": `https://uma-free.com/races/${mainRace.race_date}?venue=${encodeURIComponent(mainRace.venue_name)}&race=${mainRace.race_number}`,
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
                    "url": `https://uma-free.com/races/${mainRace.race_date}?venue=${encodeURIComponent(mainRace.venue_name)}&race=${mainRace.race_number}`,
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

    } catch (error) {
        console.error(`[Build Warning] Failed to fetch initial data for ${params.date}. Error:`, error);
    }

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}

            <Suspense fallback={<RacePageSkeleton />}>
                <RacePageClient
                    initialDate={params.date}
                    initialPredictionData={predictionData}
                />
            </Suspense>
        </>
    );
}
