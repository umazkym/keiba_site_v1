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

  // 動的なレースページのURLを生成（過去90日分と未来14日分に範囲を拡大）
  const dynamicRaceRoutes = [];
  const today = new Date();
  // 過去90日から未来14日までループ
  for (let i = -90; i <= 14; i++) {
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