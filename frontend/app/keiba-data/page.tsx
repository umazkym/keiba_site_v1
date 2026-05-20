import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { dataHubLinks, courseProfiles, jockeyProfiles } from "@/lib/growth-content";

export const metadata: Metadata = {
  title: "競馬データ分析の無料辞典",
  description:
    "競馬データ分析を無料で確認できるUMA-FREEのデータ辞典。馬場状態、馬体重、騎手の得意コース、コース別傾向、AI偏差値の検証をまとめています。",
  alternates: {
    canonical: "/keiba-data",
  },
};

export default function KeibaDataPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "競馬データ分析の無料辞典",
    description: metadata.description,
    url: "https://uma-free.com/keiba-data",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
        <header className="border-b border-slate-200 pb-8">
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">KEIBA DATA GUIDE</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            競馬データ分析の無料辞典
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            UMA-FREEで公開しているレース分析を、検索しやすいテーマ別に整理しました。
            当日の予想を見る前に、馬場状態、馬体重、騎手、コースの順で確認すると、数字の意味を読み取りやすくなります。
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {dataHubLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400"
            >
              <h2 className="text-lg font-black text-slate-950 group-hover:text-primary">{item.label}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              <span className="mt-4 inline-flex text-sm font-bold text-primary">読む</span>
            </Link>
          ))}
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-slate-400">COURSE</p>
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
                className="border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400"
              >
                <p className="text-xs font-bold text-slate-400">{course.venueName}</p>
                <h3 className="mt-1 text-base font-black text-slate-950">{course.courseName}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500">{course.lead}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-slate-400">JOCKEY</p>
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
                className="border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400"
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
