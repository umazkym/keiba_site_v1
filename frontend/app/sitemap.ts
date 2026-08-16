import { MetadataRoute } from 'next'
import { getAllRaceUrls, getWeeklyGradeRaces } from '@/lib/api';
import { gradeRaceProfiles } from '@/lib/grade-race-content';
import { courseProfiles, jockeyProfiles } from '@/lib/growth-content';
import { getRaceDetailPath, getRaceIndexPolicy } from '@/lib/race-url';
import { getUniqueCategories } from '@/lib/articles';

// ▼▼▼▼▼【修正1】revalidate を追加▼▼▼▼▼
// 旧: 指定なし → Googlebotがアクセスするたびに毎回Serverless関数が起動し、
//     APIから全レースURLを取得して1MB超のXMLを新規生成していた。
// 新: 86400秒（24時間）に1回だけ再生成。それ以外はVercel CDNキャッシュから配信。
// ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
export const revalidate = 86400;

const BASE_URL = 'https://uma-free.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteLastModified = new Date();

    const staticRouteConfig: Record<string, { changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number }> = {
        '': { changeFrequency: 'daily', priority: 1.0 },
        '/about': { changeFrequency: 'monthly', priority: 0.7 },
        '/about-ai': { changeFrequency: 'monthly', priority: 0.8 },
        '/advertising': { changeFrequency: 'monthly', priority: 0.5 },
        '/contact': { changeFrequency: 'monthly', priority: 0.6 },
        '/grade-races': { changeFrequency: 'weekly', priority: 0.8 },
        '/keiba-data': { changeFrequency: 'daily', priority: 0.9 },
        '/keiba-data/track-condition': { changeFrequency: 'monthly', priority: 0.68 },
        '/keiba-data/horse-weight': { changeFrequency: 'monthly', priority: 0.68 },
        '/keiba-data/site-selection': { changeFrequency: 'monthly', priority: 0.62 },
        '/horses': { changeFrequency: 'daily', priority: 0.82 },
        '/courses': { changeFrequency: 'weekly', priority: 0.75 },
        '/jockeys': { changeFrequency: 'weekly', priority: 0.75 },
        '/trainers': { changeFrequency: 'weekly', priority: 0.75 },
        '/results/accuracy': { changeFrequency: 'weekly', priority: 0.8 },
        '/sitemap': { changeFrequency: 'monthly', priority: 0.5 },
        '/privacy': { changeFrequency: 'monthly', priority: 0.5 },
        '/articles': { changeFrequency: 'weekly', priority: 0.9 },
        '/terms': { changeFrequency: 'monthly', priority: 0.5 },
        '/faq': { changeFrequency: 'monthly', priority: 0.7 },
    };

    const staticRoutes = Object.entries(staticRouteConfig).map(([route, config]) => ({
        url: `${BASE_URL}${route}`,
        lastModified: siteLastModified,
        changeFrequency: config.changeFrequency,
        priority: config.priority,
    }));

    // 記事カテゴリ一覧は実ルート化した /articles/category/{カテゴリ} を掲載する。
    // 記事本体URLは sitemap-articles.xml が担当するため、ここには載せない。
    const articleCategoryRoutes = getUniqueCategories().map((category) => ({
        url: `${BASE_URL}/articles/category/${encodeURIComponent(category)}`,
        lastModified: siteLastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.75,
    }));

    const gradeRaceHubRoutes = gradeRaceProfiles.map((race) => ({
        url: `${BASE_URL}/grade-races/${race.slug}`,
        lastModified: siteLastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.82,
    }));

    const jockeyHubRoutes = jockeyProfiles.map((jockey) => ({
        url: `${BASE_URL}/jockeys/${jockey.slug}`,
        lastModified: siteLastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.74,
    }));

    const courseHubRoutes = courseProfiles.map((course) => ({
        url: `${BASE_URL}/courses/${course.venue}/${course.course}`,
        lastModified: siteLastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.74,
    }));

    // レースURLは安定パスだけを掲載し、index対象も直近中心に絞る。
    // 古いクエリ付き詳細URLはミドルウェアで301され、サイトマップには載せない。
    const [allRaces, weeklyGradeRaces] = await Promise.all([
        getAllRaceUrls(),
        getWeeklyGradeRaces(),
    ]);

    const freshRaceRows = allRaces.filter((race) => getRaceIndexPolicy(race.race_date).index);
    const sitemapRaceRows = [
        ...freshRaceRows,
        ...weeklyGradeRaces,
    ];

    const seenRaceUrls = new Set<string>();
    // 詳細URLは重賞中心に絞る。通常レースは日付ページから確認できる形にして、
    // botが多数のISR詳細ページを一気に生成する転送量リスクを抑える。
    const raceDetailRoutes = weeklyGradeRaces
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

    return [
        ...staticRoutes,
        ...articleCategoryRoutes,
        ...gradeRaceHubRoutes,
        ...jockeyHubRoutes,
        ...courseHubRoutes,
        ...raceDateRoutes,
        ...raceDetailRoutes,
    ];
}
