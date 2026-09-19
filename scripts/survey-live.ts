/**
 * Walk the whole public surface of the deployed site and report what it serves.
 *
 *   npm run survey:live
 *   LIVE_URL=https://24therapy.app npm run survey:live
 *
 * ## Why this exists
 *
 * `check:live` asks three questions about two pages. This asks the shallow
 * question about EVERY page and EVERY API route: what status, on which host,
 * with which canonical, and does the HTML still name a hostname we retired.
 *
 * It was written the day the product moved to `24therapy.app`. The move is the
 * shape of defect nothing in the repository can see (C162, H47): the code is
 * right, the environment names a different host, every page agrees with the
 * environment, and every unit test passes. So the only instrument is asking the
 * deployed site and comparing what comes back against the host that answered.
 *
 * ## What it asserts, and what it deliberately does not
 *
 * It is a survey, not an acceptance test. It reports a table and exits non-zero
 * on the four things that are never acceptable:
 *
 *   - a public page that is not 200
 *   - a served page whose canonical names a different host than the one asked
 *   - any retired hostname anywhere in any response body
 *   - an API route that answers 200 to an anonymous caller when it holds data
 *
 * It does NOT sign in, does not POST, and writes nothing. Everything it does is
 * something a stranger with a browser could do, which is the point: this is the
 * view from outside.
 */
import { LOCALE_COOKIE } from "../lib/i18n/config";
import { reporter } from "./_verify";

const LIVE = (process.env.LIVE_URL ?? "https://24therapy.app").replace(/\/$/, "");
const HOST = new URL(LIVE).host;

const RETIRED = ["24t.vercel.app", "24therapy.ai", "habiba-zeta.vercel.app"];

/** The CMS pages, by slug, as `content_pages` publishes them. */
const CMS = [
  "", // home is served at /
  "features",
  "for-patients",
  "pricing",
  "contact",
  "privacy",
  "terms",
  "hipaa",
  "security",
];

/** Pages that are routes rather than rows, so no row can unpublish them. */
const CODE_PAGES = [
  "developers",
  "for-clinics",
  "for-companies",
  "integrations",
  "radar",
  "verify",
];

/**
 * Every API route under `app/api`. An anonymous GET must never be 200 with
 * data. Several correctly answer 405 (they are POST-only), several 401, and the
 * two genuinely public ones are named below.
 */
const API = [
  "/api/admin/radar",
  "/api/copilot/speak",
  "/api/copilot/voice",
  "/api/cron/billing",
  "/api/documents/00000000-0000-0000-0000-000000000000",
  "/api/ehr/callback",
  "/api/hr/v1/employment",
  "/api/meetings/connect/zoom",
  "/api/partner/launch",
  "/api/partner/v1/consent",
  "/api/partner/v1/copilot",
  "/api/partner/v1/launch",
  "/api/partner/v1/sessions",
  "/api/radar",
  "/api/radar/profile/00000000-0000-0000-0000-000000000000",
  "/api/revalidate",
  "/api/sessions/00000000-0000-0000-0000-000000000000/state",
  "/api/sessions/00000000-0000-0000-0000-000000000000/transcribe",
  "/api/stripe/webhook",
  "/api/uploads/nothing-here",
];

/**
 * The two routes that answer an anonymous GET on purpose, each for a reason
 * written in its own source rather than assumed here.
 *
 *   - `/api/radar` is the feed behind the public radar: it is how somebody in
 *     crisis finds a therapist who is free right now, so a login in front of it
 *     would defeat the page.
 *   - `/api/revalidate` GET returns `{cacheVersion}` and nothing else. Its own
 *     header calls it "unauthenticated and deliberately tiny", and it exists so
 *     a check can tell *the live site is wrong* from *the live site has not been
 *     redeployed yet*. It names no commit, no environment and no secret. Its
 *     POST half, which does the work, is behind the cron secret.
 */
const PUBLIC_API = new Set(["/api/radar", "/api/revalidate"]);

/** One page from each portal. Anonymous must never reach the page itself. */
const PORTALS = [
  "/dashboard",
  "/admin",
  "/patient",
  "/clinic",
  "/sponsor",
  "/partner",
];

type Hit = { path: string; status: number; body: string; finalUrl: string };

/**
 * 🔴 `follow` IS THE WRONG DEFAULT FOR AN API ROUTE, and the first version of
 * this file got it wrong in the direction that reads as a security hole.
 *
 * `/api/admin/radar` answers **307 to `/login`** for an anonymous caller, which
 * is exactly right. Following that redirect lands on the login page, which is
 * a 200, so the survey reported *"an admin route hands an anonymous caller a
 * 200"* and named four more routes that were also behaving correctly. The check
 * was measuring the login page.
 *
 * So a page follows redirects, because a reader does, and an API route does
 * not, because the status IS the answer.
 */
async function get(path: string, locale?: string, follow = true): Promise<Hit> {
  const headers: Record<string, string> = {};
  if (locale) headers.cookie = `${LOCALE_COOKIE}=${locale}`;
  const res = await fetch(`${LIVE}${path}`, {
    headers,
    redirect: follow ? "follow" : "manual",
  });
  return { path, status: res.status, body: await res.text(), finalUrl: res.url };
}

const canonicalOf = (html: string) =>
  html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;

/**
 * 🔴 `hrefLang`, NOT `hreflang`. Next renders the React prop name into the
 * attribute, so a case-sensitive search for the HTML spelling finds nothing and
 * reports a page with three correct alternate links as having none. Cost ten
 * minutes and a wrong diagnosis before somebody looked at the bytes.
 *
 * C162 was about "every canonical AND hreflang", so both are checked here.
 */
const alternatesOf = (html: string) =>
  [...html.matchAll(/<link rel="alternate" hrefLang="[^"]*" href="([^"]+)"/gi)].map((m) => m[1]!);

const retiredIn = (body: string) => RETIRED.filter((d) => body.includes(d));

async function main() {
  const { check, finish } = reporter();

  console.log(`\n  surveying ${LIVE}\n`);

  /* ------------------------------------------------- the public pages -- */

  const paths = [
    ...CMS.map((s) => `/${s}`),
    ...CODE_PAGES.map((s) => `/${s}`),
  ];

  const bad: string[] = [];
  const wrongHost: string[] = [];
  const leaked: string[] = [];

  for (const locale of ["en", "ar"] as const) {
    for (const p of paths) {
      const path = locale === "ar" ? `/ar${p === "/" ? "" : p}` : p;
      const hit = await get(path || "/", locale);
      const canon = canonicalOf(hit.body);
      const alts = alternatesOf(hit.body);
      const stale = retiredIn(hit.body);

      if (hit.status !== 200) bad.push(`${path} ${String(hit.status)}`);
      if (canon && new URL(canon).host !== HOST) wrongHost.push(`${path} canonical -> ${canon}`);
      for (const a of alts) {
        if (new URL(a).host !== HOST) wrongHost.push(`${path} hreflang -> ${a}`);
      }
      if (stale.length > 0) leaked.push(`${path} (${stale.join(", ")})`);

      const flag = hit.status === 200 ? "ok  " : "FAIL";
      console.log(
        `  ${flag} ${String(hit.status)} ${path.padEnd(24)} canonical ${canon ?? "(none)"}  +${String(alts.length)} alt`,
      );
    }
  }

  check(
    `🔴 every public page answers 200, both locales, ${String(paths.length * 2)} pages`,
    bad.length === 0,
    bad.join(", ") || `${String(paths.length * 2)} pages, all 200`,
  );

  check(
    "🔴 every canonical names the host that served it, which is the C162 defect",
    wrongHost.length === 0,
    wrongHost.slice(0, 6).join(", ") || `all canonical tags name ${HOST}`,
  );

  check(
    "🔴 no served page names a retired hostname",
    leaked.length === 0,
    leaked.slice(0, 6).join(", ") || "none of the three appears in any page body",
  );

  /* ----------------------------------------------- robots and sitemap -- */

  const robots = await get("/robots.txt");
  console.log(`\n  robots.txt: ${robots.body.trim().replace(/\n/g, " | ")}`);

  const sitemap = await get("/sitemap.xml");
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  const offHost = urls.filter((u) => new URL(u).host !== HOST);

  check(
    `🔴 every sitemap URL names ${HOST}, ${String(urls.length)} entries`,
    urls.length > 0 && offHost.length === 0,
    offHost.slice(0, 4).join(", ") ||
      (urls.length === 0 ? "the sitemap is EMPTY, which is not a pass" : `${String(urls.length)} URLs, all on ${HOST}`),
  );

  /*
   * 🔴 The sitemap is PRERENDERED and the canonical is per request, so the two
   * can disagree until a rebuild. That is C162's subtlety and the reason this
   * compares them to each other rather than each to a constant.
   */
  const home = await get("/");
  const homeCanon = canonicalOf(home.body);
  check(
    "🔴 the prerendered sitemap and the per-request canonical agree on the host",
    homeCanon !== null && urls.length > 0 && new URL(homeCanon).host === new URL(urls[0]!).host,
    `canonical ${homeCanon ?? "(none)"} · sitemap ${urls[0] ?? "(none)"}`,
  );

  /* ------------------------------------------------------ the API surface -- */

  console.log("");
  const openData: string[] = [];
  const crashed: string[] = [];

  for (const path of API) {
    const hit = await get(path, undefined, false);
    const stale = retiredIn(hit.body);
    if (stale.length > 0) leaked.push(`${path} (${stale.join(", ")})`);
    if (hit.status >= 500) crashed.push(`${path} ${String(hit.status)}`);
    if (hit.status === 200 && !PUBLIC_API.has(path)) openData.push(`${path} 200`);
    const where = hit.status >= 300 && hit.status < 400 ? ` -> ${hit.finalUrl || "(location)"}` : "";
    console.log(`  ${hit.status >= 500 ? "FAIL" : "ok  "} ${String(hit.status)} ${path}${where}`);
  }

  check(
    `🔴 no API route 500s for an anonymous caller, ${String(API.length)} routes`,
    crashed.length === 0,
    crashed.join(", ") || `${String(API.length)} routes, none crashed`,
  );

  check(
    "🔴 no API route hands an anonymous caller a 200, except the radar, which is meant to",
    openData.length === 0,
    openData.join(", ") || "every guarded route refused",
  );

  /* --------------------------------------------------------- the portals -- */

  console.log("");
  const reachable: string[] = [];
  for (const path of PORTALS) {
    const hit = await get(path);
    const landed = new URL(hit.finalUrl).pathname;
    const bounced = landed !== path || hit.status === 404;
    if (!bounced && hit.status === 200) reachable.push(path);
    console.log(`  ${bounced || hit.status !== 200 ? "ok  " : "FAIL"} ${String(hit.status)} ${path.padEnd(12)} -> ${landed}`);
  }

  check(
    "🔴 no portal page renders for somebody who is not signed in",
    reachable.length === 0,
    reachable.join(", ") || `${String(PORTALS.length)} portals, every one bounced or refused`,
  );

  /* --------------------------------- the retired hostnames, one more time -- */

  check(
    "🔴 CONTROL nothing anywhere in the survey carried a retired hostname",
    leaked.length === 0,
    leaked.slice(0, 6).join(", ") || "pages and API responses both clean",
  );

  finish(`Live survey of ${HOST}`);
}

void main();
