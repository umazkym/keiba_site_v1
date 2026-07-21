'use client';

import { useEffect, useState } from 'react';

import {
    raceAnalysisFeatures,
    raceAnalysisSectionTrackingItems,
    RaceAnalysisFeatureIcon,
    RaceAnalysisFeatureVisual,
} from '@/components/RaceAnalysisValueGrid';
import { useRaceSectionNavigation } from '@/hooks/useRaceSectionNavigation';
import { RACE_ACTIVE_SUMMARY_EVENT, type RaceActiveSummary } from '@/lib/race-active-event';

type RacePageJumpNavProps = {
    className?: string;
};

export function RacePageJumpNav({ className = '' }: RacePageJumpNavProps) {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(raceAnalysisSectionTrackingItems);
    const [activeRace, setActiveRace] = useState<RaceActiveSummary | null>(null);

    useEffect(() => {
        const updateFromDom = () => {
            const element = document.querySelector<HTMLElement>('[data-active-race-summary="true"]');
            if (!element) return;
            const raceNumber = Number(element.dataset.raceNumber);
            if (!Number.isFinite(raceNumber)) return;
            setActiveRace({
                venueName: element.dataset.venueName || '',
                raceNumber,
                raceName: element.dataset.raceName || '',
                courseLabel: element.dataset.courseLabel || '',
            });
        };
        const handleSummary = (event: Event) => {
            setActiveRace((event as CustomEvent<RaceActiveSummary>).detail);
        };

        updateFromDom();
        window.addEventListener(RACE_ACTIVE_SUMMARY_EVENT, handleSummary);
        return () => window.removeEventListener(RACE_ACTIVE_SUMMARY_EVENT, handleSummary);
    }, []);

    return (
        <nav
            data-race-jump-nav
            className={`sticky top-16 z-40 hidden h-14 overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm lg:block ${className}`}
            aria-label="レースデータの確認順"
        >
            <div className="grid h-full grid-cols-[minmax(190px,1.35fr)_repeat(4,minmax(0,1fr))] divide-x divide-slate-200">
                <div className="flex min-w-0 items-center gap-2 bg-slate-950 px-3 text-white">
                    <span className="flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md bg-white/10 font-mono text-xs font-black">
                        {activeRace ? `${activeRace.raceNumber}R` : '--R'}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-xs font-black">
                            {activeRace ? `${activeRace.venueName} ${activeRace.raceName}` : 'レースを選択'}
                        </span>
                        {activeRace?.courseLabel && (
                            <span className="block truncate text-[10px] font-semibold text-slate-300">{activeRace.courseLabel}</span>
                        )}
                    </span>
                </div>
                {raceAnalysisFeatures.map((feature) => {
                    const isActive = activeKey === feature.key;
                    return (
                        <button
                            key={feature.key}
                            type="button"
                            onClick={() => scrollToItem(feature)}
                            aria-current={isActive ? 'location' : undefined}
                            className={`flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 text-left transition-colors duration-150 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isActive
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
                            <span className={`hidden h-6 w-12 shrink-0 items-center rounded bg-slate-50 px-1.5 xl:flex ${isActive ? 'opacity-100' : 'opacity-70'}`}>
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
