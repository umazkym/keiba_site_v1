// frontend/components/PredictionTable.tsx
'use client';

import { RacePrediction } from '@/lib/types';
import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { sendReadCompleteEvent } from '../lib/analytics';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/themes/light-border.css';
// AdUnit import削除: PredictionTable内広告はユーザー要望で全撤去済み

// 馬番アイコン用のヘルパー関数とコンポーネント
const getWakuColorClasses = (waku: number | null): string => {
    switch (waku) {
        case 1: return 'bg-white text-black border-gray-500';
        case 2: return 'bg-black text-white border-gray-700';
        case 3: return 'bg-red-500 text-white border-red-700';
        case 4: return 'bg-blue-600 text-white border-blue-800';
        case 5: return 'bg-yellow-400 text-black border-yellow-600';
        case 6: return 'bg-green-500 text-white border-green-700';
        case 7: return 'bg-orange-500 text-white border-orange-700';
        case 8: return 'bg-pink-500 text-white border-pink-700';
        default: return 'bg-gray-200 text-black border-gray-400';
    }
};

const HorseNumberCircle = ({ number, waku }: { number: number, waku: number | null }) => (
    <div className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] border shadow-sm shrink-0 sm:h-6 sm:w-6 sm:text-xs sm:border-2 ${getWakuColorClasses(waku)}`}>
        {number}
    </div>
);

const getDeviationScoreMeta = (score: number | null | undefined) => {
    if (score == null) {
        return {
            label: '--',
            className: 'bg-slate-100 text-slate-400 border-slate-200',
        };
    }

    if (score >= 70) {
        return {
            label: score.toFixed(1),
            className: 'bg-rose-600 text-white border-rose-700',
        };
    }

    if (score >= 60) {
        return {
            label: score.toFixed(1),
            className: 'bg-orange-500 text-white border-orange-600',
        };
    }

    if (score >= 50) {
        return {
            label: score.toFixed(1),
            className: 'bg-amber-100 text-amber-800 border-amber-200',
        };
    }

    return {
        label: score.toFixed(1),
        className: 'bg-slate-100 text-slate-600 border-slate-200',
    };
};

const DeviationScoreBadge = ({ score }: { score: number | null | undefined }) => {
    const meta = getDeviationScoreMeta(score);

    return (
        <span className={`inline-flex min-w-[46px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-black leading-none sm:min-w-[58px] sm:px-2 sm:py-1 sm:text-xs ${meta.className}`}>
            {meta.label}
        </span>
    );
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
        }, { threshold: 0.3 }); // 30%程度見えたら発火
        
        observer.observe(el);
        return () => observer.disconnect();
    }, [pathname]);
    const isUnpredictable = !race.predictions.length || race.predictions.some(p => p.mark === '—');
    const reason = race.predictions?.[0]?.unpredictable_reason;

    if (isUnpredictable) {
        return (
            <div className="p-4 text-center text-gray-500">
                <p>{reason || 'このレースは予測対象外です（新馬戦、障害戦など）。'}</p>
            </div>
        );
    }


    return (
        <div ref={observerRef}>
            {/* PC (md以上) ではテーブル表示 */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-fixed">
                    <colgroup>
                        <col className="w-14" />
                        <col className="w-11" />
                        <col />
                        <col className="w-28" />
                    </colgroup>
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-3 py-2 text-center text-xs font-bold text-text-secondary tracking-wider w-12">印</th>
                            <th className="px-2 py-2 text-left text-xs font-bold text-text-secondary tracking-wider" colSpan={2}>馬番・馬名</th>
                            <th className="px-4 py-2 text-right text-xs font-bold text-text-secondary tracking-wider bg-blue-50/40">
                                <div className="flex items-center justify-end gap-1.5">
                                    <span className="whitespace-nowrap text-blue-900">AI偏差値</span>
                                    <Tippy content={
                                        <div className='p-2.5 text-sm text-left max-w-xs bg-white text-text-primary rounded-xl shadow-elevated border border-slate-100'>
                                            <p className='font-bold mb-1.5 text-primary'>AI偏差値とは？</p>
                                            <p className='text-xs text-text-secondary leading-[1.7]'>過去のレースタイムなどからAIが算出した馬の能力指数です。数値が高いほど、高く評価していることを示します。</p>
                                        </div>
                                    } placement="top" interactive={true} theme="light-border" appendTo={() => document.body}
                                    >
                                        <span className='w-4 h-4 bg-slate-300 hover:bg-slate-400 transition-colors text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help'>?</span>
                                    </Tippy>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {race.predictions.map((p) => (
                                <tr key={`${race.id}-${p.horse_number}`} className="hover:bg-slate-50 transition-colors duration-200 even:bg-slate-50/50 group">
                                    <td className="px-3 py-3 whitespace-nowrap text-center text-lg font-bold text-text-primary w-12">{p.mark || '—'}</td>
                                    <td className="px-2 py-3 whitespace-nowrap w-10">
                                        <HorseNumberCircle number={p.horse_number} waku={p.waku_number} />
                                    </td>
                                    <td className="px-2 py-3 whitespace-nowrap font-bold text-text-primary truncate">{p.horse_name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right bg-blue-50/20 group-hover:bg-blue-50/40 transition-colors">
                                        <DeviationScoreBadge score={p.deviation_score} />
                                    </td>
                                </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* スマホ (md未満) ではカードリスト表示 */}
            <div className="md:hidden bg-white">
                {/* モバイル用ヘッダー行（PC同様に列名を表示） */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-text-secondary tracking-wider">
                    <div className="min-w-[3rem]">印・馬番</div>
                    <div className="flex-1">馬名</div>
                    <div className="w-12 text-right">AI偏差値</div>
                </div>
                <div className="divide-y divide-slate-100">
                {race.predictions.map((p, index) => (
                        <div key={`${race.id}-${p.horse_number}-mobile`} className={`px-2 py-1 transition-colors hover:bg-slate-50 ${index % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                            <div className="flex items-center gap-1.5">
                                {/* 左: 印+馬番 */}
                                <div className="flex flex-row items-center gap-1.5 shrink-0 min-w-[3rem]">
                                    <span className="text-sm font-extrabold text-text-primary leading-none w-4 text-center">{p.mark || '—'}</span>
                                    <HorseNumberCircle number={p.horse_number} waku={p.waku_number} />
                                </div>

                                {/* 中: 馬名 */}
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-[12px] leading-snug text-text-primary line-clamp-1">{p.horse_name}</div>
                                </div>

                                {/* 右: 偏差値 */}
                                <div className="shrink-0 w-14 text-right">
                                    <DeviationScoreBadge score={p.deviation_score} />
                                </div>
                            </div>
                        </div>
                ))}
                </div>
            </div>
        </div>
    );
};
