import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Neon's WebSocket driver rather than a raw TCP pool.
 *
 * On a serverless host every concurrent invocation gets its own pool, so a
 * large per-instance pool multiplies into hundreds of Postgres connections
 * under load. (The old backend ran `max: 10` while issuing 8 concurrent queries
 * to build note context — two simultaneous session completions could exhaust
 * it.) Neon's proxy absorbs that fan-out, and unlike the HTTP driver this one
 * supports real interactive transactions, which the signup and join-link paths
 * both need.
 */
neonConfig.webSocketConstructor = ws;

function createPool() {
  return new Pool({ connectionString: env.databaseUrl, max: 1 });
}

const globalForDb = globalThis as unknown as { __24t_pool?: Pool };

const pool = globalForDb.__24t_pool ?? createPool();
if (!env.isProduction) globalForDb.__24t_pool = pool;

export const db = drizzle(pool, { schema });
export { schema };

/**
 * Detects a database that is unreachable or not yet migrated, so callers can
 * degrade instead of throwing. Used by the public site, which must render from
 * built-in defaults when the CMS tables are missing — otherwise a cold database
 * takes down the marketing site and, worse, the build.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /relation .* does not exist/i.test(message) ||
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|CONNECT_TIMEOUT/i.test(message) ||
    /Connection terminated|fetch failed|socket hang up/i.test(message)
  );
}
