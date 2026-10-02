/** @type {import('next').NextConfig} */
// Cache bust: 2025-11-18T15:43:00Z
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const canonicalOverrides = require('./content/reference/grade-race-canonical-overrides.json');
const configDirectory = path.dirname(fileURLToPath(import.meta.url));

// ▼ 公開をまたいで Cloudflare に古い HTML が残るのを止める（2026-10-02）
// Next.js は revalidate を持たない静的ページに s-maxage=31536000（1年）を付ける。
// Cloudflare はこの値どおりに取り置くので、公開のあとも前のビルドの HTML が出続けていた
// （2026-09-26 に記事で37時間前、/compare で30時間前の写しを確認）。
// 記事と固定ページには、下の値を付けて上書きする。
//   s-maxage=86400               … Cloudflare の取り置きは1日まで。
//   stale-while-revalidate=86400 … 1日を過ぎた写しは、次の1回だけそのまま返し、裏で新しい HTML を取りに行く。
//                                   人も検索ロボットも待たせない。古い HTML が出るのは長くても2日前の物まで。
//   stale-if-error=604800        … Cloud Run が応答できないときは、7日前までの写しを代わりに返す。
// 静的なページを新しく足したら、下の STATIC_HTML_SOURCES にも足す（足し忘れると、そのページだけ1年に戻る）。
const STATIC_HTML_CACHE_CONTROL =
  'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=604800';

const STATIC_HTML_SOURCES = [
  '/about',
  '/about-ai',
  '/advertising',
  '/compare',
  '/contact',
  '/faq',
  '/grade-races',
  '/keiba-data/horse-weight',
  '/keiba-data/site-selection',
  '/keiba-data/track-condition',
  '/my-data',
  '/privacy',
  '/search',
  '/sitemap',
  '/terms',
  '/jockeys/:slug',
  '/articles/courses/:venue/:course',
  '/articles/grade-races/:slug',
  '/articles/jockeys/:slug',
  '/articles/races/:slug',
];

// レースの前後に「レースのページへの案内」を出す重賞の記事（race_bridge_eligible: true）は、
// 記事のページが API を5分ごとに確かめ直す。1日の値で上書きすると案内が出るのが遅れるので、
// レースがこれから、または終わって3日以内の記事は対象から外し、Next.js が決めた期限をそのまま使う
// （上限は app/articles/[slug]/page.tsx の revalidate = 1日）。
const RACE_BRIDGE_RECENT_DAYS = 3;
const ARTICLE_SOURCE_MAX_LENGTH = 3000;

function listRecentRaceBridgeArticleSlugs() {
  const directory = path.join(configDirectory, 'content', 'articles');
  const oldestRaceDate = new Date(Date.now() - RACE_BRIDGE_RECENT_DAYS * 86400000).toISOString().slice(0, 10);
  return fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.md'))
    .filter((fileName) => {
      const text = fs.readFileSync(path.join(directory, fileName), 'utf8');
      const frontMatterEnd = text.startsWith('---') ? text.indexOf('\n---', 3) : -1;
      if (frontMatterEnd < 0) return false;
      const frontMatter = text.slice(0, frontMatterEnd);
      if (!/^(?:race_bridge_eligible|raceBridgeEligible):\s*['"]?true['"]?\s*$/im.test(frontMatter)) return false;
      const raceDate = frontMatter.match(/^(?:scheduled_race_date|scheduledRaceDate):\s*['"]?(\d{4}-\d{2}-\d{2})/m);
      // 日付が読めない記事は、案内が遅れない側（対象から外す）に倒す。
      return !raceDate || raceDate[1] >= oldestRaceDate;
    })
    .map((fileName) => fileName.replace(/\.md$/, ''));
}

function buildArticleHtmlSource() {
  try {
    const slugs = listRecentRaceBridgeArticleSlugs();
    if (slugs.length === 0) return '/articles/:slug';
    const excluded = slugs.map((slug) => slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const source = `/articles/:slug((?!(?:${excluded})$)[^/]+)`;
    if (source.length <= ARTICLE_SOURCE_MAX_LENGTH) return source;
    console.warn(`[next.config] 記事の取り置きの規則が長すぎるため付けません（${source.length}文字）。記事は Next.js の期限（1日）のまま出ます。`);
  } catch (error) {
    console.warn('[next.config] 記事の一覧を読めなかったため、記事の取り置きの規則を付けません。記事は Next.js の期限（1日）のまま出ます。', error);
  }
  return null;
}

const articleHtmlSource = buildArticleHtmlSource();
const staticHtmlCacheRules = [...STATIC_HTML_SOURCES, ...(articleHtmlSource ? [articleHtmlSource] : [])].map(
  (source) => ({
    source,
    headers: [{ key: 'Cache-Control', value: STATIC_HTML_CACHE_CONTROL }],
  }),
);
// ▲ ここまで

const gradeRaceArticleRedirects = canonicalOverrides.flatMap((entry) =>
  entry.redirect_slugs.map((sourceSlug) => ({
    source: `/articles/${sourceSlug}`,
    destination: `/articles/${entry.primary_slug}`,
    statusCode: 301,
  })),
);

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: '/articles/2026-07-20-shepherds-choice-news',
        destination: '/articles/2026-06-25-news-1ebdc1e8',
        statusCode: 301,
      },
      ...gradeRaceArticleRedirects,
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.uma-free.com',
          },
        ],
        destination: 'https://uma-free.com/:path*',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      // 記事と固定ページの HTML（1日）。同じパスに2つの規則が当たるときは後ろが勝つので、
      // /jockeys/data・/articles など個別の規則より前に置く。
      ...staticHtmlCacheRules,
      {
        // サイトマップ: 24時間CDNキャッシュ（revalidate=86400 と一致させる）
        source: '/sitemap.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 's-maxage=86400, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/sitemap-articles.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 's-maxage=86400, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/sitemap-images.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 's-maxage=86400, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/sitemap-data.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/sitemaps/data/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/jockeys/data/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800',
          },
        ],
      },
      {
        source: '/courses/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800',
          },
        ],
      },
      {
        // 記事一覧: searchParams（category / tag / page）を読むため Next.js が
        // 動的ルート扱いにし、既定で private, no-store を返していた。
        // 結果として CDN が常に BYPASS し、全アクセスがオリジンに到達していた。
        // 記事本文はビルド時のマークダウン由来なので、共有キャッシュで問題ない。
        source: '/articles',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=1800, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // robots.txt: 7日間CDNキャッシュ（ほぼ変化しない）
        source: '/robots.txt',
        headers: [
          {
            key: 'Cache-Control',
            value: 's-maxage=604800, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // ▼▼▼▼▼【修正】minimumCacheTTL を延長▼▼▼▼▼
    // 旧: 60秒 → 画像が頻繁にOriginから再取得されてしまう
    // 新: 86400秒（24時間） → 画像はほぼ変化しないため長期キャッシュで問題なし
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
    minimumCacheTTL: 86400,
  },

  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },

  experimental: {
    optimizePackageImports: ['@/components', '@/lib'],
    // 記事のOG画像（app/og/[slug]/route.tsx）が実行時に読むファイルを standalone の出力へ含める。
    // next/og（@vercel/og）の描画用の yoga.wasm・resvg.wasm・既定の書体は自動では含まれない（14.2.31 で確認）。
    outputFileTracingIncludes: {
      '/og/**': [
        './assets/fonts/NotoSansJP-Bold.ttf',
        './assets/fonts/MPLUSRounded1c-ExtraBold.ttf',
        './content/articles/**/*.md',
        './node_modules/next/dist/compiled/@vercel/og/*.wasm',
        './node_modules/next/dist/compiled/@vercel/og/*.ttf',
      ],
    },
  },
  // ビルド時の静的生成ワーカータイムアウトを 60s -> 180s に延長
  staticPageGenerationTimeout: 180,
};

export default (phase) => {
  const isBuild = phase === 'phase-production-build';
  process.env.NEXT_PHASE = phase;
  if (isBuild) {
    process.env.IS_NEXT_PRODUCTION_BUILD = 'true';
  }
  return {
    ...nextConfig,
    env: {
      ...nextConfig.env,
      NEXT_PHASE: phase,
      IS_NEXT_PRODUCTION_BUILD: isBuild ? 'true' : 'false',
    },
  };
};
