import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate } from "@/lib/api";
import { formatDate } from "@/lib/utils";

// ▼▼▼▼▼ ここから修正 ▼▼▼▼▼

// ISRとSSGの設定を削除し、動的レンダリングを強制する設定を追加
export const dynamic = 'force-dynamic';

// 以下の2つの設定（revalidate と generateStaticParams）を完全に削除します。
/*
export const revalidate = 3600;

export async function generateStaticParams() {
  // ... この関数全体を削除 ...
}
*/

// ▲▲▲▲▲ ここまで修正 ▲▲▲▲▲

// 動的にメタデータを生成する
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

// メインのページコンポーネント（サーバーコンポーネント）
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