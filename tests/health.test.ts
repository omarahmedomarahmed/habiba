import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/** The uptime check's endpoint must answer without waking the database. */

const FILE = "app/api/health/route.ts";

test("the health route imports nothing at all, so it cannot reach the database", () => {
  const source = readFileSync(FILE, "utf8");
  assert.doesNotMatch(source, /^\s*import\s/m, "the health route imports a module");
  assert.doesNotMatch(source, /import\(/, "the health route imports a module lazily");
});

test("it answers 200 with a small JSON body that is never cached", async () => {
  const { GET } = await import("../app/api/health/route");
  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = (await response.json()) as { ok: boolean };
  assert.equal(body.ok, true);
});
