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

export default function SearchPageClient() {
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
        const results: SearchResult[] = [];

        try {
            // 記事の検索
            const articlesResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/articles`
            );

            if (articlesResponse.ok) {
                const articlesData = await articlesResponse.json();
                const articles = Array.isArray(articlesData) ? articlesData : articlesData.articles || [];

                // クエリ文字列で記事をフィルタリング
                const lowerQuery = searchQuery.toLowerCase();
                const matchingArticles = articles.filter((article: any) =>
                    (article.title && article.title.toLowerCase().includes(lowerQuery)) ||
                    (article.content && article.content.toLowerCase().includes(lowerQuery)) ||
                    (article.description && article.description.toLowerCase().includes(lowerQuery))
                ).slice(0, 10);

                matchingArticles.forEach((article: any) => {
                    results.push({
                        type: 'article',
                        title: article.title || '記事',
                        description: article.description || article.content?.substring(0, 160) || '',
                        url: `/articles/${article.slug || article.id}`
                    });
                });
            }
        } catch (error) {
            console.error('記事検索エラー:', error);
        }

        // 静的ページの検索結果を追加
        const staticPages: SearchResult[] = [
            {
                type: 'page',
                title: 'プライバシーポリシー',
                description: 'サイトのプライバシーポリシーと個人情報の取り扱いについて',
                url: '/privacy'
            },
            {
                type: 'page',
                title: 'お問い合わせ',
                description: 'ご不明な点やご要望については、こちらからお問い合わせください',
                url: '/contact'
            },
            {
                type: 'page',
                title: 'サイト運営者について',
                description: 'UMA-FREEの運営方針とサービス内容についてのご説明',
                url: '/about'
            }
        ];

        const lowerQuery = searchQuery.toLowerCase();
        staticPages.forEach(page => {
            if (page.title.toLowerCase().includes(lowerQuery) ||
                page.description.toLowerCase().includes(lowerQuery)) {
                results.push(page);
            }
        });

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
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">サイト内検索</h1>

                {/* 検索フォーム */}
                <form onSubmit={handleSearchChange} className="mb-8">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            name="q"
                            defaultValue={query}
                            placeholder="キーワードを入力してください..."
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                            type="submit"
                            className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
                        >
                            検索
                        </button>
                    </div>
                </form>

                {/* 検索結果表示 */}
                {query && (
                    <p className="text-lg text-gray-600 mb-6">
                        「<span className="font-semibold text-gray-800">{query}</span>」の検索結果
                    </p>
                )}

                {/* ローディング */}
                {isLoading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                )}

                {/* 結果なし */}
                {searchPerformed && !isLoading && results.length === 0 && (
                    <div className="bg-gray-100 rounded-lg p-8 text-center">
                        <p className="text-gray-600 mb-4 text-lg">
                            「{query}」に関連する結果が見つかりませんでした。
                        </p>
                        <p className="text-gray-500">
                            別のキーワードで検索してみてください。
                        </p>
                    </div>
                )}

                {/* 結果表示 */}
                {results.length > 0 && (
                    <div className="space-y-4">
                        <div className="text-sm text-gray-500 mb-4">
                            {results.length}件の検索結果が見つかりました
                        </div>
                        {results.map((result, index) => (
                            <Link
                                key={index}
                                href={result.url}
                                className="block p-4 border border-gray-200 rounded-lg hover:shadow-lg hover:border-primary transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="pt-1">
                                        <span className="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded font-semibold">
                                            {result.type === 'article' ? '記事' : 'ページ'}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-lg font-semibold text-primary hover:underline mb-2">
                                            {result.title}
                                        </h2>
                                        <p className="text-gray-600 line-clamp-2 text-sm">
                                            {result.description}
                                        </p>
                                        <p className="text-gray-400 text-xs mt-2">
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
                    <div className="bg-primary/5 rounded-lg p-8 text-center border-2 border-primary/20">
                        <p className="text-gray-700 mb-4">
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
