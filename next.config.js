/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // 允许外部图片
  images: {
    domains: ['predict.fun', 'api.predict.fun', 'api-testnet.predict.fun'],
    unoptimized: true,
  },
}

module.exports = nextConfig
