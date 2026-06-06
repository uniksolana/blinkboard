/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'abs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'unavatar.io',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  serverExternalPackages: ['@resvg/resvg-js'],
  experimental: {
    esmExternals: true,
  },
};

module.exports = nextConfig;
