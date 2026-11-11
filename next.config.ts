import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs'],
  async headers() {
    // Never cache the service worker, so phones always pick up the latest version.
    return [{
      source: '/sw.js',
      headers: [
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
      ],
    }];
  },
};
export default nextConfig;
