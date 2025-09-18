/** @type {import('next').NextConfig} */
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
        permanent: true, // 301リダイレクト
      },
    ];
  },
};

export default nextConfig;