import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { DICTIONARIES, type MessageKey } from "./messages";

/**
 * Which language this request is in.
 *
 * A cookie rather than a `/ar/` URL prefix, and that is a real trade with a
 * real cost. Prefixed routes are better for search engines — Arabic pages get
 * their own indexable URLs — and worse for everything else here: they mean
 * restructuring every route in the app under a `[locale]` segment, which is a
 * large diff through the exact files that handle payments, join tokens and
 * clinical records.
 *
 * The deciding factor is what the Arabic site is *for* right now. It is beta
 * testing with clinics in the Gulf while the company is established in the US;
 * nobody is trying to rank for Arabic search terms yet. When that changes, the
 * prefix can be added in front of this without any caller changing, because
 * every call site asks this function rather than reading the cookie itself.
 *
 * Accept-Language is consulted only when no cookie exists, so an explicit
 * choice always beats a browser default — somebody who switched to English on
 * an Arabic phone meant it.
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
  return { locale, t: translator(locale), dir: dirFor(locale) };
}
