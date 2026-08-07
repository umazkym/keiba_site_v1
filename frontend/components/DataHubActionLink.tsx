'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, MapPinned, Search } from 'lucide-react';
import { sendDataHubActionClickEvent } from '@/lib/analytics';


type Action = 'today_compare' | 'name_search' | 'course_lookup';

const ACTIONS = {
    today_compare: {
        Icon: CalendarDays,
        destinationType: 'race' as const,
        accent: 'border-blue-300 bg-blue-50 text-blue-900',
    },
    name_search: {
        Icon: Search,
        destinationType: 'search' as const,
        accent: 'border-slate-300 bg-white text-slate-900',
    },
    course_lookup: {
        Icon: MapPinned,
        destinationType: 'course' as const,
        accent: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    },
};

export function DataHubActionLink({
    action,
    href,
    title,
    description,
}: {
    action: Action;
    href: string;
    title: string;
    description: string;
}) {
    const config = ACTIONS[action];
    const Icon = config.Icon;
    return (
        <Link
            href={href}
            onClick={() => {
                sendDataHubActionClickEvent({
                    action,
                    destination_type: config.destinationType,
                });
            }}
            className={`grid min-h-11 grid-cols-[28px_1fr_16px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors duration-150 sm:min-h-14 sm:grid-cols-[32px_1fr_20px] sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2.5 hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${config.accent}`}
        >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            <span className="min-w-0">
                <span className="block text-xs font-black sm:text-sm">{title}</span>
                <span className="mt-0.5 block truncate text-[11px] leading-tight text-slate-600 sm:text-xs sm:leading-5">{description}</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 sm:h-4 sm:w-4" aria-hidden="true" />
        </Link>
    );
}
