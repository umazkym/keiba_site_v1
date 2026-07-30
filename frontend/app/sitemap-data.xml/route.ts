import { NextResponse } from 'next/server';
import { getDataSitemapEntries } from '@/lib/api';

const BASE_URL = 'https://uma-free.com';

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return char;
    }
  });
}

function priorityFor(entityType: string) {
  switch (entityType) {
    case 'course':
      return '0.75';
    case 'horse':
      return '0.70';
    default:
      return '0.65';
  }
}

export async function GET() {
  const entries = await getDataSitemapEntries();
  const seen = new Set<string>();
  const uniqueEntries = entries.filter((entry) => {
    if (!entry.url.startsWith('/') || seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueEntries
  .map((entry) => `  <url>
    <loc>${escapeXml(`${BASE_URL}${entry.url}`)}</loc>${entry.last_modified ? `
    <lastmod>${escapeXml(entry.last_modified)}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>${priorityFor(entry.entity_type)}</priority>
  </url>`)
  .join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
}
