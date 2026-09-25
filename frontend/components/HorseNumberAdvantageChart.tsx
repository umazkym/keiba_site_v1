'use client';

import type { CSSProperties } from 'react';
import { HorseNumberAdvantage } from '@/lib/types';
import { HorseNumber } from '@/components/RaceParts';

type Props = {
    advantages: HorseNumberAdvantage[];
    courseType: string | null;
    distance: number | null;
    // 今回の出走馬の馬番。コース全体のデータから、この馬番だけを並べる
    runnerNumbers?: number[];
    // 馬番 → 枠。横軸を枠色の馬番の丸にする（見本と同じ）
    runnerWaku?: Record<number, number | null>;
};

// 横軸を枠色の丸にする頭数の上限。これより多いと丸（20px）が列の幅に収まらないため、数字だけにする
const MAX_RUNNERS_FOR_BADGES = 14;

const getBarColor = (value: number, isBest: boolean, isWorst: boolean) => {
    if (isBest) return 'bg-brand-600';
    if (isWorst) return 'bg-rose-600';
    if (value > 0) return 'bg-brand-300';
    if (value < 0) return 'bg-rose-300';
    return 'bg-slate-400';
};

const getInterpretation = (value: number) => {
    if (value > 0.05) return '有利寄り';
    if (value < -0.05) return '不利寄り';
    return '平均的';
};

export const HorseNumberAdvantageChart = ({ advantages, courseType, distance, runnerNumbers, runnerWaku }: Props) => {
    const runnerSet = runnerNumbers && runnerNumbers.length > 0 ? new Set(runnerNumbers) : null;
    const runnerAdvantages = runnerSet ? (advantages ?? []).filter((item) => runnerSet.has(item.horse_number)) : advantages;
    if (!runnerAdvantages || runnerAdvantages.length === 0) {
        return (
            <div className="rounded-lg bg-slate-100 p-4 text-center text-sm text-slate-600">
                <p>データ不足のため表示できません</p>
            </div>
        );
    }

    const sortedAdvantages = [...runnerAdvantages].sort((a, b) => a.horse_number - b.horse_number);
    const scores = sortedAdvantages.map((item) => item.advantage_score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    // 目盛りは今回の値の幅に合わせる（以前は最大値に0.05を足し、最小でも±0.1に固定していたため、
    // 値の小さいコースでは棒が短く、図の上下が空いていた。2026-09-25 スマホの見直し）
    const top = Math.max(maxScore, 0);
    const bottom = Math.min(minScore, 0);
    const padding = Math.max(0.005, (top - bottom) * 0.06);
    const domainMax = top + (top > 0 ? padding : 0);
    const domainMin = bottom - (bottom < 0 ? padding : 0);
    const domainRange = Math.max(0.01, domainMax - domainMin);
    const zeroTop = ((domainMax - 0) / domainRange) * 100;
    const gridStyle = {
        gridTemplateColumns: `repeat(${sortedAdvantages.length}, minmax(0, 1fr))`,
    } satisfies CSSProperties;
    const chartLabel = `馬番の傾向 ${courseType || ''}${distance || ''}m`;
    const showBadges = Boolean(runnerWaku) && sortedAdvantages.length <= MAX_RUNNERS_FOR_BADGES;

    return (
        <div className="flex h-full flex-col" aria-label={chartLabel}>
            {/* 左に「有利（上）・不利（下）」の目印。説明文の代わり（2026-09-26 利用者の指定） */}
            <div className="flex min-h-0 flex-1 gap-1.5">
            <div className="flex w-6 shrink-0 flex-col justify-between text-[11px] font-bold leading-none" aria-hidden="true">
                <span className="text-brand-700">有利</span>
                <span className="text-rose-600">不利</span>
            </div>
            <div className="relative min-h-0 flex-1" role="img" aria-label={`${chartLabel}（上ほど有利、下ほど不利）`}>
                <div className="absolute inset-x-0 border-t border-slate-400" style={{ top: `${zeroTop}%` }} />
                <div className="absolute inset-0 grid gap-px sm:gap-1" style={gridStyle}>
                    {sortedAdvantages.map((entry) => {
                        const valueTop = ((domainMax - entry.advantage_score) / domainRange) * 100;
                        const barTop = Math.min(valueTop, zeroTop);
                        const barHeight = Math.max(1.5, Math.abs(valueTop - zeroTop));
                        return (
                            <div
                                key={entry.horse_number}
                                className="relative h-full min-w-0"
                                aria-label={`${entry.horse_number}番、スコア${entry.advantage_score.toFixed(3)}、${getInterpretation(entry.advantage_score)}`}
                                title={`${entry.horse_number}番 / ${entry.advantage_score.toFixed(3)} / ${getInterpretation(entry.advantage_score)}`}
                            >
                                <span
                                    className={`absolute left-[18%] right-[18%] min-h-px rounded-sm ${getBarColor(entry.advantage_score, entry.advantage_score === maxScore && maxScore > 0, entry.advantage_score === minScore && minScore < 0)}`}
                                    style={{ top: `${barTop}%`, height: `${barHeight}%` }}
                                />
                            </div>
                        );
                    })}
                </div>
                <ul className="sr-only">
                    {sortedAdvantages.map((entry) => (
                        <li key={entry.horse_number}>
                            {entry.horse_number}番、スコア{entry.advantage_score.toFixed(3)}、{getInterpretation(entry.advantage_score)}
                        </li>
                    ))}
                </ul>
            </div>
            </div>
            <div className="mt-1.5 flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="w-6 shrink-0" />
            <div className="grid min-w-0 flex-1 gap-px sm:gap-1" style={gridStyle}>
                {sortedAdvantages.map((entry) => (
                    showBadges ? (
                        <span key={entry.horse_number} className="flex justify-center">
                            <HorseNumber number={entry.horse_number} waku={runnerWaku?.[entry.horse_number]} size={20} />
                        </span>
                    ) : (
                        <span key={entry.horse_number} className="truncate text-center font-num text-[12px] font-bold text-slate-700 md:text-[13px]">
                            {entry.horse_number}
                        </span>
                    )
                ))}
            </div>
            </div>
        </div>
    );
};
