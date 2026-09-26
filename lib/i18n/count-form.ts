import type { MessageKey } from "./messages";

/**
 * 🔴 B16, board 268 / 420 / 424: which form of a count's sentence to use.
 *
 * "1 seats", "1 people", "1 clinicians" were on screens because a count met a
 * noun through one string. The dictionary holds no plural logic (see the note
 * in messages.ts), so a counted sentence has four keys and the suffix is chosen
 * here: One and Two are their own words in Arabic (مقعد واحد، مقعدان), three to
 * ten take the plural (the bare key), and eleven and up take the singular
 * accusative (Many). English reads the same in all but One.
 *
 * Pure and shared, so the seat manager, the bills, the rosters and the admin
 * cards all pick the form the same way.
 */
export type CountForm = "" | "One" | "Two" | "Many";

export function countForm(n: number): CountForm {
  if (n === 1) return "One";
  if (n === 2) return "Two";
  if (n >= 11) return "Many";
  return "";
}

/**
 * The keys that have all four forms. A base listed here without its One, Two
 * and Many siblings is a compile error, so a counted sentence cannot ship with
 * a form missing in either language.
 */
export type CountedKey = {
  [K in MessageKey]: `${K}One` extends MessageKey
    ? `${K}Two` extends MessageKey
      ? `${K}Many` extends MessageKey
        ? K
        : never
      : never
    : never;
}[MessageKey];

/** The key for `n` of a counted sentence. */
export function countKey(base: CountedKey, n: number): MessageKey {
  return `${base}${countForm(n)}` as MessageKey;
}
