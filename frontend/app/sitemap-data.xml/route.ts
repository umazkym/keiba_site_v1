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

  // 公開済みデータページが1件もない間は、空のsitemapindexを返さない。
  // sitemapindexは<sitemap>を1件以上含む必要があり、空だとSearch Consoleが
  // 「必須タグが指定されていません」として解析エラーにする。
  // 存在しないものは404で表明し、不正なXMLは配信しない。
  if (manifest.length === 0) {
    return new NextResponse('公開中のデータページがないため、サイトマップは生成されていません。', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        'X-Robots-Tag': 'noindex',
      },
    });
  }

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
