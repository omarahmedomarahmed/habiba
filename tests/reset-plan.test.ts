import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { NEVER_TRUNCATED, resetPlan, type ForeignKey } from "../scripts/reset";

/* Review fix: the dev reset never truncates audit_log, which refuses TRUNCATE (0189). */

const TABLES = ["audit_log", "organizations", "users", "patients", "sessions", "notes", "plans", "settings"];
const KEYS: ForeignKey[] = [
  { child: "audit_log", parent: "organizations" },
  { child: "audit_log", parent: "users" },
  { child: "users", parent: "organizations" },
  { child: "users", parent: "plans" },
  { child: "users", parent: "users" },
  { child: "patients", parent: "users" },
  { child: "sessions", parent: "patients" },
  { child: "sessions", parent: "users" },
  { child: "notes", parent: "sessions" },
];

test("audit_log is never truncated, and what it points at is deleted children first", () => {
  assert.deepEqual(NEVER_TRUNCATED, ["audit_log"]);
  const plan = resetPlan(TABLES, KEYS);
  assert.ok(!plan.truncate.includes("audit_log"));
  assert.ok(!plan.deleteInOrder.includes("audit_log"));
  /* users and organizations are what audit_log references; plans is what users references. */
  assert.deepEqual([...plan.deleteInOrder].sort(), ["organizations", "plans", "users"]);
  assert.ok(plan.deleteInOrder.indexOf("users") < plan.deleteInOrder.indexOf("organizations"));
  assert.ok(plan.deleteInOrder.indexOf("users") < plan.deleteInOrder.indexOf("plans"));
  assert.deepEqual(plan.truncate.sort(), ["notes", "patients", "sessions", "settings"]);
});

test("no table left to TRUNCATE is pointed at by one that is not truncated with it", () => {
  const plan = resetPlan(TABLES, KEYS);
  const truncated = new Set(plan.truncate);
  for (const key of KEYS) {
    if (truncated.has(key.parent)) assert.ok(truncated.has(key.child), `${key.child} -> ${key.parent}`);
  }
});

test("the reset truncates without CASCADE and names no kept table", () => {
  const source = readFileSync("scripts/reset.ts", "utf8");
  assert.doesNotMatch(source, /RESTART IDENTITY CASCADE/);
  assert.match(source, /const plan = resetPlan\(tables, await foreignKeys\(db\)\)/);
});
