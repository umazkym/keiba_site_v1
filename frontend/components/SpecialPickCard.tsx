'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSpecialPick } from '@/lib/api';
import { SpecialPick } from "@/lib/types";
import { SparklesIcon } from '@/components/Icons';
import { formatDate } from '@/lib/utils';

// スケルトンコンポーネント（変更なし）
const Skeleton = () => (
    <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-xl shadow-md mb-6 animate-pulse h-[170px] border border-amber-100">
        <div className="flex justify-between items-center">
            <div className="h-4 bg-amber-200 rounded w-1/3"></div>
            <div className="h-8 bg-amber-200 rounded-full w-24"></div>
        </div>
        <div className="h-10 bg-amber-300 rounded w-3/4 mt-4"></div>
        <div className="h-5 bg-amber-200 rounded w-1/2 mt-2"></div>
        <div className="h-4 bg-amber-200 rounded w-full mt-4"></div>
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
                    data.commentary = `AI偏差値 ${data.deviation_score.toFixed(2)}！${data.venue_name}${data.race_number}R の ${data.horse_name} を詳しく見る →`;
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
            <div className="bg-white text-gray-600 p-6 rounded-xl shadow-md h-full flex items-center justify-center border">
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
            <div className="bg-gradient-to-br from-amber-50 to-white text-gray-800 rounded-xl shadow-md h-full flex flex-col overflow-hidden border border-amber-200 hover:border-amber-300 hover:shadow-lg transition-all duration-300" role="region" aria-labelledby="special-pick-title">
                <div className="p-5 flex flex-col h-full relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-100 rounded-bl-full opacity-50 -mr-4 -mt-4 pointer-events-none"></div>

                    <div className="flex items-start justify-between mb-4 relative z-10">
                        <div className="flex items-center gap-2">
                            <div className="bg-amber-100 p-1.5 rounded-lg">
                                <SparklesIcon className="w-5 h-5 text-amber-600 shrink-0" />
                            </div>
                            <h3 id="special-pick-title" className="text-sm font-bold uppercase tracking-wider text-amber-800">
                                本日の注目馬<br className="sm:hidden" />{formattedDate}
                            </h3>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/80 text-amber-700 border border-amber-200 shadow-sm whitespace-nowrap backdrop-blur-sm">
                            AI偏差値 <span className="text-lg font-mono text-amber-600">{pick.deviation_score.toFixed(2)}</span>
                        </span>
                    </div>
                    <div className="mt-2 min-w-0 mb-4 relative z-10">
                        <p className="text-3xl sm:text-4xl font-black leading-tight truncate text-gray-900 drop-shadow-sm" title={pick.horse_name}>
                            {pick.horse_name}
                        </p>
                    </div>

                    <p className="text-sm text-gray-600 font-medium mt-1 truncate mb-4 relative z-10" title={`${pick.venue_name} ${pick.race_number}R - ${pick.race_name}`}>
                        <span className="bg-white/60 px-2 py-1 rounded border border-amber-100 inline-block">
                            {pick.venue_name} {pick.race_number}R ・ {pick.race_name}
                        </span>
                    </p>

                    <div className="mt-auto pt-4 border-t border-amber-100 relative z-10">
                        <p className="text-sm text-gray-700 font-medium leading-relaxed group-hover:text-amber-800 transition-colors duration-300" aria-live="polite">
                            {pick.commentary}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
};
