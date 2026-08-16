import Link from 'next/link';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { WeeklyGradeRaces } from '@/components/WeeklyGradeRaces';
import { RecentRaceReturn } from '@/components/RecentRaceReturn';
import { HomeTodayVenues } from '@/components/HomeTodayVenues';
import { getSpecialPick, getPredictionsForDate, getWeeklyGradeRaces, getTopPayoutHits } from '@/lib/api';
import { getLatestArticles } from '../lib/articles';
import {
    buildGradeRaceTopHorseMap,
    extractHomeSpecialPicks,
    getHomeRaceDaySummary,
    getHomeVenueNamesString,
    summarizeHomeVenues,
} from '@/lib/home-page-summary';

import DisclaimerAlert from '@/components/DisclaimerAlert';
import { AdUnit } from '@/components/AdUnit';
import { NativeCardAd } from '@/components/NativeCardAd';
import type { Metadata } from 'next';
import { shouldSuppressAdsInDevelopment } from '@/lib/ad-config';
import { HomeRaceEntryLink } from '@/components/HomeRaceEntryLink';
import { HomeStickyRaceCta } from '@/components/HomeStickyRaceCta';
import { FAQSchema } from '@/components/StructuredData';
import { RaceAnalysisValueGrid } from '@/components/RaceAnalysisValueGrid';
import { SectionHeader } from '@/components/SectionHeader';

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

const getJstDateParts = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    return {
        year: parts.find(part => part.type === 'year')?.value ?? '',
        month: parts.find(part => part.type === 'month')?.value ?? '',
        day: parts.find(part => part.type === 'day')?.value ?? '',
    };
};

const getTodayString = () => {
    const { year, month, day } = getJstDateParts();
    return `${year}-${month}-${day}`;
};

const formatShortDate = (date: string) => {
    const matched = date.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (!matched) return date;
    return `${Number(matched[1])}/${Number(matched[2])}`;
};

const getFormattedUpdateDate = () => {
    const { month, day } = getJstDateParts();
    return `${Number(month)}/${Number(day)} 7:00頃更新`;
};

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
    const homeRevalidateSeconds = 1800;
    const [specialPick, predictions, weeklyGradeRaces, topHits] = await Promise.all([
        getSpecialPick(todayStr, { revalidateSeconds: homeRevalidateSeconds }).catch(e => {
            console.error("Failed to fetch special pick:", e);
            return null;
        }),
        getPredictionsForDate(todayStr, { revalidateSeconds: homeRevalidateSeconds }).catch(e => {
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
    const homeVenues = summarizeHomeVenues(predictions);
    const raceDaySummary = getHomeRaceDaySummary(homeVenues);
    const homeSpecialPicks = extractHomeSpecialPicks(predictions, specialPick);
    const gradeRaceTopHorses = buildGradeRaceTopHorseMap(predictions, weeklyGradeRaces);

    return (
        <div className="home-page-scope site-shell-wide touch-pan-y space-y-1.5 sm:space-y-3 overscroll-y-auto">
            <FAQSchema faqs={homepageFaqItems} />
            <HomeStickyRaceCta raceDate={todayStr} raceCount={raceDaySummary.raceCount} />
            {/* ── 1. 最近確認したレース ── */}
            <RecentRaceReturn />

            {/* ── 2. ヒーローとG1重賞 ── */}
            <div className="hero-grid">
                {/* ヒーローセクション */}
                <section className="hero card rounded-xl flex flex-col justify-between">
                    <div>
                        <span className="update inline-flex items-center gap-1 text-[10px] sm:text-xs font-extrabold text-white/95">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            {getFormattedUpdateDate()}
                        </span>
                        <h1 className="text-white font-extrabold tracking-tight leading-tight !text-[14px] sm:!text-[24px] mb-1">
                            {raceDaySummary.venueCount > 0
                                ? <>{getHomeVenueNamesString(homeVenues)} 全{raceDaySummary.raceCount}レース分析公開中</>
                                : <>今日のレース分析を無料で確認</>
                            }
                        </h1>
                        <p className="text-slate-300 text-[10.5px] sm:text-sm leading-tight max-w-xl">
                            展開・対戦成績・枠順傾向をひと目で確認。中央・地方の分析データを無料で確認できます。
                        </p>
                        <RaceAnalysisValueGrid className="mt-1.5 sm:mt-4" />
                    </div>
                    <HomeRaceEntryLink
                        href={`/races/${todayStr}`}
                        raceDate={todayStr}
                        entryMethod="hero_cta"
                        data-home-primary-race-cta
                        className="cta mt-1.5"
                    >
                        本日のレース分析を見る <span aria-hidden="true">→</span>
                    </HomeRaceEntryLink>
                </section>

                {/* レースページと同じ近日重賞表示 */}
                {weeklyGradeRaces.length > 0 ? (
                    <WeeklyGradeRaces races={weeklyGradeRaces} topHorses={gradeRaceTopHorses} />
                ) : (
                    <div className="grade-focus flex flex-col justify-center items-center p-3 sm:p-6 text-center">
                        <span className="badge badge-slate mb-1">重賞情報</span>
                        <h2 className="text-slate-900 font-bold text-xs sm:text-lg">近日の重賞情報を確認中です</h2>
                        <p className="text-slate-500 text-[10.5px] sm:text-xs mt-0.5">開催情報が反映されるまで少し時間がかかる場合があります。</p>
                        <HomeRaceEntryLink
                            href={`/races/${todayStr}`}
                            raceDate={todayStr}
                            entryMethod="grade_fallback"
                            className="cta mt-2"
                        >
                            今日のレース分析を見る <span aria-hidden="true">→</span>
                        </HomeRaceEntryLink>
                    </div>
                )}
            </div>

            {/* ── 3. 本日の開催 ── */}
            <section className="venue-section card rounded-xl">
                <SectionHeader
                    title={`本日の開催（${formatShortDate(todayStr)}）`}
                    meta="毎日更新"
                    className="mb-1.5 sm:mb-3"
                    compact
                />

                <HomeTodayVenues
                    date={todayStr}
                    initialVenues={homeVenues}
                />

                {!shouldSuppressAdsInDevelopment && (
                    <div className="ad ad-wide mt-2 sm:mt-4">
                        <AdUnit slot="8529703346" placement="inline" analyticsPlacement="home_after_today_races" />
                    </div>
                )}
            </section>

            {/* ── 4. メイングリッド (2カラム) ── */}
            <div className="main-grid">
                {/* 左スタック */}
                <div className="space-y-1.5 sm:space-y-3">
                    {/* 高配当的中ランキング */}
                    <section className="hits card rounded-xl">
                        <TopHitsDisplay initialHits={topHits} />
                    </section>

                    {/* 本日の分析注目馬 */}
                    <section className="pick-section card rounded-xl">
                        <SectionHeader title="本日の分析注目馬" className="mb-1.5 sm:mb-3" compact />
                        <SpecialPickCard pick={specialPick} date={todayStr} precomputedPicks={homeSpecialPicks} />
                    </section>

                    {/* 注目馬を読み終えた位置の広告枠。
                        右サイドバーの枠は lg 以上でしか表示されないため、
                        モバイルでは本日の開催直後と記事フィードの2枠しかなかった。
                        高配当ランキングと注目馬という長いセクションを挟んだ後に1枠だけ足す。 */}
                    {!shouldSuppressAdsInDevelopment && (
                        <div className="ad ad-wide">
                            <AdUnit
                                slot="1489598374"
                                placement="inline"
                                analyticsPlacement="home_after_today_pick"
                            />
                        </div>
                    )}

                    {/* 最新の分析記事 */}
                    <section className="articles card rounded-xl">
                        <SectionHeader
                            title="最新の分析記事"
                            meta=""
                            action={(
                                <Link prefetch={false} href="/articles" className="transition-colors duration-150 hover:text-blue-600">
                                    すべて見る →
                                </Link>
                            )}
                            className="mb-1.5 sm:mb-3"
                            compact
                        />

                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                            {latestArticles.slice(0, 3).map((article) => (
                                <Link prefetch={false} href={`/articles/${article.slug}`} key={article.slug} className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5 transition-colors hover:border-blue-300 hover:bg-slate-50/60">
                                    <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded bg-slate-100">
                                        <img
                                            src={article.eyecatch || '/images/articles/data-analysis-eyecatch.png'}
                                            alt={article.title}
                                            loading="lazy"
                                            decoding="async"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                                        <div>
                                            <span className={`text-[8.5px] font-bold px-1 py-0.2 rounded inline-block ${getCategoryBadgeClass(article.category)}`}>
                                                {article.category}
                                            </span>
                                            <h3 className="line-clamp-2 text-[11.5px] font-bold leading-tight text-slate-900 group-hover:text-primary mt-0.5">{article.title}</h3>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between text-[9.5px] text-slate-400">
                                            <span>{formatShortDate(article.date)}</span>
                                            <span>約{Math.max(1, Math.ceil(article.content.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length / 500))}分</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {/* 4枚目のネイティブ広告枠 */}
                            {!shouldSuppressAdsInDevelopment && (
                                <div className="md:col-span-3">
                                    <NativeCardAd slot="1489598374" variant="article" className="h-full" analyticsPlacement="home_article_feed_1" />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 過去データを調べる */}
                    <section className="database-section card rounded-xl">
                        <SectionHeader
                            title="過去データを調べる"
                            description="過去レースを競走馬、騎手、調教師、コースごとに再集計しています。"
                            className="mb-1.5 sm:mb-2.5"
                            compact
                        />
                        <div className="grid gap-1 sm:grid-cols-2 sm:gap-2">
                            {[
                                { href: '/compare', label: '競走馬のデータ比較', note: '複数の馬の成績・得意条件を比較できます。' },
                                { href: '/my-data', label: 'マイデータ', note: '馬・人・コースのお気に入り登録と履歴を確認できます。' },
                                { href: '/horses', label: '競走馬データ', note: '近走・得意条件・AI偏差値履歴を確認できます。' },
                                { href: '/courses', label: 'コースデータ', note: '枠順・脚質の有利不利などを確認できます。' },
                            ].map((item) => (
                                <Link
                                    key={item.href}
                                    prefetch={false}
                                    href={item.href}
                                    className="flex min-h-[36px] flex-col justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 transition-colors duration-150 hover:border-blue-300 hover:bg-slate-50/70"
                                >
                                    <span className="text-[11.5px] font-bold text-slate-900 sm:text-sm">{item.label}</span>
                                    <span className="mt-0.5 hidden text-[10px] text-slate-500 line-clamp-1 sm:block">{item.note}</span>
                                </Link>
                            ))}
                        </div>
                        <Link
                            href="/keiba-data"
                            prefetch={false}
                            className="mt-1.5 flex min-h-8 items-center justify-between rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-[11.5px] font-bold text-blue-700 transition-colors duration-150 hover:bg-blue-100/70 sm:text-sm"
                        >
                            <span>競馬データベース・分析ハブを開く</span>
                            <span aria-hidden="true" className="text-xs font-bold">→</span>
                        </Link>
                    </section>

                    {/* よくある質問 */}
                    <section className="faq card rounded-xl">
                        <SectionHeader title="よくある質問" className="mb-1.5 sm:mb-2.5" compact />
                        <div className="space-y-1 sm:space-y-1.5">
                            {homepageFaqItems.map((item, index) => (
                                <details key={index} className="rounded-lg border border-slate-200 bg-white p-1.5 transition-colors hover:border-slate-300">
                                    <summary className="list-none cursor-pointer text-[11.5px] font-bold text-slate-900 flex justify-between items-center px-0.5">
                                        <span>{item.question}</span>
                                        <span className="text-[9px] text-slate-400 ml-1.5 shrink-0">▼</span>
                                    </summary>
                                    <div className="mt-1 px-0.5 text-[11px] leading-snug text-slate-600 border-t border-slate-100 pt-1">
                                        {item.answer}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </section>

                    <DisclaimerAlert />
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
                            <Link prefetch={false} href="/keiba-data" className="resume-card mt-2">
                                <small>過去データ</small>
                                <strong>競馬データベース</strong>
                                <span className="resume-action mt-2">調べる</span>
                            </Link>
                            <Link href="/my-data" className="resume-card mt-2">
                                <small>保存・履歴</small>
                                <strong>マイデータ</strong>
                                <span className="resume-action mt-2">開く</span>
                            </Link>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
