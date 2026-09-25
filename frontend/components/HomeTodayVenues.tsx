'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AffiliateSlot } from '@/components/AffiliateSlot';
import { getPredictionsForDate } from '@/lib/api';
import {
    summarizeHomeVenues,
    type HomeVenueSummary,
} from '@/lib/home-page-summary';
import { getRaceDetailPath } from '@/lib/race-url';
import { sendHomeRaceEntryClickEvent } from '@/lib/analytics';
import { GradeBadge, HorseNumber, RaceNumberBox } from '@/components/RaceParts';
import { LineIcon } from '@/components/LineIcon';

type RefreshStatus = 'ready' | 'checking' | 'waiting' | 'empty';

type HomeTodayVenuesProps = {
    date: string;
    initialVenues: HomeVenueSummary[];
    // サーバーで描いたコース図（会場名 → 要素）
    glyphs?: Record<string, ReactNode>;
};

// wide：スマホの2列で会場数が奇数のとき、最後のカードを2列ぶんに広げて空きを作らない。
// 広げたカードは「メイン」と「AI 1位」を左右に並べ、縦を伸ばさない（xl以上はふつうの1枠）。
function VenueTile({ venue, date, glyph, wide = false }: { venue: HomeVenueSummary; date: string; glyph?: ReactNode; wide?: boolean }) {
    const main = venue.main;
    return (
        <Link
            prefetch={false}
            href={venue.first_race_number
                ? getRaceDetailPath(date, venue.venue_name, venue.first_race_number)
                : `/races/${date}`}
            onClick={() => {
                sendHomeRaceEntryClickEvent({
                    race_date: date,
                    entry_method: 'venue_card',
                    race_type: venue.race_type,
                    venue_name: venue.venue_name,
                });
            }}
            className={`flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 pb-3 pt-3.5 transition-colors duration-150 hover:border-brand-300 md:gap-3 md:px-[18px] md:pb-4 md:pt-[18px] ${wide ? 'col-span-2 xl:col-span-1' : ''}`}
        >
            <span className="flex items-start justify-between gap-2">
                <span className="flex flex-col gap-1">
                    <span className="font-display text-[21px] font-extrabold leading-none text-slate-900 md:text-[26px]">{venue.venue_name}</span>
                    <span className="whitespace-nowrap text-[12px] font-bold text-slate-500">
                        全{venue.race_count}R{venue.surfaces ? ` · ${venue.surfaces}` : ''}
                    </span>
                </span>
                {glyph && <span className="block w-[58px] min-w-0 max-w-[35%] max-[359px]:w-[44px] xl:w-[92px]" aria-hidden="true">{glyph}</span>}
            </span>
            {main && (
                <>
                    <span className="h-px bg-slate-200" aria-hidden="true" />
                    <span className={wide ? 'grid min-w-0 grid-cols-2 gap-3 xl:contents' : 'contents'}>
                        <span className="flex min-w-0 flex-col gap-1.5">
                            <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500">
                                {main.label}
                                <GradeBadge grade={main.grade} />
                            </span>
                            <span className="flex min-w-0 items-center gap-2">
                                <RaceNumberBox raceNumber={main.race_number} size={28} />
                                <span className="min-w-0 truncate text-[13px] font-bold text-slate-900 md:text-[14.5px]">{main.race_name}</span>
                            </span>
                        </span>
                        {main.top ? (
                            // スマホ・タブレットは「AI 1位 … 偏差値」と馬名を2段に分け、馬名を切れにくくする。lg以上は1行
                            <span className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-1.5">
                                <span className="flex items-baseline justify-between lg:contents">
                                    <span className="whitespace-nowrap text-[11.5px] font-bold text-ai-deep">AI 1位</span>
                                    <span className="font-num text-[16px] font-bold text-ai-deep md:text-[17px] lg:order-last">{main.top.score.toFixed(1)}</span>
                                </span>
                                <span className="flex min-w-0 items-center gap-1.5 lg:flex-1">
                                    <HorseNumber number={main.top.number} waku={main.top.waku} size={20} />
                                    <span className="min-w-0 break-words text-[13px] font-bold text-slate-900 md:text-[14px]">{main.top.name}</span>
                                </span>
                            </span>
                        ) : (
                            <span className="text-[12px] text-slate-500">AI偏差値の対象外のレースです</span>
                        )}
                    </span>
                </>
            )}
            <span className="hidden h-10 items-center justify-center gap-1.5 rounded-[10px] bg-brand-50 text-[13.5px] font-bold text-brand-700 md:flex">
                1Rから確認する
                <LineIcon name="arrowR" size={16} />
            </span>
        </Link>
    );
}

// タブレットは2列を保ち、広いPCで会場数に合わせる。図と名称の幅を確保する。
const venueGridCols = (count: number) => (count >= 4 ? 'xl:grid-cols-4' : count === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2');

const hasVenueData = (venues: HomeVenueSummary[]): boolean => (
    venues.length > 0
);

export function HomeTodayVenues({
    date,
    initialVenues,
    glyphs = {},
}: HomeTodayVenuesProps) {
    const initialHasVenueData = hasVenueData(initialVenues);
    const [venues, setVenues] = useState<HomeVenueSummary[]>(initialVenues);
    const [status, setStatus] = useState<RefreshStatus>(
        initialHasVenueData ? 'ready' : 'checking',
    );
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (hasVenueData(initialVenues)) {
            setVenues(initialVenues);
            setStatus('ready');
            return;
        }

        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const refresh = async (attempt: number) => {
            setStatus(attempt === 0 ? 'checking' : 'waiting');
            const freshPredictions = await getPredictionsForDate(date, { bypassCache: true });

            if (cancelled) return;

            const freshVenues = summarizeHomeVenues(freshPredictions);
            if (hasVenueData(freshVenues)) {
                setVenues(freshVenues);
                setStatus('ready');
                return;
            }

            if (attempt === 0) {
                setStatus('waiting');
                retryTimer = setTimeout(() => {
                    void refresh(1);
                }, 60_000);
                return;
            }

            setStatus('empty');
        };

        void refresh(0);

        return () => {
            cancelled = true;
            if (retryTimer) {
                clearTimeout(retryTimer);
            }
        };
    }, [date, initialVenues, refreshKey]);

    const jraVenues = venues.filter((venue) => venue.race_type === 'jra');
    const narVenues = venues.filter((venue) => venue.race_type === 'nar');
    const showVenues = jraVenues.length > 0 || narVenues.length > 0;
    const orderedVenues = [...jraVenues, ...narVenues];

    return (
        <>
            <div className={`grid grid-cols-2 gap-2.5 md:gap-4 ${venueGridCols(orderedVenues.length)}`}>
                {orderedVenues.map((venue, index) => (
                    <VenueTile
                        key={venue.venue_name}
                        venue={venue}
                        date={date}
                        glyph={glyphs[venue.venue_name]}
                        wide={orderedVenues.length % 2 === 1 && index === orderedVenues.length - 1}
                    />
                ))}

                {!showVenues && (
                    <div className="col-span-full rounded-xl border border-slate-200 bg-white py-6 text-center">
                        <p className="text-sm text-slate-600">
                            {status === 'checking' && '本日のレースデータを確認しています。'}
                            {status === 'waiting' && '本日のレースデータを更新中です。約1分後に自動で再確認します。'}
                            {status === 'empty' && '本日のレースデータの反映に時間がかかっています。'}
                        </p>
                        {status === 'empty' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setStatus('checking');
                                    setRefreshKey((current) => current + 1);
                                }}
                                className="ui-btn ui-btn--ghost mt-2"
                            >
                                データを再確認
                            </button>
                        )}
                    </div>
                )}
            </div>

            {narVenues.length > 0 && (
                <AffiliateSlot
                    context="home_nar_voting"
                    raceType="nar"
                    selectionKey={date}
                    // スマホは外側の余白を持たず、親の gap（12px）で間を決める。PCは今までどおり上16px・下12px
                    className="sm:mt-4 sm:mb-3"
                />
            )}
        </>
    );
}
