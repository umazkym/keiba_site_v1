import { MetadataRoute } from 'next'
import { getAllArticles } from '@/lib/articles';
import { getAllRaceUrls, getWeeklyGradeRaces } from '@/lib/api';
import { gradeRaceProfiles } from '@/lib/grade-race-content';
import { getRaceDetailPath, getRaceIndexPolicy } from '@/lib/race-url';

// ▼▼▼▼▼【修正1】revalidate を追加▼▼▼▼▼
// 旧: 指定なし → Googlebotがアクセスするたびに毎回Serverless関数が起動し、
//     APIから全レースURLを取得して1MB超のXMLを新規生成していた。
// 新: 86400秒（24時間）に1回だけ再生成。それ以外はVercel CDNキャッシュから配信。
// ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
export const revalidate = 86400;

const BASE_URL = 'https://uma-free.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const articles = getAllArticles();
    const siteLastModified = new Date();

    const staticRouteConfig: Record<string, { changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number }> = {
        '': { changeFrequency: 'daily', priority: 1.0 },
        '/about': { changeFrequency: 'monthly', priority: 0.7 },
        '/about-ai': { changeFrequency: 'monthly', priority: 0.8 },
        '/advertising': { changeFrequency: 'monthly', priority: 0.5 },
        '/contact': { changeFrequency: 'monthly', priority: 0.6 },
        '/grade-races': { changeFrequency: 'weekly', priority: 0.8 },
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

    const articleRoutes = articles.map((article) => ({
        url: `${BASE_URL}/articles/${article.slug}`,
        lastModified: new Date(article.date),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }));



    const gradeRaceHubRoutes = gradeRaceProfiles.map((race) => ({
        url: `${BASE_URL}/grade-races/${race.slug}`,
        lastModified: siteLastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.82,
    }));

    // レースURLは安定パスだけを掲載し、index対象も直近中心に絞る。
    // 古いクエリ付き詳細URLはミドルウェアで301され、サイトマップには載せない。
    const [allRaces, weeklyGradeRaces] = await Promise.all([
        getAllRaceUrls(),
        getWeeklyGradeRaces(),
    ]);

    const sitemapRaceRows = [
        ...allRaces.filter((race) => getRaceIndexPolicy(race.race_date).index),
        ...weeklyGradeRaces,
    ];

    const seenRaceUrls = new Set<string>();
    const raceDetailRoutes = sitemapRaceRows
        .map((race) => ({
            race,
            path: getRaceDetailPath(race.race_date, race.venue_name, race.race_number),
        }))
        .filter(({ path }) => {
            if (seenRaceUrls.has(path)) return false;
            seenRaceUrls.add(path);
            return true;
        })
        .map(({ race, path }) => ({
            url: `${BASE_URL}${path}`,
            lastModified: new Date(race.race_date),
            changeFrequency: 'daily' as const,
            priority: 0.7,
        }));

    const raceDateRoutes = Array.from(
        new Set(
            sitemapRaceRows
                .map((race) => race.race_date)
        )
    ).map((raceDate) => ({
        url: `${BASE_URL}/races/${raceDate}`,
        lastModified: new Date(raceDate),
        changeFrequency: 'daily' as const,
        priority: 0.65,
    }));

    return [...staticRoutes, ...articleRoutes, ...gradeRaceHubRoutes, ...raceDateRoutes, ...raceDetailRoutes];
}
