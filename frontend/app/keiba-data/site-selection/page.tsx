import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "競馬予想サイトの選び方｜無料で見るべきポイント",
  description:
    "競馬予想サイトを選ぶときに見るべきポイントを整理。無料範囲、指数の根拠、成績の出し方、地方競馬対応、登録要否を比べます。",
  alternates: {
    canonical: "/keiba-data/site-selection",
  },
};

const criteria = [
  {
    title: "無料で見られる範囲",
    body: "登録前に見られる情報が少ないと、指数の癖がわかりません。全レースの基本データ、指数、結果まで追えるかを見ます。",
  },
  {
    title: "指数の根拠",
    body: "印だけでなく、枠順、脚質、馬場、騎手、馬体重など、どの材料を見ているかがわかるサイトを選びます。",
  },
  {
    title: "成績の出し方",
    body: "良かった日だけでなく、評価が届かなかったレースや扱いに注意したい条件まで出しているかを見ます。",
  },
  {
    title: "地方競馬対応",
    body: "中央競馬だけでなく地方競馬も見る人は、開催場数、データ更新時間、レース抜けの有無を確認します。",
  },
  {
    title: "使いやすさ",
    body: "スマホで予想表、詳細分析、過去対戦、コース傾向へすぐ移動できるかは、締切前の使いやすさに直結します。",
  },
  {
    title: "注意書きの明確さ",
    body: "競馬データは結果を保証しません。投票の推奨ではなく参考情報だと明記しているサイトの方が安心して使えます。",
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
            的中率の数字だけで選ぶと、使い始めてから「見たい情報がない」と気づくことがあります。
            無料で見られる範囲、指数の根拠、成績の出し方、締切前の使いやすさを先に見ておきます。
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
          <h2 className="text-xl font-black text-slate-950">UMA-FREEで見られること</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-slate-600 sm:grid-cols-2">
            <li className="rounded-xl bg-white p-4 shadow-soft">中央・地方のレース分析を登録不要で見られます。</li>
            <li className="rounded-xl bg-white p-4 shadow-soft">AI偏差値、脚質予測、対戦成績、枠順傾向をレースごとに出します。</li>
            <li className="rounded-xl bg-white p-4 shadow-soft">AI予想成績では、良かった条件と扱いに注意したい条件を分けます。</li>
            <li className="rounded-xl bg-white p-4 shadow-soft">投票の推奨ではなく、レース検討の参考情報として公開しています。</li>
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
