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

        // 日付ごとにレースをグループ化
        const allDatePages = [...new Set(races.map(race => race.race_date))];

        // サイトマップに含める日付のフィルタリング（noindex対応）
        // 原則として過去日のレース結果はnoindexとするため、サイトマップにも不要。
        // ただしクローラの巡回遅延を考慮し「今日を基準に3日前」までの日付と未来の日付のみを含める
        const now = new Date();
        const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        const threeDaysAgo = new Date(jstNow);
        threeDaysAgo.setDate(jstNow.getDate() - 3);
        const thresholdDateStr = threeDaysAgo.toISOString().split('T')[0];

        const datePages = allDatePages.filter(date => date >= thresholdDateStr);

        // 日付ページのルート（優先度: 高）
        const datePageRoutes = datePages.map(date => ({
            url: `${BASE_URL}/races/${date}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.9,
        }));

        // 個別レースページ（クエリパラメータ付き）はサイトマップに含めない
        // 理由: XMLの&エスケープ問題が発生するため
        // Googleは日付ページ内のリンクから個別レースを発見できる

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
