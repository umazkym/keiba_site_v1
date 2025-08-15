'use client';

import { useState } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { PredictionTable } from '@/components/PredictuonTable';
import { VenueRaces, RaceDayPrediction } from '@/lib/types';
import { RaceSelector } from './RaceSelector';
import { StartPositionChart } from './StartPositionChart';
import { MatchupTable } from './MatchupTable';
import { HorseNumberAdvantageChart } from './HorseNumberAdvantageChart';

const VenuePanel = ({ venue }: { venue: VenueRaces }) => {
    const [activeRaceIndex, setActiveRaceIndex] = useState(0);
    const activeRace = venue.races[activeRaceIndex];

    // 的中判定ロジック（useState, useEffect）をここから削除します

    return (
        <div>
            <RaceSelector 
                races={venue.races}
                selectedIndex={activeRaceIndex}
                onSelectRace={setActiveRaceIndex}
            />
            {activeRace && (
                <>
                    {/* TopHitsDisplayの呼び出しをここから削除します */}
                    <StartPositionChart predictions={activeRace.predictions} />
                    <PredictionTable race={activeRace} />
                    <MatchupTable race={activeRace} />
                    <HorseNumberAdvantageChart
                        advantages={activeRace.horse_number_advantages}
                        courseType={activeRace.course_type}
                        distance={activeRace.distance}
                    />
                </>
            )}
        </div>
    );
};

export const RaceTabs = ({ data }: { data: RaceDayPrediction }) => {
    if (!data || (data.jra.length === 0 && data.nar.length === 0)) {
        return <div className="p-4 text-center text-gray-500">対象日のレースデータがありません。</div>;
    }

    return (
        <Tabs className="mt-4" selectedTabClassName="border-b-2 border-blue-600 bg-white" >
            <TabList className="flex border-b border-gray-200">
                <Tab className="px-4 py-2 font-semibold text-gray-600 cursor-pointer -mb-px rounded-t-md focus:outline-none">中央競馬 (JRA)</Tab>
                <Tab className="px-4 py-2 font-semibold text-gray-600 cursor-pointer -mb-px rounded-t-md focus:outline-none">地方競馬 (NAR)</Tab>
            </TabList>

            <TabPanel className="p-2 md:p-4 bg-white rounded-b-md border border-t-0 border-gray-200">
                <h2 className="text-2xl font-semibold mb-2">中央競馬</h2>
                {data.jra.length === 0 ? (
                    <p className="p-4 text-gray-500">この日の中央競馬の開催はありません。</p>
                ) : (
                    <Tabs forceRenderTabPanel>
                        <TabList>
                            {data.jra.map(venue => <Tab key={venue.venue_name}>{venue.venue_name}</Tab>)}
                        </TabList>
                        {data.jra.map(venue => (
                            <TabPanel key={venue.venue_name}>
                                <VenuePanel venue={venue} />
                            </TabPanel>
                        ))}
                    </Tabs>
                )}
            </TabPanel>
            <TabPanel className="p-2 md:p-4 bg-white rounded-b-md border border-t-0 border-gray-200">
                <h2 className="text-2xl font-semibold mb-2">地方競馬</h2>
                {data.nar.length === 0 ? (
                    <p className="p-4 text-gray-500">この日の地方競馬の開催はありません。</p>
                ) : (
                    <Tabs forceRenderTabPanel>
                        <TabList>
                            {data.nar.map(venue => <Tab key={venue.venue_name}>{venue.venue_name}</Tab>)}
                        </TabList>
                        {data.nar.map(venue => (
                            <TabPanel key={venue.venue_name}>
                                <VenuePanel venue={venue} />
                            </TabPanel>
                        ))}
                    </Tabs>
                )}
            </TabPanel>
        </Tabs>
    );
};