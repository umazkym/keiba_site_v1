'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPredictionsForDate } from '@/lib/api';
import { RaceDayPrediction } from '@/lib/types';
import { RaceTabs } from '@/components/RaceTabs';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { formatDate } from '@/lib/utils';
import { RaceTabsSkeleton } from '@/components/SkeletonLoader';

const DateNavigator = ({ currentDate, onDateChange }: { currentDate: string, onDateChange: (newDate: string) => void }) => {

    const handleDateShift = (days: number) => {
        const [year, month, day] = currentDate.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        dateObj.setUTCDate(dateObj.getUTCDate() + days);
        onDateChange(dateObj.toISOString().split('T')[0]);
    };

    const getTodayString = () => {
        const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
        return today.toISOString().split('T')[0];
    };

    return (
        <div className="flex items-center justify-center gap-1 sm:gap-2 w-full overflow-x-auto">
            <button
                onClick={() => onDateChange(getTodayString())}
                className="bg-primary border border-primary-dark text-white px-2 py-1.5 rounded-md shadow-sm hover:bg-primary-dark transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-xs sm:text-sm font-bold whitespace-nowrap shrink-0"
            >
                今日
            </button>
            <button
                onClick={() => handleDateShift(-1)}
                className="bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded-md shadow-sm hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0"
            >
                ‹ 前日
            </button>
            <input
                type="date"
                value={currentDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="border-gray-300 p-1.5 rounded-md shadow-sm focus:border-primary-light focus:ring focus:ring-primary-light focus:ring-opacity-50 text-xs sm:text-sm shrink-0"
            />
            <button
                onClick={() => handleDateShift(1)}
                className="bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded-md shadow-sm hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0"
            >
                翌日 ›
            </button>
        </div>
    );
};

export default function RacePage() {
    const router = useRouter();
    const params = useParams();
    
    const dateFromUrl = typeof params.date === 'string' ? params.date : new Date().toISOString().split('T')[0];

    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDataForDate = useCallback((date: string) => {
        setIsLoading(true);
        setError(null);
        setPredictionData(null);
        document.title = `競馬AI予測 | ${formatDate(date)}`;
        
        getPredictionsForDate(date)
            .then((predictions) => {
                setPredictionData(predictions);
            })
            .catch(err => {
                console.error(err);
                setError('データの取得に失敗しました。バックエンドサーバーが起動しているか確認してください。');
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    useEffect(() => {
        fetchDataForDate(dateFromUrl);
    }, [dateFromUrl, fetchDataForDate]);
    
    const handleDateChange = (newDate: string) => {
        if (newDate !== dateFromUrl) {
            router.push(`/races/${newDate}`);
        }
    };

    return (
        <div className="container py-4">
            
            <div className="mb-4">
                <TopHitsDisplay />
            </div>

            <div className="flex justify-center items-center mb-4 p-2 bg-white border rounded-lg shadow-sm">
                <DateNavigator currentDate={dateFromUrl} onDateChange={handleDateChange} />
            </div>

            <div className="mb-4">
                <SpecialPickCard date={dateFromUrl} />
            </div>

            {isLoading && (
                <RaceTabsSkeleton />
            )}
            
            {error && <div className="text-center p-6 text-red-600 bg-red-100 rounded-lg border border-red-200">{error}</div>}
            
            {!isLoading && !error && predictionData && (
                 <RaceTabs data={predictionData} />
            )}
        </div>
    );
}