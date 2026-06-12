'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SearchResult {
    type: 'article' | 'page';
    title: string;
    description: string;
    url: string;
}

export interface SearchIndexItem {
    type: 'article' | 'page' | 'course' | 'jockey' | 'grade';
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
        case 'jockey':
            return '騎手';
        case 'grade':
            return '重賞';
        default:
            return 'ページ';
    }
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

        const results: SearchResult[] = searchIndex
            .map((item) => ({ item, score: scoreResult(item, searchQuery) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 20)
            .map(({ item }) => ({
                type: item.type === 'article' ? 'article' : 'page',
                title: item.title,
                description: item.description,
                url: item.url,
            }));

        setResults(results);
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
        <div className="mx-auto px-3 py-4 sm:px-4 sm:py-8">
            <div className="max-w-3xl mx-auto">
                <h1 className="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl">サイト内検索</h1>

                {/* 検索フォーム */}
                <form onSubmit={handleSearchChange} className="mb-5 sm:mb-8">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            name="q"
                            defaultValue={query}
                            placeholder="キーワードを入力してください..."
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary sm:px-4 sm:py-3 sm:text-base"
                        />
                        <button
                            type="submit"
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark sm:px-6 sm:py-3 sm:text-base"
                        >
                            検索
                        </button>
                    </div>
                </form>

                {/* 検索結果表示 */}
                {query && (
                    <p className="mb-4 text-sm text-gray-600 sm:mb-6 sm:text-lg">
                        「<span className="font-semibold text-gray-800">{query}</span>」の検索結果
                    </p>
                )}

                {/* ローディング */}
                {isLoading && (
                    <div className="flex items-center justify-center py-8 sm:py-12">
                        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-primary sm:h-12 sm:w-12"></div>
                    </div>
                )}

                {/* 結果なし */}
                {searchPerformed && !isLoading && results.length === 0 && (
                    <div className="rounded-lg bg-gray-100 p-5 text-center sm:p-8">
                        <p className="mb-3 text-sm text-gray-600 sm:mb-4 sm:text-lg">
                            「{query}」に関連する結果が見つかりませんでした。
                        </p>
                        <p className="text-sm text-gray-500 sm:text-base">
                            別のキーワードで検索してみてください。
                        </p>
                    </div>
                )}

                {/* 結果表示 */}
                {results.length > 0 && (
                    <div className="space-y-2.5 sm:space-y-4">
                        <div className="mb-2 text-xs text-gray-500 sm:mb-4 sm:text-sm">
                            {results.length}件の検索結果が見つかりました
                        </div>
                        {results.map((result, index) => (
                            <Link
                                key={index}
                                href={result.url}
                                className="block rounded-lg border border-gray-200 p-3 transition-all hover:border-primary hover:shadow-lg sm:p-4"
                            >
                                <div className="flex items-start gap-2.5 sm:gap-3">
                                    <div className="pt-1">
                                        <span className="inline-block rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 sm:px-2 sm:py-1 sm:text-xs">
                                            {getResultLabel(searchIndex.find((item) => item.url === result.url)?.type ?? result.type)}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="mb-1 text-sm font-semibold text-primary hover:underline sm:mb-2 sm:text-lg">
                                            {result.title}
                                        </h2>
                                        <p className="line-clamp-2 text-xs text-gray-600 sm:text-sm">
                                            {result.description}
                                        </p>
                                        <p className="mt-1 text-[10px] text-gray-400 sm:mt-2 sm:text-xs">
                                            {result.url}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* 初期表示（検索がまだ実行されていない） */}
                {!searchPerformed && !query && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 text-center sm:border-2 sm:p-8">
                        <p className="mb-3 text-sm text-gray-700 sm:mb-4 sm:text-base">
                            キーワードを入力して、サイト内の記事やページを検索できます。
                        </p>
                        <p className="text-gray-500 text-sm">
                            AI競馬分析、レース情報、運営情報などを検索してみてください。
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
