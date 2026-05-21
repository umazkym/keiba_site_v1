import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getPredictionAccuracySummary } from "@/lib/api";

export const metadata: Metadata = {
  title: "AI予想の成績",
  description:
    "UMA-FREEのAI予想成績を、直近の結果、条件別の傾向、評価が届かなかったレースから確認できます。",
  alternates: {
    canonical: "/results/accuracy",
  },
};

const metrics = [
  {
    label: "上位評価馬の走り",
    body: "AI偏差値で上位にした馬が、どのくらい馬券内まで届いたかを見ます。",
  },
  {
    label: "条件別の傾向",
    body: "芝、ダート、距離帯、地方競馬など、条件ごとに数字の出方を分けます。",
  },
  {
    label: "評価が届かなかったレース",
    body: "出遅れ、馬場変化、ハイペース、馬体重の大幅増減など、次に残す材料を見ます。",
  },
  {
    label: "人気との違い",
    body: "人気順とAI偏差値が大きく違う馬を追い、評価が偏っていないかを見ます。",
  },
];

export const revalidate = 3600;

function formatDate(date: string) {
  return date.replace(/-/g, "/");
}

function normalizeDays(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 30);
  if ([7, 30, 90, 180].includes(parsed)) return parsed;
  return 30;
}

const rangeOptions = [
  { label: "7日", days: 7 },
  { label: "30日", days: 30 },
  { label: "90日", days: 90 },
  { label: "180日", days: 180 },
];

const metricStyles = [
  "border-t-accent",
  "border-t-blue-600",
  "border-t-emerald-600",
  "border-t-slate-900",
];

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
        { ...summary.top1_win, label: "AI偏差値1位の勝率" },
        { ...summary.top1_place, label: "AI偏差値1位の3着以内率" },
        { ...summary.top3_place, label: "上位3頭の3着以内率" },
      ]
    : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "AI予想の成績",
    description: metadata.description,
    url: "https://uma-free.com/results/accuracy",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumb />
      <article className="mx-auto max-w-5xl px-4 pb-14 pt-4">
        <header className="rounded-md border border-slate-800 bg-primary p-5 shadow-elevated sm:p-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-sm bg-white/10 px-2 py-1 text-xs font-bold tracking-[0.14em] text-accent-light">
                AI RECORD
              </p>
              <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
                AI予想の成績
              </h1>
              <p className="mt-4 text-sm leading-8 text-slate-300 sm:text-base">
                AI偏差値が結果につながった場面と、届かなかった条件を同じページで見ます。
                良い数字だけを切り出さず、レース検討で使う時の向き不向きまで残します。
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-4 text-sm text-slate-300">
              <p className="text-xs font-bold tracking-[0.16em] text-slate-400">VIEW RANGE</p>
              <p className="mt-2 text-lg font-black text-white">直近{selectedDays}日</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">短期のぶれと中期の傾向を分けて確認します。</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <Link
                key={option.days}
                href={`/results/accuracy?days=${option.days}`}
                className={`rounded-md px-4 py-2 text-sm font-bold transition-colors ${selectedDays === option.days ? "bg-accent text-primary" : "border border-white/15 bg-white/10 text-slate-200 hover:bg-white/20"}`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </header>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {trendSummaries.map(({ label, summary: item }) => (
            <div key={label} className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
              <p className="text-xs font-bold tracking-[0.14em] text-accent-dark">{label}</p>
              {item && item.race_count > 0 ? (
                <>
                  <p className="mt-2 text-2xl font-black text-slate-950">
                    {item.top1_place.rate.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    AI偏差値1位の3着以内率 / {item.race_count}レース
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">表示できるレースがまだありません。</p>
              )}
            </div>
          ))}
        </section>

        {summary && summary.race_count > 0 ? (
          <>
            <section className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold text-slate-500">
                集計期間: {formatDate(summary.start_date)}〜{formatDate(summary.end_date)} / 対象 {summary.race_count}レース
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {headlineRates.map((item) => (
                  <div key={item.label} className="rounded-md border border-slate-100 bg-white p-5 shadow-soft">
                    <h2 className="text-sm font-black text-slate-600">{item.label}</h2>
                    <p className="mt-2 text-3xl font-black text-slate-950">{item.rate.toFixed(1)}%</p>
                    <p className="mt-1 text-xs text-slate-500">{item.hits} / {item.total}</p>
                  </div>
                ))}
              </div>
            </section>

            {(weakCourseTypes.length > 0 || weakDistances.length > 0) && (
              <section className="mt-8 rounded-md border border-amber-200 bg-amber-50/60 p-5">
                <h2 className="text-xl font-black text-slate-950">扱いに注意したい条件</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  数字が伸びにくい条件では、AI偏差値だけで決めず、馬場、枠順、展開、人気との違いを合わせて見ます。
                  うまくいかなかった条件も残し、無理に良く見せない使い方にしています。
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-700">コース種別</h3>
                    <div className="mt-3 space-y-2">
                      {weakCourseTypes.map((item) => (
                        <div key={item.label} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
                          <span className="font-bold text-slate-700">{item.label}</span>
                          <span className="text-slate-500">1位3着以内率 {item.top1_place_rate.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-700">距離帯</h3>
                    <div className="mt-3 space-y-2">
                      {weakDistances.map((item) => (
                        <div key={item.label} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
                          <span className="font-bold text-slate-700">{item.label}</span>
                          <span className="text-slate-500">1位3着以内率 {item.top1_place_rate.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
                <h2 className="text-xl font-black text-slate-950">条件別の傾向</h2>
                <div className="mt-4 space-y-3">
                  {summary.by_course_type.slice(0, 4).map((item) => (
                    <div key={item.label} className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.races}レース</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">1位3着以内率 {item.top1_place_rate.toFixed(1)}% / 上位3頭の3着以内率 {item.top3_place_rate.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
                <h2 className="text-xl font-black text-slate-950">距離別の傾向</h2>
                <div className="mt-4 space-y-3">
                  {summary.by_distance.slice(0, 4).map((item) => (
                    <div key={item.label} className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.races}レース</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">1位3着以内率 {item.top1_place_rate.toFixed(1)}% / 上位3頭の3着以内率 {item.top3_place_rate.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-black text-slate-950">評価が届かなかったレース</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                上位評価にした馬が着順へ届かなかったレースは、展開や馬場の読み直しに使います。
              </p>
              <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white shadow-soft">
                {summary.recent_misses.map((miss) => (
                  <div key={`${miss.race_date}-${miss.venue_name}-${miss.race_number}-${miss.horse_name}`} className="p-4">
                    <p className="text-sm font-black text-slate-900">
                      {formatDate(miss.race_date)} {miss.venue_name}{miss.race_number}R {miss.race_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      AI偏差値1位: {miss.horse_name}（{miss.deviation_score.toFixed(2)}） / 着順 {miss.rank ?? "不明"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {miss.course_type ?? "条件不明"} {miss.distance ? `${miss.distance}m` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="mt-8 grid gap-4 md:grid-cols-2">
            {metrics.map((metric, index) => (
              <div key={metric.label} className={`rounded-md border border-slate-200 border-t-4 bg-white p-5 shadow-soft ${metricStyles[index]}`}>
                <h2 className="text-lg font-black text-slate-950">{metric.label}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{metric.body}</p>
              </div>
            ))}
          </section>
        )}

        <section className="mt-10 rounded-md border border-slate-200 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-black text-slate-950">数字の使い方</h2>
          <p className="mt-3 text-sm leading-8 text-slate-600">
            AI偏差値は、上位馬の勝率や3着以内率だけでなく、芝/ダート、距離、評価が届かなかったレースの共通点を合わせて見ます。
            数字が良い条件と扱いに注意したい条件を分けることで、レース検討の参考情報として使いやすくします。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/" className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              高配当的中ランキングを見る
            </Link>
            <Link href="/races/today" className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-light">
              本日の分析を見る
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-slate-950">公開方針</h2>
          <div className="mt-4 space-y-3 text-sm leading-8 text-slate-600">
            <p className="rounded-md border-l-4 border-accent bg-white p-4 shadow-soft">
              的中率だけを高く見せるために、都合のよいレースだけを取り出しません。
            </p>
            <p className="rounded-md border-l-4 border-blue-600 bg-white p-4 shadow-soft">
              回収率を扱う場合も、点数、券種、購入条件を明記し、再現しにくい買い方とは分けます。
            </p>
            <p className="rounded-md border-l-4 border-emerald-600 bg-white p-4 shadow-soft">
              AI偏差値は投票の推奨ではなく、馬の比較をしやすくするための参考指標として扱います。
            </p>
          </div>
        </section>
      </article>
    </>
  );
}
