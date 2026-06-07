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
      // Stub out Privy/x402 optional solana-program dependencies with
      // modules that export the exact named exports they expect.
      // We don't use Privy's "Fund SOL Wallet" feature so these are safe stubs.
      '@solana-program/system': './src/lib/stubs/solana-program-system.mjs',
      '@solana-program/token': './src/lib/stubs/solana-program-token.mjs',
      '@solana-program/token-2022': './src/lib/stubs/solana-program-token-2022.mjs',
      '@solana/kit/program-client-core': './src/lib/stubs/empty-module.mjs',
    },
  },
};

module.exports = nextConfig;
