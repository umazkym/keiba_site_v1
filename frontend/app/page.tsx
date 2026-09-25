import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { WeeklyGradeRaces, sortWeeklyGradeRaces } from '@/components/WeeklyGradeRaces';
import { RecentRaceReturn } from '@/components/RecentRaceReturn';
import { HomeTodayVenues } from '@/components/HomeTodayVenues';
import { HomeHero, type HomeHeroPhoto } from '@/components/HomeHero';
import { CourseGlyph } from '@/components/CourseGlyph';
import { ArticleThumb } from '@/components/ArticleThumb';
import { LineIcon, type LineIconName } from '@/components/LineIcon';
import { getSpecialPick, getPredictionsForDate, getWeeklyGradeRaces, getTopPayoutHits } from '@/lib/api';
import { getAllArticlesMeta, getLatestArticles } from '../lib/articles';
import {
    buildGradeRaceTopHorseMap,
    describeHomeVenues,
    extractHomeSpecialPicks,
    getHomeRaceDaySummary,
    summarizeHomeVenues,
    type HomeVenueSummary,
} from '@/lib/home-page-summary';
import { estimateReadingMinutes, getArticleCategoryStyle, pickArticleThumbs } from '@/lib/article-visual';
import { formatRaceDateLabel } from '@/lib/race-display';

import { DisclaimerNote } from '@/components/DisclaimerNote';
import { AdUnit } from '@/components/AdUnit';
import { NativeCardAd } from '@/components/NativeCardAd';
import { shouldSuppressAdsInDevelopment } from '@/lib/ad-config';
import { HomeRaceEntryLink } from '@/components/HomeRaceEntryLink';
import { HomeStickyRaceCta } from '@/components/HomeStickyRaceCta';
import { FAQSchema } from '@/components/StructuredData';
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
        answer: 'すべての分析データを無料で公開しています。会員登録やメールアドレスの入力はありません。',
    },
    {
        question: 'データはいつ更新されますか？',
        answer: '毎日午前7時ごろに、前日の結果と当日の分析データを更新しています。',
    },
    {
        question: 'AI偏差値とは何ですか？',
        answer: 'AIが算出した各馬の評価を、同じレースの出走馬どうしで比べやすいよう偏差値の形にしたものです。結果を保証するものではなく、コースの傾向や馬場とあわせて見る参考の指標です。',
    },
    {
        question: '分析の精度はどのくらいですか？',
        answer: '過去レースの統計データをもとに算出しているため、実際の結果とは異なる場合があります。高配当的中ランキングとAI予想の成績のページで、過去の的中実績を公開しています。',
    },
    {
        question: 'スマートフォンでも使えますか？',
        answer: 'PC・スマートフォン・タブレットのいずれにも対応しています。',
    },
];

const DATA_LINKS: { href: string; icon: LineIconName; label: string; note: string }[] = [
    { href: '/horses', icon: 'user', label: '競走馬データ', note: '近走・得意条件・AI偏差値の履歴' },
    { href: '/jockeys', icon: 'trophy', label: '騎手データ', note: 'コース別・条件別の成績' },
    { href: '/courses', icon: 'pin', label: 'コースデータ', note: '枠順・脚質の有利不利' },
    { href: '/compare', icon: 'compare', label: '馬を比べる', note: '複数の馬の成績と得意条件を並べる' },
];

const getJstDateParts = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date());

    return {
        year: parts.find(part => part.type === 'year')?.value ?? '',
        month: parts.find(part => part.type === 'month')?.value ?? '',
        day: parts.find(part => part.type === 'day')?.value ?? '',
        hour: Number(parts.find(part => part.type === 'hour')?.value ?? '0'),
    };
};

const formatShortDate = (date: string) => {
    const matched = date.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (!matched) return date;
    return `${Number(matched[1])}/${Number(matched[2])}`;
};

// 中央の開催がある日は芝の写真。地方だけの日は、16時以降をナイターの写真にする
const pickHeroPhoto = (venues: HomeVenueSummary[], jstHour: number): HomeHeroPhoto => {
    if (venues.length === 0 || venues.some((venue) => venue.race_type === 'jra')) return 'jra';
    return jstHour >= 16 ? 'night' : 'nar-day';
};

function Panel({ children, className = '', labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
    return (
        <section aria-labelledby={labelledBy} className={`rounded-xl border border-slate-200 bg-white p-4 md:p-6 ${className}`}>
            {children}
        </section>
    );
}

export default async function HomePage() {
    const { year, month, day, hour } = getJstDateParts();
    const todayStr = `${year}-${month}-${day}`;
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

    const latestArticles = getLatestArticles(4);
    const articleThumbs = pickArticleThumbs(latestArticles);
    const homeVenues = summarizeHomeVenues(predictions);
    const raceDaySummary = getHomeRaceDaySummary(homeVenues);
    const homeSpecialPicks = extractHomeSpecialPicks(predictions, specialPick);
    const gradeRaceTopHorses = buildGradeRaceTopHorseMap(predictions, weeklyGradeRaces);
    const hasVenues = raceDaySummary.venueCount > 0;
    const venueMeta = hasVenues ? `${describeHomeVenues(homeVenues)} · ${raceDaySummary.raceCount}レース` : '';
    const dateLabel = formatRaceDateLabel(todayStr);

    // 会場が多い日は名前を並べず「中央3場・地方4場」と数える
    const heroTitle = hasVenues ? (
        <>
            {homeVenues.length <= 4 ? homeVenues.map((venue) => venue.venue_name).join('・') : describeHomeVenues(homeVenues)}
            <br />
            全{raceDaySummary.raceCount}レースの分析を公開中
        </>
    ) : (
        <>
            今日のレース分析を
            <br />
            無料で確認できます
        </>
    );

    const glyphs: Record<string, ReactNode> = {};
    for (const venue of homeVenues) {
        glyphs[venue.venue_name] = <CourseGlyph venue={venue.venue_name} className="block h-auto w-full" />;
    }

    const categoryCounts = Object.entries(
        getAllArticlesMeta().reduce<Record<string, number>>((counts, article) => {
            if (article.category && article.category !== '未分類') {
                counts[article.category] = (counts[article.category] ?? 0) + 1;
            }
            return counts;
        }, {}),
    )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const searchExamples = Array.from(new Set([
        ...sortWeeklyGradeRaces(weeklyGradeRaces).slice(0, 2).map((race) => race.race_name),
        ...homeVenues.slice(0, 2).map((venue) => venue.venue_name),
    ])).slice(0, 4);

    return (
        <div className="home-page-scope site-shell-wide flex touch-pan-y flex-col gap-6 overscroll-y-auto pb-2 md:gap-8 md:pt-2">
            <FAQSchema faqs={homepageFaqItems} />
            <HomeStickyRaceCta raceDate={todayStr} raceCount={raceDaySummary.raceCount} />

            {/* ── 1. 写真の入口と前回の続き（PCは日付の行の右に前回の続き） ── */}
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-4">
                <p className="hidden items-baseline gap-3 lg:order-1 lg:flex">
                    <span className="font-display text-[22px] font-extrabold text-slate-900">{dateLabel}</span>
                    <span className="text-[13.5px] font-bold text-slate-500">7:00ごろ更新{venueMeta ? ` · ${venueMeta}` : ''}</span>
                </p>
                <div className="lg:order-3 lg:col-span-2">
                    <HomeHero
                        todayStr={todayStr}
                        title={heroTitle}
                        tagLabel={hasVenues ? '本日の開催' : '毎朝7時ごろ更新'}
                        updateLabel={`${dateLabel} 7:00ごろ更新`}
                        photo={pickHeroPhoto(homeVenues, hour)}
                        gradeRaces={weeklyGradeRaces}
                        gradeTopHorses={gradeRaceTopHorses}
                    />
                </div>
                <RecentRaceReturn className="mx-2.5 sm:mx-0 lg:order-2 lg:w-[380px]" />
            </div>

            <div className="flex flex-col gap-6 px-2.5 sm:px-0 md:gap-8">
                {/* ── 2. 本日の開催 ── */}
                <section aria-labelledby="home-venues-heading" className="flex flex-col gap-3 md:gap-4">
                    <SectionHeader
                        id="home-venues-heading"
                        title={`本日の開催（${formatShortDate(todayStr)}）`}
                        meta={venueMeta}
                        action={hasVenues ? (
                            <HomeRaceEntryLink
                                href={`/races/${todayStr}`}
                                raceDate={todayStr}
                                entryMethod="board_link"
                                className="inline-flex items-center gap-1 whitespace-nowrap text-[13.5px] font-bold text-brand-700 transition-colors duration-150 hover:text-brand-600"
                            >
                                開催日のボードで見る
                                <LineIcon name="chevR" size={16} className="block" />
                            </HomeRaceEntryLink>
                        ) : undefined}
                        className="!mb-0"
                        compact
                    />

                    <HomeTodayVenues date={todayStr} initialVenues={homeVenues} glyphs={glyphs} />

                    {!shouldSuppressAdsInDevelopment && (
                        <div className="ad ad-wide">
                            <AdUnit slot="8529703346" placement="inline" analyticsPlacement="home_after_today_races" />
                        </div>
                    )}
                </section>

                {/* ── 3. 2列（PCは右に広告・重賞・検索・カテゴリ） ── */}
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_384px]">
                    <div className="flex min-w-0 flex-col gap-6">
                        {/* スマホ・タブレットの今週の重賞（PCはヒーローの右上に出す） */}
                        {weeklyGradeRaces.length > 0 ? (
                            <div className="lg:hidden">
                                <WeeklyGradeRaces variant="feature" races={weeklyGradeRaces} topHorses={gradeRaceTopHorses} />
                            </div>
                        ) : (
                            <Panel labelledBy="home-grade-fallback-heading">
                                <SectionHeader id="home-grade-fallback-heading" title="今週の重賞" className="!mb-0" compact />
                                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
                                    重賞の開催情報を確認しています。反映まで少し時間がかかる場合があります。
                                </p>
                                <HomeRaceEntryLink
                                    href={`/races/${todayStr}`}
                                    raceDate={todayStr}
                                    entryMethod="grade_fallback"
                                    className="ui-btn ui-btn--secondary mt-3 w-full md:w-auto"
                                >
                                    今日のレース分析を確認する
                                </HomeRaceEntryLink>
                            </Panel>
                        )}

                        {/* 本日の分析注目馬（注目馬が無い日は出さない） */}
                        {homeSpecialPicks.favored && (
                            <Panel labelledBy="home-pick-heading">
                                <SectionHeader id="home-pick-heading" title="本日の分析注目馬" className="!mb-3" compact />
                                <SpecialPickCard pick={specialPick} date={todayStr} precomputedPicks={homeSpecialPicks} />
                            </Panel>
                        )}

                        {/* 注目馬を読み終えた位置の広告枠。
                            右列の枠は lg 以上でしか表示されないため、スマホでは本日の開催の直後と記事一覧の2枠になる。
                            長いセクションのあとに1枠だけ足す。 */}
                        {!shouldSuppressAdsInDevelopment && (
                            <div className="ad ad-wide">
                                <AdUnit
                                    slot="1489598374"
                                    placement="inline"
                                    analyticsPlacement="home_after_today_pick"
                                />
                            </div>
                        )}

                        {/* 高配当的中ランキング */}
                        <Panel>
                            <TopHitsDisplay initialHits={topHits} />
                        </Panel>

                        {/* 最新の分析記事 */}
                        <Panel labelledBy="home-articles-heading">
                            <SectionHeader
                                id="home-articles-heading"
                                title="最新の分析記事"
                                action={(
                                    <Link prefetch={false} href="/articles" className="inline-flex items-center gap-1 whitespace-nowrap text-[13.5px] font-bold text-brand-700 transition-colors duration-150 hover:text-brand-600">
                                        すべて見る
                                        <LineIcon name="chevR" size={16} className="block" />
                                    </Link>
                                )}
                                className="!mb-1 md:!mb-4"
                                compact
                            />
                            <ul className="flex flex-col md:grid md:grid-cols-3 md:gap-5">
                                {latestArticles.map((article, index) => {
                                    const categoryStyle = getArticleCategoryStyle(article.category);
                                    return (
                                        <li key={article.slug} className={`border-b border-slate-200 last:border-b-0 md:border-b-0 ${index >= 3 ? 'md:hidden' : ''}`}>
                                            <Link
                                                prefetch={false}
                                                href={`/articles/${article.slug}`}
                                                className="group flex gap-3 py-3 md:flex-col md:gap-2.5 md:py-0"
                                            >
                                                <ArticleThumb
                                                    thumb={articleThumbs[index]}
                                                    sizes="(min-width: 1024px) 260px, (min-width: 768px) 30vw, 104px"
                                                    className="h-[70px] w-[104px] shrink-0 rounded-[10px] md:aspect-[16/9] md:h-auto md:w-full md:rounded-xl"
                                                />
                                                <span className="flex min-w-0 flex-col gap-1.5 md:contents">
                                                    <span className="line-clamp-2 text-[14px] font-bold leading-normal text-slate-900 group-hover:text-brand-700 md:order-2 md:text-[15px] md:leading-[1.55]">
                                                        {article.title}
                                                    </span>
                                                    <span className="flex items-center gap-2 text-[12px] text-slate-500 md:order-1">
                                                        <span className={`inline-flex items-center rounded-[5px] bg-white px-1.5 py-px text-[11px] font-bold ring-1 ring-inset ${categoryStyle.tagClass}`}>
                                                            {article.category}
                                                        </span>
                                                        {formatShortDate(article.date)} · 約{estimateReadingMinutes(article.content)}分
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                            {!shouldSuppressAdsInDevelopment && (
                                <div className="mt-3 md:mt-5">
                                    <NativeCardAd slot="1489598374" variant="article" className="h-full" analyticsPlacement="home_article_feed_1" />
                                </div>
                            )}
                        </Panel>

                        {/* 過去データを調べる */}
                        <Panel labelledBy="home-data-heading">
                            <SectionHeader
                                id="home-data-heading"
                                title="過去データを調べる"
                                description="過去のレースを競走馬・騎手・調教師・コースごとに集計しています。"
                                className="!mb-3 md:!mb-4"
                                compact
                            />
                            <div className="grid gap-2.5 sm:grid-cols-2">
                                {DATA_LINKS.map((item) => (
                                    <Link
                                        key={item.href}
                                        prefetch={false}
                                        href={item.href}
                                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 transition-colors duration-150 hover:border-brand-300"
                                    >
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-navy" aria-hidden="true">
                                            <LineIcon name={item.icon} size={20} />
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className="text-[14.5px] font-bold text-slate-900">{item.label}</span>
                                            <span className="text-[12.5px] text-slate-500">{item.note}</span>
                                        </span>
                                        <LineIcon name="chevR" size={18} className="block shrink-0 text-slate-500" />
                                    </Link>
                                ))}
                            </div>
                            <Link
                                href="/keiba-data"
                                prefetch={false}
                                className="ui-btn ui-btn--ghost mt-2 w-full justify-between sm:w-auto"
                            >
                                競馬データベースのトップを開く
                                <LineIcon name="chevR" size={18} className="block" />
                            </Link>
                        </Panel>

                        {/* よくある質問 */}
                        <Panel labelledBy="home-faq-heading">
                            <SectionHeader id="home-faq-heading" title="よくある質問" className="!mb-1" compact />
                            <div className="flex flex-col">
                                {homepageFaqItems.map((item, index) => (
                                    <details key={item.question} open={index === 0} className="group border-b border-slate-200 last:border-b-0">
                                        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 text-[14.5px] font-bold text-slate-900 md:min-h-[56px] md:text-[15.5px] [&::-webkit-details-marker]:hidden">
                                            <span className="font-display text-[18px] font-extrabold text-brand-600" aria-hidden="true">Q</span>
                                            <span className="flex-1">{item.question}</span>
                                            <LineIcon name="chevD" size={18} className="block shrink-0 text-slate-500 transition-transform duration-150 group-open:rotate-180" />
                                        </summary>
                                        <p className="mb-4 ml-[30px] text-[13.5px] leading-[1.85] text-slate-700 md:text-[14.5px]">
                                            {item.answer}
                                        </p>
                                    </details>
                                ))}
                            </div>
                        </Panel>

                        <DisclaimerNote className="px-1" />
                    </div>

                    {/* 右列（PCのみ） */}
                    <aside className="hidden flex-col gap-6 lg:flex">
                        {!shouldSuppressAdsInDevelopment && (
                            <div className="ad ad-large">
                                <AdUnit slot="1489598374" placement="inline" analyticsPlacement="home_after_special_pick" />
                            </div>
                        )}

                        <WeeklyGradeRaces variant="list" races={weeklyGradeRaces} topHorses={gradeRaceTopHorses} />

                        <section aria-labelledby="home-search-heading" className="rounded-xl border border-slate-200 bg-white p-5">
                            <h2 id="home-search-heading" className="text-[17px] font-extrabold text-slate-900">データベースで調べる</h2>
                            <form action="/search" method="get" role="search" className="mt-3.5">
                                <label className="flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] border-slate-300 bg-white px-3.5 transition-colors duration-150 focus-within:border-brand-600">
                                    <LineIcon name="search" size={18} className="block shrink-0 text-slate-500" />
                                    <span className="sr-only">サイト内を検索</span>
                                    <input
                                        type="search"
                                        name="q"
                                        placeholder="馬名・騎手・コースで検索"
                                        className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-[14px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-0"
                                    />
                                </label>
                            </form>
                            {searchExamples.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {searchExamples.map((example) => (
                                        <Link
                                            key={example}
                                            prefetch={false}
                                            href={`/search?q=${encodeURIComponent(example)}`}
                                            className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-700 transition-colors duration-150 hover:border-brand-300"
                                        >
                                            {example}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>

                        {categoryCounts.length > 0 && (
                            <section aria-labelledby="home-categories-heading" className="rounded-xl border border-slate-200 bg-white p-5">
                                <h2 id="home-categories-heading" className="text-[17px] font-extrabold text-slate-900">記事のカテゴリ</h2>
                                <ul className="mt-2.5">
                                    {categoryCounts.map(([category, count]) => (
                                        <li key={category}>
                                            <Link
                                                prefetch={false}
                                                href={`/articles/category/${encodeURIComponent(category)}`}
                                                className="flex min-h-[44px] items-center gap-2.5 border-b border-slate-200 text-[14px] font-bold text-slate-900 transition-colors duration-150 hover:text-brand-700"
                                            >
                                                <span className={`h-2.5 w-2.5 rounded-[3px] ${getArticleCategoryStyle(category).fillClass}`} aria-hidden="true" />
                                                <span className="flex-1">{category}</span>
                                                <span className="font-num font-semibold text-slate-500">{count}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
}
