// app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { getLatestArticles, getUniqueCategories, getAllArticles } from '../lib/articles';
import { ChartBarIcon } from '@/components/Icons';
import type { Metadata } from 'next';

// ビルド時のAPI呼び出しを避けるため、動的レンダリングを強制
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

// FAQ構造化データ
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
        answer: '実際の結果とは異なる場合があります。「高配当的中ランキング」で過去実績をご参考ください。',
    },
    {
        question: 'モバイルでも使えますか？',
        answer: 'はい。PC・スマートフォン・タブレットすべてのデバイスに対応しています。',
    },
];

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': homepageFaqItems.map(item => ({
        '@type': 'Question',
        'name': item.question,
        'acceptedAnswer': {
            '@type': 'Answer',
            'text': item.answer,
        },
    })),
};

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
            {/* FAQ構造化データ */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            <div className="container py-4 sm:py-6 space-y-6 sm:space-y-10">
                {/* 1. ヒーローセクション */}
                <div className="space-y-4 sm:space-y-6">
                    <section className="text-center px-5 py-6 sm:p-10 md:p-12 bg-blue-600 rounded-2xl">
                        <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white mb-3 sm:mb-4 leading-tight">
                            登録不要・完全無料
                            <br />
                            AI競馬データ分析
                            <br className="sm:hidden" />
                            <span className="sm:ml-2">UMA-FREE</span>
                        </h1>
                        <p className="text-sm sm:text-base md:text-lg text-blue-100 max-w-2xl mx-auto mb-5 sm:mb-6 leading-relaxed">
                            過去5年以上のレース結果をAIで分析。
                            <br className="sm:hidden" />
                            中央・地方の全レースに対応しています。
                        </p>

                        {/* サイト統計情報 - モバイルは2x2グリッド */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8 text-white/90 max-w-md sm:max-w-none mx-auto">
                            <div className="text-center bg-white/10 rounded-lg py-2 sm:py-0 sm:bg-transparent">
                                <div className="text-xl sm:text-3xl font-extrabold">24</div>
                                <div className="text-[11px] sm:text-sm text-blue-200">対応競馬場</div>
                            </div>
                            <div className="text-center bg-white/10 rounded-lg py-2 sm:py-0 sm:bg-transparent">
                                <div className="text-xl sm:text-3xl font-extrabold">5年+</div>
                                <div className="text-[11px] sm:text-sm text-blue-200">分析データ期間</div>
                            </div>
                            <div className="text-center bg-white/10 rounded-lg py-2 sm:py-0 sm:bg-transparent">
                                <div className="text-xl sm:text-3xl font-extrabold">{totalArticles}</div>
                                <div className="text-[11px] sm:text-sm text-blue-200">分析記事</div>
                            </div>
                            <div className="text-center bg-white/10 rounded-lg py-2 sm:py-0 sm:bg-transparent">
                                <div className="text-xl sm:text-3xl font-extrabold">毎日</div>
                                <div className="text-[11px] sm:text-sm text-blue-200">データ更新</div>
                            </div>
                        </div>

                        <Link
                            href={`/races/${todayStr}`}
                            className="inline-block bg-white hover:bg-gray-50 text-blue-700 font-bold py-3 sm:py-4 px-6 sm:px-10 rounded-lg transition-colors duration-200 text-sm sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white min-h-[44px] sm:min-h-[48px] leading-tight"
                        >
                            今日のデータ分析をチェック
                        </Link>
                    </section>

                    {/* 高配当的中ランキング */}
                    <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 md:p-8">
                        <TopHitsDisplay />
                    </section>
                </div>

                {/* 2. UMA-FREEとは（テキスト密度向上セクション） */}
                <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 md:p-8">
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-5 border-b-2 border-gray-300 pb-2 sm:pb-3">UMA-FREEとは</h2>
                    <div className="space-y-4 sm:space-y-5 text-gray-700 text-[13px] sm:text-base leading-[1.9] sm:leading-relaxed">
                        <p>
                            UMA-FREEは、過去5年以上の中央・地方競馬のレースデータを機械学習で分析し、各出走馬の能力を偏差値として数値化した競馬データ分析サイトです。会員登録不要で、すべて無料でご利用いただけます。
                        </p>
                        <p>
                            出走馬ごとの<strong>AI偏差値</strong>（着順・タイム・コース適性から算出）、<strong>過去対決成績</strong>、コース・距離ごとの<strong>枠順傾向スコア</strong>を提供しています。
                        </p>
                        <p>
                            データは毎日自動更新。開催日午前中には当日の全レース分析が完了します。初心者からベテランまで、客観的な判断材料としてご活用ください。
                        </p>
                    </div>
                </section>

                {/* 3. 3つの特長 - モバイルはアイコン+テキスト横並びでコンパクトに */}
                <section className="bg-gray-50 p-5 sm:p-8 md:p-10 rounded-xl border border-gray-200">
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-5 sm:mb-8 text-center">3つの分析データ</h2>
                    <div className="grid md:grid-cols-3 gap-3.5 sm:gap-6">
                        <div className="bg-white py-4 px-4 sm:p-6 rounded-xl border border-gray-200 flex items-center sm:flex-col sm:text-center gap-4 sm:gap-0">
                            <div className="bg-blue-50 text-blue-600 rounded-full p-3 sm:p-4 sm:mb-4 shrink-0">
                                <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[13px] sm:text-lg font-bold text-gray-800 mb-1 sm:mb-2">完全無料・登録不要</h3>
                                <p className="text-xs sm:text-sm text-gray-600 leading-[1.7]">
                                    中央・地方の全レース分析が登録なしで利用可能
                                </p>
                            </div>
                        </div>
                        <div className="bg-white py-4 px-4 sm:p-6 rounded-xl border border-gray-200 flex items-center sm:flex-col sm:text-center gap-4 sm:gap-0">
                            <div className="bg-blue-50 text-blue-600 rounded-full p-3 sm:p-4 sm:mb-4 shrink-0">
                                <ChartBarIcon className="w-5 h-5 sm:w-7 sm:h-7" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[13px] sm:text-lg font-bold text-gray-800 mb-1 sm:mb-2">AI偏差値分析</h3>
                                <p className="text-xs sm:text-sm text-gray-600 leading-[1.7]">
                                    5年以上のデータを機械学習で解析し偏差値化
                                </p>
                            </div>
                        </div>
                        <div className="bg-white py-4 px-4 sm:p-6 rounded-xl border border-gray-200 flex items-center sm:flex-col sm:text-center gap-4 sm:gap-0">
                            <div className="bg-blue-50 text-blue-600 rounded-full p-3 sm:p-4 sm:mb-4 shrink-0">
                                <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[13px] sm:text-lg font-bold text-gray-800 mb-1 sm:mb-2">対戦成績・枠順分析</h3>
                                <p className="text-xs sm:text-sm text-gray-600 leading-[1.7]">
                                    直接対決統計と枠順傾向スコアを提供
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. 今日の分析注目馬 */}
                <section>
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 border-b-2 border-gray-300 pb-2 sm:pb-3">
                        今日の分析注目馬
                    </h2>
                    <SpecialPickCard pick={specialPick} date={todayStr} />
                </section>

                {/* 5. 新着記事セクション */}
                <section>
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                            最新の分析記事
                        </h2>
                        <Link href="/articles" className="text-primary hover:text-primary-dark font-semibold text-xs sm:text-sm shrink-0 ml-3">
                            すべて見る →
                        </Link>
                    </div>

                    {/* モバイル: 横並びカード / デスクトップ: 5列グリッド */}
                    <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:gap-6">
                        {latestArticles.map((article) => (
                            <Link
                                href={`/articles/${article.slug}`}
                                key={article.slug}
                                className="flex sm:flex-col group border rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 bg-white"
                            >
                                <div className="relative w-[88px] h-[72px] sm:w-full sm:h-40 md:h-44 lg:h-48 shrink-0 rounded-l-lg sm:rounded-l-none overflow-hidden">
                                    <Image
                                        src={article.eyecatch}
                                        alt={article.title}
                                        fill
                                        sizes="(max-width: 640px) 88px, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                        style={{ objectFit: 'cover' }}
                                    />
                                </div>

                                <div className="py-2.5 px-3 sm:p-4 flex flex-col justify-center min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                        <span className="inline-block bg-blue-100 text-blue-800 text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                                            {article.category}
                                        </span>
                                        <span className="text-gray-400 text-[10px] sm:hidden whitespace-nowrap">
                                            {new Date(article.date).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <h3
                                        className="font-bold text-[13px] leading-snug sm:text-sm mb-0 sm:mb-2 group-hover:text-primary-dark"
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

                                    <p className="text-gray-500 text-xs hidden sm:block">
                                        {new Date(article.date).toLocaleDateString()}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* 6. 使い方セクション */}
                <section className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6 md:p-8">
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-5 sm:mb-6">
                        3ステップで始める
                    </h2>
                    <div className="grid md:grid-cols-3 gap-3.5 sm:gap-6">
                        <div className="bg-white py-3.5 px-4 sm:p-6 rounded-lg border border-gray-200 border-l-4 border-l-blue-600">
                            <h3 className="font-bold text-[13px] sm:text-lg text-blue-700 mb-2 sm:mb-3 flex items-center">
                                <span className="bg-blue-600 text-white rounded-full w-6 h-6 sm:w-8 sm:h-8 inline-flex items-center justify-center mr-2.5 sm:mr-3 text-xs sm:text-sm font-bold shrink-0">1</span>
                                日付を選択
                            </h3>
                            <p className="text-gray-600 text-xs sm:text-sm leading-[1.7] pl-[34px] sm:pl-0">
                                カレンダーから見たい日付を選択。過去も未来も確認できます。
                            </p>
                        </div>
                        <div className="bg-white py-3.5 px-4 sm:p-6 rounded-lg border border-gray-200 border-l-4 border-l-blue-600">
                            <h3 className="font-bold text-[13px] sm:text-lg text-blue-700 mb-2 sm:mb-3 flex items-center">
                                <span className="bg-blue-600 text-white rounded-full w-6 h-6 sm:w-8 sm:h-8 inline-flex items-center justify-center mr-2.5 sm:mr-3 text-xs sm:text-sm font-bold shrink-0">2</span>
                                競馬場を選択
                            </h3>
                            <p className="text-gray-600 text-xs sm:text-sm leading-[1.7] pl-[34px] sm:pl-0">
                                中央・地方のタブから対象の競馬場を選択。
                            </p>
                        </div>
                        <div className="bg-white py-3.5 px-4 sm:p-6 rounded-lg border border-gray-200 border-l-4 border-l-blue-600">
                            <h3 className="font-bold text-[13px] sm:text-lg text-blue-700 mb-2 sm:mb-3 flex items-center">
                                <span className="bg-blue-600 text-white rounded-full w-6 h-6 sm:w-8 sm:h-8 inline-flex items-center justify-center mr-2.5 sm:mr-3 text-xs sm:text-sm font-bold shrink-0">3</span>
                                データを活用
                            </h3>
                            <p className="text-gray-600 text-xs sm:text-sm leading-[1.7] pl-[34px] sm:pl-0">
                                偏差値・対決成績・枠順傾向などをご活用ください。
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-6 px-1 sm:p-4 text-[11px] sm:text-sm text-gray-400 sm:text-gray-500 leading-relaxed">
                        <p>本サイトは分析データの提供を目的としており、投票の助言ではありません。20歳未満の馬券購入は法律で禁止されています。</p>
                    </div>
                </section>

                {/* 7. よくある質問 */}
                <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 md:p-8">
                    <div className="flex items-center justify-between mb-5 sm:mb-6">
                        <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                            よくある質問
                        </h2>
                        <Link href="/faq" className="text-primary hover:text-primary-dark font-semibold text-xs sm:text-sm shrink-0 ml-3">
                            すべて見る →
                        </Link>
                    </div>
                    <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
                        {homepageFaqItems.map((item, index) => (
                            <div key={index} className="border-l-4 border-gray-300 pl-4 sm:pl-5 py-2 sm:py-2.5">
                                <h3 className="font-bold text-gray-700 mb-1.5 sm:mb-2 text-[13px] sm:text-base leading-snug">Q. {item.question}</h3>
                                <p className="text-gray-600 text-xs sm:text-sm leading-[1.8]">
                                    {item.answer}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 sm:mt-6 text-center">
                        <Link
                            href="/faq"
                            className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-6 rounded-lg transition-colors text-xs sm:text-sm"
                        >
                            よくある質問をもっと見る
                        </Link>
                    </div>
                </section>

                {/* 8. 対応競馬場 */}
                <section className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6 md:p-8">
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">
                        対応競馬場一覧
                    </h2>
                    <p className="text-gray-600 text-xs sm:text-sm leading-[1.7] mb-5 sm:mb-6">
                        中央競馬（JRA）10場と地方競馬（NAR）14場の全24競馬場に対応。全レースの分析データを無料提供しています。
                    </p>
                    <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
                        <div>
                            <h3 className="font-bold text-[13px] sm:text-lg mb-2 sm:mb-2.5 text-gray-800">中央競馬（10場）</h3>
                            <p className="text-[11px] sm:text-xs text-gray-500 mb-2.5 sm:mb-3 leading-relaxed">JRA管理の全国10競馬場。ダービーや有馬記念など開催。</p>
                            <div className="flex flex-wrap gap-2 sm:gap-2">
                                {['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉'].map(venue => (
                                    <span key={venue} className="inline-block bg-white text-gray-700 text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-lg border border-gray-200">
                                        {venue}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-[13px] sm:text-lg mb-2 sm:mb-2.5 text-gray-800">地方競馬（14場）</h3>
                            <p className="text-[11px] sm:text-xs text-gray-500 mb-2.5 sm:mb-3 leading-relaxed">南関東4場を含む全14場に対応。</p>
                            <div className="flex flex-wrap gap-2 sm:gap-2">
                                {['門別', '盛岡', '水沢', '浦和', '船橋', '大井', '川崎', '金沢', '笠松', '名古屋', '園田', '姫路', '高知', '佐賀'].map(venue => (
                                    <span key={venue} className="inline-block bg-white text-gray-700 text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-lg border border-gray-200">
                                        {venue}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-4 sm:mt-5">
                        ※ばんえい競馬（帯広）は対応しておりません。
                    </p>
                </section>
            </div>
        </>
    );
}
