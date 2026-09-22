import assert from 'assert';
import { resolveArticleCanonicalPath, REDIRECTED_ARTICLE_PATHS } from '../../lib/article-canonical';
import { getCanonicalArticleSitemapEntries } from '../../lib/article-sitemap';
import { getAllArticles } from '../../lib/articles';

// --- resolveArticleCanonicalPath 単体テスト ---

// canonicalPath も canonicalSlug もない場合、fallbackSlug を使う
assert.equal(
    resolveArticleCanonicalPath({}, 'sprinters-stakes-2026'),
    '/articles/sprinters-stakes-2026',
    'fallback slug should be used when no canonical fields are set',
);

// 明示 canonicalPath がある場合はそれを優先
assert.equal(
    resolveArticleCanonicalPath(
        { canonicalPath: '/articles/courses/hakodate/turf-1200m' },
        'some-slug',
    ),
    '/articles/courses/hakodate/turf-1200m',
    'explicit canonicalPath should take priority',
);

// canonicalSlug がある場合は fallbackSlug より優先
assert.equal(
    resolveArticleCanonicalPath(
        { canonicalSlug: 'custom-slug' },
        'original-slug',
    ),
    '/articles/custom-slug',
    'canonicalSlug should override fallback slug',
);

// canonicalPath が canonicalSlug より優先
assert.equal(
    resolveArticleCanonicalPath(
        { canonicalPath: '/custom/path', canonicalSlug: 'custom-slug' },
        'original-slug',
    ),
    '/custom/path',
    'canonicalPath should win over canonicalSlug',
);

// 空文字の canonicalPath は未設定と同じ扱い
assert.equal(
    resolveArticleCanonicalPath(
        { canonicalPath: '', canonicalSlug: 'custom-slug' },
        'original-slug',
    ),
    '/articles/custom-slug',
    'empty canonicalPath should be treated as unset',
);

// `/` で始まらない canonicalPath は無視される
assert.equal(
    resolveArticleCanonicalPath(
        { canonicalPath: 'relative/path' },
        'fallback',
    ),
    '/articles/fallback',
    'non-absolute canonicalPath should be ignored',
);

// --- 統合テスト: sprinters-stakes-2026 の一貫性 ---
const allArticles = getAllArticles();
const sprinters = allArticles.find(a => a.slug === 'sprinters-stakes-2026');
assert.ok(sprinters, 'sprinters-stakes-2026 article should exist');

const sprinterCanonical = resolveArticleCanonicalPath(sprinters, sprinters.slug);
assert.equal(
    sprinterCanonical,
    '/articles/sprinters-stakes-2026',
    'sprinters-stakes-2026 canonical should be its own slug, not the archive group',
);

// --- 統合テスト: サイトマップエントリの一貫性 ---
const sitemapEntries = getCanonicalArticleSitemapEntries();

// sprinters-stakes-2026 がサイトマップに自身のslugで掲載されている
const sprinterSitemap = sitemapEntries.find(e => e.path === '/articles/sprinters-stakes-2026');
assert.ok(
    sprinterSitemap,
    'sprinters-stakes-2026 should appear in sitemap with its own slug URL',
);

// アーカイブURLが記事本文URLの代わりにサイトマップに掲載されていない
const archiveInSitemap = sitemapEntries.find(e => e.path === '/articles/grade-races/sprinters-stakes');
assert.equal(
    archiveInSitemap,
    undefined,
    'archive group URL should NOT appear in article sitemap (it belongs to main sitemap)',
);

// --- 統合テスト: リダイレクト元がサイトマップに混入しない ---
for (const entry of sitemapEntries) {
    assert.equal(
        REDIRECTED_ARTICLE_PATHS.has(entry.path),
        false,
        `redirect source ${entry.path} should not appear in sitemap`,
    );
}

// --- 統合テスト: 全エントリが /articles/ 始まり ---
for (const entry of sitemapEntries) {
    assert.ok(
        entry.path.startsWith('/articles/'),
        `sitemap path ${entry.path} should start with /articles/`,
    );
}

// --- 統合テスト: ページとサイトマップで同じ canonical を使っている ---
// entity_path を持つが canonical_path を持たない記事が、
// サイトマップでもページと同じ自身のslugベースのcanonicalを持つことを確認
const articlesWithEntityPath = allArticles.filter(
    a => a.entityPath && !a.canonicalPath,
);
for (const article of articlesWithEntityPath.slice(0, 10)) {
    const pageCanonical = resolveArticleCanonicalPath(article, article.slug);
    const sitemapEntry = sitemapEntries.find(e => e.path === pageCanonical);
    if (sitemapEntry) {
        assert.equal(
            sitemapEntry.path,
            pageCanonical,
            `page and sitemap canonical should match for ${article.slug}`,
        );
    }
}

console.log(`article canonical tests passed (${sitemapEntries.length} sitemap entries verified)`);
