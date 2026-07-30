import Link from 'next/link';
import { Search } from 'lucide-react';
import type { DataEntityDirectory, DataEntityType } from '@/lib/types';


const labels: Record<Exclude<DataEntityType, 'grade'>, {
    title: string;
    description: string;
    itemLabel: string;
}> = {
    course: {
        title: '競馬場・コース別データ',
        description: '競馬場、コース種別、距離ごとの枠順・脚質・馬場傾向を過去結果から集計しています。',
        itemLabel: 'コース',
    },
    horse: {
        title: '競走馬データ',
        description: '近走、コース・距離・馬場別成績、AI偏差値の履歴を競走馬ごとに確認できます。',
        itemLabel: '競走馬',
    },
    jockey: {
        title: '騎手データ',
        description: '騎手のコース・距離・馬場状態・人気別成績を同じ基準で比較できます。',
        itemLabel: '騎手',
    },
    trainer: {
        title: '調教師データ',
        description: '調教師の管理馬成績を競馬場、距離、馬場状態、人気別に再集計しています。',
        itemLabel: '調教師',
    },
};

export function DataDirectoryView({
    directory,
    entityType,
}: {
    directory: DataEntityDirectory;
    entityType: Exclude<DataEntityType, 'grade'>;
}) {
    const content = labels[entityType];
    return (
        <main className="mx-auto max-w-6xl px-3 pb-14 pt-4 sm:px-4">
            <header className="border-b border-slate-200 pb-5">
                <p className="text-xs font-bold text-slate-500">UMA-FREE DATA</p>
                <h1 className="mt-1 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                    {content.title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                    {content.description}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link
                        href="/search"
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary"
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        名前・条件で検索
                    </Link>
                    <span className="text-sm font-bold text-slate-500">
                        公開基準を満たす{content.itemLabel} {directory.total.toLocaleString('ja-JP')}件
                    </span>
                </div>
            </header>

            {directory.items.length === 0 ? (
                <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="font-black text-slate-900">現在表示できるデータがありません</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                        集計母数と直近活動の公開基準を確認しています。サイト内検索も利用できます。
                    </p>
                </section>
            ) : (
                <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="grid border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 sm:grid-cols-[1fr_180px_130px]">
                        <span>{content.itemLabel}</span>
                        <span className="hidden sm:block">集計対象</span>
                        <span className="hidden sm:block">最終出走</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {directory.items.map((item) => (
                            <Link
                                key={`${item.entity_type}-${item.id}`}
                                prefetch={false}
                                href={item.url}
                                className="grid min-h-16 items-center gap-1 px-4 py-3 transition-colors duration-150 hover:bg-slate-50 sm:grid-cols-[1fr_180px_130px] sm:gap-3"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate font-black text-slate-900">{item.name}</span>
                                    <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>
                                </span>
                                <span className="font-mono text-xs font-bold tabular-nums text-slate-600 sm:text-sm">
                                    {item.sample_size.toLocaleString('ja-JP')}走
                                </span>
                                <span className="text-xs font-semibold text-slate-500">
                                    {item.last_race_date ?? '—'}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {directory.total > directory.items.length && (
                <p className="mt-4 text-sm leading-7 text-slate-600">
                    一覧は直近活動と集計数を基準に上位{directory.items.length}件を表示しています。
                    それ以外はサイト内検索から名前で探せます。
                </p>
            )}
        </main>
    );
}
