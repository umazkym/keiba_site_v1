import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import { DataHubActionLink } from '@/components/DataHubActionLink';
import { DataHubNav } from '@/components/DataHubNav';
import { DataPageHead } from '@/components/DataPageHead';
import { LineIcon } from '@/components/LineIcon';
import { DataSearchPanel } from '@/components/DataSearchPanel';
import { SectionHeader } from '@/components/SectionHeader';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { buildDatasetSchema } from '@/lib/dataset-schema';
import {
    CENTRAL_VENUE_ORDER,
    LOCAL_VENUE_ORDER,
} from '@/lib/data-directory';
import { venueSlugToName } from '@/lib/race-url';


export const revalidate = 21600;

const datasetDescription = '中央・地方競馬の競走馬、騎手、調教師、競馬場・コースの成績を、出走数や集計期間とともに同じ条件で比較できる、UMA-FREEの無料競馬データセットです。';

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
        <div className="grid grid-cols-[72px_1fr] items-start gap-2 border-b border-slate-200 py-2.5 last:border-b-0 sm:grid-cols-[88px_1fr]">
            <h3 className="pt-2 text-[13px] font-bold text-slate-700 sm:text-[14px]">{title}</h3>
            <div className="flex flex-wrap gap-1.5">
                {slugs.map((slug) => {
                    const name = venueSlugToName(slug);
                    if (!name) return null;
                    return (
                        <Link
                            prefetch={false}
                            key={slug}
                            href={`/courses#venue-${slug}`}
                            className="inline-flex min-h-9 items-center rounded-[8px] bg-white px-2.5 text-[13.5px] font-bold text-slate-800 ring-1 ring-inset ring-slate-200 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-[14px]"
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
        mainEntity: buildDatasetSchema({
            name: 'UMA-FREE 競馬条件別成績',
            description: datasetDescription,
            url: 'https://uma-free.com/keiba-data',
            measurementTechnique: 'レース結果の条件別集計',
        }),
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
            <main id="top" className="site-shell-data px-3.5 pb-14 pt-3 sm:px-5">
                <DataHubNav currentPath="/keiba-data" />

                <DataPageHead
                    icon="database"
                    title="競走馬・騎手・コースを同じ条件で比較"
                    description="勝率・3着以内率を出走数と一緒に確認できます。"
                />

                <section id="data-search" className="mt-3 scroll-mt-24">
                    <DataSearchPanel heading="馬名・騎手名・調教師名・コース条件から検索" />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
                        <span className="flex items-center gap-1 text-[12.5px] font-bold text-slate-500">
                            <LineIcon name="search" size={14} className="block" />
                            検索例
                        </span>
                        {popularSearchTags.map((tag) => (
                            <Link
                                prefetch={false}
                                key={tag.label}
                                href={`/search?q=${encodeURIComponent(tag.query)}`}
                                className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-[13px] font-bold text-slate-700 ring-1 ring-inset ring-slate-200 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300"
                            >
                                {tag.label}
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="mt-3.5 sm:mt-4" aria-labelledby="data-actions-heading">
                    <SectionHeader id="data-actions-heading" title="目的から選ぶ" compact />
                    {/* 3つの行を1枚の白いまとまりに線で区切って並べる（色つきの札と説明文はやめた。2026-09-26） */}
                    <div className="mt-1.5 grid divide-y divide-slate-200 overflow-hidden rounded-[14px] border border-slate-200 bg-white lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                        <DataHubActionLink
                            action="today_compare"
                            href="/races/today"
                            title="今日の出走馬を比較"
                        />
                        <DataHubActionLink
                            action="name_search"
                            href="#data-search"
                            title="馬名・騎手名から検索"
                        />
                        <DataHubActionLink
                            action="course_lookup"
                            href="#course-search"
                            title="競馬場・距離からコース傾向"
                        />
                    </div>
                </section>

                <section id="course-search" className="mt-4 sm:mt-5 scroll-mt-24" aria-labelledby="course-search-heading">
                    <SectionHeader
                        id="course-search-heading"
                        title="競馬場からコースを探す"
                        action={(<Link
                            prefetch={false}
                            href="/courses"
                            className="inline-flex min-h-8 items-center gap-1 text-[14px] font-bold text-brand-700 transition-colors duration-150 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                            コース一覧
                            <LineIcon name="chevR" size={16} className="block" />
                        </Link>)}
                    />
                    <div className="mt-3 rounded-[14px] bg-white px-3 py-1 ring-1 ring-inset ring-slate-200 sm:px-4">
                        <VenueLinks title="中央競馬" slugs={CENTRAL_VENUE_ORDER} />
                        <VenueLinks title="地方競馬" slugs={LOCAL_VENUE_ORDER} />
                    </div>
                    {/* 見出しの下の案内文と、芝・ダート・障害の凡例はやめた（2026-09-26） */}
                </section>
            </main>
        </>
    );
}
