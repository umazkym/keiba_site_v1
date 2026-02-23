import { MetadataRoute } from 'next'
import { getAllArticles } from '@/lib/articles';
import { getAllRaceUrls } from '@/lib/api';

const BASE_URL = 'https://uma-free.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // 記事データを取得
    const articles = getAllArticles();

    // 静的ルートごとに適切な更新頻度と優先度を設定
    const siteLastModified = new Date('2026-02-16');
    const staticRouteConfig: Record<string, { changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number }> = {
        '': { changeFrequency: 'daily', priority: 1.0 },
        '/about': { changeFrequency: 'monthly', priority: 0.7 },
        '/about-ai': { changeFrequency: 'monthly', priority: 0.8 },
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

    // 全てのレースページをサイトマップに含める（ロングテールSEO維持のため）
    const allRaces = await getAllRaceUrls();
    const raceRoutes = allRaces.map((race) => ({
        // クエリパラメータ順序を統一: race -> venue
        url: `${BASE_URL}/races/${race.race_date}?race=${race.race_number}&venue=${encodeURIComponent(race.venue_name)}`,
        lastModified: new Date(race.race_date),
        changeFrequency: 'daily' as const,
        priority: 0.6,
    }));

    return [...staticRoutes, ...articleRoutes, ...raceRoutes];
}
