import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { LOCALE_HEADER } from "./paths";
import { DICTIONARIES, type MessageKey } from "./messages";

/**
 * Which language this request is in. PLAN.md 31.1, C103.
 *
 * Four answers, in this order, and the order is the whole design:
 *
 *   1. **The URL.** `/ar/pricing` is Arabic for everybody, cookie or no cookie.
 *   2. **The cookie.** An explicit choice, remembered, for paths with no prefix.
 *   3. **Accept-Language.** A browser default, which an explicit choice beats.
 *   4. English.
 *
 * Until sprint 31 there was no (1): the language lived only in the cookie, so
 * `/ar/pricing` was a **404** and no Arabic page could be linked, shared in a
 * WhatsApp group or indexed — in the market this product is built for. The
 * pages were there and rendered well; they simply had no address.
 *
 * The prefix went in *in front of* this function rather than through it, which
 * is why no caller changed: every call site has always asked here instead of
 * reading the cookie itself. That was the bet made when the cookie shipped, and
 * it paid.
 */
/**
 * 🔴 21.15 — a language turned off must not 404 anybody mid-visit.
 *
 * The behaviour, decided: **serve and stop advertising.** A reader whose
 * cookie names a language that is no longer public keeps reading it for the
 * rest of their visit; the switcher stops offering it, and the next person is
 * never sent there. The alternative — redirecting mid-visit — throws somebody
 * out of the page they were reading into a language they may not read, which
 * on a crisis page is the worst possible moment to do it.
 *
 * The cookie is not cleared either: a language switched off for a fortnight
 * and back on should find its readers where it left them.
 */
export async function getLocale(): Promise<Locale> {
  /*
   * 🔴 No request, no crash — the default language instead.
   *
   * `cookies()` and `headers()` throw outside a request: at build time, in a
   * verifier, in the render check that proves a page renders at all (19.0a).
   * A marketing page that cannot be *rendered by a script* is a page nobody
   * can check before deploying, and "English" is the honest answer where
   * there is no reader to ask.
   *
   * Deliberately not a silent catch around the whole function body: only the
   * request accessors are guarded, so a genuine failure inside the locale
   * logic still surfaces. And it is a `try`, not a `.catch()` — `cookies()`
   * throws **synchronously** outside a request, so the promise the first
   * version chained onto never existed.
   */
  /*
   * 🔴 The URL first. Set by the middleware's rewrite, never by a client.
   *
   * A header a browser could send would let a page be served in a language its
   * URL does not claim — one document at one address rendering two ways. The
   * middleware **deletes** it on every request before setting it, so what
   * arrives here is what the path said and nothing else.
   */
  const fromUrl = await read(async () => (await headers()).get(LOCALE_HEADER), null);
  if (isLocale(fromUrl)) return fromUrl;

  const chosen = await read(async () => (await cookies()).get(LOCALE_COOKIE)?.value, undefined);
  if (isLocale(chosen)) return chosen;

  const header = await read(async () => (await headers()).get("accept-language") ?? "", "");
  // Deliberately crude: the first tag wins and only Arabic is looked for.
  // Weighted q-value parsing would be more correct and would change the answer
  // for approximately nobody.
  if (/(^|,)\s*ar\b/i.test(header)) return "ar";

  return DEFAULT_LOCALE;
}

/** One request accessor, or the fallback when there is no request. */
async function read<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** `{name}` only. No plurals, no conditionals — see the note in messages.ts. */
export function format(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function translator(locale: Locale): Translate {
  const dictionary = DICTIONARIES[locale];
  return (key, values) => format(dictionary[key], values);
}

/**
 * Everything a server component needs, in one call.
 *
 * Returning `dir` alongside `t` is not a convenience — it is what stops the
 * two drifting. A component that translates its text and forgets its direction
 * produces Arabic laid out left to right, which is the single most common way
 * a "localised" interface announces that nobody localised it.
 */
export async function getI18n(): Promise<{ locale: Locale; t: Translate; dir: "rtl" | "ltr" }> {
  const { dirFor } = await import("./config");
  const locale = await getLocale();

  /*
   * 21.1 / 21.4 / 21.6 — an admin override wins, the shipped dictionary is the
   * default, and English is the floor.
   *
   * Read through `stringsFor`, which is cached by tag: a save invalidates it
   * and nothing serves last hour's wording because a timer had not fired. If
   * the override table is unreachable the dictionary answers on its own — the
   * interface never goes blank because a query failed.
   */
  try {
    const { stringsFor } = await import("./strings");
    const { t } = await stringsFor(locale);
    return { locale, t: t as Translate, dir: dirFor(locale) };
  } catch {
    return { locale, t: translator(locale), dir: dirFor(locale) };
  }
}
