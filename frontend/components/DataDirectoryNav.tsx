import Link from 'next/link';
import {
    CircleDot,
    MapPinned,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { DATA_DIRECTORY_LINKS } from '@/lib/data-directory';
import type { DataEntityType } from '@/lib/types';
import { DataHubNav } from '@/components/DataHubNav';


const ICONS = {
    horse: CircleDot,
    jockey: UserRound,
    trainer: UsersRound,
    course: MapPinned,
} as const;

const TAB_COLORS: Record<string, { active: string; icon: string }> = {
    horse: {
        active: 'border-b-2 border-emerald-600 bg-emerald-50/70 text-emerald-900 font-black',
        icon: 'text-emerald-600',
    },
    jockey: {
        active: 'border-b-2 border-blue-600 bg-blue-50/70 text-blue-900 font-black',
        icon: 'text-blue-600',
    },
    trainer: {
        active: 'border-b-2 border-violet-600 bg-violet-50/70 text-violet-900 font-black',
        icon: 'text-violet-600',
    },
    course: {
        active: 'border-b-2 border-amber-600 bg-amber-50/70 text-amber-900 font-black',
        icon: 'text-amber-700',
    },
} as const;

export function DataDirectoryNav({
    current,
    showHubNav = true,
}: {
    current?: Exclude<DataEntityType, 'grade'>;
    showHubNav?: boolean;
}) {
    return (
        <div className="flex flex-col gap-3">
            {showHubNav && <DataHubNav />}
            <nav aria-label="データ検索カテゴリ" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="grid grid-cols-4 divide-x divide-slate-200">
                    {DATA_DIRECTORY_LINKS.map((item) => {
                        const Icon = ICONS[item.entityType];
                        const isCurrent = item.entityType === current;
                        const colors = TAB_COLORS[item.entityType];
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isCurrent ? 'page' : undefined}
                                className={`flex min-h-12 flex-col items-center justify-center gap-1 px-1.5 py-2 text-[11px] font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:flex-row sm:gap-2 sm:text-xs md:text-sm ${
                                    isCurrent
                                        ? colors.active
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                            >
                                <Icon
                                    className={`h-4 w-4 sm:h-4.5 sm:w-4.5 ${isCurrent ? colors.icon : 'text-slate-400'}`}
                                    aria-hidden="true"
                                />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}

