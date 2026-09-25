import type { MetadataRoute } from "next";

import { SIMULATION_RUNNING, env } from "@/lib/env";

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
  /*
   * 🔴 76.49 — A SIMULATION IS RUNNING, SO NOTHING HERE IS TRUE.
   *
   * The radar is deliberately indexable, because somebody searching "talk to a
   * therapist now" is exactly who it is for. During a run the people on it are
   * invented and carry `DEMO-` licence numbers, and an index entry outlives
   * both the run and the restore that undoes it.
   *
   * Disallowing everything is the only honest setting: the marketing pages
   * describe prices the simulation may have changed, and the radar describes
   * clinicians who do not exist.
   */
  if (SIMULATION_RUNNING) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /*
         * 🔴 Every door that is not the public site, not only the clinician's.
         *
         * The list stopped at the therapist app, so the patient's record, the
         * capability links that authenticate by the URL itself (`/pay/`,
         * `/feedback/`, `/records/`, `/support/`, `/welcome/`, `/j/`, H33) and
         * the clinic, sponsor and partner portals were all crawlable. A token
         * URL in an index is the same leak as a join link in one.
         */
        disallow: [
          "/join/",
          "/j/",
          "/pay/",
          "/feedback/",
          "/records/",
          "/support",
          "/welcome/",
          "/patient",
          "/clinic",
          "/sponsor",
          "/partner",
          "/assistant",
          "/bookings",
          "/connect",
          "/earnings",
          "/notifications",
          "/onboarding",
          "/switch-principal",
          "/staff",
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
