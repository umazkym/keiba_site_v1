'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleDot, MapPinned, Search, UserRound, UsersRound } from 'lucide-react';
import {
    DATA_ENTITY_LABELS,
    splitPersonDisplayName,
    TRAINER_AFFILIATION_OPTIONS,
} from '@/lib/data-directory';
import {
    sendDataSearchEvent,
    sendDataSearchResultClickEvent,
} from '@/lib/analytics';
import type {
    DataEntityType,
    DataSearchResult,
    DataSearchResponse,
} from '@/lib/types';


type SearchableEntityType = Exclude<DataEntityType, 'grade'>;

const SEARCH_PLACEHOLDERS: Record<SearchableEntityType, string> = {
    horse: '競走馬名を入力',
    jockey: '騎手名を入力',
    trainer: '調教師名を入力',
    course: '例：東京芝1600m',
};

/** エンティティタイプ別のバッジ色とアイコン */
const ENTITY_BADGE_STYLES: Record<SearchableEntityType, {
    className: string;
    Icon: typeof CircleDot;
}> = {
    horse: {
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        Icon: CircleDot,
    },
    jockey: {
        className: 'border-blue-200 bg-blue-50 text-blue-800',
        Icon: UserRound,
    },
    trainer: {
        className: 'border-violet-200 bg-violet-50 text-violet-800',
        Icon: UsersRound,
    },
    course: {
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        Icon: MapPinned,
    },
};

function sampleSizeBucket(sampleSize: number): '0_4' | '5_9' | '10_49' | '50_plus' {
    if (sampleSize < 5) return '0_4';
    if (sampleSize < 10) return '5_9';
    if (sampleSize < 50) return '10_49';
    return '50_plus';
}

export function DataSearchPanel({
    entityType,
    heading = 'データを検索',
    searchSurface = 'data_hub',
}: {
    entityType?: SearchableEntityType;
    heading?: string;
    searchSurface?: 'data_hub' | 'directory';
}) {
    const inputId = useId();
    const [query, setQuery] = useState('');
    const [affiliation, setAffiliation] = useState('');
    const [results, setResults] = useState<DataSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const normalized = `${entityType === 'trainer' ? affiliation : ''}${query.trim()}`.trim();
        if (normalized.length < 2) {
            setResults([]);
            setHasSearched(false);
            setIsLoading(false);
            setErrorMessage(null);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setIsLoading(true);
            setErrorMessage(null);
            try {
                const response = await fetch(`/api/data/search?q=${encodeURIComponent(normalized)}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error('検索データを取得できませんでした。');
                }
                const data = await response.json() as DataSearchResponse;
                const nextResults = data.items
                    .filter((item) => !entityType || item.entity_type === entityType)
                    .filter((item) => !affiliation || item.affiliation === affiliation)
                    .slice(0, entityType ? 20 : 12);
                setResults(nextResults);
                setHasSearched(true);
                sendDataSearchEvent({
                    query_length: normalized.length,
                    result_count: nextResults.length,
                    search_surface: searchSurface,
                });
            } catch (error) {
                if (controller.signal.aborted) return;
                setResults([]);
                setHasSearched(true);
                setErrorMessage(error instanceof Error ? error.message : '検索データを取得できませんでした。');
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }, 220);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [affiliation, entityType, query, searchSurface]);

    const placeholder = entityType
        ? SEARCH_PLACEHOLDERS[entityType]
        : '競走馬、騎手、調教師、東京芝1600mなど';
    const completeQuery = `${entityType === 'trainer' ? affiliation : ''}${query.trim()}`.trim();

    return (
        <section aria-labelledby={`${inputId}-heading`} className="overflow-hidden rounded-xl border border-slate-300 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 sm:px-4 sm:py-2">
                <h2 id={`${inputId}-heading`} className="flex items-center gap-1.5 text-xs font-bold text-slate-900 sm:text-sm">
                    <Search className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    {heading}
                </h2>
            </div>
            <div className="p-2.5 sm:p-4">
                <label htmlFor={inputId} className="mb-1 block text-xs font-bold text-slate-600">
                    {entityType ? `${DATA_ENTITY_LABELS[entityType]}名で検索` : 'キーワード'}
                </label>
                <div className="flex min-h-10 items-center rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                    <Search className="ml-2.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <input
                        id={inputId}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={placeholder}
                        autoComplete="off"
                        className="min-h-9 min-w-0 flex-1 bg-transparent px-2.5 py-1 text-sm font-semibold text-slate-950 outline-none placeholder:font-normal placeholder:text-slate-400"
                    />
                    {completeQuery && (
                        <Link
                            href={`/search?q=${encodeURIComponent(completeQuery)}`}
                            className="mr-1.5 inline-flex min-h-10 shrink-0 items-center rounded-md bg-blue-600 px-3 text-sm font-bold text-white transition-colors duration-150 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                            全検索
                        </Link>
                    )}
                </div>
                {entityType === 'trainer' && (
                    <div className="mt-3 grid grid-cols-[72px_1fr] items-center gap-2">
                        <label htmlFor={`${inputId}-affiliation`} className="text-xs font-bold text-slate-600">
                            所属
                        </label>
                        <select
                            id={`${inputId}-affiliation`}
                            value={affiliation}
                            onChange={(event) => setAffiliation(event.target.value)}
                            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">すべての所属</option>
                            {TRAINER_AFFILIATION_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                )}
                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    {entityType === 'trainer'
                        ? '所属だけでも絞り込めます。所属は氏名とは分けて表示します。'
                        : '2文字以上で候補を表示します。'}
                </p>
            </div>

            <div aria-live="polite" aria-busy={isLoading} className="border-t border-slate-100">
                {isLoading && (
                    <p className="px-4 py-3 text-sm font-semibold text-slate-600">検索しています…</p>
                )}
                {!isLoading && errorMessage && (
                    <p className="px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</p>
                )}
                {!isLoading && hasSearched && !errorMessage && results.length === 0 && (
                    <div className="px-4 py-3">
                        <p className="text-sm font-bold text-slate-800">一致するデータが見つかりませんでした。</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                            姓だけ、馬名の一部、または「東京 芝 1600m」のように条件を短くしてお試しください。
                        </p>
                    </div>
                )}
                {!isLoading && results.length > 0 && (
                    <div className="divide-y divide-slate-100">
                        {results.map((item, index) => {
                            const display = splitPersonDisplayName(
                                item.name,
                                item.entity_type,
                                item.affiliation,
                            );
                            const badge = ENTITY_BADGE_STYLES[item.entity_type as SearchableEntityType];
                            const BadgeIcon = badge?.Icon;
                            return (
                                <Link
                                    key={`${item.entity_type}-${item.id}`}
                                    href={item.url}
                                    prefetch={false}
                                    onClick={() => {
                                        sendDataSearchResultClickEvent({
                                            entity_type: item.entity_type,
                                            result_position: index + 1,
                                            result_count: results.length,
                                            search_surface: searchSurface,
                                            sample_size_bucket: sampleSizeBucket(item.sample_size),
                                        });
                                    }}
                                    className={`grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${index % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                                >
                                    <span className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-black ${badge?.className ?? 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                                        {BadgeIcon && <BadgeIcon className="h-3 w-3" aria-hidden="true" />}
                                        {DATA_ENTITY_LABELS[item.entity_type as SearchableEntityType] ?? 'データ'}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className="truncate font-black text-slate-950">{display.name}</span>
                                            {display.affiliation && (
                                                <span className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-600">
                                                    {display.affiliation}
                                                </span>
                                            )}
                                        </span>
                                        <span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span>
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
