import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "馬体重増減の見方｜±10kg以上で評価を変える条件",
  description:
    "競馬の馬体重増減を、±4kg、±10kg、休み明け、3歳馬の成長分に分けて解説。直前に評価を下げる条件と例外を整理します。",
  alternates: {
    canonical: "/keiba-data/horse-weight",
  },
};

const weightRows = [
  { range: "±0〜4kg", read: "誤差の範囲として扱うことが多い", action: "能力順を大きく変えない" },
  { range: "±6〜8kg", read: "状態変化の可能性を確認する幅", action: "人気馬なら少し慎重に見る" },
  { range: "±10kg以上", read: "調整過程や体調の変化を疑う幅", action: "軸評価を下げるか、相手までにする" },
  { range: "休み明けの増加", read: "成長分・回復分の可能性がある", action: "調教、年齢、過去の好走体重を合わせる" },
];

export default function HorseWeightPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "馬体重が10kg以上増えていたら消しですか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "必ず消しではありません。休み明け、3歳馬の成長分、過去の好走体重への回帰なら評価を下げすぎない方がよい場合があります。",
        },
      },
      {
        "@type": "Question",
        name: "馬体重はいつ予想に入れますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "基本の能力評価を作ったあと、直前の状態確認として使います。買う理由よりも、人気馬のリスク確認として使うと判断しやすくなります。",
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
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">HORSE WEIGHT</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            馬体重増減の見方
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            馬体重は、直前で評価を変えるための状態確認データです。
            大きな増減を機械的に消すのではなく、休み明け、成長分、過去の好走体重への戻りを分けて考えます。
          </p>
        </header>

        <section className="mt-8">
          <h2 className="text-2xl font-black text-slate-950">増減幅ごとの見方</h2>
          <div className="mt-4 overflow-hidden border border-slate-200 bg-white">
            {weightRows.map((row) => (
              <div key={row.range} className="grid gap-2 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[110px_1fr_1.2fr]">
                <div className="font-mono text-lg font-black text-slate-950">{row.range}</div>
                <div className="text-sm font-bold text-slate-700">{row.read}</div>
                <div className="text-sm leading-7 text-slate-600">{row.action}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">減りすぎ</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              連戦で大きく減っている馬は疲労や輸送の影響を考えます。人気馬なら軸から相手へ下げる判断も必要です。
            </p>
          </div>
          <div className="border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">増えすぎ</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              太め残りか、成長分かを分けます。休み明けで調教内容が良い場合は、単純なマイナス材料にしません。
            </p>
          </div>
          <div className="border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">戻り</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              前走で大きく減って凡走し、今回は過去の好走体重に戻る形なら、むしろ評価を戻す材料になります。
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-slate-950">予想に入れる順番</h2>
          <ol className="mt-4 space-y-3 text-sm leading-8 text-slate-600">
            <li className="border-l-4 border-slate-300 bg-white p-4">
              <strong className="text-slate-950">1. まずAI偏差値と適性を見る。</strong>
              馬体重だけで買う馬を決めないようにします。
            </li>
            <li className="border-l-4 border-slate-300 bg-white p-4">
              <strong className="text-slate-950">2. 人気馬の大幅増減を確認する。</strong>
              特に1〜3番人気の大幅増減は、過剰人気を疑う材料になります。
            </li>
            <li className="border-l-4 border-slate-300 bg-white p-4">
              <strong className="text-slate-950">3. 例外を確認する。</strong>
              3歳馬の成長、休み明け、好走体重への回帰なら、数字だけで下げすぎないようにします。
            </li>
          </ol>
        </section>

        <section className="mt-10 border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-xl font-black text-slate-950">関連して確認したいページ</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/articles/2025-11-11-weight-change-impact-analysis" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              馬体重±10kgの記事
            </Link>
            <Link href="/keiba-data/track-condition" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              馬場状態の見方
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
