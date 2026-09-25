"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from 'next/link';
import { RaceDayPrediction, TopPayoutHit, WeeklyGradeRace } from "@/lib/types";
import { RaceTabs } from "@/components/RaceTabs";
import { TopHitsDisplay } from "@/components/TopHitsDisplay";
import { WeeklyGradeRaces } from "@/components/WeeklyGradeRaces";
import { formatDate } from "@/lib/utils";
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";
import { getPredictionsForDate } from "@/lib/api";
import { RaceArticleMeta } from "@/lib/articles";
import { InFeedAd } from "@/components/InFeedAd";
import { GuideHorse } from "@/components/BrandLogo";
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
    initialTopHits?: TopPayoutHit[];
    weeklyGradeRaces?: WeeklyGradeRace[];
    articlesMeta: RaceArticleMeta[];
    initialVenueName?: string | null;
    initialRaceNumber?: number | null;
    initialRaceLinks?: RaceSelectorLink[];
    // サーバーで描いたレースの見出し（RaceHead）。コース図のデータをクライアントに送らないため props で受け取る
    header?: ReactNode;
};

const getShiftedDate = (dateStr: string, days: number) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().split('T')[0];
};

export default function RacePageClient({
    initialDate,
    initialPredictionData,
    initialTopHits,
    weeklyGradeRaces,
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
    // 「近日の重賞」から、いま開いているレースそのものを外す（自分自身へのリンクになるため）
    const otherGradeRaces = (weeklyGradeRaces ?? []).filter((race) => !(
        race.race_date === currentDate
        && race.venue_name === routeInitialVenueName
        && race.race_number === routeInitialRaceNumber
    ));

    const renderContent = () => {
        if (isLoading) {
            return <RaceTabsSkeleton />;
        }
        if (error || !predictionData || ((predictionData.jra?.length ?? 0) === 0 && (predictionData.nar?.length ?? 0) === 0)) {
            return (
                <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
                    <GuideHorse size={110} mood="sleep" />
                    <h2 className="text-[20px] font-extrabold text-slate-900">{formatDate(currentDate)}のレースデータはありません</h2>
                    <p className="max-w-xl text-sm leading-relaxed text-slate-700">
                        開催がないか、まだデータが登録されていません。翌日のレース分析は、通常前日の7時ごろに公開します。
                    </p>
                    <Link href={`/races/${getTodayString()}`} prefetch={false} className="ui-btn ui-btn--primary">
                        本日のレース分析を見る
                    </Link>
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
                    注目馬は開催日のボードとホームに、免責は出走表の直後の1文（DisclaimerNote）にある。 */}
            </>
        );
    };

    return (
        <div
            id="race-page-top"
            className="race-page-scope site-shell-wide py-1 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:py-2 lg:pb-4"
            data-race-revenue-variant={raceRevenueExperiment.ready ? raceRevenueExperiment.variant : 'pending'}
            data-race-revenue-eligible={raceRevenueExperiment.eligible ? 'true' : 'false'}
        >
            {header}

            {renderContent()}

            {otherGradeRaces.length > 0 && (
                <div className="mt-2 sm:mt-3">
                    <WeeklyGradeRaces races={otherGradeRaces} predictions={predictionData} compact />
                </div>
            )}

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

            {hasRaceData && !isLoading && !error && raceRevenueExperiment.shouldRenderLegacySlot && (
                <InFeedAd
                    refreshKey={`race-after-top-hits-${currentDate}`}
                    analyticsPlacement="race_after_top_hits_infeed"
                    analyticsVariant={raceRevenueExperiment.eligible ? 'legacy' : undefined}
                    className="mt-1.5 sm:mt-2"
                    lazyRootMargin="520px 0px 520px 0px"
                    refreshRootMarginPx={600}
                />
            )}

            <nav className="my-3 grid grid-cols-3 gap-2 sm:my-4 sm:gap-3" aria-label="日付の移動">
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
