import canonicalOverrides from '@/content/reference/grade-race-canonical-overrides.json';

/**
 * canonical_path（明示指定）→ canonical_slug（明示指定）→ 本人slug の優先順で
 * 記事の正規パスを解決する。entity_path は分類用であり canonical には使わない。
 */
export function resolveArticleCanonicalPath(
    article: { canonicalPath?: string; canonicalSlug?: string },
    fallbackSlug: string,
): string {
    if (article.canonicalPath && article.canonicalPath.startsWith('/')) {
        return article.canonicalPath;
    }
    return `/articles/${article.canonicalSlug || fallbackSlug}`;
}

export const REDIRECTED_ARTICLE_PATHS = new Set([
    '/articles/courses/hakodate/turf-1200m',
    ...canonicalOverrides.flatMap((entry) =>
        entry.redirect_slugs.map((slug: string) => `/articles/${slug}`),
    ),
]);
