"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { RaceDayPrediction, SpecialPick, TopPayoutHit } from "@/lib/types";
import { RaceTabs } from "@/components/RaceTabs";
import { SpecialPickCard } from "@/components/SpecialPickCard";
import { TopHitsDisplay } from "@/components/TopHitsDisplay";
import { formatDate } from "@/lib/utils";
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { getPredictionsForDate } from "@/lib/api";
import { Article } from "@/lib/articles";
import DisclaimerAlert from "@/components/DisclaimerAlert";
import { AdUnit } from "@/components/AdUnit";

// 日付フォーマット検証
const isValidDateFormat = (dateStr: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const date = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(date.getTime())) return false;
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateFromParts = new Date(Date.UTC(year, month - 1, day));
    return (
        dateFromParts.getUTCFullYear() === year &&
        dateFromParts.getUTCMonth() === month - 1 &&
        dateFromParts.getUTCDate() === day
    );
};

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
        if (newDate) onDateChange(newDate);
    }, [onDateChange]);

    return (
        <div className="flex items-center justify-between w-full max-w-[280px] sm:max-w-sm mx-auto bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl p-1 shadow-sm">
            <button
                onClick={(e) => handleDateShift(e, -1)}
                className="p-2 text-text-secondary hover:text-primary hover:bg-slate-100 rounded-md transition-all duration-200"
                aria-label="前日へ"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <input
                type="date"
                value={currentDate}
                onChange={handleDateInputChange}
                className="border-none bg-transparent text-text-primary font-bold text-[15px] sm:text-base focus:ring-0 p-0 text-center font-mono cursor-pointer"
                aria-label="日付を選択"
            />
            <button
                onClick={(e) => handleDateShift(e, 1)}
                className="p-2 text-text-secondary hover:text-primary hover:bg-slate-100 rounded-md transition-all duration-200"
                aria-label="翌日へ"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
    );
};

type RacePageClientProps = {
    initialDate: string;
    initialPredictionData: RaceDayPrediction | null;
    initialSpecialPick?: SpecialPick | null;
    initialTopHits?: TopPayoutHit[];
    articlesMeta: Omit<Article, 'content'>[];
};

export default function RacePageClient({
    initialDate,
    initialPredictionData,
    initialSpecialPick,
    initialTopHits,
    articlesMeta,
}: RacePageClientProps) {
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(initialPredictionData);
    const [isLoading, setIsLoading] = useState(!initialPredictionData);
    const [error, setError] = useState<string | null>(null);

    // ============================================================
    // venue / race の初期値はクライアントサイドのみで読み取る
    // useSearchParams() を使わないことで動的レンダリングを回避
    // SSR時は null → クライアントマウント後に window.location.search から取得
    // ============================================================
    const [initialVenue, setInitialVenue] = useState<string | null>(null);
    const [initialRaceNumber, setInitialRaceNumber] = useState<number | null>(null);

    const hasScrolled = useRef(false);
    const isInitialLoad = useRef(true);

    // クライアントマウント時にURLパラメータを一度だけ読む
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const venue = params.get('venue');
        const raceStr = params.get('race');

        if (venue) setInitialVenue(decodeURIComponent(venue));
        if (raceStr) {
            const num = parseInt(raceStr, 10);
            if (!isNaN(num)) setInitialRaceNumber(num);
        }
    }, []); // マウント時1回のみ

    // 日付変更時のデータフェッチ
    useEffect(() => {
        const fetchData = async (dateToFetch: string) => {
            if (!isValidDateFormat(dateToFetch)) {
                setError("無効な日付形式です。YYYY-MM-DD形式で指定してください。");
                setIsLoading(false);
                return;
            }
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
        document.title = `競馬AIデータ分析 | ${formatDate(initialDate)}`;

        // 初回かつSSRデータがある場合はスキップ
        if (isInitialLoad.current && initialPredictionData) {
            isInitialLoad.current = false;
            setPredictionData(initialPredictionData);
            setIsLoading(false);
            return;
        }
        isInitialLoad.current = false;
        fetchData(initialDate);
    }, [initialDate]); // eslint-disable-line react-hooks/exhaustive-deps

    // 日付ナビゲーション: 日付変更はページ遷移（router.push）が必要
    // ISRページのHTMLを正しく取得するため、ここだけは router.push を維持する
    const handleDateChange = useCallback((newDate: string) => {
        if (newDate && newDate !== currentDate) {
            hasScrolled.current = false;
            // venue/race の初期値をリセット（新しい日付ではURL上に存在しない）
            setInitialVenue(null);
            setInitialRaceNumber(null);
            router.push(`/races/${newDate}`);
        }
    }, [currentDate, router]);

    const getTodayString = () => {
        const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
        return today.toISOString().split("T")[0];
    };
    const todayStr = getTodayString();

    const renderContent = () => {
        if (isLoading) return <RaceTabsSkeleton />;

        if (error || !predictionData || (predictionData.jra.length === 0 && predictionData.nar.length === 0)) {
            return (
                <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200 shadow-sm">
                    <div className="flex justify-center mb-4">
                        <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-red-700 mb-2">{formatDate(currentDate)}のレースデータはありません</h2>
                    <p className="text-gray-600 mb-6">
                        指定された日付はレースが開催されないか、まだデータが登録されていません。<br />
                        他の日付のレースデータをお探しください。
                    </p>
                    <Link
                        href={`/races/${todayStr}`}
                        className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg shadow-sm transition-colors"
                    >
                        本日のレース分析を見る
                    </Link>
                    <div className="mt-8 pt-6 border-t border-red-200 text-left max-w-2xl mx-auto">
                        <h3 className="font-bold text-gray-700 mb-3">競馬開催スケジュール</h3>
                        <div className="space-y-2 text-sm text-gray-600">
                            <p>• 中央競馬: 主に土日に開催されます。</p>
                            <p>• 地方競馬: 各競馬場により開催日が異なります。</p>
                            <p>• 翌日のレース分析データは、通常、前日の7時頃に更新されます。</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <>
                <DisclaimerAlert />
                <AdUnit slot="1489598374" placement="inline" refreshKey={`inarticle-${currentDate}`} />
                <div className="mb-2">
                    <SpecialPickCard pick={initialSpecialPick} date={currentDate} />
                </div>
                <RaceTabs
                    key={currentDate}
                    data={predictionData}
                    articlesMeta={articlesMeta}
                    initialVenueName={initialVenue}
                    initialRaceNumber={initialRaceNumber}
                />
            </>
        );
    };

    return (
        <div className="py-4">
            <div className="glass mb-2 sm:mb-3 p-1.5 sm:p-3 relative z-10 shadow-sm border-b border-white/40">
                <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
                    <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} />
                    <button
                        onClick={(e) => {
                            handleDateChange(todayStr);
                            e.currentTarget.blur();
                        }}
                        className="bg-primary text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm hover:bg-primary-dark transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm font-bold whitespace-nowrap min-h-[40px] sm:min-h-[44px]"
                    >
                        今日
                    </button>
                </div>
            </div>

            {renderContent()}

            <div className="mt-2 sm:mt-4 mb-1 sm:mb-3">
                <TopHitsDisplay initialHits={initialTopHits} />
            </div>
            <AdUnit slot="8529703346" placement="inline" refreshKey={`banner-${currentDate}`} className="my-2 sm:my-4" />
            <section className="mt-2 sm:mt-3 bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
                <p className="text-sm text-gray-600">
                    より詳しいAIデータ分析の仕組みや、サイトの使い方は
                    <Link href="/about" className="text-primary hover:underline font-semibold mx-1">運営者情報・このサイトについて</Link>
                    をご覧ください。
                </p>
            </section>
        </div>
    );
}
