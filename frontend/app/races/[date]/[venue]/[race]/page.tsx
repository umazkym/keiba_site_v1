import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { formatDate } from "@/lib/utils";
import { RaceDayPrediction, RacePrediction, VenueRaces } from "@/lib/types";
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
    isVenueSlugForName,
    isValidRaceDate,
    parseRaceNumberParam,
} from '@/lib/race-url';
import {
    getRacePageData,
    getStrictPredictionsForDate,
    hasRaceDayData,
} from '@/lib/race-page-data';

export const revalidate = 3600;
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

function findRaceByStablePath(
    predictionData: RaceDayPrediction | null,
    venueSlug: string,
    raceNumber: number,
): { venue: VenueRaces; race: RacePrediction } | null {
    const venues = [...(predictionData?.jra ?? []), ...(predictionData?.nar ?? [])];

    for (const venue of venues) {
        if (!isVenueSlugForName(venueSlug, venue.venue_name)) continue;
        const race = venue.races.find((item) => item.race_number === raceNumber);
        if (race) {
            return { venue, race };
        }
    }

    return null;
}

function buildSelectedRacePredictionData(
    predictionData: RaceDayPrediction,
    selectedVenue: VenueRaces,
    selectedRace: RacePrediction,
): RaceDayPrediction {
    const isJraVenue = (predictionData.jra ?? []).some((venue) => venue.venue_name === selectedVenue.venue_name);
    const venueData = {
        ...selectedVenue,
        races: [selectedRace],
    };

    return isJraVenue
        ? { jra: [venueData], nar: [] }
        : { jra: [], nar: [venueData] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const raceNumber = parseRaceNumberParam(params.race);
    const formattedDate = formatDate(params.date);
    const canonicalUrl = raceNumber
        ? getRaceDetailPath(params.date, params.venue, raceNumber)
        : `/races/${params.date}`;

    if (!isValidRaceDate(params.date) || !raceNumber) {
        return {
            title: `${formattedDate}のAI競馬データ分析 | UMA-FREE`,
            description: `${formattedDate}の中央・地方競馬のAI競馬データ分析。`,
            alternates: { canonical: `/races/${params.date}` },
            robots: { index: false, follow: true },
        };
    }

    const predictionData = await getStrictPredictionsForDate(params.date);
    const selected = findRaceByStablePath(predictionData, params.venue, raceNumber);
    const raceName = selected?.race.race_name;
    const venueName = selected?.venue.venue_name;
    const indexPolicy = getRaceIndexPolicy(params.date, {
        isGradeRace: isGradeRaceName(raceName),
    });
    const courseLabel = selected?.race.course_type && selected.race.distance
        ? `${selected.race.course_type}${selected.race.distance}m`
        : '';
    const seoTitle = selected
        ? `${venueName}${raceNumber}R ${raceName} AI予想・出走馬分析 | UMA-FREE`
        : `${formattedDate} ${raceNumber}R AI競馬データ分析 | UMA-FREE`;
    const seoDescription = selected
        ? `${formattedDate} ${venueName}${raceNumber}R ${raceName}${courseLabel ? `（${courseLabel}）` : ''}のAI予想。出走馬のAI偏差値、枠順、脚質、展開材料を無料で確認できます。`
        : `${formattedDate} ${raceNumber}RのAI競馬データ分析。AI偏差値、枠順、脚質、展開材料を確認できます。`;

    return {
        title: seoTitle,
        description: seoDescription,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: seoTitle,
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

    let selectedRace: RacePrediction | null = null;
    let selectedVenue: VenueRaces | null = null;
    const articlesMeta = getRaceArticleMeta();

    const {
        predictions: predictionData,
        specialPick: specialPickData,
        topHits: topHitsData,
        gradeRaces: weeklyGradeRaces,
    } = await getRacePageData(params.date);

    if (!hasRaceDayData(predictionData)) {
        notFound();
    }

    const selected = findRaceByStablePath(predictionData, params.venue, raceNumber);
    if (!selected) {
        notFound();
    }
    selectedRace = selected.race;
    selectedVenue = selected.venue;
    const selectedPredictionData = buildSelectedRacePredictionData(
        predictionData,
        selectedVenue,
        selectedRace,
    );
    const initialRaceLinks = selectedVenue.races
        .slice()
        .sort((left, right) => left.race_number - right.race_number)
        .map(race => ({
            raceNumber: race.race_number,
            href: getRaceDetailPath(params.date, selectedVenue.venue_name, race.race_number),
        }));

    const canonicalPath = getRaceDetailPath(params.date, selectedVenue.venue_name, selectedRace.race_number);
    const requestedPath = `/races/${params.date}/${params.venue.toLowerCase()}/${raceNumber}`;
    if (canonicalPath !== requestedPath) {
        redirect(canonicalPath);
    }

    const raceUrl = `https://uma-free.com${getRaceDetailPath(selectedRace.race_date, selectedVenue.venue_name, selectedRace.race_number)}`;
    const formattedDate = formatDate(params.date);
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        "name": `${selectedVenue.venue_name} ${selectedRace.race_number}R - ${selectedRace.race_name}`,
        "startDate": `${selectedRace.race_date}T15:45:00+09:00`,
        "endDate": `${selectedRace.race_date}T16:00:00+09:00`,
        "location": {
            "@type": "Place",
            "name": `${selectedVenue.venue_name}競馬場`,
            "address": `${selectedVenue.venue_name}競馬場`
        },
        "description": `AIによる${selectedVenue.venue_name} ${selectedRace.race_number}R ${selectedRace.race_name}の競馬データ分析。`,
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
                    { name: `${selectedVenue.venue_name}${selectedRace.race_number}R ${selectedRace.race_name}`, url: raceUrl },
                ]}
            />

            <Breadcrumb
                items={[
                    { label: 'ホーム', href: '/' },
                    { label: 'レース分析', href: '/races/today' },
                    { label: `${formattedDate}のレース分析`, href: `/races/${params.date}` },
                    { label: `${selectedVenue.venue_name}${selectedRace.race_number}R ${selectedRace.race_name}`, href: '' },
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
                    initialVenueName={selectedVenue.venue_name}
                    initialRaceNumber={selectedRace.race_number}
                    initialRaceLinks={initialRaceLinks}
                />
            </Suspense>
        </>
    );
}
