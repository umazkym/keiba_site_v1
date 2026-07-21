'use client';

import {
    raceAnalysisFeatures,
    raceAnalysisSectionTrackingItems,
    RaceAnalysisFeatureIcon,
    RaceAnalysisFeatureVisual,
} from '@/components/RaceAnalysisValueGrid';
import { useRaceSectionNavigation } from '@/hooks/useRaceSectionNavigation';

type RacePageJumpNavProps = {
    className?: string;
};

export function RacePageJumpNav({ className = '' }: RacePageJumpNavProps) {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(raceAnalysisSectionTrackingItems);

    return (
        <nav
            data-race-analysis-sidebar
            className={`hidden overflow-hidden rounded-lg border border-slate-200 bg-white lg:block ${className}`}
            aria-label="レース内の分析メニュー"
        >
            <h2 className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-900">分析メニュー</h2>
            <div className="grid divide-y divide-slate-200">
                {raceAnalysisFeatures.map((feature) => {
                    const isActive = activeKey === feature.key;
                    return (
                        <button
                            key={feature.key}
                            type="button"
                            onClick={() => scrollToItem(feature)}
                            aria-current={isActive ? 'location' : undefined}
                            className={`flex min-h-14 min-w-0 items-center justify-between gap-3 border-l-4 px-3 py-2 text-left transition-colors duration-150 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isActive
                                ? 'border-blue-600 bg-blue-50/80 text-slate-950'
                                : 'border-transparent bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                }`}
                        >
                            <span className="flex min-w-0 items-center gap-1.5">
                                <RaceAnalysisFeatureIcon feature={feature} />
                                <span className={`whitespace-nowrap text-xs ${isActive ? 'font-black' : 'font-bold'}`}>
                                    {feature.compactTitle}
                                </span>
                            </span>
                            <span className={`flex h-6 w-14 shrink-0 items-center rounded bg-slate-50 px-1.5 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
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
