'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTopPayoutHits } from '@/lib/api';
import { TopPayoutHit } from '@/lib/types';
import { TrophyIcon } from './Icons';
import { getRaceDetailPath } from '@/lib/race-url';

const HitCard = ({ hit, rank, compact = false }: { hit: TopPayoutHit, rank: number, compact?: boolean }) => {
    const raceDate = new Date(hit.race_date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
    const rankTone = rank === 1
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : rank === 2
            ? 'border-slate-200 bg-slate-50 text-slate-600'
            : rank === 3
                ? 'border-orange-200 bg-orange-50 text-orange-700'
                : 'border-blue-100 bg-blue-50 text-blue-700';

    if (compact) {
        return (
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2 transition-colors hover:border-slate-200 hover:bg-slate-50">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-black ${rankTone}`}>
                    {rank}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-bold text-slate-800">
                        {raceDate} {hit.venue_name}{hit.race_number}R
                    </div>
                    <div className="truncate text-[10px] text-slate-400" title={`${hit.bet_type}: ${hit.winning_numbers}`}>
                        {hit.bet_type}: {hit.winning_numbers}
                    </div>
                </div>
                <span className="shrink-0 text-xs font-black tracking-tight text-red-600">
                    {hit.payout.toLocaleString()}円
                </span>
            </div>
        );
    }

    return (
        <div className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 sm:px-3.5 sm:py-3">
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-black ${rankTone}`}>
                {rank}位
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-black text-slate-900 sm:text-base">
                        {hit.payout.toLocaleString()}円
                    </span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                        {hit.bet_type}
                    </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-500 sm:text-xs">
                    {raceDate} {hit.venue_name}{hit.race_number}R
                </div>
            </div>
            <div className="shrink-0 text-right">
                <div className="text-[10px] font-bold text-slate-400">組番</div>
                <div className="max-w-[92px] truncate text-xs font-black text-slate-700 sm:max-w-[120px]" title={hit.winning_numbers}>
                    {hit.winning_numbers}
                </div>
            </div>
        </div>
    );
};

const Skeleton = ({ compact = false }: { compact?: boolean }) => (
    <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
        {compact ? (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded-lg border border-gray-200"></div>
                ))}
            </div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-14 sm:h-24 bg-gray-100 rounded-lg border border-gray-200 ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}></div>
                ))}
            </div>
        )}
    </div>
);

// ▼▼▼▼▼【SSRプリフェッチ対応】▼▼▼▼▼
// initialHitsが渡された場合はクライアント側のAPIコールをスキップ
export const TopHitsDisplay = ({ initialHits, compact = false }: { initialHits?: TopPayoutHit[], compact?: boolean }) => {
    const [hits, setHits] = useState<TopPayoutHit[]>(initialHits || []);
    const [isLoading, setIsLoading] = useState(!initialHits);

    useEffect(() => {
        // SSRで既にデータがある場合はスキップ
        if (initialHits) {
            setHits(initialHits);
            setIsLoading(false);
            return;
        }

        const fetchHits = async () => {
            setIsLoading(true);
            try {
                const data = await getTopPayoutHits();
                const sortedAndLimitedHits = data.slice(0, 5);
                setHits(sortedAndLimitedHits);
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
        return <Skeleton compact={compact} />;
    }

    const getDateRangeLabel = () => {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        const end = new Date(now);
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
        return `${fmt(start)}〜${fmt(end)}`;
    };

    return (
        <div>
            {!compact && (
                <h2 className="sec-title px-1 mb-1.5 sm:mb-2 flex items-center">
                    <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 shrink-0" />
                    <span className="whitespace-nowrap ml-1">高配当的中ランキング</span>
                    <span className="text-[10px] sm:text-xs font-normal text-muted ml-1.5 whitespace-nowrap self-end mb-0.5">({getDateRangeLabel()})</span>
                </h2>
            )}
            {hits.length === 0 ? (
                <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm">
                    <p>対象期間の的中実績はありませんでした。</p>
                </div>
            ) : compact ? (
                <div className="space-y-1.5">
                    {hits.map((hit, index) => (
                        <Link
                            key={`${hit.race_id}-${hit.winning_numbers}`}
                            href={getRaceDetailPath(hit.race_date, hit.venue_name, hit.race_number)}
                            className="block"
                        >
                            <HitCard hit={hit} rank={index + 1} compact />
                        </Link>
                    ))}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-2">
                        {hits.map((hit, index) => (
                            <Link
                                key={`${hit.race_id}-${hit.winning_numbers}`}
                                href={getRaceDetailPath(hit.race_date, hit.venue_name, hit.race_number)}
                                className="block h-full"
                            >
                                <HitCard hit={hit} rank={index + 1} />
                            </Link>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
