/**
 * Two languages, and a rule that keeps them in step.
 *
 * The requirement is not "add Arabic" — it is that everything we build from
 * now on exists in Arabic. Those are different problems. The first is a
 * translation job that finishes; the second is a discipline that decays,
 * because the fiftieth string someone adds in a hurry is the one nobody
 * translates, and by then nothing tells you.
 *
 * So the dictionary is typed such that Arabic is not optional: `ar` is
 * declared as `Record<MessageKey, string>` where `MessageKey` comes from the
 * English dictionary. Add an English string without its Arabic counterpart and
 * `tsc` fails — the build, not a linter warning somebody can ignore. That is
 * the whole enforcement mechanism, and it is why the dictionaries are one flat
 * object per language rather than something more elegant.
 */

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The cookie is the whole locale mechanism. See `lib/i18n/server.ts`. */
export const LOCALE_COOKIE = "24t_locale";

const RTL = new Set<string>(["ar"]);

export function isRtl(locale: Locale): boolean {
  return RTL.has(locale);
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** What the switcher shows. Each language is named in itself, never translated. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

/**
 * Arabic-Indic digits are *not* used.
 *
 * Gulf Arabic UI overwhelmingly uses Western digits for times, prices and
 * counts, and a patient in crisis reading "٩٨٨" for the crisis line instead of
 * "988" is a worse outcome than a small loss of typographic authenticity.
 * `Intl` is given an explicit numbering system so a browser locale cannot
 * decide this for us.
 */
export function localeTag(locale: Locale): string {
  return locale === "ar" ? "ar-AE-u-nu-latn" : "en-US";
}
