'use client';

import { useState, useEffect } from 'react';
import { getTopPayoutHits } from '@/lib/api';
import { TopPayoutHit } from '@/lib/types';

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


export const TopHitsDisplay = () => {
    const [hits, setHits] = useState<TopPayoutHit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHits = async () => {
            setIsLoading(true);
            const data = await getTopPayoutHits();
            setHits(data);
            setIsLoading(false);
        };
        fetchHits();
    }, []);

    if (isLoading) {
        return (
            <div className="mb-6 p-4 bg-white border rounded-lg shadow-sm text-center text-gray-500">
                高配当ランキングを読み込み中...
            </div>
        );
    }

    if (hits.length === 0) {
         return (
             <div className="mb-6 p-4 bg-gray-100 border border-dashed rounded-lg text-center text-gray-500">
                <h3 className="text-lg font-bold text-gray-700 mb-2">過去1週間のAI高配当ランキング</h3>
                <p>対象期間内にAI予測による高配当的中はありませんでした。</p>
            </div>
        );
    }

    return (
        <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
                過去1週間のAI高配当的中ランキング
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {hits.map((hit, index) => (
                    <HitCard key={`${hit.race_id}-${hit.bet_type}-${hit.payout}`} hit={hit} rank={index + 1} />
                ))}
            </div>
        </div>
    );
};