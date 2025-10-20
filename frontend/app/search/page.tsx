import type { Metadata } from 'next';
import SearchPageClient from './SearchPageClient';

export const metadata: Metadata = {
    title: 'サイト内検索 | uma-free',
    description: 'uma-freeサイト内の記事やページを検索します。AI競馬予想、レース情報、会社情報などを検索してみてください。',
    robots: 'index, follow',
};

export default function SearchPage() {
    return <SearchPageClient />;
}
