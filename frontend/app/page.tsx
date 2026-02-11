// app/page.tsx (HomePage - UI/UX改修版)
import Link from 'next/link';
import Image from 'next/image';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { getLatestArticles, getUniqueCategories } from '../lib/articles';
import { SparklesIcon, UsersIcon, FlagIcon, ChartBarIcon } from '@/components/Icons';
import type { Metadata } from 'next';

// ビルド時のAPI呼び出しを避けるため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

// SEO metadata
export const metadata: Metadata = {
    title: "UMA-FREE | 競馬データ分析・統計情報サイト",
    description: "競馬レースの統計分析データを完全無料で提供。過去5年以上のデータを機械学習で分析。中央・地方競馬の詳細な分析情報をご活用ください。",
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

    return (
        <div className="container py-6 space-y-10">
            {/* 1. ヒーロー＆高配当ランキング統合セクション */}
            <div className="space-y-6">
                {/* メインのヒーローセクション */}
                <section className="text-center p-8 sm:p-10 md:p-14 bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 rounded-2xl shadow-lg relative overflow-hidden">
                    {/* 装飾要素 */}
                    <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -mr-20 -mt-20 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-12 -mb-12 pointer-events-none" />

                    <div className="relative z-10">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight px-2">
                            登録不要・完全無料
                            <br />
                            AI競馬データ分析 UMA-FREE
                        </h1>
                        <p className="text-base md:text-lg text-blue-100 max-w-2xl mx-auto mb-8 px-4 leading-relaxed">
                            過去5年以上のレース結果をAIで分析。中央・地方の全レース対応。
                            <br className="hidden sm:block" />
                            あなたの競馬ライフをサポートします。
                        </p>
                        <Link
                            href={`/races/${todayStr}`}
                            className="inline-block bg-white hover:bg-gray-50 text-blue-700 font-bold py-3 sm:py-4 px-6 sm:px-10 rounded-lg transition-all duration-200 text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white min-h-[48px] leading-tight shadow-md hover:shadow-lg"
                        >
                            今日のデータ分析をチェック
                        </Link>
                    </div>
                </section>

                {/* 高配当的中ランキング（最優先で表示） */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                    <TopHitsDisplay />
                </section>
            </div>

            {/* 2. UMA-FREE価値提案セクション（3列カード版） */}
            <section className="bg-slate-50 p-6 sm:p-8 md:p-10 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-8 text-center">UMA-FREEの3つの競馬分析データ</h2>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
                        <div className="bg-blue-50 text-blue-600 rounded-full p-4 mb-4">
                            <UsersIcon className="w-7 h-7" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">完全無料・登録不要</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            中央・地方競馬の全レース分析が、登録・料金なしで利用可能。初心者から上級者までサポートします。
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
                        <div className="bg-blue-50 text-blue-600 rounded-full p-4 mb-4">
                            <ChartBarIcon className="w-7 h-7" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">AI偏差値分析</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            過去5年以上のレースデータを機械学習で解析。各馬の能力を偏差値で数値化します。
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
                        <div className="bg-blue-50 text-blue-600 rounded-full p-4 mb-4">
                            <FlagIcon className="w-7 h-7" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">対戦成績・枠順分析</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            出走馬同士の直接対決統計、脚質パターン予測、枠順傾向スコアを提供します。
                        </p>
                    </div>
                </div>
            </section>

            {/* 3. 今日の分析注目馬 */}
            <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3 border-b-2 border-primary pb-3">
                    <SparklesIcon className="w-7 h-7 text-amber-500" />
                    <span>今日の分析注目馬</span>
                </h2>
                <SpecialPickCard pick={specialPick} date={todayStr} />
            </section>

            {/* 4. 新着記事セクション */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-primary pb-3">
                        最新の分析記事
                    </h2>
                    <Link href="/articles" className="text-primary hover:text-primary-dark font-semibold text-sm">
                        すべて見る →
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {latestArticles.map((article) => (
                        <Link
                            href={`/articles/${article.slug}`}
                            key={article.slug}
                            className="block group border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 bg-white"
                        >
                            <div className="relative w-full h-32 sm:h-40 md:h-44 lg:h-48">
                                <Image
                                    src={article.eyecatch}
                                    alt={article.title}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                    style={{ objectFit: 'cover' }}
                                />
                            </div>

                            <div className="p-4">
                                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full mb-2">
                                    {article.category}
                                </span>

                                <h3
                                    className="font-bold text-sm mb-2 group-hover:text-primary-dark"
                                    style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        minHeight: '3rem'
                                    }}
                                >
                                    {article.title}
                                </h3>

                                <p className="text-gray-500 text-xs">
                                    {new Date(article.date).toLocaleDateString()}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* 5. 使い方セクション */}
            <section className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    3ステップで始める
                </h2>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-600">
                        <h3 className="font-bold text-lg text-blue-700 mb-3 flex items-center">
                            <span className="bg-blue-600 text-white rounded-full w-8 h-8 inline-flex items-center justify-center mr-3 text-sm font-bold shrink-0">1</span>
                            日付を選択
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            カレンダーから分析データを見たい日付を選択。過去・未来のレースも確認できます。
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
                        <h3 className="font-bold text-lg text-blue-600 mb-3 flex items-center">
                            <span className="bg-blue-500 text-white rounded-full w-8 h-8 inline-flex items-center justify-center mr-3 text-sm font-bold shrink-0">2</span>
                            競馬場を選択
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            中央・地方競馬のタブから、対象競馬場を選択。
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-400">
                        <h3 className="font-bold text-lg text-blue-500 mb-3 flex items-center">
                            <span className="bg-blue-400 text-white rounded-full w-8 h-8 inline-flex items-center justify-center mr-3 text-sm font-bold shrink-0">3</span>
                            統計データを活用
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            AI偏差値・過去対決・枠順など詳細な分析データをご活用ください。
                        </p>
                    </div>
                </div>
                <div className="mt-6 p-4 text-sm text-gray-500">
                    <p>本サイトは分析データの提供を目的としており、投票や投資の助言ではありません。20歳未満の馬券購入は法律で禁止されています。投票は自己責任で、余裕資金でお楽しみください。</p>
                </div>
            </section>

            {/* 6. よくある質問 */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                        よくある質問
                    </h2>
                    <Link href="/faq" className="text-primary hover:text-primary-dark font-semibold text-sm">
                        すべて見る →
                    </Link>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="border-l-4 border-blue-600 pl-5 py-2">
                        <h3 className="font-bold text-gray-700 mb-2">Q. 本当に無料ですか？</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            はい。すべてのデータ分析情報が完全無料です。登録も不要で、メールマガジンなども一切ありません。
                        </p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-5 py-2">
                        <h3 className="font-bold text-gray-700 mb-2">Q. データはいつ更新されますか？</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            毎日午前7時頃に前日の結果と翌日の分析データが更新されます。
                        </p>
                    </div>
                    <div className="border-l-4 border-blue-400 pl-5 py-2">
                        <h3 className="font-bold text-gray-700 mb-2">Q. 分析の精度はどのくらいですか？</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            実際の結果とは異なる場合があります。「高配当的中ランキング」で過去実績をご参考ください。
                        </p>
                    </div>
                    <div className="border-l-4 border-blue-300 pl-5 py-2">
                        <h3 className="font-bold text-gray-700 mb-2">Q. モバイルでも使えますか？</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            はい。PC・スマートフォン・タブレットすべてのデバイスに対応しています。
                        </p>
                    </div>
                </div>
            </section>

            {/* 7. 対応競馬場 */}
            <section className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    対応競馬場一覧
                </h2>
                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-bold text-lg mb-4 text-blue-700">中央競馬（10場）</h3>
                        <div className="flex flex-wrap gap-2">
                            {['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉'].map(venue => (
                                <span key={venue} className="inline-block bg-white text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                    {venue}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg mb-4 text-blue-700">地方競馬（14場）</h3>
                        <div className="flex flex-wrap gap-2">
                            {['門別', '盛岡', '水沢', '浦和', '船橋', '大井', '川崎', '金沢', '笠松', '名古屋', '園田', '姫路', '高知', '佐賀'].map(venue => (
                                <span key={venue} className="inline-block bg-white text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                    {venue}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-5">
                    ※ばんえい競馬（帯広）は対応しておりません。
                </p>
            </section>
        </div>
    );
}
