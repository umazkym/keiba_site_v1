'use client';
import { useState, useCallback, useMemo, memo } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { PredictionTable } from '@/components/PredictuonTable';
import { VenueRaces, RaceDayPrediction } from '@/lib/types';
import { RaceSelector } from './RaceSelector';
import { StartPositionChart } from './StartPositionChart';
import { MatchupTable } from './MatchupTable';
import { HorseNumberAdvantageChart } from './HorseNumberAdvantageChart';
import { SparklesIcon, FlagIcon, UsersIcon, ChartBarIcon } from './icons';
import { Adsense } from './Adsense';
import { RelatedRaces } from './RelatedRaces';

const CollapsibleSection = memo(({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const handleToggle = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);
    
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(prev => !prev);
        }
    }, []);
    
    return (
        <div className="card transition-all duration-300">
            <div
                onClick={handleToggle}
                className="flex items-center text-md font-bold text-gray-800 cursor-pointer list-none p-3"
                role="button"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                aria-expanded={isOpen}
            >
                <div className="w-6 h-6 mr-2 flex-shrink-0 text-primary">{icon}</div>
                <span className="whitespace-nowrap">{title}</span>
                <div className={`ml-auto transform transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </div>
            {isOpen && (
                <div className="px-3 pb-3">
                    {children}
                </div>
            )}
        </div>
    );
});

CollapsibleSection.displayName = 'CollapsibleSection';

const VenuePanel = memo(({ venue, initialRaceNumber }: { venue: VenueRaces, initialRaceNumber?: number | null }) => {
    const initialIndex = useMemo(() => {
        if (!initialRaceNumber) return 0;
        const index = venue.races.findIndex(r => r.race_number === initialRaceNumber);
        return index >= 0 ? index : 0;
    }, [venue.races, initialRaceNumber]);
    
    const [activeRaceIndex, setActiveRaceIndex] = useState(initialIndex);
    const activeRace = venue.races[activeRaceIndex];
    
    const handleRaceSelect = useCallback((index: number) => {
        setActiveRaceIndex(index);
    }, []);

    // 広告表示条件を最適化
    const shouldShowAd = useMemo(() => {
        return activeRace && activeRace.predictions.length >= 5;
    }, [activeRace]);

    return (
        <div id={`venue-${venue.venue_name}`}>
            <RaceSelector
                races={venue.races}
                selectedIndex={activeRaceIndex}
                onSelectRace={handleRaceSelect}
            />
            {activeRace && (
                <div id={`race-${activeRace.id}`} className="mt-2">
                    <div className="card mb-3">
                        <div className="bg-primary text-white p-2 border-b border-border rounded-t-lg">
                            <h3 className="text-base font-bold flex items-center text-white">
                                <span className="bg-primary-dark text-white rounded-full w-7 h-7 inline-flex items-center justify-center mr-2 font-mono shadow-inner">{activeRace.race_number}R</span>
                                <span className="truncate">{activeRace.race_name}</span>
                            </h3>
                            <p className="text-sm text-primary-light ml-9 -mt-1">{activeRace.course_type}{activeRace.distance}m</p>
                        </div>
                        <div>
                            <h4 className="flex items-center text-md font-bold text-gray-700 mt-2 mb-1 px-3">
                                <SparklesIcon className="w-5 h-5 text-accent-dark mr-2" />
                                AI予測
                            </h4>
                            <PredictionTable race={activeRace} />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <CollapsibleSection title="AIスタート位置取り予測" icon={<FlagIcon className="w-5 h-5" />}>
                            <StartPositionChart predictions={activeRace.predictions} />
                        </CollapsibleSection>
                        <CollapsibleSection title="過去対決成績" icon={<UsersIcon className="w-5 h-5" />}>
                            <MatchupTable race={activeRace} />
                        </CollapsibleSection>
                        <CollapsibleSection title="枠順傾向スコア" icon={<ChartBarIcon className="w-5 h-5" />}>
                            <HorseNumberAdvantageChart
                                advantages={activeRace.horse_number_advantages}
                                courseType={activeRace.course_type}
                                distance={activeRace.distance}
                            />
                        </CollapsibleSection>
                    </div>
                    
                    {/* 関連レースレコメンドの前に広告を追加 */}
                    {shouldShowAd && (
                        <div className="my-4 p-2 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-500 text-center mb-1">スポンサーリンク</div>
                            <Adsense
                                client="ca-pub-4411270831448240"
                                slot="1489598374"
                                style={{ minHeight: '90px' }}
                            />
                        </div>
                    )}
                    
                    {/* 関連レースレコメンド */}
                    <RelatedRaces
                        currentRace={activeRace}
                        currentDate={activeRace.race_date}
                    />
                    
                    {/* 最後にもう一つ広告（十分なコンテンツがある場合） */}
                    {shouldShowAd && activeRace.predictions.length >= 10 && (
                        <div className="my-4 p-2 bg-gradient-to-r from-white to-gray-50 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-500 text-center mb-1">スポンサーリンク</div>
                            <Adsense
                                client="ca-pub-4411270831448240"
                                slot="8529703346"
                                style={{ minHeight: '120px' }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

VenuePanel.displayName = 'VenuePanel';

export const RaceTabs = ({ data, initialVenueName, initialRaceNumber }: { data: RaceDayPrediction, initialVenueName?: string | null, initialRaceNumber?: number | null }) => {
    if (!data || (data.jra.length === 0 && data.nar.length === 0)) {
        return <div className="p-6 text-center text-muted card">対象日のレースデータがありません。</div>;
    }
    
    const isInitialVenueInJra = useMemo(() => 
        data.jra.some(v => v.venue_name === initialVenueName),
        [data.jra, initialVenueName]
    );
    
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
    
    return (
        <Tabs defaultIndex={initialTopTabIndex} className="mt-4">
            <TabList>
                {data.jra.length > 0 && <Tab>中央競馬</Tab>}
                {data.nar.length > 0 && <Tab>地方競馬</Tab>}
            </TabList>
            
            {data.jra.length > 0 && (
                <TabPanel>
                    <div className="p-2 md:p-3">
                        <Tabs defaultIndex={initialJraVenueIndex}>
                            <TabList>
                                {data.jra.map(venue => <Tab key={venue.venue_name}>{venue.venue_name}</Tab>)}
                            </TabList>
                            {data.jra.map(venue => (
                                <TabPanel key={venue.venue_name}>
                                    <VenuePanel
                                        venue={venue}
                                        initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null}
                                    />
                                </TabPanel>
                            ))}
                        </Tabs>
                    </div>
                </TabPanel>
            )}
            
            {data.nar.length > 0 && (
                <TabPanel>
                    <div className="p-2 md:p-3">
                        <Tabs defaultIndex={initialNarVenueIndex}>
                            <TabList>
                                {data.nar.map(venue => <Tab key={venue.venue_name}>{venue.venue_name}</Tab>)}
                            </TabList>
                            {data.nar.map(venue => (
                                <TabPanel key={venue.venue_name}>
                                    <VenuePanel
                                        venue={venue}
                                        initialRaceNumber={initialVenueName === venue.venue_name ? initialRaceNumber : null}
                                    />
                                </TabPanel>
                            ))}
                        </Tabs>
                    </div>
                </TabPanel>
            )}
        </Tabs>
    );
};