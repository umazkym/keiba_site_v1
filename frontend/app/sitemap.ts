import { MetadataRoute } from 'next'
import { getAllArticles } from '@/lib/articles';

const BASE_URL = 'https://uma-free.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // 記事データを取得
    const articles = getAllArticles();

    const staticRoutes = [
        '',
        '/about',
        '/advertising',
        '/contact',
        '/privacy',
        '/articles',
        '/search',
        '/terms',
        '/faq',
    ].map((route) => ({
        url: `${BASE_URL}${route}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: route === '' ? 1.0 : 0.8,
    }));

    // 記事ページをサイトマップに追加
    const articleRoutes = articles.map((article) => ({
        url: `${BASE_URL}/articles/${article.slug}`,
        lastModified: new Date(article.date),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }));

    try {
        // APIから全レースのURL情報を取得
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/predictions/sitemap/all-race-urls`);
        if (!response.ok) {
            console.error(`Sitemap fetch failed with status: ${response.status}`);
            return staticRoutes;
        }

        type RaceUrlInfo = {
            race_date: string;
            venue_name: string;
            race_number: number;
        };

        const races: RaceUrlInfo[] = await response.json();

        // ★★★【重要な修正】重複ページ問題を解決するため、クエリパラメータ付きのレースページを削除 ★★★
        // 日付ページのみをサイトマップに含めることで、Googleに正規URLを明確に示します
        const datePages = [...new Set(races.map(race => race.race_date))];

        // 日付ページのルート（優先度: 高）
        // クロールバジェット節約のため、直近60日間の日付ページのみをサイトマップに含める
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

        const recentDatePages = datePages.filter(date => date >= sixtyDaysAgoStr);

        const datePageRoutes = recentDatePages.map(date => ({
             url: `${BASE_URL}/races/${date}`,
             lastModified: new Date(),
             changeFrequency: 'daily' as const,
             priority: 0.9,
        }));

        return [
            {
                url: BASE_URL,
                lastModified: new Date(),
                changeFrequency: 'daily' as const,
                priority: 1.0,
            },
            ...staticRoutes.filter(r => r.url !== BASE_URL),
            ...articleRoutes,
            ...datePageRoutes,
            // ★★★ racePageRoutesを削除（重複ページ問題の解決） ★★★
        ];

    } catch (error) {
        console.error('Error fetching all race URLs for sitemap:', error);
        return [
            {
                url: BASE_URL,
                lastModified: new Date(),
                changeFrequency: 'daily' as const,
                priority: 1.0,
            },
            ...staticRoutes.filter(r => r.url !== BASE_URL),
            ...articleRoutes,
        ];
    }
}
