import 'server-only';

import { cache } from 'react';
import {
    getPredictionsForDate,
    getRaceDetailPrediction,
    getSpecialPick,
    getTopPayoutHits,
    getWeeklyGradeRaces,
} from '@/lib/api';
import type { RaceDetailPrediction } from '@/lib/types';
import { getRaceCachePolicy } from '@/lib/race-cache-policy';
import { isVenueSlugForName } from '@/lib/race-url';

/**
 * 同一リクエスト内のmetadata生成とページ生成で予測APIを重複呼び出ししない。
 * 予測APIの一時障害は例外として扱い、ISRの正常キャッシュを404で上書きしない。
 */
export const getStrictPredictionsForDate = cache(async (date: string) => {
    const predictions = await getPredictionsForDate(date, { throwOnError: true });
    if (!predictions) {
        throw new Error(`Prediction data is unavailable for ${date}`);
    }
    return predictions;
});

export const getRacePageData = cache(async (date: string) => {
    const predictions = await getStrictPredictionsForDate(date);
    if (getRaceCachePolicy(date).tier !== 'recent') {
        const specialPick = await getSpecialPick(date);
        return { predictions, specialPick, topHits: [], gradeRaces: [] };
    }

    const [specialPick, topHits, gradeRaces] = await Promise.all([
        getSpecialPick(date),
        getTopPayoutHits(),
        getWeeklyGradeRaces(),
    ]);

    return { predictions, specialPick, topHits, gradeRaces };
});

export const getStrictRaceDetailPrediction = cache(async (
    date: string,
    venueSlug: string,
    raceNumber: number,
): Promise<RaceDetailPrediction | null> => {
    if (process.env.RACE_DETAIL_API_MODE === 'legacy') {
        const predictions = await getStrictPredictionsForDate(date);
        const venues = [...(predictions.jra ?? []), ...(predictions.nar ?? [])];
        const venue = venues.find((item) => isVenueSlugForName(venueSlug, item.venue_name));
        const race = venue?.races.find((item) => item.race_number === raceNumber);
        if (!venue || !race) return null;
        const raceType = (predictions.jra ?? []).some((item) => item.venue_name === venue.venue_name)
            ? '中央'
            : '地方';
        return {
            race_type: raceType,
            venue_name: venue.venue_name,
            race,
            race_numbers: venue.races
                .map((item) => item.race_number)
                .sort((left, right) => left - right),
        };
    }

    return getRaceDetailPrediction(date, venueSlug, raceNumber, { throwOnError: true });
});

export const getRaceDetailPageData = cache(async (
    date: string,
    venueSlug: string,
    raceNumber: number,
) => {
    const detail = await getStrictRaceDetailPrediction(date, venueSlug, raceNumber);
    if (!detail) {
        return {
            detail: null,
            specialPick: null,
            topHits: [],
            gradeRaces: [],
        };
    }

    if (getRaceCachePolicy(date).tier !== 'recent') {
        return {
            detail,
            specialPick: null,
            topHits: [],
            gradeRaces: [],
        };
    }

    const [specialPick, topHits, gradeRaces] = await Promise.all([
        getSpecialPick(date),
        getTopPayoutHits(),
        getWeeklyGradeRaces(),
    ]);
    return { detail, specialPick, topHits, gradeRaces };
});

export function hasRaceDayData(
    predictionData: Awaited<ReturnType<typeof getStrictPredictionsForDate>>,
): boolean {
    return Boolean(
        predictionData
        && (
            (predictionData.jra?.length ?? 0) > 0
            || (predictionData.nar?.length ?? 0) > 0
        )
    );
}
