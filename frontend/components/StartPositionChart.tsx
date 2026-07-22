'use client';

import { HorsePrediction } from '@/lib/types';

const getWakuColor = (waku: number | null): string => {
    switch (waku) {
        case 1: return 'border-slate-300 bg-white text-slate-900';
        case 2: return 'border-slate-950 bg-slate-950 text-white';
        case 3: return 'border-red-600 bg-red-600 text-white';
        case 4: return 'border-blue-600 bg-blue-600 text-white';
        case 5: return 'border-yellow-400 bg-yellow-400 text-slate-950';
        case 6: return 'border-green-600 bg-green-600 text-white';
        case 7: return 'border-orange-600 bg-orange-600 text-white';
        case 8: return 'border-pink-500 bg-pink-500 text-white';
        default: return 'border-slate-300 bg-slate-100 text-slate-800';
    }
};

const HorseMarker = ({ horse, position, top, compact = false }: { horse: HorsePrediction; position: number; top: number; compact?: boolean }) => {
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
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold shadow-sm ${getWakuColor(horse.waku_number)}`}>
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
}: {
    horses: HorsePrediction[];
    minScore: number;
    scoreRange: number;
    height: number;
    laneCount: number;
    compact?: boolean;
}) => {
    const topPadding = compact ? 18 : 24;
    const bottomPadding = compact ? 18 : 30;
    const usableLanes = Math.max(1, Math.min(laneCount, horses.length));
    const markerSpacing = usableLanes > 1
        ? (height - topPadding - bottomPadding) / (usableLanes - 1)
        : 0;

    return (
        <div>
            <div className="relative w-full overflow-hidden rounded-lg bg-slate-50" style={{ height: `${height}px` }}>
                <div className="absolute inset-y-0 left-0 w-1/3 bg-blue-100/40" />
                <div className="absolute inset-y-0 left-1/3 w-1/3 border-x border-dashed border-slate-300 bg-slate-100/40" />
                <div className="absolute inset-y-0 right-0 w-1/3 bg-amber-100/40" />
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
                        />
                    );
                })}
            </div>
            <div className="mt-1 flex justify-between px-1 text-[10px] font-semibold text-slate-600 sm:px-2 sm:text-xs">
                <span>後方・差し</span>
                <span>中団</span>
                <span>先行・逃げ</span>
            </div>
        </div>
    );
};

export const StartPositionChart = ({ predictions }: { predictions: HorsePrediction[] }) => {
    const validPredictions = predictions?.filter(prediction => prediction.start_1c_indicator != null) ?? [];
    if (validPredictions.length === 0) {
        return (
            <div className="my-2 rounded-lg border bg-slate-50 p-3 text-center text-sm text-slate-500">
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
                />
            </div>

            <div className="hidden md:block md:p-2">
                <TrackView
                    horses={sortedByNumber}
                    minScore={minScore}
                    scoreRange={scoreRange}
                    height={184}
                    laneCount={sortedByNumber.length}
                />
            </div>
        </div>
    );
};
