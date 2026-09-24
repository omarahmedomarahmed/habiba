import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 🔴 C22 — THE CRON SECRET, COMPARED IN CONSTANT TIME AND READ FROM ONE PLACE.
 *
 * `!==` returns as soon as a character differs, and `?secret=` put the secret in
 * every access log between the caller and us. Vercel's cron and our own scripts
 * send `Authorization: Bearer`, so that is the only door. Both sides are hashed
 * first so the comparison never depends on their lengths.
 */
export function bearerMatches(request: Request, secret: string | null | undefined): boolean {
  if (!secret) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
