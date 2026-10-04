import { DICTIONARIES } from "./i18n/messages";
import { taxonomyKey } from "./i18n/taxonomy-label";

/**
 * The radar's search box: a clinician by name or by what they work with.
 *
 * Client side, over the clinicians already on the map. A specialty matches in
 * English and in Arabic whichever language the page is in, so "قلق" finds
 * Anxiety on the English page and "anxiety" finds it on the Arabic one.
 */

/**
 * Lower case, Latin accents dropped, and the Arabic spellings people actually
 * type folded together: hamza forms of alif to ا, ة to ه, ى to ي, no tashkeel
 * and no tatweel.
 */
export function normaliseSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type Searchable = { firstName: string; lastName: string | null; specialties: string[] };

/** Everything a query can hit for one clinician, already normalised. */
export function searchText(entry: Searchable): string {
  const parts = [entry.firstName, entry.lastName ?? ""];
  for (const specialty of entry.specialties) {
    parts.push(specialty);
    const key = taxonomyKey("specialty", specialty);
    if (key) parts.push(DICTIONARIES.en[key], DICTIONARIES.ar[key]);
  }
  return normaliseSearch(parts.join(" | "));
}

/** Every word of the query appears somewhere in the clinician's name or specialties. */
export function matchesSearch(entry: Searchable, query: string | undefined): boolean {
  const words = normaliseSearch(query ?? "").split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = searchText(entry);
  return words.every((word) => haystack.includes(word));
}
