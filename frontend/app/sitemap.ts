import { MetadataRoute } from 'next'

const BASE_URL = 'https://uma-free.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 静的ページのルート
  const staticRoutes = [
    '',
    '/about',
    '/contact',
    '/privacy',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));

  try {
    // 動的ページ（レース日程）のルート
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/races/dates`);
    if (!response.ok) {
      console.error(`Sitemap fetch failed with status: ${response.status}`);
      return staticRoutes;
    }
    const dates = await response.json();

    const raceRoutes = dates.map((date: string) => ({
      url: `${BASE_URL}/races/${date}`,
      lastModified: new Date(),
    }));

    return [...staticRoutes, ...raceRoutes];
  } catch (error) {
    console.error('Error fetching race dates for sitemap:', error);
    return staticRoutes;
  }
}