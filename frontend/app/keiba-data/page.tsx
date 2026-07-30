import type { Metadata } from 'next';
import Link from 'next/link';
import {
    BarChart3,
    Bookmark,
    CircleDot,
    GitCompareArrows,
    MapPinned,
    Search,
    ShieldCheck,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { getGrowthDataSummary } from '@/lib/api';
import type { DataEntitySummary } from '@/lib/types';


export const revalidate = 21600;

export const metadata: Metadata = {
    title: '競馬データベース｜馬・騎手・調教師・コース成績',
    description: '過去レース結果を再集計し、競走馬、騎手、調教師、競馬場・コース、AI予測成績を無料で検索・比較できます。',
    robots: { index: true, follow: true },
    alternates: { canonical: '/keiba-data' },
};

const dataEntrances = [
    {
        href: '/horses',
        label: '競走馬',
        description: '近走、コース・距離・馬場別成績、AI偏差値履歴',
        icon: CircleDot,
    },
    {
        href: '/jockeys',
        label: '騎手',
        description: '競馬場、距離、馬場状態、人気帯別の騎乗成績',
        icon: UserRound,
    },
    {
        href: '/trainers',
        label: '調教師',
        description: '管理馬のコース・距離・馬場状態別成績',
        icon: UsersRound,
    },
    {
        href: '/courses',
        label: 'コース',
        description: '枠番、馬番、脚質、騎手、調教師、払戻分布',
        icon: MapPinned,
    },
    {
        href: '/results/accuracy',
        label: 'AI予測成績',
        description: 'AI偏差値上位馬の勝率・3着以内率と苦手条件',
        icon: BarChart3,
    },
    {
        href: '/compare',
        label: '馬を比較',
        description: '2〜5頭の近走・得意条件・AI偏差値履歴を横並び比較',
        icon: GitCompareArrows,
    },
    {
        href: '/my-data',
        label: 'マイデータ',
        description: '保存した馬・騎手・調教師・コースと閲覧履歴',
        icon: Bookmark,
    },
    {
        href: '/search',
        label: '横断検索',
        description: '名前、競馬場、距離、重賞名からサイト全体を検索',
        icon: Search,
    },
];

function EntityList({
    title,
    items,
    moreHref,
}: {
    title: string;
    items: DataEntitySummary[];
    moreHref: string;
}) {
    if (items.length === 0) return null;
    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="font-black text-slate-950">{title}</h2>
                <Link href={moreHref} className="text-sm font-bold text-primary hover:underline">一覧</Link>
            </div>
            <div className="divide-y divide-slate-100">
                {items.slice(0, 6).map((item) => (
                    <Link
                        key={`${item.entity_type}-${item.id}`}
                        prefetch={false}
                        href={item.url}
                        className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-slate-50"
                    >
                        <span className="min-w-0">
                            <span className="block truncate font-bold text-slate-900">{item.name}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>
                        </span>
                        <span className="font-mono text-xs font-bold tabular-nums text-slate-500">
                            {item.sample_size.toLocaleString('ja-JP')}走
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}

export default async function KeibaDataPage() {
    const summary = await getGrowthDataSummary();
    const counts = summary?.counts;
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'UMA-FREE競馬データベース',
        description: metadata.description,
        url: 'https://uma-free.com/keiba-data',
        mainEntity: {
            '@type': 'Dataset',
            name: 'UMA-FREE 過去レース集計',
            temporalCoverage: `${counts?.first_race_date ?? ''}/${counts?.last_race_date ?? ''}`,
            measurementTechnique: '過去レース結果の条件別集計',
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
            <main className="mx-auto max-w-6xl px-3 pb-14 pt-4 sm:px-4">
                <header className="border-b border-slate-200 pb-5">
                    <p className="text-xs font-bold text-slate-500">UMA-FREE DATA</p>
                    <h1 className="mt-1 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                        過去レースを、馬・人・コースから調べる
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                        スクレイピング済みのレース結果を、競走馬、騎手、調教師、コース、馬場状態ごとに再集計しています。
                        率だけでなく母数と更新日を表示し、当日のレースへつなげます。
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href="/search"
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary"
                        >
                            <Search className="h-4 w-4" aria-hidden="true" />
                            データを検索
                        </Link>
                        <Link
                            prefetch={false}
                            href="/races/today"
                            className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors duration-150 hover:text-primary"
                        >
                            今日のレース
                        </Link>
                    </div>
                </header>

                {counts && (
                    <section aria-label="データ収録数" className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <dl className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
                            {[
                                ['レース', counts.races],
                                ['出走結果', counts.results],
                                ['競走馬', counts.horses],
                                ['騎手', counts.jockeys],
                                ['調教師', counts.trainers],
                                ['コース条件', counts.course_conditions],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="px-3 py-3 text-center">
                                    <dt className="text-[11px] font-bold text-slate-500">{label}</dt>
                                    <dd className="mt-1 font-mono text-lg font-black tabular-nums text-slate-950">
                                        {Number(value).toLocaleString('ja-JP')}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <p className="border-t border-slate-100 px-4 py-2 text-center text-[11px] text-slate-500">
                            収録期間 {counts.first_race_date ?? '—'}〜{counts.last_race_date ?? '—'}
                        </p>
                    </section>
                )}

                <section className="mt-6">
                    <h2 className="text-xl font-black text-slate-950">調べる対象を選ぶ</h2>
                    <div className="mt-3 grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
                        {dataEntrances.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    prefetch={item.href === '/compare' ? false : undefined}
                                    className="group min-h-28 border-b border-slate-100 p-4 transition-colors duration-150 hover:bg-slate-50 sm:border-r"
                                >
                                    <Icon className="h-5 w-5 text-slate-500 group-hover:text-primary" aria-hidden="true" />
                                    <h3 className="mt-2 font-black text-slate-950">{item.label}</h3>
                                    <p className="mt-1 text-xs leading-6 text-slate-600">{item.description}</p>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                {summary && (
                    <div className="mt-6 grid gap-5 lg:grid-cols-2">
                        <EntityList title="更新されたコース" items={summary.featured_courses} moreHref="/courses" />
                        <EntityList title="直近の競走馬" items={summary.active_horses} moreHref="/horses" />
                        <EntityList title="直近の騎手" items={summary.active_jockeys} moreHref="/jockeys" />
                        <EntityList title="直近の調教師" items={summary.active_trainers} moreHref="/trainers" />
                    </div>
                )}

                <section className="mt-6 flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                    <div>
                        <h2 className="font-black text-slate-950">集計の読み方</h2>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                            過去成績は将来の結果を示すものではありません。少数の条件ほど率が大きく動くため、各表では集計対象数を併記しています。
                            馬場や開催時期の違いも含め、当日の判断材料の一つとして利用してください。
                        </p>
                    </div>
                </section>

                <section className="mt-6">
                    <h2 className="text-xl font-black text-slate-950">データを読む前に</h2>
                    <div className="mt-3 grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3">
                        {[
                            {
                                href: '/keiba-data/track-condition',
                                label: '馬場状態の見方',
                                description: '良・稍重・重・不良の違いを整理します。',
                            },
                            {
                                href: '/keiba-data/horse-weight',
                                label: '馬体重増減の見方',
                                description: '増減値を単独で判断しないための確認順です。',
                            },
                            {
                                href: '/keiba-data/site-selection',
                                label: '情報サイトの選び方',
                                description: '出典、更新日、母数を確認する基準です。',
                            },
                        ].map((guide) => (
                            <Link
                                key={guide.href}
                                href={guide.href}
                                className="min-h-24 border-b border-slate-100 p-4 transition-colors duration-150 hover:bg-slate-50 sm:border-b-0 sm:border-r"
                            >
                                <h3 className="font-black text-slate-950">{guide.label}</h3>
                                <p className="mt-1 text-xs leading-6 text-slate-600">{guide.description}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
        </>
    );
}
