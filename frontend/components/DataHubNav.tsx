'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Bookmark,
    CircleDot,
    Database,
    GitCompareArrows,
    MapPinned,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    MY_DATA_UPDATED_EVENT,
    readFavorites,
    readHorseComparison,
} from '@/lib/my-data';

interface NavItem {
    href: string;
    label: string;
    icon: typeof Database;
    badgeKey?: 'favorites' | 'comparison';
    color: string;
    activeColor: string;
}

const NAV_ITEMS: NavItem[] = [
    {
        href: '/keiba-data',
        label: 'データトップ',
        icon: Database,
        color: 'text-slate-500',
        activeColor: 'border-blue-600 bg-blue-50/80 text-blue-800 font-black',
    },
    {
        href: '/compare',
        label: '競走馬比較',
        icon: GitCompareArrows,
        badgeKey: 'comparison',
        color: 'text-amber-600',
        activeColor: 'border-amber-600 bg-amber-50/80 text-amber-900 font-black',
    },
    {
        href: '/my-data',
        label: 'マイデータ',
        icon: Bookmark,
        badgeKey: 'favorites',
        color: 'text-emerald-600',
        activeColor: 'border-emerald-600 bg-emerald-50/80 text-emerald-900 font-black',
    },
    {
        href: '/horses',
        label: '競走馬',
        icon: CircleDot,
        color: 'text-emerald-600',
        activeColor: 'border-emerald-600 bg-emerald-50/80 text-emerald-900 font-black',
    },
    {
        href: '/jockeys',
        label: '騎手',
        icon: UserRound,
        color: 'text-blue-600',
        activeColor: 'border-blue-600 bg-blue-50/80 text-blue-900 font-black',
    },
    {
        href: '/trainers',
        label: '調教師',
        icon: UsersRound,
        color: 'text-violet-600',
        activeColor: 'border-violet-600 bg-violet-50/80 text-violet-900 font-black',
    },
    {
        href: '/courses',
        label: 'コース別',
        icon: MapPinned,
        color: 'text-amber-700',
        activeColor: 'border-amber-600 bg-amber-50/80 text-amber-900 font-black',
    },
];

export function DataHubNav({ currentPath }: { currentPath?: string }) {
    const pathname = usePathname();
    const activePath = currentPath ?? pathname;
    const [counts, setCounts] = useState({ favorites: 0, comparison: 0 });

    useEffect(() => {
        const updateCounts = () => {
            const favs = readFavorites().length;
            const comps = readHorseComparison().length;
            setCounts({ favorites: favs, comparison: comps });
        };
        updateCounts();

        window.addEventListener(MY_DATA_UPDATED_EVENT, updateCounts);
        window.addEventListener('storage', updateCounts);
        return () => {
            window.removeEventListener(MY_DATA_UPDATED_EVENT, updateCounts);
            window.removeEventListener('storage', updateCounts);
        };
    }, []);

    return (
        <nav aria-label="競馬データナビゲーション" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex overflow-x-auto scrollbar-none divide-x divide-slate-100 sm:grid sm:grid-cols-7">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isCurrent = activePath === item.href || (item.href !== '/keiba-data' && activePath.startsWith(item.href));
                    const badgeCount = item.badgeKey ? counts[item.badgeKey] : 0;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isCurrent ? 'page' : undefined}
                            className={`group relative flex min-w-[76px] flex-1 flex-col items-center justify-center px-1.5 py-2.5 text-[11px] transition-all duration-150 sm:min-h-12 sm:flex-row sm:gap-1.5 sm:px-2 sm:text-xs ${
                                isCurrent
                                    ? `border-b-2 ${item.activeColor}`
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <span className="relative flex items-center justify-center">
                                <Icon
                                    className={`h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                                        isCurrent ? 'scale-105' : item.color
                                    }`}
                                    aria-hidden="true"
                                />
                                {badgeCount > 0 && (
                                    <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[9px] font-black text-white shadow-xs">
                                        {badgeCount}
                                    </span>
                                )}
                            </span>
                            <span className="mt-1 font-black whitespace-nowrap sm:mt-0">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

