"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link';
import { RaceDayPrediction, SpecialPick, TopPayoutHit, WeeklyGradeRace } from "@/lib/types";
import { RaceTabs } from "@/components/RaceTabs";
import { SpecialPickCard } from "@/components/SpecialPickCard";
import { TopHitsDisplay } from "@/components/TopHitsDisplay";
import { WeeklyGradeRaces } from "@/components/WeeklyGradeRaces";
import { formatDate } from "@/lib/utils";
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { getPredictionsForDate } from "@/lib/api";
import { Article } from "@/lib/articles";
import DisclaimerAlert from "@/components/DisclaimerAlert";
import { InFeedAd } from "@/components/InFeedAd";
import { RecentRaceReturn } from "@/components/RecentRaceReturn";
import { AffiliateSlot } from "@/components/AffiliateSlot";

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
        <div className="flex items-center justify-between w-full max-w-[280px] sm:max-w-sm mx-auto bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl p-1 shadow-sm">
            <button
                onClick={(e) => handleDateShift(e, -1)}
                className="p-2 text-text-secondary hover:text-primary hover:bg-slate-100 rounded-md transition-all duration-200"
                aria-label="前日へ"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={currentDate}
                    onChange={handleDateInputChange}
                    className="border-none bg-transparent text-text-primary font-bold text-[15px] sm:text-base focus:ring-0 p-0 text-center font-mono cursor-pointer"
                    aria-label="日付を選択"
                />
            </div>
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
    weeklyGradeRaces?: WeeklyGradeRace[];
    articlesMeta: Omit<Article, 'content'>[];
    initialVenueName?: string | null;
    initialRaceNumber?: number | null;
};

const getShiftedDate = (dateStr: string, days: number) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().split('T')[0];
};

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
    const searchParams = useSearchParams();
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(initialPredictionData);
    const [isLoading, setIsLoading] = useState(!initialPredictionData);
    const [error, setError] = useState<string | null>(null);
    // ▼▼▼▼▼【初期値をsearchParamsから同期的に取得】▼▼▼▼▼
    // 従来: useState(null) → 初回レース切替でkeyが変わりRaceTabs再マウント
    // 変更: searchParamsの値を初期値として使用 → 最初からkeyが安定
    const [initialVenue, setInitialVenue] = useState<string | null>(() => {
        if (routeInitialVenueName) return routeInitialVenueName;
        const venue = searchParams.get('venue');
        return venue ? decodeURIComponent(venue) : null;
    });
    const [initialRaceNumber, setInitialRaceNumber] = useState<number | null>(() => {
        if (routeInitialRaceNumber) return routeInitialRaceNumber;
        const raceStr = searchParams.get('race');
        if (raceStr) {
            const num = parseInt(raceStr, 10);
            return isNaN(num) ? null : num;
        }
        return null;
    });
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
    const hasScrolled = useRef(false);
    const isInitialLoad = useRef(true); // ★ 初回レンダリング判定用

    // ▼▼▼▼▼【二重フェッチ解消】▼▼▼▼▼
    // 従来: initialDateが変わるたびに毎回fetchDataを実行（SSRで取得済みでも再フェッチ）
    // 変更: 初回レンダリング時はSSRで取得した initialPredictionData をそのまま使用。
    //       日付が変わった場合（DateNavigatorでの操作→router.push→再マウント時は
    //       isInitialLoadがtrueにリセットされるため、SSRデータがあればスキップ）。
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
    useEffect(() => {
        const fetchData = async (dateToFetch: string) => {
            // 日付フォーマット検証
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
        if (isValidDateFormat(initialDate)) {
            document.title = `競馬AIデータ分析 | ${formatDate(initialDate)}`;
        }

        // SSRで取得済みのデータがある場合はクライアント側の再取得で上書きしない。
        // React Strict Modeのeffect再実行やローカルCORS差で、正常な初期データが「データなし」に
        // 置き換わるのを防ぐ。
        if (initialPredictionData) {
            isInitialLoad.current = false;
            setPredictionData(initialPredictionData);
            setIsLoading(false);
            setError(null);
            return;
        }
        isInitialLoad.current = false;

        // 日付が変わった場合のみフェッチ実行
        fetchData(initialDate);

    }, [initialDate]);

    useEffect(() => {
        if (routeInitialVenueName || routeInitialRaceNumber) {
            setInitialVenue(routeInitialVenueName);
            setInitialRaceNumber(routeInitialRaceNumber);
            return;
        }

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
    }, [searchParams, routeInitialVenueName, routeInitialRaceNumber]);

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

    const todayStr = getTodayString();
    const hasNarRaces = (predictionData?.nar?.length ?? 0) > 0;

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

                {showSpecialPick && (
                    <div className="mb-2">
                        <SpecialPickCard pick={initialSpecialPick} date={currentDate} />
                    </div>
                )}
                <RaceTabs
                    key={`${currentDate}-${initialVenue ?? 'all'}-${initialRaceNumber ?? 'all'}`}
                    data={predictionData}
                    articlesMeta={articlesMeta}
                    initialVenueName={initialVenue}
                    initialRaceNumber={initialRaceNumber}
                />
            </>
        );
    };

    return (
        <div className="mx-auto max-w-6xl py-4">
            {/* ▼▼▼▼▼【ファーストビュー改善】▼▼▼▼▼ */}
            {/* 従来: 的中ランキング→バナー広告→日付ナビ→レースデータ（ファーストビューを広告と的中ランキングが占有） */}
            {/* 変更: 日付ナビ→レースデータ→的中ランキング→バナー広告（レースデータを最速で表示） */}
            {/* ▲▲▲▲▲【ファーストビュー改善ここまで】▲▲▲▲▲ */}
            {/* ★ここからstickyを削除し、スクロールで自然に消えるようにして画面領域を確保 */}
            <div className="glass mb-2 sm:mb-3 p-1.5 sm:p-3 relative z-10 shadow-sm border-b border-white/40">
                <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
                    <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} />
                    <button
                        onClick={(e) => {
                            handleDateChange(getTodayString());
                            e.currentTarget.blur();
                        }}
                        className="bg-primary text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm hover:bg-primary-dark transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-light text-sm font-bold whitespace-nowrap min-h-[40px] sm:min-h-[44px]"
                    >
                        今日
                    </button>
                </div>
            </div>

            <RecentRaceReturn className="mb-2 sm:mb-3" />

            {/* 🏆 今週の重賞セクション */}
            {weeklyGradeRaces && weeklyGradeRaces.length > 0 && (
                <div className="mb-2 sm:mb-3">
                    <WeeklyGradeRaces races={weeklyGradeRaces} />
                </div>
            )}

            {renderContent()}

            {/* 的中ランキング: レースデータの後に配置 */}
            <div className="mt-2 sm:mt-4 mb-1 sm:mb-3">
                <TopHitsDisplay initialHits={initialTopHits} />
            </div>

            {/* ★ 回遊性向上: 他の日付への導線を追加 */}
            <div className="flex justify-center gap-2 sm:gap-3 my-3 sm:my-4">
                <Link
                    href={`/races/${getShiftedDate(currentDate, -1)}`}
                    className="flex-1 max-w-[160px] inline-flex items-center justify-center px-2 py-2.5 text-[11px] sm:text-[13px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl transition-all duration-200 min-h-[44px] hover:bg-slate-50 hover:text-primary hover:border-slate-300 hover:shadow-sm"
                >
                    ← 前日のデータ
                </Link>
                <Link
                    href={`/races/${getShiftedDate(currentDate, 1)}`}
                    className="flex-1 max-w-[160px] inline-flex items-center justify-center px-2 py-2.5 text-[11px] sm:text-[13px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl transition-all duration-200 min-h-[44px] hover:bg-slate-50 hover:text-primary hover:border-slate-300 hover:shadow-sm"
                >
                    翌日のデータ →
                </Link>
            </div>

            {/* ★ CTR改善: 的中ランキング後の広告をInFeedAdに変更 */}
            {/* バナー広告よりコンテンツカード風の方がCTRが高い */}
            <AffiliateSlot
                context="race_after_top_hits"
                raceType={hasNarRaces ? 'nar' : 'jra'}
                selectionKey={currentDate}
                fallback={<InFeedAd refreshKey={`bottom-${currentDate}`} analyticsPlacement="race_after_top_hits" />}
            />

            {/* ★ 回遊性改善: 分析記事への導線を追加 */}
            {/* データ根拠: 記事ページのエンゲージメント時間はレースページの3-10倍
              → 広告のViewable率が高い → RPM向上
              レースページ: 収益効率 $0.0001-0.0006/session
              記事ページ(about-ai等): 収益効率 $0.0025/session（4-25倍） */}
            {articlesMeta && articlesMeta.length > 0 && (
                <section className="mt-3 sm:mt-4 mb-2 sm:mb-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-1.5 h-5 bg-primary rounded-full"></span>
                            関連する分析記事
                        </h2>
                    </div>
                    <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {articlesMeta.slice(0, 3).map((article) => (
                            <Link
                                key={article.slug}
                                href={`/articles/${article.slug}`}
                                className="group flex sm:flex-col gap-3 sm:gap-0 items-start p-2 sm:p-0 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <div className="shrink-0 w-16 h-16 sm:w-full sm:h-28 rounded-lg sm:rounded-b-none overflow-hidden bg-slate-100 relative">
                                    {article.eyecatch && (
                                        <img
                                            src={article.eyecatch}
                                            alt={article.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 sm:p-3">
                                    <span className="inline-block text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded mb-1">
                                        {article.category}
                                    </span>
                                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                                        {article.title}
                                    </h3>
                                </div>
                            </Link>
                        ))}
                    </div>
                    <div className="px-4 pb-3 text-center">
                        <Link
                            href="/articles"
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark transition-colors"
                        >
                            すべての記事を見る
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                </section>
            )}

            {/* サイト紹介テキスト（SEO・AdSense対策：重複回避のため最小限に） */}
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
