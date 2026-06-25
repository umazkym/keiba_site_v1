'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AffiliateSlot } from '@/components/AffiliateSlot';
import { getPredictionsForDate } from '@/lib/api';
import { getRaceDetailPath } from '@/lib/race-url';
import type { RaceDayPrediction } from '@/lib/types';
import { sendHomeRaceEntryClickEvent } from '@/lib/analytics';

type RefreshStatus = 'ready' | 'checking' | 'waiting' | 'empty';

type HomeTodayVenuesProps = {
    date: string;
    initialPredictions: RaceDayPrediction | null;
};

const hasVenueData = (predictions: RaceDayPrediction | null): boolean => (
    Boolean((predictions?.jra?.length ?? 0) > 0 || (predictions?.nar?.length ?? 0) > 0)
);

export function HomeTodayVenues({
    date,
    initialPredictions,
}: HomeTodayVenuesProps) {
    const initialHasVenueData = hasVenueData(initialPredictions);
    const [predictions, setPredictions] = useState<RaceDayPrediction | null>(initialPredictions);
    const [status, setStatus] = useState<RefreshStatus>(
        initialHasVenueData ? 'ready' : 'checking',
    );
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (hasVenueData(initialPredictions)) {
            setPredictions(initialPredictions);
            setStatus('ready');
            return;
        }

        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const refresh = async (attempt: number) => {
            setStatus(attempt === 0 ? 'checking' : 'waiting');
            const freshPredictions = await getPredictionsForDate(date, { bypassCache: true });

            if (cancelled) return;

            if (hasVenueData(freshPredictions)) {
                setPredictions(freshPredictions);
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
    }, [date, initialPredictions, refreshKey]);

    const jraVenues = predictions?.jra ?? [];
    const narVenues = predictions?.nar ?? [];
    const showVenues = jraVenues.length > 0 || narVenues.length > 0;

    return (
        <>
            <div className="venue-grid">
                {jraVenues.map((venue) => (
                    <Link
                        key={venue.venue_name}
                        prefetch={false}
                        href={venue.races[0]
                            ? getRaceDetailPath(date, venue.venue_name, venue.races[0].race_number)
                            : `/races/${date}`}
                        onClick={() => {
                            sendHomeRaceEntryClickEvent({
                                race_date: date,
                                entry_method: 'venue_card',
                                race_type: 'jra',
                                venue_name: venue.venue_name,
                            });
                        }}
                        className="venue-chip"
                    >
                        <strong>{venue.venue_name}</strong>
                        <small>全{venue.races.length}R</small>
                        <span className="venue-state">分析公開</span>
                    </Link>
                ))}

                {narVenues.map((venue) => (
                    <Link
                        key={venue.venue_name}
                        prefetch={false}
                        href={venue.races[0]
                            ? getRaceDetailPath(date, venue.venue_name, venue.races[0].race_number)
                            : `/races/${date}`}
                        onClick={() => {
                            sendHomeRaceEntryClickEvent({
                                race_date: date,
                                entry_method: 'venue_card',
                                race_type: 'nar',
                                venue_name: venue.venue_name,
                            });
                        }}
                        className="venue-chip"
                    >
                        <strong>{venue.venue_name}</strong>
                        <small>全{venue.races.length}R</small>
                        <span className="venue-state muted">地方競馬</span>
                    </Link>
                ))}

                {!showVenues && (
                    <div className="col-span-full py-4 text-center">
                        <p className="text-sm text-slate-500">
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
                                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
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
                    className="mt-4"
                />
            )}
        </>
    );
}
