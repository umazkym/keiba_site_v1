import type { Metadata } from 'next';
import Link from 'next/link';
import {
    Bookmark,
    CalendarDays,
    ChevronRight,
    GitCompareArrows,
} from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { DataDirectoryNav } from '@/components/DataDirectoryNav';
import { DataSearchPanel } from '@/components/DataSearchPanel';
import { BreadcrumbSchema } from '@/components/StructuredData';
import {
    CENTRAL_VENUE_ORDER,
    LOCAL_VENUE_ORDER,
} from '@/lib/data-directory';
import { venueSlugToName } from '@/lib/race-url';


export const revalidate = 21600;

export const metadata: Metadata = {
    title: '競馬データベース｜競走馬・騎手・調教師・コース成績',
    description: '競走馬、騎手、調教師、競馬場・コース、AI予測成績を名前や条件から無料で検索・比較できます。',
    robots: { index: true, follow: true },
    alternates: { canonical: '/keiba-data' },
};

const relatedTools = [
    {
        href: '/compare',
        label: '競走馬を比較',
        description: '2〜5頭の近走と得意条件を横並びで比較',
        icon: GitCompareArrows,
        accent: 'bg-amber-100 text-amber-700',
    },
    {
        href: '/my-data',
        label: 'マイデータ',
        description: '保存した馬・人・コースと閲覧履歴を確認',
        icon: Bookmark,
        accent: 'bg-emerald-100 text-emerald-700',
    },
    {
        href: '/races/today',
        label: '本日のレース',
        description: '出走馬のAI偏差値と4つの分析を確認',
        icon: CalendarDays,
        accent: 'bg-violet-100 text-violet-700',
    },
];

function VenueLinks({
    title,
    slugs,
}: {
    title: string;
    slugs: readonly string[];
}) {
    return (
        <div className="grid grid-cols-[72px_1fr] items-start gap-2 border-b border-slate-100 py-2.5 last:border-b-0 sm:grid-cols-[88px_1fr]">
            <h3 className="pt-2 text-xs font-black text-slate-600 sm:text-sm">{title}</h3>
            <div className="flex flex-wrap gap-1.5">
                {slugs.map((slug) => {
                    const name = venueSlugToName(slug);
                    if (!name) return null;
                    return (
                        <Link
                            key={slug}
                            href={`/courses#venue-${slug}`}
                            className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-2.5 text-sm font-bold text-slate-800 transition-all duration-150 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                            {name}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default function KeibaDataPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'UMA-FREE競馬データベース',
        description: metadata.description,
        url: 'https://uma-free.com/keiba-data',
        mainEntity: {
            '@type': 'Dataset',
            name: 'UMA-FREE 競馬条件別成績',
            measurementTechnique: 'レース結果の条件別集計',
        },
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: '競馬データベース', url: 'https://uma-free.com/keiba-data' },
                ]}
            />
            <Breadcrumb />
            <main id="top" className="mx-auto max-w-6xl px-3 pb-14 pt-3 sm:px-4">
                <DataDirectoryNav />

                <header className="mt-5 border-b border-slate-200 pb-5">
                    <p className="text-xs font-bold text-slate-500">競馬データベース</p>
                    <h1 className="mt-1 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                        競馬データベース
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                        競走馬・騎手・調教師は名前から、コースは競馬場・芝／ダート・距離から探せます。
                    </p>
                </header>

                <div className="mt-5">
                    <DataSearchPanel heading="競走馬・騎手・調教師・コースを横断検索" />
                </div>

                <section className="mt-7" aria-labelledby="course-search-heading">
                    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-300 pb-2">
                        <div>
                            <h2 id="course-search-heading" className="text-xl font-black text-slate-950">
                                競馬場からコースを探す
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                競馬場を選ぶと、芝・ダート・障害ごとの距離一覧へ移動します。
                            </p>
                        </div>
                        <Link
                            href="/courses"
                            className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            コース一覧
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4">
                        <VenueLinks title="中央競馬" slugs={CENTRAL_VENUE_ORDER} />
                        <VenueLinks title="地方競馬" slugs={LOCAL_VENUE_ORDER} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm bg-emerald-600" aria-hidden="true" />
                            芝
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm bg-amber-700" aria-hidden="true" />
                            ダート
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm bg-violet-700" aria-hidden="true" />
                            障害
                        </span>
                    </div>
                </section>

                <section className="mt-7" aria-labelledby="related-tools-heading">
                    <h2 id="related-tools-heading" className="border-b border-slate-300 pb-2 text-xl font-black text-slate-950">
                        関連機能
                    </h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {relatedTools.map((tool) => {
                            const Icon = tool.icon;
                            return (
                                <Link
                                    key={tool.href}
                                    href={tool.href}
                                    prefetch={tool.href === '/compare' ? false : undefined}
                                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all duration-150 hover:border-blue-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tool.accent}`}>
                                            <Icon className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                    </div>
                                    <div className="mt-3">
                                        <span className="block font-black text-slate-950">{tool.label}</span>
                                        <span className="mt-1 block text-xs leading-5 text-slate-500">{tool.description}</span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            </main>
        </>
    );
}
