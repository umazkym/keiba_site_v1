// frontend/components/PredictionTable.tsx
'use client';

import { RacePrediction } from '@/lib/types';
import React, { useEffect, useRef } from 'react';
import { getWakuNumber } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { sendPredictionTableViewEvent } from '../lib/analytics';
import { AccessibleInfo } from '@/components/AccessibleInfo';
import Link from 'next/link';

const getWakuClasses = (waku: number | null) => {
    switch (waku) {
        case 1: return 'border border-slate-300 bg-white text-slate-900';
        case 2: return 'bg-slate-950 text-white';
        case 3: return 'bg-red-600 text-white';
        case 4: return 'bg-blue-600 text-white';
        case 5: return 'bg-yellow-400 text-slate-950';
        case 6: return 'bg-green-600 text-white';
        case 7: return 'bg-orange-600 text-white';
        case 8: return 'bg-pink-500 text-white';
        default: return 'bg-slate-200 text-slate-900';
    }
};

const HorseNumberCircle = ({ number, waku }: { number: number, waku: number | null }) => (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black sm:h-7 sm:w-7 sm:text-xs ${getWakuClasses(waku)}`}>
        {number}
    </span>
);

const DeviationScoreBadge = ({ score }: { score: number | null | undefined }) => {
    if (score == null) return <span className="race-score-badge race-score-badge-low">--</span>;
    const isLow = score < 50;
    return (
        <span className={`race-score-badge ${isLow ? 'race-score-badge-low' : ''}`}>
            {score.toFixed(1)}
        </span>
    );
};

const getPositionIndicator = (indicator: number | null | undefined, minScore: number, maxScore: number) => {
    if (indicator == null) return null;
    const scoreRange = maxScore - minScore;
    if (scoreRange < 0.01) {
        return { label: '中団', className: 'border-purple-200 bg-purple-50 text-purple-700' };
    }
    const ratio = (indicator - minScore) / scoreRange;
    if (ratio < 0.35) {
        return { label: '後方', className: 'border-slate-200 bg-slate-50 text-slate-600' };
    } else if (ratio > 0.65) {
        return { label: '先行', className: 'border-blue-200 bg-blue-50 text-blue-700' };
    }
    return { label: '中団', className: 'border-purple-200 bg-purple-50 text-purple-700' };
};

const normalizePredictionMark = (mark: string | null | undefined) => {
    if (!mark) return '−';
    return mark.replace(/〇/g, '○');
};

export const PredictionTable = ({ race, refreshKey = '' }: { race: RacePrediction, refreshKey?: string }) => {
    const pathname = usePathname();
    const observerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = observerRef.current;
        if (!el) return;
        
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                sendPredictionTableViewEvent({
                    pagePath: pathname || '',
                    raceId: race.id,
                    raceNumber: race.race_number,
                });
                observer.disconnect();
            }
        }, { threshold: 0.3 });
        
        observer.observe(el);
        return () => observer.disconnect();
    }, [pathname, race.id, race.race_number]);

    const hasAnyScore = race.predictions.some(p => p.deviation_score !== null && p.deviation_score !== undefined);
    const hasReason = race.predictions.some(p => Boolean(p.unpredictable_reason));
    const allMarkedAsUnavailable = race.predictions.length > 0 && race.predictions.every(p => p.mark === '—');
    const isUnpredictable = !race.predictions.length || (!hasAnyScore && (hasReason || allMarkedAsUnavailable));
    const reason = race.predictions.find(p => p.unpredictable_reason)?.unpredictable_reason;

    const validScores = race.predictions
        .map(p => p.start_1c_indicator)
        .filter((val): val is number => val !== null && val !== undefined);
    const minScore = validScores.length > 0 ? Math.min(...validScores) : 0;
    const maxScore = validScores.length > 0 ? Math.max(...validScores) : 0;

    if (isUnpredictable) {
        return (
            <div className="p-4 text-center text-gray-500">
                <p>{reason || 'このレースは出走馬の過去データが不足しているため、AI偏差値を算出できません（新馬戦・障害戦など）。'}</p>
            </div>
        );
    }

    return (
        <div ref={observerRef} className="w-full overflow-x-auto" data-refresh-key={refreshKey || undefined}>
            <table className="race-prediction-table">
                <colgroup>
                    <col style={{ width: '32px' }} />
                    <col style={{ width: '38px' }} />
                    <col />
                    <col style={{ width: '72px' }} />
                    <col style={{ width: '52px' }} />
                </colgroup>
                <thead>
                    <tr>
                        <th className="text-center">印</th>
                        <th className="whitespace-nowrap text-center">馬番</th>
                        <th className="text-left">馬名</th>
                        <th className="text-center">
                            <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                                <span>AI偏差値</span>
                                <AccessibleInfo
                                    label="AI偏差値の説明を表示"
                                    buttonClassName="h-6 w-6 bg-slate-200 text-[11px] font-bold text-slate-700 transition-colors duration-150 hover:bg-slate-300"
                                >
                                    <span className="mb-1 block font-bold text-primary">AI偏差値とは？</span>
                                    過去のレースタイムなどからAIが算出した馬の能力指数です。数値が高いほど、高く評価していることを示します。
                                </AccessibleInfo>
                            </div>
                        </th>
                        <th className="whitespace-nowrap text-center">位置</th>
                    </tr>
                </thead>
                <tbody>
                    {race.predictions.map((p) => {
                        const resolvedWaku = (p.waku_number && p.waku_number >= 1 && p.waku_number <= 8)
                            ? p.waku_number
                            : getWakuNumber(p.horse_number, race.predictions.length);
                        return (
                            <tr key={`${race.id}-${p.horse_number}`}>
                                <td className="text-center text-sm font-black leading-none sm:text-base">{normalizePredictionMark(p.mark)}</td>
                                <td className="text-center">
                                    <HorseNumberCircle number={p.horse_number} waku={resolvedWaku} />
                                </td>
                                <td>
                                    <div className="flex items-center gap-1.5 truncate font-bold text-slate-800">
                                        {p.detail_page_indexable ? (
                                            <Link
                                                prefetch={false}
                                                href={`/horses/${encodeURIComponent(p.horse_id)}`}
                                                className="truncate text-xs transition-colors duration-150 hover:text-primary sm:text-sm"
                                            >
                                                {p.horse_name}
                                            </Link>
                                        ) : (
                                            <span className="truncate text-xs sm:text-sm">{p.horse_name}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-center">
                                    <DeviationScoreBadge score={p.deviation_score} />
                                </td>
                                <td className="text-center">
                                    {(() => {
                                        const pos = getPositionIndicator(p.start_1c_indicator, minScore, maxScore);
                                        if (!pos) return <span className="race-position-badge border-slate-200 bg-slate-50 text-slate-500">-</span>;
                                        return (
                                            <span className={`race-position-badge ${pos.className}`}>
                                                {pos.label}
                                            </span>
                                        );
                                    })()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
