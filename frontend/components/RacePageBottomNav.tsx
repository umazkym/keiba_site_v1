'use client';

import type { ReactNode } from 'react';
import { useRaceSectionNavigation, type RaceSectionNavItem } from '@/hooks/useRaceSectionNavigation';

type BottomNavItem = RaceSectionNavItem & {
    label: string;
    visual: ReactNode;
};

const bottomNavItems: BottomNavItem[] = [
    {
        key: 'top',
        label: 'TOP',
        targetIds: ['race-page-top'],
        visual: (
            <span className="flex h-4 w-8 items-center justify-center gap-0.5">
                <span className="h-2.5 w-1.5 rounded-sm bg-primary/70" />
                <span className="h-3.5 w-1.5 rounded-sm bg-primary" />
                <span className="h-2 w-1.5 rounded-sm bg-primary/50" />
            </span>
        ),
    },
    {
        key: 'prediction',
        label: 'AI偏差値',
        targetIds: ['race-prediction-heading', 'race-prediction-section'],
        visual: (
            <span className="flex w-8 flex-col gap-0.5">
                <span className="h-1 w-full rounded-full bg-blue-500" />
                <span className="h-1 w-[72%] rounded-full bg-amber-400" />
                <span className="h-1 w-[58%] rounded-full bg-slate-300" />
            </span>
        ),
    },
    {
        key: 'detail',
        label: 'データ分析',
        targetIds: ['race-detail-heading', 'race-detail-data-section'],
        visual: (
            <span className="flex h-4 w-8 items-end gap-0.5">
                <span className="h-2.5 flex-1 rounded-t bg-emerald-500/80" />
                <span className="h-4 flex-1 rounded-t bg-emerald-500" />
                <span className="h-1.5 flex-1 rounded-t bg-emerald-400/70" />
                <span className="h-3 flex-1 rounded-t bg-emerald-500/80" />
            </span>
        ),
    },
    {
        key: 'matchup',
        label: '対決成績',
        targetIds: ['race-matchup-heading', 'race-matchup-section', 'race-detail-data-section'],
        visual: (
            <span className="grid w-8 grid-cols-3 gap-0.5">
                <span className="h-1.5 rounded-sm bg-emerald-200" />
                <span className="h-1.5 rounded-sm bg-slate-200" />
                <span className="h-1.5 rounded-sm bg-rose-200" />
                <span className="h-1.5 rounded-sm bg-slate-200" />
                <span className="h-1.5 rounded-sm bg-emerald-300" />
                <span className="h-1.5 rounded-sm bg-slate-200" />
            </span>
        ),
    },
];

export function RacePageBottomNav() {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(bottomNavItems);

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-0.5 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur md:hidden"
            aria-label="レースページ内ナビゲーション"
        >
            <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
                {bottomNavItems.map((item) => {
                    const isActive = activeKey === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => scrollToItem(item)}
                            className={`flex min-h-[44px] min-w-0 flex-col items-center justify-center rounded-xl px-1 text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/25 active:scale-[0.98] ${isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                        >
                            <span className={`mb-0.5 flex h-5 w-9 items-center justify-center rounded-lg border ${isActive ? 'border-primary/15 bg-white shadow-sm' : 'border-slate-100 bg-slate-50'}`}>
                                {item.visual}
                            </span>
                            <span className="w-full truncate text-[10px] font-black leading-tight">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
