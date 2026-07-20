'use client';

import type { ReactNode } from 'react';
import { ChartBarIcon, FlagIcon, SparklesIcon, UsersIcon } from './Icons';
import { useRaceSectionNavigation, type RaceSectionNavItem } from '@/hooks/useRaceSectionNavigation';

type BottomNavItem = RaceSectionNavItem & {
    label: string;
    icon: ReactNode;
};

const bottomNavItems: BottomNavItem[] = [
    {
        key: 'prediction',
        label: '偏差値',
        targetIds: ['race-prediction-heading', 'race-prediction-section'],
        icon: <SparklesIcon className="h-4 w-4" />,
    },
    {
        key: 'matchup',
        label: '対決',
        targetIds: ['race-matchup-heading', 'race-matchup-section'],
        icon: <UsersIcon className="h-4 w-4" />,
    },
    {
        key: 'start',
        label: '展開',
        targetIds: ['race-detail-heading', 'race-detail-data-section'],
        icon: <FlagIcon className="h-4 w-4" />,
    },
    {
        key: 'frame',
        label: '枠順',
        targetIds: ['race-frame-heading'],
        icon: <ChartBarIcon className="h-4 w-4" />,
    },
    {
        key: 'analysis',
        label: '展望',
        targetIds: ['race-analysis-heading', 'race-analysis-section'],
        icon: <SparklesIcon className="h-4 w-4" />,
    },
];

export function RacePageBottomNav() {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(bottomNavItems);

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 shadow-[0_-6px_18px_rgba(15,23,42,0.10)] backdrop-blur-sm md:hidden"
            aria-label="レースページ内ナビゲーション"
        >
            <div className="mx-auto grid max-w-md grid-cols-5 gap-0.5">
                {bottomNavItems.map((item) => {
                    const isActive = activeKey === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => scrollToItem(item)}
                            aria-current={isActive ? 'location' : undefined}
                            className={`flex min-h-[44px] min-w-0 flex-col items-center justify-center rounded-lg px-1 text-center transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isActive
                                ? 'bg-slate-950 text-white'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                                }`}
                        >
                            <span className="mb-0.5 flex h-5 items-center justify-center" aria-hidden="true">{item.icon}</span>
                            <span className="w-full truncate text-[10px] font-bold leading-tight">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
