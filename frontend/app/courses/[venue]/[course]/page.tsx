import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema, DatasetSchema } from '@/components/StructuredData';
import { CourseDataDetailView } from '@/components/CourseDataDetailView';
import { EntityArticleSection } from '@/components/EntityArticleSection';
import { getCourseDataDetail } from '@/lib/api';
import { getArticlesByCourseEntity } from '@/lib/articles';
import { getCourseProfile } from '@/lib/growth-content';
import { getCourseArticleArchiveGroup } from '@/lib/article-archives';


export const revalidate = 86400;
export const dynamicParams = true;

const getCourseDetail = cache((venue: string, course: string) => (
    getCourseDataDetail(venue, course)
));

type Props = {
    params: { venue: string; course: string };
};

export function generateStaticParams() {
    // DB集計APIをVercelビルド中に19コース分同時実行しない。
    // 初回アクセス時に生成し、以後は24時間ISRキャッシュする。
    return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const detail = await getCourseDetail(params.venue, params.course);
    if (detail) {
        return {
            title: `${detail.entity.name} 枠順・脚質・騎手データ`,
            description: `${detail.entity.name}の枠番、馬番、位置取り、馬場状態、騎手、調教師別成績。直近5年の${detail.entity.sample_size}頭を集計。`,
            alternates: { canonical: detail.entity.url },
            robots: { index: detail.entity.indexable, follow: detail.entity.indexable },
        };
    }
    const profile = getCourseProfile(params.venue, params.course);
    if (!profile) {
        return { title: 'コースデータ', robots: { index: false, follow: false } };
    }
    return {
        title: profile.title,
        description: profile.metaDescription,
        alternates: { canonical: `/courses/${profile.venue}/${profile.course}` },
    };
}

export default async function CoursePage({ params }: Props) {
    const detail = await getCourseDetail(params.venue, params.course);
    if (detail) {
        const courseSlug = detail.entity.id.split('/')[1] ?? params.course;
        const articleArchive = getCourseArticleArchiveGroup(detail.venue_slug, courseSlug);
        const relatedArticleHref = articleArchive && articleArchive.articleCount > 0
            ? articleArchive.href
            : null;
        return (
            <>
                <BreadcrumbSchema
                    items={[
                        { name: 'ホーム', url: 'https://uma-free.com' },
                        { name: 'コース別データ', url: 'https://uma-free.com/courses' },
                        { name: detail.entity.name, url: `https://uma-free.com${detail.entity.url}` },
                    ]}
                />
                <DatasetSchema
                    name={`${detail.entity.name} 条件別成績`}
                    description={`${detail.entity.name}の過去レースを対象に、枠順・脚質・騎手・調教師ごとの成績を集計し、対象期間とサンプル数を確認できるUMA-FREEの競馬コースデータセットです。`}
                    url={`https://uma-free.com${detail.entity.url}`}
                    startDate={detail.analysis_start_date}
                    endDate={detail.analysis_end_date}
                    measurementTechnique="過去レース結果の集計"
                />
                <Breadcrumb />
                <CourseDataDetailView detail={detail} relatedArticleHref={relatedArticleHref} />
            </>
        );
    }

    const profile = getCourseProfile(params.venue, params.course);
    if (!profile) notFound();
    const courseArticles = getArticlesByCourseEntity(
        profile.venue,
        profile.course,
        profile.venueName,
        profile.courseName,
        10,
    );
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: 'コース別データ', url: 'https://uma-free.com/courses' },
                    { name: profile.courseName, url: `https://uma-free.com/courses/${profile.venue}/${profile.course}` },
                ]}
            />
            <Breadcrumb />
            <article className="mx-auto max-w-4xl px-3 pb-14 pt-4 sm:px-4">
                <header className="border-b border-slate-200 pb-5">
                    <p className="text-xs font-bold text-slate-500">コースデータ</p>
                    <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">{profile.title}</h1>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{profile.lead}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                        DB集計が利用できない場合の編集部ガイドを表示しています。
                    </p>
                </header>
                <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {profile.stats.map((stat) => (
                        <div key={stat.label} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                            <h2 className="font-black text-slate-900">{stat.label}：{stat.value}</h2>
                            <p className="mt-1 text-sm leading-7 text-slate-600">{stat.note}</p>
                        </div>
                    ))}
                </section>
                <section className="mt-6">
                    <h2 className="text-xl font-black text-slate-950">確認項目</h2>
                    <ol className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                        {profile.checkpoints.map((checkpoint, index) => (
                            <li key={checkpoint} className="px-4 py-3 text-sm leading-7 text-slate-600">
                                <strong className="text-slate-900">{index + 1}. </strong>{checkpoint}
                            </li>
                        ))}
                    </ol>
                </section>
                <EntityArticleSection
                    title={`${profile.venueName}${profile.courseName}の記事`}
                    description="このコース条件に紐づく記事を集約しています。"
                    articles={courseArticles}
                    archiveHref={courseArticles.length > 0 ? `/articles/courses/${profile.venue}/${profile.course}` : undefined}
                    archiveLabel="記事アーカイブ"
                />
                <Link prefetch={false} href="/races/today" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-primary">
                    今日のレースを確認
                </Link>
            </article>
        </>
    );
}
