/** @type {import('next').NextConfig} */
const nextConfig = {
  // ▼▼▼▼▼【ここから修正】▼▼▼▼▼
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
        permanent: true, // 301リダイレクト
      },
    ];
  },
  // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲
};

export default nextConfig;