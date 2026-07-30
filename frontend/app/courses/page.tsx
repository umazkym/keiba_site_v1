import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { DataDirectoryView } from '@/components/DataDirectoryView';
import { getDataEntityDirectory } from '@/lib/api';


export const revalidate = 3600;

export const metadata: Metadata = {
    title: '競馬場・コース別データ｜枠順・脚質・馬場傾向',
    description: '中央・地方の競馬場と距離ごとに、枠順、馬番、脚質、馬場状態、騎手、調教師成績を無料で確認できます。',
    alternates: { canonical: '/courses' },
};

export default async function CoursesPage() {
    const directory = await getDataEntityDirectory('course', {
        limit: 100,
        indexableOnly: true,
    });
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: 'コース別データ', url: 'https://uma-free.com/courses' },
                ]}
            />
            <Breadcrumb />
            <DataDirectoryView
                entityType="course"
                directory={directory ?? {
                    entity_type: 'course',
                    total: 0,
                    limit: 100,
                    offset: 0,
                    items: [],
                }}
            />
        </>
    );
}
