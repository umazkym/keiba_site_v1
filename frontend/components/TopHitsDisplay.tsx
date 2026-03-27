'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTopPayoutHits } from '@/lib/api';
import { TopPayoutHit } from '@/lib/types';
import { NativeCardAd } from '@/components/NativeCardAd';
import { TrophyIcon } from './Icons';
import { Adsense } from './Adsense';

const HitCard = ({ hit, rank }: { hit: TopPayoutHit, rank: number }) => {
    let rankClass = 'rank-default';
    if (rank === 1) rankClass = 'rank-1';
    else if (rank === 2) rankClass = 'rank-2';
    else if (rank === 3) rankClass = 'rank-3';

    return (
        <div className="hit-card flex flex-col items-start justify-center h-full">
            <div className="hit-top w-full">
                <span className={`hit-rank ${rankClass}`}>{rank}位</span>
                <span className="hit-payout">{hit.payout.toLocaleString()}円</span>
            </div>
            <div className="text-left w-full">
                <div className="hit-info">
                    {new Date(hit.race_date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    {' '}{hit.venue_name}{hit.race_number}R
                </div>
                <div className="hit-name" title={hit.race_name}>
                    {hit.race_name}
                </div>
                <div className="hit-bet" title={`${hit.bet_type}: ${hit.winning_numbers}`}>
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
            <h2 className="sec-title px-1 mb-2">
                <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                <span className="whitespace-nowrap ml-1">高配当的中ランキング</span>
                <span className="text-[10px] sm:text-xs font-normal text-muted ml-1.5 whitespace-nowrap self-end mb-0.5">(直近7日)</span>
            </h2>
            {hits.length === 0 ? (
                <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm">
                    <p>対象期間の的中実績はありませんでした。</p>
                </div>
            ) : (
                <>
                    <div className="hits-grid">
                        {hits.map((hit, index) => (
                            <Link
                                key={`${hit.race_id}-${hit.winning_numbers}`}
                                href={`/races/${hit.race_date}?race=${hit.race_number}&venue=${encodeURIComponent(hit.venue_name)}`}
                                className="block h-full"
                            >
                                <HitCard hit={hit} rank={index + 1} />
                            </Link>
                        ))}
                        {/* モバイルで右下が空くのでネイティブ広告で穴埋め（PC時は5列なので非表示） */}
                        {hits.length === 5 && (
                            <div className="block h-full lg:hidden rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col justify-center items-center min-h-[140px] p-2">
                                <span className="text-[9px] text-slate-400 mb-1">スポンサーリンク</span>
                                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                    <NativeCardAd slot="1489598374" variant="article" className="w-full" />
                                </div>
                            </div>
                        )}
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