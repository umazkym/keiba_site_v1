'use client';

import { useState, useEffect } from 'react';
import { getSpecialPick } from '@/lib/api';
import { SpecialPick } from "@/lib/types";
import { SparklesIcon } from '@/components/icons';

// スケルトンコンポーネント
const Skeleton = () => (
    <div className="bg-gray-200 p-6 rounded-xl shadow-lg mb-6 animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-gray-300 rounded w-2/3 mb-2"></div>
        <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
        <div className="mt-4 pt-4 border-t border-gray-300/50">
             <div className="h-4 bg-gray-300 rounded w-full"></div>
             <div className="h-4 bg-gray-300 rounded w-5/6 mt-2"></div>
        </div>
    </div>
);


export const SpecialPickCard = ({ date }: { date: string }) => {
    const [pick, setPick] = useState<SpecialPick | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        getSpecialPick(date)
            .then(data => setPick(data))
            .catch(e => console.error("Failed to fetch special pick:", e))
            .finally(() => setIsLoading(false));
    }, [date]);

    if (isLoading) {
        return <Skeleton />;
    }

    if (!pick) {
        return (
            <div className="bg-white text-gray-600 p-6 rounded-xl shadow-md mb-6 text-center border">
                <p>本日のAI注目馬はいません。</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white p-6 rounded-xl shadow-lg mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center">
                <SparklesIcon className="w-5 h-5 mr-2" />
                AIの注目馬！
            </h3>
            <p className="text-3xl font-bold">{pick.horse_name}</p>
            <p className="text-lg opacity-90">{pick.venue_name} {pick.race_number}R - {pick.race_name}</p>
            <div className="mt-4 pt-4 border-t border-white/30">
                <p className="text-sm italic">「{pick.commentary}」</p>
            </div>
        </div>
    );
};