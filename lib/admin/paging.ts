/**
 * 🔴 W2-A09: search and paging for the console's long lists, one rule.
 *
 * The transfers queue, the audit log and the error list were each hard capped
 * (200) with no search and nothing past the cap, and the radar table had no
 * paging at all. An operator matching a bank line by its reference, or
 * answering "what did this person do last Tuesday", had the first 200 rows
 * and a browser's find. Every list now takes `?q=` and `?page=`, read here, so
 * the four agree on what a page is and what a search may contain.
 *
 * Pure, so the radar's client table and the server pages share it.
 */
export const PAGE_SIZE = 50;

/** One more than a page is fetched, so "is there an older page" needs no count query. */
export function paging(raw: { page?: string | null }): { page: number; offset: number; fetch: number } {
  const n = Number.parseInt(String(raw.page ?? "1"), 10);
  const page = Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : 1;
  return { page, offset: (page - 1) * PAGE_SIZE, fetch: PAGE_SIZE + 1 };
}

/** What a search box may send: trimmed, bounded, and nothing at all under two characters. */
export function searchTerm(raw: string | null | undefined): string | null {
  const q = String(raw ?? "").trim().slice(0, 100);
  return q.length >= 2 ? q : null;
}

/** An ILIKE pattern with the user's own `%` and `_` taken literally. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The same page with some parameters changed. Empty values drop out. */
export function hrefWith(base: string, params: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && String(value) !== "" && !(key === "page" && Number(value) === 1)) {
      query.set(key, String(value));
    }
  }
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

/** Split what was fetched into the page and whether there is more. */
export function pageOf<T>(rows: T[]): { rows: T[]; hasMore: boolean } {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}
