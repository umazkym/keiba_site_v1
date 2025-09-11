import Link from 'next/link';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { SparklesIcon, UsersIcon, FlagIcon, ChartBarIcon } from '@/components/icons';
import type { Metadata } from 'next';

// SEO metadata
export const metadata: Metadata = {
    title: "ウマFREE | 登録不要・完全無料のAI競馬予測サイト",
    description: "中央・地方の全レースをAIが完全無料で予測。独自の対戦データや展開予測で、あなたの競馬予想を強力サポートします。",
};

// JSTでの今日の日付文字列をサーバーサイドで生成する関数
const getTodayString = () => {
    const now = new Date();
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toISOString().split('T')[0];
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: React.ReactNode }) => (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 text-center flex flex-col items-center">
        <div className="bg-blue-100 text-primary-dark rounded-full p-2 mb-2">
            {icon}
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1 whitespace-nowrap">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
    </div>
);

export default async function HomePage() {
    const todayStr = getTodayString();
    const specialPick = await getSpecialPick(todayStr).catch(e => {
        console.error("Failed to fetch special pick:", e);
        return null;
    });

    return (
        <div className="container py-4">
            {/* AI高配当ランキング */}
            <div className="mb-4">
                <TopHitsDisplay />
            </div>

            {/* メインのヒーローセクション */}
            <div className="text-center my-4 md:my-5 p-6 bg-white rounded-lg shadow-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white">
                <h1 className="text-3xl md:text-4xl font-extrabold text-primary-dark mb-2 leading-tight">
                    <span className="text-accent-dark">登録不要・完全無料</span>
                    <br />
                    AI競馬予測サイト ウマFREE
                </h1>
                <p className="text-sm md:text-base text-gray-700 max-w-2xl mx-auto">
                    中央・地方の全レース予測から、独自の対戦データまで。
                    <br />
                    あなたの競馬予想に、AIの分析力をプラスします。
                </p>
                {/* 改善したCTA */}
                <div className="mt-5">
                    <p className="text-xs text-gray-600 mb-1">無料で始める</p>
                    <Link
                        href={`/races/${todayStr}`}
                        className="inline-block bg-accent hover:bg-accent-dark text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 text-base"
                    >
                        本日の全レース予測を見る
                    </Link>
                </div>
            </div>

            {/* 3つの特徴セクション */}
            <div className="my-8">
                <h2 className="text-xl font-bold text-center text-gray-800 mb-3">
                    ウマFREEだけの<span className="text-primary">3つの無料AIデータ</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FeatureCard
                        icon={<UsersIcon className="w-7 h-7" />}
                        title="AI総当たり対戦成績"
                        description={
                            <>
                                全出走馬の直接対決を分析。
                                <br />
                                馬同士の力関係が一目でわかります。
                            </>
                        }
                    />
                    <FeatureCard
                        icon={<FlagIcon className="w-7 h-7" />}
                        title="AIスタート予測"
                        description={
                            <>
                                過去データから展開を予測。
                                <br />
                                逃げ・先行馬探しに最適です。
                            </>
                        }
                    />
                    <FeatureCard
                        icon={<ChartBarIcon className="w-7 h-7" />}
                        title="コース別 馬番アドバンテージ"
                        description={
                            <>
                                過去データからコース形態を分析。
                                <br />
                                競馬場・距離別に馬番の有利不利を算出。
                            </>
                        }
                    />
                </div>
            </div>

            {/* 今日のAI注目馬 */}
            <div className="my-8">
                <h2 className="flex items-center text-xl font-bold text-gray-800 mb-2 border-b-2 border-primary pb-1">
                    <SparklesIcon className="w-5 h-5 mr-2 text-accent-dark" />
                    <span className="whitespace-nowrap">今日のAI注目馬</span>
                </h2>
                <div>
                    <SpecialPickCard pick={specialPick} />
                </div>
            </div>
        </div>
    );
}
