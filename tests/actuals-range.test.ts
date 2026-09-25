import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * The actuals page's months: the newest ones when there are more than it
 * shows. It kept the first 36 from the earliest record, so a company in its
 * fourth year saw its first three and never the current month.
 */
test("the month range keeps the newest months, ending at this one", async () => {
  const { monthsUpTo } = await import("../lib/data/actuals");
  const now = new Date(Date.UTC(2029, 8, 25));
  const months = monthsUpTo("2025-01", now, 36);
  assert.equal(months.length, 36);
  assert.equal(months.at(-1), "2029-09");
  assert.equal(months[0], "2026-10");
  // Control: fewer months than the cap are all kept, from the first record.
  const young = monthsUpTo("2029-07", now, 36);
  assert.deepEqual(young, ["2029-07", "2029-08", "2029-09"]);
});
