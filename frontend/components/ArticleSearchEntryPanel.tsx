import Link from 'next/link';
import { ArrowRight, BarChart3, Gauge, LineChart, ListChecks, Trophy } from 'lucide-react';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import type { TopPayoutHit } from '@/lib/types';

interface ArticleSearchEntryPanelProps {
  topHits?: TopPayoutHit[];
}

const featureCards = [
  {
    label: '独自指標',
    title: 'AI偏差値',
    body: '過去走、適性、展開力を数値化し、出走全頭を同じ画面で比較できます。',
    icon: Gauge,
  },
  {
    label: 'レース展開',
    title: '脚質予測',
    body: '先行争い、差しの届き方、隊列の流れをレースごとに確認できます。',
    icon: LineChart,
  },
  {
    label: 'コース傾向',
    title: '枠順・馬場データ',
    body: '競馬場、距離、馬場状態ごとの傾向を、当日の判断材料として整理しています。',
    icon: BarChart3,
  },
];

export function ArticleSearchEntryPanel({ topHits }: ArticleSearchEntryPanelProps) {
  const initialHits = topHits ? topHits.slice(0, 5) : [];

  return (
    <section aria-labelledby="article-entry-title" className="space-y-5">
      <div className="hero">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_60%)]" />
        <div className="relative z-10">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div>
              <h2
                id="article-entry-title"
                className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl"
              >
                UMA-FREEの無料分析データ
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
                中央・地方の全レースを対象に、AI偏差値、脚質予測、枠順傾向を毎日更新。
                記事で気になった条件を、当日の出馬表でそのまま確認できます。
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link href="/races/today" className="hero-btn group justify-center">
                  本日の分析を見る
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
                <Link
                  href="/results/accuracy"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white/85 transition-colors hover:text-white sm:px-5"
                >
                  高配当的中ランキング
                  <Trophy className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="hero-stats !mb-0 grid-cols-3 lg:grid-cols-1">
              <div>
                <div className="num">中央・地方</div>
                <div className="lbl">全レース対応</div>
              </div>
              <div>
                <div className="num">無料</div>
                <div className="lbl">登録不要</div>
              </div>
              <div>
                <div className="num">毎日</div>
                <div className="lbl">データ更新</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TopHitsDisplay initialHits={initialHits} />

      <section>
        <h2 className="sec-title">
          <span className="bar bg-secondary" />
          本サイト独自の分析データ
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {featureCards.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href="/keiba-data"
                className="group border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400"
              >
                <div className="mb-3 flex items-start gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-slate-400">{item.label}</p>
                    <h3 className="text-sm font-black text-slate-950 group-hover:text-primary">
                      {item.title}
                    </h3>
                  </div>
                </div>
                <p className="text-xs leading-6 text-slate-500">{item.body}</p>
              </Link>
            );
          })}
        </div>
        <Link
          href="/keiba-data"
          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-blue-600"
        >
          データの見方を確認する
          <ListChecks className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </section>
  );
}
