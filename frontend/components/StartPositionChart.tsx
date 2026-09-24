'use client';

import { HorsePrediction } from '@/lib/types';
import { getWakuClasses } from '@/lib/waku';

const getWakuColor = (waku: number | null): string => getWakuClasses(waku);

const HorseMarker = ({ horse, position, top, compact = false, isAiTop = false }: { horse: HorsePrediction; position: number; top: number; compact?: boolean; isAiTop?: boolean }) => {
    const scoreLabel = horse.start_1c_indicator?.toFixed(1) || '算出なし';
    return (
        <span
            className="absolute flex flex-col items-center transition-[top,left] duration-300"
            aria-label={`${horse.horse_number}番 ${horse.horse_name}、位置取りスコア${scoreLabel}`}
            title={`${horse.horse_name} / スコア ${scoreLabel}`}
            style={{
                top: `${top}px`,
                left: `${position}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 10 + horse.horse_number,
            }}
        >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] font-num text-[13px] font-bold ${isAiTop ? 'ring-[2.5px] ring-ai ring-offset-1 ring-offset-turf-soft' : ''} ${getWakuColor(horse.waku_number)}`}>
                {horse.horse_number}
            </span>
            {!compact && (
                <span className="mt-px inline-block max-w-[58px] truncate px-1 text-[11px] font-bold leading-none text-slate-700">
                    {Array.from(horse.horse_name).slice(0, 3).join('')}
                </span>
            )}
        </span>
    );
};

const TrackView = ({
    horses,
    minScore,
    scoreRange,
    height,
    laneCount,
    compact = false,
    aiTopNumbers,
}: {
    horses: HorsePrediction[];
    minScore: number;
    scoreRange: number;
    height: number;
    laneCount: number;
    compact?: boolean;
    aiTopNumbers: Set<number>;
}) => {
    const topPadding = compact ? 18 : 24;
    const bottomPadding = compact ? 18 : 30;
    const usableLanes = Math.max(1, Math.min(laneCount, horses.length));
    const markerSpacing = usableLanes > 1
        ? (height - topPadding - bottomPadding) / (usableLanes - 1)
        : 0;

    return (
        <div>
            <div className="relative w-full overflow-hidden rounded-xl bg-turf-soft" style={{ height: `${height}px` }}>
                <div className="absolute inset-y-0 left-1/3 w-1/3 border-x border-dashed border-turf/30" />
                {horses.map((horse, index) => {
                    const position = scoreRange > 0.01
                        ? 6 + (((horse.start_1c_indicator as number) - minScore) / scoreRange) * 88
                        : 50;
                    const laneIndex = compact ? index % usableLanes : index;
                    return (
                        <HorseMarker
                            key={horse.horse_number}
                            horse={horse}
                            position={position}
                            top={topPadding + laneIndex * markerSpacing}
                            compact={compact}
                            isAiTop={aiTopNumbers.has(horse.horse_number)}
                        />
                    );
                })}
            </div>
            <div className="mt-1.5 flex justify-between px-1 text-[12px] font-bold text-turf-deep sm:px-2 sm:text-[13px]">
                <span>後方・差し</span>
                <span>中団</span>
                <span className="inline-flex items-center gap-1">先行・逃げ<span aria-hidden="true">→</span></span>
            </div>
        </div>
    );
};

export const StartPositionChart = ({ predictions }: { predictions: HorsePrediction[] }) => {
    // AI偏差値の上位3頭に琥珀の輪を付ける
    const aiTopNumbers = new Set(
        [...(predictions ?? [])]
            .filter((prediction) => prediction.deviation_score != null)
            .sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number))
            .slice(0, 3)
            .map((prediction) => prediction.horse_number),
    );
    const validPredictions = predictions?.filter(prediction => prediction.start_1c_indicator != null) ?? [];
    if (validPredictions.length === 0) {
        return (
            <div className="my-2 rounded-lg bg-slate-100 p-3 text-center text-sm text-slate-600">
                このレースの展開/脚質予測はありません。
            </div>
        );
    }

    const scores = validPredictions.map(prediction => prediction.start_1c_indicator as number);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;
    const sortedByNumber = [...validPredictions].sort((a, b) => a.horse_number - b.horse_number);
    return (
        <div className="h-full">
            <div className="md:hidden" aria-label="序盤の位置取り予測">
                <TrackView
                    horses={sortedByNumber}
                    minScore={minScore}
                    scoreRange={scoreRange}
                    height={128}
                    laneCount={8}
                    compact
                    aiTopNumbers={aiTopNumbers}
                />
            </div>

            <div className="hidden md:block md:p-2">
                <TrackView
                    horses={sortedByNumber}
                    minScore={minScore}
                    scoreRange={scoreRange}
                    height={184}
                    laneCount={sortedByNumber.length}
                    aiTopNumbers={aiTopNumbers}
                />
            </div>
        </div>
    );
};
