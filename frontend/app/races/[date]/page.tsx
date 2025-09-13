import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate } from "@/lib/api";
import { formatDate } from "@/lib/utils";

// ★★★ 1. dynamic = 'force-dynamic' を削除し、revalidate を追加 ★★★
export const revalidate = 3600; // 1時間 (3600秒) ごとにページを再生成

// ★★★ 2. generateStaticParams を追加してビルド時に静的ページを生成 ★★★
// 例：過去7日間と未来3日間のページを事前に生成
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


// 動的にメタデータを生成する (変更なし)
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

// メインのページコンポーネント（サーバーコンポーネント） (変更なし)
export default async function RacePage({ params }: { params: { date: string } }) {
    // サーバーサイドでデータを直接フェッチ
    const predictionData = await getPredictionsForDate(params.date);

    return (
        // RacePageClientに初期データとしてpredictionDataを渡す
        <RacePageClient
            initialDate={params.date}
            initialPredictionData={predictionData}
        />
    );
}