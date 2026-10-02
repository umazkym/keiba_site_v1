import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// 記事の本文を読み終えた所に置く、レースのページへの1行の枠。
// クリックは ArticleEngagementTracker が <article> の中の /races/ へのリンクとして拾う
// （article_race_click。link_placement は data-analytics-placement）。<article> の外へ動かさない。
export type ArticleEndRaceLinkRace = {
  raceId: string;
  raceName: string;
  // YYYY-MM-DD
  raceDate: string;
  raceUrl: string;
  venueName?: string;
  raceNumber?: number;
};

type ArticleEndRaceLinkProps = {
  // 予測のプレビューまで確かめられた重賞の記事だけ渡す。無ければ今日のレースへ案内する。
  race?: ArticleEndRaceLinkRace | null;
};

// 2026-10-04 → 10/4。形が違うときは出さない（値を作らない）。
function formatMonthDay(value: string): string {
  const matched = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return '';
  return `${Number(matched[1])}/${Number(matched[2])}`;
}

// 例：10/4 中山11R ・ AI偏差値と4つの分析。場・R が無い記事では、ある物だけを出す。
function raceDescription(race: ArticleEndRaceLinkRace): string {
  const place = `${race.venueName || ''}${race.raceNumber ? `${race.raceNumber}R` : ''}`;
  const when = [formatMonthDay(race.raceDate), place].filter(Boolean).join(' ');
  return [when, 'AI偏差値と4つの分析'].filter(Boolean).join(' ・ ');
}

export function ArticleEndRaceLink({ race }: ArticleEndRaceLinkProps) {
  const title = race ? `${race.raceName}の全頭分析を見る` : '今日のレース分析を見る';
  const description = race ? raceDescription(race) : 'AI偏差値など4つの視点で確認できます';

  return (
    <div className="mb-3 mt-1 max-w-[760px] sm:mb-6 sm:mt-0" data-article-end-race-link>
      <Link
        href={race ? race.raceUrl : '/races/today'}
        prefetch={false}
        data-analytics-placement="article_end_race_link"
        data-race-id={race?.raceId}
        data-race-name={race?.raceName}
        data-race-date={race?.raceDate}
        data-preview-state={race ? 'available' : 'generic'}
        className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-brand-200 bg-slate-50 px-3 py-2.5 transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:px-4 sm:py-3"
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight text-slate-950 sm:text-base">{title}</span>
          <span className="mt-1 block text-xs font-semibold text-slate-600">{description}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
      </Link>
    </div>
  );
}
