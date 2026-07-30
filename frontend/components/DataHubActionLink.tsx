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
            className={`grid min-h-16 grid-cols-[32px_1fr_20px] items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors duration-150 hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${config.accent}`}
        >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="min-w-0">
                <span className="block text-sm font-black">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">{description}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
        </Link>
    );
}
