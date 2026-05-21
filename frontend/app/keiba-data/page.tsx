import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { dataHubLinks, courseProfiles, jockeyProfiles } from "@/lib/growth-content";

export const metadata: Metadata = {
  title: "競馬データの見方",
  description:
    "UMA-FREEの競馬データの見方。馬場状態、馬体重、騎手、コース傾向、AI予想の成績をレース前に使う順番で整理しています。",
  alternates: {
    canonical: "/keiba-data",
  },
};

const guideSteps = [
  ["1", "条件", "競馬場、芝/ダート、距離でレースの癖を押さえる。"],
  ["2", "当日気配", "馬場と馬体重で、評価を上げる馬と下げる馬を分ける。"],
  ["3", "人とコース", "騎手、脚質、枠順が今回の条件に合うかを見る。"],
  ["4", "AI偏差値", "最後に上位評価馬と不安材料を並べて判断する。"],
];

const guideCardStyles = [
  {
    border: "border-t-accent",
    badge: "bg-amber-50 text-amber-800",
    label: "当日の馬場",
  },
  {
    border: "border-t-blue-600",
    badge: "bg-blue-50 text-blue-800",
    label: "直前気配",
  },
  {
    border: "border-t-emerald-600",
    badge: "bg-emerald-50 text-emerald-800",
    label: "比較の軸",
  },
  {
    border: "border-t-primary",
    badge: "bg-slate-100 text-slate-800",
    label: "結果の見方",
  },
];

export default function KeibaDataPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "競馬データの見方",
    description: metadata.description,
    url: "https://uma-free.com/keiba-data",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-4">
        <header className="relative overflow-hidden rounded-md border border-slate-800 bg-primary p-5 shadow-elevated sm:p-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.8fr] lg:items-end">
            <div>
              <p className="inline-flex rounded-sm bg-white/10 px-2 py-1 text-xs font-bold tracking-[0.14em] text-accent-light">
                RACE NOTE
              </p>
              <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
                競馬データの見方
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300 sm:text-base">
                出走表を見る前に、今日の条件で評価をどこまで動かすかを決めておくためのページです。
                馬場、馬体重、コース、騎手、AI偏差値をばらばらに見ず、レース前の流れに沿って確認できます。
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-sm bg-white px-3 py-1.5 text-primary">中央・地方対応</span>
                <span className="rounded-sm bg-accent px-3 py-1.5 text-primary">当日判断向け</span>
                <span className="rounded-sm border border-white/20 px-3 py-1.5 text-slate-200">登録不要</span>
              </div>
            </div>
            <aside className="rounded-md border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-bold tracking-[0.16em] text-slate-400">CHECK ORDER</p>
              <ol className="mt-3 space-y-2">
                {guideSteps.map(([step, title, body]) => (
                  <li key={step} className="grid grid-cols-[28px_1fr] gap-3 rounded-md bg-white/[0.07] p-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-xs font-black text-primary">
                      {step}
                    </span>
                    <span>
                      <span className="block text-sm font-black text-white">{title}</span>
                      <span className="block text-xs leading-5 text-slate-300">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {dataHubLinks.map((item, index) => {
            const style = guideCardStyles[index] ?? guideCardStyles[0];
            return (
            <Link
              key={item.href}
              href={item.href}
              className={`group rounded-md border border-slate-200 border-t-4 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated ${style.border}`}
            >
              <span className={`inline-flex rounded-sm px-2 py-1 text-[11px] font-bold ${style.badge}`}>
                {style.label}
              </span>
              <h2 className="mt-3 text-lg font-black text-slate-950 group-hover:text-primary">{item.label}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              <span className="mt-4 inline-flex text-sm font-bold text-primary">詳しく見る</span>
            </Link>
            );
          })}
        </section>

        <section className="mt-10 rounded-md border border-slate-200 bg-white p-5 shadow-soft">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-accent-dark">BEFORE THE RACE</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">迷った時は、見る順番を固定する</h2>
              <p className="mt-3 text-sm leading-8 text-slate-600">
                先にAI偏差値だけを見ると、人気馬に寄りすぎたり、当日の馬場を見落としたりします。
                UMA-FREEでは、条件を先に置き、最後にAI偏差値で確認する流れを基本にしています。
              </p>
              <Link href="/races/today" className="mt-5 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-light">
                この見方で本日のレースを見る
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {guideSteps.map(([step, title, body]) => (
                <div key={step} className="rounded-md border border-slate-100 bg-slate-50 p-4">
                  <p className="font-mono text-xs font-black text-accent-dark">STEP {step}</p>
                  <h3 className="mt-1 text-base font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-md border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-accent-dark">COURSE</p>
              <h2 className="text-2xl font-black text-slate-950">コース別データ</h2>
            </div>
            <Link href="/courses" className="text-sm font-bold text-primary hover:underline">
              すべて見る
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {courseProfiles.slice(0, 8).map((course) => (
              <Link
                key={`${course.venue}-${course.course}`}
                href={`/courses/${course.venue}/${course.course}`}
                className="rounded-md border border-slate-200 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated"
              >
                <p className="inline-flex rounded-sm bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{course.venueName}</p>
                <h3 className="mt-1 text-base font-black text-slate-950">{course.courseName}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500">{course.lead}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-md border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-accent-dark">JOCKEY</p>
              <h2 className="text-2xl font-black text-slate-950">騎手別の得意条件</h2>
            </div>
            <Link href="/jockeys" className="text-sm font-bold text-primary hover:underline">
              すべて見る
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {jockeyProfiles.map((jockey) => (
              <Link
                key={jockey.slug}
                href={`/jockeys/${jockey.slug}`}
                className="rounded-md border border-slate-200 bg-slate-50 p-4 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-soft"
              >
                <h3 className="text-base font-black text-slate-950">{jockey.name}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-6 text-slate-500">{jockey.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
