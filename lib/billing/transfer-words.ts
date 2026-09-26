/**
 * 🔴 Board 364 (B50): WHAT A PAYER READS BESIDE AN ACCOUNT LINE, IN THEIR LANGUAGE.
 *
 * The transfer lines are the operator's own words, typed in settings, and an
 * Arabic /pay screen showed "Fastest option" beside InstaPay. The operator may
 * now give each line an Arabic name and note. Where they have not:
 *
 *   - the name is shown as typed, which is usually a rail's own name
 *     ("InstaPay") and reads the same to both readers
 *   - the note is left out on an Arabic screen: it is an aside, and an English
 *     sentence on an Arabic payment screen is the defect this closes
 *
 * Pure, so the rule is a test (`tests/board-care.test.ts`).
 */
export function transferFieldWords(
  field: { label: string; hint: string; labelAr?: string | null; hintAr?: string | null },
  locale: string,
): { label: string; hint: string } {
  if (locale !== "ar") return { label: field.label, hint: field.hint };
  return {
    label: field.labelAr?.trim() || field.label,
    hint: field.hintAr?.trim() || "",
  };
}
