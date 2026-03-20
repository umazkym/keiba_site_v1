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

export async function generateMetadata(
    { params, searchParams }: {
        params: { date: string };
        searchParams: { [key: string]: string | string[] | undefined };
    }
): Promise<Metadata> {
    const formattedDate = formatDate(params.date);
    const venue = searchParams.venue as string;
    const race = searchParams.race as string;

    let title = `${formattedDate}のAI競馬データ分析 (プレミアム) | UMA-FREE`;
    let description = `AIによる${formattedDate}の競馬データ分析プレミアムコンテンツ。`;
    let canonicalUrl = `https://uma-free.com/races/${params.date}`;

    if (venue && race) {
        const venueName = decodeURIComponent(venue);
        title = `${formattedDate} ${venueName} ${race}R のAI競馬データ分析 (プレミアム) | UMA-FREE`;
        canonicalUrl = `https://uma-free.com/races/${params.date}?race=${race}&venue=${venue}`;
    }

    return {
        title: title,
        description: description,
        alternates: {
            canonical: canonicalUrl,
        },
        robots: {
            index: false,
            follow: false,
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

export default async function PremiumRacePage({ params }: { params: { date: string } }) {
    let predictionData: RaceDayPrediction | null = null;
    let specialPickData: SpecialPick | null = null;
    let topHitsData: TopPayoutHit[] = [];
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
            notFound();
        }

    } catch (error) {
        console.error(`[Build Warning] Failed to fetch initial data for premium route. Error:`, error);
        notFound();
    }

    if (!predictionData) {
        notFound();
    }

    return (
        <>
            <Breadcrumb />

            <Suspense fallback={<RacePageSkeleton />}>
                <RacePageClient
                    initialDate={params.date}
                    initialPredictionData={predictionData}
                    initialSpecialPick={specialPickData}
                    initialTopHits={topHitsData}
                    articlesMeta={articlesMeta}
                    isPremium={true}
                    basePath="/premium/races"
                />
            </Suspense>
        </>
    );
}
