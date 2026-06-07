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
  turbopack: {
    resolveAlias: {
      // Stub out Privy's optional solana-program dependencies
      // These are only used for the "Fund SOL Wallet" feature we don't need
      '@solana-program/system': './src/lib/stubs/empty-module.mjs',
      '@solana-program/token': './src/lib/stubs/empty-module.mjs',
      '@solana/kit/program-client-core': './src/lib/stubs/empty-module.mjs',
    },
  },
};

module.exports = nextConfig;
