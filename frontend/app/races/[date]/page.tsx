'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPredictionsForDate, getSpecialPick } from '@/lib/api';
import { RaceDayPrediction, SpecialPick } from '@/lib/types';
import { RaceTabs } from '@/components/RaceTabs';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { formatDate } from '@/lib/utils';

// ★★★ 日付ナビゲーションコンポーネントを新設 ★★★
const DateNavigator = ({ currentDate, onDateChange }: { currentDate: string, onDateChange: (newDate: string) => void }) => {
    
    // ★★★ タイムゾーン問題を回避する堅牢な日付操作ロジック ★★★
    const handleDateShift = (days: number) => {
        const [year, month, day] = currentDate.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        dateObj.setUTCDate(dateObj.getUTCDate() + days);
        onDateChange(dateObj.toISOString().split('T')[0]);
    };

    return (
        <div className="flex items-center justify-center gap-2 md:gap-4">
            <button onClick={() => handleDateShift(-1)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm md:text-base">‹ 一日前</button>
            <input
                type="date"
                value={currentDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="border-gray-300 p-2 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm md:text-base"
            />
            <button onClick={() => handleDateShift(1)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm md:text-base">一日後 ›</button>
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

    // データ取得ロジック
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

    // URLのdateパラメータを監視してデータを再取得
    useEffect(() => {
        fetchDataForDate(dateFromUrl);
    }, [dateFromUrl, fetchDataForDate]);
    
    // 日付変更時にURLを更新するハンドラ
    const handleDateChange = (newDate: string) => {
        if (newDate !== dateFromUrl) {
            router.push(`/races/${newDate}`);
        }
    };

    return (
        <div className="container mx-auto p-4">
            {/* ★★★ レイアウトを修正 ★★★ */}
            <div className="flex flex-col md:flex-row justify-between items-center mt-2 mb-4 gap-4 p-4 bg-white border rounded-lg shadow-sm">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                    <span className="text-gray-500 font-normal">AI競馬予測</span> ({formatDate(dateFromUrl)})
                </h1>
                <DateNavigator currentDate={dateFromUrl} onDateChange={handleDateChange} />
            </div>

            {isLoading && (
                <div className="text-center p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">データを読み込んでいます...</p>
                </div>
            )}
            
            {error && <div className="text-center p-8 text-red-500 bg-red-50 rounded-lg">{error}</div>}
            
            {!isLoading && !error && predictionData && (
                <>
                    <SpecialPickCard pick={specialPick} />
                    <RaceTabs data={predictionData} />
                </>
            )}
        </div>
    );
}