"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
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

type RacePageClientProps = {
  initialDate: string;
  initialPredictionData: RaceDayPrediction | null;
};

export default function RacePageClient({ initialDate, initialPredictionData }: RacePageClientProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(initialPredictionData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialPredictionData ? null : "指定された日付のレースデータはありませんでした。");

  const handleDateChange = useCallback((newDate: string) => {
    if (newDate && newDate !== currentDate) {
      setIsLoading(true);
      router.push(`/races/${newDate}`);
    }
  }, [currentDate, router]);

  useEffect(() => {
    setCurrentDate(initialDate);
    setPredictionData(initialPredictionData);
    setIsLoading(false);
    setError(initialPredictionData ? null : "指定された日付のレースデータはありませんでした。");
    document.title = `競馬AI予測 | ${formatDate(initialDate)}`;
  }, [initialDate, initialPredictionData]);

  const getTodayString = () => {
    const today = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    );
    return today.toISOString().split("T")[0];
  };

  const renderContent = () => {
    if (isLoading) {
      return <RaceTabsSkeleton />;
    }

    if (error || !predictionData || (predictionData.jra.length === 0 && predictionData.nar.length === 0)) {
      return (
        <div className="text-center p-8 bg-white rounded-lg border shadow-sm">
          <h2 className="text-xl font-bold text-gray-700 mb-2">{formatDate(currentDate)}のレースデータはありません</h2>
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
          <div className="mt-8 pt-6 border-t text-left max-w-2xl mx-auto">
            <h3 className="font-bold text-gray-700 mb-3">競馬開催スケジュール</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• 中央競馬（JRA）: 主に土日に開催されます。</p>
              <p>• 地方競馬（NAR）: 各競馬場により開催日が異なります。</p>
              <p>• 翌日のレース予測データは、通常、前日の19時頃に更新されます。</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="mb-4">
          <SpecialPickCard date={currentDate} />
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
            <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} />
          </div>
          <div className="justify-self-end"></div>
        </div>
      </div>

      {renderContent()}
    </div>
  );
}