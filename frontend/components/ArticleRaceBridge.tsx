'use client';

import Link from 'next/link';
import { ArrowRight, Gauge } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import type { ArticleRacePreviewResponse } from '@/lib/types';
import { sendArticleRacePreviewViewEvent, type ArticleRacePreviewState } from '@/lib/analytics';

type ArticleRaceBridgeProps = {
  articleSlug: string;
  articleCategory: string;
  raceId: string;
  raceName: string;
  raceDate: string;
  venueName: string;
  raceNumber?: number;
  raceUrl: string;
  preview: ArticleRacePreviewResponse;
};

function formatAsOf(value: string | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function courseLabel(preview: ArticleRacePreviewResponse): string {
  const race = preview?.race;
  if (!race) return '';
  const course = race.course_type === 'ダ' ? 'ダート' : race.course_type;
  return [course, race.distance ? `${race.distance}m` : ''].filter(Boolean).join('');
}

export function ArticleRaceBridge({
  articleSlug,
  articleCategory,
  raceId,
  raceName,
  raceDate,
  venueName,
  raceNumber,
  raceUrl,
  preview,
}: ArticleRaceBridgeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef(false);
  const verifiedPreview = preview?.status === 'available'
    && preview.race?.id === raceId
    && preview.race.race_url === raceUrl
    && preview.top_predictions.length > 0
    ? preview
    : null;
  const previewState: ArticleRacePreviewState = verifiedPreview ? 'available' : 'unavailable';

  useEffect(() => {
    const node = rootRef.current;
    if (!node || sentRef.current || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || sentRef.current) return;
      sentRef.current = true;
      sendArticleRacePreviewViewEvent({
        article_slug: articleSlug,
        article_category: articleCategory,
        race_id: raceId,
        race_name: raceName,
        race_date: raceDate,
        preview_state: previewState,
        link_placement: 'article_race_bridge',
      });
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [articleCategory, articleSlug, previewState, raceDate, raceId, raceName]);

  if (!verifiedPreview) return null;

  const liveRace = verifiedPreview.race;
  const meta = [
    raceDate.replace(/-/g, '/'),
    liveRace?.venue_name || venueName,
    `${liveRace?.race_number || raceNumber || ''}R`,
    courseLabel(verifiedPreview),
  ].filter((item) => item && item !== 'R');

  return (
    <div ref={rootRef} className="mt-4 sm:mt-6" data-article-race-bridge>
      <Link
        href={raceUrl}
        prefetch={false}
        data-analytics-placement="article_race_bridge"
        data-race-id={raceId}
        data-race-name={raceName}
        data-race-date={raceDate}
        data-preview-state={previewState}
        className="block min-h-[44px] cursor-pointer rounded-xl border border-blue-200 bg-slate-50 p-3 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:p-4"
        aria-label={`${raceName}の全頭AI偏差値と4つの分析を見る`}
      >
        <section aria-labelledby={`article-race-bridge-${articleSlug}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700" aria-hidden="true">
                  <Gauge className="h-4 w-4" />
                </span>
                <h2 id={`article-race-bridge-${articleSlug}`} className="min-w-0 text-sm font-black leading-tight text-slate-950 sm:text-base">
                  {raceName}の実データ
                </h2>
              </div>
              <p className="mt-1.5 text-xs font-semibold text-slate-600 sm:text-sm">
                {meta.join(' ・ ')}
              </p>
            </div>
            <span className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[11px] font-black text-blue-700 sm:text-xs">
              全頭分析へ <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-3 border-t border-slate-200 pt-2.5">
              <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 text-xs sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:text-sm">
                {verifiedPreview.top_predictions.slice(0, 3).map((prediction) => (
                  <div key={`${prediction.horse_number}-${prediction.horse_name}`} className="contents">
                    <span className="font-mono font-black text-slate-700">{prediction.horse_number}</span>
                    <span className="min-w-0 truncate font-bold text-slate-900" title={prediction.horse_name}>
                      {prediction.horse_name}
                    </span>
                    <span className="whitespace-nowrap font-mono font-black text-amber-700">
                      {prediction.mark ? `${prediction.mark} ` : ''}{prediction.deviation_score?.toFixed(1) ?? '--'}
                    </span>
                  </div>
                ))}
              </div>
              {formatAsOf(verifiedPreview.as_of) && (
                <p className="mt-2 text-right text-[11px] font-medium text-slate-500">
                  {formatAsOf(verifiedPreview.as_of)}取得
                </p>
              )}
          </div>
        </section>
      </Link>
    </div>
  );
}
