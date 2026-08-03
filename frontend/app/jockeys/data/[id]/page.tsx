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

const getJockeyDetail = cache((id: string) => getDataEntityDetail('jockey', id));

type Props = {
    params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const detail = await getJockeyDetail(params.id);
    if (!detail) {
        return { title: '騎手データ', robots: { index: false, follow: false } };
    }
    return {
        title: `${detail.entity.name} 騎手｜得意コース・距離・馬場別成績`,
        description: `${detail.entity.name}騎手の競馬場、距離、馬場状態、人気別成績を集計。対象${detail.entity.sample_size}走。`,
        alternates: { canonical: detail.entity.url },
        robots: { index: detail.entity.indexable, follow: detail.entity.indexable },
    };
}

export default async function JockeyDataDetailPage({ params }: Props) {
    const detail = await getJockeyDetail(params.id);
    if (!detail) notFound();
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: '騎手データ', url: 'https://uma-free.com/jockeys' },
                    { name: detail.entity.name, url: `https://uma-free.com${detail.entity.url}` },
                ]}
            />
            <Breadcrumb />
            <DataEntityDetailView detail={detail} entityType="jockey" />
        </>
    );
}
