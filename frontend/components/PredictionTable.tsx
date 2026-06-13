// frontend/components/PredictionTable.tsx
'use client';

import { RacePrediction } from '@/lib/types';
import React, { useEffect, useRef } from 'react';
import { getWakuNumber } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { sendReadCompleteEvent } from '../lib/analytics';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/themes/light-border.css';

const HorseNumberCircle = ({ number, waku }: { number: number, waku: number | null }) => (
    <span className={`horse-no waku${waku || ''}`}>
        {number}
    </span>
);

const DeviationScoreBadge = ({ score }: { score: number | null | undefined }) => {
    if (score == null) return <span className="score low">--</span>;
    const isLow = score < 50;
    return (
        <span className={`score ${isLow ? 'low' : ''}`}>
            {score.toFixed(1)}
        </span>
    );
};

const getPositionIndicator = (indicator: number | null | undefined, minScore: number, maxScore: number) => {
    if (indicator == null) return null;
    const scoreRange = maxScore - minScore;
    if (scoreRange < 0.01) {
        return { label: '中団', className: 'badge badge-purple position' };
    }
    const ratio = (indicator - minScore) / scoreRange;
    if (ratio < 0.35) {
        return { label: '後方', className: 'badge position' };
    } else if (ratio > 0.65) {
        return { label: '先行', className: 'badge badge-blue position' };
    }
    return { label: '中団', className: 'badge badge-purple position' };
};

export const PredictionTable = ({ race, refreshKey = '' }: { race: RacePrediction, refreshKey?: string }) => {
    const pathname = usePathname();
    const observerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = observerRef.current;
        if (!el) return;
        
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                sendReadCompleteEvent('race_prediction', pathname || '');
                observer.disconnect();
            }
        }, { threshold: 0.3 });
        
        observer.observe(el);
        return () => observer.disconnect();
    }, [pathname]);

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
        <div ref={observerRef} className="overflow-x-auto w-full" data-refresh-key={refreshKey || undefined}>
            <table className="table">
                <colgroup>
                    <col style={{ width: '48px' }} />
                    <col style={{ width: '54px' }} />
                    <col />
                    <col style={{ width: '92px' }} />
                    <col style={{ width: '74px' }} />
                </colgroup>
                <thead>
                    <tr>
                        <th className="mark" style={{ textAlign: 'center' }}>印</th>
                        <th>馬番</th>
                        <th>馬名</th>
                        <th style={{ textAlign: 'right' }}>
                            <div className="flex items-center justify-end gap-1">
                                <span>AI偏差値</span>
                                <Tippy content={
                                    <div className='p-2.5 text-sm text-left max-w-xs bg-white text-text-primary rounded-xl shadow-elevated border border-slate-100'>
                                        <p className='font-bold mb-1.5 text-primary'>AI偏差値とは？</p>
                                        <p className='text-xs text-text-secondary leading-[1.7]'>過去のレースタイムなどからAIが算出した馬の能力指数です。数値が高いほど、高く評価していることを示します。</p>
                                    </div>
                                } placement="top" interactive={true} theme="light-border" appendTo={() => document.body}
                                >
                                    <span className='w-4 h-4 bg-slate-300 hover:bg-slate-400 transition-colors text-white rounded-full flex items-center justify-center text-[10px] font-bold cursor-help'>?</span>
                                </Tippy>
                            </div>
                        </th>
                        <th style={{ textAlign: 'center' }}>位置</th>
                    </tr>
                </thead>
                <tbody>
                    {race.predictions.map((p) => {
                        const resolvedWaku = (p.waku_number && p.waku_number >= 1 && p.waku_number <= 8)
                            ? p.waku_number
                            : getWakuNumber(p.horse_number, race.predictions.length);
                        return (
                            <tr key={`${race.id}-${p.horse_number}`}>
                                <td className="mark">{p.mark || '−'}</td>
                                <td>
                                    <HorseNumberCircle number={p.horse_number} waku={resolvedWaku} />
                                </td>
                                <td>
                                    <div className="flex items-center gap-1.5 truncate font-bold text-slate-800">
                                        <span className="truncate text-xs sm:text-sm">{p.horse_name}</span>
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <DeviationScoreBadge score={p.deviation_score} />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    {(() => {
                                        const pos = getPositionIndicator(p.start_1c_indicator, minScore, maxScore);
                                        if (!pos) return <span className="badge badge-slate position">-</span>;
                                        return (
                                            <span className={pos.className}>
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
