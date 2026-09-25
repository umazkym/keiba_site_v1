'use client';

import { useCallback, useEffect, useState } from 'react';

import {
    raceAnalysisFeatures,
    raceAnalysisSectionTrackingItems,
} from '@/components/RaceAnalysisValueGrid';
import { LineIcon } from '@/components/LineIcon';
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
        // フッターが見えている間も隠す。ページの末尾に下ナビ用の余白を取らないため（2026-09-25 スマホの見直し）、
        // 関連記事の後ろが短いページでも、ナビがフッターの最後の行に重ならないようにする
        let isFooterInView = false;
        const syncRange = () => setIsInAnalysisRange(hasReachedPrediction && hasNotPassedEnd && !isFooterInView);
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

        const footers = document.querySelectorAll('footer');
        const siteFooter = footers.length > 0 ? footers[footers.length - 1] : null;
        const footerObserver = siteFooter
            ? new IntersectionObserver(([entry]) => {
                isFooterInView = entry.isIntersecting;
                syncRange();
            })
            : null;
        if (siteFooter && footerObserver) footerObserver.observe(siteFooter);

        return () => {
            predictionObserver.disconnect();
            endObserver.disconnect();
            footerObserver?.disconnect();
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
            className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[calc(env(safe-area-inset-bottom,0px)+var(--safari-bottom-offset,0px))] shadow-[0_-8px_20px_rgba(20,26,61,0.06)] transition-[transform,opacity] duration-200 lg:hidden ${isVisible
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-full opacity-0'
                }`}
            aria-label="レースページ内ナビゲーション"
            aria-hidden={!isVisible}
        >
            <div className="mx-auto grid max-w-md grid-cols-4">
                {raceAnalysisFeatures.map((feature) => {
                    const isActive = activeKey === feature.key;
                    return (
                        <button
                            key={feature.key}
                            type="button"
                            onClick={() => scrollToItem(feature)}
                            tabIndex={isVisible ? 0 : -1}
                            aria-current={isActive ? 'location' : undefined}
                            className={`relative flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-1 px-1 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${isActive
                                ? 'text-navy'
                                : 'text-slate-500 hover:text-navy'
                                }`}
                        >
                            {isActive && <span className="absolute inset-x-[18%] top-0 h-[3px] rounded-b-[3px] bg-brand-600" aria-hidden="true" />}
                            <LineIcon name={feature.lineIcon} size={20} className={`block shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-500'}`} />
                            <span className="whitespace-nowrap text-[11.5px] font-bold leading-none">
                                {feature.compactTitle}
                            </span>
                            {isActive && <span className="sr-only">（表示中）</span>}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
