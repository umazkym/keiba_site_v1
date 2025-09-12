import Link from 'next/link';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { SparklesIcon, UsersIcon, FlagIcon, ChartBarIcon } from '@/components/icons';
import type { Metadata } from 'next';

// SEO metadata
export const metadata: Metadata = {
    title: "UMA-FREE | 登録不要・完全無料のAI競馬予測サイト",
    description: "中央・地方の全レースをAIが完全無料で予測。独自の対戦データや展開予測で、あなたの競馬予想を強力サポートします。",
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
                <h1 className="text-3xl md:text-4xl font-extrabold text-primary-dark mb-2 leading-tight">
                    <span className="text-primary-dark">登録不要・完全無料</span>
                    <br />
                    AI競馬予測サイト UMA-FREE
                </h1>
                <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto mb-6">
                    中央・地方の全レース予測から、独自の対戦データまで。あなたの競馬予想に、AIの分析力をプラスします。
                </p>
                <Link
                    href={`/races/${todayStr}`}
                    className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 text-lg"
                >
                    本日の全レース予測を見る
                </Link>
            </section>

            {/* AI高配当ランキング */}
            <section>
                <TopHitsDisplay />
            </section>

            {/* 3つの特徴セクション */}
            <section className="my-8">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
                    UMA-FREEだけの<span className="text-primary">3つの無料AIデータ</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={<UsersIcon className="w-8 h-8" />}
                        title="過去対決成績"
                        description="全出走馬の直接対決をAIが分析。馬同士の力関係が一目でわかります。"
                    />
                    <FeatureCard
                        icon={<FlagIcon className="w-8 h-8" />}
                        title="AIスタート位置取り予測"
                        description="過去データからレース展開を予測。逃げ・先行馬探しに最適です。"
                    />
                    <FeatureCard
                        icon={<ChartBarIcon className="w-8 h-8" />}
                        title="枠順傾向スコア"
                        description="競馬場・距離別に有利な枠を算出。コースの特性を馬券に活かせます。"
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
        </div>
    );
}