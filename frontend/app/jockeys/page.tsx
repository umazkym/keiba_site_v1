import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { DataDirectoryView } from '@/components/DataDirectoryView';
import { getDataEntityDirectory } from '@/lib/api';


export const revalidate = 3600;

export const metadata: Metadata = {
    title: '騎手データ｜得意コース・距離・馬場別成績',
    description: '中央・地方の騎手成績を、競馬場、距離、馬場状態、人気別に無料で確認できます。',
    alternates: { canonical: '/jockeys' },
};

export default async function JockeysPage() {
    const directory = await getDataEntityDirectory('jockey', {
        limit: 80,
        indexableOnly: true,
    });
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: '騎手データ', url: 'https://uma-free.com/jockeys' },
                ]}
            />
            <Breadcrumb />
            <DataDirectoryView
                entityType="jockey"
                directory={directory ?? {
                    entity_type: 'jockey',
                    total: 0,
                    limit: 80,
                    offset: 0,
                    items: [],
                }}
            />
            <div className="mx-auto -mt-8 max-w-6xl px-3 pb-14 sm:px-4">
                <Link
                    href="/articles#jockeys"
                    className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors duration-150 hover:text-primary"
                >
                    騎手記事も確認する
                </Link>
            </div>
        </>
    );
}
