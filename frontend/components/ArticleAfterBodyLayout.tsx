'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sendArticleAdPlacementExposureEvent } from '@/lib/analytics';

type PlacementVariant = 'control' | 'after_body_before_related';
type PlacementMode = 'control' | 'split' | 'variant';

const STORAGE_KEY = 'uma_article_ad_placement_variant_v1';

function placementMode(): PlacementMode {
  const value = String(process.env.NEXT_PUBLIC_ARTICLE_AD_PLACEMENT_MODE || 'control').toLowerCase();
  return value === 'split' || value === 'variant' ? value : 'control';
}

function getSessionVariant(): PlacementVariant {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'control' || stored === 'after_body_before_related') return stored;
    const assigned: PlacementVariant = Math.random() < 0.5 ? 'control' : 'after_body_before_related';
    window.sessionStorage.setItem(STORAGE_KEY, assigned);
    return assigned;
  } catch {
    return Math.random() < 0.5 ? 'control' : 'after_body_before_related';
  }
}

export function ArticleAfterBodyLayout({
  articleSlug,
  relatedContent,
  adContent,
}: {
  articleSlug: string;
  relatedContent: ReactNode;
  adContent: ReactNode;
}) {
  const mode = placementMode();
  const [variant, setVariant] = useState<PlacementVariant>(
    mode === 'variant' ? 'after_body_before_related' : 'control',
  );
  const exposureSentRef = useRef(false);

  useEffect(() => {
    if (mode === 'control' || exposureSentRef.current) return;
    const assigned = mode === 'variant' ? 'after_body_before_related' : getSessionVariant();
    setVariant(assigned);
    exposureSentRef.current = true;
    sendArticleAdPlacementExposureEvent({ variant: assigned, article_slug: articleSlug });
  }, [articleSlug, mode]);

  const adFirst = variant === 'after_body_before_related';
  return (
    <div className="flex flex-col" data-article-ad-layout={variant}>
      <div className={adFirst ? 'order-2' : 'order-1'}>{relatedContent}</div>
      <div className={adFirst ? 'order-1' : 'order-2'}>{adContent}</div>
    </div>
  );
}
