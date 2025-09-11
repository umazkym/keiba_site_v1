import type { Metadata } from "next";
import { Suspense } from "react";
import RacePageClient from "@/components/RacePageClient";
import { RaceTabsSkeleton } from "@/components/SkeletonLoader";

// ✅ metadata はサーバーコンポーネントでのみ宣言できる
export const metadata: Metadata = {
  title: "AI競馬予測データ | ウマFREE",
  description:
    "中央・地方競馬の全レースをAIが完全無料で予測。馬券検討に役立つデータを毎日更新。",
};

export default function RacePage({ params }: { params: { date: string } }) {
  return (
    <Suspense fallback={<RaceTabsSkeleton />}>
      <RacePageClient date={params.date} />
    </Suspense>
  );
}
