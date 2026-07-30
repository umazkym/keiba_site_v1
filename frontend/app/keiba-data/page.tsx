import type { Metadata } from 'next';
import Link from 'next/link';
import {
    Bookmark,
    CalendarDays,
    ChevronRight,
    Compass,
    GitCompareArrows,
    Search,
    Sparkles,
} from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
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
    description: '競走馬、騎手、調教師、競馬場・コース、AI予測成績を名前や条件から無料で検索・比較できます。',
    robots: { index: true, follow: true },
    alternates: { canonical: '/keiba-data' },
};

const popularSearchTags = [
    { label: 'C.ルメール', query: 'ルメール' },
    { label: '川田将雅', query: '川田' },
    { label: '武豊', query: '武豊' },
    { label: '東京 芝2000m', query: '東京 芝2000m' },
    { label: '中山 芝2000m', query: '中山 芝2000m' },
    { label: '阪神 ダ1800m', query: '阪神 ダ1800m' },
];

const featureCards = [
    {
        href: '/compare',
        title: '競走馬の成績比較',
        description: '2〜5頭の近走成績、勝率、3着内率、得意コース、AI偏差値履歴を同じ基準でスッキリ比較。',
        icon: GitCompareArrows,
        accentBg: 'bg-amber-50/70 border-amber-200 text-amber-950 hover:border-amber-400',
        iconBg: 'bg-amber-500 text-white',
    },
    {
        href: '/my-data',
        title: 'マイデータで保存・出走チェック',
        description: '気になる馬・騎手・コースをお気に入り保存。本日出走する馬のアラート機能も搭載。',
        icon: Bookmark,
        accentBg: 'bg-emerald-50/70 border-emerald-200 text-emerald-950 hover:border-emerald-400',
        iconBg: 'bg-emerald-600 text-white',
    },
    {
        href: '/races/today',
        title: '本日の開催レースと照合',
        description: '本日開催されるレース出走馬のAI偏差値、対戦成績、展開脚質、枠順有利不利を確認。',
        icon: CalendarDays,
        accentBg: 'bg-violet-50/70 border-violet-200 text-violet-950 hover:border-violet-400',
        iconBg: 'bg-violet-600 text-white',
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
                            className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs sm:text-sm font-bold text-slate-800 transition-all duration-150 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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

                {/* ヒーローヘッダー */}
                <header className="relative mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 p-5 text-white shadow-md sm:p-7">
                    <div className="relative z-10 max-w-3xl">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-black text-blue-300 backdrop-blur-xs border border-blue-400/30">
                            <Sparkles className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                            競馬データ・分析ハブ
                        </span>
                        <h1 className="mt-3 text-2xl font-black leading-snug tracking-tight sm:text-4xl">
                            競馬データを自由自在に比較・分析
                        </h1>
                        <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm sm:leading-6">
                            競走馬・騎手・調教師の過去成績から、コース別（芝・ダート・距離）の枠順・脚質傾向まで。気になる馬を2〜5頭選んで成績比較したり、マイデータでお気に入り管理できます。
                        </p>
                    </div>
                </header>

                {/* 検索パネル + クイックタグ */}
                <div className="mt-6">
                    <DataSearchPanel heading="競走馬・騎手・調教師・コースを横断検索" />
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                            <Search className="h-3.5 w-3.5" aria-hidden="true" />
                            よく検索される条件:
                        </span>
                        {popularSearchTags.map((tag) => (
                            <Link
                                key={tag.label}
                                href={`/search?q=${encodeURIComponent(tag.query)}`}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            >
                                {tag.label}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* 主要機能カード */}
                <section className="mt-8" aria-labelledby="core-features-heading">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <Compass className="h-5 w-5 text-blue-600" aria-hidden="true" />
                        <h2 id="core-features-heading" className="text-xl font-black text-slate-950">
                            分析・比較機能
                        </h2>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        {featureCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <Link
                                    key={card.href}
                                    href={card.href}
                                    className={`group flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-200 hover:shadow-md ${card.accentBg}`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold shadow-xs ${card.iconBg}`}>
                                                <Icon className="h-5 w-5" aria-hidden="true" />
                                            </span>
                                        </div>
                                        <h3 className="mt-4 text-base font-black text-slate-950 group-hover:text-blue-700">
                                            {card.title}
                                        </h3>
                                        <p className="mt-1.5 text-xs leading-5 text-slate-600">
                                            {card.description}
                                        </p>
                                    </div>
                                    <div className="mt-4 flex items-center justify-end text-xs font-black text-blue-600 group-hover:underline">
                                        開く
                                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>


                {/* 競馬場コース選択 */}
                <section className="mt-8" aria-labelledby="course-search-heading">
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
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1 sm:px-4">
                        <VenueLinks title="中央競馬" slugs={CENTRAL_VENUE_ORDER} />
                        <VenueLinks title="地方競馬" slugs={LOCAL_VENUE_ORDER} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-bold text-slate-600 px-1">
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

