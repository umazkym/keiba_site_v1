'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPredictionsForDate, getSpecialPick } from '@/lib/api';
import { RaceDayPrediction, SpecialPick } from '@/lib/types';
import { RaceTabs } from '@/components/RaceTabs';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { formatDate } from '@/lib/utils';

export default function RacePage() {
    const router = useRouter();
    const params = useParams();
    
    const date = typeof params.date === 'string' ? params.date : null;

    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(null);
    const [specialPick, setSpecialPick] = useState<SpecialPick | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(date || new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (date) {
            document.title = `競馬AI予測 | ${formatDate(date)}`;
            setIsLoading(true);
            setError(null);
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
        } else {
            setIsLoading(false);
        }
    }, [date]);

    const handleDateChange = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        router.push(`/races/${selectedDate}`);
    };

    return (
        <div className="container mx-auto p-4">
            <form onSubmit={handleDateChange} className="flex items-center gap-2 my-4 p-4 bg-white border rounded-lg shadow-sm">
                <label htmlFor="race-date" className="font-medium text-gray-700">日付を選択:</label>
                <input
                    type="date"
                    id="race-date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border-gray-300 p-2 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    表示
                </button>
            </form>

            {isLoading && <div className="text-center p-8">読み込み中...</div>}
            {error && <div className="text-center p-8 text-red-500">{error}</div>}
            {predictionData && date && (
                <>
                    <h1 className="text-3xl font-bold my-4">競馬AI予測 ({formatDate(date)})</h1>
                    <SpecialPickCard pick={specialPick} />
                    <RaceTabs data={predictionData} />
                </>
            )}
        </div>
    );
}