import Link from 'next/link';
import { ArrowRight, BarChart3, Gauge, Trophy } from 'lucide-react';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import type { TopPayoutHit } from '@/lib/types';

interface ArticleSearchEntryPanelProps {
  topHits?: TopPayoutHit[];
}

const entryLinks = [
  {
    href: '/results/accuracy',
    title: '高配当的中ランキング',
    body: '直近の的中例を見て、どんな条件で配当が伸びたかを確認できます。',
    icon: Trophy,
  },
  {
    href: '/keiba-data',
    title: '本サイト独自の分析データ',
    body: 'AI偏差値、脚質予測、枠順傾向など、出馬表で使う指標の見方を整理しています。',
    icon: BarChart3,
  },
];

export function ArticleSearchEntryPanel({ topHits }: ArticleSearchEntryPanelProps) {
  const initialHits = topHits && topHits.length > 0 ? topHits.slice(0, 5) : undefined;

  return (
    <section
      aria-labelledby="article-search-entry-title"
      className="border border-slate-200 bg-slate-50 px-4 py-5 sm:px-5"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-slate-400">
            検索から来た方へ
          </p>
          <h2
            id="article-search-entry-title"
            className="mt-1 text-xl font-black leading-snug text-slate-950 sm:text-2xl"
          >
            記事の視点を、今日の出馬表で確認できます
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            UMA-FREEでは、読み物だけでなく当日の全レース分析も無料で公開しています。
            気になった条件は、そのまま今日のレースデータで見比べられます。
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/races/today"
              className="inline-flex items-center justify-center gap-2 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary"
            >
              本日の分析を見る
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/keiba-data"
              className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              独自データの見方
            </Link>
          </div>

          <div className="mt-5 grid border-y border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-slate-200">
            {entryLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex gap-3 py-3 sm:px-3 first:sm:pl-0 last:sm:pr-0"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-white text-slate-700 ring-1 ring-slate-200 transition-colors group-hover:text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black leading-6 text-slate-900 group-hover:text-primary">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs leading-6 text-slate-500">
                      {item.body}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-3 border-l-4 border-amber-400 bg-white px-3 py-3">
            <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-xs leading-6 text-slate-600">
              AI偏差値は、過去走、適性、展開、枠順などを比較しやすくするための独自指標です。
              記事で触れた材料を、レースごとの数値で確認できます。
            </p>
          </div>
        </div>

        <aside
          className="border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"
          aria-label="高配当的中ランキング"
        >
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-400">直近7日</p>
              <h3 className="text-base font-black text-slate-950">
                高配当的中ランキング
              </h3>
            </div>
            <Link
              href="/results/accuracy"
              className="shrink-0 text-xs font-bold text-slate-500 transition-colors hover:text-primary"
            >
              成績を見る
            </Link>
          </div>
          <div className="min-h-[250px]">
            <TopHitsDisplay initialHits={initialHits} compact />
          </div>
        </aside>
      </div>
    </section>
  );
}
