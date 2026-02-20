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


    // ▼▼▼▼▼【AdSense審査対策: レースページをサイトマップから除外】▼▼▼▼▼
    // テンプレート的なデータページがサイト全体の品質評価を下げるのを防ぐため、
    // AdSense承認まで全レースページをサイトマップから除外する。
    // ※ AdSense承認後にレースページのルートを復活させること
    return [...staticRoutes, ...articleRoutes];
    // ▲▲▲▲▲【AdSense審査対策ここまで】▲▲▲▲▲
}
