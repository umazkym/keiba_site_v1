'use client';

import { useEffect, useRef } from 'react';
import {
  sendArticleRaceClickEvent,
  sendArticleReadCompleteEvent,
} from '@/lib/analytics';

type ArticleEngagementTrackerProps = {
  slug: string;
  category: string;
  readingTimeMin: number;
};

export function ArticleEngagementTracker({
  slug,
  category,
  readingTimeMin,
}: ArticleEngagementTrackerProps) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const hasSentReadCompleteRef = useRef(false);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !('IntersectionObserver' in window)) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting || hasSentReadCompleteRef.current) return;

      hasSentReadCompleteRef.current = true;
      sendArticleReadCompleteEvent({
        article_slug: slug,
        article_category: category,
        reading_time_min: readingTimeMin,
        page_path: window.location.pathname,
      });
      observer.disconnect();
    }, {
      threshold: 0,
      rootMargin: '0px 0px -10% 0px',
    });

    observer.observe(marker);
    return () => observer.disconnect();
  }, [category, readingTimeMin, slug]);

  useEffect(() => {
    const marker = markerRef.current;
    const article = marker?.closest('article');
    if (!article) return undefined;

    const handleClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || !article.contains(anchor)) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/races/')) {
        return;
      }

      const placement =
        anchor.dataset.analyticsPlacement ||
        (anchor.closest('.article-page-prose') ? 'article_body' : 'article_navigation');
      const destinationType = url.pathname === '/races/today'
        ? 'today'
        : /^\/races\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)
          ? 'race_date'
          : 'exact_race';

      sendArticleRaceClickEvent({
        article_slug: slug,
        article_category: category,
        link_path: `${url.pathname}${url.search}`,
        link_placement: placement,
        destination_type: destinationType,
        race_id: anchor.dataset.raceId,
        race_name: anchor.dataset.raceName,
        race_date: anchor.dataset.raceDate,
        preview_state: anchor.dataset.previewState as 'available' | 'metadata_only' | 'unavailable' | 'generic' | undefined,
      });
    };

    article.addEventListener('click', handleClick);
    return () => article.removeEventListener('click', handleClick);
  }, [category, slug]);

  return (
    <span
      ref={markerRef}
      className="block h-px w-full overflow-hidden"
      aria-hidden="true"
      data-article-read-complete-marker
    />
  );
}
