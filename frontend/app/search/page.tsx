import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchPageClient from './SearchPageClient';
import { Breadcrumb } from '@/components/Breadcrumb';

export const metadata: Metadata = {
    title: 'サイト内検索 | UMA-FREE',
    description: 'UMA-FREEサイト内の記事やページを検索します。AI競馬分析、レース情報、よくある質問などを検索してみてください。',
    robots: 'index, follow',
    openGraph: {
        title: 'サイト内検索 | UMA-FREE',
        description: 'UMA-FREEサイト内の記事やレース情報を検索。AI競馬分析データ、初心者ガイド、FAQ等を検索できます。',
    },
    alternates: {
        canonical: '/search',
    },
};

export default function SearchPage() {
    return (
        <>
            <Breadcrumb />
            <Suspense fallback={<div className="container mx-auto px-4 py-8"><div className="max-w-3xl mx-auto"><div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div></div></div>}>
                <SearchPageClient />
            </Suspense>
        </>
    );
}
