"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { RaceDayPrediction, SpecialPick, TopPayoutHit, WeeklyGradeRace } from "@/lib/types";
import { RaceTabs } from "@/components/RaceTabs";
import { SpecialPickCard } from "@/components/SpecialPickCard";
import { TopHitsDisplay } from "@/components/TopHitsDisplay";
import { WeeklyGradeRaces } from "@/components/WeeklyGradeRaces";
import { formatDate } from "@/lib/utils";
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { getPredictionsForDate } from "@/lib/api";
import { RaceArticleMeta } from "@/lib/articles";
import DisclaimerAlert from "@/components/DisclaimerAlert";
import { InFeedAd } from "@/components/InFeedAd";
import { RecentRaceReturn } from "@/components/RecentRaceReturn";
import { AffiliateSlot } from "@/components/AffiliateSlot";
import { RacePageBottomNav } from "@/components/RacePageBottomNav";
import { getRaceTopObstructionHeight } from "@/hooks/useRaceSectionNavigation";

// 日付フォーマット検証関数
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
        <div className="mx-auto flex w-full max-w-[300px] items-center justify-between rounded-lg border border-slate-300 bg-white p-0.5 sm:max-w-sm">
            <button
                onClick={(e) => handleDateShift(e, -1)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-slate-100 hover:text-primary"
                aria-label="前日へ"
            >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={currentDate}
                    onChange={handleDateInputChange}
                    className="min-h-[44px] cursor-pointer border-none bg-transparent p-0 text-center font-mono text-sm font-bold text-text-primary focus:ring-0 sm:text-base"
                    aria-label="日付を選択"
                />
            </div>
            <button
                onClick={(e) => handleDateShift(e, 1)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-slate-100 hover:text-primary"
                aria-label="翌日へ"
            >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
    );
};

type RacePageClientProps = {
    initialDate: string;
    initialPredictionData: RaceDayPrediction | null;
    initialSpecialPick?: SpecialPick | null;
    initialTopHits?: TopPayoutHit[];
    weeklyGradeRaces?: WeeklyGradeRace[];
    articlesMeta: RaceArticleMeta[];
    initialVenueName?: string | null;
    initialRaceNumber?: number | null;
};

const getShiftedDate = (dateStr: string, days: number) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().split('T')[0];
};

const getPreferredScrollBehavior = (): ScrollBehavior => (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
);

export default function RacePageClient({
    initialDate,
    initialPredictionData,
    initialSpecialPick,
    initialTopHits,
    weeklyGradeRaces,
    articlesMeta,
    initialVenueName: routeInitialVenueName = null,
    initialRaceNumber: routeInitialRaceNumber = null,
}: RacePageClientProps) {
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(initialPredictionData);
    const [isLoading, setIsLoading] = useState(!initialPredictionData);
    const [error, setError] = useState<string | null>(null);
    const [initialVenue, setInitialVenue] = useState<string | null>(routeInitialVenueName);
    const [initialRaceNumber, setInitialRaceNumber] = useState<number | null>(routeInitialRaceNumber);
    const hasScrolled = useRef(false);
    const isInitialLoad = useRef(true);

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

                if (!data || ((data.jra?.length ?? 0) === 0 && (data.nar?.length ?? 0) === 0)) {
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

        const hasInitialRaceData = Boolean(
            initialPredictionData
            && (
                initialPredictionData.jra.length > 0
                || initialPredictionData.nar.length > 0
            )
        );

        if (hasInitialRaceData && isInitialLoad.current) {
            isInitialLoad.current = false;
            setPredictionData(initialPredictionData);
            setIsLoading(false);
            setError(null);
            return;
        }
        isInitialLoad.current = false;

        fetchData(initialDate);

    }, [initialDate, initialPredictionData]);

    useEffect(() => {
        setInitialVenue(routeInitialVenueName);
        setInitialRaceNumber(routeInitialRaceNumber);
    }, [routeInitialVenueName, routeInitialRaceNumber]);

    useEffect(() => {
        if (!hasScrolled.current && initialVenue && initialRaceNumber && predictionData) {
            const venueExists = [...(predictionData.jra ?? []), ...(predictionData.nar ?? [])].some(
                v => v.venue_name === initialVenue
            );

            if (venueExists) {
                setTimeout(() => {
                    const venueElement = document.getElementById(`venue-${initialVenue}`);
                    if (venueElement) {
                        setTimeout(() => {
                            const raceData = [...(predictionData.jra ?? []), ...(predictionData.nar ?? [])]
                                .find(v => v.venue_name === initialVenue)
                                ?.races.find(r => r.race_number === initialRaceNumber);

                            if (raceData) {
                                const raceElement = document.getElementById(`race-${raceData.id}`);
                                if (raceElement) {
                                    const rect = raceElement.getBoundingClientRect();
                                    const scrollTop = window.scrollY || document.documentElement.scrollTop;
                                    const elementTop = rect.top + scrollTop;
                                    window.scrollTo({
                                        top: Math.max(0, elementTop - getRaceTopObstructionHeight()),
                                        behavior: getPreferredScrollBehavior()
                                    });
                                }
                            }
                        }, 500);
                    }
                    hasScrolled.current = true;
                }, 100);
            }
        }
    }, [initialVenue, initialRaceNumber, predictionData]);

    const handleDateChange = useCallback((newDate: string) => {
        if (newDate && newDate !== currentDate && isValidDateFormat(newDate)) {
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

    const hasNarRaces = (predictionData?.nar?.length ?? 0) > 0;
    const hasRaceData = Boolean(
        predictionData && ((predictionData.jra?.length ?? 0) > 0 || (predictionData.nar?.length ?? 0) > 0)
    );
    const renderContent = ({ showSpecialPick = true }: { showSpecialPick?: boolean } = {}) => {
        if (isLoading) {
            return <RaceTabsSkeleton />;
        }
        if (error || !predictionData || ((predictionData.jra?.length ?? 0) === 0 && (predictionData.nar?.length ?? 0) === 0)) {
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
                        href={`/races/${getTodayString()}`}
                        prefetch={false}
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
                <RaceTabs
                    key={`${currentDate}-${initialVenue ?? 'all'}-${initialRaceNumber ?? 'all'}`}
                    data={predictionData}
                    articlesMeta={articlesMeta}
                    initialVenueName={initialVenue}
                    initialRaceNumber={initialRaceNumber}
                />

                {showSpecialPick && (
                    <div className="mx-2 mt-2">
                        <SpecialPickCard pick={initialSpecialPick} date={currentDate} />
                    </div>
                )}

                <DisclaimerAlert />
            </>
        );
    };

    return (
        <div id="race-page-top" className="race-page-scope mx-auto max-w-6xl py-2 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-4">
            {/* ▼▼▼▼▼【ファーストビュー改善】▼▼▼▼▼ */}
            {/* 従来: 的中ランキング→バナー広告→日付ナビ→レースデータ（ファーストビューを広告と的中ランキングが占有） */}
            <div className="relative z-10 mb-1.5 border-b border-slate-200 bg-slate-50 p-1 sm:mb-3 sm:p-2">
                <div className="flex items-center justify-center gap-1.5 sm:gap-4 flex-wrap">
                    <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} />
                    <button
                        onClick={(e) => {
                            handleDateChange(getTodayString());
                            e.currentTarget.blur();
                        }}
                        className="min-h-[44px] whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-colors duration-150 hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light sm:px-4 sm:py-2.5 sm:text-sm"
                    >
                        今日
                    </button>
                </div>
            </div>

            <RecentRaceReturn className="mb-1.5 sm:mb-3" />

            {weeklyGradeRaces && weeklyGradeRaces.length > 0 && (
                <div className="mb-1.5 sm:mb-3">
                    <WeeklyGradeRaces races={weeklyGradeRaces} predictions={predictionData} compact />
                </div>
            )}

            {renderContent()}

            <div className="mt-1.5 sm:mt-3 mb-1 sm:mb-2">
                <TopHitsDisplay initialHits={initialTopHits} />
            </div>

            <AffiliateSlot
                context="race_after_top_hits"
                raceType={hasNarRaces ? 'nar' : 'jra'}
                selectionKey={currentDate}
                variant="compact"
                className="my-1.5 sm:my-2"
            />

            {hasRaceData && !isLoading && !error && (
                <InFeedAd
                    refreshKey={`race-after-top-hits-${currentDate}`}
                    analyticsPlacement="race_after_top_hits_infeed"
                    className="mt-1.5 sm:mt-2"
                    lazyRootMargin="520px 0px 520px 0px"
                    refreshRootMarginPx={600}
                />
            )}

            <div className="flex justify-center gap-2 sm:gap-3 my-3 sm:my-4">
                <Link
                    href={`/races/${getShiftedDate(currentDate, -1)}`}
                    prefetch={false}
                    className="inline-flex min-h-[44px] max-w-[160px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-[11px] font-bold text-slate-600 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-primary sm:text-[13px]"
                >
                    ← 前日のデータ
                </Link>
                <Link
                    href={`/races/${getShiftedDate(currentDate, 1)}`}
                    prefetch={false}
                    className="inline-flex min-h-[44px] max-w-[160px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-[11px] font-bold text-slate-600 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-primary sm:text-[13px]"
                >
                    翌日のデータ →
                </Link>
            </div>

            {/* SEO・回遊導線 */}
            {/* <section className="mt-1.5 sm:mt-2.5 bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                <div className="flex flex-wrap gap-2 justify-center text-sm text-gray-600">
                    <Link href="/grade-races" className="text-primary hover:underline font-semibold">重賞・G1一覧</Link>
                    <span className="text-slate-300">|</span>
                    <Link href="/courses" className="text-primary hover:underline font-semibold">コース分析</Link>
                    <span className="text-slate-300">|</span>
                    <Link href="/jockeys" className="text-primary hover:underline font-semibold">騎手別成績</Link>
                    <span className="text-slate-300">|</span>
                    <Link href="/about" className="text-primary hover:underline font-semibold">このサイトについて</Link>
                </div>
            </section> */}

            {hasRaceData && !isLoading && !error && (
                <RacePageBottomNav />
            )}
        </div>
    );
}
