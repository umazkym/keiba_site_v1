'use client';

import {
    raceAnalysisFeatures,
    raceAnalysisSectionTrackingItems,
    RaceAnalysisFeatureIcon,
    RaceAnalysisFeatureVisual,
} from '@/components/RaceAnalysisValueGrid';
import { useRaceSectionNavigation } from '@/hooks/useRaceSectionNavigation';

export function RacePageBottomNav() {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(raceAnalysisSectionTrackingItems);

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-slate-50/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 shadow-[0_-6px_18px_rgba(15,23,42,0.10)] backdrop-blur-sm md:hidden"
            aria-label="レースページ内ナビゲーション"
        >
            <div className="mx-auto grid max-w-md grid-cols-4 overflow-hidden rounded-lg border border-slate-200 bg-white divide-x divide-slate-200">
                {raceAnalysisFeatures.map((feature) => {
                    const isActive = activeKey === feature.key;
                    return (
                        <button
                            key={feature.key}
                            type="button"
                            onClick={() => scrollToItem(feature)}
                            aria-current={isActive ? 'location' : undefined}
                            className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center border-t-2 px-1.5 py-1 text-center transition-colors duration-150 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isActive
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
                            <span className={`flex h-5 w-full max-w-[62px] items-center rounded bg-slate-50 px-1 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
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
