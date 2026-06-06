import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate, getSpecialPick, getTopPayoutHits, getWeeklyGradeRaces } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RaceDayPrediction, SpecialPick, TopPayoutHit, WeeklyGradeRace } from "@/lib/types";
import { Suspense } from 'react';
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { getAllArticlesMeta } from '@/lib/articles';
import {
    getRaceDetailPath,
    getRaceIndexPolicy,
} from '@/lib/race-url';

// ▼▼▼▼▼【ISR導入】▼▼▼▼▼
// 従来: export const dynamic = 'force-dynamic' で毎回フルSSR
// 変更: ISRに切り替え。api.tsのfetchに revalidate を設定済み。
// レースデータは1日2〜3回の定時バッチ更新のため、リアルタイムSSRは不要。
// ▲▲▲▲▲【ISR導入ここまで】▲▲▲▲▲

export async function generateMetadata(
    { params, searchParams }: {
        params: { date: string };
        searchParams: { [key: string]: string | string[] | undefined };
    }
): Promise<Metadata> {
    const formattedDate = formatDate(params.date);
    const venue = searchParams.venue as string;
    const race = searchParams.race as string;

    let title = `${formattedDate}のAI競馬データ分析 | UMA-FREE`;
    let description = `${formattedDate}の中央・地方競馬の全レースをAIが完全無料でデータ分析。馬券検討に役立つ統計情報を毎日更新。`;
    let canonicalUrl = `/races/${params.date}`;
    const indexPolicy = getRaceIndexPolicy(params.date);

    if (venue && race) {
        const venueName = decodeURIComponent(venue);
        title = `${formattedDate} ${venueName} ${race}R のAI競馬データ分析 | UMA-FREE`;
        description = `AIによる${formattedDate} ${venueName}競馬場 ${race}Rの無料データ分析。偏差値、対戦成績、枠順データで詳細分析。`;
        // レース詳細は日付ページ内の状態として扱い、canonicalは日付ページへ集約する。
        // クエリ付きURLの大量重複を避け、Search Consoleのcanonical差し替えを減らす。
        canonicalUrl = `/races/${params.date}`;
    }

    return {
        title: title,
        description: description,
        alternates: {
            canonical: canonicalUrl,
        },
        robots: {
            index: indexPolicy.index,
            follow: indexPolicy.follow,
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
    let weeklyGradeRaces: WeeklyGradeRace[] = [];
    let jsonLd = null;
    const articlesMeta = getAllArticlesMeta();
    const formattedDate = formatDate(params.date);

    try {
        // ▼▼▼▼▼【SSRプリフェッチ統合】▼▼▼▼▼
        // 従来: predictionDataのみSSR、specialPick/topHitsはクライアント側で独立APIコール
        // 変更: Promise.allで3つのAPIコールを並列実行し、全データをSSRで取得
        // メリット: クライアント側のAPIコールが0に、サーバー側も並列で処理時間短縮
        const [predictions, specialPick, topHits, gradeRaces] = await Promise.all([
            getPredictionsForDate(params.date),
            getSpecialPick(params.date),
            getTopPayoutHits(),
            getWeeklyGradeRaces(),
        ]);
        predictionData = predictions;
        specialPickData = specialPick;
        topHitsData = topHits;
        weeklyGradeRaces = gradeRaces;
        // ▲▲▲▲▲【SSRプリフェッチ統合ここまで】▲▲▲▲▲

        // データが存在しない場合（ソフト404対策）
        if (!predictionData || ((predictionData.jra?.length ?? 0) === 0 && (predictionData.nar?.length ?? 0) === 0)) {
            console.log(`[Data Info] No prediction data found for ${params.date}. Returning 404.`);
            notFound();
        }
        // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

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

    } catch (error) {
        console.error(`[Build Warning] Failed to fetch initial data for ${params.date}. Error:`, error);
        // API未到達の場合は即座に404を返す（Googleクローラーに500を返さないため）
        notFound();
    }

    // ▼▼▼▼▼【修正】predictionDataがnullの可能性を再度チェック（try-catchを抜けたがデータがnullの場合）▼▼▼▼▼
    // 上部のチェックで既に notFound() が呼ばれているはずだが、念のためここでもチェックする
    // ただし、try-catch内で例外が発生した場合は、このreturnには到達しない
    if (!predictionData) {
        // このコードパスには通常到達しないはずだが、
        // tryブロック内でエラーが発生せず、predictionDataがnullのままの場合（現在はcatchで処理）
        // のフォールバックとして
        console.log(`[Data Info] Fallback check: No prediction data for ${params.date}. Returning 404.`);
        notFound();
    }
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

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

            <Breadcrumb />

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
