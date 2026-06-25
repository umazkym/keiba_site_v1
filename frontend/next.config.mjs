/** @type {import('next').NextConfig} */
// Cache bust: 2025-11-18T15:43:00Z
const nextConfig = {
  async redirects() {
    return [
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
  },
};

export default nextConfig;
