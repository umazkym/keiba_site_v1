import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Gauge,
  MapPinned,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { dataHubLinks, courseProfiles, jockeyProfiles } from "@/lib/growth-content";

export const metadata: Metadata = {
  title: "競馬データ分析 無料｜馬場・馬体重・AI予想の見方",
  description:
    "無料で使える競馬データ分析の見方を整理。馬場状態、馬体重、騎手、コース傾向、AI予想成績をレース前に確認する順番で解説します。",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "/keiba-data",
  },
};

type GuideTone = {
  icon: LucideIcon;
  timing: string;
  check: string;
  accent: string;
  badge: string;
  panel: string;
};

const guideSteps = [
  {
    step: "01",
    title: "条件を先に置く",
    body: "競馬場・距離・頭数から、波乱が起きやすい条件かどうかを先に把握する。",
    note: "コース・距離",
  },
  {
    step: "02",
    title: "当日気配で補正する",
    body: "馬場と馬体重の当日データで、事前の能力評価にどこまで補正が必要かを判断する。",
    note: "馬場・馬体重",
  },
  {
    step: "03",
    title: "人と枠を重ねる",
    body: "騎手の得意条件と枠順・脚質の相性が、このコースで活きるかを照合する。",
    note: "騎手・枠順",
  },
  {
    step: "04",
    title: "AI偏差値で最後に比較する",
    body: "AI偏差値の上位馬を軸に、人気とのギャップや不安材料を最終チェックする。",
    note: "AI偏差値",
  },
];

const guideTones: GuideTone[] = [
  {
    icon: MapPinned,
    timing: "出走表を見る前",
    check: "馬場が変わった時、脚質の優劣がどう入れ替わるかを整理する",
    accent: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800",
    panel: "border-amber-100 bg-amber-50/60",
  },
  {
    icon: Activity,
    timing: "馬体重発表後",
    check: "当日の増減が成長なのか、消耗なのかを切り分ける",
    accent: "bg-blue-600",
    badge: "bg-blue-50 text-blue-800",
    panel: "border-blue-100 bg-blue-50/60",
  },
  {
    icon: Scale,
    timing: "買い目を絞る前",
    check: "予想サイトの根拠と成績公開の透明度を比較する",
    accent: "bg-emerald-600",
    badge: "bg-emerald-50 text-emerald-800",
    panel: "border-emerald-100 bg-emerald-50/60",
  },
  {
    icon: Gauge,
    timing: "最終確認",
    check: "好調条件と苦手条件の両面から精度を確かめる",
    accent: "bg-slate-900",
    badge: "bg-slate-100 text-slate-800",
    panel: "border-slate-200 bg-slate-50",
  },
];

function SectionHeading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold tracking-[0.16em] text-slate-400">{label}</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-950">
          <span className="h-5 w-1 rounded-sm bg-accent" />
          {title}
        </h2>
      </div>
      {description && <p className="max-w-xl text-sm leading-7 text-slate-500">{description}</p>}
    </div>
  );
}



export default function KeibaDataPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "競馬データの見方",
    description: metadata.description,
    url: "https://uma-free.com/keiba-data",
  };

  const courseHighlights = courseProfiles.slice(0, 6);
  const jockeyHighlights = jockeyProfiles.slice(0, 6);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "データの見方", url: "https://uma-free.com/keiba-data" },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto max-w-[1200px] px-4 pb-14 pt-4">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <div>
            <p className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
              レース前の確認順
            </p>
            <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
              競馬データの見方
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">
              出走表、馬場、馬体重、騎手、AI偏差値——これらをバラバラに眺めると、判断の軸がぶれやすくなります。
              このページでは、レース前に何をどの順番で見るかを整理しています。
            </p>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <SectionHeading
            label="確認の順番"
            title="迷った時に戻る4手順"
            description="印や人気だけに頼らず、根拠を積み上げる手順です。"
          />
          <div className="grid gap-3 md:grid-cols-4">
            {guideSteps.map((step, index) => (
              <div key={step.step} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className={`mb-4 h-1.5 w-12 rounded-full ${guideTones[index].accent}`} />
                <p className="font-mono text-xs font-black text-slate-400">{step.step}</p>
                <h3 className="mt-1 text-base font-black text-slate-950">{step.title}</h3>
                <p className="mt-2 text-xs leading-6 text-slate-600">{step.body}</p>
                <p className="mt-4 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500">
                  {step.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <SectionHeading
            label="判断材料"
            title="レース前に確認するデータ"
            description="各ページでは用語の解説よりも、当日の判断にどう使うかを重視しています。"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dataHubLinks.map((item, index) => {
              const tone = guideTones[index] ?? guideTones[0];
              const Icon = tone.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex h-full flex-col rounded-2xl border bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated ${tone.panel}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.badge}`}>
                      {tone.timing}
                    </span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-soft">
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <h2 className="mt-4 text-lg font-black text-slate-950 group-hover:text-primary">{item.label}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                  <p className="mt-4 border-t border-white/80 pt-3 text-xs leading-6 text-slate-500">
                    {tone.check}
                  </p>
                  <span className="mt-auto pt-4 text-sm font-bold text-primary">詳しく見る</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Gauge className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-slate-400">最終確認</p>
                <h2 className="text-2xl font-black text-slate-950">AI偏差値は最後に見る</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              AI偏差値を最初に見ると、上位馬に引っ張られて他の材料を軽視しがちです。
              コースの癖、馬場、馬体重、騎手の条件適性を先に固めてから、最後の比較材料としてAI偏差値を使う流れを推奨しています。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link prefetch={false} href="/races/today" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-primary-light">
                この見方で本日のレースを見る
              </Link>
              <Link href="/results/accuracy" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700 hover:text-primary">
                AI予想成績を見る
              </Link>
            </div>
          </div>


        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <SectionHeading
              label="コースデータ"
              title="コース別データ"
              description="主要コースの枠順・脚質・馬場傾向をまとめています。"
            />
            <Link href="/courses" className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary sm:inline-flex">
              すべて見る
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courseHighlights.map((course) => (
              <Link
                key={`${course.venue}-${course.course}`}
                href={`/courses/${course.venue}/${course.course}`}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-400">{course.venueName}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950 group-hover:text-primary">{course.courseName}</h3>
                  </div>
                  <BarChart3 className="h-5 w-5 text-slate-300 group-hover:text-accent-dark" />
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-7 text-slate-600">{course.lead}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.stats.slice(0, 2).map((stat) => (
                    <span key={stat.label} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {stat.value}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
          <Link href="/courses" className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary sm:hidden">
            コースをすべて見る
          </Link>
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <SectionHeading
              label="騎手データ"
              title="騎手別の得意条件"
              description="騎手名だけでなく、コースや脚質との相性から得意条件を絞り込めます。"
            />
            <Link href="/jockeys" className="hidden rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary sm:inline-flex">
              すべて見る
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jockeyHighlights.map((jockey) => (
              <Link
                key={jockey.slug}
                href={`/jockeys/${jockey.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated"
              >
                <p className="text-xs font-bold text-slate-400">騎手データ</p>
                <h3 className="mt-1 text-lg font-black text-slate-950 group-hover:text-primary">{jockey.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-7 text-slate-600">{jockey.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {jockey.strengths.slice(0, 2).map((strength) => (
                    <span key={strength} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {strength}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
