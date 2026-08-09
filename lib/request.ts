import "server-only";

import { headers } from "next/headers";

/**
 * Request metadata for audit records.
 *
 * Kept separate from `lib/auth/guard` so that the audit layer does not depend
 * on the routing layer — writing an audit row should not transitively import
 * `next/navigation` and everything it drags in.
 *
 * Both helpers tolerate being called outside a request scope (a cron job, a
 * script) and return null rather than throwing.
 */
export async function clientIp(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const forwarded = hdrs.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]!.trim();
    return hdrs.get("x-real-ip");
  } catch {
    return null;
  }
}

export async function clientUserAgent(): Promise<string | null> {
  try {
    const hdrs = await headers();
    return hdrs.get("user-agent")?.slice(0, 300) ?? null;
  } catch {
    return null;
  }
}
