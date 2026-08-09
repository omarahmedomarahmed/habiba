import type { NextConfig } from "next";

/**
 * Security headers are declared here and ONLY here.
 *
 * The previous codebase declared them in both `vercel.json` and `next.config.ts`
 * and the two disagreed (`camera=*` vs `camera=(self)`), which silently broke
 * getUserMedia inside the Daily.co iframe. One source of truth.
 */
const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Neon's driver and its WebSocket transport must not be bundled. Webpack
   * mangles `ws`'s optional native bindings, which surfaces at runtime as
   * `b.mask is not a function` on the first query — a failure that only shows
   * up in a production build, never in dev.
   */
  serverExternalPackages: ["@neondatabase/serverless", "ws"],
  experimental: {
    // Server Actions carry PHI-mutating writes; keep bodies small.
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        // Default: no camera/microphone anywhere.
        source: "/:path((?!sessions|join).*)",
        headers: [
          ...baseHeaders,
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        // The session room and the patient join page need mic + camera, and the
        // Daily.co call runs in a cross-origin iframe, so `self` is not enough.
        source: "/:path(sessions|join)/:rest*",
        headers: [
          ...baseHeaders,
          {
            key: "Permissions-Policy",
            value:
              'camera=(self "https://*.daily.co"), microphone=(self "https://*.daily.co"), display-capture=(self "https://*.daily.co"), geolocation=(), payment=()',
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
