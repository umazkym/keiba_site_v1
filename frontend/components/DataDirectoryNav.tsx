import Link from 'next/link';
import {
    CircleDot,
    MapPinned,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { DATA_DIRECTORY_LINKS } from '@/lib/data-directory';
import type { DataEntityType } from '@/lib/types';


const ICONS = {
    horse: CircleDot,
    jockey: UserRound,
    trainer: UsersRound,
    course: MapPinned,
} as const;

export function DataDirectoryNav({
    current,
}: {
    current?: Exclude<DataEntityType, 'grade'>;
}) {
    return (
        <nav aria-label="データカテゴリ" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-4 divide-x divide-slate-200">
                {DATA_DIRECTORY_LINKS.map((item) => {
                    const Icon = ICONS[item.entityType];
                    const isCurrent = item.entityType === current;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isCurrent ? 'page' : undefined}
                            className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1.5 py-2 text-xs font-black transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:min-h-12 sm:flex-row sm:gap-2 sm:text-sm ${
                                isCurrent
                                    ? 'bg-blue-50 text-primary'
                                    : 'text-slate-700 hover:bg-slate-50 hover:text-primary'
                            }`}
                        >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
