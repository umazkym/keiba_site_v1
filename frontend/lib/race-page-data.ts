import 'server-only';

import { cache } from 'react';
import {
    getPredictionsForDate,
    getSpecialPick,
    getTopPayoutHits,
    getWeeklyGradeRaces,
} from '@/lib/api';

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
    const [predictions, specialPick, topHits, gradeRaces] = await Promise.all([
        getStrictPredictionsForDate(date),
        getSpecialPick(date),
        getTopPayoutHits(),
        getWeeklyGradeRaces(),
    ]);

    return { predictions, specialPick, topHits, gradeRaces };
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
