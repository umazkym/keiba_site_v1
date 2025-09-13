import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RaceDayPrediction } from "@/lib/types"; // ★★★ 型定義をインポート

export const revalidate = 3600;

export async function generateStaticParams() {
    const today = new Date();
    const paths = [];

    for (let i = -7; i <= 3; i++) {
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

// ▼▼▼▼▼ この部分を修正 ▼▼▼▼▼
export default async function RacePage({ params }: { params: { date: string } }) {
    let predictionData: RaceDayPrediction | null = null; // nullで初期化

    try {
        // サーバーサイドでデータを直接フェッチ
        predictionData = await getPredictionsForDate(params.date);
    } catch (error) {
        // ビルド時にエラーが発生してもコンソールに出力するだけで、ビルドは止めない
        console.error(`[Build Error] Failed to fetch data for ${params.date}:`, error);
    }

    return (
        // RacePageClientには null が渡される可能性がある
        <RacePageClient
            initialDate={params.date}
            initialPredictionData={predictionData}
        />
    );
}
// ▲▲▲▲▲ 修正ここまで ▲▲▲▲▲