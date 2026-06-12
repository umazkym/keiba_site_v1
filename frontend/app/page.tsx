import Link from 'next/link';
import Image from 'next/image';
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
import { getSpecialPick, getPredictionsForDate, getWeeklyGradeRaces, getTopPayoutHits } from '@/lib/api';
import { getLatestArticles, getAllArticles } from '../lib/articles';

import DisclaimerAlert from '@/components/DisclaimerAlert';
import { AdUnit } from '@/components/AdUnit';
import { NativeCardAd } from '@/components/NativeCardAd';
import { AffiliateSlot } from '@/components/AffiliateSlot';
import type { Metadata } from 'next';
import type { RaceDayPrediction } from '@/lib/types';
import { getRaceDetailPath } from '@/lib/race-url';

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
        answer: 'はい。すべてのデータ分析情報が完全無料です。登録も不要で、メールマガジンなども一切ありません。',
    },
    {
        question: 'データはいつ更新されますか？',
        answer: '毎日午前7時頃を目安に、前日の結果と当日の分析データを更新しています。',
    },
    {
        question: '分析の精度はどのくらいですか？',
        answer: '統計分析であるため、実際の結果とは異なる場合があります。過去の的中結果はサイト内でご確認いただけます。',
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



/* ------------------------------------------------------------------
 * 分析データ紹介 — ビジュアルプレビュー付きカード
 * 各レースページで見られる分析機能のミニチュアを表示し、
 * 新規ユーザーにサイトの価値を直感的に伝える。
 * 見出し・文言は他ページのトンマナに合わせ、落ち着いた表現にしている。
 * ------------------------------------------------------------------ */
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
        className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
    >
        <div className="mb-3 flex items-start gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400">{label}</p>
                <p className="truncate text-[13px] font-bold text-slate-900">{title}</p>
            </div>
        </div>
        <div className="mb-3 min-h-[76px]">{children}</div>
        <p className="mt-auto text-[11px] leading-relaxed text-slate-500">{description}</p>
    </div>
);

const AnalysisFeatures = () => (
    <section>
        <h2 className="sec-title">
            <span className="bar bg-secondary"></span>
            本サイト独自の分析データ
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FeaturePreviewCard
                label="独自指標"
                title="AI偏差値"
                icon={<Gauge className="h-4 w-4" />}
                description="過去走・適性・展開力を独自アルゴリズムで数値化し、出走全頭を一覧で比較できます"
            >
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>上位候補</span><span>偏差値</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[88%] rounded-full bg-blue-600" /></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[72%] rounded-full bg-slate-500" /></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[61%] rounded-full bg-amber-500" /></div>
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                label="レース展開"
                title="脚質予測"
                icon={<LineChart className="h-4 w-4" />}
                description="各コーナーでの隊列をシミュレーションし、展開の有利不利を確認できます"
            >
                <div className="flex h-[74px] items-end gap-1.5 rounded-lg bg-slate-50 px-3 pb-2 pt-3">
                    {[68, 42, 74, 52, 35].map((height, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center justify-end gap-1">
                            <div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${height}%` }} />
                            <span className="text-[9px] font-semibold text-slate-400">{index + 1}C</span>
                        </div>
                    ))}
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                label="馬同士の直接比較"
                title="対戦成績"
                icon={<Swords className="h-4 w-4" />}
                description="出走馬同士の過去の直接対決をマトリクスで表示しています"
            >
                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-bold">
                    {['+2', '0', '-1', '+1', '+3', '0', '-2', '+1', '+2'].map((value, index) => (
                        <span
                            key={`${value}-${index}`}
                            className={`rounded-md py-1.5 ${value.startsWith('+') ? 'bg-emerald-50 text-emerald-700' : value.startsWith('-') ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                            {value}
                        </span>
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
                            <div className="h-2 flex-1 rounded-full bg-slate-100">
                                <div className="h-2 rounded-full bg-amber-500" style={{ width: `${width}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                label="テキスト解説"
                title="AI分析コメント"
                icon={<ListChecks className="h-4 w-4" />}
                description="展開予想・適性評価・リスク要因をテキストで解説しています"
            >
                <div className="space-y-1.5 rounded-lg bg-slate-50 p-2.5 text-[10px] text-slate-600">
                    <div className="h-1.5 w-[92%] rounded-full bg-slate-300" />
                    <div className="h-1.5 w-[74%] rounded-full bg-slate-300" />
                    <div className="mt-2 flex flex-wrap gap-1">
                        <span className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-blue-700">展開</span>
                        <span className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-emerald-700">適性</span>
                        <span className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-amber-700">リスク</span>
                    </div>
                </div>
            </FeaturePreviewCard>
        </div>
    </section>
);

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

    return (
        <div className="py-4 flex flex-col" style={{ gap: 'var(--section-gap)' }}>
            <div className="space-y-4 sm:space-y-6">
                {/* ── ヒーロー ── */}
                <section className="hero">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_60%)]"></div>

                    <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
                        <h1>
                            登録不要・完全無料
                            <br />
                            <span className="text-white">AI競馬データ分析</span>
                        </h1>
                        <p>
                            過去5年以上のレースデータを統計的に分析。中央・地方の全レースに対応しています。
                        </p>

                        <div className="hero-stats">
                            <div><div className="num">24</div><div className="lbl">対応競馬場</div></div>
                            <div><div className="num">中央・地方</div><div className="lbl">全レース無料</div></div>
                            <div><div className="num">{totalArticles}</div><div className="lbl">分析記事</div></div>
                            <div><div className="num">毎日</div><div className="lbl">データ更新</div></div>
                        </div>

                        <div className="mt-6 sm:mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
                            <Link href={`/races/${todayStr}`} className="hero-btn group justify-center">
                                本日の分析を見る <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── 本日の開催 ── */}
                <section className="venue-links">
                    <h2>
                        <svg width="18" height="18" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        本日の開催（{formatShortDate(todayStr)}）
                    </h2>

                    {predictions && predictions.jra?.length > 0 && (
                        <>
                            <div className="venue-links-label">中央競馬（JRA）</div>
                            <div className="venue-links-row">
                                {(predictions.jra ?? []).slice(0, 4).map(venue => (
                                    <Link key={venue.venue_name} href={venue.races[0] ? getRaceDetailPath(todayStr, venue.venue_name, venue.races[0].race_number) : `/races/${todayStr}`} className="venue-link">
                                        {venue.venue_name}
                                    </Link>
                                ))}
                                {(predictions.jra?.length ?? 0) > 4 && (
                                    <Link href={`/races/${todayStr}`} className="venue-link text-xs !bg-transparent !border-transparent !text-secondary hover:!bg-slate-50">その他すべて→</Link>
                                )}
                            </div>
                        </>
                    )}

                    {predictions && predictions.nar?.length > 0 && (
                        <>
                            <div className="venue-links-label">地方競馬（NAR）</div>
                            <div className="venue-links-row !mb-0">
                                {(predictions.nar ?? []).slice(0, 4).map(venue => (
                                    <Link key={venue.venue_name} href={venue.races[0] ? getRaceDetailPath(todayStr, venue.venue_name, venue.races[0].race_number) : `/races/${todayStr}`} className="venue-link">
                                        {venue.venue_name}
                                    </Link>
                                ))}
                                {(predictions.nar?.length ?? 0) > 4 && (
                                    <Link href={`/races/${todayStr}`} className="venue-link text-xs !bg-transparent !border-transparent !text-secondary hover:!bg-slate-50">その他すべて→</Link>
                                )}
                            </div>
                            <AffiliateSlot
                                context="home_nar_voting"
                                raceType="nar"
                                selectionKey={todayStr}
                                className="mt-3"
                            />
                        </>
                    )}

                    {(!predictions || ((predictions.jra?.length ?? 0) === 0 && (predictions.nar?.length ?? 0) === 0)) && (
                        <p className="text-sm text-secondary mt-2">本日のレースデータはありません。</p>
                    )}
                </section>

                <AdUnit slot="8529703346" placement="inline" analyticsPlacement="home_after_today_races" />

                {/* ── 前回見ていたレース（リピーター向け） ── */}
                <RecentRaceReturn />

                {/* ── 今週の重賞 ── */}
                {weeklyGradeRaces && weeklyGradeRaces.length > 0 && (
                    <WeeklyGradeRaces races={weeklyGradeRaces} />
                )}

                {/* ── 高配当的中ランキング ── */}
                <section>
                    <TopHitsDisplay initialHits={topHits} />
                </section>
            </div>

            {/* ── 今日の分析注目馬 ── */}
            <section>
                <h2 className="sec-title"><span className="bar bg-accent"></span>今日の分析注目馬</h2>
                <SpecialPickCard pick={specialPick} date={todayStr} />
            </section>

            <AdUnit slot="1489598374" placement="inline" analyticsPlacement="home_after_special_pick" />

            {/* ── 分析データの紹介 ── */}
            <AnalysisFeatures />

            {/* ── 最新の分析記事 ── */}
            <section>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="sec-title !mb-0">
                        <span className="bar bg-secondary"></span>
                        最新の分析記事
                    </h2>
                    <Link href="/articles" className="text-[11px] sm:text-[12px] font-semibold text-secondary hover:text-primary transition-colors pr-1">
                        すべて見る →
                    </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {latestArticles.slice(0, 3).map((article) => (
                        <Link href={`/articles/${article.slug}`} key={article.slug} className="article-card-v group shrink-0 w-full snap-start sm:snap-align-none">
                            <div className="article-thumb-v">
                                <Image src={article.eyecatch} alt={article.title} fill className="object-cover transition-transform group-hover:scale-105 duration-500" sizes="(max-width: 640px) 240px, (max-width: 1024px) 50vw, 25vw" />
                            </div>
                            <div className="article-body-v">
                                <span className="article-cat">{article.category}</span>
                                <p className="article-title line-clamp-2">{article.title}</p>
                                <span className="article-date">{new Date(article.date).toLocaleDateString()}</span>
                            </div>
                        </Link>
                    ))}
                    <NativeCardAd slot="1489598374" variant="article" className="shrink-0 w-full" analyticsPlacement="home_article_feed_1" />

                    {latestArticles.slice(3, 6).map((article) => (
                        <Link href={`/articles/${article.slug}`} key={article.slug} className="article-card-v group shrink-0 w-full snap-start sm:snap-align-none">
                            <div className="article-thumb-v">
                                <Image src={article.eyecatch} alt={article.title} fill className="object-cover transition-transform group-hover:scale-105 duration-500" sizes="(max-width: 640px) 240px, (max-width: 1024px) 50vw, 25vw" />
                            </div>
                            <div className="article-body-v">
                                <span className="article-cat">{article.category}</span>
                                <p className="article-title line-clamp-2">{article.title}</p>
                                <span className="article-date">{new Date(article.date).toLocaleDateString()}</span>
                            </div>
                        </Link>
                    ))}
                    <NativeCardAd slot="9407670747" variant="article" className="shrink-0 w-full" analyticsPlacement="home_article_feed_2" />
                </div>
            </section>

            <DisclaimerAlert />

            <details className="card accordion" open={false}>
                <summary>よくある質問<span className="chevron">▶</span></summary>
                <div className="acc-body">
                    <div className="grid gap-3">
                        {homepageFaqItems.map((item, index) => (
                            <div key={index} className="border-l-[3px] border-secondary-light/30 pl-3.5 py-2">
                                <h4 className="text-[13px] font-bold mb-1">Q. {item.question}</h4>
                                <p className="text-[12px] text-secondary leading-[1.7]">
                                    {item.answer}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 text-center">
                        <Link href="/faq" className="text-xs font-bold text-primary hover:underline">FAQページへ →</Link>
                    </div>
                </div>
            </details>

            <AdUnit slot="9407670747" placement="inline" analyticsPlacement="home_after_faq" />

            <details className="card accordion" open={false}>
                <summary>対応競馬場一覧（全24場）<span className="chevron">▶</span></summary>
                <div className="acc-body">
                    <div className="mb-3.5">
                        <h4 className="text-[12px] font-bold mb-1.5">中央競馬（JRA）10場</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉'].map(venue => (
                                <span key={venue} className="text-[11px] font-semibold text-secondary bg-white border border-border px-2.5 py-1 rounded-md">
                                    {venue}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-[12px] font-bold mb-1.5">地方競馬（NAR）14場</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {['門別', '盛岡', '水沢', '浦和', '船橋', '大井', '川崎', '金沢', '笠松', '名古屋', '園田', '姫路', '高知', '佐賀'].map(venue => (
                                <span key={venue} className="text-[11px] font-semibold text-secondary bg-white border border-border px-2.5 py-1 rounded-md">
                                    {venue}
                                </span>
                            ))}
                        </div>
                    </div>
                    <p className="text-[11px] text-muted mt-2.5">
                        ※ばんえい競馬（帯広）は対応しておりません。
                    </p>
                </div>
            </details>
        </div>
    );
}
