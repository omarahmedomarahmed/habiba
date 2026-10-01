/**
 * DD-2 B2.5: the idle timeout measures people, not requests.
 *
 * Every request used to move `last_seen_at`, so a room polling every five
 * seconds or a page refreshing itself kept an unattended screen signed in up
 * to the eight hour ceiling. Now only a person's own requests count: a page
 * they opened, a link they followed, a form they sent. Pure, with no imports,
 * so the client and the tests use the same rule as the server.
 *
 * Not activity:
 *   - a request carrying `x-24t-background: 1`, which every poll and
 *     keep-alive in the product sends (`backgroundFetch`);
 *   - a prefetch, which the router makes for links merely on screen;
 *   - `router.refresh()`, which the router marks by sending its whole tree
 *     with the root flagged "refetch" (Next 15). Pages that poll by refreshing
 *     land here. A refresh right after a form post is covered by the post.
 *
 * Something that must keep a session alive while nobody touches the screen
 * (a session in progress) says so explicitly with `keepSessionAlive`.
 */

export const BACKGROUND_HEADER = "x-24t-background";

type HeaderReader = { get(name: string): string | null };

/** Whether this request is somebody doing something, rather than a page doing it for them. */
export function isUserActivity(headers: HeaderReader): boolean {
  if (headers.get(BACKGROUND_HEADER) === "1") return false;
  if (headers.get("next-router-prefetch")) return false;
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch")) return false;
  if (headers.get("rsc") === "1" && isRefreshTree(headers.get("next-router-state-tree"))) return false;
  return true;
}

/** The router's state tree header, with its root marked for a full refetch. */
function isRefreshTree(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const tree = JSON.parse(decodeURIComponent(raw)) as unknown;
    return Array.isArray(tree) && tree[3] === "refetch";
  } catch {
    return false;
  }
}

/** `fetch` for a poll or keep-alive: never counts as somebody being here. */
export function backgroundFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(BACKGROUND_HEADER, "1");
  return fetch(input, { ...init, headers });
}
