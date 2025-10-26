import { MetadataRoute } from 'next';
import { getAllArticles } from '@/lib/articles';

const BASE_URL = 'https://uma-free.com';

export default function sitemapArticles(): MetadataRoute.Sitemap {
    const articles = getAllArticles();

    return articles.map((article) => ({
        url: `${BASE_URL}/articles/${article.slug}`,
        lastModified: new Date(article.date),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }));
}
