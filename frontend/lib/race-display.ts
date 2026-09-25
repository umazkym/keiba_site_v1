// レース画面・開催日ボード・分析文で共通に使う表示の決まり。
import type { HorsePrediction, RacePrediction } from '@/lib/types';
import { getWakuNumber } from '@/lib/utils';

export type GradeKey = 'g1' | 'g2' | 'g3' | 'local';
export type SurfaceKey = 'turf' | 'dirt' | 'jump';
export type PositionLabel = '先行' | '中団' | '後方';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// 印は「〇」と「○」が混在するため「○」にそろえる。印なしは null。
export const normalizeMark = (mark: string | null | undefined): string | null => {
    const value = (mark ?? '').replace(/〇/g, '○').trim();
    if (!value || value === '—' || value === '−' || value === '-') return null;
    return value;
};

export const getGradeKey = (grade: string | null | undefined): GradeKey | null => {
    if (!grade) return null;
    const normalized = grade.toUpperCase();
    if (/(^|[^0-9])1$/.test(normalized)) return 'g1';
    if (/(^|[^0-9])2$/.test(normalized)) return 'g2';
    if (/(^|[^0-9])3$/.test(normalized)) return 'g3';
    return 'local';
};

// バッジに出す文字。地方重賞は「重賞」だけにする。
export const getGradeLabel = (grade: string | null | undefined): string | null => {
    if (!grade) return null;
    return grade === '地方重賞' ? '重賞' : grade;
};

export const getSurfaceKey = (courseType: string | null | undefined): SurfaceKey | null => {
    if (!courseType) return null;
    if (courseType.includes('障')) return 'jump';
    if (courseType.includes('芝')) return 'turf';
    if (courseType.includes('ダ')) return 'dirt';
    return null;
};

export const getSurfaceLabel = (courseType: string | null | undefined): string => {
    const key = getSurfaceKey(courseType);
    if (key === 'turf') return '芝';
    if (key === 'dirt') return 'ダ';
    if (key === 'jump') return '障害';
    return courseType ?? '';
};

// 序盤の位置取り：レース内の相対値で3つに分ける（全頭が0以上でも「全頭が先行」にならない）。
export const getPositionLabel = (
    indicator: number | null | undefined,
    minScore: number,
    maxScore: number,
): PositionLabel | null => {
    if (indicator == null) return null;
    const range = maxScore - minScore;
    if (range < 0.01) return '中団';
    const ratio = (indicator - minScore) / range;
    if (ratio < 0.35) return '後方';
    if (ratio > 0.65) return '先行';
    return '中団';
};

export const getPositionLabels = (predictions: HorsePrediction[]): Map<number, PositionLabel> => {
    const scores = predictions
        .map((p) => p.start_1c_indicator)
        .filter((value): value is number => value != null);
    const labels = new Map<number, PositionLabel>();
    if (scores.length === 0) return labels;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    predictions.forEach((p) => {
        const label = getPositionLabel(p.start_1c_indicator, min, max);
        if (label) labels.set(p.horse_number, label);
    });
    return labels;
};

export const resolveWaku = (prediction: Pick<HorsePrediction, 'waku_number' | 'horse_number'>, runnerCount: number): number | null => (
    prediction.waku_number && prediction.waku_number >= 1 && prediction.waku_number <= 8
        ? prediction.waku_number
        : getWakuNumber(prediction.horse_number, runnerCount)
);

// AI偏差値の順位（偏差値のある馬だけで数える）。
export const getAiRanks = (predictions: HorsePrediction[]): Map<number, number> => {
    const ranked = predictions
        .filter((p) => p.deviation_score != null)
        .sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number));
    return new Map(ranked.map((p, index) => [p.horse_number, index + 1]));
};

export const getFinishRanks = (race: Pick<RacePrediction, 'results'>): Map<number, number> => (
    new Map(
        (race.results ?? [])
            .filter((result) => result.rank != null && result.rank > 0)
            .map((result) => [result.horse_number, result.rank as number]),
    )
);

export const hasRaceResults = (race: Pick<RacePrediction, 'results'>): boolean => (
    (race.results ?? []).some((result) => result.rank != null && result.rank > 0)
);

// AI偏差値を算出できないレース（新馬戦・障害戦など）と、その理由。
export const getUnpredictableReason = (race: Pick<RacePrediction, 'predictions'>): string | null => {
    const hasAnyScore = race.predictions.some((p) => p.deviation_score != null);
    if (hasAnyScore) return null;
    const reason = race.predictions.find((p) => p.unpredictable_reason)?.unpredictable_reason;
    if (reason) return reason;
    return race.predictions.length === 0 ? '出走馬のデータがありません' : '過去データが不足しているため';
};

export const getSeason = (raceDate: string): Season => {
    const month = Number(raceDate.slice(5, 7));
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// 「9月20日(日)」。year: true で「2026年9月20日(日)」、short: true で「9/20(日)」（スマホのレースの見出しの条件の行）。
export const formatRaceDateLabel = (
    raceDate: string,
    { year = false, short = false }: { year?: boolean; short?: boolean } = {},
): string => {
    const [y, m, d] = raceDate.slice(0, 10).split('-').map(Number);
    const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    if (short) return `${m}/${d}(${weekday})`;
    return `${year ? `${y}年` : ''}${m}月${d}日(${weekday})`;
};

// スマホの対戦成績に出す「AI偏差値の上位5頭」（偏差値の高い順。偏差値の無い馬は数えない）。
export const getTopAiPredictions = (predictions: HorsePrediction[], count = 5): HorsePrediction[] => (
    predictions
        .filter((p) => p.deviation_score != null)
        .sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number))
        .slice(0, count)
);
