import type { NextConfig } from 'next'

const runtimeUrl = process.env.RUNTIME_URL ?? 'http://127.0.0.1:3000'

/**
 * The Console proxies /api/* to the FDE runtime via a rewrite, so the
 * frontend always calls same-origin REST endpoints (no CORS, no direct DB).
 */
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${runtimeUrl}/api/:path*` }]
  },
}

export default nextConfig
