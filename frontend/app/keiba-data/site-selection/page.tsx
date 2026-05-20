import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "競馬データ分析サイトの選び方｜無料で見るべき比較項目",
  description:
    "競馬データ分析サイトを選ぶときに見るべき項目を整理。無料範囲、指数の根拠、検証公開、地方競馬対応、広告表示、登録要否を比較します。",
  alternates: {
    canonical: "/keiba-data/site-selection",
  },
};

const criteria = [
  {
    title: "無料で見られる範囲",
    body: "登録前に見られる情報が少なすぎると、指数の癖を確認できません。全レースの基本データ、指数、結果確認まで見られるかを確認します。",
  },
  {
    title: "指数の根拠",
    body: "印だけでなく、枠順、脚質、馬場、騎手、馬体重など、どの要素で評価しているかが説明されているサイトの方が判断しやすくなります。",
  },
  {
    title: "検証の公開",
    body: "的中した日だけでなく、外れた条件や苦手な条件まで公開しているかを見ると、長く使えるか判断できます。",
  },
  {
    title: "地方競馬対応",
    body: "中央競馬だけでなく地方競馬も見る人は、開催場数、データ更新時間、レース抜けの有無を確認します。",
  },
  {
    title: "使いやすさ",
    body: "スマホで予想表、詳細分析、過去対戦、コース傾向へすぐ移動できるかは、レース直前の使いやすさに直結します。",
  },
  {
    title: "注意書きの明確さ",
    body: "競馬データは結果を保証しません。投票の推奨ではなく参考情報であることを明記しているサイトの方が信頼できます。",
  },
];

export default function SiteSelectionPage() {
  return (
    <>
      <Breadcrumb />
      <article className="mx-auto max-w-4xl px-4 pb-12 pt-6">
        <header className="border-b border-slate-200 pb-8">
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">SITE SELECTION</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            競馬データ分析サイトの選び方
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            競馬データ分析サイトは、的中率の数字だけで選ぶと判断を誤りやすくなります。
            無料で見られる範囲、指数の根拠、検証の透明性、レース直前の使いやすさを分けて確認します。
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {criteria.map((item) => (
            <div key={item.title} className="border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-black text-slate-950">{item.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-xl font-black text-slate-950">UMA-FREEで確認できること</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-slate-600 sm:grid-cols-2">
            <li className="bg-white p-4">中央・地方のレース分析を登録不要で確認できます。</li>
            <li className="bg-white p-4">AI偏差値、脚質予測、対戦成績、枠順傾向をレースごとに表示します。</li>
            <li className="bg-white p-4">予測の検証ページで、得意条件と苦手条件を継続して整理します。</li>
            <li className="bg-white p-4">投票の推奨ではなく、参考情報としてデータを公開しています。</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/results/accuracy" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              AI偏差値の検証
            </Link>
            <Link href="/keiba-data" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              データ辞典へ戻る
            </Link>
          </div>
        </section>
      </article>
    </>
  );
}
