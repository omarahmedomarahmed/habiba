import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq, inArray, sql } from "drizzle-orm";

import {
  invoices,
  ledgerEntries,
  organizations,
  users,
} from "../lib/db/schema";
import {
  heldForTherapist,
  journal,
  postInvoicePaid,
  postInvoiceRaised,
  postInvoiceSettledFromHeld,
  postInvoiceWrittenOff,
  postSessionPayment,
  postSessionRefund,
  trialBalance,
  UnbalancedTransaction,
  unbalancedTransactions,
} from "../lib/billing/ledger";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";

/*
 * 🔴 30.1 — an operator tool writes to the region its DATABASE_URL names.
 *
 * `dbFor(DEFAULT_REGION)` rather than a bare handle, because after this
 * sprint there is no bare handle: a script that plants fixtures is planting
 * them in a jurisdiction, and saying which one is the point. When Cairo is
 * live a script that needs to touch it passes "eg" and nothing else changes.
 */
const db = dbFor(DEFAULT_REGION);

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
    /*
     * 🔴 Zero, and structurally so. Stripe is the USD rail, VAT is Egypt only,
     * and Egypt collects through its own gateway. A non-zero number here now
     * throws rather than posting; the test below is the one that proves it.
     */
    vatCents: 0,
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
  /*
   * 🔴 AND NO VAT LIABILITY, which is the half a careless fix would get wrong.
   *
   * The connected account is the merchant of record, the whole charge including
   * the tax line lands in the clinician's balance, and our application fee
   * contains none of it. Posting a liability here would say we hold money that
   * never touched our bank.
   */
  assert.equal(
    await accountBalance("vat_payable"),
    0,
    "a destination charge leaves us owing no tax, because we collected none",
  );
});

test("a destination charge carrying VAT is refused, not quietly swallowed", async () => {
  /*
   * 🔴 C392. Stripe is the USD rail and VAT is Egypt only, so this combination
   * means a country's settings disagree with the two-currency model. Posting it
   * would put the tax in the clinician's balance while our bill tells the
   * patient it went to a government.
   */
  await assert.rejects(
    postSessionPayment({
      id: crypto.randomUUID(),
      organizationId,
      therapistId,
      capture: "destination",
      grossCents: 5000,
      vatCents: 700,
      platformFeeCents: 500,
      settledInvoiceCents: 0,
      therapistNetCents: 4500,
    }),
    /VAT is Egypt only/,
  );

  assert.equal(await scopedBalance(), 0, "and it wrote nothing on its way out");
});

test("a platform capture records the whole charge and what we owe of it", async () => {
  await postSessionPayment({
    id: crypto.randomUUID(),
    organizationId,
    therapistId,
    capture: "platform",
    grossCents: 4000,
    /*
     * 🔴 Charged on top and cleared into OUR balance, so both halves have to be
     * on the books: the cash we received and the tax we owe out of it. Before
     * this existed `cash` was posted at 4000 while 4560 had arrived.
     */
    vatCents: 560,
    platformFeeCents: 400,
    settledInvoiceCents: 0,
    therapistNetCents: 3600,
  });

  assert.equal(await scopedBalance(), 0);
  /* 🔴 The tax is in the cash figure, because the tax is in the bank. */
  assert.equal(await accountBalance("cash"), 500 + 4000 + 560);
  assert.equal(await heldForTherapist(therapistId), 3600);
  /*
   * 🔴 Negative, the liability convention `therapist_payable` and `sponsor_pot`
   * both carry. We are holding 560 that is not ours.
   */
  assert.equal(await accountBalance("vat_payable"), -560, "tax collected and not yet remitted");
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
    /* Refunded with the rest of the charge, so the liability goes with it. */
    vatCents: 560,
    platformFeeCents: 400,
    settledInvoiceCents: 0,
    therapistNetCents: 3600,
  });

  assert.equal(await scopedBalance(), 0);
  assert.equal(await heldForTherapist(therapistId), heldBefore - 3600);
  assert.equal(await accountBalance("cash"), 500 + 4000 + 560 - 4000 - 560);
  /*
   * 🔴 BACK TO ZERO. `refunds.create` is sent with no `amount`, so the whole
   * charge goes back including the tax line, and a liability left standing
   * against money that has gone is a number somebody would eventually remit.
   */
  assert.equal(await accountBalance("vat_payable"), 0, "nothing owed on a refunded payment");
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
  await postInvoicePaid({
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

test("🔴 59.19 / C339 an entity transfer that arrives short posts the difference", async () => {
  /*
   * §3c freezes a rate onto a transaction so a receipt and its refund read the
   * same number. The consequence: money collected in EGP at Tuesday's rate and
   * moved on Friday arrives as a different number of dollars.
   *
   * Without an account for it, `journal` refuses the transfer outright — the
   * legs do not sum to zero — or somebody absorbs the gap into
   * platform_revenue, where a currency movement nobody chose reads as margin
   * we earned. That is a business decision made by rounding.
   */
  const { postEntityTransfer } = await import("../lib/billing/ledger");

  const before = await accountBalance("fx_difference");

  const result = await postEntityTransfer({
    organizationId,
    fromEntity: "eg",
    toEntity: "us",
    amountCents: 100_000,
    arrivedCents: 99_400,
    reason: "Monthly sweep of the Egyptian entity",
    adminUserId: null,
  });

  assert.equal(result.ok, true, result.error ?? "");
  assert.equal(await scopedBalance(), 0, "the transaction still balances");
  assert.equal(
    await accountBalance("fx_difference"),
    before + 600,
    "🔴 positive is a loss, the same convention platform_expense carries",
  );
});

test("…and an exact transfer posts no difference leg at all", async () => {
  const { postEntityTransfer } = await import("../lib/billing/ledger");
  const before = await accountBalance("fx_difference");

  const result = await postEntityTransfer({
    organizationId,
    fromEntity: "us",
    toEntity: "eg",
    amountCents: 50_000,
    reason: "Same currency, nothing lost on the way",
    adminUserId: null,
  });

  assert.equal(result.ok, true, result.error ?? "");
  assert.equal(
    await accountBalance("fx_difference"),
    before,
    "journal drops a zero leg, so an exact transfer leaves no trace here",
  );
});

/*
 * 🔴 A12: THE HAND ADJUSTMENT. Its only screen posted `therapistId: null` on
 * every account, so a correction to what we hold for a clinician belonged to
 * nobody, and nothing made one form post once.
 */
test("🔴 A12 a hand adjustment to a clinician's balance must name the clinician", async () => {
  const { postAdjustment } = await import("../lib/billing/ledger");
  const held = await heldForTherapist(therapistId);

  const nobody = await postAdjustment({
    organizationId,
    therapistId: null,
    account: "therapist_payable",
    amountCents: -700,
    reason: "Owed for a session paid in cash",
    adminUserId: therapistId,
    idempotencyKey: crypto.randomUUID(),
  });
  assert.ok(nobody.error, "a payable leg with no clinician is money owed to nobody");

  const onOurs = await postAdjustment({
    organizationId,
    therapistId,
    account: "platform_expense",
    amountCents: 700,
    reason: "A clinician on our own expense account",
    adminUserId: therapistId,
    idempotencyKey: crypto.randomUUID(),
  });
  assert.ok(onOurs.error, "a clinician on an account no reader groups by clinician is refused");

  const named = await postAdjustment({
    organizationId,
    therapistId,
    account: "therapist_payable",
    amountCents: -700,
    reason: "Owed for a session paid in cash",
    adminUserId: therapistId,
    idempotencyKey: crypto.randomUUID(),
  });
  assert.equal(named.ok, true, named.error ?? "");
  assert.equal(
    await heldForTherapist(therapistId),
    held + 700,
    "CONTROL: named, the same adjustment reaches the clinician's held balance",
  );
  assert.equal(await scopedBalance(), 0);
});

test("🔴 A12 …and only a clinician of that practice", async () => {
  const { postAdjustment } = await import("../lib/billing/ledger");
  const stamp = Date.now();
  const [other] = await db
    .insert(organizations)
    .values({ name: `ledger-other-${stamp}`, slug: `ledger-other-${stamp}` })
    .returning({ id: organizations.id });
  const [stranger] = await db
    .insert(users)
    .values({
      organizationId: other!.id,
      email: `ledger-other-${stamp}@24therapy.test`,
      passwordHash: "x",
      firstName: "Other",
      lastName: "Practice",
    })
    .returning({ id: users.id });
  try {
    const result = await postAdjustment({
      organizationId,
      therapistId: stranger!.id,
      account: "therapist_payable",
      amountCents: -300,
      reason: "A clinician from another practice",
      adminUserId: therapistId,
      idempotencyKey: crypto.randomUUID(),
    });
    assert.ok(result.error, "another practice's clinician on this practice's books is refused");
  } finally {
    await db.delete(users).where(eq(users.id, stranger!.id));
    await db.delete(organizations).where(eq(organizations.id, other!.id));
  }
});

test("🔴 A12 one form posts once, however often and however fast it arrives", async () => {
  const { postAdjustment } = await import("../lib/billing/ledger");
  const key = crypto.randomUUID();
  const form = {
    organizationId,
    therapistId,
    account: "therapist_payable" as const,
    amountCents: -450,
    reason: "Double pressed on purpose by the test",
    adminUserId: therapistId,
    idempotencyKey: key,
  };

  const both = await Promise.all([postAdjustment(form), postAdjustment(form)]);
  const again = await postAdjustment(form);
  assert.ok(both.every((r) => r.ok) && again.ok, JSON.stringify([...both, again]));

  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.txnId, key));
  assert.equal(row?.n, 2, "one balanced pair under the form's key, not two or three");

  const reused = await postAdjustment({ ...form, amountCents: -900 });
  assert.ok(reused.error, "the same key with different figures is refused, not guessed at");

  const secondTab = await postAdjustment({ ...form, idempotencyKey: crypto.randomUUID() });
  assert.ok(secondTab.error, "a second tab's identical adjustment minutes later is refused");

  const meantIt = await postAdjustment({
    ...form,
    idempotencyKey: crypto.randomUUID(),
    reason: "A second session paid in cash, the same amount",
  });
  assert.equal(
    meantIt.ok,
    true,
    `CONTROL: a genuine second adjustment that says so still posts, ${meantIt.error ?? ""}`,
  );
  assert.equal(await scopedBalance(), 0);
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
