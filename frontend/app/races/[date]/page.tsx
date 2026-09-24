import type { Metadata } from "next";
import type { ReactNode } from 'react';
import { formatDate } from "@/lib/utils";
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { CourseGlyph } from '@/components/CourseGlyph';
import { RaceDateNav } from '@/components/RaceDateNav';
import { RaceDayBoard } from '@/components/RaceDayBoard';
import { RaceDayExtras } from '@/components/RaceDayExtras';
import { buildRaceDaySummary } from '@/lib/race-day-summary';
import { buildGradeRaceTopHorseMap } from '@/lib/home-page-summary';
import { formatRaceDateLabel } from '@/lib/race-display';
import {
    getDaysFromToday,
    getRaceDetailPath,
    getRaceIndexPolicy,
} from '@/lib/race-url';
import { getRacePageData, hasRaceDayData } from '@/lib/race-page-data';

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

    // ボードに渡すのは一覧に必要な値だけ（全馬の予測データはクライアントへ送らない）。
    const summary = buildRaceDaySummary(predictionData, params.date);
    const gradeRaceTopHorses = buildGradeRaceTopHorseMap(predictionData, weeklyGradeRaces);
    // コース図はサーバーで描いて渡す（コースのデータはクライアントへ送らない）
    const glyphs: Record<string, ReactNode> = {};
    [...summary.jra, ...summary.nar].forEach((venue) => {
        glyphs[venue.venue] = <CourseGlyph venue={venue.venue} className="block h-auto w-full" />;
    });

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

            <div className="race-page-scope site-shell-wide flex flex-col gap-3 pb-6 md:gap-5">
                <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <h1 className="text-[22px] font-extrabold leading-tight text-slate-900 md:text-[32px]">
                        {formatRaceDateLabel(params.date)}のレース分析
                    </h1>
                    <RaceDateNav date={params.date} />
                </header>

                <RaceDayBoard
                    initialSummary={summary}
                    glyphs={glyphs}
                    refetchIfEmpty={!hasData && isDataArrivalWindow}
                />

                <RaceDayExtras
                    date={params.date}
                    hasRaces={hasData}
                    hasNarRaces={summary.nar.length > 0}
                    specialPick={specialPickData}
                    topHits={topHitsData}
                    weeklyGradeRaces={weeklyGradeRaces}
                    gradeRaceTopHorses={gradeRaceTopHorses}
                />
            </div>
        </>
    );
}
