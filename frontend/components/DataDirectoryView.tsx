import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DataDirectoryNav } from '@/components/DataDirectoryNav';
import { DataSearchPanel } from '@/components/DataSearchPanel';
import {
    splitPersonDisplayName,
} from '@/lib/data-directory';
import type { DataEntityDirectory, DataEntityType } from '@/lib/types';


const labels: Record<Exclude<DataEntityType, 'grade'>, {
    title: string;
    description: string;
    itemLabel: string;
    recentTitle: string;
    categoryLabel: string;
}> = {
    course: {
        title: '競馬場・コースデータ',
        description: '競馬場、芝・ダート、距離からコース成績を探せます。',
        itemLabel: 'コース',
        recentTitle: 'コース一覧',
        categoryLabel: '競馬データベース',
    },
    horse: {
        title: '競走馬データ',
        description: '競走馬名から近走、コース・距離・馬場別成績、AI偏差値の履歴を探せます。',
        itemLabel: '競走馬',
        recentTitle: '最近出走が確認できる競走馬',
        categoryLabel: '競馬データベース',
    },
    jockey: {
        title: '騎手データ',
        description: '騎手名から競馬場、距離、馬場状態、人気別の騎乗成績を探せます。',
        itemLabel: '騎手',
        recentTitle: '最近騎乗が確認できる騎手',
        categoryLabel: '競馬データベース',
    },
    trainer: {
        title: '調教師データ',
        description: '調教師名から管理馬の競馬場、距離、馬場状態、人気別成績を探せます。',
        itemLabel: '調教師',
        recentTitle: '最近出走が確認できる調教師',
        categoryLabel: '競馬データベース',
    },
};

/** 最終出走日の新鮮度に応じた色を返す */
function getDateFreshnessClass(dateString: string | null): string {
    if (!dateString) return 'text-slate-400';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 7) return 'text-emerald-700 font-bold';
    if (diffDays <= 30) return 'text-slate-700';
    return 'text-slate-400';
}

export function DataDirectoryView({
    directory,
    entityType,
}: {
    directory: DataEntityDirectory;
    entityType: Exclude<DataEntityType, 'grade'>;
}) {
    const content = labels[entityType];
    const hasAffiliation = directory.items.some((item) => (
        splitPersonDisplayName(item.name, entityType, item.affiliation).affiliation
    ));
    const desktopColumns = hasAffiliation
        ? 'sm:grid-cols-[minmax(0,1fr)_100px_72px_110px_28px]'
        : 'sm:grid-cols-[minmax(0,1fr)_72px_110px_28px]';

    return (
        <main className="mx-auto max-w-6xl px-3 pb-14 pt-3 sm:px-4">
            <DataDirectoryNav current={entityType} />

            <header className="mt-5 border-b border-slate-200 pb-5">
                <p className="text-xs font-bold text-slate-500">{content.categoryLabel}</p>
                <h1 className="mt-1 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                    {content.title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                    {content.description}
                </p>
            </header>

            <div className="mt-5">
                <DataSearchPanel
                    entityType={entityType}
                    heading={`${content.itemLabel}を名前で探す`}
                />
            </div>

            <section className="mt-6" aria-labelledby={`${entityType}-recent-heading`}>
                <div className="mb-2 flex items-end justify-between gap-3">
                    <div>
                        <h2 id={`${entityType}-recent-heading`} className="text-lg font-black text-slate-950">
                            {content.recentTitle}
                        </h2>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">
                            最終出走日の新しい順に掲載しています。
                        </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">
                        {directory.total.toLocaleString('ja-JP')}件
                    </span>
                </div>

                {directory.items.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <h3 className="font-black text-slate-900">一覧を取得できませんでした</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                            上の名前検索をお試しいただくか、時間を置いて再度表示してください。
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {/* ヘッダー上部のアクセントライン */}
                        <div className="h-0.5 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-400" />
                        <div className={`hidden border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 sm:grid sm:items-center sm:gap-3 ${desktopColumns}`}>
                            <span>{content.itemLabel}</span>
                            {hasAffiliation && <span>所属</span>}
                            <span className="text-right">出走数</span>
                            <span>最終出走</span>
                            <span aria-hidden="true" />
                        </div>
                        <div className="divide-y divide-slate-100">
                            {directory.items.map((item, index) => {
                                const display = splitPersonDisplayName(
                                    item.name,
                                    entityType,
                                    item.affiliation,
                                );
                                return (
                                    <Link
                                        key={`${item.entity_type}-${item.id}`}
                                        prefetch={false}
                                        href={item.url}
                                        className={`grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:min-h-14 sm:gap-3 ${desktopColumns} ${index % 2 === 1 ? 'bg-slate-50/50' : ''}`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-[15px] font-black text-slate-950">{display.name}</span>
                                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 sm:hidden">
                                                {display.affiliation && (
                                                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-bold text-slate-600">
                                                        {display.affiliation}
                                                    </span>
                                                )}
                                                <span>{item.sample_size.toLocaleString('ja-JP')}走</span>
                                                <span className={getDateFreshnessClass(item.last_race_date)}>
                                                    {item.last_race_date ?? '日付不明'}
                                                </span>
                                            </span>
                                        </span>
                                        {hasAffiliation && (
                                            <span className="hidden text-xs font-bold text-slate-600 sm:block">
                                                {display.affiliation ?? '—'}
                                            </span>
                                        )}
                                        <span className="hidden text-right font-mono text-xs font-bold tabular-nums text-slate-500 sm:block">
                                            {item.sample_size.toLocaleString('ja-JP')}
                                        </span>
                                        <span className={`hidden text-xs tabular-nums sm:block ${getDateFreshnessClass(item.last_race_date)}`}>
                                            {item.last_race_date ?? '—'}
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
