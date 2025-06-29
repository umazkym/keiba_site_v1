'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPredictionsForDate, getSpecialPick } from '@/lib/api';
import { RaceDayPrediction, SpecialPick } from '@/lib/types';
import { RaceTabs } from '@/components/RaceTabs';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { formatDate } from '@/lib/utils';

export default function RacePage() {
    const router = useRouter();
    const params = useParams();
    
    // 現在のページのdateを取得、なければ今日の日付を初期値とする
    const initialDate = typeof params.date === 'string' ? params.date : new Date().toISOString().split('T')[0];

    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(null);
    const [specialPick, setSpecialPick] = useState<SpecialPick | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(initialDate);

    // ★★★ 日付を元にデータを取得する関数を useCallback でメモ化 ★★★
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

    // ★★★ ページ読み込み時、またはURLのdateが変わった時にデータを取得 ★★★
    useEffect(() => {
        if (params.date && typeof params.date === 'string') {
            setCurrentDate(params.date);
            fetchDataForDate(params.date);
        }
    }, [params.date, fetchDataForDate]);

    // ★★★ 日付操作の関数群 ★★★
    const handleDateChange = (newDate: string) => {
        setCurrentDate(newDate);
        router.push(`/races/${newDate}`);
    };

    const handlePrevDay = () => {
        const dateObj = new Date(currentDate + 'T00:00:00');
        dateObj.setDate(dateObj.getDate() - 1);
        handleDateChange(dateObj.toISOString().split('T')[0]);
    };

    const handleNextDay = () => {
        const dateObj = new Date(currentDate + 'T00:00:00');
        dateObj.setDate(dateObj.getDate() + 1);
        handleDateChange(dateObj.toISOString().split('T')[0]);
    };
    
    const handleToday = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        handleDateChange(todayStr);
    };

    return (
        <div className="container mx-auto p-4">
            {/* ★★★ 日付選択UIの改善 ★★★ */}
            <div className="flex flex-wrap items-center justify-center gap-2 my-4 p-4 bg-white border rounded-lg shadow-sm">
                <button onClick={handlePrevDay} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors">‹ 昨日へ</button>
                <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="border-gray-300 p-2 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
                <button onClick={handleNextDay} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors">翌日へ ›</button>
                <button onClick={handleToday} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">今日</button>
            </div>

            {isLoading && <div className="text-center p-8">読み込み中...</div>}
            {error && <div className="text-center p-8 text-red-500">{error}</div>}
            
            {!isLoading && !error && predictionData && (
                <>
                    <h1 className="text-3xl font-bold my-4">競馬AI予測 ({formatDate(currentDate)})</h1>
                    <SpecialPickCard pick={specialPick} />
                    <RaceTabs data={predictionData} />
                </>
            )}
        </div>
    );
}