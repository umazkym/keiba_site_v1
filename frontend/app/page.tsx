import Link from 'next/link';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { SparklesIcon, UsersIcon, FlagIcon, ChartBarIcon } from '@/components/icons';

// JSTでの今日の日付文字列をサーバーサイドで生成する関数
const getTodayString = () => {
    const now = new Date();
    // JSTに変換 (UTC+9)
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toISOString().split('T')[0];
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
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
            {/* ★★★ ここを修正しました ★★★ */}
            {/* AI高配当ランキング (余白を日付ページと統一) */}
            <div className="mb-4">
                <TopHitsDisplay />
            </div>
            
            {/* メインのヒーローセクション */}
            <div className="text-center my-4 md:my-5 p-6 bg-white rounded-lg shadow-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white">
                <h1 className="text-3xl md:text-4xl font-extrabold text-primary-dark mb-2 leading-tight">
                    今日の競馬、迷ったら。
                    <br/>
                    無料で使えるAI予想
                </h1>
                <p className="text-sm md:text-base text-gray-700 max-w-2xl mx-auto">
                    会員登録なしですぐに見れる！中央・地方競馬の全レースを<strong className="text-accent-dark">AI</strong>が徹底分析。
                </p>
                <Link
                    href={`/races/${todayStr}`}
                    className="mt-5 inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 text-base"
                >
                    本日のレース予測を見る
                </Link>
            </div>

            {/* 3つの特徴セクション */}
            <div className="my-8">
                <h2 className="text-xl font-bold text-center text-gray-800 mb-3">ウマFREEだけの<span className="text-primary">3つの無料AIデータ</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FeatureCard
                        icon={<UsersIcon className="w-7 h-7" />}
                        title="AI総当たり対戦績"
                        description="全出走馬の直接対決を分析。馬同士の本当の力関係が一目でわかります。"
                    />
                    <FeatureCard
                        icon={<FlagIcon className="w-7 h-7" />}
                        title="AIスタート予測"
                        description="過去データから展開を予測。逃げ・先行馬探しに最適です。"
                    />
                    <FeatureCard
                        icon={<ChartBarIcon className="w-7 h-7" />}
                        title="コース別 馬番アドバンテージ"
                        description="競馬場・距離・馬場ごとの有利な馬番を算出し、予想をサポート。"
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