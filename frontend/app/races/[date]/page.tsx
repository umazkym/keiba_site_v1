import type { Metadata } from "next";
import RacePageClient from "@/components/RacePageClient";
import { getPredictionsForDate } from "@/lib/api";
import { formatDate } from "@/lib/utils";

// ISR (Incremental Static Regeneration) を設定（単位は秒）
// ここでは1時間（3600秒）ごとにデータを再検証する設定
export const revalidate = 3600;

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

// ビルド時に静的に生成するページのパスを定義する
export async function generateStaticParams() {
  const paths = [];
  // タイムゾーンをJSTに固定して今日の日付を取得
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

  // 過去30日分
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    paths.push({ date: date.toISOString().split("T")[0] });
  }
  // 未来7日分
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    paths.push({ date: date.toISOString().split("T")[0] });
  }

  return paths;
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