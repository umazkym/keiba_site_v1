'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSpecialPick } from '@/lib/api';
import { SpecialPick } from "@/lib/types";
import { formatDate } from '@/lib/utils';

// スケルトンコンポーネント
const Skeleton = () => (
    <div className="bg-white p-6 rounded-xl border border-gray-200 animate-pulse h-[170px]">
        <div className="flex justify-between items-center">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-8 bg-gray-200 rounded-full w-24"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-3/4 mt-4"></div>
        <div className="h-5 bg-gray-200 rounded w-1/2 mt-2"></div>
        <div className="h-4 bg-gray-200 rounded w-full mt-4"></div>
    </div>
);

type Props = {
    pick?: SpecialPick | null;
    date?: string;
};

export const SpecialPickCard = ({ pick: initialPick, date }: Props) => {
    const [pick, setPick] = useState<SpecialPick | null>(initialPick === undefined ? null : initialPick);
    const [isLoading, setIsLoading] = useState(initialPick === undefined);

    const getEffectiveDate = () => {
        if (date) return date;
        const now = new Date();
        const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        return jstDate.toISOString().split('T')[0];
    };

    const effectiveDate = getEffectiveDate();

    useEffect(() => {
        if (initialPick !== undefined) {
            setPick(initialPick);
            setIsLoading(false);
            return;
        }
        if (!effectiveDate) {
            setIsLoading(false);
            setPick(null);
            return;
        }
        setIsLoading(true);
        getSpecialPick(effectiveDate)
            .then(data => {
                if (data) {
                    data.commentary = `AI偏差値 ${data.deviation_score.toFixed(2)}。${data.venue_name}${data.race_number}R の ${data.horse_name} を詳しく見る →`;
                }
                setPick(data);
            })
            .catch(e => {
                console.error("Failed to fetch special pick:", e);
                setPick(null);
            })
            .finally(() => setIsLoading(false));
    }, [effectiveDate, initialPick]);

    if (isLoading) return <Skeleton />;
    if (!pick) {
        return (
            <div className="bg-white text-gray-600 p-6 rounded-xl border border-gray-200 h-full flex items-center justify-center">
                <p>本日のAI注目馬はいません。</p>
            </div>
        );
    }

    const formattedDate = formatDate(effectiveDate);

    return (
        <Link
            href={`/races/${effectiveDate}?race=${pick.race_number}&venue=${encodeURIComponent(pick.venue_name)}`}
            className="block group"
            aria-label={`${pick.commentary}`}
        >
            <div className="bg-white text-gray-800 rounded-xl h-full flex flex-col overflow-hidden border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200" role="region" aria-labelledby="special-pick-title">
                <div className="p-5 sm:p-5 flex flex-col h-full">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-2 mb-3 sm:mb-4">
                        <h3 id="special-pick-title" className="text-[13px] sm:text-sm font-bold text-gray-800">
                            本日の注目馬<span className="hidden sm:inline"> </span><br className="sm:hidden" /><span className="text-gray-500">{formattedDate}</span>
                        </h3>
                        <span className="text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap self-start">
                            AI偏差値 <span className="text-base sm:text-lg font-mono">{pick.deviation_score.toFixed(2)}</span>
                        </span>
                    </div>
                    <div className="min-w-0 mb-3 sm:mb-4">
                        <p className="text-2xl sm:text-4xl font-black leading-tight truncate text-gray-900" title={pick.horse_name}>
                            {pick.horse_name}
                        </p>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-600 font-medium truncate mb-3 sm:mb-4" title={`${pick.venue_name} ${pick.race_number}R - ${pick.race_name}`}>
                        <span className="bg-gray-50 px-2.5 py-1.5 rounded border border-gray-200 inline-block">
                            {pick.venue_name} {pick.race_number}R ・ {pick.race_name}
                        </span>
                    </p>

                    <div className="mt-auto pt-3.5 sm:pt-4 border-t border-gray-200">
                        <p className="text-xs sm:text-sm text-gray-700 font-medium leading-[1.8] group-hover:text-blue-700 transition-colors duration-200" aria-live="polite">
                            {pick.commentary}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
};
