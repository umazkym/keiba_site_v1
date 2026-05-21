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

function RaceSignalCard({
  title,
  signal,
  tone,
}: {
  title: string;
  signal: RaceSignal;
  tone: 'solid' | 'light';
}) {
  const toneClass =
    tone === 'solid'
      ? 'border-slate-900 bg-slate-950 text-white'
      : 'border-slate-200 bg-white text-slate-950';
  const mutedClass = tone === 'solid' ? 'text-slate-300' : 'text-slate-500';
  const badgeClass = tone === 'solid' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600';

  return (
    <Link
      href={signal.href}
      className={`group flex h-full flex-col border p-4 transition-colors hover:border-primary ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-bold tracking-[0.14em] ${mutedClass}`}>{title}</p>
          <h3 className="mt-1 line-clamp-2 text-lg font-black leading-snug">
            {signal.venueName}{signal.race.race_number}R {signal.race.race_name}
          </h3>
        </div>
        <span className={`shrink-0 px-2 py-1 text-xs font-bold ${badgeClass}`}>
          {signal.runnerCount}頭
        </span>
      </div>
      <p className={`mt-2 text-xs font-semibold ${mutedClass}`}>{formatCourse(signal.race)}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className={tone === 'solid' ? 'bg-white/10 p-3' : 'bg-slate-50 p-3'}>
          <p className={`text-[11px] font-bold ${mutedClass}`}>AI 1位</p>
          <p className="mt-1 truncate font-black" title={signal.topHorseName}>{signal.topHorseName}</p>
        </div>
        <div className={tone === 'solid' ? 'bg-white/10 p-3' : 'bg-slate-50 p-3'}>
          <p className={`text-[11px] font-bold ${mutedClass}`}>偏差値差</p>
          <p className="mt-1 font-black">{signal.scoreGap.toFixed(1)}</p>
        </div>
      </div>
      <p className={`mt-4 text-sm leading-7 ${mutedClass}`}>{signal.reason}</p>
      <span className="mt-auto pt-4 text-sm font-black text-primary group-hover:underline">
        レースを見る
      </span>
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
  const highConfidenceCount = signals.filter((signal) => signal.confidenceScore >= 72).length;
  const closeRaceCount = signals.filter((signal) => signal.scoreGap <= 2.5).length;

  return (
    <section className="mb-4 border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-slate-400">TODAY DASHBOARD</p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-slate-950">
              今日見るべきレースの整理
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              {date.replace(/-/g, '/')}の全レースをAI偏差値の差、頭数、上位評価の固まり方で横断整理します。
              まず確認するレース、荒れやすいレース、指数上位馬を短時間で見分けるための入口です。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:w-[440px]">
            {[
              ['開催場', `${venues}`],
              ['対象レース', `${totalRaces}`],
              ['軸候補', `${highConfidenceCount}`],
              ['混戦', `${closeRaceCount}`],
            ].map(([label, value]) => (
              <div key={label} className="border border-slate-200 bg-white p-3 text-center">
                <p className="text-[11px] font-bold text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {confidenceRaces[0] && (
          <RaceSignalCard title="まず確認" signal={confidenceRaces[0]} tone="solid" />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {upsetRaces.slice(0, 2).map((signal, index) => (
            <RaceSignalCard key={signal.href} title={index === 0 ? '混戦注意' : '相手探し'} signal={signal} tone="light" />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-black text-slate-950">AI偏差値上位馬</h3>
          <p className="text-xs font-semibold text-slate-400">上位5件</p>
        </div>
        <div className="divide-y divide-slate-100 border-y border-slate-100">
          {topScoreRaces.map((signal) => (
            <Link key={signal.href} href={signal.href} className="grid gap-2 py-3 text-sm transition-colors hover:bg-slate-50 sm:grid-cols-[1fr_180px_100px] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-black text-slate-900">
                  {signal.venueName}{signal.race.race_number}R {signal.race.race_name}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatCourse(signal.race)}</p>
              </div>
              <p className="truncate font-bold text-slate-700" title={signal.topHorseName}>
                {signal.topHorseName}
              </p>
              <p className="font-mono text-base font-black text-primary sm:text-right">
                {signal.topScore.toFixed(1)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
