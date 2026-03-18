// app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { getLatestArticles, getUniqueCategories, getAllArticles } from '../lib/articles';

import DisclaimerAlert from '@/components/DisclaimerAlert';
import { AdUnit } from '@/components/AdUnit';
import type { Metadata } from 'next';

// 動的コンテンツ（SpecialPick等）を含むため、常に最新データを取得
export const dynamic = 'force-dynamic';

const siteDescription = "競馬レースの統計分析データを完全無料で提供。過去5年以上のデータを機械学習で分析。中央・地方競馬の全レースのAI偏差値・対戦成績・枠順分析をご活用ください。";

// SEO metadata
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

// トップページ「よくある質問」セクション用データ（構造化データはFAQ専用ページにのみ配置）
const homepageFaqItems = [
    {
        question: '本当に無料ですか？',
        answer: 'はい。すべてのデータ分析情報が完全無料です。登録も不要で、メールマガジンなども一切ありません。',
    },
    {
        question: 'データはいつ更新されますか？',
        answer: '毎日午前7時頃に前日の結果と翌日の分析データが更新されます。',
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

// JSTでの今日の日付文字列をサーバーサイドで生成する関数
const getTodayString = () => {
    const now = new Date();
    const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    return jstDate.toISOString().split('T')[0];
};

export default async function HomePage() {
    const todayStr = getTodayString();
    const specialPick = await getSpecialPick(todayStr).catch(e => {
        console.error("Failed to fetch special pick:", e);
        return null;
    });

    const latestArticles = getLatestArticles(5);
    const categories = getUniqueCategories();
    const totalArticles = getAllArticles().length;

    return (
        <>
            <div className="py-4 flex flex-col" style={{ gap: 'var(--section-gap)' }}>
                {/* 1. ヒーローセクション */}
                <div className="space-y-4 sm:space-y-6">
                    <section className="hero">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_60%)]"></div>

                        <div className="relative z-10">
                            <h1>
                                登録不要・完全無料
                                <br />
                                <span>AI競馬データ分析</span>
                            </h1>
                            <p>
                                過去5年以上のレースデータを統計的に分析。中央・地方の全レースに対応。
                            </p>

                            <div className="hero-stats">
                                <div><div className="num">24</div><div className="lbl">対応競馬場</div></div>
                                <div><div className="num">5年+</div><div className="lbl">分析データ</div></div>
                                <div><div className="num">{totalArticles}</div><div className="lbl">分析記事</div></div>
                                <div><div className="num">毎日</div><div className="lbl">データ更新</div></div>
                            </div>

                            <Link
                                href={`/races/${todayStr}`}
                                className="hero-btn group"
                            >
                                今日のデータ分析をチェック <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                            </Link>
                        </div>
                    </section>

                    {/* 高配当的中ランキング */}
                    <section>
                        <TopHitsDisplay />
                    </section>
                </div>

                {/* 2. UMA-FREEとは */}
                <details className="card accordion" open={false}>
                    <summary>UMA-FREEとは<span className="chevron">▶</span></summary>
                    <div className="acc-body">
                        <p>UMA-FREEは、過去5年以上の中央競馬（JRA）および地方競馬（NAR）の膨大なレースデータを機械学習アルゴリズムで分析し、各出走馬の能力を独自の<strong>AI偏差値</strong>として数値化した競馬データ分析サイトです。会員登録やメールアドレスの入力は一切不要で、すべての分析データを完全無料でご利用いただけます。</p>
                        <p className="mt-2.5">さらに、出走馬同士の<strong>過去対決成績</strong>や、コース・距離ごとの<strong>枠順傾向スコア</strong>など、多角的なデータを組み合わせて提供。データは毎日自動更新されており、開催日の午前中には当日の全レース分析が完了します。</p>
                    </div>
                </details>

                {/* 広告①: UMA-FREEとは（アコーディオン）後に配置 */}
                <AdUnit slot="8529703346" placement="inline" />

                {/* 3. 3つの分析データ */}
                <section className="card">
                    <div className="p-4 sm:p-5">
                        <h2 className="sec-title justify-center"><span className="bar bg-primary"></span>3つの分析データ</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3.5">
                            <div className="card py-4 px-4 flex gap-3 items-start md:flex-col md:items-center md:text-center md:p-5 shadow-none hover-lift">
                                <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 text-primary border border-slate-200">
                                    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-[13px] sm:text-[14px] font-bold text-primary mb-1">完全無料・登録不要</h3>
                                    <p className="text-[11px] sm:text-xs text-secondary leading-[1.7]">
                                        全24競馬場をカバー。登録なしで全データにアクセス。
                                    </p>
                                </div>
                            </div>
                            <div className="card py-4 px-4 flex gap-3 items-start md:flex-col md:items-center md:text-center md:p-5 shadow-none hover-lift">
                                <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 text-primary border border-slate-200">
                                    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 9l-5 5-2-2-4 4"/></svg>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-[13px] sm:text-[14px] font-bold text-primary mb-1">AI偏差値分析</h3>
                                    <p className="text-[11px] sm:text-xs text-secondary leading-[1.7]">
                                        5年以上の過去データを機械学習で解析。能力を偏差値で数値化。
                                    </p>
                                </div>
                            </div>
                            <div className="card py-4 px-4 flex gap-3 items-start md:flex-col md:items-center md:text-center md:p-5 shadow-none hover-lift">
                                <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 text-primary border border-slate-200">
                                    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-[13px] sm:text-[14px] font-bold text-primary mb-1">対戦成績・枠順分析</h3>
                                    <p className="text-[11px] sm:text-xs text-secondary leading-[1.7]">
                                        直接対決の勝敗と枠順有利不利を統計スコアで表示。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. 今日の分析注目馬 */}
                <section>
                    <h2 className="sec-title"><span className="bar bg-accent"></span>今日の分析注目馬</h2>
                    <SpecialPickCard pick={specialPick} date={todayStr} />
                </section>

                {/* 本日の開催 */}
                <section className="venue-links">
                    <h2>
                        <svg width="18" height="18" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        本日の開催（{todayStr.split('-').slice(1).join('/')}）
                    </h2>
                    <div className="venue-links-label">中央競馬（JRA）</div>
                    <div className="venue-links-row">
                        <Link href={`/races/${todayStr}?venue=東京`} className="venue-link">東京</Link>
                        <Link href={`/races/${todayStr}?venue=中山`} className="venue-link">中山</Link>
                        <Link href={`/races/${todayStr}?venue=阪神`} className="venue-link">阪神</Link>
                        <Link href={`/races/${todayStr}`} className="venue-link text-xs !bg-transparent !border-transparent !text-secondary hover:!bg-slate-50">その他すべて→</Link>
                    </div>
                    <div className="venue-links-label">地方競馬（NAR）</div>
                    <div className="venue-links-row !mb-0">
                        <Link href={`/races/${todayStr}?venue=大井`} className="venue-link">大井</Link>
                        <Link href={`/races/${todayStr}?venue=川崎`} className="venue-link">川崎</Link>
                        <Link href={`/races/${todayStr}`} className="venue-link text-xs !bg-transparent !border-transparent !text-secondary hover:!bg-slate-50">その他すべて→</Link>
                    </div>
                </section>

                {/* 5. 新着記事セクション */}
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

                    {/* レスポンシブ記事一覧: モバイル横スクロール / デスクトップグリッド */}
                    <div className="flex overflow-x-auto gap-3 sm:gap-4 snap-x snap-mandatory scrollbar-hide pb-2 sm:pb-0 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-4 sm:overflow-visible">
                        {latestArticles.map((article) => (
                            <Link href={`/articles/${article.slug}`} key={article.slug} className="article-card-v group shrink-0 w-[240px] sm:w-auto snap-start sm:snap-align-none">
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
                    </div>
                </section>

                {/* 広告②: 記事セクション後（コンテンツ読了タイミング） */}
                <AdUnit slot="1489598374" placement="inline" />

                {/* 6. 使い方セクション */}
                <section className="card">
                    <div className="p-4 sm:p-5">
                        <h2 className="sec-title justify-center"><span className="bar bg-accent"></span>3ステップで始める</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
                            <div className="card py-3.5 px-3.5 flex items-start gap-2.5 shadow-none hover-lift">
                                <div className="w-8 h-8 bg-primary text-white rounded-[10px] flex items-center justify-center font-bold text-[13px] shrink-0">1</div>
                                <div>
                                    <h3 className="text-[13px] font-bold text-primary mb-0.5">日付を選択</h3>
                                    <p className="text-[11px] text-secondary leading-[1.7]">カレンダーから見たい日付を選択。</p>
                                </div>
                            </div>
                            <div className="card py-3.5 px-3.5 flex items-start gap-2.5 shadow-none hover-lift">
                                <div className="w-8 h-8 bg-primary text-white rounded-[10px] flex items-center justify-center font-bold text-[13px] shrink-0">2</div>
                                <div>
                                    <h3 className="text-[13px] font-bold text-primary mb-0.5">競馬場を選択</h3>
                                    <p className="text-[11px] text-secondary leading-[1.7]">中央・地方のタブから対象の競馬場を選択。</p>
                                </div>
                            </div>
                            <div className="card py-3.5 px-3.5 flex items-start gap-2.5 shadow-none hover-lift">
                                <div className="w-8 h-8 bg-primary text-white rounded-[10px] flex items-center justify-center font-bold text-[13px] shrink-0">3</div>
                                <div>
                                    <h3 className="text-[13px] font-bold text-primary mb-0.5">データを活用</h3>
                                    <p className="text-[11px] text-secondary leading-[1.7]">偏差値・対決成績・枠順傾向をご活用ください。</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 免責事項（独立セクション） */}
                <DisclaimerAlert />

                {/* 7. よくある質問 */}
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

                {/* 広告③: FAQ後のMultiplex枠 */}
                <AdUnit slot="9407670747" placement="inline" />

                {/* 8. 対応競馬場 */}
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
        </>
    );
}
