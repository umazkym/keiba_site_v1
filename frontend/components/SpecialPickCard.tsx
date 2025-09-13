'use client';

import { useState, useEffect } from 'react';
import { getSpecialPick } from '@/lib/api';
import { SpecialPick } from "@/lib/types";
import { SparklesIcon } from '@/components/icons';

// Skeleton（案3）
const Skeleton = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm mb-6 animate-pulse h-full">
        <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
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
        <div className="bg-gradient-to-br from-yellow-50 to-white text-gray-900 rounded-xl shadow-lg h-full flex flex-col overflow-hidden border-2 border-yellow-200 hover:shadow-xl transition-shadow duration-300" role="region" aria-labelledby="special-pick-title">

            {/* 上部に細いハイライト帯（幅100%・高さ6px程度） */}
            <div className="h-2 bg-gradient-to-r from-yellow-400 to-yellow-500 w-full"></div>
            <div className="p-4 flex flex-col h-full">
                <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 text-white w-10 h-10 shrink-0 shadow-md animate-pulse">
                        <SparklesIcon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 id="special-pick-title" className="text-sm font-bold uppercase tracking-wider text-yellow-600 drop-shadow-sm">
                                今日のイチオシ！
                            </h3>
                            <div className="ml-auto">
                                <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-sm">
                                    AI {pick.deviation_score.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <p className="text-2xl sm:text-3xl font-extrabold leading-tight truncate mt-2 text-gray-900">
                            {pick.horse_name}
                        </p>
                        <p className="text-sm text-gray-700 font-medium mt-1 truncate" title={`${pick.venue_name} ${pick.race_number}R - ${pick.race_name}`}>
                            {pick.venue_name} {pick.race_number}R ・ {pick.race_name}
                        </p>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-yellow-100">
                    <p className="text-sm text-gray-800 font-medium leading-relaxed truncate" title={pick.commentary} aria-live="polite">
                        {pick.commentary}
                    </p>
                </div>
            </div>
        </div>
    );
};
