// app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { getLatestArticles, getUniqueCategories, getAllArticles } from '../lib/articles';
import { ChartBarIcon } from '@/components/Icons';
import DisclaimerAlert from '@/components/DisclaimerAlert';
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
            <div className="py-8 sm:py-12 flex flex-col gap-12 sm:gap-16">
                {/* 1. ヒーローセクション */}
                <div className="space-y-6 sm:space-y-8">
                    <section className="text-center px-4 py-10 sm:p-16 md:p-20 bg-primary rounded-3xl shadow-elevated relative overflow-hidden">
                        {/* プレミアムな放射状グラデーション */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-primary to-primary-dark"></div>

                        <div className="relative z-10">
                            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 sm:mb-8 leading-tight tracking-tight drop-shadow-sm">
                                登録不要・完全無料
                                <br />
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-indigo-200">
                                    AI競馬データ分析
                                </span>
                            </h1>
                            <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed font-medium">
                                過去5年以上のレースデータを統計的に分析。
                                <br className="sm:hidden" />
                                中央・地方の全レースに対応しています。
                            </p>

                            {/* サイト統計情報 - モバイルは2x2グリッド */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 mb-10 sm:mb-14 text-white/90 max-w-lg sm:max-w-4xl mx-auto divide-x divide-slate-700/50">
                                <div className="text-center">
                                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight">24</div>
                                    <div className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide">対応競馬場</div>
                                </div>
                                <div className="text-center pl-4">
                                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight">5年+</div>
                                    <div className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide">分析データ期間</div>
                                </div>
                                <div className="text-center pl-4 border-l border-slate-700/50 sm:border-l-0">
                                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight">{totalArticles}</div>
                                    <div className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide">分析記事</div>
                                </div>
                                <div className="text-center pl-4">
                                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight">毎日</div>
                                    <div className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide">データ更新</div>
                                </div>
                            </div>

                            <Link
                                href={`/races/${todayStr}`}
                                className="inline-flex items-center justify-center bg-white hover:bg-slate-50 text-primary-dark font-bold py-4 sm:py-5 px-8 sm:px-12 rounded-2xl transition-all duration-300 text-sm sm:text-lg shadow-elevated hover:shadow-[0_10px_40px_-10px_rgba(255,255,255,0.3)] active:scale-95 transform hover:-translate-y-0.5"
                            >
                                今日のデータ分析をチェック
                            </Link>
                        </div>
                    </section>

                    {/* 高配当的中ランキング */}
                    <section className="bg-white rounded-2xl sm:border sm:border-slate-100 mt-2 sm:mt-0 px-2 sm:p-8 sm:shadow-soft">
                        <TopHitsDisplay />
                    </section>
                </div>

                {/* 2. UMA-FREEとは */}
                <section className="bg-white rounded-2xl sm:border sm:border-slate-100 p-6 md:p-10 shadow-soft max-w-[1000px] mx-auto w-full">
                    <h2 className="text-xl sm:text-2xl font-bold text-primary mb-6 text-center">
                        UMA-FREEとは
                    </h2>
                    <div className="space-y-4 sm:space-y-5 text-text-secondary text-base leading-relaxed max-w-3xl mx-auto text-left mt-6">
                        <p>
                            UMA-FREEは、過去5年以上の中央競馬（JRA）および地方競馬（NAR）の膨大なレースデータを機械学習アルゴリズムで分析し、各出走馬の能力を独自の<strong>AI偏差値</strong>として数値化した競馬データ分析サイトです。会員登録やメールアドレスの入力は一切不要で、すべての分析データを完全無料でご利用いただけます。
                        </p>
                        <p>
                            AI偏差値は、過去の着順・走破タイム・上がりタイム・コース適性・馬場状態への対応力など、複数の要素を統計的に分析して算出しています。単なる人気順や直近の成績だけではなく、長期的なデータに基づいた客観的な能力評価を提供することが特徴です。
                        </p>
                        <p>
                            さらに、出走馬同士の<strong>過去対決成績</strong>（直接対決での勝敗記録）や、コース・距離ごとの<strong>枠順傾向スコア</strong>（統計的にどの枠順が有利かを数値化したもの）など、多角的なデータを組み合わせて提供しています。これにより、1つの指標だけでは見えない馬の総合的な力関係を把握できます。
                        </p>
                        <p>
                            データは毎日自動更新されており、開催日の午前中には当日の全レース分析が完了します。競馬初心者の方はAI偏差値を目安に実力馬を探す入り口として、ベテランの方は自身の分析を補完する客観的な判断材料としてご活用ください。
                        </p>
                    </div>
                </section>

                {/* 3. 3つの分析データ */}
                <section className="bg-surface p-6 md:p-10 rounded-2xl border border-border">
                    <h2 className="text-xl sm:text-2xl font-bold text-primary mb-8 text-center">3つの分析データ</h2>
                    <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-white py-6 px-5 sm:p-8 rounded-2xl border border-slate-100 shadow-soft flex items-center sm:flex-col sm:text-center gap-4 sm:gap-0 hover-lift">
                            <div className="bg-slate-50 text-primary rounded-2xl p-4 sm:p-5 sm:mb-5 shrink-0 border border-slate-100">
                                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm sm:text-lg font-bold text-primary mb-2 sm:mb-3">完全無料・登録不要</h3>
                                <p className="text-xs sm:text-sm text-text-secondary leading-[1.8]">
                                    中央競馬（JRA）10場・地方競馬（NAR）14場の全24競馬場をカバー。会員登録やメールアドレスの入力なしで、全レースの分析データにアクセスできます。
                                </p>
                            </div>
                        </div>
                        <div className="bg-white py-6 px-5 sm:p-8 rounded-2xl border border-slate-100 shadow-soft flex items-center sm:flex-col sm:text-center gap-4 sm:gap-0 hover-lift">
                            <div className="bg-slate-50 text-primary rounded-2xl p-4 sm:p-5 sm:mb-5 shrink-0 border border-slate-100">
                                <ChartBarIcon className="w-8 h-8 sm:w-10 sm:h-10" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm sm:text-lg font-bold text-primary mb-2 sm:mb-3">AI偏差値分析</h3>
                                <p className="text-xs sm:text-sm text-text-secondary leading-[1.8]">
                                    5年以上の過去レースデータを機械学習アルゴリズムで解析。着順・タイム・コース適性・馬場対応力を総合的に評価し、各馬の能力を偏差値として数値化しています。
                                </p>
                            </div>
                        </div>
                        <div className="bg-white py-6 px-5 sm:p-8 rounded-2xl border border-slate-100 shadow-soft flex items-center sm:flex-col sm:text-center gap-4 sm:gap-0 hover-lift">
                            <div className="bg-slate-50 text-primary rounded-2xl p-4 sm:p-5 sm:mb-5 shrink-0 border border-slate-100">
                                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm sm:text-lg font-bold text-primary mb-2 sm:mb-3">対戦成績・枠順分析</h3>
                                <p className="text-xs sm:text-sm text-text-secondary leading-[1.8]">
                                    出走馬同士の直接対決での勝敗記録と、コース・距離別の枠順有利不利を統計スコアで表示。複数の指標を組み合わせて多角的に分析できます。
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. 今日の分析注目馬 */}
                <section>
                    <h2 className="text-lg sm:text-2xl font-bold text-primary mb-4 sm:mb-6 border-b border-gray-200 pb-2 sm:pb-3 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-accent rounded-full"></span>
                        今日の分析注目馬
                    </h2>
                    <SpecialPickCard pick={specialPick} date={todayStr} />
                </section>

                {/* 5. 新着記事セクション */}
                <section>
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <h2 className="text-lg sm:text-2xl font-bold text-primary flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-secondary rounded-full"></span>
                            最新の分析記事
                        </h2>
                        <Link href="/articles" className="text-text-secondary hover:text-primary font-semibold text-xs sm:text-sm shrink-0 ml-3 transition-colors">
                            すべて見る →
                        </Link>
                    </div>

                    {/* モバイル: 横並びカード / デスクトップ: 5列グリッド */}
                    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:gap-5">
                        {latestArticles.map((article) => (
                            <Link
                                href={`/articles/${article.slug}`}
                                key={article.slug}
                                className="flex sm:flex-col items-center sm:items-stretch group border border-slate-200 rounded-xl overflow-hidden shadow-sm hover-lift bg-white"
                            >
                                <div className="relative w-[88px] h-[72px] sm:w-full sm:h-40 md:h-44 lg:h-48 shrink-0 rounded-l-lg sm:rounded-l-none overflow-hidden bg-slate-100">
                                    <Image
                                        src={article.eyecatch}
                                        alt={article.title}
                                        fill
                                        sizes="(max-width: 640px) 88px, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                        style={{ objectFit: 'cover' }}
                                        className="group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>

                                <div className="py-2.5 px-3 sm:p-4 flex flex-col justify-center min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                        <span className="inline-block bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                                            {article.category}
                                        </span>
                                        <span className="text-text-muted text-xs sm:hidden whitespace-nowrap">
                                            {new Date(article.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h3
                                        className="font-bold text-text-primary text-sm sm:text-base leading-snug sm:leading-relaxed mb-0 sm:mb-3 group-hover:text-primary transition-colors"
                                        style={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {article.title}
                                    </h3>

                                    <p className="text-text-muted text-xs hidden sm:block">
                                        {new Date(article.date).toLocaleDateString()}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* 6. 使い方セクション */}
                <section className="bg-surface rounded-2xl border border-border p-6 md:p-10">
                    <h2 className="text-xl sm:text-2xl font-bold text-primary mb-8 text-center">
                        3ステップで始める
                    </h2>
                    <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-white py-5 px-5 sm:p-8 rounded-2xl border border-slate-100 shadow-soft">
                            <h3 className="font-bold text-sm sm:text-lg text-primary mb-3 flex items-center">
                                <span className="bg-primary text-white rounded-xl w-8 h-8 sm:w-10 sm:h-10 inline-flex items-center justify-center mr-3 text-sm sm:text-base font-bold shrink-0">1</span>
                                日付を選択
                            </h3>
                            <p className="text-text-secondary text-xs sm:text-sm leading-[1.8] pl-[44px] sm:pl-[52px]">
                                カレンダーから見たい日付を選択。過去も未来も確認できます。
                            </p>
                        </div>
                        <div className="bg-white py-5 px-5 sm:p-8 rounded-2xl border border-slate-100 shadow-soft">
                            <h3 className="font-bold text-sm sm:text-lg text-primary mb-3 flex items-center">
                                <span className="bg-primary text-white rounded-xl w-8 h-8 sm:w-10 sm:h-10 inline-flex items-center justify-center mr-3 text-sm sm:text-base font-bold shrink-0">2</span>
                                競馬場を選択
                            </h3>
                            <p className="text-text-secondary text-xs sm:text-sm leading-[1.8] pl-[44px] sm:pl-[52px]">
                                中央・地方のタブから対象の競馬場を選択。
                            </p>
                        </div>
                        <div className="bg-white py-5 px-5 sm:p-8 rounded-2xl border border-slate-100 shadow-soft">
                            <h3 className="font-bold text-sm sm:text-lg text-primary mb-3 flex items-center">
                                <span className="bg-primary text-white rounded-xl w-8 h-8 sm:w-10 sm:h-10 inline-flex items-center justify-center mr-3 text-sm sm:text-base font-bold shrink-0">3</span>
                                データを活用
                            </h3>
                            <p className="text-text-secondary text-xs sm:text-sm leading-[1.8] pl-[44px] sm:pl-[52px]">
                                偏差値・対決成績・枠順傾向などをご活用ください。
                            </p>
                        </div>
                    </div>
                </section>

                {/* 免責事項（独立セクション） */}
                <div className="max-w-4xl mx-auto w-full">
                    <DisclaimerAlert />
                </div>

                {/* 7. よくある質問 */}
                <section className="bg-white rounded-2xl border border-slate-100 p-6 md:p-10 shadow-soft">
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <h2 className="text-xl sm:text-2xl font-bold text-primary">
                            よくある質問
                        </h2>
                        <Link href="/faq" className="text-primary hover:text-primary-dark font-semibold text-xs sm:text-sm shrink-0 ml-3">
                            すべて見る →
                        </Link>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
                        {homepageFaqItems.map((item, index) => (
                            <div key={index} className="border-l-[3px] border-secondary-light/30 pl-4 sm:pl-5 py-1">
                                <h3 className="font-bold text-text-primary mb-2 text-sm sm:text-base leading-snug">Q. {item.question}</h3>
                                <p className="text-text-secondary text-xs sm:text-sm leading-[1.8]">
                                    {item.answer}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-10 text-center">
                        <Link
                            href="/faq"
                            className="inline-flex items-center justify-center bg-primary hover:bg-primary-light text-white font-bold py-3 px-8 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            よくある質問をご確認
                        </Link>
                    </div>
                </section>

                {/* 8. 対応競馬場 */}
                <section className="bg-slate-50 rounded-2xl border border-slate-200 p-6 md:p-10 shadow-inner">
                    <h2 className="text-xl sm:text-2xl font-bold text-primary mb-3 sm:mb-4 text-center">
                        対応競馬場一覧
                    </h2>
                    <p className="text-text-secondary text-xs sm:text-sm leading-[1.8] mb-6 sm:mb-8">
                        中央競馬（JRA）10場と地方競馬（NAR）14場の全24競馬場に対応。全レースの分析データを無料提供しています。
                    </p>
                    <div className="grid md:grid-cols-2 gap-8 sm:gap-10">
                        <div>
                            <h3 className="font-bold text-sm sm:text-lg mb-2 sm:mb-3 text-text-primary">中央競馬（10場）</h3>
                            <p className="text-xs text-text-muted mb-3 sm:mb-4 leading-relaxed">JRA管理の全国10競馬場。ダービーや有馬記念など開催。</p>
                            <div className="flex flex-wrap gap-2.5 sm:gap-3">
                                {['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉'].map(venue => (
                                    <span key={venue} className="inline-block bg-white text-text-secondary text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                        {venue}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-sm sm:text-lg mb-2 sm:mb-3 text-text-primary">地方競馬（14場）</h3>
                            <p className="text-xs text-text-muted mb-3 sm:mb-4 leading-relaxed">南関東4場を含む全14場に対応。</p>
                            <div className="flex flex-wrap gap-2.5 sm:gap-3">
                                {['門別', '盛岡', '水沢', '浦和', '船橋', '大井', '川崎', '金沢', '笠松', '名古屋', '園田', '姫路', '高知', '佐賀'].map(venue => (
                                    <span key={venue} className="inline-block bg-white text-text-secondary text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                        {venue}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-4 sm:mt-5">
                        ※ばんえい競馬（帯広）は対応しておりません。
                    </p>
                </section>
            </div>
        </>
    );
}
