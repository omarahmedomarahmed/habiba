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
