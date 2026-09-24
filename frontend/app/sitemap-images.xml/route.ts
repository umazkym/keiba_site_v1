import { NextResponse } from 'next/server';
import { getAllArticles } from '@/lib/articles';
import { resolveArticleCanonicalPath, REDIRECTED_ARTICLE_PATHS } from '@/lib/article-canonical';
import { pickArticleCover } from '@/lib/article-visual';

const BASE_URL = 'https://uma-free.com';

function escapeXml(unsafe: string) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

// 記事の冒頭に実際に出している画像（記事ごとのアイキャッチ、無ければカテゴリの写真の大きい方）
function coverImagePath(article: Parameters<typeof pickArticleCover>[0]): string | null {
    const cover = pickArticleCover(article);
    if (!cover || cover.kind === 'category') return null;
    if (cover.kind === 'eyecatch') return cover.src;
    const largest = cover.srcSet.split(',').pop()?.trim().split(' ')[0];
    return largest || cover.src;
}

export async function GET() {
    const articles = getAllArticles()
        .map(article => ({
            ...article,
            canonicalPath_: resolveArticleCanonicalPath(article, article.slug),
            imagePath_: coverImagePath(article),
        }))
        .filter(a => a.canonicalPath_.startsWith('/articles/') && !REDIRECTED_ARTICLE_PATHS.has(a.canonicalPath_) && a.imagePath_);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <url>
        <loc>${BASE_URL}/</loc>
        <image:image>
            <image:loc>${BASE_URL}/new-logo.png</image:loc>
            <image:title>UMA-FREE Logo</image:title>
        </image:image>
    </url>
${articles.map(article => `    <url>
        <loc>${BASE_URL}${article.canonicalPath_}</loc>
        <image:image>
            <image:loc>${BASE_URL}${escapeXml(article.imagePath_ as string)}</image:loc>
            <image:title>${escapeXml(article.title)}</image:title>
        </image:image>
    </url>`).join('\n')}
</urlset>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml',
        },
    });
}
