'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Bookmark,
    Database,
    GitCompareArrows,
    MapPinned,
    UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    MY_DATA_UPDATED_EVENT,
    readFavorites,
    readHorseComparison,
} from '@/lib/my-data';

// データの案内。2026-09-26：項目ごとの色と下線のタブをやめ、切り替えボタン（SegmentedControl）と同じ形の
// リンクの列にする（淡い面の中で、今いるページだけ白く浮く）。アイコンは文字と同じ色。
interface NavItem {
    href: string;
    label: string;
    icon: typeof Database;
    badgeKey?: 'favorites' | 'comparison';
}

const PRIMARY_ITEMS: NavItem[] = [
    { href: '/keiba-data', label: 'データトップ', icon: Database },
    { href: '/compare', label: '競走馬比較', icon: GitCompareArrows, badgeKey: 'comparison' },
    { href: '/my-data', label: 'マイデータ', icon: Bookmark, badgeKey: 'favorites' },
];

// 競走馬・調教師のページは提供を終了した（2026-09-26）
const DIRECTORY_ITEMS: NavItem[] = [
    { href: '/jockeys', label: '騎手', icon: UserRound },
    { href: '/courses', label: 'コース別', icon: MapPinned },
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

    const renderItems = (items: NavItem[], label: string) => (
        <div role="group" aria-label={label} className="flex rounded-[10px] bg-slate-100 p-0.5">
            {items.map((item) => {
                const Icon = item.icon;
                const isCurrent = activePath === item.href || (item.href !== '/keiba-data' && activePath.startsWith(item.href));
                const badgeCount = item.badgeKey ? counts[item.badgeKey] : 0;

                return (
                    <Link
                        prefetch={false}
                        key={item.href}
                        href={item.href}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={`inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-1 text-[12.5px] font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 sm:gap-1.5 sm:px-2 sm:text-[13px] ${
                            isCurrent
                                ? 'bg-white text-navy shadow-[0_1px_2px_rgba(20,26,61,0.16)]'
                                : 'text-slate-500 hover:text-navy'
                        }`}
                    >
                        {/* 360px未満では文字が入りきらないため、アイコンを出さない */}
                        <Icon className="hidden h-4 w-4 shrink-0 min-[360px]:block sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
                        <span>{item.label}</span>
                        {badgeCount > 0 && (
                            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ai px-1 font-num text-[11px] font-bold text-slate-950">
                                {badgeCount}
                            </span>
                        )}
                    </Link>
                );
            })}
        </div>
    );

    return (
        <nav aria-label="競馬データナビゲーション" className="flex flex-col gap-1.5">
            {renderItems(PRIMARY_ITEMS, '主な操作')}
            {renderItems(DIRECTORY_ITEMS, 'データ分類')}
        </nav>
    );
}
