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
import { InFeedAd } from './InFeedAd';
import { AdUnit } from './AdUnit';
import { AffiliateSlot } from './AffiliateSlot';
import { RelatedRaces } from './RelatedRaces';
import { DataExplanationPanel } from './DataExplanationPanel';
import { DynamicRelatedArticles } from './DynamicRelatedArticles';
import { Article } from '@/lib/articles';
import { useRewardedAd, type RewardedAdContext } from '@/hooks/useRewardedAd';
import { sendRaceViewEvent, sendRewardGateEvent } from '@/lib/analytics';
import { LAST_RACE_STORAGE_KEY, StoredRaceView } from '@/lib/race-memory';
import { getRaceDetailPath } from '@/lib/race-url';

const CollapsibleSection = memo(({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
        setIsOpen(e.currentTarget.open);
    };

    return (
        <details className="card transition-all duration-300" onToggle={handleToggle}>
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
                <div className="ml-2 h-4 w-28 rounded bg-slate-100" />
            </div>
            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                <div className="h-[140px] rounded-lg border bg-slate-50" />
            </div>
        </div>
        {showAd && (
            <div className="mb-2 min-h-[180px] rounded-xl border border-slate-200 bg-slate-50" aria-hidden="true" />
        )}
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

const VenuePanel = memo(({ venue, raceType, articlesMeta, initialRaceNumber, venueActivationKey = 0, isRaceUnlocked, isReady, isLoading, isSupported, unavailableReason, showAd, unlock }: { venue: VenueRaces, raceType: 'jra' | 'nar', articlesMeta: Omit<Article, 'content'>[], initialRaceNumber?: number | null, venueActivationKey?: number, isRaceUnlocked: (raceId: string) => boolean, isReady: boolean, isLoading: boolean, isSupported: boolean, unavailableReason: string | null, showAd: (context?: RewardedAdContext | string) => boolean, unlock: (raceId?: string) => void }) => {
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

    const handleRaceSelect = useCallback((index: number) => {
        if (index === activeRaceIndex) return;

        setActiveRaceIndex(index);
        const selectedRace = venue.races[index];
        if (selectedRace) {
            const newUrl = getRaceDetailPath(currentDate, venue.venue_name, selectedRace.race_number);
            if (typeof window !== 'undefined') {
                window.history.replaceState(window.history.state, '', newUrl);
            }
            scrollVenueIntoView();
        }
    }, [activeRaceIndex, venue.races, venue.venue_name, currentDate, scrollVenueIntoView]);

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

        sendRaceViewEvent({
            race_date: currentDate,
            venue_name: venue.venue_name,
            race_number: activeRace.race_number,
            race_name: activeRace.race_name,
        });
    }, [
        activeRace?.id,
        activeRace?.race_number,
        activeRace?.race_name,
        activeRace?.course_type,
        activeRace?.distance,
        currentDate,
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
        if (!isSupported && unavailableReason === 'rewarded_temporarily_disabled') return;
        const context = buildRewardContext();
        if (!context) return;

        const status = isSupported ? 'ready' : 'unavailable';
        const key = `${activeRace.id}:${status}`;
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
        sendRewardGateEvent('premium_data_view', {
            ...context,
            result: isActiveRaceUnlocked ? 'reward_unlocked' : 'soft_fallback',
            reason: isActiveRaceUnlocked
                ? undefined
                : isLoading
                    ? 'rewarded_soft_fallback_while_loading'
                    : unavailableReason ?? 'rewarded_unavailable',
        });
    }, [activeRace, isPremiumDetailVisible, isActiveRaceUnlocked, isLoading, unavailableReason, buildRewardContext]);

    useEffect(() => {
        if (!activeRace || isActiveRaceUnlocked || canUseRewardedAd) return;
        const context = buildRewardContext();
        if (!context) return;

        const key = `${activeRace.id}:soft_fallback`;
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

    const RaceNavigation = () => {
        const hasPrev = activeRaceIndex > 0;
        const hasNext = activeRaceIndex < venue.races.length - 1;
        const prevRace = hasPrev ? venue.races[activeRaceIndex - 1] : null;
        const nextRace = hasNext ? venue.races[activeRaceIndex + 1] : null;

        return (
            <div className="my-3">
                <div className="flex justify-between items-center gap-2">
                    {hasPrev && prevRace ? (
                        <button onClick={() => handleRaceSelect(activeRaceIndex - 1)} className="btn-primary flex-1 text-center text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2 font-bold shadow-sm">
                            &larr; {prevRace.race_number}Rへ
                        </button>
                    ) : <div className="flex-1" />}
                    {hasNext && nextRace ? (
                        <button onClick={() => handleRaceSelect(activeRaceIndex + 1)} className="btn-primary flex-1 text-center text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2 font-bold shadow-sm">
                            {nextRace.race_number}Rへ &rarr;
                        </button>
                    ) : <div className="flex-1" />}
                </div>
            </div>
        );
    };

    return (
        <div id={`venue-${venue.venue_name}`}>
            <div className="sticky top-14 sm:top-16 z-30 bg-white/95 backdrop-blur-sm -mx-2 px-2 sm:mx-0 sm:px-0 py-1.5 shadow-sm border-b border-gray-100">
                <RaceSelector races={venue.races} selectedIndex={activeRaceIndex} onSelectRace={handleRaceSelect} />
            </div>
            {activeRace && (
                <div id={`race-${activeRace.id}`} className="mt-1">
                    <div id="race-prediction-section" className="card mb-2 overflow-hidden border border-gray-200 shadow-sm">
                        <div className="bg-white px-2.5 py-2 sm:p-4 border-b border-gray-200">
                            <h3 className="text-base sm:text-lg font-bold flex items-center text-gray-800">
                                <span className="bg-primary text-white rounded-md w-7 h-7 sm:w-8 sm:h-8 inline-flex items-center justify-center mr-2 font-mono font-bold text-sm sm:text-base">{activeRace.race_number}R</span>
                                <span className="truncate">{activeRace.race_name}</span>
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-500 ml-9 sm:ml-11 font-medium">{activeRace.course_type} {activeRace.distance}m</p>
                        </div>
                        <div>
                            <h4 className="flex items-center text-sm sm:text-base font-bold text-gray-700 mt-2 mb-1 px-2.5 sm:px-4">
                                <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-accent mr-1.5" />
                                AI分析
                            </h4>
                            <PredictionTable race={activeRace} refreshKey={adRefreshKey} />
                        </div>
                    </div>

                    {shouldShowAd && (
                        <AdUnit
                            slot="8529703346"
                            placement="inline"
                            analyticsPlacement="race_after_prediction_card"
                            refreshKey={`race-top-${adRefreshKey}`}
                            minHeight="72px"
                            collapseUnfilled={true}
                            className="my-2"
                        />
                    )}

                    <div className="my-3">
                        {(() => {
                            const hasNext = activeRaceIndex < venue.races.length - 1;
                            const nextRace = hasNext ? venue.races[activeRaceIndex + 1] : null;
                            const nextTopHorse = nextRace?.predictions?.[0];
                            if (nextTopHorse && nextRace) {
                                return (
                                    <div
                                        onClick={() => handleRaceSelect(activeRaceIndex + 1)}
                                        className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-100 rounded-xl mb-2 cursor-pointer hover:border-blue-200 transition-colors active:scale-[0.99]"
                                    >
                                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                            <span className="text-xs font-bold text-primary">{nextRace.race_number}R</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-slate-500">次のレース</p>
                                            <p className="text-xs sm:text-sm font-bold text-primary truncate">
                                                {nextRace.race_name}
                                            </p>
                                        </div>
                                        <div className="max-w-[104px] shrink-0 text-right sm:max-w-[160px]">
                                            <p className="text-[10px] text-slate-400">AI 1位</p>
                                            <p className="truncate text-xs font-bold text-primary" title={nextTopHorse.horse_name}>{nextTopHorse.horse_name}</p>
                                        </div>
                                        <span className="text-primary text-sm">→</span>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                        <RaceNavigation />
                    </div>

                    <div id="race-detail-data-section">
                    {/* プレミアム・ロック切り替え部分 */}
                    {(activeRace && isPremiumDetailVisible) ? (
                        !isPremiumContentReady ? (
                            <PremiumDetailPlaceholder showAd={Boolean(shouldShowAd)} />
                        ) : (
                            <>
                            <div className="mb-2 grid gap-2 xl:grid-cols-2 xl:items-stretch">
                                <div className="card p-2 sm:p-3 h-full flex flex-col">
                                    <div className="flex items-center text-md font-bold text-gray-800 p-2 sm:p-3">
                                        <FlagIcon className="w-5 h-5 mr-2 text-primary" />
                                        <span>展開/脚質予測</span>
                                    </div>
                                    <div className="px-2 pb-2 sm:px-3 sm:pb-3 flex-1">
                                        <div className="p-1.5 sm:p-5 border bg-white rounded-lg h-full">
                                            <StartPositionChart predictions={activeRace.predictions} />
                                        </div>
                                    </div>
                                </div>

                                <div className="card p-2 sm:p-3 h-full flex flex-col">
                                    <div className="flex items-center text-md font-bold text-gray-800 p-2 sm:p-3">
                                        <ChartBarIcon className="w-5 h-5 mr-2 text-accent" />
                                        <span>このコースの枠順傾向</span>
                                    </div>
                                    <div className="px-2 pb-2 sm:px-3 sm:pb-3 flex-1">
                                        <div className="p-1.5 sm:p-5 border bg-white rounded-lg h-full">
                                            <HorseNumberAdvantageChart advantages={activeRace.horse_number_advantages} courseType={activeRace.course_type} distance={activeRace.distance} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div id="race-matchup-section" className="mb-2">
                                <div className="card p-2 sm:p-3">
                                    <div className="flex items-center text-md font-bold text-gray-800 p-2 sm:p-3">
                                        <UsersIcon className="w-5 h-5 mr-2 text-secondary" />
                                        <span>過去対決成績</span>
                                    </div>
                                    <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                                        <div className="p-1 sm:p-5 border bg-white rounded-lg">
                                            <MatchupTable race={activeRace} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 対決成績の直後は高意欲ユーザーが多いため、地方競馬は楽天導線を優先 */}
                            {shouldShowAd && (
                                raceType === 'nar' ? (
                                    <AffiliateSlot
                                        context="race_after_premium_data"
                                        raceType="nar"
                                        venueName={venue.venue_name}
                                        selectionKey={`premium-${adRefreshKey}`}
                                        variant="compact"
                                        className="mb-2"
                                    />
                                ) : (
                                    <InFeedAd refreshKey={`premium-mid-${adRefreshKey}`} analyticsPlacement="race_premium_mid" />
                                )
                            )}

                            <div id="race-analysis-section" className="mb-2">
                                <div className="card p-2 sm:p-3">
                                    <div className="flex items-center text-md font-bold text-gray-800 p-2 sm:p-3">
                                        <ChartBarIcon className="w-5 h-5 mr-2 text-accent" />
                                        <span>このレースのデータ分析</span>
                                    </div>
                                    <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                                        <div className="p-2 sm:p-4 border bg-white rounded-lg">
                                            <RaceAnalysis race={activeRace} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </>
                        )
                    ) : shouldShowRewardGate ? (
                        <div className="relative mb-2 overflow-hidden rounded-2xl" style={{ minHeight: '320px' }}>
                            {/* 背景: ぼかした実データ */}
                            <div className="select-none pointer-events-none" aria-hidden="true">
                                <div className="blur-[6px] opacity-60">
                                    <div className="mb-2">
                                        <div className="card p-2 sm:p-3">
                                            <div className="flex items-center text-md font-bold text-gray-800 p-2 sm:p-3">
                                                <FlagIcon className="w-5 h-5 mr-2 text-primary" />
                                                <span>展開/脚質予測</span>
                                            </div>
                                            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                                                <div className="p-1.5 sm:p-5 border bg-white rounded-lg">
                                                    <StartPositionChart predictions={activeRace.predictions} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="card p-2 sm:p-3">
                                            <div className="flex items-center text-md font-bold text-gray-800 p-2 sm:p-3">
                                                <UsersIcon className="w-5 h-5 mr-2 text-secondary" />
                                                <span>過去対決成績</span>
                                            </div>
                                            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                                                <div className="p-1 sm:p-5 border bg-white rounded-lg">
                                                    <MatchupTable race={activeRace} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* オーバーレイ: 4つの分析データプレビュー + 解除ボタン */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/30 via-white/70 to-white/95 px-4">
                                <div className="text-center max-w-sm w-full">
                                    <p className="text-[13px] sm:text-sm font-bold text-slate-800 mb-3">このレースの詳細分析を表示</p>
                                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-4 text-left">
                                        <div className="flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                            <FlagIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">脚質予測</p>
                                                <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight">各コーナーの位置取り</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                            <UsersIcon className="w-3.5 h-3.5 text-secondary shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">対戦成績</p>
                                                <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight">過去の直接対決</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                            <ChartBarIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">枠順傾向</p>
                                                <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight">コース別の有利枠</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200 px-2 py-1.5 sm:px-2.5 sm:py-2">
                                            <SparklesIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">AI分析</p>
                                                <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight">展開・適性の解説</p>
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
            )}
        </div>
    );
});

VenuePanel.displayName = 'VenuePanel';

export const RaceTabs = ({ data, articlesMeta, initialVenueName, initialRaceNumber }: { data: RaceDayPrediction, articlesMeta: Omit<Article, 'content'>[], initialVenueName?: string | null, initialRaceNumber?: number | null }) => {
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

    const handleTopTabSelect = useCallback((index: number) => {
        if (index === 0) setJraActivationKey(prev => prev + 1);
        else setNarActivationKey(prev => prev + 1);

        if (typeof window !== 'undefined' && (window as any).gtag) {
            const tabName = index === 0 ? '中央競馬' : '地方競馬';
            (window as any).gtag('event', 'page_view', {
                page_path: `/races/${currentDate}?tab=${encodeURIComponent(tabName)}`,
                page_title: `${tabName} - レース一覧`,
            });
        }
    }, [currentDate]);

    const { isRaceUnlocked, isReady, isLoading: isAdLoading, isSupported, unavailableReason, showAd, unlock } = useRewardedAd();

    const handleJraVenueSelect = useCallback((index: number) => {
        setJraActivationKey(prev => prev + 1);
        const venue = jra[index];
        if (venue && typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'page_view', {
                page_path: `/races/${currentDate}?venue=${encodeURIComponent(venue.venue_name)}`,
                page_title: `${venue.venue_name} - レース一覧`,
            });
        }
    }, [jra, currentDate]);

    const handleNarVenueSelect = useCallback((index: number) => {
        setNarActivationKey(prev => prev + 1);
        const venue = nar[index];
        if (venue && typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'page_view', {
                page_path: `/races/${currentDate}?venue=${encodeURIComponent(venue.venue_name)}`,
                page_title: `${venue.venue_name} - レース一覧`,
            });
        }
    }, [nar, currentDate]);

    const isInitialVenueInJra = useMemo(() => jra.some(v => v.venue_name === initialVenueName), [jra, initialVenueName]);
    const initialTopTabIndex = useMemo(() => {
        if (isInitialVenueInJra) return 0;
        if (nar.some(v => v.venue_name === initialVenueName)) return 1;
        return jra.length > 0 ? 0 : 1;
    }, [isInitialVenueInJra, nar, jra.length, initialVenueName]);

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

    // ★ 全てのフックの後で早期リターン
    if (isEmpty) {
        return <div className="p-6 text-center text-muted card">対象日のレースデータがありません。</div>;
    }

    const mainTabListClass = "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-2 sm:gap-4 border-b-2 border-slate-200 mb-4";
    const mainTabClass = "snap-start min-w-max px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-bold text-slate-400 bg-transparent cursor-pointer hover:text-slate-600 transition-all outline-none border-b-2 border-transparent -mb-[2px]";
    const mainSelectedTabClass = "!text-primary !border-primary";

    const venueTabListClass = "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-1.5 sm:gap-2 mb-4 p-1 bg-slate-100/60 rounded-xl w-max border border-slate-200/50 max-w-full";
    const venueTabClass = "snap-start min-w-max px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-500 rounded-lg cursor-pointer hover:text-slate-700 hover:bg-slate-200/60 transition-all outline-none";
    const venueSelectedTabClass = "!text-primary !bg-white shadow-sm !border-slate-200";

    return (
        <Tabs defaultIndex={initialTopTabIndex} onSelect={handleTopTabSelect} className="mt-4" forceRenderTabPanel={false}>
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
