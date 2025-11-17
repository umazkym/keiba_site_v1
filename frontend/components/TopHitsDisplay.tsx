'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTopPayoutHits } from '@/lib/api';
import { TopPayoutHit } from '@/lib/types';
import { TrophyIcon } from './Icons';
import { Adsense } from './Adsense';

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
        <div className={`bg-white rounded-lg border-2 transition-all duration-300 ${style.borderColor} ${style.shadow} ${style.scale} p-2 flex flex-col items-start gap-1 h-full hover:bg-gray-50`}>
            <div className="flex justify-between items-center w-full">
                <div className={`text-xs font-bold whitespace-nowrap ${style.rankTextColor} ${style.rankBgColor} rounded px-2 py-1`}>
                    {rank}位
                </div>
                <div className="font-bold text-red-600 text-base lg:text-lg whitespace-nowrap leading-none">
                    {hit.payout.toLocaleString()}円
                </div>
            </div>
            <div className="text-left w-full mt-1">
                <div className="text-xs text-gray-500">
                    {new Date(hit.race_date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    {' '}{hit.venue_name}{hit.race_number}R
                </div>
                <div className="text-xs text-gray-800 font-semibold truncate" title={hit.race_name}>
                  {hit.race_name}
                </div>
                <div className="text-xs text-gray-700 font-medium truncate" title={`${hit.bet_type}: ${hit.winning_numbers}`}>
                    {hit.bet_type}: {hit.winning_numbers}
                </div>
            </div>
        </div>
    );
};

const Skeleton = () => (
    <div className="animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
        </div>
    </div>
);

export const TopHitsDisplay = () => {
    const [hits, setHits] = useState<TopPayoutHit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAd, setShowAd] = useState(false);

    useEffect(() => {
        const fetchHits = async () => {
            setIsLoading(true);
            try {
                const data = await getTopPayoutHits();
                // バックエンドが既に上位5件を返しているため、重複排除なしで直接使用
                const sortedAndLimitedHits = data.slice(0, 5);
                setHits(sortedAndLimitedHits);
                // 的中実績がある場合のみ広告を表示
                setShowAd(sortedAndLimitedHits.length > 0);
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
               <span className="whitespace-nowrap">高配当的中ランキング</span>
               <span className="text-sm font-normal text-gray-500 ml-2 whitespace-nowrap">(直近7日間)</span>
            </h3>
            {hits.length === 0 ? (
                <div className="p-4 bg-white border border-dashed rounded-lg text-center text-gray-500">
                    <p>対象期間の的中実績はありませんでした。</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
                        {hits.map((hit, index) => (
                            <Link
                                key={`${hit.race_id}-${hit.winning_numbers}`}
                                href={`/races/${hit.race_date}?race=${hit.race_number}&venue=${encodeURIComponent(hit.venue_name)}`}
                                className="block h-full"
                            >
                                <HitCard hit={hit} rank={index + 1} />
                            </Link>
                        ))}
                    </div>
                    {/* 的中実績の下に広告を表示 */}
                    {showAd && (
                        <div className="mt-4 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-500 text-center mb-1">スポンサーリンク</div>
                            <Adsense
                                client="ca-pub-4411270831448240"
                                slot="3207214308"
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};