/**
 * 🔴 B7 — A PAGE WHOSE SCRIPT DID NOT ARRIVE IS RELOADED ONCE, not shown as broken.
 *
 * The first load of a patient's invite link, on a phone, showed the last-resort
 * error page. The server had answered 200 and logged no error; that load was the
 * only one of the run not followed by the page's own link prefetches, so the
 * page never hydrated. A script chunk that fails to arrive on mobile data is the
 * failure that fits, and it is transient: the same link loaded a minute later.
 * "Something went wrong" with a Try again that re-renders without refetching the
 * script is a dead end for a person holding an invite from their therapist.
 *
 * So a chunk failure reloads the page, once per path per half minute. The guard
 * is what stops a genuinely missing chunk (a stale tab after a deploy that
 * deleted it) from reloading forever: the second failure shows the page.
 */

const PATTERN = /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return PATTERN.test(`${typeof name === "string" ? name : ""} ${typeof message === "string" ? message : ""}`);
}

const WINDOW_MS = 30_000;

type Store = Pick<Storage, "getItem" | "setItem">;

/**
 * Whether to reload now. Pure over its inputs so the guard is testable; the
 * boundaries call `recoverFromChunkError`, which supplies the browser's.
 */
export function shouldReload(error: unknown, path: string, store: Store | null, now: number): boolean {
  if (!isChunkLoadError(error) || !store) return false;
  const key = `chunk-reload:${path}`;
  const stored = store.getItem(key);
  const last = stored === null ? Number.NaN : Number(stored);
  if (Number.isFinite(last) && now - last < WINDOW_MS) return false;
  store.setItem(key, String(now));
  return true;
}

/** Reloads and answers true when the error is a chunk that did not arrive. */
export function recoverFromChunkError(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  let store: Store | null = null;
  try {
    store = window.sessionStorage;
  } catch {
    /* Storage blocked: no guard, so no reload. The page shows as before. */
  }
  try {
    if (!shouldReload(error, window.location.pathname, store, Date.now())) return false;
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
