'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTopPayoutHits } from '@/lib/api';
import { TopPayoutHit } from '@/lib/types';
import { SectionHeader } from './SectionHeader';
import { getRaceDetailPath } from '@/lib/race-url';

const formatShortRaceDate = (date: string): string => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return date;
    return `${Number(match[2])}/${Number(match[3])}`;
};

const getDateRangeLabel = (hits: TopPayoutHit[]): string => {
    const dates = hits
        .map((hit) => hit.race_date)
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort();

    if (dates.length === 0) return '直近の実績';

    const start = formatShortRaceDate(dates[0]);
    const end = formatShortRaceDate(dates[dates.length - 1]);
    return start === end ? start : `${start}〜${end}`;
};

const HitCard = ({ hit, rank, compact = false }: { hit: TopPayoutHit, rank: number, compact?: boolean }) => {
    const raceDate = formatShortRaceDate(hit.race_date);

    if (compact) {
        return (
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 transition-colors duration-150 hover:border-brand-300">
                <span className={`w-6 shrink-0 font-num text-[17px] font-bold ${rank === 1 ? 'text-navy' : 'text-slate-500'}`}>{rank}</span>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-slate-800">
                        {raceDate} {hit.venue_name}{hit.race_number}R
                    </div>
                    <div className="truncate text-[11px] text-slate-500" title={`${hit.bet_type}: ${hit.winning_numbers}`}>
                        {hit.bet_type} {hit.winning_numbers}
                    </div>
                </div>
                <span className="shrink-0 font-num text-[15px] font-bold text-slate-900">
                    {hit.payout.toLocaleString('en-US')}<span className="ml-0.5 font-sans text-[11px]">円</span>
                </span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 border-b border-slate-200 py-2.5 transition-colors duration-150 hover:bg-slate-50 md:grid-cols-[30px_150px_76px_minmax(0,1fr)_auto] md:gap-x-3.5 md:py-3">
            <span className={`font-num text-[18px] font-bold md:text-[20px] ${rank === 1 ? 'text-navy' : 'text-slate-500'}`}>{rank}</span>
            <span className="font-num text-[19px] font-bold text-slate-900 md:text-[22px]">
                {hit.payout.toLocaleString('en-US')}<span className="ml-0.5 font-sans text-[12px]">円</span>
            </span>
            <span className="justify-self-end md:justify-self-start">
                <span className="inline-flex items-center rounded-[5px] bg-navy-soft px-1.5 py-0.5 text-[11.5px] font-bold text-navy">{hit.bet_type}</span>
            </span>
            <span className="col-span-2 truncate text-[12.5px] text-slate-500 md:col-span-1 md:text-[13.5px] md:text-slate-700">
                {raceDate} {hit.venue_name}{hit.race_number}R<span className="hidden md:inline"> {hit.race_name}</span>
                <span className="md:hidden"> · 組番 <b className="font-num text-[14px] text-slate-700">{hit.winning_numbers}</b></span>
            </span>
            <span className="hidden font-num text-[16px] font-bold text-slate-700 md:block">{hit.winning_numbers}</span>
        </div>
    );
};

const Skeleton = ({ compact = false }: { compact?: boolean }) => (
    <div aria-busy="true" aria-label="的中ランキングを読み込み中">
        <div className="h-6 bg-slate-200 rounded w-1/2 mb-2"></div>
        {compact ? (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded-lg border border-slate-200"></div>
                ))}
            </div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-14 sm:h-24 bg-slate-100 rounded-lg border border-slate-200 ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}></div>
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

    return (
        <div>
            {!compact && (
                <SectionHeader
                    title="高配当的中ランキング"
                    meta={getDateRangeLabel(hits)}
                    className="mb-1"
                    compact
                />
            )}
            {hits.length === 0 ? (
                <div className="mt-2 rounded-lg bg-slate-100 p-5 text-center text-sm text-slate-600">
                    <p>対象期間の的中実績はありませんでした。</p>
                </div>
            ) : compact ? (
                <div className="space-y-1.5">
                    {hits.map((hit, index) => (
                        <Link
                            key={`${hit.race_id}-${hit.winning_numbers}`}
                            prefetch={false}
                            href={getRaceDetailPath(hit.race_date, hit.venue_name, hit.race_number)}
                            className="block"
                        >
                            <HitCard hit={hit} rank={index + 1} compact />
                        </Link>
                    ))}
                </div>
            ) : (
                <ol className="flex flex-col">
                    {hits.map((hit, index) => (
                        <li key={`${hit.race_id}-${hit.winning_numbers}`}>
                            <Link
                                prefetch={false}
                                href={getRaceDetailPath(hit.race_date, hit.venue_name, hit.race_number)}
                                className="block"
                            >
                                <HitCard hit={hit} rank={index + 1} />
                            </Link>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};
