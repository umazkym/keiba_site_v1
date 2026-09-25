'use client';

import {
    raceAnalysisFeatures,
    raceAnalysisSectionTrackingItems,
} from '@/components/RaceAnalysisValueGrid';
import { LineIcon } from '@/components/LineIcon';
import { useRaceSectionNavigation } from '@/hooks/useRaceSectionNavigation';

type RacePageJumpNavProps = {
    className?: string;
};

export function RacePageJumpNav({ className = '' }: RacePageJumpNavProps) {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(raceAnalysisSectionTrackingItems);

    return (
        <nav
            data-race-analysis-sidebar
            className={`hidden rounded-xl border border-slate-200 bg-white p-4 lg:block ${className}`}
            aria-label="レース内の分析メニュー"
        >
            <h2 className="race-section-heading !text-[17px]">分析メニュー</h2>
            <ul className="flex flex-col gap-0.5">
                {raceAnalysisFeatures.map((feature) => {
                    const isActive = activeKey === feature.key;
                    return (
                        <li key={feature.key}>
                            <button
                                type="button"
                                onClick={() => scrollToItem(feature)}
                                aria-current={isActive ? 'location' : undefined}
                                className={`flex min-h-10 w-full min-w-0 items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[14.5px] font-bold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${isActive
                                    ? 'bg-brand-50 text-navy'
                                    : 'text-slate-700 hover:bg-slate-50 hover:text-navy'
                                    }`}
                            >
                                <LineIcon name={feature.lineIcon} size={18} className={`block shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-500'}`} />
                                {feature.title}
                                {isActive && <span className="sr-only">（表示中）</span>}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
