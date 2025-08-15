'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPredictionsForDate, getSpecialPick } from '@/lib/api';
import { RaceDayPrediction, SpecialPick } from '@/lib/types';
import { RaceTabs } from '@/components/RaceTabs';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { formatDate } from '@/lib/utils';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';

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
        <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
            <button  
                onClick={() => handleDateShift(-1)}  
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md shadow-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm md:text-base font-semibold"
            >
                ‹ 前日
            </button>
            <button
                onClick={() => onDateChange(getTodayString())}
                className="bg-primary border border-primary-dark text-white px-4 py-2 rounded-md shadow-sm hover:bg-primary-dark active:bg-primary-dark transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm md:text-base font-bold"
            >
                今日
            </button>
            <input
                type="date"
                value={currentDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="border-gray-300 p-2 rounded-md shadow-sm focus:border-primary-light focus:ring focus:ring-primary-light focus:ring-opacity-50 text-sm md:text-base"
            />
            <button  
                onClick={() => handleDateShift(1)}  
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md shadow-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm md:text-base font-semibold"
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
    const [specialPick, setSpecialPick] = useState<SpecialPick | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDataForDate = useCallback((date: string) => {
        setIsLoading(true);
        setError(null);
        document.title = `競馬AI予測 | ${formatDate(date)}`;
        
        Promise.all([
            getPredictionsForDate(date),
            getSpecialPick(date)
        ]).then(([predictions, pick]) => {
            setPredictionData(predictions);
            setSpecialPick(pick);
        }).catch(err => {
            console.error(err);
            setError('データの取得に失敗しました。バックエンドサーバーが起動しているか確認してください。');
        }).finally(() => {
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
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center mt-2 mb-8 gap-4 p-4 bg-white border rounded-lg shadow-sm">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                    <span className="text-primary-dark font-normal">AI競馬予測</span> ({formatDate(dateFromUrl)})
                </h1>
                <DateNavigator currentDate={dateFromUrl} onDateChange={handleDateChange} />
            </div>

            {isLoading && (
                <div className="text-center p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">データを読み込んでいます...</p>
                </div>
            )}
            
            {error && <div className="text-center p-8 text-red-600 bg-red-100 rounded-lg border border-red-200">{error}</div>}
            
            {!isLoading && !error && predictionData && (
                <>
                    <SpecialPickCard pick={specialPick} />
                    <TopHitsDisplay />
                    <RaceTabs data={predictionData} />
                </>
            )}
        </div>
    );
}