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

/**
 * The **preference**, not the mechanism. 31.1, C103.
 *
 * It was the whole mechanism until sprint 31, which is why `/ar/pricing` was a
 * 404. Now a URL prefix decides where there is one and this decides where
 * there is not: an unprefixed path, and everything behind a login.
 */
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

/**
 * The tag a **date** is formatted with. 37L.9.
 *
 * `en-GB`, not `en-US`, and the difference is not cosmetic: `12 September` and
 * `September 12` are read by different people, and everybody this product is
 * built for reads the first one. Every English date in the product had always
 * been `en-GB`; routing dates through `localeTag` to get Arabic silently
 * flipped all of them to American order, and the timezone test caught it in
 * the same commit that caused it.
 *
 * It is separate from `localeTag` because money is the other way round:
 * `formatMoney(2000, "USD", "en-GB")` is `US$20.00`, which is right for a
 * British reader and wrong on a screen where every price is in dollars. One
 * tag cannot be correct for both, so there are two, and each says what it is
 * for.
 */
export function dateTag(locale: Locale): string {
  return locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB";
}

/**
 * The same rule for a language that is not one of ours. 37L.9.
 *
 * The product has two locales; the *session report email* has four, because it
 * follows the language the session was held in (`lib/mail.ts`), and a French
 * sentence with an English date in the middle of it is worse than either. So
 * arbitrary BCP-47 tags reach `Intl` here rather than being flattened to `en`,
 * and the digits rule above is applied to any Arabic tag on the way through —
 * which is the part a call site would otherwise have to remember, and the
 * reason this is a function and not a comment.
 */
export function intlTag(language: string): string {
  const base = language.split("-")[0]?.toLowerCase();
  if (base !== "ar") return language;
  return language.includes("-u-nu-") ? language : `${language}-u-nu-latn`;
}

/**
 * 🔴 47.7 — the separator between items in a list, in the reader's language.
 *
 * Two screens joined names with a hardcoded Arabic comma (U+060C) and used it
 * in both languages, so an English reader met "Ahmed، Sara". It is the mirror
 * of C202: one punctuation mark cannot be right for two scripts, and the
 * version that looks wrong to half the readers is the one nobody notices,
 * because the people who would notice are not the people writing the code.
 *
 * `Intl.ListFormat` would also inflect the final conjunction, which is more
 * than these call sites want: a list of who can read your journal is a list,
 * not a sentence, and "Ahmed, Sara and Mona" reads as prose about them.
 */
export function listSeparator(locale: Locale): string {
  return locale === "ar" ? "، " : ", ";
}
