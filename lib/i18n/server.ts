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
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const header = (await headers()).get("accept-language") ?? "";
  // Deliberately crude: the first tag wins and only Arabic is looked for.
  // Weighted q-value parsing would be more correct and would change the answer
  // for approximately nobody.
  if (/(^|,)\s*ar\b/i.test(header)) return "ar";

  return DEFAULT_LOCALE;
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
