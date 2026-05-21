import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getPredictionAccuracySummary } from "@/lib/api";

export const metadata: Metadata = {
  title: "AI予測の成績と振り返り",
  description:
    "UMA-FREEのAI予測を、直近成績、条件別の傾向、結果とずれたレースの振り返りから確認できます。",
  alternates: {
    canonical: "/results/accuracy",
  },
};

const metrics = [
  {
    label: "上位評価馬の結果",
    body: "AI偏差値で上位にした馬が、実際にどの程度3着以内へ入ったかを確認します。",
  },
  {
    label: "条件別の傾向",
    body: "短距離、芝中距離、ダート、地方競馬など、条件ごとの結果を分けて見ます。",
  },
  {
    label: "結果とずれたレース",
    body: "出遅れ、馬場変化、ハイペース、馬体重の大幅増減など、結果とずれた時の材料を残します。",
  },
  {
    label: "人気とのずれ",
    body: "人気順とAI偏差値が大きくずれた馬を追い、評価が偏っていないか確認します。",
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
    name: "AI予測の成績と振り返り",
    description: metadata.description,
    url: "https://uma-free.com/results/accuracy",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumb />
      <article className="mx-auto max-w-4xl px-4 pb-12 pt-6">
        <header className="border-b border-slate-200 pb-8">
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400">PREDICTION RECORD</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            AI予測の成績と振り返り
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            UMA-FREEでは、AI偏差値を「当たった・外れた」だけで見ず、条件別の傾向と結果とのずれを残します。
            競馬は結果を保証できないため、このページでは数字を参考にする時の向き不向きを確認できるようにしています。
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <Link
                key={option.days}
                href={`/results/accuracy?days=${option.days}`}
                className={`px-4 py-2 text-sm font-bold transition-colors ${selectedDays === option.days ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </header>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {trendSummaries.map(({ label, summary: item }) => (
            <div key={label} className="border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold tracking-[0.14em] text-slate-400">{label}</p>
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
                <p className="mt-3 text-sm text-slate-500">集計待ちです。</p>
              )}
            </div>
          ))}
        </section>

        {summary && summary.race_count > 0 ? (
          <>
            <section className="mt-8 border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold text-slate-500">
                集計期間: {formatDate(summary.start_date)}〜{formatDate(summary.end_date)} / 対象 {summary.race_count}レース
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {headlineRates.map((item) => (
                  <div key={item.label} className="bg-white p-5">
                    <h2 className="text-sm font-black text-slate-600">{item.label}</h2>
                    <p className="mt-2 text-3xl font-black text-slate-950">{item.rate.toFixed(1)}%</p>
                    <p className="mt-1 text-xs text-slate-500">{item.hits} / {item.total}</p>
                  </div>
                ))}
              </div>
            </section>

            {(weakCourseTypes.length > 0 || weakDistances.length > 0) && (
              <section className="mt-8 border border-slate-200 bg-white p-5">
                <h2 className="text-xl font-black text-slate-950">慎重に見る条件</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  成績が伸びにくい条件は、AI偏差値だけで判断せず、馬場、枠順、展開、人気とのずれを追加で確認します。
                  うまくいかなかった条件も残すことで、数字を過信しない使い方をしやすくしています。
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
              <div className="border border-slate-200 bg-white p-5">
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

              <div className="border border-slate-200 bg-white p-5">
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
              <h2 className="text-2xl font-black text-slate-950">結果とずれたレースの確認材料</h2>
              <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 bg-white">
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
            {metrics.map((metric) => (
              <div key={metric.label} className="border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-black text-slate-950">{metric.label}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{metric.body}</p>
              </div>
            ))}
          </section>
        )}

        <section className="mt-10 border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-xl font-black text-slate-950">現在の見方</h2>
          <p className="mt-3 text-sm leading-8 text-slate-600">
            AI偏差値は、上位馬の勝率や3着以内率だけでなく、芝/ダート、距離、結果とずれたレースの共通点を合わせて見ます。
            良い数字だけを切り出さず、慎重に見る条件も残すことで、レース検討の参考情報として使いやすくします。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              高配当的中ランキングを見る
            </Link>
            <Link href="/races/today" className="bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-primary">
              本日の分析を見る
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black text-slate-950">成績を見る時に大事にしていること</h2>
          <div className="mt-4 space-y-3 text-sm leading-8 text-slate-600">
            <p className="border-l-4 border-slate-300 bg-white p-4">
              的中率だけを高く見せるために、都合のよいレースだけを取り出すことはしません。
            </p>
            <p className="border-l-4 border-slate-300 bg-white p-4">
              回収率を扱う場合も、点数、券種、購入条件を明記し、再現しにくい買い方とは分けます。
            </p>
            <p className="border-l-4 border-slate-300 bg-white p-4">
              AI偏差値は投票の推奨ではなく、馬の比較をしやすくするための参考指標として扱います。
            </p>
          </div>
        </section>
      </article>
    </>
  );
}
