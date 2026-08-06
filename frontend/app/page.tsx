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
        <div className="home-page-scope site-shell-wide touch-pan-y space-y-2.5 overscroll-y-auto sm:space-y-4">
            <HomeStickyRaceCta raceDate={todayStr} raceCount={raceDaySummary.raceCount} />
            {/* ── 1. 最近確認したレース ── */}
            <RecentRaceReturn />

            {/* ── 2. ヒーローとG1重賞 ── */}
            <div className="hero-grid">
                {/* ヒーローセクション */}
                <section className="hero card rounded-xl">
                    <span className="update inline-flex items-center gap-1.5 text-xs font-extrabold text-white/95">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {getFormattedUpdateDate()}
                    </span>
                    <h1 className="text-white font-extrabold tracking-tight leading-tight !text-[17px] sm:!text-[24px] mb-2">
                        {raceDaySummary.venueCount > 0
                            ? <>{getHomeVenueNamesString(homeVenues)}<br />全{raceDaySummary.raceCount}レース分析公開中</>
                            : <>今日のレース分析を<br />無料で確認</>
                        }
                    </h1>
                    <p className="text-slate-300 text-xs sm:text-base leading-relaxed pb-2 mb-4 max-w-xl">
                        展開・対戦成績・枠順傾向をひと目で確認。登録不要で中央・地方の分析データを毎日無料で確認できます。
                    </p>
                    <RaceAnalysisValueGrid className="mb-4" />
                    <HomeRaceEntryLink
                        href={`/races/${todayStr}`}
                        raceDate={todayStr}
                        entryMethod="hero_cta"
                        data-home-primary-race-cta
                        className="cta"
                    >
                        本日のレース分析を見る <span aria-hidden="true">→</span>
                    </HomeRaceEntryLink>
                </section>

                {/* レースページと同じ近日重賞表示 */}
                {weeklyGradeRaces.length > 0 ? (
                    <WeeklyGradeRaces races={weeklyGradeRaces} topHorses={gradeRaceTopHorses} />
                ) : (
                    <div className="grade-focus flex flex-col justify-center items-center p-6 text-center">
                        <span className="badge badge-slate mb-2">重賞情報</span>
                        <h2 className="text-slate-900 font-bold text-lg">近日の重賞情報を確認中です</h2>
                        <p className="text-slate-500 text-xs mt-1">開催情報が反映されるまで少し時間がかかる場合があります。</p>
                        <HomeRaceEntryLink
                            href={`/races/${todayStr}`}
                            raceDate={todayStr}
                            entryMethod="grade_fallback"
                            className="cta mt-4"
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
                    className="mb-3"
                    compact
                />

                <HomeTodayVenues
                    date={todayStr}
                    initialVenues={homeVenues}
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
                <div className="space-y-2.5 sm:space-y-4">
                    {/* 高配当的中ランキング */}
                    <section className="hits card rounded-xl">
                        <TopHitsDisplay initialHits={topHits} />
                    </section>

                    {/* 本日の分析注目馬 */}
                    <section className="pick-section card rounded-xl">
                        <SectionHeader title="本日の分析注目馬" className="mb-3" compact />
                        <SpecialPickCard pick={specialPick} date={todayStr} precomputedPicks={homeSpecialPicks} />
                    </section>

                    {/* 最新の分析記事 */}
                    <section className="articles card rounded-xl">
                        <SectionHeader
                            title="最新の分析記事"
                            meta="新着順"
                            action={(
                                <Link prefetch={false} href="/articles" className="transition-colors duration-150 hover:text-blue-600">
                                    すべて見る →
                                </Link>
                            )}
                            className="mb-3"
                            compact
                        />

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                            {latestArticles.slice(0, 3).map((article) => (
                                <Link prefetch={false} href={`/articles/${article.slug}`} key={article.slug} className="article group flex min-h-0 sm:block">
                                    <div className="thumb relative h-20 w-24 shrink-0 overflow-hidden bg-slate-100 sm:h-auto sm:w-auto">
                                        <img
                                            src={article.eyecatch || '/images/articles/data-analysis-eyecatch.png'}
                                            alt={article.title}
                                            loading="lazy"
                                            decoding="async"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="article-body">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block ${getCategoryBadgeClass(article.category)}`}>
                                            {article.category}
                                        </span>
                                        <h3 className="line-clamp-2">{article.title}</h3>
                                        <div className="meta">
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

                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 px-4 py-3">
                            <SectionHeader title="過去データを調べる" meta="馬・人・コース" compact />
                            <p className="mt-1 text-xs leading-6 text-slate-600">
                                過去レースを競走馬、騎手、調教師、コースごとに再集計しています。
                            </p>
                        </div>
                        <div className="grid sm:grid-cols-2">
                            {[
                                { href: '/compare', label: '競走馬の成績比較', note: '2〜5頭の成績・得意条件を比較' },

                                { href: '/my-data', label: 'マイデータ', note: '保存した馬・人・コースと履歴' },
                                { href: '/horses', label: '競走馬データ', note: '近走・得意条件・AI偏差値履歴' },
                                { href: '/courses', label: 'コースデータ', note: '枠順・脚質・馬場・払戻分布' },
                            ].map((item) => (
                                <Link
                                    key={item.href}
                                    prefetch={false}
                                    href={item.href}
                                    className="min-h-16 border-b border-slate-100 px-4 py-3 transition-colors duration-150 hover:bg-blue-50/60 sm:border-r"
                                >
                                    <span className="block font-black text-slate-900">{item.label}</span>
                                    <span className="mt-0.5 block text-xs text-slate-500">{item.note}</span>
                                </Link>
                            ))}
                        </div>
                        <Link
                            href="/keiba-data"
                            prefetch={false}
                            className="flex min-h-11 items-center justify-center bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-blue-600"
                        >
                            競馬データベース・分析ハブを開く
                        </Link>
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
                                        <span className="text-xs text-slate-500">▼</span>
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

            <DisclaimerAlert />
        </div>
    );
}
