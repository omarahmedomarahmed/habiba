import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "../lib/db";
import {
  invoices,
  ledgerEntries,
  organizations,
  users,
} from "../lib/db/schema";
import {
  heldForTherapist,
  journal,
  postInvoicePaidByCard,
  postInvoiceRaised,
  postInvoiceSettledFromHeld,
  postInvoiceWrittenOff,
  postSessionPayment,
  postSessionRefund,
  trialBalance,
  UnbalancedTransaction,
  unbalancedTransactions,
} from "../lib/billing/ledger";

/**
 * The books, tested against a real database.
 *
 * Not a unit test with a fake: the whole value of double entry is that a sum
 * over real rows comes out at zero, and a mock that returns what it was told to
 * return proves nothing about the SQL. So this creates its own organisation and
 * clinician, posts every transaction shape the product can produce, asserts the
 * balances, and deletes everything it made.
 *
 * The scoped assertions matter as much as the totals — the shared database has
 * other people's ledger rows in it, so every check filters to this test's own
 * clinician rather than reading a platform-wide number and hoping.
 */

let organizationId: string;
let therapistId: string;
let invoiceId: string;

before(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ name: `ledger-test-${Date.now()}`, slug: `ledger-test-${Date.now()}` })
    .returning({ id: organizations.id });
  organizationId = org!.id;

  const [user] = await db
    .insert(users)
    .values({
      organizationId,
      email: `ledger-test-${Date.now()}@24therapy.test`,
      passwordHash: "x",
      firstName: "Ledger",
      lastName: "Test",
    })
    .returning({ id: users.id });
  therapistId = user!.id;

  const [invoice] = await db
    .insert(invoices)
    .values({
      organizationId,
      kind: "session",
      amountCents: 600,
      status: "due",
      description: "Completed session",
    })
    .returning({ id: invoices.id });
  invoiceId = invoice!.id;
});

after(async () => {
  await db.delete(ledgerEntries).where(eq(ledgerEntries.organizationId, organizationId));
  await db.delete(invoices).where(eq(invoices.organizationId, organizationId));
  await db.delete(users).where(eq(users.id, therapistId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});

/** Every leg this test's organisation owns, summed. Must always be zero. */
async function scopedBalance(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)::int` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.organizationId, organizationId));
  return row?.total ?? 0;
}

async function accountBalance(account: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)::int` })
    .from(ledgerEntries)
    .where(
      sql`${ledgerEntries.organizationId} = ${organizationId} AND ${ledgerEntries.account} = ${account}`,
    );
  return row?.total ?? 0;
}

test("an unbalanced transaction is refused, and writes nothing", async () => {
  await assert.rejects(
    () =>
      journal({
        kind: "adjustment",
        legs: [
          { account: "cash", amountCents: 100, organizationId, memo: "one leg only" },
        ],
      }),
    UnbalancedTransaction,
  );

  assert.equal(await scopedBalance(), 0, "a refused transaction must leave no rows");
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.organizationId, organizationId));
  assert.equal(row?.n, 0);
});

test("a destination charge puts only the fee on our books", async () => {
  await postSessionPayment({
    id: crypto.randomUUID(),
    organizationId,
    therapistId,
    capture: "destination",
    grossCents: 5000,
    platformFeeCents: 500,
    settledInvoiceCents: 0,
    therapistNetCents: 4500,
  });

  assert.equal(await scopedBalance(), 0);
  // Cash up by the fee and nothing else. The $50 the patient paid went into the
  // clinician's own account and must never appear as ours.
  assert.equal(await accountBalance("cash"), 500);
  assert.equal(await accountBalance("platform_revenue"), -500);
  assert.equal(await heldForTherapist(therapistId), 0, "nothing is held on a destination charge");
});

test("a platform capture records the whole charge and what we owe of it", async () => {
  await postSessionPayment({
    id: crypto.randomUUID(),
    organizationId,
    therapistId,
    capture: "platform",
    grossCents: 4000,
    platformFeeCents: 400,
    settledInvoiceCents: 0,
    therapistNetCents: 3600,
  });

  assert.equal(await scopedBalance(), 0);
  assert.equal(await accountBalance("cash"), 500 + 4000);
  assert.equal(await heldForTherapist(therapistId), 3600);
});

test("a bill raised and then cleared from held earnings nets out", async () => {
  await postInvoiceRaised({
    id: invoiceId,
    organizationId,
    amountCents: 600,
    description: "Completed session",
  });

  assert.equal(await accountBalance("therapist_receivable"), 600);
  // Every fee and bill so far: $5 destination fee, $4 held-capture fee, $6 bill.
  assert.equal(await accountBalance("platform_revenue"), -500 - 400 - 600);

  await postInvoiceSettledFromHeld({
    invoiceId,
    organizationId,
    therapistId,
    amountCents: 600,
    memo: "Completed session",
  });

  assert.equal(await scopedBalance(), 0);
  assert.equal(await accountBalance("therapist_receivable"), 0, "the debt is gone");
  // And we owe them $6 less than we did.
  assert.equal(await heldForTherapist(therapistId), 3600 - 600);
  // Revenue is untouched by *how* the bill was paid — it was recognised when
  // the bill was raised, and settling it moves an asset, not revenue.
  assert.equal(await accountBalance("platform_revenue"), -1500);
});

test("refunding a held payment takes it back out of what we owe", async () => {
  const heldBefore = await heldForTherapist(therapistId);

  await postSessionRefund({
    id: crypto.randomUUID(),
    organizationId,
    therapistId,
    capture: "platform",
    grossCents: 4000,
    platformFeeCents: 400,
    settledInvoiceCents: 0,
    therapistNetCents: 3600,
  });

  assert.equal(await scopedBalance(), 0);
  assert.equal(await heldForTherapist(therapistId), heldBefore - 3600);
  assert.equal(await accountBalance("cash"), 500 + 4000 - 4000);
});

test("a write-off leaves the platform out of pocket, visibly", async () => {
  const [second] = await db
    .insert(invoices)
    .values({
      organizationId,
      kind: "session",
      amountCents: 600,
      status: "due",
      description: "Second session",
    })
    .returning({ id: invoices.id });

  await postInvoiceRaised({
    id: second!.id,
    organizationId,
    amountCents: 600,
    description: "Second session",
  });
  await postInvoiceWrittenOff({
    invoiceId: second!.id,
    organizationId,
    amountCents: 600,
    memo: "Goodwill",
    adminUserId: null,
  });

  assert.equal(await scopedBalance(), 0);
  assert.equal(await accountBalance("therapist_receivable"), 0);
  assert.equal(await accountBalance("platform_expense"), 600, "the gift is an expense, not a hole");
});

test("a bill paid by card is cash in, not revenue twice", async () => {
  const [third] = await db
    .insert(invoices)
    .values({
      organizationId,
      kind: "session",
      amountCents: 600,
      status: "due",
      description: "Third session",
    })
    .returning({ id: invoices.id });

  const revenueBefore = await accountBalance("platform_revenue");
  const cashBefore = await accountBalance("cash");

  await postInvoiceRaised({
    id: third!.id,
    organizationId,
    amountCents: 600,
    description: "Third session",
  });
  await postInvoicePaidByCard({
    invoiceId: third!.id,
    organizationId,
    amountCents: 600,
    memo: "Third session",
  });

  assert.equal(await scopedBalance(), 0);
  assert.equal(await accountBalance("cash"), cashBefore + 600);
  assert.equal(
    await accountBalance("platform_revenue"),
    revenueBefore - 600,
    "revenue is recognised once, when the bill is raised",
  );
});

test("the platform-wide books balance and every transaction is complete", async () => {
  const books = await trialBalance();
  assert.equal(books.outOfBalanceCents, 0, "the whole ledger nets to zero");

  const broken = await unbalancedTransactions();
  assert.deepEqual(broken, [], "no transaction has a missing leg");
});

test("cleanup leaves nothing behind", async () => {
  const ids = await db
    .select({ id: ledgerEntries.id })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.organizationId, organizationId));
  assert.ok(ids.length > 0, "the test posted something to clean up");
  await db.delete(ledgerEntries).where(inArray(ledgerEntries.id, ids.map((r) => r.id)));
  assert.equal(await scopedBalance(), 0);
});
