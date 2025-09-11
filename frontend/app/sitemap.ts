import { MetadataRoute } from 'next';

// サイトのベースURLを設定
const BASE_URL = 'https://uma-free.com';

export default function sitemap(): MetadataRoute.Sitemap {
  // 静的なページのURLを追加
  const staticRoutes = [
    '',
    '/about',
    '/contact',
    '/privacy',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  // 動的なレースページのURLを生成（例として過去30日分と未来7日分）
  const dynamicRaceRoutes = [];
  const today = new Date();
  for (let i = -30; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateString = date.toISOString().split('T')[0];
    dynamicRaceRoutes.push({
      url: `${BASE_URL}/races/${dateString}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    });
  }

  return [...staticRoutes, ...dynamicRaceRoutes];
}