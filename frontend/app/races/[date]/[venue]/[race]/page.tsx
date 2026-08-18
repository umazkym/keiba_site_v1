import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { formatDate } from "@/lib/utils";
import { Suspense } from 'react';
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { notFound, redirect } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { getRaceArticleMeta } from '@/lib/articles';
import {
    getRaceDetailPath,
    getRaceIndexPolicy,
    isGradeRaceName,
    isValidRaceDate,
    parseRaceNumberParam,
} from '@/lib/race-url';
import {
    getRaceDetailPageData,
    getStrictRaceDetailPrediction,
} from '@/lib/race-page-data';

export const revalidate = 2592000;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

type Props = {
    params: {
        date: string;
        venue: string;
        race: string;
    };
};

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const raceNumber = parseRaceNumberParam(params.race);
    const formattedDate = formatDate(params.date);
    const canonicalUrl = raceNumber
        ? getRaceDetailPath(params.date, params.venue, raceNumber)
        : `/races/${params.date}`;

    if (!isValidRaceDate(params.date) || !raceNumber) {
        return {
            title: `${formattedDate}のAI競馬データ分析`,
            description: `${formattedDate}の中央・地方競馬のAI競馬データ分析。`,
            alternates: { canonical: `/races/${params.date}` },
            robots: { index: false, follow: false },
        };
    }

    const detail = await getStrictRaceDetailPrediction(params.date, params.venue, raceNumber);
    const raceName = detail?.race.race_name;
    const venueName = detail?.venue_name;
    const indexPolicy = getRaceIndexPolicy(params.date, {
        // APIのgradeを優先する。race_nameは整形済みで末尾の「重賞」表記が
        // 残らないため、名前による判定はgradeを返さない旧APIと過去データの
        // フォールバックとしてのみ使う。
        isGradeRace: Boolean(detail?.race.grade) || isGradeRaceName(raceName),
    });
    const courseLabel = detail?.race.course_type && detail.race.distance
        ? `${detail.race.course_type}${detail.race.distance}m`
        : '';
    const seoTitle = detail
        ? `${venueName}${raceNumber}R ${raceName} AI予想・出走馬分析`
        : `${formattedDate} ${raceNumber}R AI競馬データ分析`;
    const socialTitle = `${seoTitle} | UMA-FREE`;
    const seoDescription = detail
        ? `${formattedDate} ${venueName}${raceNumber}R ${raceName}${courseLabel ? `（${courseLabel}）` : ''}のAI予想。出走馬のAI偏差値、枠順、脚質、展開材料を無料で確認できます。`
        : `${formattedDate} ${raceNumber}RのAI競馬データ分析。AI偏差値、枠順、脚質、展開材料を確認できます。`;

    return {
        title: seoTitle,
        description: seoDescription,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: socialTitle,
            description: seoDescription,
            url: `https://uma-free.com${canonicalUrl}`,
            siteName: 'UMA-FREE',
            locale: 'ja_JP',
            type: 'article',
        },
        robots: {
            index: indexPolicy.index,
            follow: indexPolicy.follow,
        },
    };
}

export default async function RaceDetailPage({ params }: Props) {
    const raceNumber = parseRaceNumberParam(params.race);

    if (!isValidRaceDate(params.date) || !raceNumber) {
        notFound();
    }

    const articlesMeta = getRaceArticleMeta();

    const {
        detail,
        specialPick: specialPickData,
        topHits: topHitsData,
        gradeRaces: weeklyGradeRaces,
    } = await getRaceDetailPageData(params.date, params.venue, raceNumber);

    if (!detail) {
        notFound();
    }

    const selectedRace = detail.race;
    const selectedVenueName = detail.venue_name;
    const selectedPredictionData = detail.race_type === '中央'
        ? { jra: [{ venue_name: selectedVenueName, races: [selectedRace] }], nar: [] }
        : { jra: [], nar: [{ venue_name: selectedVenueName, races: [selectedRace] }] };
    const detailIndexPolicy = getRaceIndexPolicy(params.date, {
        isGradeRace: Boolean(selectedRace.grade) || isGradeRaceName(selectedRace.race_name),
    });
    const initialRaceLinks = detail.race_numbers.map(raceNumberItem => ({
        raceNumber: raceNumberItem,
        href: getRaceDetailPath(params.date, selectedVenueName, raceNumberItem),
        rel: detailIndexPolicy.follow ? undefined : 'nofollow' as const,
    }));

    const canonicalPath = getRaceDetailPath(params.date, selectedVenueName, selectedRace.race_number);
    const requestedPath = `/races/${params.date}/${params.venue.toLowerCase()}/${raceNumber}`;
    if (canonicalPath !== requestedPath) {
        redirect(canonicalPath);
    }

    const raceUrl = `https://uma-free.com${getRaceDetailPath(selectedRace.race_date, selectedVenueName, selectedRace.race_number)}`;
    const formattedDate = formatDate(params.date);
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        "name": `${selectedVenueName} ${selectedRace.race_number}R - ${selectedRace.race_name}`,
        "startDate": `${selectedRace.race_date}T15:45:00+09:00`,
        "endDate": `${selectedRace.race_date}T16:00:00+09:00`,
        "location": {
            "@type": "Place",
            "name": `${selectedVenueName}競馬場`,
            "address": `${selectedVenueName}競馬場`
        },
        "description": `AIによる${selectedVenueName} ${selectedRace.race_number}R ${selectedRace.race_name}の競馬データ分析。`,
        "eventStatus": "https://schema.org/EventScheduled",
        "url": raceUrl,
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
            "url": raceUrl,
            "price": "0",
            "priceCurrency": "JPY",
            "availability": "https://schema.org/InStock",
            "validFrom": `${selectedRace.race_date}T00:00:00+09:00`,
            "validThrough": `${selectedRace.race_date}T23:59:59+09:00`
        },
        "performer": selectedRace.predictions.map(p => ({
            "@type": "SportsTeam",
            "name": p.horse_name
        })),
        "competitor": selectedRace.predictions.map(p => ({
            "@type": "SportsTeam",
            "name": p.horse_name
        }))
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: 'レース分析', url: 'https://uma-free.com/races/today' },
                    { name: `${formattedDate}のレース分析`, url: `https://uma-free.com/races/${params.date}` },
                    { name: `${selectedVenueName}${selectedRace.race_number}R ${selectedRace.race_name}`, url: raceUrl },
                ]}
            />

            <Breadcrumb
                items={[
                    { label: 'ホーム', href: '/' },
                    { label: 'レース分析', href: '/races/today' },
                    { label: `${formattedDate}のレース分析`, href: `/races/${params.date}` },
                    { label: `${selectedVenueName}${selectedRace.race_number}R ${selectedRace.race_name}`, href: '' },
                ]}
            />

            <Suspense fallback={<RacePageSkeleton />}>
                <RacePageClient
                    initialDate={params.date}
                    initialPredictionData={selectedPredictionData}
                    initialSpecialPick={specialPickData}
                    initialTopHits={topHitsData}
                    weeklyGradeRaces={weeklyGradeRaces}
                    articlesMeta={articlesMeta}
                    initialVenueName={selectedVenueName}
                    initialRaceNumber={selectedRace.race_number}
                    initialRaceLinks={initialRaceLinks}
                />
            </Suspense>
        </>
    );
}
