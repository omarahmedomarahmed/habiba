/**
 * A per-tab identifier for an anonymous visitor.
 *
 * Exists for exactly one reason: so the server can tell "you are booking this
 * clinician" apart from "someone else is booking this clinician". Without it,
 * opening a booking sheet marked the clinician busy to *everyone including the
 * person in the sheet*, which is the bug this was written to fix.
 *
 * `sessionStorage`, not `localStorage`: it should die with the tab. A stale id
 * surviving for weeks would let an old tab reclaim a reservation, and there is
 * nothing here worth persisting.
 *
 * It is not a credential. Anyone who knew someone else's id could use it, and
 * the worst they could do is take a reservation they could have taken a minute
 * later anyway — the atomic claim still decides who actually books.
 */
const KEY = "24t_radar_viewer";

export function viewerId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;

    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Private browsing can refuse storage entirely. A per-load id still works
    // for the length of one visit, which covers the whole booking flow.
    return crypto.randomUUID();
  }
}
