'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTopPayoutHits } from '@/lib/api';
import { TopPayoutHit } from '@/lib/types';
import { TrophyIcon } from './Icons';
import { Adsense } from './Adsense';

const HitCard = ({ hit, rank }: { hit: TopPayoutHit, rank: number }) => {
    const rankStyles = [
        { borderColor: 'border-amber-200', rankBgColor: 'bg-amber-50', rankTextColor: 'text-amber-700', shadow: 'shadow-sm', scale: 'hover-lift' },
        { borderColor: 'border-slate-200', rankBgColor: 'bg-slate-50', rankTextColor: 'text-slate-600', shadow: 'shadow-sm', scale: 'hover-lift' },
        { borderColor: 'border-orange-200', rankBgColor: 'bg-orange-50', rankTextColor: 'text-orange-700', shadow: 'shadow-sm', scale: 'hover-lift' },
        { borderColor: 'border-slate-100', rankBgColor: 'bg-slate-50', rankTextColor: 'text-slate-500', shadow: '', scale: 'hover-lift' },
        { borderColor: 'border-slate-100', rankBgColor: 'bg-slate-50', rankTextColor: 'text-slate-500', shadow: '', scale: 'hover-lift' },
    ];
    const style = rankStyles[Math.min(rank - 1, 4)];

    return (
        <div className={`bg-white rounded-xl border ${style.borderColor} ${style.shadow} ${style.scale} p-3 sm:p-4 flex flex-col items-start gap-1 sm:gap-2 h-full`}>
            <div className="flex justify-between items-center w-full">
                <div className={`text-[10px] sm:text-xs font-bold whitespace-nowrap ${style.rankTextColor} ${style.rankBgColor} rounded px-1.5 sm:px-2 py-0.5`}>
                    {rank}位
                </div>
                <div className="font-bold text-red-600 text-sm sm:text-base lg:text-lg whitespace-nowrap leading-none">
                    {hit.payout.toLocaleString()}円
                </div>
            </div>
            <div className="text-left w-full">
                <div className="text-[10px] sm:text-xs text-text-muted mb-0.5 font-medium">
                    {new Date(hit.race_date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    {' '}{hit.venue_name}{hit.race_number}R
                </div>
                <div className="text-xs sm:text-sm text-text-primary font-bold truncate mb-0.5" title={hit.race_name}>
                    {hit.race_name}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-600 truncate" title={`${hit.bet_type}: ${hit.winning_numbers}`}>
                    {hit.bet_type}: {hit.winning_numbers}
                </div>
            </div>
        </div>
    );
};

const Skeleton = () => (
    <div className="animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-20 sm:h-24 bg-gray-100 rounded-lg border border-gray-200 ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}></div>
            ))}
        </div>
    </div>
);

// ▼▼▼▼▼【SSRプリフェッチ対応】▼▼▼▼▼
// initialHitsが渡された場合はクライアント側のAPIコールをスキップ
export const TopHitsDisplay = ({ initialHits }: { initialHits?: TopPayoutHit[] }) => {
    const [hits, setHits] = useState<TopPayoutHit[]>(initialHits || []);
    const [isLoading, setIsLoading] = useState(!initialHits);
    const [showAd, setShowAd] = useState((initialHits || []).length > 0);

    useEffect(() => {
        // SSRで既にデータがある場合はスキップ
        if (initialHits) {
            setHits(initialHits);
            setIsLoading(false);
            setShowAd(initialHits.length > 0);
            return;
        }

        const fetchHits = async () => {
            setIsLoading(true);
            try {
                const data = await getTopPayoutHits();
                const sortedAndLimitedHits = data.slice(0, 5);
                setHits(sortedAndLimitedHits);
                setShowAd(sortedAndLimitedHits.length > 0);
            } catch (e) {
                console.error("Failed to fetch top hits:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHits();
    }, [initialHits]);
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

    if (isLoading) {
        return <Skeleton />;
    }

    return (
        <div>
            <h2 className="flex items-center text-base sm:text-xl font-bold text-gray-800 mb-2 sm:mb-3 px-1">
                <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-yellow-500" />
                <span className="whitespace-nowrap">高配当的中ランキング</span>
                <span className="text-[10px] sm:text-xs font-normal text-gray-500 ml-1.5 sm:ml-2 whitespace-nowrap self-end mb-0.5 sm:mb-1">(直近7日間)</span>
            </h2>
            {hits.length === 0 ? (
                <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm">
                    <p>対象期間の的中実績はありませんでした。</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
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
                    {/* AdSense審査通過後に有効化する
                    {showAd && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="text-[10px] text-gray-400 text-center mb-2">スポンサーリンク</div>
                            <Adsense
                                client="ca-pub-4411270831448240"
                                slot="3207214308"
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                    )}
                    */}
                </>
            )}
        </div>
    );
};