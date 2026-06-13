import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { jockeyProfiles } from "@/lib/growth-content";

export const metadata: Metadata = {
  title: "騎手別 得意コースデータ",
  description:
    "武豊、ルメール、川田将雅、横山武史など主要騎手の得意コースと評価を上げたい条件を整理。競馬データ分析の参考になる無料ガイドです。",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "/jockeys",
  },
};

export default function JockeysPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "騎手別データ", url: "https://uma-free.com/jockeys" },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">JOCKEY DATA</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            騎手別 得意コースデータ
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            同じ騎手でも、競馬場や距離が変われば成績は大きく異なります。
            主要13騎手について、評価を上げたい条件と慎重に見たい条件を整理しました。
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {jockeyProfiles.map((jockey) => (
            <Link
              key={jockey.slug}
              href={`/jockeys/${jockey.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated"
            >
              <h2 className="text-xl font-black text-slate-950 group-hover:text-primary">{jockey.searchTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{jockey.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {jockey.strengths.slice(0, 3).map((strength) => (
                  <span key={strength} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {strength}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
