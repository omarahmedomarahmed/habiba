import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/**
 * Two jobs, and the second one matters more than the first.
 *
 * Marketing pages and the Crisis Radar should be indexed — someone searching
 * "talk to a therapist now" is exactly who the radar is for. Everything behind
 * a login, and above all `/join/*`, must not be. A join link in a search index
 * is a stranger's therapy session in a search index.
 *
 * The individual pages already set `robots: { index: false }` in their
 * metadata; this is the belt to that pair of braces, and it also stops crawlers
 * spending the crawl budget on routes that will only redirect them to /login.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/join/",
          "/dashboard",
          "/sessions",
          "/patients",
          "/notes",
          "/copilot",
          "/on-call",
          "/billing",
          "/settings",
          "/admin",
          "/api/",
          "/login",
          "/signup",
          "/reset-password",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
