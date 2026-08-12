import "server-only";

import { desc, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { errorEvents } from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * Recording the errors nobody was seeing.
 *
 * There was no error reporting at all. `SENTRY_DSN` was read in `lib/env.ts`
 * and referenced nowhere else, and the security page told readers that "error
 * reporting strips request bodies and URLs, and session replay is disabled" —
 * a description of the behaviour of a system that did not exist. A patient in
 * crisis hitting a 500 on the join page was invisible to everyone.
 *
 * Kept in our own database rather than sent to a drain, and that is the load
 * bearing decision here rather than a matter of taste. An error thrown while
 * writing a note can carry a patient's words in a stack frame or a message.
 * Sending that to a third party is a disclosure, made by us, that nobody
 * consented to — and it is the exact disclosure this product spends the rest
 * of its code preventing. Here it lives under the same access control and the
 * same retention rules as the record it came from.
 *
 * The cost of that choice is real and worth stating: no alerting, no
 * aggregation across deployments, and if the database is the thing that is
 * broken then this records nothing. It is a floor, not a monitoring stack.
 */

/** Two hours of the same broken route is not two hours of new information. */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

/**
 * A path with every identifier taken out.
 *
 * `/sessions/8b1c…/room` and `/sessions/9f2a…/room` are one route with one
 * bug, and recording them separately both leaks an id and hides the pattern.
 * Anything that looks like a uuid, a long opaque token or a number becomes a
 * placeholder.
 */
export function scrubPath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
        return "[id]";
      }
      // Join and export tokens: long, random, and the whole credential.
      if (/^[A-Za-z0-9_-]{20,}$/.test(segment)) return "[token]";
      if (/^\d+$/.test(segment)) return "[n]";
      return segment;
    })
    .join("/");
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Messages interpolate whatever was to hand, which is sometimes a person. */
function scrubText(text: string, limit: number): string {
  return text
    .replace(EMAIL_RE, "[email]")
    .replace(UUID_RE, "[id]")
    .slice(0, limit);
}

/**
 * Route plus the top frame, hashed.
 *
 * Not the message. Messages carry ids, names and values, so fingerprinting on
 * them splits one bug into hundreds of groups and buries the fact that it is
 * one bug — which is the single thing an error list exists to tell you.
 */
function fingerprintOf(route: string, stack: string | null): string {
  const frame = (stack ?? "")
    .split("\n")
    .slice(1)
    .find((line) => line.includes("at "))
    ?.replace(/:\d+:\d+\)?$/, "")
    .trim();

  /*
   * FNV-1a rather than SHA-256, and not for speed.
   *
   * `node:crypto` cannot be imported here at all: this module is reached from
   * `instrumentation.ts`, which Next bundles for the edge runtime as well as
   * node, and webpack refuses the `node:` scheme when building that bundle.
   * The fix is not a polyfill — it is noticing that a grouping key has no
   * security property to preserve. Nothing depends on this being hard to
   * reverse; it only has to put the same bug in the same bucket.
   */
  const input = `${route}\n${frame ?? "no-frame"}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export async function recordError(input: {
  error: unknown;
  path: string;
  method?: string | null;
  kind?: "server" | "client";
  digest?: string | null;
}): Promise<void> {
  const error = input.error;
  const route = scrubPath(input.path.split("?")[0] ?? "/");
  const message = scrubText(
    error instanceof Error ? error.message : String(error),
    500,
  );
  const stack = error instanceof Error && error.stack ? scrubText(error.stack, 4000) : null;
  const fingerprint = fingerprintOf(route, stack);

  // Always to the log drain, even if the insert below fails — a broken
  // database is exactly when you most want the error to have gone somewhere.
  log.error("unhandled error", { route, fingerprint: fingerprint.slice(0, 8) });

  try {
    /*
     * One row per fingerprint per ten minutes.
     *
     * A route that throws on every request would otherwise write a row per
     * request — filling the table, waking the database continuously, and
     * making the admin list unreadable at exactly the moment somebody needs
     * to read it. The count is not lost; the timestamps of the surviving rows
     * still show it is happening constantly.
     */
    const [recent] = await db
      .select({ id: errorEvents.id })
      .from(errorEvents)
      .where(
        sql`${errorEvents.fingerprint} = ${fingerprint} and ${errorEvents.createdAt} > ${new Date(Date.now() - DEDUPE_WINDOW_MS)}`,
      )
      .limit(1);

    if (recent) return;

    await db.insert(errorEvents).values({
      fingerprint,
      route,
      method: input.method ?? null,
      kind: input.kind ?? "server",
      message,
      stack,
      digest: input.digest ?? null,
    });
  } catch {
    /*
     * Never throw from the error recorder.
     *
     * It runs inside a request that has already failed. Turning a 500 into a
     * 500 plus an unhandled rejection in the reporter helps nobody, and in a
     * serverless runtime it can take the whole invocation down.
     */
  }
}

/** Newest first, grouped by fingerprint, for the admin console. */
export async function recentErrors(limit = 100) {
  return db
    .select({
      id: errorEvents.id,
      fingerprint: errorEvents.fingerprint,
      route: errorEvents.route,
      method: errorEvents.method,
      kind: errorEvents.kind,
      message: errorEvents.message,
      stack: errorEvents.stack,
      digest: errorEvents.digest,
      createdAt: errorEvents.createdAt,
    })
    .from(errorEvents)
    .orderBy(desc(errorEvents.createdAt))
    .limit(limit);
}

/** Thirty days. Long enough to notice a pattern, short enough to stay small. */
export const ERROR_RETENTION_DAYS = 30;

export async function purgeOldErrors(): Promise<number> {
  const cutoff = new Date(Date.now() - ERROR_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const purged = await db
    .delete(errorEvents)
    .where(lt(errorEvents.createdAt, cutoff))
    .returning({ id: errorEvents.id });
  return purged.length;
}
