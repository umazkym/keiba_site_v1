'use client';

// データトップの「目的から選ぶ」の1行。色つきの面と枠はやめ、紺のアイコンを大きくして、
// 白いまとまりの中に線で区切って並べる（まとまりはページ側で作る）。行の下の説明文もやめた（2026-09-26）。
import Link from 'next/link';
import { CalendarDays, ChevronRight, MapPinned, Search } from 'lucide-react';
import { sendDataHubActionClickEvent } from '@/lib/analytics';


type Action = 'today_compare' | 'name_search' | 'course_lookup';

const ACTIONS = {
    today_compare: {
        Icon: CalendarDays,
        destinationType: 'race' as const,
    },
    name_search: {
        Icon: Search,
        destinationType: 'search' as const,
    },
    course_lookup: {
        Icon: MapPinned,
        destinationType: 'course' as const,
    },
};

export function DataHubActionLink({
    action,
    href,
    title,
}: {
    action: Action;
    href: string;
    title: string;
}) {
    const config = ACTIONS[action];
    const Icon = config.Icon;
    return (
        <Link
            prefetch={false}
            href={href}
            onClick={() => {
                sendDataHubActionClickEvent({
                    action,
                    destination_type: config.destinationType,
                });
            }}
            className="flex min-h-12 items-center gap-3 px-3.5 py-2 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:min-h-14 sm:px-4"
        >
            <Icon className="h-6 w-6 shrink-0 text-navy" strokeWidth={1.75} aria-hidden="true" />
            <span className="min-w-0 flex-1 text-[14px] font-bold text-slate-900 sm:text-[15px]">{title}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        </Link>
    );
}
