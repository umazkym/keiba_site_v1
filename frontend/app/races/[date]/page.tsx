import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RaceDayPrediction } from "@/lib/types";
import { Suspense } from 'react'; // Suspenseをインポート
import { RaceTabsSkeleton } from "@/components/SkeletonLoader"; // スケルトンをインポート

export const revalidate = 3600; // 1時間ごとにページの再生成を試みる

export async function generateStaticParams() {
    const today = new Date();
    const paths = [];

    // Vercelのビルド時間を考慮し、静的生成するページを直近の日付に絞り込みます
    // これによりビルドが高速化し、安定性が向上します
    for (let i = -3; i <= 2; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        paths.push({ date: dateString });
    }

    return paths;
}

export async function generateMetadata({ params }: { params: { date: string } }): Promise<Metadata> {
    const formattedDate = formatDate(params.date);
    return {
        title: `${formattedDate}のAI競馬予測 | UMA-FREE`,
        description: `${formattedDate}の中央・地方競馬の全レースをAIが完全無料で予測。馬券検討に役立つデータを毎日更新。`,
        alternates: {
            canonical: `/races/${params.date}`,
        },
    };
}

// Suspenseのfallbackとして表示する、ページ全体のスケルトンUIを定義します
const RacePageSkeleton = () => (
    <div className="container py-4">
        {/* DateNavigator部分のスケルトン */}
        <div className="sticky top-16 z-40 bg-white/80 backdrop-blur-sm border-b shadow-md mb-4 p-2">
            <div className="animate-pulse flex items-center justify-between">
                <div className="bg-gray-300 h-9 w-16 rounded-md"></div>
                <div className="flex-grow flex justify-center">
                    <div className="bg-gray-300 h-9 w-64 rounded-md"></div>
                </div>
                <div className="w-12"></div>
            </div>
        </div>
        {/* レースタブ部分のスケルトン */}
        <RaceTabsSkeleton />
    </div>
);

export default async function RacePage({ params }: { params: { date: string } }) {
    let predictionData: RaceDayPrediction | null = null;

    try {
        // サーバーサイドでデータを直接フェッチします
        predictionData = await getPredictionsForDate(params.date);
    } catch (error) {
        // ビルド時にAPI接続等でエラーが発生してもビルド自体は止めないようにします
        // コンソールに警告を表示し、predictionDataはnullのままクライアントに渡します
        console.error(`[Build Warning] Failed to fetch initial data for ${params.date}. The page will show an error or fetch data on the client-side. Error:`, error);
    }

    return (
        // useSearchParamsを使用するコンポーネントを<Suspense>でラップします
        // fallbackには、データの読み込み中に表示するスケルトンUIを指定します
        <Suspense fallback={<RacePageSkeleton />}>
            <RacePageClient
                initialDate={params.date}
                initialPredictionData={predictionData}
            />
        </Suspense>
    );
}