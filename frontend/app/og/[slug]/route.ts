import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const width = 1200;
const height = 630;

type OgMeta = {
  title: string;
  description: string;
  category: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitByLength(value: string, maxLength: number, maxLines: number): string[] {
  const chars = Array.from(value.replace(/\s+/g, ' ').trim());
  const lines: string[] = [];
  let current = '';

  for (const char of chars) {
    if (Array.from(current).length >= maxLength) {
      lines.push(current);
      current = '';
      if (lines.length >= maxLines) break;
    }
    current += char;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines;
}

function normalizeSlug(rawSlug: string): string {
  const decoded = decodeURIComponent(rawSlug).replace(/\.png$/i, '');
  return path.basename(decoded).replace(/\.md$/i, '');
}

function readArticleMeta(slug: string): OgMeta {
  const articlesDirectory = path.join(process.cwd(), 'content', 'articles');
  const fullPath = path.join(articlesDirectory, `${slug}.md`);

  if (!fs.existsSync(fullPath)) {
    return {
      title: 'UMA-FREE 競馬データ分析',
      description: '競馬予想に使えるレースデータ、AI分析、枠順傾向を無料で確認できます。',
      category: '競馬データ',
    };
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data } = matter(fileContents);

  return {
    title: String(data.og_title || data.title || 'UMA-FREE 競馬データ分析'),
    description: String(data.og_description || data.description || ''),
    category: String(data.category || '競馬データ'),
  };
}

function buildOgSvg(meta: OgMeta): string {
  const titleLines = splitByLength(meta.title, 24, 3);
  const descriptionLines = splitByLength(meta.description, 34, 2);
  const titleSvg = titleLines
    .map((line, index) => `<text x="84" y="${205 + index * 72}" class="title">${escapeXml(line)}</text>`)
    .join('');
  const descriptionSvg = descriptionLines
    .map((line, index) => `<text x="86" y="${460 + index * 38}" class="description">${escapeXml(line)}</text>`)
    .join('');

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="58%" stop-color="#ecfeff"/>
      <stop offset="100%" stop-color="#f7fee7"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#84cc16"/>
    </linearGradient>
    <style>
      .brand { font: 700 38px "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif; fill: #0f172a; letter-spacing: 1px; }
      .label { font: 700 26px "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif; fill: #0f766e; }
      .title { font: 800 58px "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif; fill: #0f172a; }
      .description { font: 500 28px "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif; fill: #334155; }
      .footer { font: 600 24px "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif; fill: #475569; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="48" y="48" width="1104" height="534" rx="8" fill="#ffffff" opacity="0.88"/>
  <rect x="84" y="132" width="168" height="8" rx="4" fill="url(#rule)"/>
  <text x="84" y="108" class="brand">UMA-FREE</text>
  <text x="930" y="108" text-anchor="end" class="label">${escapeXml(meta.category)}</text>
  ${titleSvg}
  ${descriptionSvg}
  <text x="86" y="552" class="footer">uma-free.com</text>
  <path d="M930 520H1116" stroke="#0f766e" stroke-width="10" stroke-linecap="round" opacity="0.18"/>
  <path d="M982 554H1116" stroke="#84cc16" stroke-width="10" stroke-linecap="round" opacity="0.32"/>
</svg>`;
}

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
): Promise<Response> {
  const slug = normalizeSlug(params.slug);
  const meta = readArticleMeta(slug);
  const svg = buildOgSvg(meta);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
