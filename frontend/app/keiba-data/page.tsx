import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Gauge,
  ListChecks,
  MapPinned,
  Scale,
  type LucideIcon,
} from "lucide-react";
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
    body: "競馬場、芝/ダート、距離、頭数を確認し、そもそも荒れやすい条件かを見ます。",
    note: "コース・距離",
  },
  {
    step: "02",
    title: "当日気配で補正する",
    body: "馬場状態と馬体重を見て、能力評価をそのまま信じるか、少し動かすかを決めます。",
    note: "馬場・馬体重",
  },
  {
    step: "03",
    title: "人と枠を重ねる",
    body: "騎手の得意条件、脚質、枠順が今回の舞台で噛み合うかを確認します。",
    note: "騎手・枠順",
  },
  {
    step: "04",
    title: "AI偏差値で最後に比較する",
    body: "上位評価馬を軸に、不安材料と人気とのずれを並べて見ます。",
    note: "AI偏差値",
  },
];

const guideTones: GuideTone[] = [
  {
    icon: MapPinned,
    timing: "出走表を見る前",
    check: "馬場の変化で脚質評価を動かすかを決める",
    accent: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800",
    panel: "border-amber-100 bg-amber-50/60",
  },
  {
    icon: Activity,
    timing: "馬体重発表後",
    check: "増減幅を成長分、戻り、絞り込みに分ける",
    accent: "bg-blue-600",
    badge: "bg-blue-50 text-blue-800",
    panel: "border-blue-100 bg-blue-50/60",
  },
  {
    icon: Scale,
    timing: "買い目を絞る前",
    check: "無料範囲、根拠、成績公開の見せ方を比べる",
    accent: "bg-emerald-600",
    badge: "bg-emerald-50 text-emerald-800",
    panel: "border-emerald-100 bg-emerald-50/60",
  },
  {
    icon: Gauge,
    timing: "最終確認",
    check: "良かった条件と届かなかった条件を同時に見る",
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

function MiniSignal({
  label,
  value,
  width,
  className,
}: {
  label: string;
  value: string;
  width: string;
  className: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className={`h-2 rounded-full ${className}`} style={{ width }} />
      </div>
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
      <Breadcrumb />
      <div className="mx-auto max-w-[1200px] px-4 pb-14 pt-4">
        <header className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.24)] sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
            <div className="flex flex-col justify-between">
              <div>
                <p className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-accent-light">
                  レース前の確認順
                </p>
                <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
                  競馬データの見方
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300 sm:text-base">
                  出走表、馬場、馬体重、騎手、AI偏差値をばらばらに見てしまうと、強い材料と弱い材料が混ざります。
                  ここでは、レース前に評価を動かす順番を固定し、迷った時に立ち返れる見方にまとめています。
                </p>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-xs font-bold text-slate-400">対応</p>
                  <p className="mt-1 text-lg font-black text-white">中央・地方</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-xs font-bold text-slate-400">使う場面</p>
                  <p className="mt-1 text-lg font-black text-white">レース前</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-xs font-bold text-slate-400">目的</p>
                  <p className="mt-1 text-lg font-black text-white">判断材料の整理</p>
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-slate-950">
                  <ListChecks className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-400">本日の見方</p>
                  <p className="text-sm font-black text-white">先に条件、最後にAI偏差値</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <MiniSignal label="馬場の影響" value="強め" width="72%" className="bg-amber-400" />
                <MiniSignal label="馬体重の変化" value="要確認" width="58%" className="bg-blue-400" />
                <MiniSignal label="AI上位との差" value="比較" width="82%" className="bg-emerald-400" />
              </div>
              <div className="mt-5 rounded-xl bg-slate-950/60 p-3">
                <p className="text-xs leading-6 text-slate-300">
                  いきなり印を決めず、条件ごとに評価を少しずつ動かす。UMA-FREEのデータページは、その順番を崩さないための入口です。
                </p>
              </div>
            </aside>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <SectionHeading
            label="確認の順番"
            title="迷った時に戻る4手順"
            description="人気や印だけで判断せず、評価を動かした理由が残る順番にしています。"
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
            description="各ページは単なる用語説明ではなく、今日の評価をどう動かすかに絞って読める構成です。"
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
              AI偏差値を先に見ると、上位評価馬に判断が寄りやすくなります。
              UMA-FREEでは、コースの癖、馬場、馬体重、騎手の得意条件を先に置き、最後にAI偏差値で比較する流れを基本にしています。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/races/today" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-primary-light">
                この見方で本日のレースを見る
              </Link>
              <Link href="/results/accuracy" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700 hover:text-primary">
                AI予想成績を見る
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {guideSteps.map((step, index) => (
              <div key={step.step} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-black text-slate-400">STEP {step.step}</p>
                  <span className={`h-2 w-10 rounded-full ${guideTones[index].accent}`} />
                </div>
                <h3 className="mt-2 text-base font-black text-slate-950">{step.title}</h3>
                <p className="mt-2 text-xs leading-6 text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <SectionHeading
              label="コースデータ"
              title="コース別データ"
              description="よく見られるコースを先に置き、枠順・脚質・馬場の癖を確認しやすくしています。"
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
              description="騎手名だけで決めず、コース、脚質、人気との釣り合いまで見られる入口です。"
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
