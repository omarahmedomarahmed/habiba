/**
 * DD-2 B2.1: the one check for a `next` a sign-in, a bounce or a second step
 * sends somebody to.
 *
 * `next.startsWith("/") && !next.startsWith("//")` let `/\evil.com` through,
 * and a browser reads a backslash as a slash, so that was a link off the site.
 * Pure, with no imports, so middleware, client code and the tests can use it.
 *
 * A safe `next` starts with one "/", its second character is neither "/" nor
 * "\", it holds no control character and no backslash, and resolved against a
 * placeholder origin it is still on that origin.
 */

const PLACEHOLDER = "https://x.invalid";
const MAX_LENGTH = 2048;

export function isSafeNext(next: unknown): next is string {
  if (typeof next !== "string") return false;
  if (next.length === 0 || next.length > MAX_LENGTH) return false;
  if (next[0] !== "/") return false;
  if (next[1] === "/" || next[1] === "\\") return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(next)) return false;
  if (next.includes("\\")) return false;
  /* Starting with "/" already rules out a scheme; the parse below is the backstop. */
  try {
    const url = new URL(next, PLACEHOLDER);
    return url.origin === PLACEHOLDER;
  } catch {
    return false;
  }
}

/** `next` when it is safe, otherwise `fallback`. */
export function safeNext(next: unknown, fallback: string): string {
  return isSafeNext(next) ? next : fallback;
}
