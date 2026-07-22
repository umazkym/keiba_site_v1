import { MetadataRoute } from 'next';
import { getCanonicalArticleSitemapEntries } from '@/lib/article-sitemap';

const BASE_URL = 'https://uma-free.com';

export const revalidate = 86400;

export default function sitemapArticles(): MetadataRoute.Sitemap {
    const articles = getCanonicalArticleSitemapEntries();

    return articles.map((article) => ({
        url: `${BASE_URL}${article.path}`,
        lastModified: article.lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }));
}
