'use client';

import { useState, useEffect } from 'react';
import { getSpecialPick } from '@/lib/api';
import { SpecialPick } from "@/lib/types";
import { SparklesIcon } from '@/components/icons';

// スケルトンコンポーネント
const Skeleton = () => (
    <div className="bg-gray-200 p-6 rounded-xl shadow-lg mb-6 animate-pulse h-full">
        <div className="h-4 bg-gray-300 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-gray-300 rounded w-2/3 mb-2"></div>
        <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
        <div className="mt-4 pt-4 border-t border-gray-300/50">
            <div className="h-4 bg-gray-300 rounded w-full"></div>
            <div className="h-4 bg-gray-300 rounded w-5/6 mt-2"></div>
        </div>
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
                // APIから返ってきたデータに解説文を追加
                if (data) {
                    data.commentary = `AI偏差値は${data.deviation_score.toFixed(2)}！${data.venue_name}${data.race_number}Rに出走する${data.horse_name}に注目です。`;
                }
                setPick(data);
            })
            .catch(e => {
                console.error("Failed to fetch special pick:", e);
                setPick(null);
            })
            .finally(() => setIsLoading(false));
            
    }, [date, initialPick]);

    if (isLoading) {
        return <Skeleton />;
    }

    if (!pick) {
        return (
            <div className="bg-white text-gray-600 p-6 rounded-xl shadow-md h-full flex items-center justify-center border">
                <p>本日のAI注目馬はいません。</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white p-4 rounded-xl shadow-lg h-full flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center">
                <SparklesIcon className="w-4 h-4 mr-2" />
                今日のイチオシ！
            </h3>
            <p className="text-2xl font-bold">{pick.horse_name}</p>
            <p className="text-base opacity-90">{pick.venue_name} {pick.race_number}R - {pick.race_name}</p>
            <div className="mt-auto pt-3 border-t border-white/30">
                <p className="text-xs italic">{pick.commentary}</p>
            </div>
        </div>
    );
};