import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { egpBackFor, egpShortfall, egpWithdrawable, payableEgpFor, stillHeldCents } from "../lib/billing/egp-books";
import { payoutSeparationProblem } from "../lib/billing/four-eyes";
import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * 0188: the money guards of the due diligence's workstream C, without a
 * database. The database half (the triggers, the posting key, the one
 * transaction) is in tests/ledger.test.ts, which needs one.
 */

const code = (path: string) => stripCommentsKeepingLines(readFileSync(path, "utf8"));
const bodyOf = (source: string, signature: string) => {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `${signature} is gone`);
  return source.slice(start, source.indexOf("\n}\n", start));
};

/* ------------------------------------------------------------ the pounds -- */

test("a clinician's pounds are their share of what the patient actually paid, rounded down", () => {
  // $20 + $0 VAT paid as EGP 1,000.00 (100,000 piastres); the clinician nets $17.
  assert.equal(payableEgpFor({ netCents: 1_700, paidCents: 2_000, collectedEgpMinor: 100_000 }), 85_000);
  // Never more than arrived, whatever the rounding.
  assert.equal(payableEgpFor({ netCents: 1, paidCents: 3, collectedEgpMinor: 100 }), 33);
  assert.equal(payableEgpFor({ netCents: 5_000, paidCents: 2_000, collectedEgpMinor: 100_000 }), 100_000);
  assert.equal(payableEgpFor({ netCents: 1_700, paidCents: 0, collectedEgpMinor: 100_000 }), 0);
});

test("a refund takes back the same share of the pounds it booked", () => {
  assert.equal(egpBackFor({ refundCents: 1_700, bookedCents: -1_700, bookedEgpMinor: -85_000 }), 85_000);
  assert.equal(egpBackFor({ refundCents: 850, bookedCents: -1_700, bookedEgpMinor: -85_000 }), 42_500);
  assert.equal(egpBackFor({ refundCents: 5_000, bookedCents: -1_700, bookedEgpMinor: -85_000 }), 85_000);
  assert.equal(egpBackFor({ refundCents: 1_700, bookedCents: -1_700, bookedEgpMinor: 0 }), 0, "no pounds booked, none back");
});

test("after a devaluation, more pounds can never go out than came in", () => {
  // Earned $17 when the pound was 50: EGP 850 came in for them.
  const books = { pricedEgpMinor: -85_000, unpricedCents: 0 };
  // The pound falls to 60. The old arithmetic would pay $17 x 60 = EGP 1,020.
  const withdrawable = egpWithdrawable({ ...books, rateMicro: 60_000_000 });
  assert.equal(withdrawable, 85_000);
  assert.equal(egpShortfall({ withdrawableEgpMinor: withdrawable, inFlightEgpMinor: 0, requestEgpMinor: 102_000 }), 17_000);
  assert.equal(egpShortfall({ withdrawableEgpMinor: withdrawable, inFlightEgpMinor: 0, requestEgpMinor: 85_000 }), 0);
  // Another approved payout counts first.
  assert.equal(egpShortfall({ withdrawableEgpMinor: withdrawable, inFlightEgpMinor: 50_000, requestEgpMinor: 40_000 }), 5_000);
});

test("legs that carry no pounds count at the request's own rate, as before 0188", () => {
  // $10 adjustment owed (unpriced, negative while owed) at 50: EGP 500.
  assert.equal(egpWithdrawable({ pricedEgpMinor: 0, unpricedCents: -1_000, rateMicro: 50_000_000 }), 50_000);
  // A payout that left carries its pounds (positive), so it comes off exactly.
  assert.equal(egpWithdrawable({ pricedEgpMinor: -85_000 + 40_000, unpricedCents: 0, rateMicro: 70_000_000 }), 45_000);
});

/* ------------------------------------------------------- the holding period -- */

test("earnings are held for the set days after the session ended, and released after", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const credits = [
    { cents: 1_700, endedAt: new Date(now.getTime() - 2 * day) },
    { cents: 2_000, endedAt: new Date(now.getTime() - 8 * day) },
    { cents: 500, endedAt: null },
  ];
  assert.equal(stillHeldCents(credits, 7, now), 2_200);
  assert.equal(stillHeldCents(credits, 0, now), 0, "0 days switches the hold off");
  assert.equal(stillHeldCents(credits, 1, now), 500);
  // A refunded session nets to nothing and holds nothing back.
  assert.equal(stillHeldCents([{ cents: 0, endedAt: now }], 7, now), 0);
});

/* ------------------------------------------------------ maker and checker -- */

test("whoever confirmed a transfer behind a payout does not approve it", () => {
  const base = { approvedByUserId: null, separate: true } as const;
  assert.equal(
    payoutSeparationProblem({ ...base, act: "approve", actorUserId: "ann", transferConfirmers: ["ann", "bob"] }),
    "confirmed_transfer",
  );
  assert.equal(payoutSeparationProblem({ ...base, act: "approve", actorUserId: "cat", transferConfirmers: ["ann"] }), null);
  assert.equal(
    payoutSeparationProblem({ ...base, separate: false, act: "approve", actorUserId: "ann", transferConfirmers: ["ann"] }),
    null,
    "the switch can turn it off, and is audited when it does",
  );
});

test("whoever approved a payout does not send it", () => {
  assert.equal(
    payoutSeparationProblem({ act: "send", actorUserId: "ann", transferConfirmers: [], approvedByUserId: "ann", separate: true }),
    "approved_it",
  );
  assert.equal(
    payoutSeparationProblem({ act: "send", actorUserId: "bob", transferConfirmers: [], approvedByUserId: "ann", separate: true }),
    null,
  );
});

test("the payout queue asks both separations, and the switch defaults on", () => {
  const payouts = code("lib/billing/payouts.ts");
  assert.match(bodyOf(payouts, "export async function approvePayout("), /transferConfirmerApproves\(/);
  for (const fn of ["export async function markPayoutSent(", "export async function sendViaProvider("]) {
    assert.match(bodyOf(payouts, fn), /approverSends\(/, `${fn} does not keep approver and sender apart`);
  }
  assert.match(bodyOf(payouts, "async function approverSends("), /payoutSeparationProblem\(/);
  assert.match(code("lib/settings/defs.ts"), /payoutSeparation: true,/);
  assert.match(code("lib/settings/defs.ts"), /earnings: \{ holdDays: 7 \}/);
});

/* ------------------------------------------------ provider timeout, double pay -- */

test("a send with no answer is unknown, and nothing sends or marks it until the provider says", () => {
  const payouts = code("lib/billing/payouts.ts");
  const send = bodyOf(payouts, "export async function sendViaProvider(");
  assert.match(send, /reference: row\.id/, "the provider's idempotency key must be the stable request id");
  assert.match(send, /threw = true/);
  assert.match(send, /providerState: unknown \? "unknown" : "failed"/);
  assert.match(bodyOf(payouts, "export async function markPayoutSent("), /providerState === "unknown"/);
  // The claim to send again only takes a request that is not unknown.
  assert.match(send, /providerState\} IS NULL OR \$\{payoutRequests\.providerState\} = 'failed'/);
  assert.match(payouts, /NOT IN \('sending', 'sent', 'unknown'\)/, "a reject must not land on money in flight");
  const recheck = bodyOf(payouts, "export async function recheckPayout(");
  assert.match(recheck, /fetchByReference\(row\.id\)/);
  assert.match(recheck, /providerState: "failed"/);
  assert.match(code("app/api/cron/[job]/route.ts"), /recheckUnknownPayouts\(\)/);
});

/* --------------------------------------------- the card payment and the books -- */

test("the card claim, the session and the books commit together or not at all", () => {
  const body = bodyOf(code("lib/billing/gateway/session.ts"), "export async function applyGatewayEvent(");
  const tx = body.indexOf("db.transaction(async (tx)");
  assert.ok(tx > 0, "no transaction around the card settlement");
  const claim = body.indexOf('.set({ state: "paid"');
  assert.ok(claim > tx, "the attempt is claimed outside the transaction");
  const inside = body.slice(tx);
  for (const call of ["claimSessionPaid(claimed.refId, tx)", "executor: tx", "postCardFee(claimed, payment.organizationId, tx)"]) {
    assert.ok(inside.includes(call), `${call} is not inside the transaction`);
  }
  assert.ok(/gateway_payment:\$\{claimed\.id\}:session/.test(inside), "the session posting has no posting key");
  // The gateway refund is a network call: after the commit, never inside.
  assert.ok(body.indexOf("returnAttempt(") > body.indexOf("});", tx));
  assert.match(code("app/api/cron/[job]/route.ts"), /sweepUnbookedGatewayPayments\(\)/);
});

test("a pot spend's five writes are one transaction", () => {
  const body = bodyOf(code("lib/billing/pot.ts"), "export async function payFromPot(");
  const tx = body.indexOf("controlDb.transaction(async (tx)");
  assert.ok(tx > 0);
  const end = body.indexOf("}).catch(", tx);
  const inside = body.slice(tx + "controlDb.transaction".length, end);
  assert.match(inside, /await tx\s*\.update\(sponsorPots\)/);
  assert.match(inside, /await tx\s*\.insert\(sessionPayments\)/);
  assert.match(inside, /await tx\s*\.update\(sessions\)/);
  assert.equal((inside.match(/executor: tx/g) ?? []).length, 2, "both postings ride on the transaction");
  assert.doesNotMatch(inside, /controlDb\./, "a write inside the spend escapes its transaction");
});

/* ------------------------------------------------------ the append-only books -- */

test("0188 makes the ledger append-only, keyed and balanced in the database", () => {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
  const tag = journal.entries.find((e) => e.tag.startsWith("0188_"))?.tag;
  assert.ok(tag, "0188 is not in the journal");
  const sql = readFileSync(join("drizzle", `${tag}.sql`), "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_posting_key_unique"/);
  assert.match(sql, /BEFORE UPDATE ON "ledger_entries"/);
  assert.match(sql, /CREATE CONSTRAINT TRIGGER "ledger_entries_txn_balances"[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.doesNotMatch(sql, /current_setting/, "no session setting may open the ledger");
});

test("nothing the product runs updates or deletes a ledger row", () => {
  const offenders: string[] = [];
  let read = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry)) {
        read += 1;
        const text = code(path);
        if (/\.(update|delete)\(ledgerEntries\)|(UPDATE|DELETE FROM)\s+ledger_entries/i.test(text)) offenders.push(path);
      }
    }
  };
  for (const dir of ["app", "components", "lib"]) walk(dir);
  assert.ok(read > 100, "the walk read nothing, so it proves nothing");
  assert.deepEqual(offenders, []);
  // Control: the pattern catches the shape it is for.
  assert.match("await db.update(ledgerEntries).set({})", /\.(update|delete)\(ledgerEntries\)/);
});
