"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    // DateオブジェクトはUTCで作成し、JSTで日付操作を行う
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    dateObj.setUTCDate(dateObj.getUTCDate() + days); // UTC日付を直接操作
    onDateChange(dateObj.toISOString().split("T")[0]);
    e.currentTarget.blur(); // フォーカスを外す
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
  const searchParams = useSearchParams();

  const initialVenue = searchParams.get("venue");
  const initialRace = searchParams.get("race");
  const initialRaceNumber = initialRace ? parseInt(initialRace, 10) : null;

  const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDataForDate = useCallback((date: string) => {
    setIsLoading(true);
    setError(null);
    setPredictionData(null);
    document.title = `競馬AI予測 | ${formatDate(date)}`;

    getPredictionsForDate(date)
      .then((predictions) => setPredictionData(predictions))
      .catch((err) => {
        console.error(err);
        setError(
          "データの取得に失敗しました。バックエンドサーバーが起動しているか確認してください。"
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ▼▼▼▼▼ ここから修正 ▼▼▼▼▼
  useEffect(() => {
    // ユーザーが日付を素早く変更している間の不要なAPI呼び出しを防ぐためのデバウンス処理
    const handler = setTimeout(() => {
        fetchDataForDate(date);
    }, 500); // 500ミリ秒の遅延を設定

    // クリーンアップ関数：コンポーネントがアンマウントされるか、
    // dateが変更されたときにタイマーをクリアする
    return () => {
        clearTimeout(handler);
    };
  }, [date, fetchDataForDate]);
  // ▲▲▲▲▲ ここまで修正 ▲▲▲▲▲

  useEffect(() => {
    if (!isLoading && predictionData && initialVenue) {
      setTimeout(() => {
        const venueId = `venue-${initialVenue}`;
        const element = document.getElementById(venueId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    }
  }, [isLoading, predictionData, initialVenue]);

  const handleDateChange = (newDate: string) => {
    if (newDate !== date) {
      router.push(`/races/${newDate}`);
    }
  };

  const getTodayString = () => {
    const today = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    );
    return today.toISOString().split("T")[0];
  };

  return (
    <div className="container py-4">
      <div>
        <div className="mb-4">
          <TopHitsDisplay />
        </div>

        <div className="sticky top-16 z-40 bg-white/80 backdrop-blur-sm border-b shadow-md mb-4 p-2">
          <div className="grid grid-cols-3 items-center">
            <div className="justify-self-start">
              <button
                onClick={(e) => {
                  handleDateChange(getTodayString());
                  e.currentTarget.blur(); // フォーカスを外す
                }}
                className="bg-primary border border-primary-dark text-white px-3 py-1.5 rounded-md shadow-sm hover:bg-primary-dark transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm font-bold whitespace-nowrap"
              >
                今日
              </button>
            </div>
            <div className="justify-self-center">
              <DateNavigator
                currentDate={date}
                onDateChange={handleDateChange}
              />
            </div>
            <div className="justify-self-end"></div>
          </div>
        </div>

        <div className="mb-4">
          <SpecialPickCard date={date} />
        </div>

        {isLoading && <RaceTabsSkeleton />}

        {error && (
          <div className="text-center p-6 text-red-600 bg-red-100 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {!isLoading && !error && predictionData && (
          <RaceTabs
            data={predictionData}
            initialVenueName={initialVenue}
            initialRaceNumber={initialRaceNumber}
          />
        )}
      </div>
    </div>
  );
}