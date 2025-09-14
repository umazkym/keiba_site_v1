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

const DateNavigator = ({
    currentDate,
    onDateChange,
}: {
    currentDate: string;
    onDateChange: (newDate: string) => void;
}) => {
    const handleDateShift = useCallback((e: React.MouseEvent<HTMLButtonElement>, days: number) => {
        const [year, month, day] = currentDate.split("-").map(Number);
        // タイムゾーンの問題を避けるため、UTCで日付を計算
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
                onChange={handleDateInputChange}
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
    const searchParams = useSearchParams();
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(initialPredictionData);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(initialPredictionData ? null : "指定された日付のレースデータはありませんでした。");
    const [initialVenue, setInitialVenue] = useState<string | null>(null);
    const [initialRaceNumber, setInitialRaceNumber] = useState<number | null>(null);
    const hasScrolled = useRef(false);

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

    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // 自動スクロールの原因となる scrollIntoView をコメントアウトします
    useEffect(() => {
        if (!hasScrolled.current && initialVenue && initialRaceNumber && predictionData) {
            const venueExists = [...predictionData.jra, ...predictionData.nar].some(
                v => v.venue_name === initialVenue
            );
            
            if (venueExists) {
                setTimeout(() => {
                    const venueElement = document.getElementById(`venue-${initialVenue}`);
                    if (venueElement) {
                        // venueElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        
                        setTimeout(() => {
                            const raceData = [...predictionData.jra, ...predictionData.nar]
                                .find(v => v.venue_name === initialVenue)
                                ?.races.find(r => r.race_number === initialRaceNumber);
                            
                            if (raceData) {
                                const raceElement = document.getElementById(`race-${raceData.id}`);
                                if (raceElement) {
                                    // raceElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }
                        }, 500);
                    }
                    hasScrolled.current = true;
                }, 100);
            }
        }
    }, [initialVenue, initialRaceNumber, predictionData]);
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    const handleDateChange = useCallback((newDate: string) => {
        if (newDate && newDate !== currentDate) {
            setIsLoading(true);
            hasScrolled.current = false;
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

    const todayStr = getTodayString();

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
                    <SpecialPickCard date={todayStr} />
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
            <div className="sticky top-16 z-40 bg-white/80 backdrop-blur-sm border-b shadow-md mb-4 p-2">
                <div className="flex items-center justify-center gap-4">
                    <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} />
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
            </div>
            {renderContent()}
        </div>
    );
}