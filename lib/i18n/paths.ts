import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./config";

/**
 * Arabic has a URL. PLAN.md 31.1, C103.
 *
 * ## 🔴 What was wrong
 *
 * The language lived in a cookie set by a server action, so `/ar/pricing` was
 * a **404**. The Arabic pages rendered well — 482 Arabic words against 30
 * Latin on pricing — and nobody could link to one, share one in a WhatsApp
 * group, or find one in a search engine. In the market this product is built
 * for. "The site is in Arabic" was true for a visitor and false for Google.
 *
 * ## The shape, and why it is a rewrite rather than a route group
 *
 * `/ar/pricing` is **rewritten** to `/pricing` with the locale on a header,
 * rather than duplicated as `app/[locale]/...`. Ten public routes exist today
 * and a parallel tree would be ten more files whose job is to be identical:
 * the first divergence between them would be a page that is only correct in
 * one language, which is precisely the class of defect 21R.8 spent a sprint
 * finding.
 *
 * The cookie stays as the **preference** (C103's ruling): a reader with no
 * prefix in the URL gets the language they last chose. The URL wins when there
 * is one, because a shared link has to open in the language it was shared in
 * even for somebody whose cookie says otherwise.
 *
 * ## English is unprefixed, deliberately
 *
 * `/pricing`, not `/en/pricing`. Every link in the product, every page already
 * indexed and every URL a clinician has put in a bio keeps working, and the
 * default carries `hreflang="x-default"` so a crawler knows which is which.
 * The cost is an asymmetry somebody has to remember; the alternative is
 * breaking every existing link to fix a cosmetic inconsistency.
 */

/**
 * How the middleware tells the render which language the URL asked for.
 *
 * A request header, set on the rewrite, so it exists for exactly one request
 * and cannot outlive the link that caused it.
 */
export const LOCALE_HEADER = "x-locale";

/** Locales that get a URL prefix. English is the unprefixed default. */
export const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

/**
 * Split a request path into its locale and the path underneath.
 *
 * Pure, so `lib/routing.ts` can strip the prefix before deciding anything and
 * the middleware's rules do not each have to know about languages.
 */
export function splitLocale(pathname: string): { locale: Locale; rest: string } {
  const match = /^\/([a-z]{2})(?=\/|$)/i.exec(pathname);
  const candidate = match?.[1]?.toLowerCase();

  if (!candidate || !isLocale(candidate) || candidate === DEFAULT_LOCALE) {
    return { locale: DEFAULT_LOCALE, rest: pathname };
  }

  const rest = pathname.slice(match![0].length) || "/";
  return { locale: candidate, rest };
}

/** The same page in another language. Used by the switcher and by `hreflang`. */
export function localisedPath(pathname: string, locale: Locale): string {
  const { rest } = splitLocale(pathname);
  if (locale === DEFAULT_LOCALE) return rest;
  return rest === "/" ? `/${locale}` : `/${locale}${rest}`;
}

/**
 * 🔴 Which paths get a translated URL at all.
 *
 * Only the public marketing site. A clinician's dashboard and a patient's app
 * are behind a login, are not indexed, and already switch language from the
 * cookie; giving them prefixes would double every internal link for no reader.
 * More to the point, `/ar/patient/journal` would be a second URL for somebody's
 * private record, and a second URL to the same private thing is the shape C153
 * ruled against one sprint ago.
 */
const PUBLIC_PREFIXES = [
  "/",
  "/radar",
  "/for-patients",
  "/features",
  "/pricing",
  "/contact",
  "/privacy",
  "/terms",
  "/hipaa",
  "/security",
  "/integrations",
  "/for-clinics",
  "/developers",
  "/verify",
  "/t",
];

export function isLocalisable(pathname: string): boolean {
  const { rest } = splitLocale(pathname);
  if (rest === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => prefix !== "/" && (rest === prefix || rest.startsWith(`${prefix}/`)),
  );
}

/**
 * The `alternates` block for a page's metadata. 31.1.
 *
 * Every public page declares every language it exists in, plus `x-default`
 * pointing at English. A crawler that finds `/ar/pricing` with no link back to
 * `/pricing` treats them as unrelated documents competing with each other,
 * which is worse for both than having one.
 */
export function alternatesFor(
  pathname: string,
  appUrl: string,
): { canonical: string; languages: Record<string, string> } {
  const { locale, rest } = splitLocale(pathname);

  const languages: Record<string, string> = {
    "x-default": `${appUrl}${localisedPath(rest, DEFAULT_LOCALE)}`,
  };
  for (const candidate of LOCALES) {
    languages[candidate] = `${appUrl}${localisedPath(rest, candidate)}`;
  }

  return { canonical: `${appUrl}${localisedPath(rest, locale)}`, languages };
}
