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
    /**
     * 🔴 76.44 — ONE PROCESS COMPILES THIS, AND THE REASON IS AN OUTAGE.
     *
     * Next 15 compiles in a child worker by default. `NODE_OPTIONS` is
     * inherited, so a heap cap is a cap **per process**, not for the build:
     * parent and worker each believed they could grow to the same ceiling, and
     * on Vercel's 8 GB build container the kernel killed one of them with
     * SIGKILL. The message is "Next.js build worker exited with code: null",
     * which names the worker and says nothing about the pair.
     *
     * The failure was intermittent, which is the tell. Identical commits built
     * green at 19:20 and were killed at 20:18. A build that needs a fixed
     * amount of memory does not do that; two processes racing for one
     * container's worth do.
     *
     * 🔴 AND THE FIRST FIX POINTED THE WRONG WAY. The cap was RAISED to 6144
     * after a clean V8 heap exhaustion at ~3 GB. That turned one process
     * failing honestly into two processes able to ask for 12 GB on an 8 GB
     * machine, and a V8 error with a stack into a kernel kill with none.
     *
     * Three configurations were built and their peak RSS across every node
     * process measured, rather than argued about:
     *
     *   worker on,  6144 -> 2.8 GB locally, and SIGKILLed on Vercel anyway
     *   worker off, 4096 -> 4.4 GB, green  ← shipped
     *   worker off, 3072 -> 4.0 GB, green, 43s to compile
     *
     * The first row is the point. A local peak well under the container's
     * memory did not predict the failure, because the failure was two heaps
     * racing rather than one heap being too small. With one compile process the
     * worst case is the cap, and the cap is a number somebody chose.
     *
     * 3072 built green here and is still not what ships. The original V8 abort
     * is evidence that a cold Vercel compile wants more than a 3 GB heap, and a
     * local build with a warm module graph wanting less does not overturn it.
     * 4096 is above the number that failed and half of the number that was
     * killed.
     *
     * One process, one heap, one cap that means what it says.
     */
    webpackBuildWorker: false,
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
