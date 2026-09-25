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
import { SegmentedLinks } from "@/components/SegmentedLinks";
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

// 期間の切り替え。ボタンの下の小さな補足（直近の変化 など）はやめた（2026-09-26）
const rangeOptions = [
  { label: "7日", days: 7 },
  { label: "30日", days: 30 },
  { label: "90日", days: 90 },
  { label: "180日", days: 180 },
];

// アイコンは面に載せず、棒と同じ色の線で大きく出す（2026-09-26）
const ACCENT_TEXT: Record<string, string> = {
  "bg-amber-500": "text-amber-500",
  "bg-brand-600": "text-brand-600",
  "bg-emerald-600": "text-emerald-600",
  "bg-slate-900": "text-slate-900",
};

const fallbackMetrics: Array<{
  label: string;
  icon: LucideIcon;
  accent: string;
}> = [
  {
    label: "上位評価馬の走り",
    icon: Gauge,
    accent: "bg-amber-500",
  },
  {
    label: "条件別の傾向",
    icon: BarChart3,
    accent: "bg-brand-600",
  },
  {
    label: "不的中レースの振り返り",
    icon: AlertTriangle,
    accent: "bg-emerald-600",
  },
  {
    label: "人気との違い",
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

// 見出しの下の説明文はやめた（2026-09-26 利用者の指定）
function SectionHeading({
  label,
  title,
}: {
  label: string;
  title: string;
}) {
  return (
    <div className="mb-2 sm:mb-4">
      <p className="text-[12.5px] font-bold text-slate-500">{label}</p>
      <h2 className="mt-0.5 flex items-center gap-1.5 text-[14.5px] font-bold text-slate-950 sm:text-2xl">
        <span className="h-3.5 w-1 rounded-sm bg-accent" />
        {title}
      </h2>
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
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-5">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div>
          <p className="text-xs font-bold text-slate-700 sm:text-sm">{item.label}</p>
          <p className="mt-0.5 text-lg font-bold text-slate-950 sm:text-3xl">{item.rate.toFixed(1)}%</p>
        </div>
        <Icon className={`h-7 w-7 shrink-0 sm:h-9 sm:w-9 ${ACCENT_TEXT[accent] ?? "text-navy"}`} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100 sm:mt-4 sm:h-2">
        <div className={`h-1.5 rounded-full sm:h-2 ${accent}`} style={{ width: percentWidth(item.rate) }} />
      </div>
      <p className="mt-1 text-[12px] text-slate-500 sm:text-[12.5px]">
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
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-bold text-slate-500">{label}</p>
        <TrendingUp className="h-3.5 w-3.5 text-slate-300" />
      </div>
      {rate !== null ? (
        <>
          <p className="mt-1 text-base font-bold text-slate-950 sm:text-2xl">{rate.toFixed(1)}%</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 sm:mt-3 sm:h-2">
            <div className="h-1.5 rounded-full bg-accent sm:h-2" style={{ width: percentWidth(rate) }} />
          </div>
          {/* 数字の説明の文はやめ、対象のレース数だけ残す（2026-09-26） */}
          <p className="mt-1 text-[12px] text-slate-500 sm:text-[12.5px]">
            {summary?.race_count}レース
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-xs leading-5 text-slate-500">表示できるレースがまだありません。</p>
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
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <div className="mt-4 space-y-4">
        {items.length > 0 ? (
          items.slice(0, 5).map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-800">{item.label}</p>
                {/* 棒の下の説明の行はやめ、1位の3着以内率とレース数を右に並べる（2026-09-26） */}
                <p className="whitespace-nowrap text-xs text-slate-500">
                  <span className="font-num text-[14px] font-semibold tabular-nums text-slate-900">{item.top1_place_rate.toFixed(1)}%</span>
                  <span className="ml-1.5">{item.races}レース</span>
                </p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-600" style={{ width: percentWidth(item.top1_place_rate) }} />
              </div>
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
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
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
        { ...summary.top1_place, label: "AI偏差値1位の3着以内率", icon: BarChart3, accent: "bg-brand-600" },
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
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
            <div className="flex flex-col justify-between">
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-950 sm:text-4xl">
                  AI予想の成績
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-[1.8] text-slate-700 sm:leading-8 sm:text-base">
                  AI偏差値の勝率・3着以内率を、期間別・条件別に集計しています。得意な条件だけでなく精度が低い条件も掲載しているので、当日のレースでどの程度参考にすべきかの判断材料になります。
                </p>
              </div>

              {/* 期間はほかの画面と同じ切り替えボタンの形（2026-09-26） */}
              <div className="mt-6">
                <SegmentedLinks
                  ariaLabel="表示期間"
                  items={rangeOptions.map((option) => ({
                    href: `/results/accuracy?days=${option.days}`,
                    label: option.label,
                    current: selectedDays === option.days,
                  }))}
                />
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-8 w-8 shrink-0 text-navy" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold text-slate-500">表示期間</p>
                  <p className="text-lg font-bold text-slate-950">直近{selectedDays}日</p>
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
                  <p className="text-[12.5px] font-bold text-slate-500">集計結果</p>
                  <h2 className="mt-1 flex items-center gap-2 text-xl sm:text-2xl font-bold text-slate-950">
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
              />
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                {summary.recent_misses.length > 0 ? (
                  summary.recent_misses.map((miss) => (
                    <div key={`${miss.race_date}-${miss.venue_name}-${miss.race_number}-${miss.horse_name}`} className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-[1fr_220px_120px] md:items-center">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {formatDate(miss.race_date)} {miss.venue_name}{miss.race_number}R {miss.race_name}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {miss.course_type ?? "条件不明"} {miss.distance ? `${miss.distance}m` : ""}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-700">
                        AI偏差値1位: {miss.horse_name}
                      </p>
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 md:text-right">
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
                  <Icon className={`h-9 w-9 ${ACCENT_TEXT[metric.accent] ?? "text-navy"}`} strokeWidth={1.75} aria-hidden="true" />
                  <h2 className="mt-4 text-lg font-bold text-slate-950">{metric.label}</h2>
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
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-950">短期のブレ幅</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">7日間は母数が少なく変動が大きいため、傾向よりも直近の状況把握に使います。</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-950">中期の安定度</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">30〜90日なら母数がある程度揃い、条件別の得意・不得意が見えてきます。</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-950">不的中の記録</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">外れたレースも隠さず残すことで、どの条件で精度が落ちるかを把握できます。</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link prefetch={false} href="/keiba-data" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:text-primary">
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
              <p className="rounded-xl border border-slate-200 bg-white p-4">
                集計対象を恣意的に絞って的中率を高く見せることはしていません。
              </p>
              <p className="rounded-xl border border-slate-200 bg-white p-4">
                回収率を掲載する際は、点数・券種・購入条件を併記します。条件が不明確な数字は載せません。
              </p>
              {/* 「参考指標であり、推奨するものではありません」の繰り返しの文はやめた（運営者情報・AIの説明のページに残す。2026-09-26） */}
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
