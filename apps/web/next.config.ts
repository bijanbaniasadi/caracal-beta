import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@caracal/auth', '@caracal/config', '@caracal/types', '@caracal/utils'],
};

export default nextConfig;
