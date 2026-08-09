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
        source: "/:path*",
        headers: [
          ...baseHeaders,
          /**
           * ONE Permissions-Policy for the whole app, and it must permit the
           * microphone.
           *
           * Permissions-Policy is applied to a *document* at load time. The
           * session room is almost always reached by client-side navigation
           * (dashboard → new session → room), so no new document is fetched and
           * no new policy is applied — the room silently inherits whatever
           * policy the first page was served with. A per-route rule that denies
           * the microphone everywhere except `/sessions/*` therefore blocks
           * `getUserMedia` in the room and records nothing at all, while
           * looking completely correct in `curl -I`.
           *
           * This is still a real restriction: naming `self` and Daily means no
           * other third-party iframe can reach the microphone or camera.
           */
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
