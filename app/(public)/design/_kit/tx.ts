/**
 * The two languages of every sample, side by side in the source.
 *
 * Design samples are not the product, so they do not go through the product's
 * dictionary: a sample exists to be approved or thrown away, and a key in
 * `lib/i18n/messages.ts` for every rejected idea would outlive the idea. What
 * they share with the product is the rule: nothing is drawn in one language
 * only (docs/TAKEOVER.md s10, "Both languages and 390px are not a later pass").
 */
export type Lang = "en" | "ar";

export function langOf(value: string | string[] | undefined): Lang {
  return value === "ar" ? "ar" : "en";
}

/** Pick the sentence for this language. Both are required, so neither can be forgotten. */
export function tx(lang: Lang, en: string, ar: string): string {
  return lang === "ar" ? ar : en;
}

/** Western digits in both languages: the app prints prices and times this way everywhere. */
export function money(lang: Lang, dollars: number): string {
  const n = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  return lang === "ar" ? `${n} $` : `$${n}`;
}
