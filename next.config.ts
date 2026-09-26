import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'export',
  ...(process.env.NODE_ENV === 'development'
    ? {
        async rewrites() {
          return [
            { source: '/auth', destination: '/' },
            { source: '/tables', destination: '/' },
            { source: '/relic', destination: '/' },
            { source: '/folio', destination: '/' },
            { source: '/sound-lab', destination: '/' },
            { source: '/folio/:token', destination: '/' },
            { source: '/expedition/:token', destination: '/' },
            { source: '/table/:token', destination: '/' },
          ];
        },
      }
    : {}),
};
export default nextConfig;
