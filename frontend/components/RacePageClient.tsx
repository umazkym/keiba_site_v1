"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from 'next/link';
import { RaceDayPrediction } from "@/lib/types";
import { RaceTabs } from "@/components/RaceTabs";
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { getPredictionsForDate } from "@/lib/api";
import { RaceArticleMeta } from "@/lib/articles";
import { InFeedAd } from "@/components/InFeedAd";
import { GuideHorse } from "@/components/BrandLogo";
import { LineIcon } from "@/components/LineIcon";
import { AffiliateSlot } from "@/components/AffiliateSlot";
import { RacePageBottomNav } from "@/components/RacePageBottomNav";
import type { RaceSelectorLink } from '@/components/RaceSelector';
import { useRaceRevenueExperiment } from "@/hooks/useRaceRevenueExperiment";

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


type RacePageClientProps = {
    initialDate: string;
    initialPredictionData: RaceDayPrediction | null;
    articlesMeta: RaceArticleMeta[];
    initialVenueName?: string | null;
    initialRaceNumber?: number | null;
    initialRaceLinks?: RaceSelectorLink[];
    // サーバーで描いたレースの見出し（RaceHead）。コース図のデータをクライアントに送らないため props で受け取る
    header?: ReactNode;
};

const FETCH_ERROR_MESSAGE = "データの取得に失敗しました。時間をおいて再度お試しください。";

const getShiftedDate = (dateStr: string, days: number) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().split('T')[0];
};

export default function RacePageClient({
    initialDate,
    initialPredictionData,
    articlesMeta,
    initialVenueName: routeInitialVenueName = null,
    initialRaceNumber: routeInitialRaceNumber = null,
    initialRaceLinks,
    header,
}: RacePageClientProps) {
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [predictionData, setPredictionData] = useState<RaceDayPrediction | null>(initialPredictionData);
    const [isLoading, setIsLoading] = useState(!initialPredictionData);
    const [error, setError] = useState<string | null>(null);
    const [initialVenue, setInitialVenue] = useState<string | null>(routeInitialVenueName);
    const [initialRaceNumber, setInitialRaceNumber] = useState<number | null>(routeInitialRaceNumber);
    const isInitialLoad = useRef(true);
    const raceRevenueExperiment = useRaceRevenueExperiment();

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
                setError(FETCH_ERROR_MESSAGE);
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

    // 以前は読み込み直後に選んだレースの位置まで自動でスクロールしていた（全会場を並べていた頃の日付ページの名残り）。
    // 2026-09-24 にレース詳細の見出し（RaceHead・h1）を上に置いてから、見出しが画面の外へ送られて見えなくなっていたため、
    // 読み込み時は動かさない（2026-09-25）。レースを切り替えたときの位置合わせは RaceTabs が行う。

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

    const renderContent = () => {
        if (isLoading) {
            return <RaceTabsSkeleton />;
        }
        if (error || !predictionData || ((predictionData.jra?.length ?? 0) === 0 && (predictionData.nar?.length ?? 0) === 0)) {
            // 見本（開催のない日）と同じ形：案内役の馬・1行の見出しと説明・主と副のボタン（開催日ボードの空の表示と同じ）
            const isFetchError = error === FETCH_ERROR_MESSAGE;
            return (
                <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-6 text-center md:py-8">
                    <GuideHorse size={110} mood={isFetchError ? 'look' : 'sleep'} />
                    <h2 className="text-[20px] font-extrabold text-slate-900">
                        {isFetchError ? 'データを読み込めませんでした' : (
                            <>
                                <span className="inline-block">この日のレースは</span>
                                <span className="inline-block">まだありません</span>
                            </>
                        )}
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-700">
                        {isFetchError ? '時間をおいて、もう一度開いてください。' : '開催がないか、データの公開前です。'}
                    </p>
                    <div className="flex w-full max-w-md flex-col gap-2">
                        <Link href={`/races/${getTodayString()}`} prefetch={false} className="ui-btn ui-btn--primary ui-btn--full">
                            本日のレース分析へ
                            <LineIcon name="arrowR" size={18} className="block shrink-0" />
                        </Link>
                        <Link href="/keiba-data" prefetch={false} className="ui-btn ui-btn--secondary ui-btn--full">
                            過去のデータを調べる
                            <LineIcon name="chevR" size={18} className="block shrink-0" />
                        </Link>
                    </div>
                </section>
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
                    initialRaceLinks={initialRaceLinks}
                    engagedAdSlot={raceRevenueExperiment.shouldRenderEngagedSlot
                        ? raceRevenueExperiment.engagedAdSlot
                        : undefined}
                />

                {/* 以前はここに「その日の注目馬」（別のレースのAI偏差値1位）と免責の警告帯を置いていた。
                    レースの詳細の中に別レースの馬が見出しなしで挟まり、このレースの内容と誤読されるため外した（2026-09-25）。
                    注目馬は開催日のボードとホームに、免責はフッターの注記にある。 */}
            </>
        );
    };

    return (
        <div
            id="race-page-top"
            className="race-page-scope site-shell-wide sm:py-2 lg:pb-4"
            data-race-revenue-variant={raceRevenueExperiment.ready ? raceRevenueExperiment.variant : 'pending'}
            data-race-revenue-eligible={raceRevenueExperiment.eligible ? 'true' : 'false'}
        >
            {header}

            {renderContent()}

            {/* 以前はここに「近日の重賞」と「高配当的中ランキング」（0件のときは「実績はありませんでした」）を置いていた。
                見本に無く、このレースと関係しないため外した（開催日ボード・ホームにも置かない。2026-09-25） */}

            <AffiliateSlot
                context="race_after_top_hits"
                raceType={hasNarRaces ? 'nar' : 'jra'}
                selectionKey={currentDate}
                variant="compact"
                className="mt-2.5 sm:my-2"
            />

            {hasRaceData && !isLoading && !error && raceRevenueExperiment.shouldRenderLegacySlot && (
                <InFeedAd
                    refreshKey={`race-after-top-hits-${currentDate}`}
                    analyticsPlacement="race_after_top_hits_infeed"
                    analyticsVariant={raceRevenueExperiment.eligible ? 'legacy' : undefined}
                    className="mt-2.5 sm:mt-2"
                    lazyRootMargin="520px 0px 520px 0px"
                    refreshRootMarginPx={600}
                />
            )}

            <nav className="mt-2.5 grid grid-cols-3 gap-2 sm:my-4 sm:gap-3" aria-label="日付の移動">
                <Link href={`/races/${getShiftedDate(currentDate, -1)}`} prefetch={false} className="ui-btn ui-btn--secondary px-2 text-[13px] sm:text-sm">
                    ← 前日
                </Link>
                <Link href={`/races/${currentDate}`} prefetch={false} className="ui-btn ui-btn--secondary px-2 text-[13px] sm:text-sm">
                    この日の全レース
                </Link>
                <Link href={`/races/${getShiftedDate(currentDate, 1)}`} prefetch={false} className="ui-btn ui-btn--secondary px-2 text-[13px] sm:text-sm">
                    翌日 →
                </Link>
            </nav>

            {/* SEO・回遊導線 */}
            {/* <section className="mt-1.5 sm:mt-2.5 bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                <div className="flex flex-wrap gap-2 justify-center text-sm text-slate-600">
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
