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
import { SparklesIcon, FlagIcon, UsersIcon, ChartBarIcon } from './icons';

const VenuePanel = ({ venue }: { venue: VenueRaces }) => {
    const [activeRaceIndex, setActiveRaceIndex] = useState(0);
    const activeRace = venue.races[activeRaceIndex];

    return (
        <div>
            <RaceSelector 
                races={venue.races}
                selectedIndex={activeRaceIndex}
                onSelectRace={setActiveRaceIndex}
            />
            {activeRace && (
                <div className="mt-6 space-y-10">
                    <div>
                        <h3 className="flex items-center text-xl font-bold text-gray-800 mb-3 px-2">
                           <SparklesIcon className="w-6 h-6 text-accent-dark mr-2" />
                            AI予測
                        </h3>
                        <PredictionTable race={activeRace} />
                    </div>
                    
                    <div>
                        <h3 className="flex items-center text-xl font-bold text-gray-800 mb-3 px-2">
                           <FlagIcon className="w-6 h-6 text-accent-dark mr-2" />
                            AI スタート位置予測 (1コーナー)
                        </h3>
                        <StartPositionChart predictions={activeRace.predictions} />
                    </div>

                    <div>
                        <h3 className="flex items-center text-xl font-bold text-gray-800 mb-3 px-2">
                            <UsersIcon className="w-6 h-6 text-accent-dark mr-2" />
                            直接対決データ
                        </h3>
                        <MatchupTable race={activeRace} />
                    </div>

                    <div>
                         <h3 className="flex items-center text-xl font-bold text-gray-800 mb-3 px-2">
                           <ChartBarIcon className="w-6 h-6 text-accent-dark mr-2" />
                           コース別・馬番有利不利
                        </h3>
                        <HorseNumberAdvantageChart
                            advantages={activeRace.horse_number_advantages}
                            courseType={activeRace.course_type}
                            distance={activeRace.distance}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export const RaceTabs = ({ data }: { data: RaceDayPrediction }) => {
    if (!data || (data.jra.length === 0 && data.nar.length === 0)) {
        return <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">対象日のレースデータがありません。</div>;
    }

    return (
        <Tabs className="mt-8" selectedTabClassName="!text-primary-dark !bg-white border-gray-200 !border-b-white" >
            <TabList className="flex border-b-2 border-gray-200 bg-gray-100 rounded-t-lg">
                <Tab className="flex-1 px-4 py-3 font-semibold text-gray-600 cursor-pointer text-center rounded-tl-lg focus:outline-none focus:ring-2 focus:ring-primary-light transition-colors">中央競馬 (JRA)</Tab>
                <Tab className="flex-1 px-4 py-3 font-semibold text-gray-600 cursor-pointer text-center rounded-tr-lg focus:outline-none focus:ring-2 focus:ring-primary-light transition-colors">地方競馬 (NAR)</Tab>
            </TabList>

            <TabPanel className="p-4 md:p-6 bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-md">
                {data.jra.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">この日の中央競馬の開催はありません。</p>
                ) : (
                    <Tabs forceRenderTabPanel selectedTabClassName="!text-primary-dark !bg-gray-100 !border-gray-300">
                        <TabList className="flex flex-wrap border-b border-gray-200">
                            {data.jra.map(venue => <Tab key={venue.venue_name} className="px-4 py-2 font-medium cursor-pointer border-b-2 border-transparent hover:bg-gray-100 hover:text-primary-dark transition-colors">{venue.venue_name}</Tab>)}
                        </TabList>
                        {data.jra.map(venue => (
                            <TabPanel key={venue.venue_name} className="pt-6">
                                <VenuePanel venue={venue} />
                            </TabPanel>
                        ))}
                    </Tabs>
                )}
            </TabPanel>
            <TabPanel className="p-4 md:p-6 bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-md">
                {data.nar.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">この日の地方競馬の開催はありません。</p>
                ) : (
                    <Tabs forceRenderTabPanel selectedTabClassName="!text-primary-dark !bg-gray-100 !border-gray-300">
                        <TabList className="flex flex-wrap border-b border-gray-200">
                            {data.nar.map(venue => <Tab key={venue.venue_name} className="px-4 py-2 font-medium cursor-pointer border-b-2 border-transparent hover:bg-gray-100 hover:text-primary-dark transition-colors">{venue.venue_name}</Tab>)}
                        </TabList>
                        {data.nar.map(venue => (
                            <TabPanel key={venue.venue_name} className="pt-6">
                                <VenuePanel venue={venue} />
                            </TabPanel>
                        ))}
                    </Tabs>
                )}
            </TabPanel>
        </Tabs>
    );
};