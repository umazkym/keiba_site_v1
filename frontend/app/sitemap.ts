import { MetadataRoute } from 'next'

const BASE_URL = 'https://uma-free.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticRoutes = [
        '',
        '/about',
        '/advertising',
        '/contact',
        '/privacy',
        '/articles',
        '/search',
    ].map((route) => ({
        url: `${BASE_URL}${route}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
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

        // 取得したデータから個別レースページのURLを生成
        const racePageRoutes = races.map((race) => ({
            // ▼▼▼▼▼【修正点】URL内の '&' をXMLエンティティ '&amp;' に置換 ▼▼▼▼▼
            url: `${BASE_URL}/races/${race.race_date}?venue=${encodeURIComponent(race.venue_name)}&race=${race.race_number}`.replace(/&/g, '&amp;'),
            // ▲▲▲▲▲ 修正ここまで ▲▲▲▲▲
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.9,
        }));

        const datePages = [...new Set(races.map(race => race.race_date))];
        const datePageRoutes = datePages.map(date => ({
             url: `${BASE_URL}/races/${date}`,
             lastModified: new Date(),
             changeFrequency: 'daily' as const,
             priority: 1.0,
        }));

        return [
            {
                url: BASE_URL,
                lastModified: new Date(),
                changeFrequency: 'daily' as const,
                priority: 1.0,
            },
            ...staticRoutes.filter(r => r.url !== BASE_URL),
            ...datePageRoutes,
            ...racePageRoutes
        ];

    } catch (error) {
        console.error('Error fetching all race URLs for sitemap:', error);
        return staticRoutes;
    }
}
