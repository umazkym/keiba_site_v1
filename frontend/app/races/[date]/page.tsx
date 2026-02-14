import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RaceDayPrediction } from "@/lib/types";
import { Suspense } from 'react';
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
// ▼▼▼▼▼【修正】notFouund をインポート ▼▼▼▼▼
import { notFound } from 'next/navigation';
// ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

export const dynamic = 'force-dynamic';
export const revalidate = 300;  // ISR: 5分ごと再生成（データ更新遅延を最小化）

export async function generateStaticParams() {
    const today = new Date();
    const paths = [];

    // 過去30日から未来14日までの日付を生成（SEO最適化）
    // Google Search Consoleの404を減らすため、より広い範囲をカバー
    for (let i = -30; i <= 14; i++) {
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
        // ▼▼▼▼▼【修正: canonical URLのパラメータ順序を統一】▼▼▼▼▼
        // Googleが重複判定を避けるため、クエリパラメータの順序を常に 'race' → 'venue' に統一
        canonicalUrl = `/races/${params.date}?race=${race}&venue=${venue}`;
        // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
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
    <div className="py-4">
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

        // ▼▼▼▼▼【修正】データが存在しない場合（ソフト404対策）▼▼▼▼▼
        // データ取得失敗(null) または データが空 の場合は 404 ページを表示
        if (!predictionData || (predictionData.jra.length === 0 && predictionData.nar.length === 0)) {
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
                "description": `AIによる${mainRace.venue_name} ${mainRace.race_number}R ${mainRace.race_name}の競馬予測データ。`,
                "eventStatus": "https://schema.org/EventScheduled",
                // ▼▼▼▼▼【修正: JSON-LD URLのパラメータ順序を統一】▼▼▼▼▼
                "url": `https://uma-free.com/races/${mainRace.race_date}?race=${mainRace.race_number}&venue=${encodeURIComponent(mainRace.venue_name)}`,
                // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
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
                    // ▼▼▼▼▼【修正: JSON-LD URLのパラメータ順序を統一】▼▼▼▼▼
                    "url": `https://uma-free.com/races/${mainRace.race_date}?race=${mainRace.race_number}&venue=${encodeURIComponent(mainRace.venue_name)}`,
                    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
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
        // ▼▼▼▼▼【修正】データ取得例外時も404を返す ▼▼▼▼▼
        // APIエラーなどでデータが取得できなかった場合も404扱いにする
        notFound();
        // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
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

            <Suspense fallback={<RacePageSkeleton />}>
                <RacePageClient
                    initialDate={params.date}
                    initialPredictionData={predictionData}
                />
            </Suspense>
        </>
    );
}