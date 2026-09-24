import assert from "node:assert/strict";
import { test } from "node:test";

import { inArray } from "drizzle-orm";

/**
 * W2-A11: a sponsor's invoice number is unique per issuer, and a welcome
 * credit is not an invoice saying "Paid". Plants two companies on the dev
 * database with their ledger legs, and removes them (H29).
 */

test("two companies billed by one entity never share an invoice number, and a credit has none", async () => {
  const { controlDb: db } = await import("../lib/db");
  const { ledgerEntries, sponsors } = await import("../lib/db/schema");
  const { journal } = await import("../lib/billing/ledger");
  const { invoiceFor, topUpHistory } = await import("../lib/billing/invoice");

  const tag = `w2a11-${Date.now()}`;
  const made = await db
    .insert(sponsors)
    .values([
      { name: `${tag}-a`, kind: "company", entity: "us", currency: "usd" },
      { name: `${tag}-b`, kind: "company", entity: "us", currency: "usd" },
    ])
    .returning({ id: sponsors.id });
  const [a, b] = made;
  const txns: string[] = [];

  const topUp = async (sponsorId: string) => {
    const txnId = await journal({
      kind: "pot_topup",
      refType: "sponsor",
      refId: sponsorId,
      legs: [
        { account: "cash", amountCents: 50_000, memo: "test top-up" },
        { account: "sponsor_pot", amountCents: -50_000, memo: "test top-up" },
      ],
    });
    txns.push(txnId);
    return txnId;
  };
  const position = async (sponsorId: string, txnId: string) =>
    (await topUpHistory(sponsorId)).find((row) => row.txnId === txnId)?.position ?? 0;

  try {
    const first = await topUp(a!.id);
    const second = await topUp(b!.id);
    const credit = await journal({
      kind: "pot_topup",
      refType: "sponsor",
      refId: a!.id,
      legs: [
        { account: "platform_expense", amountCents: 10_000, memo: "test welcome credit" },
        { account: "sponsor_pot", amountCents: -10_000, memo: "test welcome credit" },
      ],
    });
    txns.push(credit);

    // Each company's first invoice used to be number 1 for both of them.
    const [pa, pb] = [await position(a!.id, first), await position(b!.id, second)];
    assert.ok(pa > 0 && pb > 0);
    assert.notEqual(pa, pb, "one issuer, two documents, one number");
    assert.equal(pb, pa + 1);

    assert.equal(await invoiceFor(a!.id, credit), null, "a welcome credit rendered as an invoice");
    const listed = await topUpHistory(a!.id);
    assert.deepEqual(listed.map((row) => row.txnId), [first], "the credit is listed as an invoice");
  } finally {
    if (txns.length) await db.delete(ledgerEntries).where(inArray(ledgerEntries.txnId, txns));
    await db.delete(sponsors).where(inArray(sponsors.id, made.map((row) => row.id)));
  }
});
