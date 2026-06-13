import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";

export const metadata: Metadata = {
  title: "馬場状態とは？良・稍重・重・不良の違いと予想への使い方",
  description:
    "JRAの馬場状態である良・稍重・重・不良の違いを、時計、脚質、枠順、道悪適性の観点から整理。競馬予想で評価を変える順番を解説します。",
  robots: { index: false, follow: true },
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
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "データの見方", url: "https://uma-free.com/keiba-data" },
          { name: "馬場状態", url: "https://uma-free.com/keiba-data/track-condition" },
        ]}
      />
      <Breadcrumb />
      <article className="mx-auto max-w-5xl px-4 pb-14 pt-4">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <p className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">馬場の読み方</p>
          <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            馬場状態とは？良・稍重・重・不良の違い
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">
            馬場状態が変われば、当然ながら「走れる馬」も変わります。良馬場の能力序列をそのまま信じるのか、それとも道悪適性を重く見るのか。馬場の特性を理解することで、人気馬の信頼度や人気薄の見直し材料を整理しやすくなります。
          </p>
        </header>

        <section className="mt-8">
          <h2 className="text-2xl font-black text-slate-950">4つの馬場状態の見方</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            {conditionRows.map((row) => (
              <div key={row.name} className="grid gap-2 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[80px_1fr_1.6fr]">
                <div className="text-xl font-black text-accent-dark">{row.name}</div>
                <div className="text-sm font-bold text-slate-700">{row.point}</div>
                <div className="text-sm leading-7 text-slate-600">{row.read}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-3 h-1.5 w-12 rounded-full bg-accent" />
            <h3 className="text-lg font-black text-slate-950">時計を見る</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              高速決着で好走した馬が、時計のかかる馬場でも同じ力を出せるとは限りません。道悪で大きく着順を落とした経験がないかは必ず見ておきたいポイントです。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-3 h-1.5 w-12 rounded-full bg-blue-600" />
            <h3 className="text-lg font-black text-slate-950">脚質を見る</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              道悪で前が粘るか差しが届くかは、含水率やコース形態で変わります。同日の他レースで前後どちらが有利かを掴んでから対象レースに臨むのが定石です。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-3 h-1.5 w-12 rounded-full bg-emerald-600" />
            <h3 className="text-lg font-black text-slate-950">実績を見る</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              過去に重・不良で馬券圏内に入った実績は、道悪適性の裏付けとして強い材料です。逆に初めての道悪で人気を集めている馬は、過信を避けたいところです。
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-slate-950">予想に使う順番</h2>
          <ol className="mt-4 space-y-3 text-sm leading-8 text-slate-600">
            <li className="rounded-xl border-l-4 border-accent bg-white p-4 shadow-soft">
              <strong className="text-slate-950">1. 能力順を土台にする。</strong>
              AI偏差値と近走の着差・上がりから基本の序列を作ります。
            </li>
            <li className="rounded-xl border-l-4 border-blue-600 bg-white p-4 shadow-soft">
              <strong className="text-slate-950">2. 馬場で序列を動かす。</strong>
              道悪経験がない人気馬を1段下げ、重馬場巧者を相手候補に加える、といった補正を入れます。
            </li>
            <li className="rounded-xl border-l-4 border-emerald-600 bg-white p-4 shadow-soft">
              <strong className="text-slate-950">3. 当日のレース傾向で裏を取る。</strong>
              同じ競馬場のここまでの結果で、内前残りか外差し有利かを確かめてから最終判断に入ります。
            </li>
          </ol>
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <h2 className="text-xl font-black text-slate-950">関連して確認したいページ</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/keiba-data/horse-weight" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              馬体重を見る
            </Link>
            <Link href="/courses" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              コース別データ
            </Link>
            <Link href="/races/today" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-primary-light">
              本日の分析を見る
            </Link>
          </div>
        </section>
      </article>
    </>
  );
}
