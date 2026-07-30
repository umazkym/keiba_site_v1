import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import MyDataClient from './MyDataClient';


export const metadata: Metadata = {
    title: 'マイデータ｜保存した馬・騎手・コース',
    description: '保存した競走馬、騎手、調教師、コース、閲覧履歴、比較中の馬をこの端末で確認できます。',
    robots: { index: false, follow: true },
    alternates: { canonical: '/my-data' },
};

export default function MyDataPage() {
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: 'マイデータ', url: 'https://uma-free.com/my-data' },
                ]}
            />
            <Breadcrumb />
            <MyDataClient />
        </>
    );
}
