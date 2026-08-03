import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { DataEntityDetailView } from '@/components/DataEntityDetailView';
import { getDataEntityDetail } from '@/lib/api';


export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

const getTrainerDetail = cache((id: string) => getDataEntityDetail('trainer', id));

type Props = {
    params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const detail = await getTrainerDetail(params.id);
    if (!detail) {
        return { title: '調教師データ', robots: { index: false, follow: false } };
    }
    return {
        title: `${detail.entity.name} 調教師｜競馬場・距離・馬場別成績`,
        description: `${detail.entity.name}調教師の管理馬成績を条件別に集計。対象${detail.entity.sample_size}走。`,
        alternates: { canonical: detail.entity.url },
        robots: { index: detail.entity.indexable, follow: detail.entity.indexable },
    };
}

export default async function TrainerDetailPage({ params }: Props) {
    const detail = await getTrainerDetail(params.id);
    if (!detail) notFound();
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: '調教師データ', url: 'https://uma-free.com/trainers' },
                    { name: detail.entity.name, url: `https://uma-free.com${detail.entity.url}` },
                ]}
            />
            <Breadcrumb />
            <DataEntityDetailView detail={detail} entityType="trainer" />
        </>
    );
}
