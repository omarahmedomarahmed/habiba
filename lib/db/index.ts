import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { env } from "@/lib/env";
import { connectionStringFor, DEFAULT_REGION, REGIONS, type Region } from "./region";
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

/**
 * 🔴 30.1 / C118 — there is no `db` export any more, and that is the sprint.
 *
 * A bare `db` is a database you can reach without saying whose data it is. As
 * long as one exists, "every data call routes on the entity" is a convention,
 * and this codebase has now twice shipped a convention that some call sites
 * forgot (C84's timezone, C150's locale) and found the survivors in production.
 *
 * So the export is gone and there are two replacements, each of which is a
 * declaration:
 *
 *   - **`dbFor(region)`** — data that belongs to a person or a practice, in
 *     their jurisdiction.
 *   - **`controlDb`** — the control plane. Platform settings, content pages,
 *     locales, taxonomy, the directory of which region an entity is in. Global
 *     by definition: there is one copy and every region reads it.
 *
 * Choosing between them is a one-line decision that the compiler forces at
 * every call site, and the choice is then legible forever from the name. The
 * day Cairo is signed, `DATABASE_URL_EG` is set and nothing else changes.
 *
 * ## Why `controlDb` is not just `dbFor("us")`
 *
 * Because they mean different things and will diverge. `dbFor("us")` is
 * American patients' data; `controlDb` is the taxonomy of specialties. Today
 * they are the same Postgres. When Cairo exists, the control plane is still
 * one copy and American clinical data is still American, and a call site that
 * wrote `dbFor("us")` because it wanted settings would silently become wrong.
 */
const pools = new Map<string, Pool>();

const globalForDb = globalThis as unknown as { __24t_pools?: Map<string, Pool> };
const registry = globalForDb.__24t_pools ?? pools;
if (!env.isProduction) globalForDb.__24t_pools = registry;

function poolFor(url: string): Pool {
  const existing = registry.get(url);
  if (existing) return existing;

  const created = new Pool({ connectionString: url, max: 1 });
  registry.set(url, created);
  return created;
}

/*
 * The type comes from an actual call rather than from `ReturnType<typeof
 * drizzle<typeof schema>>`, which picks the wrong overload and collapses every
 * transaction callback's parameter to `any`. That showed up immediately as 231
 * implicit-any errors across the verifiers, which is the compiler doing its
 * job: a seam that silently loosened the types would have been worse than no
 * seam.
 */
function makeClient(url: string) {
  return drizzle(poolFor(url), { schema });
}

type Database = ReturnType<typeof makeClient>;

const clients = new Map<string, Database>();

function clientFor(url: string): Database {
  const existing = clients.get(url);
  if (existing) return existing;

  const created = makeClient(url);
  clients.set(url, created);
  return created;
}

/**
 * The database for somebody's data.
 *
 * `region` is required and has no default, deliberately. A default would be a
 * region a call site did not choose, which is the same defect as a timezone
 * the runtime supplied (C84): correct on the machine it was written on and
 * wrong for the person reading it.
 */
export function dbFor(region: Region): Database {
  return clientFor(connectionStringFor(region).url);
}

/**
 * The control plane. One copy, read by every region.
 *
 * Use it for anything that is a fact about the PRODUCT rather than about a
 * person: platform settings, country settings, content pages, `ui_strings`,
 * locales, taxonomy, and the directory that answers "which region is this
 * organisation in". If you are reaching for it to read somebody's sessions,
 * notes, documents or payments, it is the wrong one.
 */
export const controlDb: Database = clientFor(connectionStringFor(DEFAULT_REGION).url);

/**
 * A query that legitimately spans regions. PLAN.md 30.1, C154.
 *
 * ## 🔴 The fact this exists to make visible
 *
 * A clinician's caseload is not in one country. An American clinician seeing
 * an Egyptian patient has one chart in Cairo and the rest in Virginia, and
 * **there is no single query that returns both.** That is inherent to data
 * residency rather than a limitation of this implementation, and the expensive
 * version of finding it out is the day Cairo goes live, when a caseload list
 * quietly returns half a caseload.
 *
 * So the fan-out is a primitive now, while there is one database and the
 * results are identical either way. A list that must span regions calls this
 * and merges; a list that must not, does not. Both are legible from the call
 * site, today, rather than in a year.
 *
 * The ordering is the caller's problem, deliberately: merging two sorted sets
 * from two databases and calling it "sorted" is the kind of thing that works
 * until a page paginates.
 */
export async function acrossRegions<T>(
  fn: (db: Database, region: Region) => Promise<T[]>,
): Promise<T[]> {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const region of REGIONS) {
    const { url } = connectionStringFor(region);
    /*
     * Two regions pointing at one database today means one query, not two
     * identical ones. When Cairo is live the urls differ and both run.
     */
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(...(await fn(clientFor(url), region)));
  }

  return out;
}

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
