import { NextResponse } from 'next/server';
import { getDataSitemapShard } from '@/lib/api';
import type { DataEntityType } from '@/lib/types';
import { CLOSED_DATA_ENTITY_TYPES } from '@/lib/closed-data-pages';

const BASE_URL = 'https://uma-free.com';
// 競走馬・調教師のページは提供を終了した（2026-09-26）。その分割サイトマップは 410 を返す
const ENTITY_TYPES = new Set(['course', 'jockey']);

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

function priorityFor(entityType: string) {
  if (entityType === 'course') return '0.75';
  return '0.65';
}

export async function GET(
  _request: Request,
  { params }: { params: { entityType: string; shard: string } },
) {
  const shard = Number(params.shard);
  if (CLOSED_DATA_ENTITY_TYPES.has(params.entityType)) {
    return new NextResponse('Gone', {
      status: 410,
      headers: { 'Cache-Control': 'public, s-maxage=86400', 'X-Robots-Tag': 'noindex' },
    });
  }
  if (!ENTITY_TYPES.has(params.entityType) || !Number.isInteger(shard) || shard < 1) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'public, s-maxage=600' },
    });
  }

  const entries = await getDataSitemapShard(
    params.entityType as Exclude<DataEntityType, 'grade'>,
    shard,
  );
  if (entries.length === 0) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'public, s-maxage=600' },
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
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
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
}
