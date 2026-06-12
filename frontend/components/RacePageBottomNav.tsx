'use client';

import { BarChart3, Home, Sparkles, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRaceSectionNavigation, type RaceSectionNavItem } from '@/hooks/useRaceSectionNavigation';

type BottomNavItem = RaceSectionNavItem & {
    label: string;
    note: string;
    icon: ReactNode;
};

const bottomNavItems: BottomNavItem[] = [
    {
        key: 'top',
        label: 'TOP',
        note: '上部',
        targetIds: ['race-page-top'],
        icon: <Home className="h-4 w-4" />,
    },
    {
        key: 'prediction',
        label: 'AI偏差値',
        note: '予想表',
        targetIds: ['race-prediction-section'],
        icon: <Sparkles className="h-4 w-4" />,
    },
    {
        key: 'detail',
        label: 'データ分析',
        note: '展開',
        targetIds: ['race-detail-data-section'],
        icon: <BarChart3 className="h-4 w-4" />,
    },
    {
        key: 'matchup',
        label: '対決成績',
        note: '相性',
        targetIds: ['race-matchup-section', 'race-detail-data-section'],
        icon: <Users className="h-4 w-4" />,
    },
];

export function RacePageBottomNav() {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(bottomNavItems);

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur md:hidden"
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
                            className={`flex min-h-[54px] min-w-0 flex-col items-center justify-center rounded-xl px-1.5 text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/25 active:scale-[0.98] ${
                                isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                        >
                            <span className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-lg ${isActive ? 'bg-white shadow-sm' : 'bg-slate-50'}`}>
                                {item.icon}
                            </span>
                            <span className="w-full truncate text-[10px] font-black leading-tight">{item.label}</span>
                            <span className="w-full truncate text-[9px] font-bold leading-tight opacity-70">{item.note}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
