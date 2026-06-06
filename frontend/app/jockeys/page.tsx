import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { jockeyProfiles } from "@/lib/growth-content";

export const metadata: Metadata = {
  title: "騎手別 得意コースデータ",
  description:
    "武豊、ルメール、川田将雅、横山武史など主要騎手の得意コースと買い時を整理。競馬データ分析の参考になる無料ガイドです。",
  alternates: {
    canonical: "/jockeys",
  },
};

export default function JockeysPage() {
  return (
    <>
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
        <header className="border-b border-slate-200 pb-8">
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">JOCKEY DATA</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            騎手別 得意コースデータ
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            同じ騎手でも、競馬場や距離が変われば成績は大きく異なります。
            主要13騎手について、どの条件で買いたいか・どこで割り引くかを整理しました。
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {jockeyProfiles.map((jockey) => (
            <Link
              key={jockey.slug}
              href={`/jockeys/${jockey.slug}`}
              className="group border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400"
            >
              <h2 className="text-xl font-black text-slate-950 group-hover:text-primary">{jockey.searchTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{jockey.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {jockey.strengths.slice(0, 3).map((strength) => (
                  <span key={strength} className="bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
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
