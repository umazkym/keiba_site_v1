import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DataDirectoryNav } from '@/components/DataDirectoryNav';
import {
    getVenueSortIndex,
    isCentralVenue,
    normalizeCourseItem,
    type CourseSurface,
    type NormalizedCourseItem,
} from '@/lib/data-directory';
import type { DataEntityDirectory } from '@/lib/types';


const SURFACE_ORDER: CourseSurface[] = ['turf', 'dirt', 'obstacle', 'other'];

const SURFACE_STYLES: Record<CourseSurface, {
    label: string;
    marker: string;
    link: string;
}> = {
    turf: {
        label: '芝',
        marker: 'bg-emerald-600',
        link: 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-100',
    },
    dirt: {
        label: 'ダート',
        marker: 'bg-amber-700',
        link: 'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400 hover:bg-amber-100',
    },
    obstacle: {
        label: '障害',
        marker: 'bg-violet-700',
        link: 'border-violet-200 bg-violet-50 text-violet-950 hover:border-violet-400 hover:bg-violet-100',
    },
    other: {
        label: 'その他',
        marker: 'bg-slate-600',
        link: 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-slate-100',
    },
};

interface VenueCourseGroup {
    venueName: string;
    venueSlug: string;
    isCentral: boolean;
    itemsBySurface: Map<CourseSurface, NormalizedCourseItem[]>;
}

function buildVenueGroups(directory: DataEntityDirectory): VenueCourseGroup[] {
    const venueMap = new Map<string, VenueCourseGroup>();
    directory.items.map(normalizeCourseItem).forEach((item) => {
        const existing = venueMap.get(item.venueSlug);
        const group = existing ?? {
            venueName: item.venueName,
            venueSlug: item.venueSlug,
            isCentral: isCentralVenue(item.venueSlug),
            itemsBySurface: new Map<CourseSurface, NormalizedCourseItem[]>(),
        };
        const surfaceItems = group.itemsBySurface.get(item.surface) ?? [];
        if (!surfaceItems.some((course) => course.url === item.url)) {
            surfaceItems.push(item);
        }
        group.itemsBySurface.set(item.surface, surfaceItems);
        venueMap.set(item.venueSlug, group);
    });

    return Array.from(venueMap.values())
        .map((group) => {
            group.itemsBySurface.forEach((items) => {
                items.sort((a, b) => (
                    (a.distance ?? Number.MAX_SAFE_INTEGER)
                    - (b.distance ?? Number.MAX_SAFE_INTEGER)
                ));
            });
            return group;
        })
        .sort((a, b) => (
            getVenueSortIndex(a.venueSlug) - getVenueSortIndex(b.venueSlug)
            || a.venueName.localeCompare(b.venueName, 'ja')
        ));
}

function VenueJumpLinks({
    title,
    groups,
}: {
    title: string;
    groups: VenueCourseGroup[];
}) {
    if (groups.length === 0) return null;
    return (
        <div className="grid grid-cols-[72px_1fr] items-start gap-2 border-b border-slate-100 py-2.5 last:border-b-0 sm:grid-cols-[88px_1fr]">
            <h2 className="pt-2 text-xs font-black text-slate-600 sm:text-sm">{title}</h2>
            <div className="flex flex-wrap gap-1.5">
                {groups.map((group) => (
                    <a
                        key={group.venueSlug}
                        href={`#venue-${group.venueSlug}`}
                        className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        {group.venueName}
                    </a>
                ))}
            </div>
        </div>
    );
}

function VenueCourseSection({ group }: { group: VenueCourseGroup }) {
    return (
        <section
            id={`venue-${group.venueSlug}`}
            aria-labelledby={`venue-${group.venueSlug}-heading`}
            className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-4 py-2.5 text-white">
                <h3 id={`venue-${group.venueSlug}-heading`} className="text-base font-black text-white">
                    {group.venueName}競馬場
                </h3>
                <span className="text-xs font-bold text-slate-300">
                    {group.isCentral ? '中央' : '地方'}
                </span>
            </div>
            <div className="divide-y divide-slate-100">
                {SURFACE_ORDER.map((surface) => {
                    const items = group.itemsBySurface.get(surface) ?? [];
                    if (items.length === 0) return null;
                    const style = SURFACE_STYLES[surface];
                    return (
                        <div
                            key={surface}
                            className="grid grid-cols-[76px_1fr] gap-2 px-3 py-3 sm:grid-cols-[96px_1fr] sm:px-4"
                        >
                            <div className="flex min-h-11 items-center gap-2 self-start">
                                <span className={`h-3 w-3 shrink-0 rounded-sm ${style.marker}`} aria-hidden="true" />
                                <h4 className="text-sm font-black text-slate-800">{style.label}</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                                {items.map((course) => (
                                    <Link
                                        key={course.url}
                                        href={course.url}
                                        prefetch={false}
                                        className={`group flex min-h-11 items-center justify-between rounded-md border px-2.5 text-sm font-black transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${style.link}`}
                                    >
                                        <span className="font-mono tabular-nums">
                                            {course.distance == null ? course.name : `${course.distance}m`}
                                        </span>
                                        <ChevronRight
                                            className="h-3.5 w-3.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100"
                                            aria-hidden="true"
                                        />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export function CourseDirectoryView({ directory }: { directory: DataEntityDirectory }) {
    const groups = buildVenueGroups(directory);
    const centralGroups = groups.filter((group) => group.isCentral);
    const localGroups = groups.filter((group) => !group.isCentral);

    return (
        <main id="top" className="mx-auto max-w-6xl px-3 pb-14 pt-3 sm:px-4">
            <DataDirectoryNav current="course" />

            <header className="mt-5 border-b border-slate-200 pb-5">
                <p className="text-xs font-bold text-slate-500">競馬データベース</p>
                <h1 className="mt-1 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                    競馬場・コースデータ
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                    競馬場を選び、芝・ダート・障害ごとに距離を確認できます。
                    各距離から枠番、馬番、脚質、騎手、調教師の条件別成績へ進めます。
                </p>
            </header>

            {groups.length === 0 ? (
                <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="font-black text-slate-900">コースデータを取得できませんでした</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                        時間を置いて再度お試しください。レース検索はサイト内検索から利用できます。
                    </p>
                </section>
            ) : (
                <>
                    <nav aria-label="競馬場へ移動" className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4">
                        <VenueJumpLinks title="中央競馬" groups={centralGroups} />
                        <VenueJumpLinks title="地方競馬" groups={localGroups} />
                    </nav>

                    {centralGroups.length > 0 && (
                        <div className="mt-5">
                            <h2 className="mb-3 border-b border-slate-300 pb-2 text-xl font-black text-slate-950">
                                中央競馬
                            </h2>
                            <div className="space-y-4">
                                {centralGroups.map((group) => (
                                    <VenueCourseSection key={group.venueSlug} group={group} />
                                ))}
                            </div>
                        </div>
                    )}

                    {localGroups.length > 0 && (
                        <div className="mt-8">
                            <div className="mb-3 flex items-end justify-between border-b border-slate-300 pb-2">
                                <h2 className="text-xl font-black text-slate-950">地方競馬</h2>
                                <a
                                    href="#top"
                                    className="text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    競馬場一覧へ戻る
                                </a>
                            </div>
                            <div className="space-y-4">
                                {localGroups.map((group) => (
                                    <VenueCourseSection key={group.venueSlug} group={group} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </main>
    );
}
