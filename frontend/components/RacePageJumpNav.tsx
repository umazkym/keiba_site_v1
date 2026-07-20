'use client';

import type { ReactNode } from 'react';
import { ChartBarIcon, FlagIcon, SparklesIcon, UsersIcon } from './Icons';
import { useRaceSectionNavigation, type RaceSectionNavItem } from '@/hooks/useRaceSectionNavigation';

type JumpItem = RaceSectionNavItem & {
    label: string;
    note: string;
    icon: ReactNode;
};

type RacePageJumpNavProps = {
    className?: string;
};

const items: JumpItem[] = [
    {
        key: 'prediction',
        label: 'AI偏差値',
        note: '全頭比較',
        targetIds: ['race-prediction-heading', 'race-prediction-section'],
        icon: <SparklesIcon className="h-4 w-4" />,
    },
    {
        key: 'matchup',
        label: '対決成績',
        note: '直接比較',
        targetIds: ['race-matchup-heading', 'race-matchup-section'],
        icon: <UsersIcon className="h-4 w-4" />,
    },
    {
        key: 'start',
        label: '展開・脚質',
        note: '位置取り',
        targetIds: ['race-detail-heading', 'race-detail-data-section'],
        icon: <FlagIcon className="h-4 w-4" />,
    },
    {
        key: 'frame',
        label: '枠順傾向',
        note: 'コース別',
        targetIds: ['race-frame-heading'],
        icon: <ChartBarIcon className="h-4 w-4" />,
    },
    {
        key: 'analysis',
        label: 'AI展望',
        note: 'テキスト',
        targetIds: ['race-analysis-heading', 'race-analysis-section'],
        icon: <SparklesIcon className="h-4 w-4" />,
    },
];

export function RacePageJumpNav({ className = '' }: RacePageJumpNavProps) {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(items);

    return (
        <nav
            className={`hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block ${className}`}
            aria-label="レースデータの確認順"
        >
            <div className="grid grid-cols-5 divide-x divide-slate-200">
                {items.map((item) => {
                    const isActive = activeKey === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => scrollToItem(item)}
                            aria-current={isActive ? 'location' : undefined}
                            className={`flex min-h-[52px] min-w-0 items-center justify-center gap-2 px-2 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isActive
                                ? 'bg-slate-950 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                }`}
                        >
                            <span className="shrink-0" aria-hidden="true">{item.icon}</span>
                            <span className="min-w-0">
                                <span className="block truncate text-xs font-bold">{item.label}</span>
                                <span className={`block truncate text-[10px] font-semibold ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {item.note}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
