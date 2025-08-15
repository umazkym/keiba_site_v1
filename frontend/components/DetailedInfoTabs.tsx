'use client';

import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { RacePrediction } from '@/lib/types';
import { StartPositionChart } from './StartPositionChart';
import { MatchupTable } from './MatchupTable';
import { HorseNumberAdvantageChart } from './HorseNumberAdvantageChart';
import { FlagIcon, UsersIcon, ChartBarIcon } from './icons';

export const DetailedInfoTabs = ({ race }: { race: RacePrediction }) => {
    return (
        <Tabs selectedTabClassName="!text-primary-dark !border-primary !border-b-2 bg-blue-50">
            <TabList className="flex flex-wrap border-b border-gray-200">
                <Tab className="flex-1 md:flex-none px-4 py-3 font-semibold text-gray-600 cursor-pointer text-center border-b-2 border-transparent hover:bg-gray-100 hover:text-primary-dark transition-colors focus:outline-none flex items-center justify-center gap-2">
                    <FlagIcon className="w-5 h-5" />
                    <span>スタート位置予測</span>
                </Tab>
                <Tab className="flex-1 md:flex-none px-4 py-3 font-semibold text-gray-600 cursor-pointer text-center border-b-2 border-transparent hover:bg-gray-100 hover:text-primary-dark transition-colors focus:outline-none flex items-center justify-center gap-2">
                    <UsersIcon className="w-5 h-5" />
                    <span>直接対決データ</span>
                </Tab>
                <Tab className="flex-1 md:flex-none px-4 py-3 font-semibold text-gray-600 cursor-pointer text-center border-b-2 border-transparent hover:bg-gray-100 hover:text-primary-dark transition-colors focus:outline-none flex items-center justify-center gap-2">
                    <ChartBarIcon className="w-5 h-5" />
                    <span>馬番有利不利</span>
                </Tab>
            </TabList>

            <div className="mt-4">
                <TabPanel>
                    <StartPositionChart predictions={race.predictions} />
                </TabPanel>
                <TabPanel>
                    <MatchupTable race={race} />
                </TabPanel>
                <TabPanel>
                    <HorseNumberAdvantageChart
                        advantages={race.horse_number_advantages}
                        courseType={race.course_type}
                        distance={race.distance}
                    />
                </TabPanel>
            </div>
        </Tabs>
    );
};