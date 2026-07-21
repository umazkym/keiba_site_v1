'use client';

import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
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

const HorseMarker = ({ horse, position, top }: { horse: HorsePrediction; position: number; top: number }) => (
    <Tippy
        content={(
            <div className="text-sm">
                <div className="font-bold">{horse.horse_name}</div>
                <div>スコア: {horse.start_1c_indicator?.toFixed(1) || 'N/A'}</div>
            </div>
        )}
        placement="top"
    >
        <span
            className="absolute flex cursor-help flex-col items-center transition-[top,left] duration-300"
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
            <span className="mt-px inline-block max-w-[58px] truncate px-1 text-[11px] font-bold leading-none text-slate-700">
                {Array.from(horse.horse_name).slice(0, 3).join('')}
            </span>
        </span>
    </Tippy>
);

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
    const zones = [
        { label: '後方・差し', horses: [] as HorsePrediction[], tone: 'border-blue-200 bg-blue-50/60' },
        { label: '中団', horses: [] as HorsePrediction[], tone: 'border-slate-200 bg-slate-50' },
        { label: '先行・逃げ', horses: [] as HorsePrediction[], tone: 'border-amber-200 bg-amber-50/60' },
    ];

    sortedByNumber.forEach((horse) => {
        const ratio = scoreRange > 0.01 ? ((horse.start_1c_indicator as number) - minScore) / scoreRange : 0.5;
        const zoneIndex = ratio < 0.35 ? 0 : ratio > 0.65 ? 2 : 1;
        zones[zoneIndex].horses.push(horse);
    });

    const chartHeight = 220;
    const topPadding = 24;
    const bottomPadding = 30;
    const markerSpacing = sortedByNumber.length > 1
        ? (chartHeight - topPadding - bottomPadding) / (sortedByNumber.length - 1)
        : 0;

    return (
        <div className="h-full">
            <div className="grid grid-cols-3 gap-1.5 md:hidden" aria-label="序盤の位置取り予測">
                {zones.map(zone => (
                    <section key={zone.label} className={`min-w-0 rounded-lg border p-1.5 ${zone.tone}`}>
                        <h4 className="mb-1 text-center text-[10px] font-black text-slate-700">{zone.label}</h4>
                        <div className="flex min-h-12 flex-wrap content-start justify-center gap-1">
                            {zone.horses.map(horse => (
                                <span
                                    key={horse.horse_number}
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black ${getWakuColor(horse.waku_number)}`}
                                    title={`${horse.horse_number}番 ${horse.horse_name}`}
                                    aria-label={`${horse.horse_number}番 ${horse.horse_name}`}
                                >
                                    {horse.horse_number}
                                </span>
                            ))}
                            {zone.horses.length === 0 && <span className="text-[10px] text-slate-400">該当なし</span>}
                        </div>
                    </section>
                ))}
            </div>

            <div className="hidden flex-col justify-center md:flex md:p-2">
                <div className="relative w-full overflow-hidden rounded-lg bg-slate-50" style={{ height: `${chartHeight}px` }}>
                    <div className="absolute inset-y-0 left-0 w-1/3 bg-blue-100/40" />
                    <div className="absolute inset-y-0 left-1/3 w-1/3 border-x border-dashed border-slate-300 bg-slate-100/40" />
                    <div className="absolute inset-y-0 right-0 w-1/3 bg-amber-100/40" />
                    {sortedByNumber.map((horse, index) => {
                        const position = scoreRange > 0.01
                            ? 5 + (((horse.start_1c_indicator as number) - minScore) / scoreRange) * 90
                            : 50;
                        return (
                            <HorseMarker
                                key={horse.horse_number}
                                horse={horse}
                                position={position}
                                top={topPadding + index * markerSpacing}
                            />
                        );
                    })}
                </div>
                <div className="mt-1.5 flex justify-between px-2 text-xs font-semibold text-slate-600">
                    <span>後方・差し</span>
                    <span>中団</span>
                    <span>先行・逃げ</span>
                </div>
            </div>
        </div>
    );
};
