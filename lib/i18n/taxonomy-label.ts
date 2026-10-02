import { en as ENGLISH, type MessageKey } from "./messages";

/**
 * The dictionary key for a stored language or specialty, or null when there is not one. 37L.2.
 *
 * The stored value IS the English label (`lib/data/taxonomy.ts` explains why), so
 * the key is derived from it: "Trauma & PTSD" is `spec.traumaPTSD`. A value with no
 * key (an admin's custom specialty) falls back to itself, which is the honest
 * answer: nobody has translated it.
 *
 * Here rather than in `lib/data/taxonomy.ts` because that module is server only,
 * and due diligence F18 found the radar card, the booking sheet, the public page
 * and the patient's explore rail printing the English value on Arabic screens:
 * the filters translated these and the components that show a clinician did not.
 */
export function taxonomyKey(kind: "language" | "specialty", code: string): MessageKey | null {
  const prefix = kind === "language" ? "lang" : "spec";
  const slug = code
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word, index) =>
      index === 0 ? word[0]!.toLowerCase() + word.slice(1) : word[0]!.toUpperCase() + word.slice(1),
    )
    .join("");
  const key = `${prefix}.${slug}`;
  return key in ENGLISH ? (key as MessageKey) : null;
}

/** DD-2: a stored language in the reader's language, or as stored when nobody translated it. */
export function languageLabel(code: string, t: (key: MessageKey) => string): string {
  const key = taxonomyKey("language", code);
  return key ? t(key) : code;
}

/** A stored specialty in the reader's language, or as stored when nobody translated it. */
export function specialtyLabel(code: string, t: (key: MessageKey) => string): string {
  const key = taxonomyKey("specialty", code);
  return key ? t(key) : code;
}
