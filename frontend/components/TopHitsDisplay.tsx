'use client';

import { useState, useEffect } from 'react';
import { getTopPayoutHits } from '@/lib/api';
import { TopPayoutHit } from '@/lib/types';
import { TrophyIcon } from './icons';

const HitCard = ({ hit, rank }: { hit: TopPayoutHit, rank: number }) => {
    const rankStyles = [
        // 1位
        {
            borderColor: 'border-yellow-400',
            rankBgColor: 'bg-yellow-400',
            rankTextColor: 'text-yellow-900',
            shadow: 'shadow-xl',
            scale: 'hover:scale-105',
        },
        // 2位
        {
            borderColor: 'border-gray-400',
            rankBgColor: 'bg-gray-400',
            rankTextColor: 'text-white',
            shadow: 'shadow-lg',
            scale: 'hover:scale-102',
        },
        // 3位
        {
            borderColor: 'border-amber-600',
            rankBgColor: 'bg-amber-600',
            rankTextColor: 'text-white',
            shadow: 'shadow-md',
            scale: 'hover:scale-102',
        },
        // 4位
        {
            borderColor: 'border-gray-300',
            rankBgColor: 'bg-gray-300',
            rankTextColor: 'text-gray-800',
            shadow: 'shadow',
            scale: 'hover:scale-102',
        },
        // 5位
        {
            borderColor: 'border-gray-300',
            rankBgColor: 'bg-gray-300',
            rankTextColor: 'text-gray-800',
            shadow: 'shadow',
            scale: 'hover:scale-102',
        },
    ];
    // rankが5以上の場合でも安全にスタイルを取得
    const style = rankStyles[Math.min(rank - 1, 4)];

    return (
        <div className={`flex flex-col bg-white rounded-lg p-4 h-full border-2 transition-transform duration-300 ${style.borderColor} ${style.shadow} ${style.scale}`}>
            <div className="flex items-baseline justify-between mb-2">
                <div className={`px-3 py-1 text-sm font-bold rounded-full ${style.rankBgColor} ${style.rankTextColor}`}>
                    {rank}位
                </div>
                <div className="text-2xl font-extrabold text-red-600">
                    {hit.payout.toLocaleString()}円
                </div>
            </div>
             <div className="mt-1 text-right text-sm text-gray-700">
                <span className="font-semibold">{hit.bet_type}</span>: {hit.winning_numbers}
            </div>
            <div className="mt-auto pt-2 border-t mt-2">
                <div className="text-xs text-gray-500">
                    {new Date(hit.race_date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    {' '}{hit.venue_name}{hit.race_number}R
                </div>
                <div className="font-semibold text-gray-800 text-sm truncate" title={hit.race_name}>{hit.race_name}</div>
            </div>
        </div>
    );
};

const Skeleton = () => (
    <div className="mb-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
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
        <div className="mb-6">
            <h3 className="flex items-center text-2xl font-bold text-gray-800 mb-4">
               <TrophyIcon className="w-6 h-6 mr-2 text-yellow-500"/>
               AI高配当的中ランキング (過去7日間)
            </h3>
            {hits.length === 0 ? (
                <div className="p-6 bg-white border border-dashed rounded-lg text-center text-gray-500">
                    <p>対象期間内にAI予測による高配当的中はありませんでした。</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                    {hits.map((hit, index) => (
                        <HitCard key={`${hit.race_id}-${hit.bet_type}-${hit.payout}`} hit={hit} rank={index + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};