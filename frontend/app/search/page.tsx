import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchPageClient, { type SearchIndexItem } from './SearchPageClient';
import { Breadcrumb } from '@/components/Breadcrumb';
import { AdUnit } from '@/components/AdUnit';
import { getAllArticlesMeta } from '@/lib/articles';
import { courseProfiles, dataHubLinks, jockeyProfiles } from '@/lib/growth-content';
import { gradeRaceProfiles } from '@/lib/grade-race-content';

export const metadata: Metadata = {
    title: 'サイト内検索',
    description: 'UMA-FREEサイト内の記事やページを検索します。AI競馬分析、レース情報、よくある質問などを検索してみてください。',
    robots: 'index, follow',
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
            title: 'AI予想の成績',
            description: 'AI偏差値の直近成績、条件別の傾向、評価が届かなかったレースを確認できます。',
            url: '/results/accuracy',
            keywords: ['AI予想成績', '的中率', '複勝率', 'AI偏差値', '振り返り'],
        },
        {
            type: 'page',
            title: '競馬データの見方',
            description: '馬場状態、馬体重、騎手、コース、AI偏差値をレース前に見る順番で整理しています。',
            url: '/keiba-data',
            keywords: ['データの見方', '馬場', '馬体重', '枠順', '騎手', 'コース'],
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

    const dataPages = dataHubLinks.map((item) => ({
        type: 'page' as const,
        title: item.label,
        description: item.description,
        url: item.href,
        keywords: [item.label, '競馬データ', '無料'],
    }));

    const courses = courseProfiles.map((course) => ({
        type: 'course' as const,
        title: course.title,
        description: course.metaDescription,
        url: `/courses/${course.venue}/${course.course}`,
        keywords: [course.venueName, course.courseName, course.course, '枠順', '脚質', 'コースデータ'],
    }));

    const jockeys = jockeyProfiles.map((jockey) => ({
        type: 'jockey' as const,
        title: jockey.searchTitle,
        description: jockey.metaDescription,
        url: `/jockeys/${jockey.slug}`,
        keywords: [jockey.name, ...jockey.strengths, '騎手', '得意コース'],
    }));

    const gradeRaces = gradeRaceProfiles.map((race) => ({
        type: 'grade' as const,
        title: `${race.name} ${race.grade} データ分析`,
        description: race.summary,
        url: `/grade-races/${race.slug}`,
        keywords: [race.name, race.grade, race.venue, race.course, '重賞', 'G1', '枠順'],
    }));

    return [...staticPages, ...dataPages, ...courses, ...jockeys, ...gradeRaces, ...articles];
}

export default function SearchPage() {
    const searchIndex = buildSearchIndex();

    return (
        <>
            <Breadcrumb />
            <Suspense fallback={<div className="container mx-auto px-4 py-8"><div className="max-w-3xl mx-auto"><div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div></div></div>}>
                <SearchPageClient searchIndex={searchIndex} />
            </Suspense>
            {/* ★ 検索結果閲覧後の自然な位置に広告配置 */}
            <div className="max-w-3xl mx-auto px-4 pb-8">
                <AdUnit slot="9407670747" placement="inline" />
            </div>
        </>
    );
}

