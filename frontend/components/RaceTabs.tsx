'use client';
import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PredictionTable } from '@/components/PredictionTable';
import { RaceConditionComparison } from '@/components/RaceConditionComparison';
import { RaceHorseActions } from '@/components/RaceHorseActions';
import { RaceAnalysis } from '@/components/RaceAnalysis';
import { VenueRaces, RaceDayPrediction, type RacePrediction } from '@/lib/types';
import { RaceSelector, type RaceSelectorLink } from './RaceSelector';
import { RacePageJumpNav } from './RacePageJumpNav';
import { LineIcon, type LineIconName } from './LineIcon';
import { FinishBadge, HorseNumber, MarkGlyph } from './RaceParts';
import { AffiliateSlot } from './AffiliateSlot';
import { RaceEngagedAd } from './RaceEngagedAd';
import { RelatedRaces } from './RelatedRaces';
import { DataExplanationPanel } from './DataExplanationPanel';
import { DynamicRelatedArticles } from './DynamicRelatedArticles';
import { RaceArticleMeta } from '@/lib/articles';
import { useRewardedAd, type RewardedAdContext } from '@/hooks/useRewardedAd';
import {
    sendRaceNavigationEvent,
    sendRaceViewEvent,
    sendRewardGateEvent,
    replaceRaceHistoryPathWithoutPageView,
    suppressNextPageViewPath,
    type RaceNavigationMethod,
} from '@/lib/analytics';
import { LAST_RACE_STORAGE_KEY, StoredRaceView } from '@/lib/race-memory';
import { getRaceDetailPath } from '@/lib/race-url';
import { formatDate } from '@/lib/utils';
import { RACE_BREADCRUMB_CHANGE_EVENT } from '@/lib/race-breadcrumb-event';
import { getRaceTopObstructionHeight } from '@/hooks/useRaceSectionNavigation';
import { getAiRanks, getFinishRanks, hasRaceResults, normalizeMark, resolveWaku } from '@/lib/race-display';

const MatchupTable = dynamic(
    () => import('./MatchupTable').then((module) => module.MatchupTable),
    {
        ssr: false,
        loading: () => <div className="race-panel min-h-[260px] bg-slate-50" aria-busy="true" aria-label="対戦成績を読み込み中" />,
    },
);

const StableMatchupTable = ({ race }: { race: RacePrediction }) => {
    const runnerCount = race.predictions.length;
    const boundaryClassName = runnerCount >= 16
        ? 'min-h-[500px] md:min-h-[760px]'
        : runnerCount >= 10
            ? 'min-h-[390px] md:min-h-[560px]'
            : 'min-h-[310px] md:min-h-[420px]';

    return (
        <div className={boundaryClassName}>
            <MatchupTable race={race} />
        </div>
    );
};
const StartPositionChart = dynamic(
    () => import('./StartPositionChart').then((module) => module.StartPositionChart),
    {
        ssr: false,
        loading: () => <div className="min-h-32 rounded-lg bg-slate-50 md:min-h-[184px]" aria-busy="true" aria-label="展開予測を読み込み中" />,
    },
);
const HorseNumberAdvantageChart = dynamic(
    () => import('./HorseNumberAdvantageChart').then((module) => module.HorseNumberAdvantageChart),
    {
        ssr: false,
        loading: () => <div className="min-h-32 rounded-lg bg-slate-50 md:min-h-[196px]" aria-busy="true" aria-label="枠順傾向を読み込み中" />,
    },
);

const PremiumDetailPlaceholder = memo(({ showAd }: { showAd: boolean }) => (
    <>
        <div className="race-panel mb-2 min-h-[220px] p-2 sm:p-3" aria-hidden="true">
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
                <div key={index} className="race-panel min-h-[250px] p-2 sm:p-3">
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
        <div className="race-panel mb-2 min-h-[220px] p-2 sm:p-3" aria-hidden="true">
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

// 結果が出たレースの上位3頭と、印を付けた馬の着順（数え方は変えない）。
const RaceResultCard = ({ race }: { race: RacePrediction }) => {
    const finishRanks = getFinishRanks(race);
    const aiRanks = getAiRanks(race.predictions);
    const podium = Array.from(finishRanks.entries())
        .filter(([, rank]) => rank <= 3)
        .sort((a, b) => a[1] - b[1])
        .map(([horseNumber, rank]) => ({
            rank,
            horseNumber,
            prediction: race.predictions.find((p) => p.horse_number === horseNumber),
            name: race.predictions.find((p) => p.horse_number === horseNumber)?.horse_name
                ?? race.results.find((r) => r.horse_number === horseNumber)?.horse_name
                ?? '',
        }));
    const marked = race.predictions
        .filter((p) => ['◎', '○'].includes(normalizeMark(p.mark) ?? ''))
        .filter((p) => finishRanks.has(p.horse_number));
    if (podium.length === 0) return null;
    return (
        <section className="race-panel px-3 py-3.5 md:px-5 md:py-4" aria-labelledby="race-result-heading">
            <h2 id="race-result-heading" className="race-section-heading race-section-heading--flush">このレースの結果</h2>
            <ol className="flex flex-col">
                {podium.map((row) => (
                    <li key={row.horseNumber} className="flex min-h-12 items-center gap-2.5 border-b border-slate-200 last:border-b-0">
                        <FinishBadge rank={row.rank} size={28} />
                        <HorseNumber number={row.horseNumber} waku={row.prediction ? resolveWaku(row.prediction, race.predictions.length) : null} size={26} />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-slate-900">{row.name}</span>
                        {row.prediction && normalizeMark(row.prediction.mark) && <MarkGlyph mark={row.prediction.mark} size={16} />}
                        <span className="whitespace-nowrap text-[12px] text-slate-500">
                            {aiRanks.get(row.horseNumber) ? `AI ${aiRanks.get(row.horseNumber)}位` : 'AI対象外'}
                        </span>
                    </li>
                ))}
            </ol>
            {marked.length > 0 && (
                <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-700">
                    {marked.map((p) => (
                        <span key={p.horse_number} className="inline-flex items-center gap-1.5">
                            <MarkGlyph mark={p.mark} size={15} />
                            {p.horse_name}は<b className="font-num text-[15px]">{finishRanks.get(p.horse_number)}</b>着
                        </span>
                    ))}
                </p>
            )}
        </section>
    );
};

const REWARD_PREVIEW_ITEMS: Array<{ icon: LineIconName; title: string; description: string }> = [
    { icon: 'swords', title: '対戦成績', description: '出走馬同士の直接比較' },
    { icon: 'lanes', title: '展開予測', description: '序盤の位置取り' },
    { icon: 'bars', title: '馬番の傾向', description: 'コース別の有利・不利' },
    { icon: 'book', title: 'AIレース展望', description: '展開・適性の解説' },
];

const isIntentionalRewardedDisableReason = (reason: string | null) => {
    return reason === 'rewarded_temporarily_disabled' || reason === 'rewarded_fullscreen_disabled';
};

const VenuePanel = memo(({ venue, raceType, articlesMeta, initialRaceNumber, raceLinks, venueActivationKey = 0, engagedAdSlot, isRaceUnlocked, isReady, isLoading, isSupported, unavailableReason, showAd, unlock }: { venue: VenueRaces, raceType: 'jra' | 'nar', articlesMeta: RaceArticleMeta[], initialRaceNumber?: number | null, raceLinks?: RaceSelectorLink[], venueActivationKey?: number, engagedAdSlot?: string, isRaceUnlocked: (raceId: string) => boolean, isReady: boolean, isLoading: boolean, isSupported: boolean, unavailableReason: string | null, showAd: (context?: RewardedAdContext | string) => boolean, unlock: (raceId?: string) => void }) => {
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
    const isWaitingForRewardDecision = isLoading
        && !isActiveRaceUnlocked
        && !isIntentionalRewardedDisableReason(unavailableReason);
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

    const scrollVenueIntoView = useCallback(() => {
        if (typeof window === 'undefined') return;

        window.requestAnimationFrame(() => {
            const raceContent = document.getElementById(`venue-${venue.venue_name}`);
            if (!raceContent) return;

            const top = window.scrollY + raceContent.getBoundingClientRect().top - getRaceTopObstructionHeight();
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
                replaceRaceHistoryPathWithoutPageView(newUrl);
            }
            scrollVenueIntoView();
        }
    }, [activeRace, activeRaceIndex, venue.races, venue.venue_name, currentDate, raceType, scrollVenueIntoView]);

    const handleRaceLinkSelect = useCallback((raceNumber: number, href: string, suppressPageView: boolean) => {
        if (!activeRace || raceNumber === activeRace.race_number) return;
        if (suppressPageView) {
            suppressNextPageViewPath(href);
        }
        sendRaceNavigationEvent({
            race_date: currentDate,
            venue_name: venue.venue_name,
            race_type: raceType,
            from_race_number: activeRace.race_number,
            to_race_number: raceNumber,
            navigation_method: 'race_selector',
        });
    }, [activeRace, currentDate, raceType, venue.venue_name]);

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
            race_id: activeRace.id,
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
                <div
                    data-race-selector-sticky
                    data-race-mobile-selector
                    className="race-sticky-selector sticky z-30 my-2 flex max-h-[88px] flex-col gap-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 lg:h-14 lg:flex-row lg:items-center lg:gap-3 lg:px-2"
                    aria-label="選択中のレースと1Rから12Rの切替"
                >
                    <div className="flex h-7 shrink-0 items-center gap-2 px-1 lg:h-full lg:w-[250px] lg:border-r lg:border-slate-200 lg:pr-3">
                        <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-navy px-1.5 text-[12px] font-bold text-white">
                            {venue.venue_name}
                            <span className="font-num text-[14px]">{activeRace.race_number}R</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-900">{activeRace.race_name}</span>
                        <Link
                            href={`/races/${currentDate}`}
                            prefetch={false}
                            className="shrink-0 text-[12px] font-bold text-brand-700 hover:text-navy lg:hidden"
                        >
                            全レース
                        </Link>
                    </div>
                    <RaceSelector
                        races={venue.races}
                        selectedIndex={activeRaceIndex}
                        onSelectRace={(index) => handleRaceSelect(index, 'race_selector')}
                        raceLinks={raceLinks}
                        onSelectRaceLink={handleRaceLinkSelect}
                    />
                </div>
            )}
            {activeRace && (
                <div
                    id={`race-${activeRace.id}`}
                    className="race-detail-layout mt-1.5 sm:mt-2"
                    data-active-race-summary="true"
                    data-venue-name={venue.venue_name}
                    data-race-number={activeRace.race_number}
                    data-race-name={activeRace.race_name}
                    data-course-label={`${activeRace.course_type} ${activeRace.distance}m`}
                >
                    <div className="grid gap-1.5 sm:gap-3">
                        <div id="race-prediction-section" className="race-panel overflow-hidden">
                            <PredictionTable race={activeRace} refreshKey={adRefreshKey} />
                            <RaceHorseActions predictions={activeRace.predictions} />
                        </div>

                        {hasRaceResults(activeRace) && <RaceResultCard race={activeRace} />}

                        <AffiliateSlot
                            context="race_after_prediction"
                            raceType={raceType}
                            venueName={venue.venue_name}
                            selectionKey={`prediction-read-${adRefreshKey}`}
                            variant="compact"
                            className="my-1 sm:my-1.5"
                        />

                        <RaceConditionComparison raceId={activeRace.id} />

                        <div id="race-detail-data-section">
                        {/* プレミアム・ロック切り替え部分 */}
                        {(activeRace && isPremiumDetailVisible) ? (
                            isWaitingForRewardDecision ? (
                                <PremiumDetailPlaceholder showAd={Boolean(shouldShowAd)} />
                            ) : (
                                <>
                                <div id="race-matchup-section" className="mb-1.5">
                                    <StableMatchupTable race={activeRace} />
                                </div>

                                <div className="mb-2 grid gap-2 md:gap-3 xl:grid-cols-2">
                                    <section className="race-analysis-panel race-panel flex flex-col px-3 pb-3 pt-3.5 md:px-5 md:pb-4 md:pt-4">
                                        <h2 id="race-detail-heading" className="race-section-heading race-section-heading--flush">展開予測</h2>
                                        <p className="race-section-lead">序盤（1コーナー）の位置取りの予測。右ほど前です。琥珀の輪はAI偏差値の上位3頭です。</p>
                                        <div className="race-analysis-visual">
                                            <StartPositionChart predictions={activeRace.predictions} />
                                        </div>
                                    </section>

                                    <section className="race-analysis-panel race-panel flex flex-col px-3 pb-3 pt-3.5 md:px-5 md:pb-4 md:pt-4">
                                        <h2 id="race-frame-heading" className="race-section-heading race-section-heading--flush">馬番の傾向</h2>
                                        <p className="race-section-lead">
                                            {venue.venue_name}{activeRace.course_type ?? ''}{activeRace.distance ? `${activeRace.distance}m` : ''}の過去データで、今回の出走馬の馬番だけを並べています。
                                        </p>
                                        <div className="race-analysis-visual">
                                            <HorseNumberAdvantageChart
                                                advantages={activeRace.horse_number_advantages}
                                                courseType={activeRace.course_type}
                                                distance={activeRace.distance}
                                                runnerNumbers={activeRace.predictions.map((p) => p.horse_number)}
                                            />
                                        </div>
                                    </section>
                                </div>
                                </>
                            )
                        ) : shouldShowRewardGate ? (
                            <div className="relative mb-2 overflow-hidden rounded-xl" style={{ minHeight: '320px' }}>
                                {/* 背景: ぼかした実データ */}
                                <div className="select-none pointer-events-none" aria-hidden="true">
                                    <div className="blur-[6px] opacity-60">
                                        <div className="mb-2">
                                            <StableMatchupTable race={activeRace} />
                                        </div>
                                        <div className="mb-2">
                                            <div className="race-panel p-2 sm:p-3">
                                                <div className="flex items-center gap-2 p-2 text-base font-bold text-slate-800 sm:p-3">
                                                    <LineIcon name="lanes" size={20} className="block shrink-0 text-navy" />
                                                    <span>展開予測</span>
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
                                        <p className="mb-3 text-[15px] font-bold text-slate-900">このレースの詳細分析を表示</p>
                                        <div className="mb-4 grid grid-cols-2 gap-2 text-left">
                                            {REWARD_PREVIEW_ITEMS.map((item) => (
                                                <div key={item.title} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                                                    <LineIcon name={item.icon} size={18} className="block shrink-0 text-brand-700" />
                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-bold leading-tight text-slate-900">{item.title}</p>
                                                        <p className="text-[11px] leading-tight text-slate-500">{item.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRewardGateClick()}
                                            className="ui-btn ui-btn--primary ui-btn--full"
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

                        {engagedAdSlot && (
                            <RaceEngagedAd slot={engagedAdSlot} pageKey={currentDate} />
                        )}

                        {(() => {
                            // 開催日ボードから来た詳細ページでは、この会場の他のレースは番号とURLだけを持っている
                            const nextLink = raceLinks?.find((link) => link.raceNumber === activeRace.race_number + 1);
                            const nextRace = venue.races[activeRaceIndex + 1];
                            const nextTopHorse = nextRace?.predictions?.[0];
                            if (!nextLink && !nextRace) return null;
                            const inner = (
                                <>
                                    <span className="inline-flex h-11 w-11 shrink-0 items-baseline justify-center rounded-[11px] bg-navy pt-2.5 font-num text-[22px] font-bold leading-none text-white" aria-hidden="true">
                                        {activeRace.race_number + 1}<span className="ml-px text-[12px]">R</span>
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                                        <span className="text-[12px] font-bold text-slate-500">次のレース</span>
                                        <span className="truncate text-[15px] font-bold text-slate-900">
                                            {nextRace ? nextRace.race_name : `${venue.venue_name}${activeRace.race_number + 1}Rの分析を見る`}
                                        </span>
                                        {nextTopHorse && nextTopHorse.deviation_score != null && (
                                            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-slate-700">
                                                AI 1位
                                                <HorseNumber number={nextTopHorse.horse_number} waku={resolveWaku(nextTopHorse, nextRace.predictions.length)} size={20} />
                                                <span className="truncate">{nextTopHorse.horse_name}</span>
                                                <b className="font-num text-[15px] text-ai-deep">{nextTopHorse.deviation_score.toFixed(1)}</b>
                                            </span>
                                        )}
                                    </span>
                                    <LineIcon name="chevR" size={20} className="block shrink-0 text-slate-500" />
                                </>
                            );
                            const cardClass = 'my-2 flex w-full items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-colors duration-150 hover:border-brand-300 md:p-4';
                            if (nextRace) {
                                return (
                                    <button type="button" onClick={() => handleRaceSelect(activeRaceIndex + 1, 'analysis_next_button')} className={cardClass}>
                                        {inner}
                                    </button>
                                );
                            }
                            return (
                                <Link
                                    href={nextLink!.href}
                                    prefetch={false}
                                    rel={nextLink!.rel}
                                    onClick={(event) => handleRaceLinkSelect(
                                        nextLink!.raceNumber,
                                        nextLink!.href,
                                        event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey,
                                    )}
                                    className={cardClass}
                                >
                                    {inner}
                                </Link>
                            );
                        })()}

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

                    <aside className="side-panel hidden lg:block">
                        <RacePageJumpNav />
                    </aside>
                </div>
            )}
        </div>
    );
});

VenuePanel.displayName = 'VenuePanel';

export const RaceTabs = ({ data, articlesMeta, initialVenueName, initialRaceNumber, initialRaceLinks, engagedAdSlot }: { data: RaceDayPrediction, articlesMeta: RaceArticleMeta[], initialVenueName?: string | null, initialRaceNumber?: number | null, initialRaceLinks?: RaceSelectorLink[], engagedAdSlot?: string }) => {
    // 開催日のタブ（中央／地方・会場の切り替え）は開催日ボード（/races/[date]）が持つ。
    // ここはレース詳細として、選ばれた会場の1会場だけを描く。
    const jra = data?.jra ?? [];
    const nar = data?.nar ?? [];
    const { isRaceUnlocked, isReady, isLoading: isAdLoading, isSupported, unavailableReason, showAd, unlock } = useRewardedAd();

    const jraVenue = jra.find((v) => v.venue_name === initialVenueName);
    const narVenue = nar.find((v) => v.venue_name === initialVenueName);
    const venue = jraVenue ?? narVenue ?? jra[0] ?? nar[0];
    const raceType: 'jra' | 'nar' = jraVenue || (!narVenue && jra.length > 0) ? 'jra' : 'nar';

    if (!venue) {
        return <div className="race-panel p-6 text-center text-slate-600">対象日のレースデータがありません。</div>;
    }

    return (
        <div className="mt-1 sm:mt-2">
            <VenuePanel
                venue={venue}
                raceType={raceType}
                articlesMeta={articlesMeta}
                initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null}
                raceLinks={initialVenueName === venue.venue_name ? initialRaceLinks : undefined}
                engagedAdSlot={engagedAdSlot}
                isRaceUnlocked={isRaceUnlocked}
                isReady={isReady}
                isLoading={isAdLoading}
                isSupported={isSupported}
                unavailableReason={unavailableReason}
                showAd={showAd}
                unlock={unlock}
            />
        </div>
    );
};
