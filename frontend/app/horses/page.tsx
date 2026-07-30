import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { DataDirectoryView } from '@/components/DataDirectoryView';
import { getDataEntityDirectory } from '@/lib/api';


export const revalidate = 3600;

export const metadata: Metadata = {
    title: '競走馬データ｜近走・コース・馬場別成績',
    description: '競走馬ごとの近走、競馬場・距離・馬場状態別成績、AI偏差値の履歴を無料で確認できます。',
    alternates: { canonical: '/horses' },
};

export default async function HorsesPage() {
    const directory = await getDataEntityDirectory('horse', {
        limit: 80,
        indexableOnly: true,
    });
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: '競走馬データ', url: 'https://uma-free.com/horses' },
                ]}
            />
            <Breadcrumb />
            <DataDirectoryView
                entityType="horse"
                directory={directory ?? {
                    entity_type: 'horse',
                    total: 0,
                    limit: 80,
                    offset: 0,
                    items: [],
                }}
            />
        </>
    );
}
