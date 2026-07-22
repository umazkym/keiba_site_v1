'use client';

import type { CSSProperties } from 'react';
import { HorseNumberAdvantage } from '@/lib/types';

type Props = {
    advantages: HorseNumberAdvantage[];
    courseType: string | null;
    distance: number | null;
};

const getBarColor = (value: number) => {
    if (value > 0.05) return 'bg-emerald-500';
    if (value > 0) return 'bg-emerald-300';
    if (value < -0.05) return 'bg-red-500';
    if (value < 0) return 'bg-red-300';
    return 'bg-slate-400';
};

const getInterpretation = (value: number) => {
    if (value > 0.05) return '有利寄り';
    if (value < -0.05) return '不利寄り';
    return '平均的';
};

export const HorseNumberAdvantageChart = ({ advantages, courseType, distance }: Props) => {
    if (!advantages || advantages.length === 0) {
        return (
            <div className="my-4 rounded-lg border bg-slate-50 p-4 text-center text-sm text-slate-500">
                <p>データ不足のため表示できません</p>
            </div>
        );
    }

    const sortedAdvantages = [...advantages].sort((a, b) => a.horse_number - b.horse_number);
    const scores = sortedAdvantages.map((item) => item.advantage_score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const domainMax = Math.ceil((Math.max(maxScore, 0.1) + 0.05) * 20) / 20;
    const domainMin = Math.floor((Math.min(minScore, -0.1) - 0.05) * 20) / 20;
    const domainRange = Math.max(0.01, domainMax - domainMin);
    const zeroTop = ((domainMax - 0) / domainRange) * 100;
    const gridStyle = {
        gridTemplateColumns: `repeat(${sortedAdvantages.length}, minmax(0, 1fr))`,
    } satisfies CSSProperties;
    const chartLabel = `このコースの枠順傾向 ${courseType || ''}${distance || ''}m`;

    return (
        <div className="flex h-full flex-col justify-center" aria-label={chartLabel}>
            <div className="relative h-32 w-full md:h-[196px]" role="img" aria-label={chartLabel}>
                <div className="absolute inset-x-0 bottom-[18px] top-3">
                    <div className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ top: '25%' }} />
                    <div className="absolute inset-x-0 border-t border-slate-400" style={{ top: `${zeroTop}%` }} />
                    <div className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ top: '75%' }} />
                    <div className="absolute inset-0 grid gap-px sm:gap-1" style={gridStyle}>
                        {sortedAdvantages.map((entry) => {
                            const valueTop = ((domainMax - entry.advantage_score) / domainRange) * 100;
                            const barTop = Math.min(valueTop, zeroTop);
                            const barHeight = Math.max(1.5, Math.abs(valueTop - zeroTop));
                            const shouldShowLabel = Math.abs(entry.advantage_score) >= 0.03
                                || entry.advantage_score === maxScore
                                || entry.advantage_score === minScore;
                            const labelTop = entry.advantage_score >= 0
                                ? Math.max(0, barTop - 12)
                                : Math.min(88, barTop + barHeight + 2);

                            return (
                                <div
                                    key={entry.horse_number}
                                    className="relative h-full min-w-0"
                                    aria-label={`${entry.horse_number}番、スコア${entry.advantage_score.toFixed(3)}、${getInterpretation(entry.advantage_score)}`}
                                    title={`${entry.horse_number}番 / ${entry.advantage_score.toFixed(3)} / ${getInterpretation(entry.advantage_score)}`}
                                >
                                    <span
                                        className={`absolute left-[18%] right-[18%] min-h-px rounded-t-sm ${getBarColor(entry.advantage_score)}`}
                                        style={{ top: `${barTop}%`, height: `${barHeight}%` }}
                                    />
                                    {shouldShowLabel && (
                                        <span
                                            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold leading-none text-slate-700 md:text-[10px]"
                                            style={{ top: `${labelTop}%` }}
                                            aria-hidden="true"
                                        >
                                            {entry.advantage_score.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 grid gap-px sm:gap-1" style={gridStyle} aria-hidden="true">
                    {sortedAdvantages.map((entry) => (
                        <span key={entry.horse_number} className="truncate text-center text-[9px] font-semibold text-slate-600 md:text-xs">
                            {entry.horse_number}
                        </span>
                    ))}
                </div>
                <ul className="sr-only">
                    {sortedAdvantages.map((entry) => (
                        <li key={entry.horse_number}>
                            {entry.horse_number}番、スコア{entry.advantage_score.toFixed(3)}、{getInterpretation(entry.advantage_score)}
                        </li>
                    ))}
                </ul>
            </div>
            <div className="mt-0.5 flex justify-center gap-3 text-[10px] font-medium text-slate-700 md:text-xs">
                <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                    <span>有利</span>
                </span>
                <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-red-500" />
                    <span>不利</span>
                </span>
            </div>
        </div>
    );
};
