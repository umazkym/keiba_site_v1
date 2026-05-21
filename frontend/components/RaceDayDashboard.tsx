'use client';

import Link from 'next/link';
import type { RaceDayPrediction, RacePrediction } from '@/lib/types';
import { getRaceDetailPath } from '@/lib/race-url';

type RaceSignal = {
  race: RacePrediction;
  venueName: string;
  href: string;
  topHorseName: string;
  topScore: number;
  secondScore: number;
  scoreGap: number;
  runnerCount: number;
  scoreSpread: number;
  confidenceScore: number;
  upsetScore: number;
  reason: string;
};

function formatCourse(race: RacePrediction) {
  const course = race.course_type ?? '条件不明';
  const distance = race.distance ? `${race.distance}m` : '';
  return `${course}${distance ? ` ${distance}` : ''}`;
}

function toRaceSignals(data: RaceDayPrediction | null): RaceSignal[] {
  const venues = [...(data?.jra ?? []), ...(data?.nar ?? [])];

  return venues.flatMap((venue) =>
    venue.races
      .map((race) => {
        const scores = race.predictions
          .map((prediction) => prediction.deviation_score)
          .filter((score): score is number => typeof score === 'number')
          .sort((a, b) => b - a);

        if (scores.length === 0 || race.predictions.length === 0) return null;

        const topPrediction = [...race.predictions]
          .filter((prediction) => typeof prediction.deviation_score === 'number')
          .sort((a, b) => (b.deviation_score ?? 0) - (a.deviation_score ?? 0))[0];

        const topScore = scores[0] ?? 0;
        const secondScore = scores[1] ?? topScore;
        const bottomScore = scores[scores.length - 1] ?? topScore;
        const scoreGap = Math.max(0, topScore - secondScore);
        const scoreSpread = Math.max(0, topScore - bottomScore);
        const runnerCount = race.predictions.length;
        const confidenceScore = topScore + scoreGap * 3 + scoreSpread * 0.4 - runnerCount * 0.25;
        const upsetScore =
          (runnerCount >= 12 ? 10 : runnerCount >= 8 ? 5 : 0) +
          (scoreGap <= 2.5 ? 14 : scoreGap <= 5 ? 8 : 0) +
          (topScore < 58 ? 8 : topScore < 62 ? 4 : 0) +
          (scoreSpread <= 12 ? 6 : 0);

        let reason = 'AI上位馬と2番手の差を確認したいレースです。';
        if (confidenceScore >= 75 && scoreGap >= 5) {
          reason = 'AI偏差値1位の評価が抜けており、まず軸候補として確認したいレースです。';
        } else if (upsetScore >= 22) {
          reason = '上位評価が接近しており、相手候補や見送り条件を丁寧に見たいレースです。';
        } else if (runnerCount >= 12) {
          reason = '頭数が多く、展開と枠順で評価が動きやすいレースです。';
        }

        return {
          race,
          venueName: venue.venue_name,
          href: getRaceDetailPath(race.race_date, venue.venue_name, race.race_number),
          topHorseName: topPrediction?.horse_name ?? '不明',
          topScore,
          secondScore,
          scoreGap,
          runnerCount,
          scoreSpread,
          confidenceScore,
          upsetScore,
          reason,
        };
      })
      .filter((item): item is RaceSignal => item !== null),
  );
}

function CompactRaceLink({ signal }: { signal: RaceSignal }) {
  return (
    <Link
      href={signal.href}
      className="group grid gap-1 border-b border-slate-100 py-2.5 text-sm last:border-b-0 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_120px_64px] sm:items-center"
    >
      <div className="min-w-0 px-1">
        <p className="truncate font-bold text-slate-900">
          {signal.venueName}{signal.race.race_number}R {signal.race.race_name}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{formatCourse(signal.race)} / {signal.runnerCount}頭</p>
      </div>
      <p className="truncate px-1 font-semibold text-slate-600" title={signal.topHorseName}>{signal.topHorseName}</p>
      <p className="px-1 font-mono font-black text-primary sm:text-right">{signal.topScore.toFixed(1)}</p>
    </Link>
  );
}

export function RaceDayDashboard({ data, date }: { data: RaceDayPrediction | null; date: string }) {
  const signals = toRaceSignals(data);
  if (signals.length === 0) return null;

  const confidenceRaces = [...signals]
    .filter((signal) => signal.topScore >= 55)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 3);
  const upsetRaces = [...signals]
    .sort((a, b) => b.upsetScore - a.upsetScore || a.scoreGap - b.scoreGap)
    .slice(0, 3);
  const topScoreRaces = [...signals]
    .sort((a, b) => b.topScore - a.topScore)
    .slice(0, 5);

  const totalRaces = signals.length;
  const venues = new Set(signals.map((signal) => signal.venueName)).size;
  const closeRaceCount = signals.filter((signal) => signal.scoreGap <= 2.5).length;

  const primaryRace = confidenceRaces[0] ?? topScoreRaces[0];

  return (
    <details className="mb-3 border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.14em] text-slate-400">当日の見どころ</p>
            <h2 className="mt-0.5 truncate text-sm font-black text-slate-950 sm:text-base">
              今日のレース整理
            </h2>
          </div>
          <div className="hidden items-center gap-2 text-xs font-bold text-slate-500 sm:flex">
            <span>{venues}場</span>
            <span>{totalRaces}R</span>
            <span>混戦 {closeRaceCount}</span>
          </div>
          <span className="shrink-0 text-xs font-bold text-primary">見る</span>
        </div>
        {primaryRace && (
          <p className="mt-2 truncate text-xs text-slate-500">
            まず確認: {primaryRace.venueName}{primaryRace.race.race_number}R {primaryRace.race.race_name}
          </p>
        )}
      </summary>

      <div className="border-t border-slate-100 px-3 py-3 sm:px-4">
        <p className="text-xs leading-6 text-slate-500">
          {date.replace(/-/g, '/')}の全レースを、AI偏差値の差と頭数から簡易整理しています。
          本命を決める場所ではなく、見る順番を決めるための補助情報です。
        </p>

        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <div>
            <h3 className="border-b border-slate-200 pb-2 text-xs font-black tracking-[0.14em] text-slate-500">まず確認</h3>
            <div>
              {confidenceRaces.slice(0, 3).map((signal) => (
                <CompactRaceLink key={signal.href} signal={signal} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="border-b border-slate-200 pb-2 text-xs font-black tracking-[0.14em] text-slate-500">混戦注意</h3>
            <div>
              {upsetRaces.slice(0, 3).map((signal) => (
                <CompactRaceLink key={signal.href} signal={signal} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="border-b border-slate-200 pb-2 text-xs font-black tracking-[0.14em] text-slate-500">偏差値上位</h3>
            <div>
              {topScoreRaces.slice(0, 3).map((signal) => (
                <CompactRaceLink key={signal.href} signal={signal} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
