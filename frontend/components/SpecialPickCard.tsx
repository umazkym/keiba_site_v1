'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSpecialPick } from '@/lib/api';
import { SpecialPick } from "@/lib/types";
import { SparklesIcon } from '@/components/icons';

// 調整案1：「リッチゴールド ＆ ホワイト」デザイン
const Skeleton = () => (
    <div className="bg-amber-500 p-6 rounded-xl shadow-lg mb-6 animate-pulse h-[170px]">
        <div className="flex justify-between items-center">
            <div className="h-4 bg-amber-600 rounded w-1/3"></div>
            <div className="h-8 bg-amber-600 rounded-full w-24"></div>
        </div>
        <div className="h-10 bg-amber-600 rounded w-3/4 mt-4"></div>
        <div className="h-5 bg-amber-600 rounded w-1/2 mt-2"></div>
        <div className="h-4 bg-amber-600 rounded w-full mt-4"></div>
    </div>
);

type Props = {
    pick?: SpecialPick | null;
    date?: string;
};

export const SpecialPickCard = ({ pick: initialPick, date }: Props) => {
    const [pick, setPick] = useState<SpecialPick | null>(initialPick === undefined ? null : initialPick);
    const [isLoading, setIsLoading] = useState(initialPick === undefined);

    useEffect(() => {
        if (initialPick !== undefined) {
            setPick(initialPick);
            setIsLoading(false);
            return;
        }
        if (!date) {
            setIsLoading(false);
            setPick(null);
            return;
        }

        setIsLoading(true);
        getSpecialPick(date)
            .then(data => {
                if (data) {
                    data.commentary = `AI偏差値 ${data.deviation_score.toFixed(2)}！${data.venue_name}${data.race_number}R の ${data.horse_name} を詳しく見る →`;
                }
                setPick(data);
            })
            .catch(e => {
                console.error("Failed to fetch special pick:", e);
                setPick(null);
            })
            .finally(() => setIsLoading(false));
    }, [date, initialPick]);

    if (isLoading) return <Skeleton />;

    if (!pick) {
        return (
            <div className="bg-white text-gray-600 p-6 rounded-xl shadow-md h-full flex items-center justify-center border">
                <p>本日のAI注目馬はいません。</p>
            </div>
        );
    }

    return (
        <Link 
            href={`/races/${date}?venue=${encodeURIComponent(pick.venue_name)}&race=${pick.race_number}`}
            className="block group"
            aria-label={`${pick.commentary}`}
        >
            <div className="bg-amber-500 text-white rounded-xl shadow-lg h-full flex flex-col overflow-hidden border border-amber-600 hover:border-amber-400 transition-all duration-300 relative group" role="region" aria-labelledby="special-pick-title">
                {/* 装飾用の背景グラデーション（リッチなゴールド系） */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 opacity-80"></div>
                {/* ホバー時の光彩エフェクトは削除し、代わりにカード自体を少し明るくする */}
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>


                <div className="p-5 flex flex-col h-full relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                             <SparklesIcon className="w-5 h-5 text-amber-200" />
                             <h3 id="special-pick-title" className="text-sm font-bold uppercase tracking-wider text-amber-200">
                                今日のイチオシ！
                            </h3>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 text-white border border-white/30">
                            AI偏差値 <span className="text-lg font-mono">{pick.deviation_score.toFixed(2)}</span>
                        </span>
                    </div>

                    <div className="mt-2 min-w-0">
                         <p className="text-3xl sm:text-4xl font-black leading-tight truncate text-white drop-shadow-md" title={pick.horse_name}>
                            {pick.horse_name}
                        </p>
                        <p className="text-sm text-amber-200 font-medium mt-1 truncate" title={`${pick.venue_name} ${pick.race_number}R - ${pick.race_name}`}>
                            {pick.venue_name} {pick.race_number}R ・ {pick.race_name}
                        </p>
                    </div>

                    <div className="mt-auto pt-3 border-t border-amber-400/50">
                         <p className="text-sm text-amber-100 font-medium leading-relaxed group-hover:text-white transition-colors duration-300" aria-live="polite">
                            {pick.commentary}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
};