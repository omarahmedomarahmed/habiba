/**
 * The page change indicator's two signals, as window events.
 *
 * Founder, 26 September: "every page click and move from one page to another
 * happens with no indicator of loading". The router tells us when a navigation
 * STARTS (`instrumentation-client.ts`, which Next calls on the click itself,
 * for a Link, a `router.push` and the back button alike) and the indicator
 * decides it has ENDED when the path or the query it is watching changes.
 *
 * Events rather than a context, because the start signal comes from a module
 * Next loads before React exists, and because anything that navigates without
 * the router (the language switch, which refreshes in place) can raise the
 * same two signals without importing the indicator or sitting under it.
 *
 * No state lives here. It is two event names and two tiny dispatchers, so it
 * costs nothing in any bundle that imports it.
 */

export const NAV_START = "24t:nav-start";
export const NAV_DONE = "24t:nav-done";

export type NavStartDetail = {
  /** Where the navigation is going, when it is known. */
  href?: string;
  /**
   * Held until `doneNavProgress()` is called, rather than ended by the next
   * change of path. For work that changes the path part way through, like the
   * language switch moving `/pricing` to `/ar/pricing` before the page in the
   * new language has arrived.
   */
  hold?: boolean;
  /**
   * The logo veil at once instead of after 300ms. For a change the reader
   * asked to see the whole page redrawn by, where an in-between frame is
   * worse than a short veil.
   */
  veilNow?: boolean;
};

export function startNavProgress(detail: NavStartDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NavStartDetail>(NAV_START, { detail }));
}

export function doneNavProgress(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAV_DONE));
}
