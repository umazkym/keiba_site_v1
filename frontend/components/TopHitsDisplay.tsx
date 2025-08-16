'use client';

import { useState, useEffect } from 'react';
import { getTopPayoutHits } from '@/lib/api';
import { TopPayoutHit } from '@/lib/types';
import { TrophyIcon } from './icons';

const HitCard = ({ hit, rank }: { hit: TopPayoutHit, rank: number }) => {
    const rankStyles = [
        { borderColor: 'border-yellow-400', rankBgColor: 'bg-yellow-400', rankTextColor: 'text-yellow-900', shadow: 'shadow-lg', scale: 'hover:scale-105' },
        { borderColor: 'border-gray-400', rankBgColor: 'bg-gray-400', rankTextColor: 'text-white', shadow: 'shadow-md', scale: 'hover:scale-102' },
        { borderColor: 'border-amber-600', rankBgColor: 'bg-amber-600', rankTextColor: 'text-white', shadow: 'shadow', scale: 'hover:scale-102' },
        { borderColor: 'border-gray-300', rankBgColor: 'bg-gray-300', rankTextColor: 'text-gray-800', shadow: 'shadow-sm', scale: 'hover:scale-102' },
        { borderColor: 'border-gray-300', rankBgColor: 'bg-gray-300', rankTextColor: 'text-gray-800', shadow: 'shadow-sm', scale: 'hover:scale-102' },
    ];
    const style = rankStyles[Math.min(rank - 1, 4)];

    return (
        <div className={`bg-white rounded-lg border-2 transition-transform duration-300 ${style.borderColor} ${style.shadow} ${style.scale} p-2 flex items-center gap-2`}>
            {/* Rank */}
            <div className={`text-sm font-bold whitespace-nowrap ${style.rankTextColor} ${style.rankBgColor} rounded px-2 py-1`}>
                {rank}位
            </div>
            
            {/* Main Info (Race & Bet type) */}
            <div className="flex-grow min-w-0 text-left">
                <div className="text-xs text-gray-500 whitespace-nowrap truncate">
                     {new Date(hit.race_date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                     {' '}{hit.venue_name}{hit.race_number}R
                </div>
                <div className="text-xs text-gray-700 mt-0.5 whitespace-nowrap truncate">
                    {hit.bet_type}: {hit.winning_numbers}
                </div>
            </div>

            {/* Payout */}
            <div className="font-bold text-red-600 text-lg whitespace-nowrap leading-none flex-shrink-0">
                {hit.payout.toLocaleString()}円
            </div>
        </div>
    );
};

const Skeleton = () => (
    <div className="animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
        </div>
    </div>
);

export const TopHitsDisplay = () => {
    const [hits, setHits] = useState<TopPayoutHit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHits = async () => {
            setIsLoading(true);
            try {
                const data = await getTopPayoutHits();
                setHits(data);
            } catch (e) {
                console.error("Failed to fetch top hits:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHits();
    }, []);

    if (isLoading) {
        return <Skeleton />;
    }
    
    return (
        <div>
            <h3 className="flex items-center text-xl sm:text-2xl font-bold text-gray-800 mb-2 px-1">
               <TrophyIcon className="w-6 h-6 mr-2 text-yellow-500"/>
               <span className="whitespace-nowrap">AI高配当ランキング</span>
               <span className="text-sm font-normal text-gray-500 ml-2 whitespace-nowrap">(直近7日間)</span>
            </h3>
            {hits.length === 0 ? (
                <div className="p-4 bg-white border border-dashed rounded-lg text-center text-gray-500">
                    <p>対象期間の的中実績はありませんでした。</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 md:gap-3">
                    {hits.map((hit, index) => (
                        <HitCard key={`${hit.race_id}-${hit.bet_type}-${hit.payout}`} hit={hit} rank={index + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};