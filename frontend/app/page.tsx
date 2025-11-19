// app/page.tsx (HomePage 全文 - 修正済み)
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

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: React.ReactNode }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
        <div className="bg-primary-light/10 text-primary-dark rounded-full p-3 mb-3">
            {icon}
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">{title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
);

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
                <section className="text-center p-6 sm:p-8 md:p-10 bg-white rounded-xl shadow-sm border border-gray-200">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-primary-dark mb-4 leading-tight px-2">
                        登録不要・完全無料
                        <br />
                        AI競馬データ分析 UMA-FREE
                    </h1>
                    <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto mb-6 px-4 leading-relaxed">
                        過去5年以上のレース結果をAIで分析。中央・地方の全レース対応。
                        <br className="hidden sm:block" />
                        あなたの競馬ライフをサポートします。
                    </p>
                    <Link
                        href={`/races/${todayStr}`}
                        className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors duration-200 text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-light min-h-[48px] leading-tight"
                    >
                        今日のデータ分析をチェック
                    </Link>
                </section>

                {/* 高配当的中ランキング（最優先で表示） */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                    <TopHitsDisplay />
                </section>
            </div>

            {/* 2. UMA-FREE価値提案セクション（統合・簡潔版） */}
            <section className="bg-blue-50 p-6 sm:p-8 md:p-10 rounded-xl shadow-sm border border-blue-100">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-6 sm:mb-8 text-center px-2">UMA-FREEの3つの競馬分析データ</h2>
                <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
                    <div>
                        <h3 className="font-bold text-lg text-primary mb-3 flex items-center gap-2">
                            <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</span>
                            完全無料・登録不要
                        </h3>
                        <p className="text-gray-700 leading-relaxed mb-4">
                            機械学習を使用した中央・地方競馬の全レース分析が、登録・料金一切なしで利用可能です。
                        </p>
                        <p className="text-gray-700 leading-relaxed">
                            初心者から上級者まで、データ分析をサポートします。
                        </p>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-primary mb-3 flex items-center gap-2">
                            <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</span>
                            3つの独自統計分析
                        </h3>
                        <ul className="space-y-2 text-gray-700">
                            <li>• <strong>過去対決成績分析</strong>：出走馬同士の直接対決統計データ</li>
                            <li>• <strong>脚質パターン予測</strong>：過去データからの走法分類</li>
                            <li>• <strong>枠順傾向スコア</strong>：競馬場・距離ごとの枠別成績分析</li>
                        </ul>
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
            <section className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    3ステップで始める
                </h2>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-primary">
                        <h3 className="font-bold text-lg text-primary mb-3 flex items-center">
                            <span className="bg-primary text-white rounded-full w-8 h-8 inline-flex items-center justify-center mr-2 text-sm font-bold">1</span>
                            日付を選択
                        </h3>
                        <p className="text-gray-600">
                            カレンダーから分析データを見たい日付を選択。過去・未来のレースも確認できます。
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-accent">
                        <h3 className="font-bold text-lg text-accent mb-3 flex items-center">
                            <span className="bg-accent text-white rounded-full w-8 h-8 inline-flex items-center justify-center mr-2 text-sm font-bold">2</span>
                            競馬場を選択
                        </h3>
                        <p className="text-gray-600">
                            中央・地方競馬のタブから、対象競馬場を選択。
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-green-500">
                        <h3 className="font-bold text-lg text-green-600 mb-3 flex items-center">
                            <span className="bg-green-500 text-white rounded-full w-8 h-8 inline-flex items-center justify-center mr-2 text-sm font-bold">3</span>
                            統計データを活用
                        </h3>
                        <p className="text-gray-600">
                            AI偏差値・過去対決・枠順など詳細な分析データをご活用ください。
                        </p>
                    </div>
                </div>
                <div className="mt-6 p-4text-sm text-gray-700">
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
                    <div className="border-l-4 border-primary pl-4 py-1">
                        <h3 className="font-bold text-gray-700 mb-2">Q: 本当に無料ですか？</h3>
                        <p className="text-gray-600 text-sm">
                            A: すべてのデータ分析情報が完全無料です。登録も不要で、メールマガジンなども一切ありません。
                        </p>
                    </div>
                    <div className="border-l-4 border-accent pl-4 py-1">
                        <h3 className="font-bold text-gray-700 mb-2">Q: データはいつ更新されますか？</h3>
                        <p className="text-gray-600 text-sm">
                            A: 毎日午前7時頃に前日の結果と翌日の分析データが更新されます。
                        </p>
                    </div>
                    <div className="border-l-4 border-green-500 pl-4 py-1">
                        <h3 className="font-bold text-gray-700 mb-2">Q: 分析の精度はどのくらいですか？</h3>
                        <p className="text-gray-600 text-sm">
                            A: 実際の結果とは異なる場合があります。「高配当的中ランキング」で過去実績をご参考ください。
                        </p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4 py-1">
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
