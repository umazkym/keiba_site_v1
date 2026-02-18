import { MetadataRoute } from 'next'
import { getAllArticles } from '@/lib/articles';

const BASE_URL = 'https://uma-free.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // 記事データを取得
    const articles = getAllArticles();

    // 静的ルートごとに適切な更新頻度と優先度を設定
    const siteLastModified = new Date('2026-02-16');
    const staticRouteConfig: Record<string, { changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number }> = {
        '': { changeFrequency: 'daily', priority: 1.0 },
        '/about': { changeFrequency: 'monthly', priority: 0.7 },
        '/advertising': { changeFrequency: 'monthly', priority: 0.5 },
        '/contact': { changeFrequency: 'monthly', priority: 0.6 },
        '/privacy': { changeFrequency: 'monthly', priority: 0.5 },
        '/articles': { changeFrequency: 'weekly', priority: 0.9 },
        '/search': { changeFrequency: 'weekly', priority: 0.5 },
        '/terms': { changeFrequency: 'monthly', priority: 0.5 },
        '/faq': { changeFrequency: 'monthly', priority: 0.7 },
    };

    const staticRoutes = Object.entries(staticRouteConfig).map(([route, config]) => ({
        url: `${BASE_URL}${route}`,
        lastModified: siteLastModified,
        changeFrequency: config.changeFrequency,
        priority: config.priority,
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
            console.warn('NEXT_PUBLIC_API_URL is not set. Generating sitemap without race data.');
            return [...staticRoutes, ...articleRoutes];
        }
        const response = await fetch(`${apiUrl}/api/v1/predictions/sitemap/all-race-urls`);
        if (!response.ok) {
            console.error(`Sitemap fetch failed with status: ${response.status}`);
            return [...staticRoutes, ...articleRoutes];
        }

        type RaceUrlInfo = {
            race_date: string;
            venue_name: string;
            race_number: number;
        };

        const races: RaceUrlInfo[] = await response.json();

        // 日付ごとにレースをグループ化し、各日付の最新レースのみをサイトマップに含める
        const datePages = [...new Set(races.map(race => race.race_date))];

        // 日付ページのルート（優先度: 高）
        const datePageRoutes = datePages.map(date => ({
            url: `${BASE_URL}/races/${date}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.9,
        }));

        // 個別レースページのルート（優先度: 中）
        // クロールバジェット節約のため、過去30日間+未来14日間のレースのみをサイトマップに含める
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

        const fourteenDaysLater = new Date();
        fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14);
        const fourteenDaysLaterStr = fourteenDaysLater.toISOString().split('T')[0];

        const recentRaces = races.filter(race =>
            race.race_date >= thirtyDaysAgoStr && race.race_date <= fourteenDaysLaterStr
        );

        const racePageRoutes = recentRaces.map((race) => ({
            // URLパラメータの順序を統一（'race' → 'venue'）
            // Next.jsが自動的にXMLエスケープを行うため、通常の&を使用
            url: `${BASE_URL}/races/${race.race_date}?race=${race.race_number}&venue=${encodeURIComponent(race.venue_name)}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
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
            ...racePageRoutes
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
