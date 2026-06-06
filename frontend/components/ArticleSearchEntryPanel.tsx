import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BarChart3, Gauge, LineChart, ListChecks, Swords } from 'lucide-react';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import type { TopPayoutHit } from '@/lib/types';

interface ArticleSearchEntryPanelProps {
  topHits?: TopPayoutHit[];
}

const FeaturePreviewCard = ({
  title,
  label,
  description,
  icon,
  children,
}: {
  title: string;
  label: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) => (
  <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="mb-3 flex items-start gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400">{label}</p>
        <p className="truncate text-[13px] font-bold text-slate-900">{title}</p>
      </div>
    </div>
    <div className="mb-3 min-h-[76px]">{children}</div>
    <p className="mt-auto text-[11px] leading-relaxed text-slate-500">{description}</p>
  </div>
);

export function ArticleSearchEntryPanel({ topHits }: ArticleSearchEntryPanelProps) {
  const initialHits = topHits ? topHits.slice(0, 5) : [];

  return (
    <section className="space-y-5">
      <div className="flex justify-center sm:justify-start">
        <Link
          href="/races/today"
          className="hero-btn group justify-center border border-slate-200"
        >
          本日の分析を見る
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </div>

      <TopHitsDisplay initialHits={initialHits} />

      <section>
        <h2 className="sec-title">
          <span className="bar bg-secondary" />
          本サイト独自の分析データ
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FeaturePreviewCard
            label="独自指標"
            title="AI偏差値"
            icon={<Gauge className="h-4 w-4" />}
            description="過去走・適性・展開力を独自アルゴリズムで数値化し、出走全頭を一覧で比較できます"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>上位候補</span><span>偏差値</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[88%] rounded-full bg-blue-600" /></div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[72%] rounded-full bg-slate-500" /></div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[61%] rounded-full bg-amber-500" /></div>
            </div>
          </FeaturePreviewCard>

          <FeaturePreviewCard
            label="レース展開"
            title="脚質予測"
            icon={<LineChart className="h-4 w-4" />}
            description="各コーナーでの隊列をシミュレーションし、展開の有利不利を確認できます"
          >
            <div className="flex h-[74px] items-end gap-1.5 rounded-lg bg-slate-50 px-3 pb-2 pt-3">
              {[68, 42, 74, 52, 35].map((height, index) => (
                <div key={index} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${height}%` }} />
                  <span className="text-[9px] font-semibold text-slate-400">{index + 1}C</span>
                </div>
              ))}
            </div>
          </FeaturePreviewCard>

          <FeaturePreviewCard
            label="馬同士の直接比較"
            title="対戦成績"
            icon={<Swords className="h-4 w-4" />}
            description="出走馬同士の過去の直接対決をマトリクスで表示しています"
          >
            <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-bold">
              {['+2', '0', '-1', '+1', '+3', '0', '-2', '+1', '+2'].map((value, index) => (
                <span
                  key={`${value}-${index}`}
                  className={`rounded-md py-1.5 ${value.startsWith('+') ? 'bg-emerald-50 text-emerald-700' : value.startsWith('-') ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {value}
                </span>
              ))}
            </div>
          </FeaturePreviewCard>

          <FeaturePreviewCard
            label="コース別データ"
            title="枠順傾向"
            icon={<BarChart3 className="h-4 w-4" />}
            description="コース・距離・馬場状態ごとの枠順別勝率を集計しています"
          >
            <div className="space-y-1.5">
              {[82, 54, 68, 40].map((width, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-7 text-[10px] font-semibold text-slate-400">{index + 1}枠</span>
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-amber-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </FeaturePreviewCard>

          <FeaturePreviewCard
            label="テキスト解説"
            title="AI分析コメント"
            icon={<ListChecks className="h-4 w-4" />}
            description="展開予想・適性評価・リスク要因をテキストで解説しています"
          >
            <div className="space-y-1.5 rounded-lg bg-slate-50 p-2.5 text-[10px] text-slate-600">
              <div className="h-1.5 w-[92%] rounded-full bg-slate-300" />
              <div className="h-1.5 w-[74%] rounded-full bg-slate-300" />
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-blue-700">展開</span>
                <span className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-emerald-700">適性</span>
                <span className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-amber-700">リスク</span>
              </div>
            </div>
          </FeaturePreviewCard>
        </div>
      </section>
    </section>
  );
}
