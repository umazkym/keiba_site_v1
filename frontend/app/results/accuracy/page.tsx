import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Gauge,
  LineChart,
  ListChecks,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getPredictionAccuracySummary } from "@/lib/api";
import type { AccuracyCondition, AccuracyRate, PredictionAccuracySummary } from "@/lib/types";

export const metadata: Metadata = {
  title: "AI予想の成績",
  description:
    "UMA-FREEのAI偏差値1位の勝率・3着以内率を、期間別・条件別に集計。成績が出やすい条件と慎重に見たい条件を同時に確認できます。",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/results/accuracy",
  },
};

export const revalidate = 3600;

const rangeOptions = [
  { label: "7日", days: 7, note: "直近の変化" },
  { label: "30日", days: 30, note: "標準表示" },
  { label: "90日", days: 90, note: "傾向確認" },
  { label: "180日", days: 180, note: "長めに確認" },
];

const fallbackMetrics: Array<{
  label: string;
  body: string;
  icon: LucideIcon;
  accent: string;
}> = [
  {
    label: "上位評価馬の走り",
    body: "AI偏差値上位馬が実際にどの程度馬券に絡んだかを数字で示します。",
    icon: Gauge,
    accent: "bg-amber-500",
  },
  {
    label: "条件別の傾向",
    body: "芝・ダート・距離帯・地方など、条件ごとの精度差が分かります。",
    icon: BarChart3,
    accent: "bg-blue-600",
  },
  {
    label: "不的中レースの振り返り",
    body: "出遅れ・馬場急変・ハイペースなど、外れた背景を分類し、次のレース判断に活かせます。",
    icon: AlertTriangle,
    accent: "bg-emerald-600",
  },
  {
    label: "人気との違い",
    body: "オッズ上位とAI偏差値上位のズレを追跡し、モデルの偏りを検証します。",
    icon: LineChart,
    accent: "bg-slate-900",
  },
];

function formatDate(date: string) {
  return date.replace(/-/g, "/");
}

function normalizeDays(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 30);
  if ([7, 30, 90, 180].includes(parsed)) return parsed;
  return 30;
}

function percentWidth(value: number) {
  if (!Number.isFinite(value)) return "4%";
  return `${Math.max(4, Math.min(100, value))}%`;
}

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
    <div className="mb-4">
      <p className="text-xs font-bold tracking-[0.16em] text-slate-400">{label}</p>
      <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-950">
        <span className="h-5 w-1 rounded-sm bg-accent" />
        {title}
      </h2>
      {description && <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>}
    </div>
  );
}

function RateCard({
  item,
  icon: Icon,
  accent,
}: {
  item: AccuracyRate & { label: string };
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-700">{item.label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{item.rate.toFixed(1)}%</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${accent}`} style={{ width: percentWidth(item.rate) }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {item.hits} / {item.total}件
      </p>
    </div>
  );
}

function TrendCard({
  label,
  summary,
}: {
  label: string;
  summary: PredictionAccuracySummary | null;
}) {
  const rate = summary?.race_count ? summary.top1_place.rate : null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.14em] text-slate-400">{label}</p>
        <TrendingUp className="h-4 w-4 text-slate-300" />
      </div>
      {rate !== null ? (
        <>
          <p className="mt-2 text-2xl font-black text-slate-950">{rate.toFixed(1)}%</p>
          <div className="mt-3 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-accent" style={{ width: percentWidth(rate) }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            AI偏差値1位の3着以内率 / {summary?.race_count}レース
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm leading-7 text-slate-500">表示できるレースがまだありません。</p>
      )}
    </div>
  );
}

function ConditionPanel({
  title,
  items,
}: {
  title: string;
  items: AccuracyCondition[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <div className="mt-4 space-y-4">
        {items.length > 0 ? (
          items.slice(0, 5).map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-800">{item.label}</p>
                <p className="text-xs font-semibold text-slate-400">{item.races}レース</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-blue-600" style={{ width: percentWidth(item.top1_place_rate) }} />
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                1位3着以内率 {item.top1_place_rate.toFixed(1)}% / 上位3頭の3着以内率 {item.top3_place_rate.toFixed(1)}%
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-slate-500">表示できる条件別データがまだありません。</p>
        )}
      </div>
    </div>
  );
}

function WeakConditionList({
  title,
  items,
}: {
  title: string;
  items: AccuracyCondition[];
}) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4">
      <h3 className="text-sm font-black text-slate-800">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm last:border-b-0 last:pb-0">
              <span className="font-bold text-slate-700">{item.label}</span>
              <span className="shrink-0 text-xs font-semibold text-slate-500">
                1位3着以内率 {item.top1_place_rate.toFixed(1)}%
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-slate-500">該当条件はまだ十分に集まっていません。</p>
        )}
      </div>
    </div>
  );
}

export default async function AccuracyPage({
  searchParams,
}: {
  searchParams?: { days?: string | string[] };
}) {
  const selectedDays = normalizeDays(searchParams?.days);
  const [summary, trend7, trend30, trend90] = await Promise.all([
    getPredictionAccuracySummary(selectedDays),
    getPredictionAccuracySummary(7),
    getPredictionAccuracySummary(30),
    getPredictionAccuracySummary(90),
  ]);

  const trendSummaries = [
    { label: "直近7日", summary: trend7 },
    { label: "直近30日", summary: trend30 },
    { label: "直近90日", summary: trend90 },
  ];

  const weakCourseTypes = [...(summary?.by_course_type ?? [])]
    .filter((item) => item.races >= 3)
    .sort((a, b) => a.top1_place_rate - b.top1_place_rate)
    .slice(0, 3);

  const weakDistances = [...(summary?.by_distance ?? [])]
    .filter((item) => item.races >= 3)
    .sort((a, b) => a.top1_place_rate - b.top1_place_rate)
    .slice(0, 3);

  const headlineRates = summary
    ? [
        { ...summary.top1_win, label: "AI偏差値1位の勝率", icon: Gauge, accent: "bg-amber-500" },
        { ...summary.top1_place, label: "AI偏差値1位の3着以内率", icon: BarChart3, accent: "bg-blue-600" },
        { ...summary.top3_place, label: "上位3頭の3着以内率", icon: LineChart, accent: "bg-emerald-600" },
      ]
    : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "AI予想の成績",
    description: metadata.description,
    url: "https://uma-free.com/results/accuracy",
  };

  const hasSummary = Boolean(summary && summary.race_count > 0);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "AI予想成績", url: "https://uma-free.com/results/accuracy" },
        ]}
      />
      <Breadcrumb />
      <article className="mx-auto max-w-[1200px] px-4 pb-14 pt-4">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
            <div className="flex flex-col justify-between">
              <div>
                <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                  AI予想の成績
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">
                  AI偏差値の勝率・3着以内率を、期間別・条件別に集計しています。得意な条件だけでなく精度が低い条件も掲載しているので、当日のレースでどの程度参考にすべきかの判断材料になります。
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {rangeOptions.map((option) => (
                  <Link
                    key={option.days}
                    href={`/results/accuracy?days=${option.days}`}
                    aria-current={selectedDays === option.days ? "page" : undefined}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                      selectedDays === option.days
                        ? "bg-accent text-slate-950"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <span className="block leading-none">{option.label}</span>
                    <span className="mt-1 block text-[10px] font-semibold opacity-70">{option.note}</span>
                  </Link>
                ))}
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-slate-950">
                  <ListChecks className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-500">表示期間</p>
                  <p className="text-lg font-black text-slate-950">直近{selectedDays}日</p>
                </div>
              </div>
              {hasSummary ? (
                <div className="mt-5 space-y-4">
                  {headlineRates.slice(0, 3).map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                        <span>{item.label}</span>
                        <span>{item.rate.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className={`h-2 rounded-full ${item.accent}`} style={{ width: percentWidth(item.rate) }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs leading-6 text-slate-600">
                    現在は集計できるレースが不足しています。表示できる結果が増えたら、ここに勝率、3着以内率、条件別の傾向が並びます。
                  </p>
                </div>
              )}

            </aside>
          </div>
        </header>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {trendSummaries.map(({ label, summary: item }) => (
            <TrendCard key={label} label={label} summary={item} />
          ))}
        </section>

        {hasSummary && summary ? (
          <>
            <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-slate-400">集計結果</p>
                  <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-950">
                    <span className="h-5 w-1 rounded-sm bg-accent" />
                    主要成績
                  </h2>
                </div>
                <p className="text-sm font-bold text-slate-500">
                  {formatDate(summary.start_date)}〜{formatDate(summary.end_date)} / 対象 {summary.race_count}レース
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {headlineRates.map((item) => (
                  <RateCard key={item.label} item={item} icon={item.icon} accent={item.accent} />
                ))}
              </div>
            </section>

            <section className="mt-8 grid gap-4 lg:grid-cols-2">
              <ConditionPanel title="コース種別の傾向" items={summary.by_course_type} />
              <ConditionPanel title="距離別の傾向" items={summary.by_distance} />
              <ConditionPanel title="競馬場別の傾向" items={summary.by_venue ?? []} />
              <ConditionPanel title="AI偏差値帯別の傾向" items={summary.by_score_band ?? []} />
            </section>

            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-soft sm:p-6">
              <SectionHeading
                label="注意条件"
                title="扱いに注意したい条件"
                description="以下の条件ではAI偏差値の精度が低めに出ています。馬場や展開など他の材料と組み合わせて判断してください。"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <WeakConditionList title="コース種別" items={weakCourseTypes} />
                <WeakConditionList title="距離帯" items={weakDistances} />
              </div>

            </section>

            <section className="mt-10">
              <SectionHeading
                label="不的中レース"
                title="外れたレース"
                description="AI偏差値1位の馬が馬券圏外に終わったレースです。外れた原因を振り返る材料として残しています。"
              />
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                {summary.recent_misses.length > 0 ? (
                  summary.recent_misses.map((miss) => (
                    <div key={`${miss.race_date}-${miss.venue_name}-${miss.race_number}-${miss.horse_name}`} className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-[1fr_220px_120px] md:items-center">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {formatDate(miss.race_date)} {miss.venue_name}{miss.race_number}R {miss.race_name}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {miss.course_type ?? "条件不明"} {miss.distance ? `${miss.distance}m` : ""}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-700">
                        AI偏差値1位: {miss.horse_name}
                      </p>
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 md:text-right">
                        {miss.rank ? `${miss.rank}着` : "着順不明"}
                        <span className="block text-xs font-semibold text-slate-400">偏差値 {miss.deviation_score.toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="p-5 text-sm leading-7 text-slate-500">この期間に該当する不的中レースはありません。</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {fallbackMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${metric.accent}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="mt-4 text-lg font-black text-slate-950">{metric.label}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{metric.body}</p>
                </div>
              );
            })}
          </section>
        )}

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
            <SectionHeading
              label="数字の読み方"
              title="数字の使い方"
              description="AI偏差値はあくまで馬の比較を補助する参考指標です。"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">短期のブレ幅</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">7日間は母数が少なく変動が大きいため、傾向よりも直近の状況把握に使います。</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">中期の安定度</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">30〜90日なら母数がある程度揃い、条件別の得意・不得意が見えてきます。</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">不的中の記録</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">外れたレースも隠さず残すことで、どの条件で精度が落ちるかを把握できます。</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/keiba-data" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:text-primary">
                データの見方へ
              </Link>
              <Link prefetch={false} href="/races/today" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-light">
                本日の分析を見る
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
            <SectionHeading label="成績の扱い" title="公開方針" />
            <div className="space-y-3 text-sm leading-7 text-slate-600">
              <p className="rounded-xl border-l-4 border-accent bg-white p-4 shadow-soft">
                集計対象を恣意的に絞って的中率を高く見せることはしていません。
              </p>
              <p className="rounded-xl border-l-4 border-blue-600 bg-white p-4 shadow-soft">
                回収率を掲載する際は、点数・券種・購入条件を併記します。条件が不明確な数字は載せません。
              </p>
              <p className="rounded-xl border-l-4 border-emerald-600 bg-white p-4 shadow-soft">
                AI偏差値は馬の比較を補助するための参考指標であり、特定の投票行動を推奨するものではありません。
              </p>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
