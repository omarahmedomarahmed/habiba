import assert from "node:assert/strict";
import { before, test } from "node:test";

import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

/**
 * 🔴 W2-Q01: an outer column inside a correlated subquery names its table.
 *
 * Drizzle renders `${organizations.id}` bare, as `"id"`, when the template is a
 * select field of a query with no join; inside a subquery Postgres then binds it
 * to the inner table's own `id`. These run the real board and traction queries
 * with the pool's `query` replaced, so the SQL each one would send is read back
 * without a database, and assert the subqueries compare with the outer row.
 */

const sent: string[] = [];

before(async () => {
  const { dbFor } = await import("../lib/db");
  dbFor("us");
  const fake = async (query: string | { text: string }) => {
    sent.push(typeof query === "string" ? query : query.text);
    return { rows: [], fields: [], rowCount: 0 };
  };
  const pools = (globalThis as { __24t_pools?: Map<string, Record<string, unknown>> }).__24t_pools;
  assert.ok(pools && pools.size > 0, "lib/db keeps its pools on globalThis outside production");
  for (const pool of pools.values()) {
    pool.query = fake;
    pool.connect = async () => ({ query: fake, release() {} });
  }
});

/** The SQL one call sends; empty rows make some callers throw after sending, which is fine. */
async function sqlOf(call: () => Promise<unknown>): Promise<string> {
  sent.length = 0;
  await call().catch(() => undefined);
  return sent.join("\n").replace(/\s+/g, " ");
}

test("qualified() names the table in a single-table select, a joined one, and under an alias", async () => {
  const { controlDb } = await import("../lib/db");
  const { qualified } = await import("../lib/db/qualified");
  const { users, organizations } = await import("../lib/db/schema");

  const inner = (outer: typeof users.id) => sql`(SELECT 1 FROM t v WHERE v.user_id = ${outer})`;

  // The defect itself, so this file notices if Drizzle ever changes it.
  const bare = controlDb.select({ x: inner(users.id) }).from(users).toSQL().sql;
  assert.match(bare, /v\.user_id = "id"\)/);

  assert.match(
    controlDb.select({ x: sql`(SELECT 1 FROM t v WHERE v.user_id = ${qualified(users.id)})` }).from(users).toSQL().sql,
    /v\.user_id = "users"\."id"\)/,
  );
  assert.match(
    controlDb
      .select({ x: sql`(SELECT 1 FROM t v WHERE v.user_id = ${qualified(users.id)})` })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.organizationId))
      .toSQL().sql,
    /v\.user_id = "users"\."id"\)/,
  );
  const u2 = alias(users, "u2");
  assert.match(
    controlDb.select({ x: sql`(SELECT 1 FROM t v WHERE v.user_id = ${qualified(u2.id)})` }).from(u2).toSQL().sql,
    /v\.user_id = "u2"\."id"\)/,
  );
});

test("the operator board counts each clinic's own clinicians, seats and due money", async () => {
  const { clinicsBoard } = await import("../lib/console/board");
  const query = await sqlOf(clinicsBoard);
  assert.match(query, /u\.organization_id = "organizations"\."id"/);
  assert.match(query, /cs\.organization_id = "organizations"\."id"/);
  assert.match(query, /i\.organization_id = "organizations"\."id"/);
});

test("the operator board counts a patient as sponsored or claimed only by their own person", async () => {
  const { patientsBoard } = await import("../lib/console/board");
  const query = await sqlOf(patientsBoard);
  assert.match(query, /e\.person_id = "patients"\."person_id"/);
  assert.match(query, /pa\.person_id = "patients"\."person_id"/);
});

test("traction counts a clinician as activated by their own completed sessions", async () => {
  const { tractionMetrics } = await import("../lib/data/vault");
  const query = await sqlOf(tractionMetrics);
  const matches = query.match(/s\.therapist_id = "users"\."id"/g) ?? [];
  assert.equal(matches.length, 3, query.slice(0, 600));
});

test("the verified-by and verified-on answers hold in a select from users alone", async () => {
  const { controlDb } = await import("../lib/db");
  const { users } = await import("../lib/db/schema");
  const { verifiedByBody, verifiedFlag, verifiedOn } = await import("../lib/data/verified");
  const query = controlDb
    .select({ by: verifiedByBody(), on: verifiedOn(), flag: verifiedFlag() })
    .from(users)
    .toSQL().sql;
  assert.equal((query.match(/v\.user_id = "users"\."id"/g) ?? []).length, 3, query);
});
