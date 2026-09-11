/**
 * Sprint 31 acceptance: Arabic has an address. PLAN.md 31.1, C103.
 *
 *   npm run verify:sprint31                       # against a server on :3100
 *   VERIFY_URL=https://24t.vercel.app npm run verify:sprint31
 *
 * ## What was wrong, and why this verifier is made of HTTP
 *
 * `/ar/pricing` was a **404**. The Arabic pages existed and rendered well —
 * the language lived in a cookie — so no check that read the source, the
 * dictionaries or the database could see the defect. It was only visible to
 * somebody who tried to open the URL, which is what every reader of a shared
 * link, every WhatsApp group and every crawler in the market this product is
 * built for does first.
 *
 * So this asks the server the questions a stranger's browser asks, and
 * asserts on the response. Three of the checks are things that can only be
 * wrong at the edge: a status code, a redirect target and a header.
 *
 * ## 🔴 The two checks that are proved as a NEGATIVE
 *
 * C158's rule from sprint 30: a structural claim should be proved by planting
 * exactly the offender it claims to catch.
 *
 *   - The locale header is **forged** — `x-locale: ar` sent to `/pricing`, the
 *     shape any client can send — and the page must come back English. A
 *     document that renders two ways at one address is the thing the whole
 *     canonical/hreflang apparatus is claiming does not happen.
 *   - A private path is **requested with a prefix** — `/ar/patient/journal`,
 *     the shape C153 ruled against — and the server must refuse to serve it
 *     at that address rather than rendering somebody's record there.
 *
 * Neither can pass vacuously: both fail if the feature does nothing.
 */
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE } from "../lib/i18n/config";
import { alternatesFor, isLocalisable, localisedPath, splitLocale } from "../lib/i18n/paths";
import { reporter } from "./_verify";

const { check, skipUnless, finish } = reporter();

const BASE = (process.env.VERIFY_URL ?? "http://localhost:3100").replace(/\/$/, "");

type Page = { status: number; html: string; location: string | null };

async function get(path: string, headers: Record<string, string> = {}): Promise<Page> {
  const response = await fetch(`${BASE}${path}`, { headers, redirect: "manual" });
  return {
    status: response.status,
    location: response.headers.get("location"),
    html: response.status < 300 ? await response.text() : "",
  };
}

/** The words a reader sees, with Next's second copy of the tree removed. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ARABIC = /[؀-ۿ]/g;
const LATIN = /[A-Za-z]/g;

function countArabic(html: string): { arabic: number; latin: number } {
  const text = visibleText(html);
  return {
    arabic: (text.match(ARABIC) ?? []).length,
    latin: (text.match(LATIN) ?? []).length,
  };
}

/**
 * Every `<link rel="alternate" hreflang="x" href="y">` on the page.
 *
 * Matched case-insensitively, and that is not tidiness: React serialises the
 * attribute as `hrefLang`, so a case-sensitive scanner reports a page with
 * perfectly good alternates as having none. HTML attribute names are
 * case-insensitive and every crawler reads it; the first version of this
 * function did not, and failed a passing page.
 */
function hreflangs(html: string): Record<string, string> {
  const found: Record<string, string> = {};
  const link = /<link[^>]+rel="alternate"[^>]*>/gi;
  for (let tag = link.exec(html); tag; tag = link.exec(html)) {
    const lang = /hreflang="([^"]+)"/i.exec(tag[0])?.[1];
    const href = /href="([^"]+)"/.exec(tag[0])?.[1];
    if (lang && href) found[lang] = href;
  }
  return found;
}

function canonical(html: string): string | null {
  const tag = /<link[^>]+rel="canonical"[^>]*>/.exec(html)?.[0];
  return tag ? (/href="([^"]+)"/.exec(tag)?.[1] ?? null) : null;
}

async function main() {
  console.log(`\nSprint 31, Arabic URLs\n  against ${BASE}\n`);

  /* ------------------------------------------- the arithmetic, without a server -- */

  check(
    "31.1 English is unprefixed and Arabic is not",
    localisedPath("/pricing", "ar") === "/ar/pricing" && localisedPath("/ar/pricing", "en") === "/pricing",
  );

  check(
    "31.1 a prefix survives being applied twice",
    LOCALES.every((locale) => {
      const once = localisedPath("/features", locale);
      return localisedPath(once, locale) === once;
    }),
  );

  check(
    "31.1 x-default is the default language",
    alternatesFor("/ar/pricing", "https://x.test").languages["x-default"] ===
      `https://x.test${localisedPath("/pricing", DEFAULT_LOCALE)}`,
  );

  check(
    "🔴 C153 no private path is localisable",
    ["/patient/journal", "/dashboard", "/notes/1", "/join/tok", "/admin"].every(
      (path) => !isLocalisable(path) && !isLocalisable(`/ar${path}`),
    ),
  );

  check(
    "31.1 a page whose name begins with a locale is still a page",
    splitLocale("/article").rest === "/article",
  );

  /* ------------------------------------------------------------- and with one -- */

  let live = false;
  try {
    const probe = await fetch(`${BASE}/`, { redirect: "manual" });
    live = probe.status < 500;
  } catch {
    live = false;
  }

  await skipUnless(
    live,
    "a running server",
    `nothing answers at ${BASE}, start one with \`npx next start -p 3100\``,
    async () => {
      /* The sprint, in one status code. This was 404. */
      const arabic = await get("/ar/pricing");
      check("🔴 31.1 /ar/pricing is a page", arabic.status === 200, `status ${arabic.status}`);

      const english = await get("/pricing");
      check("31.1 /pricing still serves", english.status === 200, `status ${english.status}`);

      /* A URL that says Arabic and renders English is worse than a 404. */
      const counted = countArabic(arabic.html);
      check(
        "🔴 31.1 the Arabic URL serves Arabic",
        counted.arabic > counted.latin && counted.arabic > 200,
        `${counted.arabic} Arabic characters against ${counted.latin} Latin`,
      );

      check(
        "31.1 and it is laid out right to left",
        /<html[^>]+lang="ar"/.test(arabic.html) && /<html[^>]+dir="rtl"/.test(arabic.html),
      );

      /*
       * 🔴 The forged header. Planted offender, C158.
       *
       * Any client can send this. If the middleware did not delete it before
       * setting its own, the canonical English URL would render Arabic on
       * request, and every hreflang on the site would be describing a document
       * that does not have one language.
       */
      const forged = await get("/pricing", { "x-locale": "ar" });
      const forgedCount = countArabic(forged.html);
      check(
        "🔴 31.1 a forged x-locale header does not change the page",
        forgedCount.latin > forgedCount.arabic,
        `${forgedCount.arabic} Arabic characters against ${forgedCount.latin} Latin`,
      );

      /*
       * 🔴 The private path with a prefix. Planted offender, C153.
       *
       * A redirect, not a render: the record has one address. Either a 307 to
       * the unprefixed path or an auth bounce is correct — what is not correct
       * is a 200, which would mean the page was served at a second URL.
       */
      const priv = await get("/ar/patient/journal");
      check(
        "🔴 C153 /ar/patient/journal is not a second address for a private record",
        priv.status >= 300 && priv.status < 400 && !(priv.location ?? "").includes("/ar/"),
        `status ${priv.status} → ${priv.location ?? "nowhere"}`,
      );

      /*
       * 🔴 And the one that renders.
       *
       * `/patient/invite/<token>` is the one patient path that serves to a
       * signed-out stranger (22R), so it is the only private path where the
       * missing guard would produce a **200** rather than an auth bounce. A
       * check that only ever looked at `/ar/patient/journal` would pass on a
       * build with no guard at all, because the login redirect looks the same.
       */
      const open = await get("/ar/patient/invite/verify31-not-a-token");
      check(
        "🔴 C153 …nor is the one private path that serves to a stranger",
        open.status >= 300 && open.status < 400 && !(open.location ?? "").includes("/ar/"),
        `status ${open.status} → ${open.location ?? "nowhere"}`,
      );

      const en = await get("/en/pricing");
      check(
        "31.1 /en/pricing redirects to the unprefixed page",
        en.status >= 300 && en.status < 400 && (en.location ?? "").endsWith("/pricing"),
        `status ${en.status} → ${en.location ?? "nowhere"}`,
      );

      /* hreflang, on the page a crawler actually fetches. */
      const langs = hreflangs(arabic.html);
      check(
        "31.1 the Arabic page declares every language and x-default",
        LOCALES.every((locale) => Boolean(langs[locale])) && Boolean(langs["x-default"]),
        Object.keys(langs).join(", ") || "none",
      );

      check(
        "31.1 the two languages point at each other",
        (langs.ar ?? "").endsWith("/ar/pricing") && (langs.en ?? "").endsWith("/pricing"),
        `ar → ${langs.ar ?? "none"}, en → ${langs.en ?? "none"}`,
      );

      check(
        "31.1 each page is canonical to itself",
        (canonical(arabic.html) ?? "").endsWith("/ar/pricing") &&
          (canonical(english.html) ?? "").endsWith("/pricing"),
        `${canonical(arabic.html) ?? "none"} / ${canonical(english.html) ?? "none"}`,
      );

      /*
       * The prefix has to survive a click, or it only ever worked for the
       * first page somebody opened.
       */
      check(
        "🔴 31.1 the Arabic page links onward in Arabic",
        /href="\/ar\/(?:pricing|features|for-patients|radar|contact)/.test(arabic.html),
      );

      /* Both languages are advertised, or only one of them is findable. */
      const sitemap = await get("/sitemap.xml");
      check(
        "31.1 the sitemap lists both languages",
        sitemap.html.includes("/ar/pricing") && /<loc>[^<]*\/pricing<\/loc>/.test(sitemap.html),
      );

      /*
       * C103's ruling, still true: the cookie is the preference, and it is
       * what an unprefixed URL answers to.
       */
      const byCookie = await get("/pricing", { cookie: `${LOCALE_COOKIE}=ar` });
      const cookieCount = countArabic(byCookie.html);
      check(
        "31.1 the cookie is still the preference where there is no prefix",
        cookieCount.arabic > cookieCount.latin,
        `${cookieCount.arabic} Arabic characters against ${cookieCount.latin} Latin`,
      );
    },
  );

  finish("Sprint 31");
}

void main();
