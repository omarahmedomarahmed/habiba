import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { eq } from "drizzle-orm";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A09: search and paging on transfers, the audit log, errors and the radar
 * table. Each was capped with no search and nothing past the cap.
 */

const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));

test("one rule for a page and a search", async () => {
  const { paging, searchTerm, likePattern, hrefWith, pageOf, PAGE_SIZE } = await import("../lib/admin/paging");
  assert.deepEqual(paging({ page: "3" }), { page: 3, offset: 2 * PAGE_SIZE, fetch: PAGE_SIZE + 1 });
  assert.equal(paging({ page: "-4" }).page, 1);
  assert.equal(paging({ page: "abc" }).page, 1);
  assert.equal(searchTerm(" a "), null);
  assert.equal(searchTerm("  REF-123 "), "REF-123");
  assert.equal(likePattern("50%_off"), "%50\\%\\_off%");
  assert.equal(hrefWith("/admin/audit", { category: "auth", q: null, page: 1 }), "/admin/audit?category=auth");
  const more = pageOf(Array.from({ length: PAGE_SIZE + 1 }, (_, i) => i));
  assert.equal(more.rows.length, PAGE_SIZE);
  assert.equal(more.hasMore, true);
});

test("each list takes a search and a page, and the audit log shows its reasons", () => {
  const audit = read("app/(admin)/admin/audit/page.tsx");
  assert.match(audit, /listAuditLog\(\{ category, q, offset, limit: fetch \}\)/);
  assert.match(audit, /entry\.reason/);
  assert.match(read("app/(admin)/admin/transfers/page.tsx"), /queue\(\{ q, offset, limit: fetch \}\)/);
  assert.match(read("lib/billing/manual.ts"), /ilike\(manualPayments\.reference/);
  assert.match(read("app/(admin)/admin/errors/page.tsx"), /recentErrors\([^)]*\{ offset: [^}]*q \}\)/);
  assert.match(read("components/admin/radar-command.tsx"), /rows\.slice\(/);
});

test("the audit search finds a row by the words in its reason", async () => {
  const { controlDb: db } = await import("../lib/db");
  const { auditLog } = await import("../lib/db/schema");
  const { listAuditLog } = await import("../lib/data/admin");

  const marker = `w2a09-${Date.now()}`;
  const [row] = await db
    .insert(auditLog)
    .values({ category: "admin", action: "verify.w2a09", reason: `planted ${marker} by a test` })
    .returning({ id: auditLog.id });
  try {
    const found = await listAuditLog({ q: marker, limit: 5 });
    assert.equal(found.length, 1);
    assert.equal(found[0]!.reason, `planted ${marker} by a test`);
    assert.equal((await listAuditLog({ q: marker, limit: 5, offset: 1 })).length, 0);
  } finally {
    await db.delete(auditLog).where(eq(auditLog.id, row!.id));
  }
});

test("the overview counts clinicians and practices, not the console team (B26)", async () => {
  const { controlDb: db } = await import("../lib/db");
  const { organizations, users } = await import("../lib/db/schema");
  const { platformStats } = await import("../lib/data/admin");

  /*
   * Plants a staff account with the solo organisation every back office sign
   * up gets, an empty solo organisation, and one practising clinician. Only
   * the clinician and their practice may move the tiles. The old counts moved
   * by two clinicians and three practices, which is the control.
   */
  const tag = `b26-${Date.now()}`;
  const before = await platformStats();
  const orgIds: string[] = [];
  const userIds: string[] = [];
  try {
    for (const suffix of ["staff", "empty", "clinician"]) {
      const [org] = await db
        .insert(organizations)
        .values({ name: `${tag}-${suffix}`, slug: `${tag}-${suffix}` })
        .returning({ id: organizations.id });
      orgIds.push(org!.id);
    }
    for (const [index, role] of [[0, "staff"], [2, "therapist"]] as const) {
      const [user] = await db
        .insert(users)
        .values({
          organizationId: orgIds[index]!,
          email: `${tag}-${role}@example.com`,
          passwordHash: "x",
          firstName: "Tile",
          lastName: "Example",
          role,
        })
        .returning({ id: users.id });
      userIds.push(user!.id);
    }

    const after = await platformStats();
    assert.equal(after.clinicians - before.clinicians, 1, "a staff account counted as a clinician");
    assert.equal(after.organizations - before.organizations, 1, "a console account's organisation counted as a practice");
  } finally {
    for (const id of userIds) await db.delete(users).where(eq(users.id, id));
    for (const id of orgIds) await db.delete(organizations).where(eq(organizations.id, id));
  }
});
