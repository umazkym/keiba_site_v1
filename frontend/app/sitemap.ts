import { MetadataRoute } from 'next'
import { getAllArticles } from '@/lib/articles';
import { getAllRaceUrls } from '@/lib/api';

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

    const raceRoutes = allRaces
        .filter((race) => new Date(race.race_date) >= cutoffDate)
        .map((race) => ({
            // ▼▼▼▼▼【修正3】&amp; バグを修正▼▼▼▼▼
            // 旧: `...?race=${race.race_number}&amp;venue=...`
            //   → Next.jsがXML出力時に & を自動でエスケープするため、
            //     &amp; が &amp;amp; に二重エスケープされる致命的バグ。
            //     GooglebotはURL中の &amp; をそのまま解釈するため、正しいページに到達できず404。
            // 新: & を使用する（Next.jsが自動でXMLエスケープしてくれる）
            // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
            url: `${BASE_URL}/races/${race.race_date}?race=${race.race_number}&venue=${encodeURIComponent(race.venue_name)}`,
            lastModified: new Date(race.race_date),
            changeFrequency: 'daily' as const,
            priority: 0.6,
        }));

    return [...staticRoutes, ...articleRoutes, ...raceRoutes];
}
