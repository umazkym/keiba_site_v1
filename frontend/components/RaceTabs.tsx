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
import { ContentGate } from './ContentGate';
import { NativeCardAd } from './NativeCardAd';

// CollapsibleSection コンポーネント
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

const VenuePanel = memo(({ venue, articlesMeta, initialRaceNumber, venueActivationKey = 0 }: { venue: VenueRaces, articlesMeta: Omit<Article, 'content'>[], initialRaceNumber?: number | null, venueActivationKey?: number }) => {
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

    // ▼▼▼▼▼【ブラウザ「戻る」対応】▼▼▼▼▼
    // router.push()で履歴が作られるため、「戻る」操作でsearchParamsが変わり
    // initialRaceNumberが更新される。keyにraceNumberが含まれなくなったため
    // VenuePanel内部でactiveRaceIndexを同期する必要がある。
    useEffect(() => {
        if (initialRaceNumber) {
            const newIndex = venue.races.findIndex(r => r.race_number === initialRaceNumber);
            if (newIndex >= 0 && newIndex !== activeRaceIndex) {
                setActiveRaceIndex(newIndex);
            }
        }
    }, [initialRaceNumber, venue.races]);
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

    const handleRaceSelect = useCallback((index: number) => {
        setActiveRaceIndex(index);
        const selectedRace = venue.races[index];
        if (selectedRace) {
            const newParams = new URLSearchParams();
            newParams.set('race', selectedRace.race_number.toString());
            newParams.set('venue', venue.venue_name);
            const newUrl = `/races/${currentDate}?${newParams.toString()}`;
            // ▼▼▼▼▼【router.push化】▼▼▼▼▼
            // 従来: router.replace() → URLのsearchParamsのみ変更、AdSenseがページ遷移と認識しない
            // 変更: router.push() → ブラウザ履歴に追加、AdSenseが新インプレッション、GA PVも自然発生
            // ISRキャッシュ済みのため、同一日付のデータ再取得コストは実質ゼロ
            router.push(newUrl, { scroll: false });
            // ▲▲▲▲▲【router.push化ここまで】▲▲▲▲▲

            // レース切替後にコンテンツ先頭へ自動スクロール
            setTimeout(() => {
                const raceContent = document.getElementById(`venue-${venue.venue_name}`);
                if (raceContent) {
                    raceContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }, [venue, router, currentDate]);

    const shouldShowAd = useMemo(() => {
        return activeRace && activeRace.predictions.length >= 5;
    }, [activeRace]);

    // レース切替 + 競馬場タブ切替時に広告を完全リフレッシュさせるキー
    // venueActivationKey が変わると競馬場タブ切替、activeRace が変わるとレース切替
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
            {/* ▼▼▼▼▼【sticky化】レースセレクターを常に表示 ▼▼▼▼▼ */}
            {/* Header (top-14/16) の直下に吸着させるよう変更 */}
            <div className="sticky top-14 sm:top-16 z-30 bg-white/95 backdrop-blur-sm -mx-2 px-2 sm:mx-0 sm:px-0 py-1.5 shadow-sm border-b border-gray-100">
                <RaceSelector races={venue.races} selectedIndex={activeRaceIndex} onSelectRace={handleRaceSelect} />
            </div>
            {/* ▲▲▲▲▲【sticky化ここまで】▲▲▲▲▲ */}
            {activeRace && (
                <div id={`race-${activeRace.id}`} className="mt-1">
                    {/* AI分析テーブル（最重要コンテンツ） */}
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

                    {/* ★広告②: PredictionTable読了直後 — ユーザーが結果を精読し終え「次どうしよう」と止まるポイント。視認時間が最長 */}
                    {shouldShowAd && (
                        <AdUnit slot="9407670747" placement="inline" refreshKey={adRefreshKey} className="my-2" />
                    )}

                    {/* レースナビゲーション: AI分析直後 → 予測を見たら即座に次Rへ */}
                    <RaceNavigation />

                    {/* 脚質パターン予測 */}
                    <div className="mb-2">
                        <CollapsibleSection title="脚質パターン予測" icon={<FlagIcon className="w-5 h-5 text-primary" />}>
                            <div className="p-1.5 sm:p-5 border bg-white rounded-lg">
                                <StartPositionChart predictions={activeRace.predictions} />
                            </div>
                        </CollapsibleSection>
                    </div>

                    {/* 過去対決成績 — コンテンツゲート対象 */}
                    <ContentGate
                        gateId="matchup"
                        title="過去対決成績"
                        description="出走馬の直接対決データを確認できます"
                        adSlot="1489598374"
                        icon={<UsersIcon className="w-5 h-5 text-secondary" />}
                    >
                        <div className="mb-2 border border-border rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                                <UsersIcon className="w-5 h-5 text-secondary" />
                                <h4 className="text-sm sm:text-base font-bold text-primary">過去対決成績</h4>
                            </div>
                            <div className="p-1 sm:p-5 bg-white">
                                <MatchupTable race={activeRace} />
                            </div>
                        </div>
                    </ContentGate>

                    {/* 枠順傾向スコア — コンテンツゲート対象 */}
                    <ContentGate
                        gateId="frame"
                        title="枠順傾向スコア"
                        description="コース・距離別の枠順有利不利データ"
                        adSlot="8529703346"
                        icon={<ChartBarIcon className="w-5 h-5 text-accent" />}
                    >
                        <div className="mb-2 border border-border rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                                <ChartBarIcon className="w-5 h-5 text-accent" />
                                <h4 className="text-sm sm:text-base font-bold text-primary">枠順傾向スコア</h4>
                            </div>
                            <div className="p-1.5 sm:p-5 bg-white">
                                <HorseNumberAdvantageChart advantages={activeRace.horse_number_advantages} courseType={activeRace.course_type} distance={activeRace.distance} />
                            </div>
                        </div>
                    </ContentGate>

                    {/* データ分析 — コンテンツゲート対象 */}
                    <ContentGate
                        gateId="analysis"
                        title="レースデータ分析"
                        description="AIによる詳細なレース傾向分析"
                        adSlot="9407670747"
                        icon={<ChartBarIcon className="w-5 h-5 text-accent" />}
                    >
                        <div className="mb-2 border border-border rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                                <ChartBarIcon className="w-5 h-5 text-accent" />
                                <h4 className="text-sm sm:text-base font-bold text-primary">レースデータ分析</h4>
                            </div>
                            <div className="p-2 sm:p-4 bg-white">
                                <RaceAnalysis race={activeRace} />
                            </div>
                        </div>
                    </ContentGate>

                    {/* AI指標の説明パネル */}
                    <DataExplanationPanel showAdvanced={true} />

                    {/* 広告②: インフィード広告（ページ下部・読了後の効果的な配置） */}
                    {shouldShowAd && (
                        <InFeedAd slot="1489598374" refreshKey={adRefreshKey} />
                    )}

                    <RelatedRaces currentRace={activeRace} currentDate={activeRace.race_date.toString()} />

                    {/* ネイティブカード広告: 関連レースカードに紛れ込む */}
                    {shouldShowAd && (
                        <NativeCardAd slot="1489598374" variant="article" refreshKey={adRefreshKey} className="mb-2" />
                    )}

                    {/* 広告③: マルチプレックス擬態（関連記事と全く同じUIで脳を錯覚させる） */}
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

    // 競馬場/タブ切替時の広告リフレッシュ用カウンター
    // 切り替えごとにインクリメントし、venueActivationKeyとしてVenuePanelに渡す
    const [jraActivationKey, setJraActivationKey] = useState(0);
    const [narActivationKey, setNarActivationKey] = useState(0);

    // JRA/NARトップタブ切替ハンドラ
    const handleTopTabSelect = useCallback((index: number) => {
        // 切替先のパネルの広告をリフレッシュ
        if (index === 0) setJraActivationKey(prev => prev + 1);
        else setNarActivationKey(prev => prev + 1);

        // GA仮想ページビュー: JRA/NAR切替もPVとしてカウント
        if (typeof window !== 'undefined' && (window as any).gtag) {
            const tabName = index === 0 ? '中央競馬' : '地方競馬';
            (window as any).gtag('event', 'page_view', {
                page_path: `/races/${currentDate}?tab=${encodeURIComponent(tabName)}`,
                page_title: `${tabName} - レース一覧`,
            });
        }
    }, [currentDate]);

    // JRA競馬場タブ切替ハンドラ
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

    // NAR競馬場タブ切替ハンドラ
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
                                    <VenuePanel venue={venue} articlesMeta={articlesMeta} venueActivationKey={jraActivationKey} initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null} />
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
                                    <VenuePanel venue={venue} articlesMeta={articlesMeta} venueActivationKey={narActivationKey} initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null} />
                                </TabPanel>
                            ))}
                        </Tabs>
                    </div>
                </TabPanel>
            )}
        </Tabs>
    );
};