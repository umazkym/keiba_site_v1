import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchPageClient, { type SearchIndexItem } from './SearchPageClient';
import { Breadcrumb } from '@/components/Breadcrumb';
import { AdUnit } from '@/components/AdUnit';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { getAllArticlesMeta } from '@/lib/articles';
import { gradeRaceProfiles } from '@/lib/grade-race-content';
import {
    getCourseArticleArchiveGroups,
    getGradeRaceArticleArchiveGroups,
    getJockeyArticleArchiveGroups,
    getRaceArticleArchiveGroups,
} from '@/lib/article-archives';
import { shouldSuppressAdsInDevelopment } from '@/lib/ad-config';

export const metadata: Metadata = {
    title: 'サイト内検索',
    description: '競走馬、騎手、調教師、コース、重賞、記事を横断検索できます。',
    robots: 'noindex, follow',
    openGraph: {
        title: 'サイト内検索',
        description: 'UMA-FREEサイト内の記事やレース情報を検索。AI競馬分析データ、初心者ガイド、FAQ等を検索できます。',
    },
    alternates: {
        canonical: '/search',
    },
};

function buildSearchIndex(): SearchIndexItem[] {
    const articles = getAllArticlesMeta().map((article) => ({
        type: 'article' as const,
        title: article.title,
        description: article.description || `${article.category}の記事です。`,
        url: `/articles/${article.slug}`,
        keywords: [
            article.category,
            article.targetKeyword ?? '',
            article.themeCluster ?? '',
            ...article.tags,
            ...article.keywords,
        ].filter(Boolean),
    }));

    const staticPages: SearchIndexItem[] = [
        {
            type: 'page',
            title: '本日のAI競馬データ分析',
            description: '中央・地方競馬の当日レースをAI偏差値、脚質予測、枠順傾向で確認できます。',
            url: '/races/today',
            keywords: ['本日', '今日', 'AI予想', 'レース', '出馬表', '偏差値'],
        },
        {
            type: 'page',
            title: '競馬データベース',
            description: '馬、騎手、調教師、コース、AI予測成績を横断して確認できます。',
            url: '/keiba-data',
            keywords: ['データベース', '競走馬', '騎手', '調教師', 'コース'],
        },
        {
            type: 'page',
            title: '競走馬比較',
            description: '2〜5頭の近走、条件別成績、AI偏差値履歴を比較します。',

            url: '/compare',
            keywords: ['馬比較', '競走馬', '近走', '比較'],
        },
        {
            type: 'page',
            title: '運営者情報・このサイトについて',
            description: 'UMA-FREEの運営方針、公開データ、注意事項、問い合わせ先を確認できます。',
            url: '/about',
            keywords: ['運営者', 'サイトについて', '信頼性', 'お問い合わせ'],
        },
        {
            type: 'page',
            title: 'よくある質問',
            description: 'UMA-FREEの使い方、AI予測、馬券購入、トラブル時の確認事項をまとめています。',
            url: '/faq',
            keywords: ['FAQ', '使い方', '質問', 'AI予測'],
        },
    ];

    const gradeRaces = gradeRaceProfiles.map((race) => ({
        type: 'grade' as const,
        title: `${race.name} ${race.grade} データ分析`,
        description: race.summary,
        url: `/grade-races/${race.slug}`,
        keywords: [race.name, race.grade, race.venue, race.course, '重賞', 'G1', '枠順'],
    }));

    const archivePages: SearchIndexItem[] = [
        ...getGradeRaceArticleArchiveGroups().map((group) => ({
            type: 'grade' as const,
            title: `${group.title}の記事アーカイブ`,
            description: group.description,
            url: group.href,
            keywords: [group.title, group.subtitle, '重賞', '記事', ...group.badges],
        })),
        ...getRaceArticleArchiveGroups().map((group) => ({
            type: 'race' as const,
            title: `${group.title}の記事`,
            description: group.description,
            url: group.href,
            keywords: [group.title, group.subtitle, 'レース', '記事', ...group.badges],
        })),
        ...getJockeyArticleArchiveGroups().map((group) => ({
            type: 'jockey' as const,
            title: `${group.title}の記事アーカイブ`,
            description: group.description,
            url: group.href,
            keywords: [group.title, group.subtitle, '騎手', '記事', ...group.badges],
        })),
        ...getCourseArticleArchiveGroups().map((group) => ({
            type: 'course' as const,
            title: `${group.title}の記事アーカイブ`,
            description: group.description,
            url: group.href,
            keywords: [group.title, group.subtitle, 'コース', '記事', ...group.badges],
        })),
    ];

    return [...staticPages, ...gradeRaces, ...archivePages, ...articles];
}

export default function SearchPage() {
    const searchIndex = buildSearchIndex();
    const shouldRenderAds = !shouldSuppressAdsInDevelopment;

    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: 'ホーム', url: 'https://uma-free.com' },
                    { name: 'サイト内検索', url: 'https://uma-free.com/search' },
                ]}
            />
            <Breadcrumb />
            <Suspense fallback={<div className="container mx-auto px-4 py-8"><div className="max-w-3xl mx-auto"><div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div></div></div>}>
                <SearchPageClient searchIndex={searchIndex} />
            </Suspense>
            {/* ★ 検索結果閲覧後の自然な位置に広告配置 */}
            {shouldRenderAds && (
                <div className="max-w-3xl mx-auto px-4 pb-8">
                    <AdUnit slot="9407670747" placement="inline" />
                </div>
            )}
        </>
    );
}

