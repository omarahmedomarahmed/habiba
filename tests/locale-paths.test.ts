import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_LOCALE, LOCALES } from "../lib/i18n/config";
import { alternatesFor, isLocalisable, localisedPath, splitLocale } from "../lib/i18n/paths";

/**
 * The arithmetic of `/ar/*`. PLAN.md 31.1, C103.
 *
 * Pure, so the rules that decide whether somebody's private record gets a
 * second address can be asserted without a browser, a build or a database.
 *
 * The property that matters most is the last one: **a path that is not public
 * has exactly one URL.** Everything else here is bookkeeping about prefixes;
 * that one is the reason the middleware redirects instead of rewriting.
 */

/* ------------------------------------------------------------- splitting -- */

test("a prefixed path yields its locale and the path underneath", () => {
  assert.deepEqual(splitLocale("/ar/pricing"), { locale: "ar", rest: "/pricing" });
  assert.deepEqual(splitLocale("/ar"), { locale: "ar", rest: "/" });
  assert.deepEqual(splitLocale("/ar/integrations/zoom"), {
    locale: "ar",
    rest: "/integrations/zoom",
  });
});

test("an unprefixed path is the default language and is left alone", () => {
  assert.deepEqual(splitLocale("/pricing"), { locale: "en", rest: "/pricing" });
  assert.deepEqual(splitLocale("/"), { locale: "en", rest: "/" });
});

test("a segment that merely starts with a locale is not a prefix", () => {
  // The bug this forecloses: `/article` read as Arabic plus `/ticle`.
  assert.deepEqual(splitLocale("/article"), { locale: "en", rest: "/article" });
  assert.deepEqual(splitLocale("/arabic-therapy"), { locale: "en", rest: "/arabic-therapy" });
});

test("a two-letter segment that is not a language we have is a page, not a prefix", () => {
  // `/fr/pricing` is a 404, and it is a 404 at `/fr/pricing` rather than
  // silently serving the English pricing page at a French-looking address.
  assert.deepEqual(splitLocale("/fr/pricing"), { locale: "en", rest: "/fr/pricing" });
});

/* ------------------------------------------------------------ the reverse -- */

test("English is unprefixed and Arabic is prefixed, from any starting point", () => {
  assert.equal(localisedPath("/pricing", "ar"), "/ar/pricing");
  assert.equal(localisedPath("/ar/pricing", "en"), "/pricing");
  assert.equal(localisedPath("/ar/pricing", "ar"), "/ar/pricing");
  assert.equal(localisedPath("/", "ar"), "/ar");
  assert.equal(localisedPath("/ar", "en"), "/");
});

test("localising twice is localising once", () => {
  // The switcher runs this on whatever path it is handed, which may already
  // carry a prefix. `/ar/ar/pricing` would be a 404 nobody could explain.
  for (const locale of LOCALES) {
    const once = localisedPath("/features", locale);
    assert.equal(localisedPath(once, locale), once);
  }
});

/* ------------------------------------------------- which paths get a URL -- */

test("the public site is localisable", () => {
  for (const path of ["/", "/pricing", "/for-patients", "/radar", "/integrations/zoom", "/t/abc"]) {
    assert.equal(isLocalisable(path), true, path);
    assert.equal(isLocalisable(localisedPath(path, "ar")), true, path);
  }
});

test("🔴 nothing private gets a second URL", () => {
  // C153, one sprint old: a second address for the same private bytes is a
  // second door. `/ar/patient/journal` would be exactly that, and the
  // middleware redirects it to the one address the record has.
  for (const path of [
    "/patient",
    "/patient/journal",
    "/dashboard",
    "/notes/123",
    "/admin",
    "/login",
    "/join/tok_abc",
    "/api/documents/1",
  ]) {
    assert.equal(isLocalisable(path), false, path);
    assert.equal(isLocalisable(`/ar${path}`), false, `/ar${path}`);
  }
});

/* --------------------------------------------------------------- hreflang -- */

test("every page declares every language, and x-default is English", () => {
  const { canonical, languages } = alternatesFor("/ar/pricing", "https://24t.ai");

  assert.equal(canonical, "https://24t.ai/ar/pricing");
  assert.equal(languages["x-default"], "https://24t.ai/pricing");
  assert.equal(languages.en, "https://24t.ai/pricing");
  assert.equal(languages.ar, "https://24t.ai/ar/pricing");
  for (const locale of LOCALES) assert.ok(languages[locale], `${locale} is missing`);
});

test("the two languages of one page agree about each other", () => {
  // A crawler that finds /ar/pricing pointing at /pricing, and /pricing
  // pointing somewhere else, treats them as rivals rather than translations.
  const arabic = alternatesFor("/ar/pricing", "https://24t.ai");
  const english = alternatesFor("/pricing", "https://24t.ai");

  assert.deepEqual(arabic.languages, english.languages);
  assert.equal(english.canonical, english.languages[DEFAULT_LOCALE]);
  assert.equal(arabic.canonical, arabic.languages.ar);
});

/* ------------------------------------------ round 1 of the simulation -- */

const source = async (file: string) => {
  const { readFileSync } = await import("node:fs");
  const { stripCommentsKeepingLines } = await import("../scripts/_dashes");
  return stripCommentsKeepingLines(readFileSync(file, "utf8"));
};

test("🔴 B34 the Arabic verify form and the printed link keep the reader's language", async () => {
  const form = await source("app/(public)/verify/page.tsx");
  assert.doesNotMatch(form, /action="\/verify"/, "the form posts to the English page");
  assert.match(form, /action=\{localisedPath\("\/verify", locale\)\}/);
  assert.doesNotMatch(form, /<main/, "a second <main> inside the layout's");
  const code = await source("app/(public)/verify/[code]/page.tsx");
  assert.match(code, /localisedPath\("\/verify", locale\)/, "the printed link lands on the English page");
  // The arithmetic the two rely on.
  assert.equal(localisedPath("/verify", "ar"), "/ar/verify");
  assert.equal(localisedPath("/verify", "en"), "/verify");
});

test("🔴 B35 no Suspense boundary sits above every public page, so a missing one is a 404", async () => {
  const { existsSync } = await import("node:fs");
  assert.equal(existsSync("app/(public)/loading.tsx"), false, "a site-wide loading boundary makes every 404 a 200");
  assert.equal(existsSync("app/pay/loading.tsx"), false, "/pay answers 200 with the not-found body");
  // The two routes that wanted a skeleton still have one, and a profile refuses above its own.
  assert.ok(existsSync("app/(public)/radar/loading.tsx") && existsSync("app/(public)/t/[id]/loading.tsx"));
  assert.match(await source("app/(public)/t/[id]/layout.tsx"), /notFound\(\)/);
});

test("🔴 B32 every legal page has an Arabic title, description and footer label", async () => {
  const { DICTIONARIES } = await import("../lib/i18n/messages");
  const { DEFAULT_PAGES } = await import("../lib/content/defaults");
  const legal = DEFAULT_PAGES.filter((page) => page.layout === "document").map((page) => page.slug);
  assert.ok(legal.length >= 4, `only ${legal.length} legal pages found`);
  const missing: string[] = [];
  for (const slug of legal) {
    for (const prefix of ["page.title", "page.desc", "page.nav"]) {
      const ar = (DICTIONARIES.ar as Record<string, string>)[`${prefix}.${slug}`];
      if (!ar || !/[؀-ۿ]/.test(ar)) missing.push(`${prefix}.${slug}`);
    }
  }
  assert.deepEqual(missing, []);
  // The page and the footer use them when the row served is not the reader's.
  assert.match(await source("app/(public)/[slug]/page.tsx"), /page\.englishBinding/);
  assert.match(await source("lib/content/service.ts"), /label: labelFor\(r, locale\)/);
  // The integrations page has no English literal heading left.
  assert.doesNotMatch(await source("app/(public)/integrations/page.tsx"), /What this connects to|title="HR systems"/);
});
