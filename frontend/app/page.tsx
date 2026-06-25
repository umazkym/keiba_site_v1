import Link from 'next/link';
import type { ReactNode } from 'react';
import {
    BarChart3,
    Gauge,
    LineChart,
    ListChecks,
    Swords,
} from 'lucide-react';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { WeeklyGradeRaces } from '@/components/WeeklyGradeRaces';
import { RecentRaceReturn } from '@/components/RecentRaceReturn';
import { HomeTodayVenues } from '@/components/HomeTodayVenues';
import { getSpecialPick, getPredictionsForDate, getWeeklyGradeRaces, getTopPayoutHits } from '@/lib/api';
import { getLatestArticles, getAllArticles } from '../lib/articles';

import DisclaimerAlert from '@/components/DisclaimerAlert';
import { AdUnit } from '@/components/AdUnit';
import { NativeCardAd } from '@/components/NativeCardAd';
import type { Metadata } from 'next';
import type { RaceDayPrediction } from '@/lib/types';
import { shouldSuppressAdsInDevelopment } from '@/lib/ad-config';
import { HomeRaceEntryLink } from '@/components/HomeRaceEntryLink';

// ISR: データ更新は1日2〜3回（06:00, 13:30 JST）のバッチ処理のため、
// 30分間キャッシュでも十分な鮮度を維持しつつ、Origin Transfer/CPUを大幅削減。
// stale-while-revalidate方式: キャッシュ期間中もユーザーにはページが表示され、
// バックグラウンドで再検証が行われるため「何も見れない」障害を防止する。
export const revalidate = 1800;

const siteDescription = "競馬データ分析サイト。中央・地方の全レースをAIが無料分析。馬場状態の勝率影響、騎手の得意コース、枠順・距離適性、馬体重増減と成績の関係をデータで解説。登録不要で今すぐ使えます。";

export const metadata: Metadata = {
    title: "UMA-FREE | 競馬データ分析・統計情報サイト",
    description: siteDescription,
    openGraph: {
        title: "UMA-FREE | AI競馬データ分析・統計情報サイト",
        description: siteDescription,
        url: 'https://uma-free.com',
        siteName: 'UMA-FREE',
        locale: 'ja_JP',
        type: 'website',
    },
    alternates: {
        canonical: '/',
    },
};

const homepageFaqItems = [
    {
        question: '本当に無料ですか？',
        answer: 'はい。すべてのデータ分析情報が完全無料です。登録やメール入力は一切不要です。',
    },
    {
        question: 'データはいつ更新されますか？',
        answer: '毎日午前7時頃を目安に、前日の結果と当日の分析データを更新しています。',
    },
    {
        question: '分析の精度はどのくらいですか？',
        answer: '過去レースの統計データをもとに算出しているため、実際の結果とは異なる場合があります。サイト内の高配当的中ランキングでは、過去の的中実績を公開しています。',
    },
    {
        question: 'モバイルでも使えますか？',
        answer: 'はい。PC・スマートフォン・タブレットすべてのデバイスに対応しています。',
    },
];

const getTodayString = () => {
    const now = new Date();
    const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    return jstDate.toISOString().split('T')[0];
};

const formatShortDate = (date: string) => {
    const [, month, day] = date.split('-');
    if (!month || !day) return date;
    return `${Number(month)}/${Number(day)}`;
};

const getRaceDaySummary = (predictions: RaceDayPrediction | null, date: string) => {
    const jraVenues = predictions?.jra ?? [];
    const narVenues = predictions?.nar ?? [];
    const venues = [...jraVenues, ...narVenues];
    const raceCount = venues.reduce((total, venue) => total + venue.races.length, 0);
    return {
        venueCount: venues.length,
        raceCount,
    };
};

const FeaturePreviewCard = ({
    title,
    label,
    description,
    icon,
    children,
}: {
    title: string;
    label: string;
    description: string;
    icon: ReactNode;
    children: ReactNode;
}) => (
    <div
        className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3"
    >
        <div className="mb-2 flex items-start gap-2 sm:mb-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 sm:h-8 sm:w-8">
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400">{label}</p>
                <p className="truncate text-xs font-bold text-slate-900 sm:text-[13px]">{title}</p>
            </div>
        </div>
        <div className="mb-2 min-h-[54px] sm:mb-3 sm:min-h-[76px]">{children}</div>
        <p className="mt-auto text-[10px] leading-[1.55] text-slate-500 sm:text-[11px] sm:leading-relaxed">{description}</p>
    </div>
);

const AnalysisFeatures = () => (
    <section>
        <h2 className="sec-title">
            <span className="bar bg-secondary"></span>
            本サイト独自の分析データ
        </h2>

        <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FeaturePreviewCard
                label="独自指標"
                title="AI偏差値"
                icon={<Gauge className="h-4 w-4" />}
                description="過去走・適性・展開力を独自アルゴリズムで数値化し、出走全頭を一覧で比較できます"
            >
                <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>上位候補</span><span>偏差値</span>
                    </div>
                    <div className="h-1.5 sm:h-2 rounded-full bg-slate-100"><div className="h-1.5 sm:h-2 w-[88%] rounded-full bg-blue-600" /></div>
                    <div className="h-1.5 sm:h-2 rounded-full bg-slate-100"><div className="h-1.5 sm:h-2 w-[72%] rounded-full bg-slate-500" /></div>
                    <div className="h-1.5 sm:h-2 rounded-full bg-slate-100"><div className="h-1.5 sm:h-2 w-[61%] rounded-full bg-amber-500" /></div>
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                label="馬同士の直接比較"
                title="対戦成績"
                icon={<Swords className="h-4 w-4" />}
                description="出走馬同士の過去の直接対決をマトリクスで表示しています"
            >
                <div className="grid grid-cols-3 gap-1 text-center text-[10px] sm:gap-1.5 sm:text-[11px] font-bold">
                    {['+2', '0', '-1', '+1', '+3', '0', '-2', '+1', '+2'].map((value, index) => (
                        <span
                            key={`${value}-${index}`}
                            className={`rounded-md py-1 sm:py-1.5 ${value.startsWith('+') ? 'bg-emerald-50 text-emerald-700' : value.startsWith('-') ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                            {value}
                        </span>
                    ))}
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                label="レース展開"
                title="脚質予測"
                icon={<LineChart className="h-4 w-4" />}
                description="各コーナーでの隊列をシミュレーションし、展開の有利不利を確認できます"
            >
                <div className="flex h-[54px] sm:h-[74px] items-end gap-1.5 rounded-lg bg-slate-50 px-2 sm:px-3 pb-1.5 sm:pb-2 pt-2 sm:pt-3">
                    {[68, 42, 74, 52, 35].map((height, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center justify-end gap-1">
                            <div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${height}%` }} />
                            <span className="text-[9px] font-semibold text-slate-400">{index + 1}C</span>
                        </div>
                    ))}
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                label="コース別データ"
                title="枠順傾向"
                icon={<BarChart3 className="h-4 w-4" />}
                description="コース・距離・馬場状態ごとの枠順別勝率を集計しています"
            >
                <div className="space-y-1.5">
                    {[82, 54, 68, 40].map((width, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <span className="w-7 text-[10px] font-semibold text-slate-400">{index + 1}枠</span>
                            <div className="h-1.5 sm:h-2 flex-1 rounded-full bg-slate-100">
                                <div className="h-1.5 sm:h-2 rounded-full bg-amber-500" style={{ width: `${width}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                label="テキスト解説"
                title="AIレース展望"
                icon={<ListChecks className="h-4 w-4" />}
                description="展開予想・適性評価・リスク要因をテキストで解説しています"
            >
                <div className="space-y-1 rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600 sm:space-y-1.5 sm:p-2.5">
                    <div className="h-1.5 w-[92%] rounded-full bg-slate-300" />
                    <div className="h-1.5 w-[74%] rounded-full bg-slate-300" />
                    <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1">
                        <span className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-blue-700">展開</span>
                        <span className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-emerald-700">適性</span>
                        <span className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-amber-700">リスク</span>
                    </div>
                </div>
            </FeaturePreviewCard>
        </div>
    </section>
);

const getFormattedUpdateDate = () => {
    const now = new Date();
    const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const month = jstDate.getMonth() + 1;
    const day = jstDate.getDate();
    return `${month}/${day} 7:00頃更新`;
};

const getVenueNamesString = (predictions: RaceDayPrediction | null) => {
    const jraVenues = predictions?.jra?.map(v => v.venue_name) ?? [];
    const narVenues = predictions?.nar?.map(v => v.venue_name) ?? [];
    const venues = [...jraVenues, ...narVenues];
    if (venues.length === 0) return "";
    return `本日開催の${venues.join('・')}`;
};

type HeroDataCardProps = {
    title: string;
    description: string;
    icon: ReactNode;
    accentClass: string;
    children: ReactNode;
};

const HeroDataCard = ({ title, description, icon, accentClass, children }: HeroDataCardProps) => (
    <div className="min-w-0 rounded-lg bg-white p-2 text-left shadow-sm h-full flex flex-col justify-between">
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${accentClass}`}>
                {icon}
            </span>
            <div className="min-w-0">
                <div className="truncate text-[11px] font-bold leading-none text-slate-950 sm:text-xs">{title}</div>
                <div className="mt-0.5 truncate text-[9px] font-semibold leading-none text-slate-500">{description}</div>
            </div>
        </div>
        <div className="rounded-md bg-slate-50 p-1.5 mt-auto h-[38px] flex items-center justify-center w-full">{children}</div>
    </div>
);

const getCategoryBadgeClass = (category: string) => {
    switch (category) {
        case '重賞':
        case 'G1':
        case 'G2':
        case 'G3':
            return 'bg-amber-50 text-amber-700 border border-amber-200/50';
        case '騎手':
            return 'bg-purple-50 text-purple-700 border border-purple-200/50';
        case 'コース':
        case 'コース分析':
            return 'bg-emerald-50 text-emerald-700 border border-emerald-200/50';
        default:
            return 'bg-blue-50 text-blue-700 border border-blue-200/50';
    }
};

export default async function HomePage() {
    const todayStr = getTodayString();
    const [specialPick, predictions, weeklyGradeRaces, topHits] = await Promise.all([
        getSpecialPick(todayStr).catch(e => {
            console.error("Failed to fetch special pick:", e);
            return null;
        }),
        getPredictionsForDate(todayStr).catch(e => {
            console.error("Failed to fetch predictions:", e);
            return null;
        }),
        getWeeklyGradeRaces().catch(e => {
            console.error("Failed to fetch weekly grade races:", e);
            return [];
        }),
        getTopPayoutHits().catch(e => {
            console.error("Failed to fetch top hits:", e);
            return [];
        })
    ]);

    const latestArticles = getLatestArticles(6);
    const totalArticles = getAllArticles().length;
    const raceDaySummary = getRaceDaySummary(predictions, todayStr);

    return (
        <div className="space-y-4">
            {/* ── 1. 最近確認したレース ── */}
            <RecentRaceReturn />

            {/* ── 2. ヒーローとG1重賞 ── */}
            <div className="hero-grid">
                {/* ヒーローセクション */}
                <section className="hero card rounded-xl">
                    <span className="update font-extrabold rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/95 backdrop-blur-sm inline-flex items-center gap-1.5 mb-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {getFormattedUpdateDate()}
                    </span>
                    <h1 className="text-white font-extrabold tracking-tight leading-tight !text-[17px] sm:!text-[24px] mb-2">
                        {raceDaySummary.venueCount > 0
                            ? <>{getVenueNamesString(predictions)}<br />全{raceDaySummary.raceCount}レース分析公開中</>
                            : <>今日のレース分析を<br />無料で確認</>
                        }
                    </h1>
                    <p className="text-slate-300 text-xs sm:text-base leading-relaxed pb-2 mb-4 max-w-xl">
                        展開・対戦成績・枠順傾向をひと目で確認。登録不要で中央・地方の分析データを毎日無料で確認できます。
                    </p>
                    <div className="mb-4 grid w-full grid-cols-2 gap-2 rounded-xl sm:grid-cols-4 sm:gap-2.5">
                        <HeroDataCard
                            title="AI偏差値"
                            description="出走馬の能力をスコア化"
                            icon={<Gauge className="h-3.5 w-3.5" />}
                            accentClass="bg-blue-50 text-blue-700"
                        >
                            <div className="space-y-1 w-full">
                                <span className="block h-1.5 w-[88%] rounded-full bg-blue-600" />
                                <span className="block h-1.5 w-[64%] rounded-full bg-amber-400" />
                                <span className="block h-1.5 w-[72%] rounded-full bg-slate-300" />
                            </div>
                        </HeroDataCard>

                        <HeroDataCard
                            title="対戦成績"
                            description="過去の直接対決での勝敗比較"
                            icon={<Swords className="h-3.5 w-3.5" />}
                            accentClass="bg-indigo-50 text-indigo-700"
                        >
                            <div className="grid grid-cols-3 gap-1 text-center text-[9px] font-bold w-full">
                                <span className="rounded bg-emerald-50 py-0.5 text-emerald-700">+2</span>
                                <span className="rounded bg-slate-100 py-0.5 text-slate-500">0</span>
                                <span className="rounded bg-rose-50 py-0.5 text-rose-700">-1</span>
                                <span className="rounded bg-slate-100 py-0.5 text-slate-500">0</span>
                                <span className="rounded bg-emerald-50 py-0.5 text-emerald-700">+1</span>
                                <span className="rounded bg-slate-100 py-0.5 text-slate-500">0</span>
                            </div>
                        </HeroDataCard>

                        <HeroDataCard
                            title="展開/脚質"
                            description="スタートでの位置取りを予測"
                            icon={<LineChart className="h-3.5 w-3.5" />}
                            accentClass="bg-emerald-50 text-emerald-700"
                        >
                            <div className="flex h-6 items-end gap-1 w-full">
                                {[54, 76, 38, 64].map((height, index) => (
                                    <span key={index} className="flex-1 rounded-t bg-emerald-500/80" style={{ height: `${height}%` }} />
                                ))}
                            </div>
                        </HeroDataCard>

                        <HeroDataCard
                            title="枠順傾向"
                            description="コース別の有利な枠順を分析"
                            icon={<BarChart3 className="h-3.5 w-3.5" />}
                            accentClass="bg-amber-50 text-amber-700"
                        >
                            <div className="flex h-6 items-end gap-1 w-full">
                                {[82, 42, 66, 36].map((height, index) => (
                                    <span key={index} className="flex-1 rounded-t bg-blue-500/80" style={{ height: `${height}%` }} />
                                ))}
                            </div>
                        </HeroDataCard>
                    </div>
                    <HomeRaceEntryLink
                        href={`/races/${todayStr}`}
                        raceDate={todayStr}
                        entryMethod="hero_cta"
                        className="cta"
                    >
                        今日のレース分析を無料で見る →
                    </HomeRaceEntryLink>
                </section>

                {/* レースページと同じ近日重賞表示 */}
                {weeklyGradeRaces.length > 0 ? (
                    <WeeklyGradeRaces races={weeklyGradeRaces} predictions={predictions} />
                ) : (
                    <div className="grade-focus card rounded-xl flex flex-col justify-center items-center p-6 text-center">
                        <span className="badge badge-slate mb-2">重賞情報</span>
                        <h2 className="text-slate-900 font-bold text-lg">近日の重賞情報を確認中です</h2>
                        <p className="text-slate-500 text-xs mt-1">開催情報が反映されるまで少し時間がかかる場合があります。</p>
                        <HomeRaceEntryLink
                            href={`/races/${todayStr}`}
                            raceDate={todayStr}
                            entryMethod="grade_fallback"
                            className="cta mt-4"
                        >
                            今日のレース分析を無料で見る →
                        </HomeRaceEntryLink>
                    </div>
                )}
            </div>

            {/* ── 3. 本日の開催 ── */}
            <section className="venue-section card rounded-xl">
                <h2 className="section-title">
                    <span>
                        <svg width="18" height="18" fill="none" stroke="var(--blue-color)" strokeWidth="2.5" viewBox="0 0 24 24" className="inline mr-1"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        本日の開催（{formatShortDate(todayStr)}）
                    </span>
                    <span className="section-note">毎日更新</span>
                </h2>

                <HomeTodayVenues
                    date={todayStr}
                    initialPredictions={predictions}
                />

                {!shouldSuppressAdsInDevelopment && (
                    <div className="ad ad-wide mt-4">
                        <AdUnit slot="8529703346" placement="inline" analyticsPlacement="home_after_today_races" />
                    </div>
                )}
            </section>

            {/* ── 4. メイングリッド (2カラム) ── */}
            <div className="main-grid">
                {/* 左スタック */}
                <div className="space-y-4">
                    {/* 高配当的中ランキング */}
                    <section className="hits card rounded-xl">
                        <TopHitsDisplay initialHits={topHits} />
                    </section>

                    {/* 本日の分析注目馬 */}
                    <section className="pick-section card rounded-xl">
                        <h2 className="section-title">
                            <span>本日の分析注目馬</span>
                        </h2>
                        <SpecialPickCard pick={specialPick} date={todayStr} predictions={predictions} />
                    </section>

                    {/* 最新の分析記事 */}
                    <section className="articles card rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="section-title !mb-0">
                                <span>最新の分析記事</span>
                                <span className="section-note">新着順</span>
                            </h2>
                            <Link prefetch={false} href="/articles" className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors pr-1">
                                すべて見る →
                            </Link>
                        </div>

                        <div className={`grid grid-cols-2 gap-3 ${shouldSuppressAdsInDevelopment ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
                            {latestArticles.slice(0, 3).map((article) => (
                                <Link href={`/articles/${article.slug}`} key={article.slug} className="article group">
                                    <div className="thumb relative overflow-hidden bg-slate-100">
                                        <img
                                            src={article.eyecatch || '/images/articles/data-analysis-eyecatch.png'}
                                            alt={article.title}
                                            loading="lazy"
                                            decoding="async"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    </div>
                                    <div className="article-body">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block ${getCategoryBadgeClass(article.category)}`}>
                                            {article.category}
                                        </span>
                                        <h3 className="line-clamp-2">{article.title}</h3>
                                        <div className="meta">
                                            <span>{new Date(article.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</span>
                                            <span>約{Math.max(1, Math.ceil(article.content.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length / 500))}分</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {/* 4枚目のネイティブ広告枠 */}
                            {!shouldSuppressAdsInDevelopment && (
                                <NativeCardAd slot="1489598374" variant="article" className="h-full" analyticsPlacement="home_article_feed_1" />
                            )}
                        </div>
                    </section>

                    {/* よくある質問 */}
                    <section className="faq card rounded-xl">
                        <h2 className="section-title">
                            <span>よくある質問</span>
                            <span className="section-note">初めての方へ</span>
                        </h2>
                        <div className="space-y-1">
                            {homepageFaqItems.map((item, index) => (
                                <details key={index} className="border-t border-slate-200 first:border-0">
                                    <summary className="list-none cursor-pointer py-3 text-sm font-bold text-slate-900 flex justify-between items-center hover:bg-slate-50 px-2 rounded">
                                        <span>{item.question}</span>
                                        <span className="text-xs text-slate-400">▼</span>
                                    </summary>
                                    <div className="pb-3 px-2 text-xs leading-relaxed text-slate-500">
                                        {item.answer}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </section>
                </div>

                {/* 右サイドバー */}
                <aside className="hidden lg:grid gap-4">
                    {!shouldSuppressAdsInDevelopment && (
                        <div className="ad ad-large">
                            <AdUnit slot="1489598374" placement="inline" analyticsPlacement="home_after_special_pick" />
                        </div>
                    )}
                    <div className="card rounded-xl p-4 bg-white border border-slate-200">
                        <h2 className="section-title">
                            <span>関連コンテンツ</span>
                        </h2>
                        <div className="side-list">
                            <Link prefetch={false} href={`/races/${todayStr}`} className="resume-card">
                                <small>本日のデータ</small>
                                <strong>全レース一覧</strong>
                                <span className="resume-action mt-2">確認する</span>
                            </Link>
                            {/* <Link href="/grade-races" className="resume-card mt-2">
                                <small>重賞カレンダー</small>
                                <strong>重賞・G1一覧</strong>
                                <span className="resume-action mt-2">見る</span>
                            </Link>
                            <Link href="/courses" className="resume-card mt-2">
                                <small>コース別データ</small>
                                <strong>コース分析ハブ</strong>
                                <span className="resume-action mt-2">見る</span>
                            </Link>
                            <Link href="/jockeys" className="resume-card mt-2">
                                <small>騎手データ</small>
                                <strong>騎手別成績</strong>
                                <span className="resume-action mt-2">見る</span>
                            </Link> */}
                        </div>
                    </div>
                </aside>
            </div>

            <DisclaimerAlert />
        </div>
    );
}
