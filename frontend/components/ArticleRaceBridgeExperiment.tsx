'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ArticleRaceBridge } from '@/components/ArticleRaceBridge';
import { sendArticleBridgeExperimentExposureEvent } from '@/lib/analytics';

type BridgeVariant = 'control' | 'treatment';
type BridgeMode = 'off' | 'split' | 'on';

const STORAGE_KEY = 'uma_article_race_bridge_variant_v1';

function bridgeMode(): BridgeMode {
  const value = String(process.env.NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE || 'off').toLowerCase();
  return value === 'split' || value === 'on' ? value : 'off';
}

function getSessionVariant(): BridgeVariant {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'control' || stored === 'treatment') return stored;
    const assigned: BridgeVariant = Math.random() < 0.5 ? 'control' : 'treatment';
    window.sessionStorage.setItem(STORAGE_KEY, assigned);
    return assigned;
  } catch {
    return Math.random() < 0.5 ? 'control' : 'treatment';
  }
}

export function ArticleRaceBridgeExperiment(props: ComponentProps<typeof ArticleRaceBridge>) {
  const mode = bridgeMode();
  const [variant, setVariant] = useState<BridgeVariant | null>(mode === 'on' ? 'treatment' : null);
  const exposureSentRef = useRef(false);

  useEffect(() => {
    if (mode === 'off' || exposureSentRef.current) return;
    const assigned = mode === 'on' ? 'treatment' : getSessionVariant();
    setVariant(assigned);
    exposureSentRef.current = true;
    sendArticleBridgeExperimentExposureEvent({
      variant: assigned,
      article_slug: props.articleSlug,
      race_id: props.raceId,
    });
  }, [mode, props.articleSlug, props.raceId]);

  if (variant !== 'treatment') return null;
  return <ArticleRaceBridge {...props} />;
}
