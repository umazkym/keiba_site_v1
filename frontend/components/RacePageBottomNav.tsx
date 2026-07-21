'use client';

import { useCallback, useEffect, useState } from 'react';

import {
    raceAnalysisFeatures,
    raceAnalysisSectionTrackingItems,
    RaceAnalysisFeatureIcon,
    RaceAnalysisFeatureVisual,
} from '@/components/RaceAnalysisValueGrid';
import { useRaceSectionNavigation } from '@/hooks/useRaceSectionNavigation';

export function RacePageBottomNav() {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(raceAnalysisSectionTrackingItems);
    const [isInAnalysisRange, setIsInAnalysisRange] = useState(false);
    const [hasBottomAnchorAd, setHasBottomAnchorAd] = useState(false);

    const updateVisibility = useCallback(() => {
        const predictionSection = document.getElementById('race-prediction-section');
        const analysisSection = document.getElementById('race-analysis-section');
        if (!predictionSection || !analysisSection) {
            setIsInAnalysisRange(false);
            return;
        }

        const predictionRect = predictionSection.getBoundingClientRect();
        const analysisRect = analysisSection.getBoundingClientRect();
        setIsInAnalysisRange(
            predictionRect.top <= window.innerHeight - 72
            && analysisRect.bottom > 64,
        );

        const adCandidates = document.querySelectorAll<HTMLElement>(
            'ins.adsbygoogle-noablate, ins.adsbygoogle[data-anchor-status], [data-google-query-id][style*="position: fixed"]',
        );
        const bottomAnchorIsVisible = Array.from(adCandidates).some((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none'
                && style.visibility !== 'hidden'
                && Number(style.opacity || '1') > 0
                && rect.height >= 24
                && rect.width >= window.innerWidth * 0.45
                && rect.top >= window.innerHeight * 0.45
                && rect.bottom >= window.innerHeight - 4;
        });
        setHasBottomAnchorAd(bottomAnchorIsVisible);
    }, []);

    useEffect(() => {
        let frameId = 0;
        const requestUpdate = () => {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(updateVisibility);
        };
        const observer = new MutationObserver(requestUpdate);

        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['class', 'style', 'data-anchor-status'],
        });
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        requestUpdate();

        return () => {
            window.cancelAnimationFrame(frameId);
            observer.disconnect();
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
        };
    }, [updateVisibility]);

    const isVisible = isInAnalysisRange && !hasBottomAnchorAd;

    return (
        <nav
            className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-300 bg-slate-50/95 px-1.5 pb-[calc(env(safe-area-inset-bottom)+0.125rem)] pt-0.5 shadow-[0_-4px_14px_rgba(15,23,42,0.10)] backdrop-blur-sm transition-[transform,opacity] duration-200 lg:hidden ${isVisible
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
                            className={`flex min-h-[50px] min-w-0 flex-col items-center justify-center border-t-2 px-1 py-0.5 text-center transition-colors duration-150 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isActive
                                ? 'border-blue-600 bg-blue-50/80 text-slate-950'
                                : 'border-transparent bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                }`}
                        >
                            <span className="mb-0.5 flex min-w-0 items-center justify-center gap-1">
                                <RaceAnalysisFeatureIcon feature={feature} />
                                <span className={`whitespace-nowrap text-[11px] leading-none tracking-[-0.02em] ${isActive ? 'font-black' : 'font-bold'}`}>
                                    {feature.compactTitle}
                                </span>
                            </span>
                            <span className={`flex h-4 w-full max-w-[54px] items-center rounded bg-slate-50 px-1 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
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
