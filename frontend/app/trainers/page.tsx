import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { DataDirectoryView } from '@/components/DataDirectoryView';
import { getDataEntityDirectory } from '@/lib/api';


export const revalidate = 3600;

export const metadata: Metadata = {
    title: '調教師データ｜競馬場・距離・馬場別成績',
    description: '調教師ごとの管理馬成績を、競馬場、距離、馬場状態、人気別に無料で確認できます。',
    alternates: { canonical: '/trainers' },
};

export default async function TrainersPage() {
    const directory = await getDataEntityDirectory('trainer', {
        limit: 80,
        indexableOnly: true,
    });
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: '調教師データ', url: 'https://uma-free.com/trainers' },
                ]}
            />
            <Breadcrumb />
            <DataDirectoryView
                entityType="trainer"
                directory={directory ?? {
                    entity_type: 'trainer',
                    total: 0,
                    limit: 80,
                    offset: 0,
                    items: [],
                }}
            />
        </>
    );
}
