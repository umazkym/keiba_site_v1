import type { Metadata } from 'next';
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
        </>
    );
}
