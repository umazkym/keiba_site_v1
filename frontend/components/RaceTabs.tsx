'use client';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
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
import { RelatedRaces } from './RelatedRaces';
import { DataExplanationPanel } from './DataExplanationPanel';
import { DynamicRelatedArticles } from './DynamicRelatedArticles';
import { Article } from '@/lib/articles';
import { MultiplexAd } from './MultiplexAd';
import { AdUnit } from './AdUnit';
import { useRewardedAd } from '@/hooks/useRewardedAd';
import { Adsense } from './Adsense';

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

const VenuePanel = memo(({ venue, articlesMeta, initialRaceNumber, venueActivationKey = 0, isUnlocked, isReady, isLoading, isSupported, showAd, unlock }: { venue: VenueRaces, articlesMeta: Omit<Article, 'content'>[], initialRaceNumber?: number | null, venueActivationKey?: number, isUnlocked: boolean, isReady: boolean, isLoading: boolean, isSupported: boolean, showAd: () => void, unlock: () => void }) => {
    const [showInlineAd, setShowInlineAd] = useState(false);
    const [countdown, setCountdown] = useState(10);
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = useParams();
    const currentDate = params.date as string;

    const initialIndex = useMemo(() => {
        if (!initialRaceNumber) return 0;
        const index = venue.races.findIndex(r => r.race_number === initialRaceNumber);
        return index >= 0 ? index : 0;
    }, [venue.races, initialRaceNumber]);

    const [activeRaceIndex, setActiveRaceIndex] = useState(initialIndex);
    const activeRace = venue.races[activeRaceIndex];

    // ブラウザ「戻る」対応
    useEffect(() => {
        if (initialRaceNumber) {
            const newIndex = venue.races.findIndex(r => r.race_number === initialRaceNumber);
            if (newIndex >= 0 && newIndex !== activeRaceIndex) {
                setActiveRaceIndex(newIndex);
            }
        }
    }, [initialRaceNumber, venue.races]);

    // ★ 修正: レース切替時に showInlineAd と countdown をリセット
    // 変更前: activeRaceIndex が変わっても showInlineAd=true / countdown が途中のまま残る
    //         → レース2に切り替えても広告が表示済みの状態になる（ユーザーが広告を見ていない可能性）
    // 変更後: レース切替のたびに広告状態をリセット
    //         ただし isUnlocked=true の場合はリセット不要（アンロック済み）
    useEffect(() => {
        if (!isUnlocked) {
            setShowInlineAd(false);
            setCountdown(10);
        }
    }, [activeRaceIndex, isUnlocked]);

    const handleRaceSelect = useCallback((index: number) => {
        setActiveRaceIndex(index);
        const selectedRace = venue.races[index];
        if (selectedRace) {
            const newParams = new URLSearchParams();
            newParams.set('race', selectedRace.race_number.toString());
            newParams.set('venue', venue.venue_name);
            const newUrl = `/races/${currentDate}?${newParams.toString()}`;
            router.push(newUrl, { scroll: false });

            setTimeout(() => {
                const raceContent = document.getElementById(`venue-${venue.venue_name}`);
                if (raceContent) {
                    raceContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }, [venue, router, currentDate]);

    // ★ ビューアビリティ改善: 条件を5→3頭に緩和し、ほぼ全レースで広告表示
    const shouldShowAd = useMemo(() => {
        return activeRace && activeRace.predictions.length >= 3;
    }, [activeRace]);

    const adRefreshKey = useMemo(() => {
        return activeRace ? `${venue.venue_name}-${activeRace.race_number}-v${venueActivationKey}` : '';
    }, [venue.venue_name, activeRace, venueActivationKey]);

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
                    <div className="card mb-2 overflow-hidden border border-gray-200 shadow-sm">
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
                        <AdUnit slot="9407670747" placement="inline" refreshKey={adRefreshKey} className="my-2" />
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
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] text-slate-400">AI 1位</p>
                                            <p className="text-xs font-bold text-primary">{nextTopHorse.horse_name}</p>
                                        </div>
                                        <span className="text-primary text-sm">→</span>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                        <RaceNavigation />
                    </div>

                    {/* プレミアム・ロック切り替え部分 */}
                    {isUnlocked ? (
                        <>
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

                            {/* ★ ビューアビリティ改善: 過去対決成績と枠順傾向の間（自然な区切り）に広告配置 */}
                            {shouldShowAd && (
                                <InFeedAd slot="1489598374" refreshKey={adRefreshKey} />
                            )}

                            <div className="mb-2">
                                <div className="card p-2 sm:p-3">
                                    <div className="flex items-center text-md font-bold text-gray-800 p-2 sm:p-3">
                                        <ChartBarIcon className="w-5 h-5 mr-2 text-accent" />
                                        <span>このコースの枠順傾向</span>
                                    </div>
                                    <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                                        <div className="p-1.5 sm:p-5 border bg-white rounded-lg">
                                            <HorseNumberAdvantageChart advantages={activeRace.horse_number_advantages} courseType={activeRace.course_type} distance={activeRace.distance} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-2">
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
                    ) : (
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

                            {/* オーバーレイ */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/30 via-white/70 to-white/95 px-4">
                                {!showInlineAd ? (
                                    <div className="text-center max-w-xs w-full">
                                        <p className="text-sm text-slate-600 mb-4 font-medium">脚質予測、対戦成績、枠順傾向、AI分析を閲覧</p>
                                        <button
                                            onClick={() => {
                                                if (isSupported) {
                                                    showAd();
                                                } else {
                                                    setShowInlineAd(true);
                                                    let remaining = 10;
                                                    setCountdown(remaining);
                                                    const timer = setInterval(() => {
                                                        remaining--;
                                                        setCountdown(remaining);
                                                        if (remaining <= 0) clearInterval(timer);
                                                    }, 1000);
                                                }
                                            }}
                                            // ★ 修正: disabled 条件を修正
                                            // 変更前: disabled={!isReady && !isLoading}
                                            //   → isLoading=true のとき disabled=false → スピナー表示中でも押せた
                                            //   → モバイルで showAd() が空振り（makeVisibleRef 未設定）
                                            // 変更後: isLoading 中は必ず disabled。isReady になってから押せる。
                                            disabled={isLoading || !isReady}
                                            className="btn-primary w-full text-sm gap-2"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    読み込み中
                                                </>
                                            ) : (
                                                '10秒間の広告を見てデータを表示'
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full max-w-sm">
                                        <div className="text-[10px] text-muted text-center mb-1 tracking-wider select-none">スポンサーリンク</div>
                                        <div className="flex justify-center mb-3">
                                            <Adsense
                                                client="ca-pub-4411270831448240"
                                                slot="1489598374"
                                                style={{ display: 'block', width: '100%', maxWidth: '336px', height: '280px' }}
                                                isResponsive={false}
                                            />
                                        </div>
                                        {countdown > 0 ? (
                                            <div className="text-center text-sm text-slate-400">あと {countdown}秒...</div>
                                        ) : (
                                            <button
                                                onClick={unlock}
                                                className="btn-primary w-full text-sm gap-2"
                                            >
                                                データを表示
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DataExplanationPanel showAdvanced={true} />

                    {/* ★ コンテンツ読了ポイント: データ解説を読み終えた高集中度タイミングに広告配置 */}
                    {shouldShowAd && (
                        <AdUnit slot="8529703346" placement="inline" refreshKey={adRefreshKey} className="my-2" />
                    )}

                    <RelatedRaces currentRace={activeRace} currentDate={activeRace.race_date.toString()} />

                    {shouldShowAd && <MultiplexAd slot="8529703346" refreshKey={adRefreshKey} />}

                    <DynamicRelatedArticles
                        venueName={activeRace.venue_name}
                        courseType={activeRace.course_type}
                        distance={activeRace.distance}
                        articlesMeta={articlesMeta}
                    />
                </div>
            )}
        </div>
    );
});

VenuePanel.displayName = 'VenuePanel';

export const RaceTabs = ({ data, articlesMeta, initialVenueName, initialRaceNumber }: { data: RaceDayPrediction, articlesMeta: Omit<Article, 'content'>[], initialVenueName?: string | null, initialRaceNumber?: number | null }) => {
    if (!data || (data.jra.length === 0 && data.nar.length === 0)) {
        return <div className="p-6 text-center text-muted card">対象日のレースデータがありません。</div>;
    }

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

    const { isUnlocked, isReady, isLoading: isAdLoading, isSupported, showAd, unlock } = useRewardedAd();

    const handleJraVenueSelect = useCallback((index: number) => {
        setJraActivationKey(prev => prev + 1);
        const venue = data.jra[index];
        if (venue && typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'page_view', {
                page_path: `/races/${currentDate}?venue=${encodeURIComponent(venue.venue_name)}`,
                page_title: `${venue.venue_name} - レース一覧`,
            });
        }
    }, [data.jra, currentDate]);

    const handleNarVenueSelect = useCallback((index: number) => {
        setNarActivationKey(prev => prev + 1);
        const venue = data.nar[index];
        if (venue && typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'page_view', {
                page_path: `/races/${currentDate}?venue=${encodeURIComponent(venue.venue_name)}`,
                page_title: `${venue.venue_name} - レース一覧`,
            });
        }
    }, [data.nar, currentDate]);

    const isInitialVenueInJra = useMemo(() => data.jra.some(v => v.venue_name === initialVenueName), [data.jra, initialVenueName]);
    const initialTopTabIndex = useMemo(() => {
        if (isInitialVenueInJra) return 0;
        if (data.nar.some(v => v.venue_name === initialVenueName)) return 1;
        return data.jra.length > 0 ? 0 : 1;
    }, [isInitialVenueInJra, data.nar, data.jra.length, initialVenueName]);

    const initialJraVenueIndex = useMemo(() => {
        if (!initialVenueName) return 0;
        const index = data.jra.findIndex(v => v.venue_name === initialVenueName);
        return index >= 0 ? index : 0;
    }, [data.jra, initialVenueName]);

    const initialNarVenueIndex = useMemo(() => {
        if (!initialVenueName) return 0;
        const index = data.nar.findIndex(v => v.venue_name === initialVenueName);
        return index >= 0 ? index : 0;
    }, [data.nar, initialVenueName]);

    const mainTabListClass = "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-2 sm:gap-4 border-b-2 border-slate-200 mb-4";
    const mainTabClass = "snap-start min-w-max px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-bold text-slate-400 bg-transparent cursor-pointer hover:text-slate-600 transition-all outline-none border-b-2 border-transparent -mb-[2px]";
    const mainSelectedTabClass = "!text-primary !border-primary";

    const venueTabListClass = "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-1.5 sm:gap-2 mb-4 p-1 bg-slate-100/60 rounded-xl w-max border border-slate-200/50 max-w-full";
    const venueTabClass = "snap-start min-w-max px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-500 rounded-lg cursor-pointer hover:text-slate-700 hover:bg-slate-200/60 transition-all outline-none";
    const venueSelectedTabClass = "!text-primary !bg-white shadow-sm !border-slate-200";

    return (
        <Tabs defaultIndex={initialTopTabIndex} onSelect={handleTopTabSelect} className="mt-4" forceRenderTabPanel={false}>
            <TabList className={mainTabListClass}>
                {data.jra.length > 0 && <Tab className={mainTabClass} selectedClassName={mainSelectedTabClass}>中央競馬</Tab>}
                {data.nar.length > 0 && <Tab className={mainTabClass} selectedClassName={mainSelectedTabClass}>地方競馬</Tab>}
            </TabList>
            {data.jra.length > 0 && (
                <TabPanel>
                    <div className="p-0 sm:p-2 md:p-3 relative">
                        <Tabs defaultIndex={initialJraVenueIndex} onSelect={handleJraVenueSelect} forceRenderTabPanel={false}>
                            <TabList className={venueTabListClass}>
                                {data.jra.map(venue => <Tab key={venue.venue_name} className={venueTabClass} selectedClassName={venueSelectedTabClass}>{venue.venue_name}</Tab>)}
                            </TabList>
                            {data.jra.map(venue => (
                                <TabPanel key={venue.venue_name}>
                                    <VenuePanel venue={venue} articlesMeta={articlesMeta} venueActivationKey={jraActivationKey} initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null} isUnlocked={isUnlocked} isReady={isReady} isLoading={isAdLoading} isSupported={isSupported} showAd={showAd} unlock={unlock} />
                                </TabPanel>
                            ))}
                        </Tabs>
                    </div>
                </TabPanel>
            )}
            {data.nar.length > 0 && (
                <TabPanel>
                    <div className="p-0 sm:p-2 md:p-3 relative">
                        <Tabs defaultIndex={initialNarVenueIndex} onSelect={handleNarVenueSelect} forceRenderTabPanel={false}>
                            <TabList className={venueTabListClass}>
                                {data.nar.map(venue => <Tab key={venue.venue_name} className={venueTabClass} selectedClassName={venueSelectedTabClass}>{venue.venue_name}</Tab>)}
                            </TabList>
                            {data.nar.map(venue => (
                                <TabPanel key={venue.venue_name}>
                                    <VenuePanel venue={venue} articlesMeta={articlesMeta} venueActivationKey={narActivationKey} initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null} isUnlocked={isUnlocked} isReady={isReady} isLoading={isAdLoading} isSupported={isSupported} showAd={showAd} unlock={unlock} />
                                </TabPanel>
                            ))}
                        </Tabs>
                    </div>
                </TabPanel>
            )}
        </Tabs>
    );
};