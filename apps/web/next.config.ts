import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const nextConfig: NextConfig = {
  // Self-contained server for PM2 on the VPS (SPEC §18.3). Builds run in GitHub Actions only.
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // Images are pre-sized in R2; the server never resizes at request time (CLAUDE.md §22).
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },

  // Pages also get a per-request Content-Security-Policy from proxy.ts (it needs a nonce).
  async headers() {
    const common = [
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    ];
    return [
      { source: '/:path*', headers: common },
      // SPEC §16: the admin panel may never be framed. Listed last, so it wins for /admin.
      { source: '/admin', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/admin/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
    ];
  },

  async rewrites() {
    // In production Nginx sends /api/* straight to the API. In development Next proxies it so the
    // browser only ever talks to one origin, exactly as in production.
    if (process.env.NODE_ENV !== 'development') return [];
    const apiUrl = (process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
