'use client';

import { useCallback, useEffect, useState } from 'react';

import {
    raceAnalysisFeatures,
    raceAnalysisSectionTrackingItems,
    RaceAnalysisFeatureIcon,
    RaceAnalysisFeatureVisual,
} from '@/components/RaceAnalysisValueGrid';
import { useRaceSectionNavigation } from '@/hooks/useRaceSectionNavigation';
import {
    getGoogleAdOverlaySnapshot,
    GOOGLE_AD_OVERLAY_EVENT,
    type GoogleAdOverlaySnapshot,
} from '@/lib/google-ad-overlay';

export function RacePageBottomNav() {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(raceAnalysisSectionTrackingItems);
    const [isInAnalysisRange, setIsInAnalysisRange] = useState(false);
    const [googleOverlay, setGoogleOverlay] = useState(getGoogleAdOverlaySnapshot);

    const observeAnalysisRange = useCallback(() => {
        const predictionSection = document.getElementById('race-prediction-section');
        const analysisEnd = document.getElementById('race-related-articles-section')
            ?? document.getElementById('race-analysis-section');
        if (!predictionSection || !analysisEnd) {
            setIsInAnalysisRange(false);
            return () => undefined;
        }

        let hasReachedPrediction = false;
        let hasNotPassedEnd = true;
        const syncRange = () => setIsInAnalysisRange(hasReachedPrediction && hasNotPassedEnd);
        const predictionObserver = new IntersectionObserver(([entry]) => {
            hasReachedPrediction = entry.isIntersecting
                || entry.boundingClientRect.top <= window.innerHeight - 48;
            syncRange();
        });
        const endObserver = new IntersectionObserver(([entry]) => {
            hasNotPassedEnd = entry.isIntersecting || entry.boundingClientRect.bottom > 48;
            syncRange();
        });
        predictionObserver.observe(predictionSection);
        endObserver.observe(analysisEnd);

        return () => {
            predictionObserver.disconnect();
            endObserver.disconnect();
        };
    }, []);

    useEffect(() => {
        const disconnectRangeObservers = observeAnalysisRange();
        const handleOverlayChange = (event: Event) => {
            setGoogleOverlay((event as CustomEvent<GoogleAdOverlaySnapshot>).detail);
        };
        window.addEventListener(GOOGLE_AD_OVERLAY_EVENT, handleOverlayChange);

        return () => {
            disconnectRangeObservers();
            window.removeEventListener(GOOGLE_AD_OVERLAY_EVENT, handleOverlayChange);
        };
    }, [observeAnalysisRange]);

    const isVisible = isInAnalysisRange
        && !googleOverlay.offerwallVisible
        && !googleOverlay.dialogVisible
        && googleOverlay.bottomAnchorHeight === 0;

    return (
        <nav
            className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-300 bg-white px-1 pb-[calc(env(safe-area-inset-bottom,0px)+var(--safari-bottom-offset,0px)+0.0625rem)] pt-px shadow-[0_-3px_10px_rgba(15,23,42,0.10)] transition-[transform,opacity] duration-200 lg:hidden ${isVisible
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-full opacity-0'
                }`}
            aria-label="レースページ内ナビゲーション"
            aria-hidden={!isVisible}
        >
            <div className="mx-auto grid max-w-md grid-cols-4 overflow-hidden rounded-lg border border-slate-200 bg-white divide-x divide-slate-200">
                {raceAnalysisFeatures.map((feature) => {
                    const isActive = activeKey === feature.key;
                    return (
                        <button
                            key={feature.key}
                            type="button"
                            onClick={() => scrollToItem(feature)}
                            tabIndex={isVisible ? 0 : -1}
                            aria-current={isActive ? 'location' : undefined}
                            className={`flex min-h-11 min-w-0 flex-col items-center justify-center border-t-2 px-1 py-px text-center transition-colors duration-150 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isActive
                                ? 'border-blue-600 bg-blue-50/80 text-slate-950'
                                : 'border-transparent bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                }`}
                        >
                            <span className="flex min-w-0 items-center justify-center gap-1">
                                <RaceAnalysisFeatureIcon feature={feature} />
                                <span className={`whitespace-nowrap text-[11px] leading-none tracking-[-0.02em] ${isActive ? 'font-black' : 'font-bold'}`}>
                                    {feature.compactTitle}
                                </span>
                            </span>
                            <span className={`flex h-3 w-full max-w-[52px] items-center rounded bg-slate-50 px-1 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                <RaceAnalysisFeatureVisual type={feature.visual} compact />
                            </span>
                            {isActive && <span className="sr-only">（表示中）</span>}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
