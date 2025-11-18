// app/page.tsx (HomePage 全文 - 修正済み)
import Link from 'next/link';
import Image from 'next/image';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { getLatestArticles } from '../lib/articles';
import { SparklesIcon } from '@/components/Icons';
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

    return (
        <div className="container py-6 space-y-10">
            {/* 1. ヒーロー＆高配当ランキング統合セクション */}
            <div className="space-y-8">
                {/* メインのヒーローセクション */}
                <section className="relative text-center p-10 md:p-14 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 rounded-2xl shadow-2xl overflow-hidden">
                    {/* 背景の装飾 */}
                    <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                    <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

                    <div className="relative z-10">
                        <div className="inline-block mb-4 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold">
                            🎯 完全無料・登録不要
                        </div>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-5 leading-tight tracking-tight">
                            AI競馬データ分析
                            <br />
                            <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">UMA-FREE</span>
                        </h1>
                        <p className="text-base md:text-xl text-white/90 max-w-3xl mx-auto mb-8 leading-relaxed">
                            過去5年以上のレース結果をAIが徹底分析。<br className="hidden sm:block" />
                            中央・地方競馬の全レース対応で、あなたの競馬ライフを強力サポート。
                        </p>
                        <Link
                            href={`/races/${todayStr}`}
                            className="inline-flex items-center justify-center bg-white hover:bg-gray-50 text-indigo-600 font-bold py-4 px-10 rounded-xl transition-all duration-300 text-lg shadow-xl hover:shadow-2xl hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
                        >
                            <span>今日のデータ分析をチェック</span>
                            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </Link>
                    </div>
                </section>

                {/* 高配当的中ランキング（最優先で表示） */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                    <TopHitsDisplay />
                </section>
            </div>

            {/* 2. UMA-FREE価値提案セクション（統合・簡潔版） */}
            <section className="relative bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-8 md:p-10 rounded-2xl shadow-lg border border-blue-100 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-200/30 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-10 text-center">
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">UMA-FREE</span>
                        の3つの競馬分析データ
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-300 border border-white/50">
                            <h3 className="font-bold text-xl text-primary mb-4 flex items-center gap-3">
                                <span className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold shadow-lg">✓</span>
                                完全無料・登録不要
                            </h3>
                            <p className="text-gray-700 leading-relaxed mb-3">
                                機械学習を使用した中央・地方競馬の全レース分析が、登録・料金一切なしで利用可能です。
                            </p>
                            <p className="text-gray-700 leading-relaxed">
                                初心者から上級者まで、データ分析をサポートします。
                            </p>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-300 border border-white/50">
                            <h3 className="font-bold text-xl text-primary mb-4 flex items-center gap-3">
                                <span className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold shadow-lg">✓</span>
                                3つの独自統計分析
                            </h3>
                            <ul className="space-y-3 text-gray-700">
                                <li className="flex items-start gap-2">
                                    <span className="text-indigo-600 font-bold mt-1">•</span>
                                    <span><strong className="text-indigo-700">過去対決成績分析</strong>：出走馬同士の直接対決統計データ</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-indigo-600 font-bold mt-1">•</span>
                                    <span><strong className="text-indigo-700">脚質パターン予測</strong>：過去データからの走法分類</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-indigo-600 font-bold mt-1">•</span>
                                    <span><strong className="text-indigo-700">枠順傾向スコア</strong>：競馬場・距離ごとの枠別成績分析</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. 今日の分析注目馬 */}
            <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3 border-b-3 border-primary pb-2">
                    <SparklesIcon className="w-7 h-7 text-accent-dark" />
                    <span>今日の分析注目馬</span>
                </h2>
                <SpecialPickCard pick={specialPick} date={todayStr} />
            </section>

            {/* 4. 新着記事セクション */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 border-b-3 border-primary pb-2">
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
                            className="block group border border-gray-200 rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 bg-white hover:-translate-y-2"
                        >
                            <div className="relative w-full h-32 sm:h-40 md:h-44 lg:h-48 overflow-hidden">
                                <Image
                                    src={article.eyecatch}
                                    alt={article.title}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                    style={{ objectFit: 'cover' }}
                                    className="group-hover:scale-110 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </div>

                            <div className="p-4">
                                <span className="inline-block bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-2">
                                    {article.category}
                                </span>

                                <h3
                                    className="font-bold text-sm mb-2 text-gray-800 group-hover:text-indigo-600 transition-colors duration-200"
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

                                <p className="text-gray-500 text-xs flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {new Date(article.date).toLocaleDateString()}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* 5. 使い方セクション */}
            <section className="relative bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl shadow-lg border border-gray-200 p-6 md:p-10 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-200/20 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-8 text-center">
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">3ステップ</span>で始める
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="group bg-white p-7 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border-l-4 border-indigo-500 hover:-translate-y-1">
                            <h3 className="font-bold text-xl text-indigo-600 mb-4 flex items-center">
                                <span className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full w-10 h-10 inline-flex items-center justify-center mr-3 text-base font-bold shadow-lg group-hover:scale-110 transition-transform">1</span>
                                日付を選択
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                カレンダーから分析データを見たい日付を選択。過去・未来のレースも確認できます。
                            </p>
                        </div>
                        <div className="group bg-white p-7 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border-l-4 border-amber-500 hover:-translate-y-1">
                            <h3 className="font-bold text-xl text-amber-600 mb-4 flex items-center">
                                <span className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-full w-10 h-10 inline-flex items-center justify-center mr-3 text-base font-bold shadow-lg group-hover:scale-110 transition-transform">2</span>
                                競馬場を選択
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                中央・地方競馬のタブから、対象競馬場を選択。
                            </p>
                        </div>
                        <div className="group bg-white p-7 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border-l-4 border-green-500 hover:-translate-y-1">
                            <h3 className="font-bold text-xl text-green-600 mb-4 flex items-center">
                                <span className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full w-10 h-10 inline-flex items-center justify-center mr-3 text-base font-bold shadow-lg group-hover:scale-110 transition-transform">3</span>
                                統計データを活用
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                AI偏差値・過去対決・枠順など詳細な分析データをご活用ください。
                            </p>
                        </div>
                    </div>
                <div className="mt-6 p-4 text-sm text-gray-700 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <p className="flex items-start gap-2">
                        <span className="text-yellow-600 text-lg">⚠️</span>
                        <span>本サイトは分析データの提供を目的としており、投票や投資の助言ではありません。20歳未満の馬券購入は法律で禁止されています。投票は自己責任で、余裕資金でお楽しみください。</span>
                    </p>
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
                    <div className="border-l-4 border-primary pl-4">
                        <h3 className="font-bold text-gray-700 mb-2">Q: 本当に無料ですか？</h3>
                        <p className="text-gray-600 text-sm">
                            A: すべてのデータ分析情報が完全無料です。登録も不要で、メールマガジンなども一切ありません。
                        </p>
                    </div>
                    <div className="border-l-4 border-accent pl-4">
                        <h3 className="font-bold text-gray-700 mb-2">Q: データはいつ更新されますか？</h3>
                        <p className="text-gray-600 text-sm">
                            A: 毎日午前7時頃に前日の結果と翌日の分析データが更新されます。
                        </p>
                    </div>
                    <div className="border-l-4 border-green-500 pl-4">
                        <h3 className="font-bold text-gray-700 mb-2">Q: 分析の精度はどのくらいですか？</h3>
                        <p className="text-gray-600 text-sm">
                            A: 実際の結果とは異なる場合があります。「高配当的中ランキング」で過去実績をご参考ください。
                        </p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4">
                        <h3 className="font-bold text-gray-700 mb-2">Q: モバイルでも使えますか？</h3>
                        <p className="text-gray-600 text-sm">
                            A: はい、PC・スマートフォン・タブレットすべてのデバイスに対応しています。
                        </p>
                    </div>
                </div>
            </section>

            {/* 7. 対応競馬場 */}
            <section className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    対応競馬場一覧
                </h2>
                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-bold text-lg mb-3 text-primary">中央競馬（10場）</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>札幌・函館・福島・新潟</div>
                            <div>東京・中山・中京・京都</div>
                            <div>阪神・小倉</div>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg mb-3 text-primary">地方競馬（14場）</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>門別・盛岡・水沢・浦和</div>
                            <div>船橋・大井・川崎・金沢</div>
                            <div>笠松・名古屋・園田・姫路</div>
                            <div>高知・佐賀</div>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                    ※ばんえい競馬（帯広）は対応しておりません。
                </p>
            </section>
        </div>
    );
}
