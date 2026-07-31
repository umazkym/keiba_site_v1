import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { DataHubActionLink } from '@/components/DataHubActionLink';
import { DataHubNav } from '@/components/DataHubNav';
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
    description: '競走馬、騎手、調教師、競馬場・コースの成績を、出走数を伴う同じ条件で無料比較できます。',
    robots: { index: true, follow: true },
    alternates: { canonical: '/keiba-data' },
};

const popularSearchTags = [
    { label: 'C.ルメール', query: 'ルメール' },
    { label: '川田将雅', query: '川田' },
    { label: '武豊', query: '武豊' },
    { label: '東京 芝1600m', query: '東京 芝1600m' },
    { label: '中山 芝2000m', query: '中山 芝2000m' },
    { label: '阪神 ダート1800m', query: '阪神 ダート1800m' },
];

function VenueLinks({
    title,
    slugs,
}: {
    title: string;
    slugs: readonly string[];
}) {
    return (
        <div className="grid grid-cols-[72px_1fr] items-start gap-2 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[88px_1fr]">
            <h3 className="pt-1.5 text-xs font-black text-slate-700 sm:text-sm">{title}</h3>
            <div className="flex flex-wrap gap-1.5">
                {slugs.map((slug) => {
                    const name = venueSlugToName(slug);
                    if (!name) return null;
                    return (
                        <Link
                            key={slug}
                            href={`/courses#venue-${slug}`}
                            className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 transition-colors duration-150 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-sm"
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
                <DataHubNav currentPath="/keiba-data" />

                <header className="mt-4 min-h-[136px] rounded-xl border border-slate-800 bg-slate-900 p-4 text-white sm:min-h-0 sm:p-6">
                    <p className="text-xs font-bold text-blue-200">競馬データベース</p>
                    <h1 className="mt-1.5 text-2xl font-black leading-tight !text-white sm:text-3xl">
                        競走馬・騎手・コースを同じ条件で比較
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 !text-slate-200">
                        勝率・3着以内率を出走数と一緒に確認できます。
                    </p>
                </header>

                <section id="data-search" className="mt-4 scroll-mt-24">
                    <DataSearchPanel heading="馬名・騎手名・調教師名・コース条件から検索" />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                            <Search className="h-3.5 w-3.5" aria-hidden="true" />
                            検索例
                        </span>
                        {popularSearchTags.map((tag) => (
                            <Link
                                key={tag.label}
                                href={`/search?q=${encodeURIComponent(tag.query)}`}
                                className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            >
                                {tag.label}
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="mt-5" aria-labelledby="data-actions-heading">
                    <h2 id="data-actions-heading" className="text-lg font-black text-slate-950">
                        目的から選ぶ
                    </h2>
                    <div className="mt-2 grid gap-2 lg:grid-cols-3">
                        <DataHubActionLink
                            action="today_compare"
                            href="/races/today"
                            title="今日の出走馬を比較"
                            description="本日開催のレースを確認"
                        />
                        <DataHubActionLink
                            action="name_search"
                            href="#data-search"
                            title="馬名・騎手名から検索"
                            description="名前の一部から個別成績と直近の結果を確認"
                        />
                        <DataHubActionLink
                            action="course_lookup"
                            href="#course-search"
                            title="競馬場・距離からコース傾向"
                            description="コースや距離を分けて条件別の成績を確認"
                        />
                    </div>
                </section>

                <section id="course-search" className="mt-7 scroll-mt-24" aria-labelledby="course-search-heading">
                    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-300 pb-2">
                        <div>
                            <h2 id="course-search-heading" className="text-xl font-black text-slate-950">
                                競馬場からコースを探す
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                競馬場を選ぶと、コースごとの距離一覧へ移動します。
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
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 sm:px-4">
                        <VenueLinks title="中央競馬" slugs={CENTRAL_VENUE_ORDER} />
                        <VenueLinks title="地方競馬" slugs={LOCAL_VENUE_ORDER} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-xs font-bold text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-xs bg-emerald-600" aria-hidden="true" />
                            芝コース
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-xs bg-amber-700" aria-hidden="true" />
                            ダートコース
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-xs bg-violet-700" aria-hidden="true" />
                            障害コース
                        </span>
                    </div>
                </section>
            </main>
        </>
    );
}
