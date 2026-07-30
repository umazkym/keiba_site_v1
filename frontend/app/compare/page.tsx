import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import HorseCompareClient from './HorseCompareClient';


export const metadata: Metadata = {
    title: '競走馬比較｜近走・得意条件・AI偏差値',
    description: '最大5頭の競走馬について、過去成績、勝率、3着以内率、得意コース、AI偏差値履歴を同じ基準で比較できます。',

    robots: { index: false, follow: true },
    alternates: { canonical: '/compare' },
};

export default function HorseComparePage() {
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: '競走馬比較', url: 'https://uma-free.com/compare' },
                ]}
            />
            <Breadcrumb />
            <HorseCompareClient />
        </>
    );
}
