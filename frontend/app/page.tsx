// frontend/app/page.tsx

import Link from 'next/link';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { SparklesIcon, UsersIcon, FlagIcon, ChartBarIcon } from '@/components/icons';
import type { Metadata } from 'next';

// SEO metadata
export const metadata: Metadata = {
    title: "UMA-FREE | 登録不要・完全無料のAI競馬予測サイト",
    description: "AI競馬予想が完全無料で使い放題！ 中央・地方の全レースを網羅し、あなたの馬券検討をサポートします。",
};

// JSTでの今日の日付文字列をサーバーサイドで生成する関数
const getTodayString = () => {
    const now = new Date();
    // タイムゾーンを考慮してJSTに変換
    const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    return jstDate.toISOString().split('T')[0];
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: React.ReactNode }) => (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center flex flex-col items-center transform transition-transform hover:-translate-y-1">
        <div className="bg-primary-light/20 text-primary-dark rounded-full p-3 mb-3">
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

    return (
        <div className="container py-4 space-y-8">
            {/* メインのヒーローセクション */}
            <section className="text-center my-4 p-8 bg-white rounded-xl shadow-lg border border-gray-200 bg-gradient-to-br from-indigo-50 to-white">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-primary-dark mb-2 leading-tight">
                    登録不要・完全無料の
                    <br />
                    AI競馬予測 UMA-FREE
                </h1>
                <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto mb-6">
                    AI競馬予想が完全無料で使い放題！
                    <br className="hidden sm:block" />
                    中央・地方の全レースを網羅し、あなたの馬券検討をサポートします。
                </p>
                {/* ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここを修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ */}
                <Link
                    href={`/races/${todayStr}`}
                    className="inline-block bg-primary hover:bg-primary-dark text-white hover:text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-0.5 text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-light"
                >
                    今日のAI予想を無料でチェック
                </Link>
                {/* ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ */}
            </section>

            {/* AI高配当ランキング */}
            <section>
                <TopHitsDisplay />
            </section>

            {/* 3つの特徴セクション */}
            <section className="my-8">
                <h2 className="text-xl sm:text-2xl font-bold text-center text-gray-800 mb-6">
                    UMA-FREEだけの
                    <br />
                    <span className="text-primary">3つの無料AIデータ</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={<UsersIcon className="w-8 h-8" />}
                        title="過去対決成績"
                        description={<>全出走馬の直接対決をAIが分析。<br/>馬同士の力関係が一目でわかります。</>}
                    />
                    <FeatureCard
                        icon={<FlagIcon className="w-8 h-8" />}
                        title="AIスタート位置取り予測"
                        description={<>過去データからレース展開を予測。<br/>逃げ・先行馬探しに最適です。</>}
                    />
                    <FeatureCard
                        icon={<ChartBarIcon className="w-8 h-8" />}
                        title="枠順傾向スコア"
                        description={<>競馬場・距離別に有利な枠を算出。<br/>コースの特性を馬券に活かせます。</>}
                    />
                </div>
            </section>

            {/* 今日のAI注目馬 */}
            <section className="my-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-3">
                    <SparklesIcon className="w-7 h-7 text-accent-dark" />
                    <span>今日のAI注目馬</span>
                </h2>
                <SpecialPickCard pick={specialPick} />
            </section>

            {/* 新規追加：使い方ガイド */}
            <section className="my-8 bg-white rounded-xl shadow-md border p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    UMA-FREEの使い方
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-lg mb-2 text-primary flex items-center">
                            <span className="bg-primary text-white rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-sm">1</span>
                            日付を選択
                        </h3>
                        <p className="text-gray-600">
                            ページ上部のカレンダーから、予測を見たい日付を選択します。
                            過去のレースも未来のレースも確認できます。
                        </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-lg mb-2 text-primary flex items-center">
                            <span className="bg-primary text-white rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-sm">2</span>
                            競馬場を選択
                        </h3>
                        <p className="text-gray-600">
                            中央競馬または地方競馬のタブを選び、
                            次に競馬場のタブを選択します。
                        </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-lg mb-2 text-primary flex items-center">
                            <span className="bg-primary text-white rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-sm">3</span>
                            レースを選択
                        </h3>
                        <p className="text-gray-600">
                            各競馬場の1R〜12Rのボタンから、
                            見たいレースを選択します。
                        </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-lg mb-2 text-primary flex items-center">
                            <span className="bg-primary text-white rounded-full w-6 h-6 inline-flex items-center justify-center mr-2 text-sm">4</span>
                            予測を確認
                        </h3>
                        <p className="text-gray-600">
                            AI偏差値や印を参考に、馬券検討に活用してください。
                            詳細データも無料で閲覧できます。
                        </p>
                    </div>
                </div>
            </section>

            {/* 新規追加：よくある質問 */}
            <section className="my-8 bg-gray-50 rounded-xl p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    よくある質問
                </h2>
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-bold text-gray-700 mb-2 text-lg">Q: 本当に無料ですか？</h3>
                        <p className="text-gray-600">
                            A: はい、すべての機能を完全無料でご利用いただけます。
                            会員登録も不要で、煩わしいメールマガジンの登録などもありません。
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-bold text-gray-700 mb-2 text-lg">Q: いつ更新されますか？</h3>
                        <p className="text-gray-600">
                            A: 毎日午前7時頃に、前日の結果と翌日の予測が更新されます。
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-bold text-gray-700 mb-2 text-lg">Q: 的中率はどのくらいですか？</h3>
                        <p className="text-gray-600">
                            A: AIの予測は参考情報としてご活用ください。
                            過去の的中実績は「高配当的中ランキング」でご確認いただけます。
                            最終的な馬券購入の判断は、ご自身の責任でお願いいたします。
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-bold text-gray-700 mb-2 text-lg">Q: スマートフォンでも使えますか？</h3>
                        <p className="text-gray-600">
                            A: はい、スマートフォン・タブレット・PCすべてのデバイスに対応しています。
                            どのデバイスでも快適にご利用いただけます。
                        </p>
                    </div>
                </div>
            </section>

            {/* 新規追加：競馬場情報 */}
            <section className="my-8 bg-white rounded-xl shadow-md border p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    対応競馬場一覧
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-bold text-lg mb-3 text-primary">中央競馬</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>• 札幌競馬場</div>
                            <div>• 函館競馬場</div>
                            <div>• 福島競馬場</div>
                            <div>• 新潟競馬場</div>
                            <div>• 東京競馬場</div>
                            <div>• 中山競馬場</div>
                            <div>• 中京競馬場</div>
                            <div>• 京都競馬場</div>
                            <div>• 阪神競馬場</div>
                            <div>• 小倉競馬場</div>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg mb-3 text-primary">地方競馬</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>• 門別競馬場</div>
                            <div>• 盛岡競馬場</div>
                            <div>• 水沢競馬場</div>
                            <div>• 浦和競馬場</div>
                            <div>• 船橋競馬場</div>
                            <div>• 大井競馬場</div>
                            <div>• 川崎競馬場</div>
                            <div>• 金沢競馬場</div>
                            <div>• 笠松競馬場</div>
                            <div>• 名古屋競馬場</div>
                            <div>• 園田競馬場</div>
                            <div>• 姫路競馬場</div>
                            <div>• 高知競馬場</div>
                            <div>• 佐賀競馬場</div>
                        </div>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                    ※ばんえい競馬（帯広）は対応しておりません。
                </p>
            </section>
        </div>
    );
}