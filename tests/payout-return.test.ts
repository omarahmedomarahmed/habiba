import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A04: a payout marked sent that did not arrive can be marked so, and the
 * ledger post is reversed exactly once.
 *
 * The concurrency half (two presses, one reversal) needs migration 0140's
 * `returned` status and is in `scripts/verify-payout.ts`. This file proves the
 * shape without a database: the reversal is the exact mirror of the send, and
 * it rides on the guarded move the way W1-04's send does.
 */

type Row = { account: string; amountCents: number; userId: string | null; txnKind: string };

function capture(): { executor: never; rows: Row[] } {
  const rows: Row[] = [];
  /*
   * `journal()` reads through the executor too (which book an existing leg of
   * this transaction is on), so the fake answers any select chain with no rows.
   */
  const none: unknown = new Proxy(() => none, {
    get: (_t, key) => (key === "then" ? (resolve: (v: unknown[]) => void) => resolve([]) : none),
    apply: () => none,
  });
  const executor = {
    select: () => none,
    insert: () => ({
      values: (values: Row[]) => {
        rows.push(...values);
        return Promise.resolve();
      },
    }),
  };
  return { executor: executor as never, rows };
}

test("the reversal is the exact mirror of the send", async () => {
  const { postManualPayout, postManualPayoutReturned } = await import("../lib/billing/ledger");
  const common = {
    requestId: "00000000-0000-4000-8000-000000000001",
    organizationId: "00000000-0000-4000-8000-000000000002",
    therapistId: "00000000-0000-4000-8000-000000000003",
    amountCents: 6_000,
    entity: "eg" as const,
  };

  const sent = capture();
  await postManualPayout({ ...common, sentByUserId: "x", executor: sent.executor });
  const back = capture();
  await postManualPayoutReturned({
    ...common,
    actorUserId: "x",
    txnId: "00000000-0000-4000-8000-000000000004",
    executor: back.executor,
  });

  assert.equal(back.rows.reduce((t, r) => t + r.amountCents, 0), 0, "the reversal is unbalanced");
  for (const leg of sent.rows) {
    const mirror = back.rows.find((r) => r.account === leg.account && r.userId === leg.userId);
    assert.ok(mirror, `no reversing leg for ${leg.account}`);
    assert.equal(mirror!.amountCents, -leg.amountCents);
  }
  // Its own kind, so the duplicate-payout check still means "paid twice".
  assert.ok(back.rows.every((r) => r.txnKind === "manual_payout_returned"));
});

test("did not arrive rides on the guarded move from sent, like Mark sent", () => {
  const source = stripCommentsKeepingLines(readFileSync("lib/billing/payouts.ts", "utf8"));
  const start = source.indexOf("export async function markPayoutReturned(");
  assert.ok(start > 0, "there is no way to say a sent payout did not arrive");
  const body = source.slice(start, source.indexOf("\n}\n", start));

  assert.match(body, /from: \["sent"\]/);
  assert.match(body, /to: "returned"/);
  assert.match(body, /alsoPost: \(tx\) =>\s*postManualPayoutReturned\(/, "the reversal is not on the won move");
  assert.match(body, /reason\.length < 5/, "a reversal with no reason the clinician can read");

  const actions = stripCommentsKeepingLines(readFileSync("app/(admin)/admin/payouts/actions.ts", "utf8"));
  assert.match(actions, /export async function didNotArrive[\s\S]*?markPayoutReturned\(/);
  assert.match(readFileSync("components/admin/payout-queue.tsx", "utf8"), /didNotArrive/);
});

test("the database accepts the state only with its evidence", () => {
  const sql = readFileSync("drizzle/0140_a_payout_that_never_arrived.sql", "utf8");
  assert.match(sql, /'returned'/);
  assert.match(sql, /payout_requests_returned_was_sent/);
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: { tag: string; when: number }[];
  };
  const entry = journal.entries.find((e) => e.tag === "0140_a_payout_that_never_arrived");
  assert.equal(entry?.when, 1789966026000);
});
