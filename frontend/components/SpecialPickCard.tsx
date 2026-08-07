'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { SpecialPick, RaceDayPrediction } from "@/lib/types";
import { formatDate } from '@/lib/utils';
import { getRaceDetailPath } from '@/lib/race-url';
import {
    extractHomeSpecialPicks,
    type HomeSpecialPickSet,
} from '@/lib/home-page-summary';

type Props = {
    pick?: SpecialPick | null;
    date?: string;
    predictions?: RaceDayPrediction | null;
    precomputedPicks?: HomeSpecialPickSet;
};

// スケルトン
const Skeleton = () => (
    <div className="h-[180px] animate-pulse rounded-xl border border-slate-100 bg-white p-4 sm:p-6">
        <div className="flex gap-2 mb-4">
            <div className="h-6 bg-slate-100 rounded w-20"></div>
            <div className="h-6 bg-slate-100 rounded w-20"></div>
            <div className="h-6 bg-slate-100 rounded w-20"></div>
        </div>
        <div className="flex justify-between items-center mt-2">
            <div className="h-4 bg-slate-100 rounded w-1/3 sm:h-5"></div>
            <div className="h-8 bg-slate-100 rounded-full w-24"></div>
        </div>
        <div className="h-6 bg-slate-100 rounded w-3/4 mt-3"></div>
        <div className="h-4 bg-slate-100 rounded w-full mt-2"></div>
    </div>
);

export const SpecialPickCard = ({ pick: initialPick, date, predictions, precomputedPicks }: Props) => {
    const [activeTab, setActiveTab] = useState<'favored' | 'value' | 'nar'>('favored');

    const getEffectiveDate = () => {
        if (date) return date;
        const now = new Date();
        const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        return jstDate.toISOString().split('T')[0];
    };

    const effectiveDate = getEffectiveDate();
    const formattedDate = formatDate(effectiveDate);

    // 予測データから注目馬を動的に抽出
    const extractedPicks = useMemo(() => {
        return precomputedPicks ?? extractHomeSpecialPicks(predictions ?? null, initialPick);
    }, [precomputedPicks, predictions, initialPick]);

    // NARのピックが無い場合は、デフォルトタブをfavoredにし、narタブを選べなくする
    useEffect(() => {
        if (activeTab === 'nar' && !extractedPicks.nar) {
            setActiveTab('favored');
        }
    }, [extractedPicks.nar, activeTab]);

    const currentPick = useMemo(() => {
        if (activeTab === 'value' && extractedPicks.value) return extractedPicks.value;
        if (activeTab === 'nar' && extractedPicks.nar) return extractedPicks.nar;
        return extractedPicks.favored;
    }, [activeTab, extractedPicks]);

    if (!currentPick) {
        return (
            <div className="bg-white text-gray-600 p-6 rounded-xl border border-gray-200 h-full flex items-center justify-center">
                <p>本日のAI注目馬はありません。</p>
            </div>
        );
    }

    // 偏差値をプログレスバーの%に変換 (偏差値40〜70の範囲でマッピング)
    const barPercent = Math.min(100, Math.max(10, ((currentPick.deviation_score - 40) / 30) * 100));

    // 偏差値のスコア別カラー
    const getProgressBarColor = (score: number) => {
        if (score >= 70) return 'bg-rose-500';
        if (score >= 60) return 'bg-orange-500';
        if (score >= 50) return 'bg-amber-500';
        return 'bg-blue-500';
    };

    return (
        <div>
            {/* タブ切り替えヘッダー */}
            <div className="flex gap-1.5 sm:gap-2 mb-2 overflow-x-auto scrollbar-hide">
                <button
                    onClick={() => setActiveTab('favored')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'favored' ? 'bg-primary text-white shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800'}`}
                >
                    本命候補
                </button>
                {extractedPicks.value && (
                    <button
                        onClick={() => setActiveTab('value')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'value' ? 'bg-primary text-white shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800'}`}
                    >
                        オッズ妙味
                    </button>
                )}
                {extractedPicks.nar && (
                    <button
                        onClick={() => setActiveTab('nar')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'nar' ? 'bg-primary text-white shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800'}`}
                    >
                        地方注目
                    </button>
                )}
            </div>

            {/* 注目馬情報カード */}
            <Link
                href={getRaceDetailPath(effectiveDate, currentPick.venue_name, currentPick.race_number)}
                prefetch={false}
                className="block group"
            >
                <div className="relative overflow-hidden rounded-lg bg-slate-50/50 hover:bg-slate-50 p-3 sm:p-3.5 border border-slate-200 transition-all group-hover:border-blue-300">
                    <div className="flex justify-between items-start gap-3 mb-2">
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{formattedDate} · {currentPick.venue_name} {currentPick.race_number}R</span>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 truncate leading-tight group-hover:text-primary transition-colors">
                                {currentPick.horse_name}
                            </h3>
                            <span className="text-[11px] font-semibold text-slate-500">
                                {currentPick.race_name}
                            </span>
                        </div>

                        <div className="shrink-0 text-right">
                            <div className="text-[10px] font-bold text-slate-400">AI偏差値</div>
                            <div className="text-xl font-black text-primary font-mono">{currentPick.deviation_score.toFixed(1)}</div>
                        </div>
                    </div>

                    {/* 偏差値プログレスバー */}
                    <div className="mb-2.5">
                        <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(currentPick.deviation_score)}`}
                                style={{ width: `${barPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* 解説コメント */}
                    <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 font-medium">
                        {currentPick.commentary}
                    </p>

                    <div className="mt-2 text-right">
                        <span className="inline-flex items-center text-[10px] sm:text-xs font-bold text-primary group-hover:underline">
                            分析データを詳しく確認する →
                        </span>
                    </div>
                </div>
            </Link>
        </div>
    );
};
