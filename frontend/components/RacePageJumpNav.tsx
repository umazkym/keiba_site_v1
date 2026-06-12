'use client';

import type { ReactNode } from 'react';
import { ChartBarIcon, FlagIcon, SparklesIcon, UsersIcon } from './Icons';
import { useRaceSectionNavigation, type RaceSectionNavItem } from '@/hooks/useRaceSectionNavigation';

type JumpItem = RaceSectionNavItem & {
    label: string;
    note: string;
    icon: ReactNode;
    accentClass: string;
    preview: ReactNode;
};

type RacePageJumpNavProps = {
    className?: string;
};

const items: JumpItem[] = [
    {
        key: 'prediction',
        label: '予想表',
        note: 'AI評価',
        targetIds: ['race-prediction-heading', 'race-prediction-section'],
        icon: <SparklesIcon className="h-3.5 w-3.5" />,
        accentClass: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        preview: (
            <div className="space-y-1">
                <span className="block h-1.5 w-[88%] rounded-full bg-blue-500" />
                <span className="block h-1.5 w-[64%] rounded-full bg-amber-400" />
                <span className="block h-1.5 w-[72%] rounded-full bg-slate-300" />
            </div>
        ),
    },
    {
        key: 'detail',
        label: '展開材料',
        note: '脚質・枠順',
        targetIds: ['race-detail-heading', 'race-detail-data-section'],
        icon: <FlagIcon className="h-3.5 w-3.5" />,
        accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        preview: (
            <div className="flex h-7 items-end gap-1">
                {[54, 76, 38, 64].map((height, index) => (
                    <span key={index} className="flex-1 rounded-t bg-emerald-500/80" style={{ height: `${height}%` }} />
                ))}
            </div>
        ),
    },
    {
        key: 'guide',
        label: 'データ解説',
        note: '見方を確認',
        targetIds: ['race-analysis-heading', 'race-data-guide-section', 'race-analysis-section', 'race-detail-data-section'],
        icon: <ChartBarIcon className="h-3.5 w-3.5" />,
        accentClass: 'bg-amber-50 text-amber-700 border-amber-100',
        preview: (
            <div className="grid grid-cols-3 gap-1 text-center text-[9px] font-bold">
                <span className="rounded bg-emerald-50 py-0.5 text-emerald-700">+2</span>
                <span className="rounded bg-white py-0.5 text-slate-500">0</span>
                <span className="rounded bg-rose-50 py-0.5 text-rose-700">-1</span>
                <span className="rounded bg-white py-0.5 text-slate-500">0</span>
                <span className="rounded bg-emerald-50 py-0.5 text-emerald-700">+1</span>
                <span className="rounded bg-white py-0.5 text-slate-500">0</span>
            </div>
        ),
    },
    {
        key: 'articles',
        label: '関連記事',
        note: '復習・深掘り',
        targetIds: ['race-related-articles-section', 'race-page-articles-section'],
        icon: <UsersIcon className="h-3.5 w-3.5" />,
        accentClass: 'bg-blue-50 text-blue-700 border-blue-100',
        preview: (
            <div className="space-y-1">
                <span className="block h-1.5 w-full rounded-full bg-slate-300" />
                <span className="block h-1.5 w-[76%] rounded-full bg-slate-200" />
                <span className="block h-1.5 w-[52%] rounded-full bg-blue-300" />
            </div>
        ),
    },
];

export function RacePageJumpNav({ className = '' }: RacePageJumpNavProps) {
    const { activeKey, scrollToItem } = useRaceSectionNavigation(items);

    return (
        <section className={`card hidden overflow-hidden border-slate-200 bg-white shadow-sm md:block ${className}`}>
            <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2 sm:px-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-slate-900">目次</h2>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-4 sm:p-3">
                {items.map((item) => {
                    const isActive = activeKey === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => scrollToItem(item)}
                            className={`group min-w-0 rounded-xl border p-2 text-left shadow-sm ring-1 transition-all hover:border-primary/40 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/25 active:scale-[0.99] ${
                                isActive
                                    ? 'border-primary/40 bg-primary/5 ring-primary/15'
                                    : 'border-slate-200 bg-white ring-slate-100'
                            }`}
                        >
                            <div className="mb-1.5 flex items-center gap-2">
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${item.accentClass}`}>
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[12px] font-bold leading-tight text-slate-900 sm:text-[13px]">{item.label}</p>
                                    <p className="truncate text-[10px] font-medium text-slate-500">{item.note}</p>
                                </div>
                                <span className={`text-sm font-bold transition-colors ${isActive ? 'text-primary' : 'text-slate-300 group-hover:text-primary'}`}>→</span>
                            </div>
                            <div className={`rounded-lg p-1.5 ${isActive ? 'bg-white' : 'bg-slate-50'}`}>
                                {item.preview}
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
