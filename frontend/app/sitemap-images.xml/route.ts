import { NextResponse } from 'next/server';
import { getAllArticles } from '@/lib/articles';

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

export async function GET() {
    const articles = getAllArticles();

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
        <loc>${BASE_URL}/articles/${article.slug}</loc>
        <image:image>
            <image:loc>${BASE_URL}${escapeXml(article.eyecatch)}</image:loc>
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
