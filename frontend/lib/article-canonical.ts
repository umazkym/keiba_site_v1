import canonicalOverrides from '@/content/reference/grade-race-canonical-overrides.json';

/**
 * まとめページ（コース・騎手・レース・重賞）は記事の一覧で、記事の本文と同じではない。
 * 古い記事の canonical_path に残っていても、canonical には使わない（2026-10-17）。
 */
const ARCHIVE_CANONICAL_PATTERN = /^\/articles\/(courses|jockeys|races|grade-races)\//;

/**
 * canonical_path（明示指定）→ canonical_slug（明示指定）→ 本人slug の優先順で
 * 記事の正規パスを解決する。entity_path は分類用であり canonical には使わない。
 */
export function resolveArticleCanonicalPath(
    article: { canonicalPath?: string; canonicalSlug?: string },
    fallbackSlug: string,
): string {
    if (
        article.canonicalPath
        && article.canonicalPath.startsWith('/')
        && !ARCHIVE_CANONICAL_PATTERN.test(article.canonicalPath)
    ) {
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
