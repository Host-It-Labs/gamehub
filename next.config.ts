import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'export',
  ...(process.env.NODE_ENV === 'development'
    ? {
        async rewrites() {
          return [
            { source: '/auth', destination: '/' },
            { source: '/tables', destination: '/' },
            { source: '/table/:token', destination: '/' },
          ];
        },
      }
    : {}),
};
export default nextConfig;
