import Link from 'next/link';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { getSpecialPick } from '@/lib/api';
import { SparklesIcon } from '@/components/icons';

// JSTでの今日の日付文字列をサーバーサイドで生成する関数
const getTodayString = () => {
    const now = new Date();
    // JSTに変換 (UTC+9)
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toISOString().split('T')[0];
};

export default async function HomePage() {
    const todayStr = getTodayString();
    const specialPick = await getSpecialPick(todayStr).catch(e => {
        console.error("Failed to fetch special pick:", e);
        return null;
    });

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="text-center my-4 md:my-6 p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <h1 className="text-3xl md:text-4xl font-bold text-primary-dark mb-2">
                    AI競馬予測へようこそ
                </h1>
                <p className="text-md md:text-lg text-gray-600">
                    AIによる高度な分析で、あなたの競馬予想をサポートします。
                </p>
                <Link
                    href={`/races/${todayStr}`}
                    className="mt-6 inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105"
                >
                    本日のレース予測を見る
                </Link>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* AI注目馬セクション */}
                <div className="lg:w-1/3 flex flex-col">
                    <h2 className="flex items-center text-2xl font-bold text-gray-800 mb-3 border-b-2 border-primary pb-2">
                        <SparklesIcon className="w-6 h-6 mr-2 text-accent-dark" />
                        本日のAI注目馬
                    </h2>
                    <div className="flex-grow">
                        <SpecialPickCard pick={specialPick} />
                    </div>
                </div>
                
                {/* 高配当ランキングセクション */}
                <div className="lg:w-2/3">
                    <TopHitsDisplay />
                </div>
            </div>
        </div>
    );
}