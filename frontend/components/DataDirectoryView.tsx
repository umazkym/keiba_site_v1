import Link from 'next/link';
import { DataDirectoryNav } from '@/components/DataDirectoryNav';
import { DataSearchPanel } from '@/components/DataSearchPanel';
import { DataPageHead } from '@/components/DataPageHead';
import { LineIcon } from '@/components/LineIcon';
import { SectionHeader } from '@/components/SectionHeader';
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
        description: '馬名から近走の条件別成績、AI偏差値を閲覧出来ます。',
        itemLabel: '競走馬',
        recentTitle: '最近出走した競走馬',
        categoryLabel: '競馬データベース',
    },
    jockey: {
        title: '騎手データ',
        description: '騎手名から近走の条件別成績を閲覧出来ます。',
        itemLabel: '騎手',
        recentTitle: '最近出走した騎手',
        categoryLabel: '競馬データベース',
    },
    trainer: {
        title: '調教師データ',
        description: '調教師名から近走の条件別成績を閲覧出来ます。',
        itemLabel: '調教師',
        recentTitle: '最近出走した調教師',
        categoryLabel: '競馬データベース',
    },
};

/** 最終出走日の新鮮度に応じた色を返す */
function getDateFreshnessClass(dateString: string | null): string {
    if (!dateString) return 'text-slate-500';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 7) return 'text-emerald-700 font-bold';
    if (diffDays <= 30) return 'text-slate-700';
    return 'text-slate-500';
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
        <main className="mx-auto max-w-6xl px-3.5 pb-14 pt-3 sm:px-5">
            <DataDirectoryNav current={entityType} />

            <DataPageHead
                icon={entityType === 'course' ? 'pin' : entityType === 'horse' ? 'race' : 'user'}
                title={content.title}
                description={content.description}
            />

            <div className="mt-2 sm:mt-4">
                <DataSearchPanel
                    entityType={entityType}
                    heading={`${content.itemLabel}を名前で探す`}
                    searchSurface="directory"
                />
            </div>

            <section className="mt-2.5 sm:mt-4" aria-labelledby={`${entityType}-recent-heading`}>
                <SectionHeader
                    id={`${entityType}-recent-heading`}
                    title={content.recentTitle}
                    description="最終出走日の新しい順に掲載しています。"
                    meta={`${directory.total.toLocaleString('ja-JP')}件`}
                    className="mb-1.5 sm:mb-3"
                    compact
                />

                {directory.items.length === 0 ? (
                    <div className="rounded-[14px] bg-white p-4 ring-1 ring-inset ring-slate-200">
                        <h3 className="text-[15px] font-bold text-slate-900">一覧を取得できませんでした</h3>
                        <p className="mt-1 text-[13.5px] leading-[1.7] text-slate-600">
                            上の名前検索をお試しいただくか、時間を置いて再度表示してください。
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-[14px] bg-white ring-1 ring-inset ring-slate-200">
                        <div className={`hidden border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[12.5px] font-bold text-slate-500 sm:grid sm:items-center sm:gap-3 ${desktopColumns}`}>
                            <span>{content.itemLabel}</span>
                            {hasAffiliation && <span>所属</span>}
                            <span className="text-right">出走数</span>
                            <span>最終出走</span>
                            <span aria-hidden="true" />
                        </div>
                        <div className="divide-y divide-slate-200">
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
                                        className={`grid min-h-[56px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2 transition-colors duration-150 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:min-h-14 sm:gap-3 ${desktopColumns}`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-[15px] font-bold text-slate-900">{display.name}</span>
                                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-slate-500 sm:hidden">
                                                {display.affiliation && (
                                                    <span className="rounded-[5px] bg-slate-50 px-1.5 font-bold text-slate-600 ring-1 ring-inset ring-slate-200 text-[11.5px]">
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
                                            <span className="hidden text-[13px] font-bold text-slate-600 sm:block">
                                                {display.affiliation ?? '—'}
                                            </span>
                                        )}
                                        <span className="hidden text-right font-num text-[15px] font-semibold tabular-nums text-slate-600 sm:block">
                                            {item.sample_size.toLocaleString('ja-JP')}
                                        </span>
                                        <span className={`hidden font-num text-[14px] tabular-nums sm:block ${getDateFreshnessClass(item.last_race_date)}`}>
                                            {item.last_race_date ?? '—'}
                                        </span>
                                        <LineIcon name="chevR" size={18} className="block text-slate-500" />
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
