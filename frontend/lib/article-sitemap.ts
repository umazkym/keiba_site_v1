import { getArticleArchiveGroupForArticle } from '@/lib/article-archives';
import { getAllArticles } from '@/lib/articles';

export type CanonicalArticleSitemapEntry = {
    path: string;
    lastModified: Date;
};

const REDIRECTED_ARTICLE_PATHS = new Set([
    '/articles/courses/hakodate/turf-1200m',
]);

const resolveCanonicalPath = (article: ReturnType<typeof getAllArticles>[number]) => {
    const archiveGroup = getArticleArchiveGroupForArticle(article);
    return article.canonicalPath
        || archiveGroup?.href
        || `/articles/${article.canonicalSlug || article.slug}`;
};

/** 記事数ではなく、実際に自己canonicalとなる公開URLを一度だけ返す。 */
export function getCanonicalArticleSitemapEntries(): CanonicalArticleSitemapEntry[] {
    const canonicalEntries = new Map<string, Date>();

    for (const article of getAllArticles()) {
        const canonicalPath = resolveCanonicalPath(article);
        // 記事サイトマップには記事配下の自己canonicalだけを含める。
        // コース・騎手などのプロフィールへcanonicalを移した記事は、通常サイトマップ側へ任せる。
        if (!canonicalPath.startsWith('/articles/') || REDIRECTED_ARTICLE_PATHS.has(canonicalPath)) continue;

        const lastModified = new Date(article.lastUpdated || article.date);
        const current = canonicalEntries.get(canonicalPath);
        if (!current || lastModified > current) {
            canonicalEntries.set(canonicalPath, lastModified);
        }
    }

    return Array.from(canonicalEntries, ([path, lastModified]) => ({ path, lastModified }))
        .sort((left, right) => left.path.localeCompare(right.path));
}
