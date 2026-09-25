/**
 * Background images are admin-authored and end up inside a CSS `url()`, so a
 * value containing a quote or a parenthesis could break out of the declaration
 * and inject arbitrary CSS on a page that shares an origin — and a cookie
 * scope — with the clinician portal.
 *
 * Only absolute http(s) URLs survive. Characters that could escape the context
 * are rejected outright rather than escaped, because rejecting is verifiable
 * and escaping is a thing you get subtly wrong.
 *
 * Applied twice on purpose: once when an admin saves, and again at render time.
 * A value that reached the database some other way still cannot reach the page.
 */
/**
 * 🔴 AE61: a logo is a path on this site and nothing else.
 *
 * A competitor's or vendor's logo was kept as typed, so the public page loaded
 * it from whatever host was named, and that host learned the address of
 * every visitor who read our comparison. Logos are built-in artwork, served
 * from here like the backgrounds.
 */
export function safeLogoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /["'()\\\s<>]/.test(trimmed)) return null;
  return trimmed.startsWith("/") && !trimmed.startsWith("//") ? trimmed : null;
}

export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/["'()\\\s<>]/.test(trimmed)) return null;

  // Same-origin paths ("/backgrounds/waves.svg") are the built-in artwork and
  // carry no external dependency, so they are allowed alongside absolute URLs.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
