"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link';
import { RaceDayPrediction } from "@/lib/types";
import { RaceTabs } from "@/components/RaceTabs";
import { SpecialPickCard } from "@/components/SpecialPickCard";
import { TopHitsDisplay } from "@/components/TopHitsDisplay";
import { formatDate } from "@/lib/utils";
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { getPredictionsForDate } from "@/lib/api";

// ▼▼▼▼▼【修正: 日付フォーマット検証関数を追加】▼▼▼▼▼
/**
 * 日付文字列が有効なISO 8601形式（YYYY-MM-DD）かつ実在する日付であることを検証する
 * @param dateStr - 検証対象の日付文字列
 * @returns 有効な日付の場合true、無効な場合false
 */
const isValidDateFormat = (dateStr: string): boolean => {
    // YYYY-MM-DD形式か確認
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return false;
    }

    // 実在する日付か確認（Date.parseで自動的に無効な日付を検出）
    const date = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(date.getTime())) {
        return false;
    }

    // 日付の個別部分を検証（例: 2025-02-30は無効）
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateFromParts = new Date(Date.UTC(year, month - 1, day));
    const isValidDate =
        dateFromParts.getUTCFullYear() === year &&
        dateFromParts.getUTCMonth() === month - 1 &&
        dateFromParts.getUTCDate() === day;

    return isValidDate;
};
// ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

const DateNavigator = ({
    currentDate,
    onDateChange,
}: {
    currentDate: string;
    onDateChange: (newDate: string) => void;
}) => {
    const handleDateShift = useCallback((e: React.MouseEvent<HTMLButtonElement>, days: number) => {
        const [year, month, day] = currentDate.split("-").map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        dateObj.setUTCDate(dateObj.getUTCDate() + days);
        onDateChange(dateObj.toISOString().split("T")[0]);
        e.currentTarget.blur();
    }, [currentDate, onDateChange]);

    const handleDateInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        if (newDate) {
            onDateChange(newDate);
        }
    }, [onDateChange]);

    return (
        <div className="flex items-center justify-center gap-2 sm:gap-3">
            <button
                onClick={(e) => handleDateShift(e, -1)}
                className="bg-white border-2 border-gray-300 text-gray-700 px-3 py-2.5 sm:px-4 sm:py-2 rounded-lg shadow-sm hover:bg-gray-100 hover:border-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm sm:text-base font-semibold whitespace-nowrap shrink-0 min-h-[44px] active:bg-gray-200"
                aria-label="前日へ移動"
            >
                ‹ 前日
            </button>
            <input
                type="date"
                value={currentDate}
                onChange={handleDateInputChange}
                className="border-2 border-gray-300 px-3 py-2.5 rounded-lg shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/30 text-sm sm:text-base shrink-0 min-h-[44px] font-medium"
                aria-label="日付を選択"
            />
            <button
                onClick={(e) => handleDateShift(e, 1)}
                className="bg-white border-2 border-gray-300 text-gray-700 px-3 py-2.5 sm:px-4 sm:py-2 rounded-lg shadow-sm hover:bg-gray-100 hover:border-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm sm:text-base font-semibold whitespace-nowrap shrink-0 min-h-[44px] active:bg-gray-200"
                aria-label="翌日へ移動"
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
    const searchParams = useSearchParams();
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(initialPredictionData);
    const [isLoading, setIsLoading] = useState(!initialPredictionData);
    const [error, setError] = useState<string | null>(null);
    const [initialVenue, setInitialVenue] = useState<string | null>(null);
    const [initialRaceNumber, setInitialRaceNumber] = useState<number | null>(null);
    const hasScrolled = useRef(false);

    useEffect(() => {
        const fetchData = async (dateToFetch: string) => {
            // ▼▼▼▼▼【修正: 日付フォーマット検証を追加】▼▼▼▼▼
            // 不正な日付形式の場合、バックエンドへのリクエストを送らずにエラーを表示
            if (!isValidDateFormat(dateToFetch)) {
                setError("無効な日付形式です。YYYY-MM-DD形式で指定してください。");
                setIsLoading(false);
                return;
            }
            // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

            setIsLoading(true);
            setError(null);
            try {
                const data = await getPredictionsForDate(dateToFetch);
                setPredictionData(data);

                if (!data || (data.jra.length === 0 && data.nar.length === 0)) {
                    setError("指定された日付のレースデータはありませんでした。");
                }
            } catch (err) {
                setError("データの取得に失敗しました。時間をおいて再度お試しください。");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        setCurrentDate(initialDate);
        document.title = `競馬AI予測 | ${formatDate(initialDate)}`;
        fetchData(initialDate);

    }, [initialDate]);

    useEffect(() => {
        const venue = searchParams.get('venue');
        const raceStr = searchParams.get('race');
        
        if (venue) {
            setInitialVenue(decodeURIComponent(venue));
        }
        if (raceStr) {
            const raceNum = parseInt(raceStr, 10);
            if (!isNaN(raceNum)) {
                setInitialRaceNumber(raceNum);
            }
        }
    }, [searchParams]);

    useEffect(() => {
        if (!hasScrolled.current && initialVenue && initialRaceNumber && predictionData) {
            const venueExists = [...predictionData.jra, ...predictionData.nar].some(
                v => v.venue_name === initialVenue
            );
            
            if (venueExists) {
                setTimeout(() => {
                    const venueElement = document.getElementById(`venue-${initialVenue}`);
                    if (venueElement) {
                        setTimeout(() => {
                            const raceData = [...predictionData.jra, ...predictionData.nar]
                                .find(v => v.venue_name === initialVenue)
                                ?.races.find(r => r.race_number === initialRaceNumber);
                            
                            if (raceData) {
                                const raceElement = document.getElementById(`race-${raceData.id}`);
                            }
                        }, 500);
                    }
                    hasScrolled.current = true;
                }, 100);
            }
        }
    }, [initialVenue, initialRaceNumber, predictionData]);

    const handleDateChange = useCallback((newDate: string) => {
        if (newDate && newDate !== currentDate) {
            hasScrolled.current = false;
            router.push(`/races/${newDate}`);
        }
    }, [currentDate, router]);

    const getTodayString = () => {
        const today = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
        );
        return today.toISOString().split("T")[0];
    };

    const todayStr = getTodayString();

    const renderContent = () => {
        if (isLoading) {
            return <RaceTabsSkeleton />;
        }
        if (error || !predictionData || (predictionData.jra.length === 0 && predictionData.nar.length === 0)) {
            return (
                <div className="text-center p-8 bg-red-50 rounded-lg border-2 border-red-200 shadow-sm">
                    <div className="flex justify-center mb-4">
                        <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-red-700 mb-2">{formatDate(currentDate)}のレースデータはありません</h2>
                    <p className="text-gray-600 mb-6">
                        指定された日付はレースが開催されないか、まだデータが登録されていません。<br />
                        他の日付のレース予測をお探しください。
                    </p>
                    <Link
                        href={`/races/${getTodayString()}`}
                        className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
                    >
                        本日のレース予測を見る
                    </Link>
                    <div className="mt-8 pt-6 border-t border-red-200 text-left max-w-2xl mx-auto">
                        <h3 className="font-bold text-gray-700 mb-3">ℹ️ 競馬開催スケジュール</h3>
                        <div className="space-y-2 text-sm text-gray-600">
                            <p>• 中央競馬: 主に土日に開催されます。</p>
                            <p>• 地方競馬: 各競馬場により開催日が異なります。</p>
                            <p>• 翌日のレース予測データは、通常、前日の7時頃に更新されます。</p>
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
                <RaceTabs
                    key={`${currentDate}-${initialVenue || 'defaultVenue'}-${initialRaceNumber || 'defaultRace'}`}
                    data={predictionData}
                    initialVenueName={initialVenue}
                    initialRaceNumber={initialRaceNumber}
                />
            </>
        );
    };

    return (
        <div className="container py-4">
            <div className="mb-4">
                <TopHitsDisplay />
            </div>
            <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b-2 border-gray-200 shadow-md mb-4 p-3 sm:p-4">
                <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
                    <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} />
                    <button
                        onClick={(e) => {
                            handleDateChange(getTodayString());
                            e.currentTarget.blur();
                        }}
                        className="bg-primary border-2 border-primary-dark text-white px-4 py-2.5 rounded-lg shadow-md hover:bg-primary-dark transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm sm:text-base font-bold whitespace-nowrap min-h-[44px] active:scale-95"
                    >
                        📅 今日
                    </button>
                </div>
            </div>
            {renderContent()}
        </div>
    );
}
