import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { gradeRaceProfiles } from "@/lib/grade-race-content";

export const metadata: Metadata = {
  title: "今週の重賞・G1データ分析",
  description:
    "G1・G2・G3など重賞レースのデータ分析入口。枠順確定前、枠順確定後、レース後の振り返りで確認したい項目を整理します。",
  alternates: {
    canonical: "/grade-races",
  },
};

const guideBlocks = [
  {
    title: "枠順確定前",
    body: "過去の好走傾向、前走ローテーション、距離適性、馬場状態への対応を確認します。",
  },
  {
    title: "枠順確定後",
    body: "コース別の枠順傾向、逃げ先行馬の並び、外枠のロス、内枠で包まれるリスクを見ます。",
  },
  {
    title: "当日",
    body: "馬場状態、馬体重、直前オッズ、同日同条件の傾向を確認して評価を微修正します。",
  },
  {
    title: "レース後",
    body: "AI偏差値上位馬の結果、展開のズレ、馬場読みの成否を振り返り、次走へ残します。",
  },
];

const articleLinks = [
  { label: "天皇賞秋の東京芝2000mデータ", href: "/articles/2025-10-27-tennosho-autumn-tokyo-turf-2000m-analysis" },
  { label: "マイルCSの京都芝1600mデータ", href: "/articles/2025-10-28-mile-championship-kyoto-turf-1600m-analysis" },
  { label: "エリザベス女王杯の京都芝2200mデータ", href: "/articles/2025-10-29-elizabeth-queen-cup-kyoto-turf-2200m-analysis" },
  { label: "ジャパンカップの東京芝2400mデータ", href: "/articles/2025-10-30-japan-cup-tokyo-turf-2400m-analysis" },
  { label: "有馬記念の中山芝2500mデータ", href: "/articles/2025-10-31-arima-kinen-nakayama-turf-2500m-analysis" },
];

export default function GradeRacesPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "重賞データ", url: "https://uma-free.com/grade-races" },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto max-w-5xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">GRADE RACES</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            今週の重賞・G1データ分析
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            重賞レースは、検索需要がレース週に集中します。
            UMA-FREEでは、枠順確定前、枠順確定後、当日、レース後の4段階で確認すべきデータを分けて整理します。
          </p>
        </header>

        <section className="mt-8">
          <h2 className="text-2xl font-black text-slate-950">主要G1の個別ハブ</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {gradeRaceProfiles.map((race) => (
              <Link key={race.slug} href={`/grade-races/${race.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated">
                <p className="text-xs font-bold text-primary">{race.date} / {race.grade}</p>
                <h3 className="mt-2 text-lg font-black text-slate-950 group-hover:text-primary">{race.name}</h3>
                <p className="mt-1 text-sm font-bold text-slate-500">{race.venue}{race.course}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{race.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {guideBlocks.map((block) => (
            <div key={block.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <h2 className="text-lg font-black text-slate-950">{block.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{block.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-slate-950">公開中の重賞データ記事</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            {articleLinks.map((link) => (
              <Link key={link.href} href={link.href} className="block p-4 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary">
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-soft">
          <h2 className="text-xl font-black text-slate-950">本日の重賞を確認する</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            当日の出走表、AI偏差値、脚質予測、対戦成績はレース分析ページで確認できます。
          </p>
          <Link prefetch={false} href="/races/today" className="mt-4 inline-flex rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary">
            本日の分析を見る
          </Link>
        </section>
      </div>
    </>
  );
}
