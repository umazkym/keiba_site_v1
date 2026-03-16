'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSpecialPick } from '@/lib/api';
import { SpecialPick } from "@/lib/types";
import { formatDate } from '@/lib/utils';

// スケルトンコンポーネント
const Skeleton = () => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 animate-pulse h-[170px]">
        <div className="flex justify-between items-center">
            <div className="h-4 bg-slate-100 rounded w-1/3"></div>
            <div className="h-8 bg-slate-100 rounded-full w-24"></div>
        </div>
        <div className="h-10 bg-slate-100 rounded w-3/4 mt-4"></div>
        <div className="h-5 bg-slate-100 rounded w-1/2 mt-2"></div>
        <div className="h-4 bg-slate-100 rounded w-full mt-4"></div>
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
                <p>本日のAI注目馬はありません。</p>
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
            <div className="bg-white text-text-primary rounded-2xl h-full flex flex-col overflow-hidden border border-slate-100 hover-lift relative" role="region" aria-labelledby="special-pick-title">
                {/* Subtle gradient overlay to make it look premium */}
                <div className="absolute top-0 right-0 p-16 bg-blue-50/50 rounded-bl-full pointer-events-none -z-10"></div>

                <div className="p-3 sm:p-6 flex flex-col h-full z-10">
                    {/* Header: Title and Deviation Score in one row on mobile */}
                    <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-5">
                        <h3 id="special-pick-title" className="text-xs sm:text-sm font-bold text-text-secondary whitespace-nowrap">
                            AI注目馬 <span className="hidden sm:inline">{formattedDate}</span>
                        </h3>
                        <span className="text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-full bg-blue-50/80 text-blue-700 border border-blue-100/50 whitespace-nowrap">
                            偏差値 <span className="text-sm sm:text-lg font-mono tracking-tight">{pick.deviation_score.toFixed(2)}</span>
                        </span>
                    </div>

                    {/* Main Content: Horse Name and Venue/Race in one row on mobile */}
                    <div className="flex items-center justify-between gap-2 mb-2 sm:mb-5 min-w-0">
                        <p className="text-2xl sm:text-4xl font-extrabold leading-tight truncate tracking-tight text-primary-dark flex-1" title={pick.horse_name}>
                            {pick.horse_name}
                        </p>
                        <p className="text-[10px] sm:text-sm text-text-secondary font-medium shrink-0">
                            <span className="bg-slate-50 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md border border-slate-100 inline-block">
                                {pick.venue_name}{pick.race_number}R <span className="hidden sm:inline">・ {pick.race_name}</span>
                            </span>
                        </p>
                    </div>

                    {/* Commentary: Smaller text and line clamp on mobile */}
                    <div className="mt-1 sm:mt-auto pt-2 sm:pt-5 border-t border-slate-100">
                        <p className="text-[11px] sm:text-sm font-medium leading-[1.5] sm:leading-[1.8] text-primary-light group-hover:text-blue-700 transition-colors duration-200 line-clamp-1 sm:line-clamp-none" aria-live="polite">
                            {pick.commentary}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
};
