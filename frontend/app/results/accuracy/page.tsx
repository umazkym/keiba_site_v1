import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "AI偏差値の検証と的中実績",
  description:
    "UMA-FREEのAI偏差値を、的中率だけでなく条件別の得意不得意、上位馬の複勝傾向、外れたレースの振り返りで検証するページです。",
  alternates: {
    canonical: "/results/accuracy",
  },
};

const metrics = [
  {
    label: "AI偏差値上位馬",
    body: "レースごとの上位評価馬が、実際にどの程度3着以内へ入ったかを確認します。",
  },
  {
    label: "コース別の傾向",
    body: "短距離、芝中距離、ダート、地方競馬など、条件ごとの得意不得意を分けて見ます。",
  },
  {
    label: "外れた理由",
    body: "出遅れ、馬場悪化、ハイペース、馬体重の大幅増減など、外れた時の共通点を残します。",
  },
  {
    label: "過剰人気の確認",
    body: "人気順とAI偏差値が大きくずれた馬を追い、オッズ妙味の有無を検証します。",
  },
];

export default function AccuracyPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "AI偏差値の検証と的中実績",
    description: metadata.description,
    url: "https://uma-free.com/results/accuracy",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumb />
      <article className="mx-auto max-w-4xl px-4 pb-12 pt-6">
        <header className="border-b border-slate-200 pb-8">
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">MODEL REVIEW</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            AI偏差値の検証と的中実績
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            UMA-FREEでは、AI偏差値を「当てた・外した」だけで見ず、条件別にどこが強く、どこが弱いかを確認します。
            競馬は結果を保証できないため、検証ページでは数字の使いどころと限界を明確にしていきます。
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-black text-slate-950">{metric.label}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{metric.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-xl font-black text-slate-950">現在の見方</h2>
          <p className="mt-3 text-sm leading-8 text-slate-600">
            現時点では、高配当的中ランキングとレース別の結果表示をもとに、AI偏差値上位馬の振り返りを行います。
            今後は月別、競馬場別、距離別に集計を分け、強い条件と弱い条件を公開していく方針です。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              高配当的中ランキングを見る
            </Link>
            <Link href="/races/today" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              本日の分析を見る
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-slate-950">検証で重視すること</h2>
          <div className="mt-4 space-y-3 text-sm leading-8 text-slate-600">
            <p className="border-l-4 border-slate-300 bg-white p-4">
              的中率だけを高く見せるために、都合のよいレースだけを取り出すことはしません。
            </p>
            <p className="border-l-4 border-slate-300 bg-white p-4">
              回収率を扱う場合も、点数、券種、購入条件を明記し、再現しにくい買い方とは分けます。
            </p>
            <p className="border-l-4 border-slate-300 bg-white p-4">
              AI偏差値は投票の推奨ではなく、馬の比較をしやすくするための参考指標として扱います。
            </p>
          </div>
        </section>
      </article>
    </>
  );
}
