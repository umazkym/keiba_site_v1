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
                <div className="mt-2">
                    {/* メインの予測カード */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-3">
                        <div className="bg-primary text-white p-2 border-b border-gray-200 rounded-t-lg">
                            <h3 className="text-base font-bold flex items-center">
                                <span className="bg-primary-dark text-white rounded-full w-7 h-7 inline-flex items-center justify-center mr-2 font-mono shadow-inner">{activeRace.race_number}R</span>
                                <span className="truncate">{activeRace.race_name}</span>
                            </h3>
                            <p className="text-sm text-blue-100 ml-9 -mt-1">{activeRace.course_type}{activeRace.distance}m</p>
                        </div>
                        
                        {/* 予測テーブル */}
                        <div>
                             <h4 className="flex items-center text-md font-bold text-gray-700 mt-2 mb-1 px-3">
                                <SparklesIcon className="w-5 h-5 text-accent-dark mr-2" />
                                予測
                            </h4>
                            <PredictionTable race={activeRace} />
                        </div>
                    </div>

                    {/* 詳細データ (アコーディオン) */}
                    <div className="space-y-2">
                        {/* スタートダッシュ予測 */}
                        <details className="group rounded-lg bg-gray-50 open:bg-white open:shadow-lg transition-all duration-300 border open:border-gray-200">
                            <summary className="flex items-center text-md font-bold text-gray-800 p-2 cursor-pointer list-none">
                                <div className="w-6 h-6 mr-2 flex-shrink-0">
                                    <FlagIcon className="w-5 h-5 text-accent-dark" />
                                </div>
                                <span className="whitespace-nowrap">スタートダッシュ予測</span>
                                <div className="ml-auto transform transition-transform duration-300 group-open:rotate-90">
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                </div>
                            </summary>
                            <div className="p-2 pt-0">
                                <StartPositionChart predictions={activeRace.predictions} />
                            </div>
                        </details>

                        {/* 総当たり対戦績 */}
                        <details className="group rounded-lg bg-gray-50 open:bg-white open:shadow-lg transition-all duration-300 border open:border-gray-200">
                            <summary className="flex items-center text-md font-bold text-gray-800 p-2 cursor-pointer list-none">
                                <div className="w-6 h-6 mr-2 flex-shrink-0">
                                    <UsersIcon className="w-5 h-5 text-accent-dark" />
                                </div>
                                <span className="whitespace-nowrap">総当たり対戦績</span>
                                <div className="ml-auto transform transition-transform duration-300 group-open:rotate-90">
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                </div>
                            </summary>
                            <div className="p-2 pt-0">
                                <MatchupTable race={activeRace} />
                            </div>
                        </details>

                        {/* コース別 馬番アドバンテージ */}
                        <details className="group rounded-lg bg-gray-50 open:bg-white open:shadow-lg transition-all duration-300 border open:border-gray-200">
                            <summary className="flex items-center text-md font-bold text-gray-800 p-2 cursor-pointer list-none">
                                <div className="w-6 h-6 mr-2 flex-shrink-0">
                                    <ChartBarIcon className="w-5 h-5 text-accent-dark" />
                                </div>
                                <span className="whitespace-nowrap">コース別 馬番アドバンテージ</span>
                                <div className="ml-auto transform transition-transform duration-300 group-open:rotate-90">
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                </div>
                            </summary>
                             <div className="p-2 pt-0">
                                 <HorseNumberAdvantageChart
                                     advantages={activeRace.horse_number_advantages}
                                     courseType={activeRace.course_type}
                                     distance={activeRace.distance}
                                 />
                            </div>
                        </details>
                    </div>
                </div>
            )}
        </div>
    );
};

export const RaceTabs = ({ data }: { data: RaceDayPrediction }) => {
    if (!data || (data.jra.length === 0 && data.nar.length === 0)) {
        return <div className="p-6 text-center text-gray-500 bg-white rounded-lg shadow">対象日のレースデータがありません。</div>;
    }

    return (
        <Tabs className="mt-4" selectedTabClassName="!text-primary-dark !bg-white border-gray-200 !border-b-white" >
            <TabList className="flex border-b-2 border-gray-200 bg-gray-100 rounded-t-lg">
                <Tab className="flex-1 px-4 py-2 font-semibold text-gray-600 cursor-pointer text-center rounded-tl-lg focus:outline-none focus:ring-2 focus:ring-primary-light transition-colors whitespace-nowrap">中央競馬 (JRA)</Tab>
                <Tab className="flex-1 px-4 py-2 font-semibold text-gray-600 cursor-pointer text-center rounded-tr-lg focus:outline-none focus:ring-2 focus:ring-primary-light transition-colors whitespace-nowrap">地方競馬 (NAR)</Tab>
            </TabList>

            <TabPanel className="p-2 md:p-3 bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-md">
                {data.jra.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">この日の中央競馬の開催はありません。</p>
                ) : (
                    <Tabs selectedTabClassName="!text-primary-dark !bg-gray-100 !border-gray-300">
                        <TabList className="flex flex-wrap border-b border-gray-200 -mb-px gap-x-2">
                            {data.jra.map(venue => <Tab key={venue.venue_name} className="px-3 py-2 font-medium cursor-pointer border-b-2 border-transparent hover:bg-gray-100 hover:text-primary-dark transition-colors whitespace-nowrap">{venue.venue_name}</Tab>)}
                        </TabList>
                        {data.jra.map(venue => (
                            <TabPanel key={venue.venue_name} className="pt-2">
                                <VenuePanel venue={venue} />
                            </TabPanel>
                        ))}
                    </Tabs>
                )}
            </TabPanel>
            <TabPanel className="p-2 md:p-3 bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-md">
                {data.nar.length === 0 ? (
                    <p className="p-4 text-gray-500 text-center">この日の地方競馬の開催はありません。</p>
                ) : (
                    <Tabs selectedTabClassName="!text-primary-dark !bg-gray-100 !border-gray-300">
                        <TabList className="flex flex-wrap border-b border-gray-200 -mb-px gap-x-2">
                            {data.nar.map(venue => <Tab key={venue.venue_name} className="px-3 py-2 font-medium cursor-pointer border-b-2 border-transparent hover:bg-gray-100 hover:text-primary-dark transition-colors whitespace-nowrap">{venue.venue_name}</Tab>)}
                        </TabList>
                        {data.nar.map(venue => (
                            <TabPanel key={venue.venue_name} className="pt-2">
                                <VenuePanel venue={venue} />
                            </TabPanel>
                        ))}
                    </Tabs>
                )}
            </TabPanel>
        </Tabs>
    );
};