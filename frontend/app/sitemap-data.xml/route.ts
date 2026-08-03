import { NextResponse } from 'next/server';
import { getDataSitemapManifest } from '@/lib/api';

const BASE_URL = 'https://uma-free.com';

export const dynamic = 'force-dynamic';

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    const escaped: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    };
    return escaped[char] ?? char;
  });
}

export async function GET() {
  const manifest = await getDataSitemapManifest();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${manifest
  .map((entry) => `  <sitemap>
    <loc>${escapeXml(`${BASE_URL}/sitemaps/data/${entry.entity_type}/${entry.shard}.xml`)}</loc>${entry.last_modified ? `
    <lastmod>${escapeXml(entry.last_modified)}</lastmod>` : ''}
  </sitemap>`)
  .join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
}
