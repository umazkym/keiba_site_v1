import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "馬場状態とは？良・稍重・重・不良の違いと予想への使い方",
  description:
    "JRAの馬場状態である良・稍重・重・不良の違いを、時計、脚質、枠順、道悪適性の観点から整理。競馬予想で評価を変える順番を解説します。",
  alternates: {
    canonical: "/keiba-data/track-condition",
  },
};

const conditionRows = [
  { name: "良", point: "最も乾いた標準状態", read: "スピード、瞬発力、上がり性能を素直に評価しやすい。" },
  { name: "稍重", point: "少し水分を含む状態", read: "良馬場の能力順を基本にしつつ、パワー型や先行力を少し上げる。" },
  { name: "重", point: "時計がかかりやすい状態", read: "良馬場の高速決着実績だけでは足りない。道悪実績を確認する。" },
  { name: "不良", point: "水分が多く、適性差が出やすい状態", read: "馬場巧者、パワー型、前走凡走馬の巻き返しを検討する。" },
];

export default function TrackConditionPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "稍重は何と読みますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "稍重は「ややおも」と読みます。良馬場より水分を含みますが、重馬場ほど大きく悪化していない状態です。",
        },
      },
      {
        "@type": "Question",
        name: "重馬場ではどんな馬を評価しますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "過去に重・不良馬場で好走した馬、時計のかかる条件に強い馬、前で運べるパワー型を確認します。ただしコースや当日のペースで変わります。",
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <Breadcrumb />
      <article className="mx-auto max-w-4xl px-4 pb-12 pt-6">
        <header className="border-b border-slate-200 pb-8">
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">TRACK CONDITION</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            馬場状態とは？良・稍重・重・不良の違い
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            馬場状態は、予想の結論を変えるための「最後の補正材料」です。
            良馬場の能力順をそのまま使うのか、道悪適性を強く見るのかを分けることで、人気馬の信頼度と穴馬の拾い方が整理できます。
          </p>
        </header>

        <section className="mt-8">
          <h2 className="text-2xl font-black text-slate-950">4つの馬場状態の見方</h2>
          <div className="mt-4 overflow-hidden border border-slate-200 bg-white">
            {conditionRows.map((row) => (
              <div key={row.name} className="grid gap-2 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[80px_1fr_1.6fr]">
                <div className="text-xl font-black text-slate-950">{row.name}</div>
                <div className="text-sm font-bold text-slate-700">{row.point}</div>
                <div className="text-sm leading-7 text-slate-600">{row.read}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">時計を見る</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              良馬場で速い時計を出している馬は、道悪でも同じ評価にできるとは限りません。時計がかかる馬場で崩れていないかを確認します。
            </p>
          </div>
          <div className="border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">脚質を見る</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              道悪では前が止まりにくい日もあれば、先行馬が消耗して差しが届く日もあります。まず当日の同条件レースを見ます。
            </p>
          </div>
          <div className="border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">実績を見る</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              重・不良で3着以内に入った経験、時計のかかる決着で崩れていない経験は、評価を上げる材料になります。
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-slate-950">予想に使う順番</h2>
          <ol className="mt-4 space-y-3 text-sm leading-8 text-slate-600">
            <li className="border-l-4 border-slate-300 bg-white p-4">
              <strong className="text-slate-950">1. まず能力順を見る。</strong>
              AI偏差値、近走内容、コース適性を先に確認します。
            </li>
            <li className="border-l-4 border-slate-300 bg-white p-4">
              <strong className="text-slate-950">2. 馬場で評価を補正する。</strong>
              重・不良で良馬場実績だけの人気馬を少し疑い、道悪実績のある馬を相手に残します。
            </li>
            <li className="border-l-4 border-slate-300 bg-white p-4">
              <strong className="text-slate-950">3. 当日の傾向で最終確認する。</strong>
              同じ競馬場で前が残っているか、外が伸びているかをレース一覧から確認します。
            </li>
          </ol>
        </section>

        <section className="mt-10 border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-xl font-black text-slate-950">関連して確認したいページ</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/keiba-data/horse-weight" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              馬体重増減の見方
            </Link>
            <Link href="/courses" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              コース別データ
            </Link>
            <Link href="/races/today" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              本日の分析を見る
            </Link>
          </div>
        </section>
      </article>
    </>
  );
}
