'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    sendDataSearchEvent,
    sendDataSearchResultClickEvent,
    type DataEntityEventType,
} from '@/lib/analytics';
import type { DataSearchResponse } from '@/lib/types';

interface SearchResult {
    type: SearchIndexItem['type'];
    title: string;
    description: string;
    url: string;
    sampleSize?: number;
}

export interface SearchIndexItem {
    type: 'article' | 'page' | 'course' | 'horse' | 'jockey' | 'trainer' | 'grade' | 'race';
    title: string;
    description: string;
    url: string;
    keywords: string[];
}

function normalize(value: string) {
    return value.toLowerCase().replace(/\s+/g, '');
}

function scoreResult(item: SearchIndexItem, query: string) {
    const normalizedQuery = normalize(query);
    const haystack = normalize([
        item.title,
        item.description,
        item.type,
        ...item.keywords,
    ].join(' '));

    if (!normalizedQuery) return 0;
    if (normalize(item.title) === normalizedQuery) return 100;
    if (normalize(item.title).includes(normalizedQuery)) return 60;
    if (item.keywords.some((keyword) => normalize(keyword).includes(normalizedQuery))) return 45;
    if (haystack.includes(normalizedQuery)) return 25;

    const queryParts = query
        .split(/[\s　]+/)
        .map((part) => part.trim())
        .filter(Boolean);

    return queryParts.reduce((score, part) => {
        const normalizedPart = normalize(part);
        if (!normalizedPart) return score;
        if (normalize(item.title).includes(normalizedPart)) return score + 12;
        if (haystack.includes(normalizedPart)) return score + 6;
        return score;
    }, 0);
}

function getResultLabel(type: SearchIndexItem['type']) {
    switch (type) {
        case 'article':
            return '記事';
        case 'course':
            return 'コース';
        case 'horse':
            return '競走馬';
        case 'jockey':
            return '騎手';
        case 'trainer':
            return '調教師';
        case 'grade':
            return '重賞';
        case 'race':
            return 'レース';
        default:
            return 'ページ';
    }
}

function getBadgeClass(type: SearchIndexItem['type']) {
    switch (type) {
        case 'article':
            return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'course':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'horse':
            return 'bg-cyan-50 text-cyan-800 border-cyan-200';
        case 'jockey':
            return 'bg-purple-50 text-purple-700 border-purple-200';
        case 'trainer':
            return 'bg-indigo-50 text-indigo-800 border-indigo-200';
        case 'grade':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'race':
            return 'bg-orange-50 text-orange-700 border-orange-200';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200';
    }
}

function isDataEntityType(type: SearchIndexItem['type']): type is DataEntityEventType {
    return ['course', 'horse', 'jockey', 'trainer', 'grade'].includes(type);
}

function sampleSizeBucket(sampleSize: number): '0_4' | '5_9' | '10_49' | '50_plus' {
    if (sampleSize < 5) return '0_4';
    if (sampleSize < 10) return '5_9';
    if (sampleSize < 50) return '10_49';
    return '50_plus';
}

export default function SearchPageClient({ searchIndex }: { searchIndex: SearchIndexItem[] }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams.get('q') || '';
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);

    useEffect(() => {
        if (query.trim()) {
            performSearch(query);
        }
    }, [query]);

    const performSearch = async (searchQuery: string) => {
        setIsLoading(true);
        setSearchPerformed(true);

        const localResults: SearchResult[] = searchIndex
            .map((item) => ({ item, score: scoreResult(item, searchQuery) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 24)
            .map(({ item }) => ({
                type: item.type,
                title: item.title,
                description: item.description,
                url: item.url,
            }));

        let dataResults: SearchResult[] = [];
        try {
            const response = await fetch(`/api/data/search?q=${encodeURIComponent(searchQuery.trim())}`, {
                cache: 'no-store',
            });
            if (response.ok) {
                const data = await response.json() as DataSearchResponse;
                dataResults = data.items.map((item) => ({
                    type: item.entity_type,
                    title: item.name,
                    description: item.description,
                    url: item.url,
                    sampleSize: item.sample_size,
                }));
            }
        } catch {
            // データAPIが一時的に利用できない場合も記事・静的ページ検索は維持する。
        }
        const seen = new Set<string>();
        const nextResults = [...dataResults, ...localResults]
            .filter((item) => {
                if (seen.has(item.url)) return false;
                seen.add(item.url);
                return true;
            })
            .slice(0, 30);
        setResults(nextResults);
        sendDataSearchEvent({
            query_length: searchQuery.trim().length,
            result_count: nextResults.length,
            search_surface: 'site_search',
        });
        setIsLoading(false);
    };

    const handleSearchChange = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const searchTerm = formData.get('q') as string;

        if (searchTerm.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
        }
    };

    return (
        <div className="mx-auto w-full max-w-5xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
            <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
                <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
                <p className="text-xs font-bold tracking-[0.16em] text-slate-400">SITE SEARCH</p>
                <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
                    サイト内検索
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">
                    記事、レース関連ページ、運営情報をキーワードで探せます。レース名、騎手名、コース名などで検索してください。
                </p>
                <form onSubmit={handleSearchChange} className="mt-5">
                    <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                        <input
                            type="text"
                            name="q"
                            defaultValue={query}
                            placeholder="例: 宝塚記念、東京芝2000m、騎手"
                            className="min-w-0 flex-1 rounded-xl border border-transparent bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-primary sm:px-4"
                        />
                        <button
                            type="submit"
                            className="shrink-0 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary sm:px-6"
                        >
                            検索
                        </button>
                    </div>
                </form>
            </header>

            <main className="mt-5">
                {query && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-600">
                            「<span className="text-slate-950">{query}</span>」の検索結果
                        </p>
                        {!isLoading && searchPerformed && (
                            <p className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">
                                {results.length}件
                            </p>
                        )}
                    </div>
                )}

                {isLoading && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-soft">
                        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
                    </div>
                )}

                {searchPerformed && !isLoading && results.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft">
                        <p className="font-bold text-slate-700">関連する結果が見つかりませんでした。</p>
                        <p className="mt-2 text-sm text-slate-500">別のキーワードで検索してみてください。</p>
                    </div>
                )}

                {results.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                        {results.map((result, index) => (
                            <Link
                                key={`${result.type}-${result.url}`}
                                href={result.url}
                                prefetch={false}
                                onClick={() => {
                                    if (!isDataEntityType(result.type)) return;
                                    sendDataSearchResultClickEvent({
                                        entity_type: result.type,
                                        result_position: index + 1,
                                        result_count: results.length,
                                        search_surface: 'site_search',
                                        sample_size_bucket: sampleSizeBucket(result.sampleSize ?? 0),
                                    });
                                }}
                                className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50"
                            >
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${getBadgeClass(result.type)}`}>
                                    {getResultLabel(result.type)}
                                </span>
                                <h2 className="mt-3 line-clamp-2 text-base font-black leading-snug text-slate-950 group-hover:text-primary">
                                    {result.title}
                                </h2>
                                <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">{result.description}</p>
                                <p className="mt-3 truncate text-xs font-semibold text-slate-400">{result.url}</p>
                            </Link>
                        ))}
                    </div>
                )}

                {!searchPerformed && !query && (
                    <section className="grid gap-3 md:grid-cols-3">
                        {[
                            { label: 'レース名で探す', body: '宝塚記念、函館スプリントSなどの重賞名で検索できます。' },
                            { label: '条件で探す', body: '東京芝2000m、馬場、馬体重など、気になる材料で探せます。' },
                            { label: '使い方を探す', body: 'FAQ、運営情報、AI偏差値の見方も検索対象です。' },
                        ].map((item) => (
                            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                                <h2 className="text-base font-black text-slate-950">{item.label}</h2>
                                <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                            </div>
                        ))}
                    </section>
                )}
            </main>
        </div>
    );
}
