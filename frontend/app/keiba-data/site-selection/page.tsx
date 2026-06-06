import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "競馬予想サイトの選び方｜無料で見るべきポイント",
  description:
    "競馬予想サイトを選ぶときに見るべきポイントを整理。無料範囲、指数の根拠、成績の出し方、地方競馬対応、登録要否を比べます。",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "/keiba-data/site-selection",
  },
};

const criteria = [
  {
    title: "無料で見られる範囲",
    body: "登録前にどこまで見られるかは最初に確認したい。基本データ・指数・過去結果が無料で追えないと、相性を判断できません。",
  },
  {
    title: "指数の根拠",
    body: "印だけ載せているサイトよりも、枠順・脚質・馬場・騎手のどれを重視しているかが分かるサイトの方が使いこなしやすいです。",
  },
  {
    title: "成績の出し方",
    body: "好成績だけを切り取って見せるサイトは要注意。外れた条件や苦手カテゴリまで公開しているかが信頼度の目安です。",
  },
  {
    title: "地方競馬対応",
    body: "中央競馬だけでなく地方競馬も見る人は、開催場数、データ更新時間、レース抜けの有無を確認します。",
  },
  {
    title: "使いやすさ",
    body: "発走10分前にスマホで出馬表・詳細分析・コース傾向へ素早くアクセスできるかは、実戦で使えるかどうかの分かれ目です。",
  },
  {
    title: "注意書きの明確さ",
    body: "「的中保証」を謳うサイトは距離を置いた方が無難です。参考情報であることを明記しているサイトの方が誠実といえます。",
  },
];

const criterionAccents = [
  "bg-accent",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-slate-900",
  "bg-amber-700",
  "bg-slate-500",
];

export default function SiteSelectionPage() {
  return (
    <>
      <Breadcrumb />
      <article className="mx-auto max-w-5xl px-4 pb-14 pt-4">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <p className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            予想サイト選びの視点
          </p>
          <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            競馬予想サイトの選び方
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">
            的中率だけを比較してサイトを選ぶと、いざ使い始めてから「欲しい情報が有料の壁の向こう」と気づくことがあります。
            登録前に何を見られるか、指数に根拠があるか、成績をどこまで公開しているかを先に見極めておくと失敗が減ります。
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {criteria.map((item, index) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className={`mb-3 h-1.5 w-12 rounded-full ${criterionAccents[index]}`} />
              <p className="font-mono text-xs font-black text-slate-400">{String(index + 1).padStart(2, '0')}</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">{item.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <h2 className="text-xl font-black text-slate-950">UMA-FREEの場合</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-slate-600 sm:grid-cols-2">
            <li className="rounded-xl bg-white p-4 shadow-soft">中央・地方の全レースを登録不要で閲覧可能。</li>
            <li className="rounded-xl bg-white p-4 shadow-soft">AI偏差値・脚質予測・対戦成績・枠順傾向をレースごとに算出。</li>
            <li className="rounded-xl bg-white p-4 shadow-soft">成績は好調条件・不調条件の両方を公開。</li>
            <li className="rounded-xl bg-white p-4 shadow-soft">投票推奨ではなく、レース検討の参考情報として提供。</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/results/accuracy" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-primary-light">
              AI予想の成績を見る
            </Link>
            <Link href="/keiba-data" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:text-primary">
              データの見方へ戻る
            </Link>
          </div>
        </section>
      </article>
    </>
  );
}
