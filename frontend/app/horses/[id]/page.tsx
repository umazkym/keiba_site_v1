import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema, DatasetSchema } from '@/components/StructuredData';
import { DataEntityDetailView } from '@/components/DataEntityDetailView';
import { getDataEntityDetail } from '@/lib/api';


export const revalidate = 3600;

type Props = {
    params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const detail = await getDataEntityDetail('horse', params.id);
    if (!detail) {
        return { title: '競走馬データ', robots: { index: false, follow: true } };
    }
    return {
        title: `${detail.entity.name} 成績・得意条件・AI偏差値履歴`,
        description: `${detail.entity.name}の近走、コース・距離・馬場状態別成績、AI偏差値履歴を集計。対象${detail.entity.sample_size}走。`,
        alternates: { canonical: detail.entity.url },
        robots: { index: detail.entity.indexable, follow: true },
    };
}

export default async function HorseDetailPage({ params }: Props) {
    const detail = await getDataEntityDetail('horse', params.id);
    if (!detail) notFound();
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: '競走馬データ', url: 'https://uma-free.com/horses' },
                    { name: detail.entity.name, url: `https://uma-free.com${detail.entity.url}` },
                ]}
            />
            <DatasetSchema
                name={`${detail.entity.name} 競走成績`}
                description={`${detail.entity.name}の直近成績と、コース・距離・馬場状態ごとの成績、AI偏差値の推移を、対象走数と集計期間とともに確認できるUMA-FREEの競走馬データセットです。`}
                url={`https://uma-free.com${detail.entity.url}`}
                startDate={detail.recent_runs.at(-1)?.race_date}
                endDate={detail.entity.last_race_date}
                measurementTechnique="過去レース結果の集計"
            />
            <Breadcrumb />
            <DataEntityDetailView detail={detail} entityType="horse" />
        </>
    );
}
