"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { getPredictionsForDate } from "@/lib/api";
import { RaceDayPrediction } from "@/lib/types";
import { RaceTabs } from "@/components/RaceTabs";
import { SpecialPickCard } from "@/components/SpecialPickCard";
import { TopHitsDisplay } from "@/components/TopHitsDisplay";
import { formatDate } from "@/lib/utils";
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";

const DateNavigator = ({
    currentDate,
    onDateChange,
}: {
    currentDate: string;
    onDateChange: (newDate: string) => void;
}) => {
    const handleDateShift = (e: React.MouseEvent<HTMLButtonElement>, days: number) => {
        const [year, month, day] = currentDate.split("-").map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        dateObj.setUTCDate(dateObj.getUTCDate() + days);
        onDateChange(dateObj.toISOString().split("T")[0]);
        e.currentTarget.blur();
    };

    return (
        <div className="flex items-center justify-center gap-1 sm:gap-2">
            <button
                onClick={(e) => handleDateShift(e, -1)}
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
                onClick={(e) => handleDateShift(e, 1)}
                className="bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded-md shadow-sm hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0"
            >
                翌日 ›
            </button>
        </div>
    );
};

export default function RacePageClient({ date }: { date: string }) {
    const router = useRouter();
    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getTodayString = () => {
        const today = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
        );
        return today.toISOString().split("T")[0];
    };
    
    const fetchDataForDate = useCallback((newDate: string) => {
        setIsLoading(true);
        setError(null);
        setPredictionData(null);
        document.title = `競馬AI予測 | ${formatDate(newDate)}`;

        getPredictionsForDate(newDate)
            .then((predictions) => setPredictionData(predictions))
            .catch((err) => {
                console.error(err);
                setError("データの取得に失敗しました。時間をおいて再度お試しください。");
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        fetchDataForDate(date);
    }, [date, fetchDataForDate]);

    const handleDateChange = (newDate: string) => {
        if (newDate !== date) {
            router.push(`/races/${newDate}`);
        }
    };
    
    // コンテンツの表示を制御する関数
    const renderContent = () => {
        if (isLoading) {
            return <RaceTabsSkeleton />;
        }

        if (error) {
            return (
                <div className="text-center p-6 text-red-600 bg-red-100 rounded-lg border border-red-200">
                    <p className="font-bold text-lg mb-2">エラー</p>
                    <p>{error}</p>
                </div>
            );
        }

        // データが空の場合の表示（これが重要）
        if (!predictionData || (predictionData.jra.length === 0 && predictionData.nar.length === 0)) {
            return (
                <div className="text-center p-8 bg-white rounded-lg border shadow-sm">
                    <h2 className="text-xl font-bold text-gray-700 mb-2">{formatDate(date)}のレースデータはありません</h2>
                    <p className="text-gray-500 mb-6">
                        指定された日付はレースが開催されないか、まだデータが登録されていません。<br />
                        他の日付のレース予測をお探しください。
                    </p>
                    <Link
                        href={`/races/${getTodayString()}`}
                        className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
                    >
                        本日のレース予測を見る
                    </Link>
                </div>
            );
        }

        // データがある場合の通常の表示
        return (
            <>
                <div className="mb-4">
                    <SpecialPickCard date={date} />
                </div>
                <RaceTabs data={predictionData} />
            </>
        );
    };

    return (
        <div className="container py-4">
            <div className="mb-4">
                <TopHitsDisplay />
            </div>

            <div className="sticky top-16 z-40 bg-white/80 backdrop-blur-sm border-b shadow-md mb-4 p-2">
                <div className="grid grid-cols-3 items-center">
                    <div className="justify-self-start">
                        <button
                            onClick={(e) => {
                                handleDateChange(getTodayString());
                                e.currentTarget.blur();
                            }}
                            className="bg-primary border border-primary-dark text-white px-3 py-1.5 rounded-md shadow-sm hover:bg-primary-dark transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm font-bold whitespace-nowrap"
                        >
                            今日
                        </button>
                    </div>
                    <div className="justify-self-center">
                        <DateNavigator currentDate={date} onDateChange={handleDateChange} />
                    </div>
                    <div className="justify-self-end"></div>
                </div>
            </div>

            {renderContent()}
        </div>
    );
}