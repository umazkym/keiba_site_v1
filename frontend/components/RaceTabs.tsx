'use client';
import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { PredictionTable } from '@/components/PredictionTable';
import { RaceAnalysis } from '@/components/RaceAnalysis';
import { VenueRaces, RaceDayPrediction } from '@/lib/types';
import { RaceSelector } from './RaceSelector';
import { StartPositionChart } from './StartPositionChart';
import { MatchupTable } from './MatchupTable';
import { HorseNumberAdvantageChart } from './HorseNumberAdvantageChart';
import { SparklesIcon, FlagIcon, UsersIcon, ChartBarIcon } from './Icons';
import { AffiliateSlot } from './AffiliateSlot';
import { RelatedRaces } from './RelatedRaces';
import { DataExplanationPanel } from './DataExplanationPanel';
import { DynamicRelatedArticles } from './DynamicRelatedArticles';
import { RaceArticleMeta } from '@/lib/articles';
import { useRewardedAd, type RewardedAdContext } from '@/hooks/useRewardedAd';
import {
    sendRaceGroupSelectEvent,
    sendRaceNavigationEvent,
    sendRaceVenueSelectEvent,
    sendRaceViewEvent,
    sendRewardGateEvent,
    type RaceNavigationMethod,
} from '@/lib/analytics';
import { LAST_RACE_STORAGE_KEY, StoredRaceView } from '@/lib/race-memory';
import { getRaceDetailPath } from '@/lib/race-url';
import { formatDate } from '@/lib/utils';
import { RACE_BREADCRUMB_CHANGE_EVENT } from '@/lib/race-breadcrumb-event';

const CollapsibleSection = memo(({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
        setIsOpen(e.currentTarget.open);
    };

    return (
        <details className="card" onToggle={handleToggle}>
            <summary className="flex items-center text-md font-bold text-gray-800 cursor-pointer list-none p-2 sm:p-3">
                <div className="w-6 h-6 mr-2 flex-shrink-0 text-primary">{icon}</div>
                <span className="whitespace-nowrap">{title}</span>
                <div className={`ml-auto transform transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </summary>
            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                {children}
            </div>
        </details>
    );
});

CollapsibleSection.displayName = 'CollapsibleSection';

const PremiumDetailPlaceholder = memo(({ showAd }: { showAd: boolean }) => (
    <>
        <div className="mb-2 card p-2 sm:p-3 min-h-[220px]" aria-hidden="true">
            <div className="flex items-center p-2 sm:p-3">
                <div className="h-5 w-5 rounded bg-slate-100" />
                <div className="ml-2 h-4 w-28 rounded bg-slate-100" />
            </div>
            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                <div className="h-[140px] rounded-lg border bg-slate-50" />
            </div>
        </div>
        {showAd && (
            <div className="mb-2 min-h-[180px] rounded-xl border border-slate-200 bg-slate-50" aria-hidden="true" />
        )}
        <div className="mb-2 grid gap-2 xl:grid-cols-2 xl:items-stretch" aria-hidden="true">
            {[0, 1].map((index) => (
                <div key={index} className="card p-2 sm:p-3 min-h-[250px]">
                    <div className="flex items-center p-2 sm:p-3">
                        <div className="h-5 w-5 rounded bg-slate-100" />
                        <div className="ml-2 h-4 w-32 rounded bg-slate-100" />
                    </div>
                    <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                        <div className="h-[180px] rounded-lg border bg-slate-50" />
                    </div>
                </div>
            ))}
        </div>
        <div className="mb-2 card p-2 sm:p-3 min-h-[220px]" aria-hidden="true">
            <div className="flex items-center p-2 sm:p-3">
                <div className="h-5 w-5 rounded bg-slate-100" />
                <div className="ml-2 h-4 w-36 rounded bg-slate-100" />
            </div>
            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                <div className="h-[140px] rounded-lg border bg-slate-50" />
            </div>
        </div>
    </>
));

PremiumDetailPlaceholder.displayName = 'PremiumDetailPlaceholder';

const isIntentionalRewardedDisableReason = (reason: string | null) => {
    return reason === 'rewarded_temporarily_disabled' || reason === 'rewarded_fullscreen_disabled';
};

const VenuePanel = memo(({ venue, raceType, articlesMeta, initialRaceNumber, venueActivationKey = 0, isRaceUnlocked, isReady, isLoading, isSupported, unavailableReason, showAd, unlock }: { venue: VenueRaces, raceType: 'jra' | 'nar', articlesMeta: RaceArticleMeta[], initialRaceNumber?: number | null, venueActivationKey?: number, isRaceUnlocked: (raceId: string) => boolean, isReady: boolean, isLoading: boolean, isSupported: boolean, unavailableReason: string | null, showAd: (context?: RewardedAdContext | string) => boolean, unlock: (raceId?: string) => void }) => {
    const params = useParams();
    const currentDate = params.date as string;
    const gateViewKeysRef = useRef<Set<string>>(new Set());
    const adAvailabilityKeysRef = useRef<Set<string>>(new Set());
    const premiumViewKeysRef = useRef<Set<string>>(new Set());
    const fallbackKeysRef = useRef<Set<string>>(new Set());

    const initialIndex = useMemo(() => {
        if (!initialRaceNumber) return 0;
        const index = venue.races.findIndex(r => r.race_number === initialRaceNumber);
        return index >= 0 ? index : 0;
    }, [venue.races, initialRaceNumber]);

    const [activeRaceIndex, setActiveRaceIndex] = useState(initialIndex);
    const activeRace = venue.races[activeRaceIndex];
    const isActiveRaceUnlocked = activeRace ? isRaceUnlocked(activeRace.id) : false;
    const rewardAdStatus = isLoading ? 'loading' : isSupported ? 'ready' : 'unavailable';
    const canUseRewardedAd = isSupported && isReady && !isLoading;
    const isPremiumDetailVisible = isActiveRaceUnlocked || !canUseRewardedAd;
    const shouldShowRewardGate = Boolean(activeRace && !isPremiumDetailVisible);
    const [isPremiumContentReady, setIsPremiumContentReady] = useState(false);
    const previousInitialRaceNumberRef = useRef(initialRaceNumber);

    // ブラウザ「戻る」対応
    useEffect(() => {
        if (previousInitialRaceNumberRef.current === initialRaceNumber) return;
        previousInitialRaceNumberRef.current = initialRaceNumber;

        if (initialRaceNumber) {
            const newIndex = venue.races.findIndex(r => r.race_number === initialRaceNumber);
            if (newIndex >= 0) {
                setActiveRaceIndex(prev => prev === newIndex ? prev : newIndex);
            }
        }
    }, [initialRaceNumber, venue.races]);

    useEffect(() => {
        setIsPremiumContentReady(false);
        if (!activeRace || !isPremiumDetailVisible) return;

        const timer = window.setTimeout(() => {
            setIsPremiumContentReady(true);
        }, 120);

        return () => window.clearTimeout(timer);
    }, [activeRace?.id, isPremiumDetailVisible]);

    const scrollVenueIntoView = useCallback(() => {
        if (typeof window === 'undefined') return;

        window.requestAnimationFrame(() => {
            const raceContent = document.getElementById(`venue-${venue.venue_name}`);
            if (!raceContent) return;

            const offset = window.innerWidth < 640 ? 68 : 82;
            const top = window.scrollY + raceContent.getBoundingClientRect().top - offset;
            window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        });
    }, [venue.venue_name]);

    const handleRaceSelect = useCallback((index: number, navigationMethod: RaceNavigationMethod = 'race_selector') => {
        if (!activeRace || index === activeRaceIndex) return;

        const selectedRace = venue.races[index];
        if (selectedRace) {
            sendRaceNavigationEvent({
                race_date: currentDate,
                venue_name: venue.venue_name,
                race_type: raceType,
                from_race_number: activeRace.race_number,
                to_race_number: selectedRace.race_number,
                navigation_method: navigationMethod,
            });
            setActiveRaceIndex(index);
            const newUrl = getRaceDetailPath(currentDate, venue.venue_name, selectedRace.race_number);
            if (typeof window !== 'undefined') {
                window.history.replaceState(window.history.state, '', newUrl);
            }
            scrollVenueIntoView();
        }
    }, [activeRace, activeRaceIndex, venue.races, venue.venue_name, currentDate, raceType, scrollVenueIntoView]);

    // ★ ビューアビリティ改善: 条件を5→3頭に緩和し、ほぼ全レースで広告表示
    const shouldShowAd = useMemo(() => {
        return activeRace && activeRace.predictions.length >= 3;
    }, [activeRace]);

    const adRefreshKey = useMemo(() => {
        return activeRace ? `${venue.venue_name}-${activeRace.race_number}-v${venueActivationKey}` : '';
    }, [venue.venue_name, activeRace, venueActivationKey]);

    const buildRewardContext = useCallback((gatePlacement = 'race_detail_overlay'): RewardedAdContext | null => {
        if (!activeRace) return null;

        return {
            race_id: activeRace.id,
            race_date: currentDate || activeRace.race_date,
            venue_name: venue.venue_name,
            race_number: activeRace.race_number,
            race_name: activeRace.race_name,
            gate_placement: gatePlacement,
            reward_type: 'race_detail_data',
            ad_status: rewardAdStatus,
            reason: unavailableReason ?? undefined,
        };
    }, [activeRace, currentDate, venue.venue_name, rewardAdStatus, unavailableReason]);

    const handleRewardGateClick = useCallback((gatePlacement = 'race_detail_overlay') => {
        if (!activeRace) return;
        const context = buildRewardContext(gatePlacement);
        if (!context) return;

        sendRewardGateEvent('reward_gate_click', context);

        if (canUseRewardedAd) {
            const started = showAd(context);
            if (started) return;

            sendRewardGateEvent('reward_ad_unavailable', {
                ...context,
                reason: 'rewarded_start_failed',
            });
            return;
        }

        sendRewardGateEvent('reward_ad_unavailable', {
            ...context,
            reason: isLoading ? 'rewarded_loading' : unavailableReason ?? 'rewarded_unavailable',
        });

        sendRewardGateEvent('reward_fallback_used', {
            ...context,
            reason: isLoading ? 'rewarded_loading' : unavailableReason ?? 'rewarded_unavailable',
        });
        unlock(activeRace.id);
    }, [activeRace, buildRewardContext, canUseRewardedAd, isLoading, showAd, unavailableReason, unlock]);

    useEffect(() => {
        if (!activeRace || typeof window === 'undefined') return;

        const href = getRaceDetailPath(currentDate, venue.venue_name, activeRace.race_number);
        const viewedRace: StoredRaceView = {
            href,
            date: currentDate,
            venueName: venue.venue_name,
            raceNumber: activeRace.race_number,
            raceName: activeRace.race_name,
            courseLabel: `${activeRace.course_type} ${activeRace.distance}m`,
            viewedAt: Date.now(),
        };

        try {
            window.localStorage.setItem(LAST_RACE_STORAGE_KEY, JSON.stringify(viewedRace));
        } catch {
            // localStorageが使えない環境では導線保存のみスキップする。
        }

        if (window.location.pathname.replace(/\/+$/, '') === href.replace(/\/+$/, '')) {
            window.dispatchEvent(new CustomEvent(RACE_BREADCRUMB_CHANGE_EVENT, {
                detail: {
                    items: [
                        { label: 'ホーム', href: '/' },
                        { label: 'レース分析', href: '/races/today' },
                        { label: `${formatDate(currentDate)}のレース分析`, href: `/races/${currentDate}` },
                        { label: `${venue.venue_name}${activeRace.race_number}R ${activeRace.race_name}`, href: '' },
                    ],
                },
            }));
        }

        sendRaceViewEvent({
            race_date: currentDate,
            venue_name: venue.venue_name,
            race_number: activeRace.race_number,
            race_name: activeRace.race_name,
            race_type: raceType,
        });
    }, [
        activeRace?.id,
        activeRace?.race_number,
        activeRace?.race_name,
        activeRace?.course_type,
        activeRace?.distance,
        currentDate,
        raceType,
        venue.venue_name,
    ]);

    useEffect(() => {
        if (!activeRace || !shouldShowRewardGate) return;
        const context = buildRewardContext();
        if (!context) return;

        const key = `${activeRace.id}:gate_view`;
        if (gateViewKeysRef.current.has(key)) return;
        gateViewKeysRef.current.add(key);
        sendRewardGateEvent('reward_gate_view', context);
    }, [activeRace, shouldShowRewardGate, buildRewardContext]);

    useEffect(() => {
        if (!activeRace || isActiveRaceUnlocked || !isReady) return;
        if (
            !isSupported &&
            (unavailableReason === 'rewarded_temporarily_disabled' || unavailableReason === 'rewarded_fullscreen_disabled')
        ) return;
        const context = buildRewardContext();
        if (!context) return;

        const status = isSupported ? 'ready' : 'unavailable';
        const key = `${currentDate}:${venue.venue_name}:${status}:${unavailableReason ?? 'none'}`;
        if (adAvailabilityKeysRef.current.has(key)) return;
        adAvailabilityKeysRef.current.add(key);
        sendRewardGateEvent(isSupported ? 'reward_ad_ready' : 'reward_ad_unavailable', {
            ...context,
            ad_status: status,
            reason: isSupported ? undefined : unavailableReason ?? 'rewarded_not_available',
        });
    }, [activeRace, isActiveRaceUnlocked, isReady, isSupported, unavailableReason, buildRewardContext]);

    useEffect(() => {
        if (!activeRace || !isPremiumDetailVisible) return;
        const context = buildRewardContext();
        if (!context) return;

        const key = `${activeRace.id}:premium_view`;
        if (premiumViewKeysRef.current.has(key)) return;
        premiumViewKeysRef.current.add(key);
        const isOpenAccess = isIntentionalRewardedDisableReason(unavailableReason);
        sendRewardGateEvent('premium_data_view', {
            ...context,
            result: isActiveRaceUnlocked
                ? 'reward_unlocked'
                : isOpenAccess
                    ? 'open_access'
                    : 'soft_fallback',
            reason: isActiveRaceUnlocked || isOpenAccess
                ? undefined
                : isLoading
                    ? 'rewarded_soft_fallback_while_loading'
                    : unavailableReason ?? 'rewarded_unavailable',
        });
    }, [activeRace, isPremiumDetailVisible, isActiveRaceUnlocked, isLoading, unavailableReason, buildRewardContext]);

    useEffect(() => {
        if (!activeRace || isActiveRaceUnlocked || canUseRewardedAd) return;
        if (isIntentionalRewardedDisableReason(unavailableReason)) return;
        const context = buildRewardContext();
        if (!context) return;

        const key = `${currentDate}:${venue.venue_name}:${unavailableReason ?? 'rewarded_unavailable'}:soft_fallback`;
        if (fallbackKeysRef.current.has(key)) return;
        fallbackKeysRef.current.add(key);
        sendRewardGateEvent('reward_fallback_used', {
            ...context,
            result: 'soft_fallback',
            reason: isLoading
                ? 'rewarded_soft_fallback_while_loading'
                : unavailableReason ?? 'rewarded_unavailable',
        });
    }, [activeRace, isActiveRaceUnlocked, canUseRewardedAd, isLoading, unavailableReason, buildRewardContext]);

    return (
        <div id={`venue-${venue.venue_name}`}>
            {activeRace && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-100 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 sm:text-xs">
                    <span className="truncate">{formatDate(currentDate)} {venue.venue_name} {activeRace.race_number}R {activeRace.race_name}</span>
                    {(() => {
                        const favorite = activeRace.predictions.find(p => p.mark === '◎');
                        if (!favorite) return null;
                        return (
                            <span className="shrink-0 text-primary">
                                ◎ {favorite.horse_name} <span className="rounded bg-blue-50 px-1 font-mono font-bold">{favorite.deviation_score?.toFixed(1)}</span>
                            </span>
                        );
                    })()}
                </div>
            )}
            <div className="sticky top-12 z-30 -mx-2 border-b border-slate-200 bg-white px-2 py-1 shadow-sm sm:top-16 lg:mx-0 lg:px-0">
                <RaceSelector
                    races={venue.races}
                    selectedIndex={activeRaceIndex}
                    onSelectRace={(index) => handleRaceSelect(index, 'race_selector')}
                />
            </div>
            {activeRace && (
                <div id={`race-${activeRace.id}`} className="race-detail-layout mt-1">
                    <div className="grid gap-3">
                        <div id="race-prediction-section" className="card mb-1 overflow-hidden border border-gray-200 shadow-sm sm:mb-1.5">
                            <div className="bg-white px-2.5 py-1 sm:p-4 border-b border-gray-200">
                                <h3 className="text-[15px] sm:text-lg font-bold flex items-center text-gray-800">
                                    <span className="bg-primary text-white rounded-md w-6 h-6 sm:w-8 sm:h-8 inline-flex items-center justify-center mr-1.5 sm:mr-2 font-mono font-bold text-xs sm:text-base">{activeRace.race_number}R</span>
                                    <span className="truncate">{activeRace.race_name}</span>
                                </h3>
                                <p className="text-[11px] sm:text-sm text-gray-500 ml-7 sm:ml-11 font-medium leading-tight">{activeRace.course_type} {activeRace.distance}m</p>
                            </div>
                            <div>
                                <h4 id="race-prediction-heading" className="flex items-center text-[13px] sm:text-base font-bold text-gray-700 mt-1 mb-0.5 px-2.5 sm:px-4">
                                    <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-accent mr-1.5" />
                                    AI偏差値
                                </h4>
                                {/* 印 of 凡例 */}
                                <div className="flex gap-1 sm:gap-1.5 overflow-x-auto px-2.5 sm:px-4 pb-1 text-[10px] sm:text-[11px] font-bold" aria-label="印の凡例">
                                    <span className="shrink-0 inline-flex items-center h-5 sm:h-6 px-1.5 sm:px-2 rounded-full bg-amber-50 text-amber-800 border border-amber-200">◎ 本命</span>
                                    <span className="shrink-0 inline-flex items-center h-5 sm:h-6 px-1.5 sm:px-2 rounded-full bg-blue-50 text-blue-700 border border-blue-200">○ 対抗</span>
                                    <span className="shrink-0 inline-flex items-center h-5 sm:h-6 px-1.5 sm:px-2 rounded-full bg-purple-50 text-purple-700 border border-purple-200">▲ 3番手</span>
                                    <span className="shrink-0 inline-flex items-center h-5 sm:h-6 px-1.5 sm:px-2 rounded-full bg-green-50 text-green-700 border border-green-200">△ 相手候補</span>
                                    <span className="shrink-0 inline-flex items-center h-5 sm:h-6 px-1.5 sm:px-2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">☆ ひと押し候補</span>
                                </div>
                                <PredictionTable race={activeRace} refreshKey={adRefreshKey} />
                            </div>
                        </div>

                        <AffiliateSlot
                            context="race_after_prediction"
                            raceType={raceType}
                            venueName={venue.venue_name}
                            selectionKey={`prediction-read-${adRefreshKey}`}
                            variant="compact"
                            className="my-1 sm:my-1.5"
                        />

                        <div id="race-detail-data-section">
                        {/* プレミアム・ロック切り替え部分 */}
                        {(activeRace && isPremiumDetailVisible) ? (
                            !isPremiumContentReady ? (
                                <PremiumDetailPlaceholder showAd={Boolean(shouldShowAd)} />
                            ) : (
                                <>
                                <div id="race-matchup-section" className="mb-1.5">
                                    <MatchupTable race={activeRace} />
                                </div>

                                <div className="mb-1.5 flex flex-col gap-1.5 sm:gap-2">
                                    <div className="card p-1.5 sm:p-3 flex flex-col">
                                        <div id="race-detail-heading" className="flex items-center text-[13px] sm:text-base font-bold text-gray-800 p-1 sm:p-2.5">
                                            <FlagIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-primary" />
                                            <span>展開/脚質予測</span>
                                        </div>
                                        <div className="px-1 sm:px-2.5 pb-1 sm:pb-2.5 flex-1">
                                            <StartPositionChart predictions={activeRace.predictions} />
                                        </div>
                                    </div>

                                    <div className="card p-1.5 sm:p-3 flex flex-col">
                                        <div id="race-frame-heading" className="flex items-center text-[13px] sm:text-base font-bold text-gray-800 p-1 sm:p-2.5">
                                            <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-accent" />
                                            <span>このコースの枠順傾向</span>
                                        </div>
                                        <div className="px-1 sm:px-2.5 pb-1 sm:pb-2.5 flex-1">
                                            <HorseNumberAdvantageChart advantages={activeRace.horse_number_advantages} courseType={activeRace.course_type} distance={activeRace.distance} />
                                        </div>
                                    </div>
                                </div>
                                </>
                            )
                        ) : shouldShowRewardGate ? (
                            <div className="relative mb-2 overflow-hidden rounded-xl" style={{ minHeight: '320px' }}>
                                {/* 背景: ぼかした実データ */}
                                <div className="select-none pointer-events-none" aria-hidden="true">
                                    <div className="blur-[6px] opacity-60">
                                        <div className="mb-2">
                                            <MatchupTable race={activeRace} />
                                        </div>
                                        <div className="mb-2">
                                            <div className="card p-2 sm:p-3">
                                                <div className="flex items-center text-md font-bold text-gray-800 p-2 sm:p-3">
                                                    <FlagIcon className="w-5 h-5 mr-2 text-primary" />
                                                    <span>展開/脚質予測</span>
                                                </div>
                                                <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                                                    <StartPositionChart predictions={activeRace.predictions} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* オーバーレイ: 4つの分析データプレビュー + 解除ボタン */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 px-4">
                                    <div className="text-center max-w-sm w-full">
                                        <p className="text-[13px] sm:text-sm font-bold text-slate-800 mb-3">このレースの詳細分析を表示</p>
                                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-4 text-left">
                                            <div className="flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                                <UsersIcon className="w-3.5 h-3.5 text-secondary shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">過去対決成績</p>
                                                    <p className="text-[9px] sm:text-[10px] text-slate-500 leading-tight">出走馬同士の直接比較</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                                <FlagIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">脚質予測</p>
                                                    <p className="text-[9px] sm:text-[10px] text-slate-500 leading-tight">各コーナーの位置取り</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                                <ChartBarIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">枠順傾向</p>
                                                    <p className="text-[9px] sm:text-[10px] text-slate-500 leading-tight">コース別の有利枠</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                                <SparklesIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">AIレース展望</p>
                                                    <p className="text-[9px] sm:text-[10px] text-slate-500 leading-tight">展開・適性の解説</p>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRewardGateClick()}
                                            className="btn-primary w-full text-sm gap-2"
                                        >
                                            {canUseRewardedAd ? (
                                                '広告を見て詳細分析を表示'
                                            ) : (
                                                '詳細分析を表示'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {/* AIレース展望（常時表示、SEO・滞在時間向上） */}
                        <div id="race-analysis-section" className="mb-1.5">
                            <RaceAnalysis race={activeRace} />
                        </div>

                        </div>

                        <div className="my-1.5 sm:my-3">
                            {(() => {
                                const hasNext = activeRaceIndex < venue.races.length - 1;
                                const nextRace = hasNext ? venue.races[activeRaceIndex + 1] : null;
                                const nextTopHorse = nextRace?.predictions?.[0];
                                if (nextTopHorse && nextRace) {
                                    return (
                                        <button
                                            type="button"
                                            onClick={() => handleRaceSelect(activeRaceIndex + 1, 'analysis_next_button')}
                                            className="mb-1 flex w-full items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-2 text-left transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50 sm:gap-3 sm:p-3"
                                        >
                                            <div className="h-8 w-8 sm:w-9 sm:h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                                <span className="text-xs font-bold text-primary">{nextRace.race_number}R</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] text-slate-500">次のレース</p>
                                                <p className="text-xs sm:text-sm font-bold text-primary truncate">
                                                    {nextRace.race_name}
                                                </p>
                                            </div>
                                            <div className="max-w-[104px] shrink-0 text-right sm:max-w-[160px]">
                                                <p className="text-[10px] text-slate-500">AI 1位</p>
                                                <p className="truncate text-xs font-bold text-primary" title={nextTopHorse.horse_name}>{nextTopHorse.horse_name}</p>
                                            </div>
                                            <span className="text-primary text-sm">→</span>
                                        </button>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        <div id="race-data-guide-section">
                            <DataExplanationPanel showAdvanced={true} />
                        </div>

                        {/* 広告過密削減のため、データ解説後のInFeedAdを廃止 */}

                        <RelatedRaces currentRace={activeRace} currentDate={activeRace.race_date.toString()} />

                        {/* MultiplexAd削除: 最下部のviewable率が極端に低い広告を廃止（Active View 27-45%改善施策） */}

                        <div id="race-related-articles-section">
                            <DynamicRelatedArticles
                                venueName={activeRace.venue_name}
                                courseType={activeRace.course_type}
                                distance={activeRace.distance}
                                articlesMeta={articlesMeta}
                            />
                        </div>
                    </div>

                    <aside className="side-panel grid gap-3">
                        <section className="card side-card">
                            <h2 className="section-title">同日レース</h2>
                            <div className="side-list">
                                {venue.races.map((r, idx) => {
                                    const isCurrent = idx === activeRaceIndex;
                                    const topHorse = r.predictions?.[0];
                                    const raceLabel = (
                                        <>
                                            <span className={`flex items-center justify-center h-[34px] rounded-lg text-xs font-bold ${isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                {r.race_number}R
                                            </span>
                                            <div className="min-w-0">
                                                <span className="font-bold block truncate text-slate-800 text-xs sm:text-sm">{r.race_name}</span>
                                                {isCurrent ? (
                                                    <small className="text-blue-600 text-[10px] block truncate font-semibold">
                                                        表示中
                                                    </small>
                                                ) : topHorse && (
                                                    <small className="text-slate-500 text-[10px] block truncate">
                                                        AI1位: {topHorse.horse_name} ({topHorse.deviation_score?.toFixed(1)})
                                                    </small>
                                                )}
                                            </div>
                                        </>
                                    );

                                    if (isCurrent) {
                                        return (
                                            <div
                                                key={r.id}
                                                aria-current="page"
                                                className="side-link w-full text-left !bg-blue-50 !border-blue-300 cursor-default"
                                                style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: '10px', alignItems: 'center' }}
                                            >
                                                {raceLabel}
                                            </div>
                                        );
                                    }

                                    return (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => handleRaceSelect(idx, 'same_day_list')}
                                            className="side-link w-full text-left transition-colors duration-150 hover:bg-slate-50"
                                            style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: '10px', alignItems: 'center' }}
                                        >
                                            {raceLabel}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                    </aside>
                </div>
            )}
        </div>
    );
});

VenuePanel.displayName = 'VenuePanel';

export const RaceTabs = ({ data, articlesMeta, initialVenueName, initialRaceNumber }: { data: RaceDayPrediction, articlesMeta: RaceArticleMeta[], initialVenueName?: string | null, initialRaceNumber?: number | null }) => {
    // ★ 防御的チェック: data.jra/nar が undefined の場合も安全に処理
    const jra = data?.jra ?? [];
    const nar = data?.nar ?? [];
    const isEmpty = !data || (jra.length === 0 && nar.length === 0);

    // ▼▼▼▼▼【フックルール違反修正】▼▼▼▼▼
    // 修正前: isEmpty時に早期リターンし、その後にuseParams/useState/useCallback/useMemoを呼んでいた
    //   → Reactのフックルール違反（条件分岐の後にフックを呼んではいけない）
    //   → SSRとクライアントでフック呼び出し順序が不整合になり、
    //     "Cannot read properties of undefined (reading 'push')" エラーが発生
    // 修正後: 全てのフックを条件分岐より前に移動し、早期リターンは一番最後に行う
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

    const params = useParams();
    const currentDate = params.date as string;

    const [jraActivationKey, setJraActivationKey] = useState(0);
    const [narActivationKey, setNarActivationKey] = useState(0);

    const availableRaceTypes = useMemo<Array<'jra' | 'nar'>>(() => {
        const types: Array<'jra' | 'nar'> = [];
        if (jra.length > 0) types.push('jra');
        if (nar.length > 0) types.push('nar');
        return types;
    }, [jra.length, nar.length]);

    const handleTopTabSelect = useCallback((index: number) => {
        const raceType = availableRaceTypes[index];
        if (!raceType) return;

        if (raceType === 'jra') setJraActivationKey(prev => prev + 1);
        else setNarActivationKey(prev => prev + 1);

        sendRaceGroupSelectEvent({
            race_date: currentDate,
            race_type: raceType,
        });
    }, [availableRaceTypes, currentDate]);

    const handleJraVenueSelect = useCallback((index: number) => {
        setJraActivationKey(prev => prev + 1);
        const venue = jra[index];
        if (venue) {
            sendRaceVenueSelectEvent({
                race_date: currentDate,
                race_type: 'jra',
                venue_name: venue.venue_name,
            });
        }
    }, [jra, currentDate]);

    const handleNarVenueSelect = useCallback((index: number) => {
        setNarActivationKey(prev => prev + 1);
        const venue = nar[index];
        if (venue) {
            sendRaceVenueSelectEvent({
                race_date: currentDate,
                race_type: 'nar',
                venue_name: venue.venue_name,
            });
        }
    }, [nar, currentDate]);

    const isInitialVenueInJra = useMemo(() => jra.some(v => v.venue_name === initialVenueName), [jra, initialVenueName]);
    const isInitialVenueInNar = useMemo(() => nar.some(v => v.venue_name === initialVenueName), [nar, initialVenueName]);
    const initialTopTabIndex = useMemo(() => {
        if (isInitialVenueInJra) return 0;
        if (isInitialVenueInNar) return jra.length > 0 ? 1 : 0;
        return 0;
    }, [isInitialVenueInJra, isInitialVenueInNar, jra.length]);

    const initialJraVenueIndex = useMemo(() => {
        if (!initialVenueName) return 0;
        const index = jra.findIndex(v => v.venue_name === initialVenueName);
        return index >= 0 ? index : 0;
    }, [jra, initialVenueName]);

    const initialNarVenueIndex = useMemo(() => {
        if (!initialVenueName) return 0;
        const index = nar.findIndex(v => v.venue_name === initialVenueName);
        return index >= 0 ? index : 0;
    }, [nar, initialVenueName]);

    const { isRaceUnlocked, isReady, isLoading: isAdLoading, isSupported, unavailableReason, showAd, unlock } = useRewardedAd();

    // ★ 全てのフックの後で早期リターン
    if (isEmpty) {
        return <div className="p-6 text-center text-muted card">対象日のレースデータがありません。</div>;
    }

    const mainTabListClass = "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-2 sm:gap-4 border-b-2 border-slate-200 mb-1.5 sm:mb-4";
    const mainTabClass = "snap-start min-w-max px-3 sm:px-6 py-1.5 sm:py-4 text-xs sm:text-base font-bold text-slate-500 bg-transparent cursor-pointer hover:text-slate-700 transition-colors duration-150 outline-none border-b-2 border-transparent -mb-[2px]";
    const mainSelectedTabClass = "!text-primary !border-primary";

    const venueTabListClass = "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-1 sm:gap-2 mb-1.5 sm:mb-4 p-0.5 sm:p-1 bg-slate-100/60 rounded-lg sm:rounded-xl w-max border border-slate-200/50 max-w-full";
    const venueTabClass = "snap-start min-w-max px-2.5 sm:px-5 py-1 sm:py-2.5 text-[11px] sm:text-sm font-bold text-slate-500 rounded-md sm:rounded-lg cursor-pointer hover:text-slate-700 hover:bg-slate-200/60 transition-colors duration-150 outline-none";
    const venueSelectedTabClass = "!text-primary !bg-white shadow-sm !border-slate-200";

    return (
        <Tabs defaultIndex={initialTopTabIndex} onSelect={handleTopTabSelect} className="mt-1.5 sm:mt-4" forceRenderTabPanel={false}>
            <TabList className={mainTabListClass}>
                {jra.length > 0 && <Tab className={mainTabClass} selectedClassName={mainSelectedTabClass}>中央競馬</Tab>}
                {nar.length > 0 && <Tab className={mainTabClass} selectedClassName={mainSelectedTabClass}>地方競馬</Tab>}
            </TabList>
            {jra.length > 0 && (
                <TabPanel>
                    <div className="p-0 sm:p-2 md:p-3 relative">
                        <Tabs defaultIndex={initialJraVenueIndex} onSelect={handleJraVenueSelect} forceRenderTabPanel={false}>
                            <TabList className={venueTabListClass}>
                                {jra.map(venue => <Tab key={venue.venue_name} className={venueTabClass} selectedClassName={venueSelectedTabClass}>{venue.venue_name}</Tab>)}
                            </TabList>
                            {jra.map(venue => (
                                <TabPanel key={venue.venue_name}>
                                    <VenuePanel venue={venue} raceType="jra" articlesMeta={articlesMeta} venueActivationKey={jraActivationKey} initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null} isRaceUnlocked={isRaceUnlocked} isReady={isReady} isLoading={isAdLoading} isSupported={isSupported} unavailableReason={unavailableReason} showAd={showAd} unlock={unlock} />
                                </TabPanel>
                            ))}
                        </Tabs>
                    </div>
                </TabPanel>
            )}
            {nar.length > 0 && (
                <TabPanel>
                    <div className="p-0 sm:p-2 md:p-3 relative">
                        <Tabs defaultIndex={initialNarVenueIndex} onSelect={handleNarVenueSelect} forceRenderTabPanel={false}>
                            <TabList className={venueTabListClass}>
                                {nar.map(venue => <Tab key={venue.venue_name} className={venueTabClass} selectedClassName={venueSelectedTabClass}>{venue.venue_name}</Tab>)}
                            </TabList>
                            {nar.map(venue => (
                                <TabPanel key={venue.venue_name}>
                                    <VenuePanel venue={venue} raceType="nar" articlesMeta={articlesMeta} venueActivationKey={narActivationKey} initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null} isRaceUnlocked={isRaceUnlocked} isReady={isReady} isLoading={isAdLoading} isSupported={isSupported} unavailableReason={unavailableReason} showAd={showAd} unlock={unlock} />
                                </TabPanel>
                            ))}
                        </Tabs>
                    </div>
                </TabPanel>
            )}
        </Tabs>
    );
};
