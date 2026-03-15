'use client';
import { useState, useCallback, useMemo, memo } from 'react';
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
import { AdUnit } from './AdUnit';
import { RelatedRaces } from './RelatedRaces';
import { DataExplanationPanel } from './DataExplanationPanel';
import { DynamicRelatedArticles } from './DynamicRelatedArticles';
import { Article } from '@/lib/articles';

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

const VenuePanel = memo(({ venue, articlesMeta, initialRaceNumber }: { venue: VenueRaces, articlesMeta: Omit<Article, 'content'>[], initialRaceNumber?: number | null }) => {
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

    const handleRaceSelect = useCallback((index: number) => {
        setActiveRaceIndex(index);
        const selectedRace = venue.races[index];
        if (selectedRace) {
            const newParams = new URLSearchParams();
            newParams.set('race', selectedRace.race_number.toString());
            newParams.set('venue', venue.venue_name);
            router.replace(`/races/${currentDate}?${newParams.toString()}`, { scroll: false });
        }
    }, [venue, router, currentDate, searchParams]);

    const shouldShowAd = useMemo(() => {
        return activeRace && activeRace.predictions.length >= 5;
    }, [activeRace]);

    const RaceNavigation = () => {
        const hasPrev = activeRaceIndex > 0;
        const hasNext = activeRaceIndex < venue.races.length - 1;
        const prevRace = hasPrev ? venue.races[activeRaceIndex - 1] : null;
        const nextRace = hasNext ? venue.races[activeRaceIndex + 1] : null;

        return (
            <div className="my-6 flex justify-between items-center">
                {hasPrev && prevRace ? (
                    <button onClick={() => handleRaceSelect(activeRaceIndex - 1)} className="btn-primary">
                        &larr; {prevRace.race_number}Rへ
                    </button>
                ) : <div />}
                {hasNext && nextRace ? (
                    <button onClick={() => handleRaceSelect(activeRaceIndex + 1)} className="btn-primary">
                        {nextRace.race_number}Rへ &rarr;
                    </button>
                ) : <div />}
            </div>
        );
    };

    return (
        <div id={`venue-${venue.venue_name}`}>
            <RaceSelector races={venue.races} selectedIndex={activeRaceIndex} onSelectRace={handleRaceSelect} />
            {activeRace && (
                <div id={`race-${activeRace.id}`} className="mt-4">
                    <div className="card mb-4 overflow-hidden border border-gray-200 shadow-sm">
                        <div className="bg-white p-3 sm:p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold flex items-center text-gray-800">
                                <span className="bg-primary text-white rounded-lg w-8 h-8 inline-flex items-center justify-center mr-3 font-mono font-bold text-base">{activeRace.race_number}R</span>
                                <span className="truncate">{activeRace.race_name}</span>
                            </h3>
                            <p className="text-sm text-gray-500 ml-11 mt-0.5 font-medium">{activeRace.course_type} {activeRace.distance}m</p>
                        </div>
                        <div>
                            <h4 className="flex items-center text-base font-bold text-gray-700 mt-4 mb-2 px-3 sm:px-4">
                                <SparklesIcon className="w-5 h-5 text-accent mr-2" />
                                AI分析
                            </h4>
                            <PredictionTable race={activeRace} />
                        </div>
                    </div>

                    {/* 広告: AI分析テーブル直後（最高エンゲージメント位置） */}
                    {shouldShowAd && (
                        <AdUnit slot="8529703346" placement="inline" />
                    )}

                    {/* 脚質パターン予測 */}
                    <div className="card mb-4 overflow-hidden border border-gray-200 shadow-sm">
                        <div className="p-3 sm:p-4 bg-gray-50 border-b border-gray-200">
                            <h4 className="flex items-center text-base font-bold text-gray-800">
                                <FlagIcon className="w-5 h-5 text-primary mr-2" />
                                脚質パターン予測
                            </h4>
                        </div>
                        <div className="p-2 sm:p-5">
                            <StartPositionChart predictions={activeRace.predictions} />
                        </div>
                    </div>

                    {/* 過去対決成績 */}
                    <div className="card mb-4 overflow-hidden border border-gray-200 shadow-sm">
                        <div className="p-3 sm:p-4 bg-gray-50 border-b border-gray-200">
                            <h4 className="flex items-center text-base font-bold text-gray-800">
                                <UsersIcon className="w-5 h-5 text-secondary mr-2" />
                                過去対決成績
                            </h4>
                        </div>
                        <div className="p-2 sm:p-5">
                            <MatchupTable race={activeRace} />
                        </div>
                    </div>

                    {/* 枠順傾向スコア */}
                    <div className="card mb-4 overflow-hidden border border-gray-200 shadow-sm">
                        <div className="p-3 sm:p-4 bg-gray-50 border-b border-gray-200">
                            <h4 className="flex items-center text-base font-bold text-gray-800">
                                <ChartBarIcon className="w-5 h-5 text-accent mr-2" />
                                枠順傾向スコア
                            </h4>
                        </div>
                        <div className="p-2 sm:p-5">
                            <HorseNumberAdvantageChart advantages={activeRace.horse_number_advantages} courseType={activeRace.course_type} distance={activeRace.distance} />
                        </div>
                    </div>
                    <RaceNavigation />

                    <div className='p-3 sm:p-4 border mb-4 bg-white rounded-lg'>
                        {/* レース全体の分析セクション */}
                        <RaceAnalysis race={activeRace} />
                    </div>

                    {/* AI指標の説明パネル */}
                    <DataExplanationPanel showAdvanced={true} />

                    {shouldShowAd && (
                        <AdUnit slot="1489598374" placement="inline" />
                    )}

                    <RelatedRaces currentRace={activeRace} currentDate={activeRace.race_date.toString()} />

                    <DynamicRelatedArticles
                        venueName={activeRace.venue_name}
                        courseType={activeRace.course_type}
                        distance={activeRace.distance}
                        articlesMeta={articlesMeta}
                    />

                    {shouldShowAd && activeRace.predictions.length >= 10 && (
                        <AdUnit slot="8529703346" placement="inline" />
                    )}
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

    const mainTabListClass = "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-2 sm:gap-4 border-b-2 border-slate-200 mb-6";
    const mainTabClass = "snap-start min-w-max px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-bold text-slate-400 bg-transparent cursor-pointer hover:text-slate-600 transition-all outline-none border-b-2 border-transparent -mb-[2px]";
    const mainSelectedTabClass = "!text-primary !border-primary";

    const venueTabListClass = "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-1.5 sm:gap-2 mb-6 p-1 bg-slate-100/60 rounded-xl w-max border border-slate-200/50 max-w-full";
    const venueTabClass = "snap-start min-w-max px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-500 rounded-lg cursor-pointer hover:text-slate-700 hover:bg-slate-200/60 transition-all outline-none";
    const venueSelectedTabClass = "!text-primary !bg-white shadow-sm !border-slate-200";

    return (
        <Tabs defaultIndex={initialTopTabIndex} className="mt-4" forceRenderTabPanel={true}>
            <TabList className={mainTabListClass}>
                {data.jra.length > 0 && <Tab className={mainTabClass} selectedClassName={mainSelectedTabClass}>中央競馬</Tab>}
                {data.nar.length > 0 && <Tab className={mainTabClass} selectedClassName={mainSelectedTabClass}>地方競馬</Tab>}
            </TabList>
            {data.jra.length > 0 && (
                <TabPanel>
                    <div className="p-0 sm:p-2 md:p-3 relative">
                        <Tabs defaultIndex={initialJraVenueIndex} forceRenderTabPanel={true}>
                            <TabList className={venueTabListClass}>
                                {data.jra.map(venue => <Tab key={venue.venue_name} className={venueTabClass} selectedClassName={venueSelectedTabClass}>{venue.venue_name}</Tab>)}
                            </TabList>
                            {data.jra.map(venue => (
                                <TabPanel key={venue.venue_name}>
                                    <VenuePanel venue={venue} articlesMeta={articlesMeta} initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null} />
                                </TabPanel>
                            ))}
                        </Tabs>
                    </div>
                </TabPanel>
            )}
            {data.nar.length > 0 && (
                <TabPanel>
                    <div className="p-0 sm:p-2 md:p-3 relative">
                        <Tabs defaultIndex={initialNarVenueIndex} forceRenderTabPanel={true}>
                            <TabList className={venueTabListClass}>
                                {data.nar.map(venue => <Tab key={venue.venue_name} className={venueTabClass} selectedClassName={venueSelectedTabClass}>{venue.venue_name}</Tab>)}
                            </TabList>
                            {data.nar.map(venue => (
                                <TabPanel key={venue.venue_name}>
                                    <VenuePanel venue={venue} articlesMeta={articlesMeta} initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null} />
                                </TabPanel>
                            ))}
                        </Tabs>
                    </div>
                </TabPanel>
            )}
        </Tabs>
    );
};