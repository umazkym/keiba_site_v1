import { MetadataRoute } from 'next'
import { getAllArticles } from '@/lib/articles';
import { getAllRaceUrls } from '@/lib/api';
import { courseProfiles, jockeyProfiles } from '@/lib/growth-content';

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
        '/courses': { changeFrequency: 'weekly', priority: 0.8 },
        '/grade-races': { changeFrequency: 'weekly', priority: 0.8 },
        '/jockeys': { changeFrequency: 'weekly', priority: 0.8 },
        '/keiba-data': { changeFrequency: 'weekly', priority: 0.9 },
        '/keiba-data/horse-weight': { changeFrequency: 'monthly', priority: 0.8 },
        '/keiba-data/site-selection': { changeFrequency: 'monthly', priority: 0.7 },
        '/keiba-data/track-condition': { changeFrequency: 'monthly', priority: 0.8 },
        '/privacy': { changeFrequency: 'monthly', priority: 0.5 },
        '/results/accuracy': { changeFrequency: 'weekly', priority: 0.8 },
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

    const courseRoutes = courseProfiles.map((course) => ({
        url: `${BASE_URL}/courses/${course.venue}/${course.course}`,
        lastModified: siteLastModified,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
    }));

    const jockeyRoutes = jockeyProfiles.map((jockey) => ({
        url: `${BASE_URL}/jockeys/${jockey.slug}`,
        lastModified: siteLastModified,
        changeFrequency: 'monthly' as const,
        priority: 0.75,
    }));

    // ▼▼▼▼▼【修正2】レースURLを直近60日分のみに絞る▼▼▼▼▼
    // 旧: 全過去レースURL（数万件）をサイトマップに掲載
    //   → Googlebotが数万URLを順繰りに巡回。全てSSRでOriginから生成 → 10GB即消滅。
    // 新: 直近60日間のレースのみ掲載。
    //   - 古いレースページはGoogleがすでにインデックス済みのため削除しても問題なし。
    //   - サイトマップのXMLサイズが大幅に減少し、クロールコストを劇的に削減。
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
    const allRaces = await getAllRaceUrls();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);

    const raceDateRoutes = Array.from(
        new Set(
            allRaces
                .filter((race) => new Date(race.race_date) >= cutoffDate)
                .map((race) => race.race_date)
        )
    ).map((raceDate) => ({
        url: `${BASE_URL}/races/${raceDate}`,
        lastModified: new Date(raceDate),
        changeFrequency: 'daily' as const,
        priority: 0.65,
    }));

    return [...staticRoutes, ...articleRoutes, ...courseRoutes, ...jockeyRoutes, ...raceDateRoutes];
}
