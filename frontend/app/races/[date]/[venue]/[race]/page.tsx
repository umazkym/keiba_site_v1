import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate, getSpecialPick, getTopPayoutHits, getWeeklyGradeRaces } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RaceDayPrediction, RacePrediction, SpecialPick, TopPayoutHit, VenueRaces, WeeklyGradeRace } from "@/lib/types";
import { Suspense } from 'react';
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { notFound, redirect } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { getAllArticlesMeta } from '@/lib/articles';
import {
    getRaceDetailPath,
    getRaceIndexPolicy,
    isGradeRaceName,
    isVenueSlugForName,
    isValidRaceDate,
    parseRaceNumberParam,
} from '@/lib/race-url';

type Props = {
    params: {
        date: string;
        venue: string;
        race: string;
    };
};

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

async function getRacePageData(date: string) {
    const [predictions, specialPick, topHits, gradeRaces] = await Promise.all([
        getPredictionsForDate(date),
        getSpecialPick(date),
        getTopPayoutHits(),
        getWeeklyGradeRaces(),
    ]);

    return { predictions, specialPick, topHits, gradeRaces };
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

    const predictionData = await getPredictionsForDate(params.date);
    const selected = findRaceByStablePath(predictionData, params.venue, raceNumber);
    const raceName = selected?.race.race_name;
    const venueName = selected?.venue.venue_name;
    const indexPolicy = getRaceIndexPolicy(params.date, {
        isGradeRace: isGradeRaceName(raceName),
    });

    return {
        title: selected
            ? `${formattedDate} ${venueName} ${raceNumber}R ${raceName} | AI競馬データ分析`
            : `${formattedDate} ${raceNumber}R のAI競馬データ分析 | UMA-FREE`,
        description: selected
            ? `${formattedDate} ${venueName}${raceNumber}R ${raceName}を無料でデータ分析。AI偏差値、脚質予測、枠順傾向、対戦成績を確認できます。`
            : `${formattedDate}の中央・地方競馬のAI競馬データ分析。`,
        alternates: {
            canonical: canonicalUrl,
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

    let predictionData: RaceDayPrediction | null = null;
    let specialPickData: SpecialPick | null = null;
    let topHitsData: TopPayoutHit[] = [];
    let weeklyGradeRaces: WeeklyGradeRace[] = [];
    let selectedRace: RacePrediction | null = null;
    let selectedVenue: VenueRaces | null = null;
    const articlesMeta = getAllArticlesMeta();

    try {
        const { predictions, specialPick, topHits, gradeRaces } = await getRacePageData(params.date);
        predictionData = predictions;
        specialPickData = specialPick;
        topHitsData = topHits;
        weeklyGradeRaces = gradeRaces;

        if (!predictionData || ((predictionData.jra?.length ?? 0) === 0 && (predictionData.nar?.length ?? 0) === 0)) {
            notFound();
        }

        const selected = findRaceByStablePath(predictionData, params.venue, raceNumber);
        if (!selected) {
            notFound();
        }

        selectedRace = selected.race;
        selectedVenue = selected.venue;
    } catch (error) {
        console.error(`[Build Warning] Failed to fetch race detail for ${params.date}/${params.venue}/${params.race}. Error:`, error);
        notFound();
    }

    if (!predictionData || !selectedRace || !selectedVenue) {
        notFound();
    }

    const canonicalPath = getRaceDetailPath(params.date, selectedVenue.venue_name, selectedRace.race_number);
    const requestedPath = `/races/${params.date}/${params.venue.toLowerCase()}/${raceNumber}`;
    if (canonicalPath !== requestedPath) {
        redirect(canonicalPath);
    }

    const raceUrl = `https://uma-free.com${getRaceDetailPath(selectedRace.race_date, selectedVenue.venue_name, selectedRace.race_number)}`;
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

            <Breadcrumb />

            <Suspense fallback={<RacePageSkeleton />}>
                <RacePageClient
                    initialDate={params.date}
                    initialPredictionData={predictionData}
                    initialSpecialPick={specialPickData}
                    initialTopHits={topHitsData}
                    weeklyGradeRaces={weeklyGradeRaces}
                    articlesMeta={articlesMeta}
                    initialVenueName={selectedVenue.venue_name}
                    initialRaceNumber={selectedRace.race_number}
                />
            </Suspense>
        </>
    );
}
