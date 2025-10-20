import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchPageClient from './SearchPageClient';

export const metadata: Metadata = {
    title: 'サイト内検索 | uma-free',
    description: 'uma-freeサイト内の記事やページを検索します。AI競馬予想、レース情報、会社情報などを検索してみてください。',
    robots: 'index, follow',
};

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="container mx-auto px-4 py-8"><div className="max-w-3xl mx-auto"><div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div></div></div>}>
            <SearchPageClient />
        </Suspense>
    );
}
