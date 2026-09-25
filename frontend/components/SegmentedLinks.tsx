// 切り替えボタン（SegmentedControl）と同じ形のリンクの列。ページを切り替える選択肢（期間など）に使う。
// サーバーのページでも使えるように、状態は持たず、今のページだけ白く浮かせる（2026-09-26）。
import Link from 'next/link';
import type { ReactNode } from 'react';

export type SegmentedLinkItem = {
    href: string;
    label: ReactNode;
    current: boolean;
};

export function SegmentedLinks({
    items,
    ariaLabel,
    full = false,
    className = '',
}: {
    items: SegmentedLinkItem[];
    ariaLabel: string;
    // full：親の幅いっぱいに均等に並べる
    full?: boolean;
    className?: string;
}) {
    return (
        <nav aria-label={ariaLabel} className={`${full ? 'flex w-full' : 'inline-flex'} rounded-[10px] bg-slate-100 p-0.5 ${className}`}>
            {items.map((item) => (
                <Link
                    key={item.href}
                    prefetch={false}
                    href={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    className={`inline-flex h-7 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] text-[12.5px] font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${full ? 'flex-1 px-1.5' : 'px-3'} ${item.current ? 'bg-white text-navy shadow-[0_1px_2px_rgba(20,26,61,0.16)]' : 'text-slate-500 hover:text-navy'}`}
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
