import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  earningsTransfers,
  ledgerEntries,
  users,
  type LedgerAccount,
  type LedgerTxnKind,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * The books.
 *
 * Everything that moves money posts here, and the only way to post is `journal`,
 * which refuses a transaction whose legs do not sum to zero. That refusal is the
 * whole point: a caller that forgets a leg gets an exception at the moment of
 * the mistake instead of a balance that is quietly wrong for a month.
 *
 * Sign convention, repeated here because getting it backwards is silent: a
 * positive amount is a debit. Assets (`cash`, `therapist_receivable`) and
 * expenses go up with a positive number; liabilities (`therapist_payable`) and
 * revenue go up with a negative one.
 */

export type Leg = {
  account: LedgerAccount;
  amountCents: number;
  organizationId?: string | null;
  userId?: string | null;
  memo: string;
};

export class UnbalancedTransaction extends Error {
  constructor(kind: string, delta: number) {
    super(`Ledger transaction "${kind}" is out by ${delta} cents`);
    this.name = "UnbalancedTransaction";
  }
}

/**
 * Post one balanced transaction.
 *
 * Returns the transaction id so a caller can reverse it later, and refuses
 * outright if the legs do not net to zero — there is no "force" parameter and
 * there should never be one.
 */
export async function journal(input: {
  kind: LedgerTxnKind;
  legs: Leg[];
  refType?: string | null;
  refId?: string | null;
  createdBy?: string | null;
  /** Reuse an id to make a reversal traceable to what it reverses. */
  txnId?: string;
}): Promise<string> {
  const legs = input.legs.filter((leg) => leg.amountCents !== 0);
  if (legs.length === 0) return "";

  const delta = legs.reduce((total, leg) => total + leg.amountCents, 0);
  if (delta !== 0) throw new UnbalancedTransaction(input.kind, delta);

  const txnId = input.txnId ?? crypto.randomUUID();

  await db.insert(ledgerEntries).values(
    legs.map((leg) => ({
      txnId,
      txnKind: input.kind,
      account: leg.account,
      organizationId: leg.organizationId ?? null,
      userId: leg.userId ?? null,
      amountCents: leg.amountCents,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      memo: leg.memo,
      createdBy: input.createdBy ?? null,
    })),
  );

  return txnId;
}

/* ------------------------------------------------------------- balances -- */

/**
 * What we are holding for one clinician, in cents.
 *
 * Negated, because `therapist_payable` is a liability and liabilities carry a
 * negative balance under the convention above. Every caller wants "how much do
 * we owe them" as a positive number, and every caller getting that sign right
 * on its own is how one of them eventually gets it wrong.
 */
export async function heldForTherapist(therapistId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)::int` })
    .from(ledgerEntries)
    .where(
      and(eq(ledgerEntries.account, "therapist_payable"), eq(ledgerEntries.userId, therapistId)),
    );
  return zero(-(row?.total ?? 0));
}

/**
 * Negating a zero balance produces `-0`, which is not a curiosity here.
 *
 * `-0 === 0` is true but `Object.is(-0, 0)` is false, so a strict assertion
 * fails and `Math.sign` disagrees with itself — and every balance in this file
 * is produced by negating a sum, so a clinician who is owed nothing is exactly
 * the case that hits it. Caught by the ledger tests, which is what they are
 * for.
 */
function zero(value: number): number {
  return value === 0 ? 0 : value;
}

/** Everyone we are holding money for, largest first. For the admin console. */
export async function heldBalances() {
  const rows = await db
    .select({
      therapistId: ledgerEntries.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      payoutsEnabled: users.payoutsEnabled,
      stripeAccountId: users.stripeAccountId,
      heldCents: sql<number>`(-COALESCE(SUM(${ledgerEntries.amountCents}), 0))::int`,
    })
    .from(ledgerEntries)
    .innerJoin(users, eq(users.id, ledgerEntries.userId))
    .where(eq(ledgerEntries.account, "therapist_payable"))
    .groupBy(
      ledgerEntries.userId,
      users.firstName,
      users.lastName,
      users.email,
      users.payoutsEnabled,
      users.stripeAccountId,
    )
    .having(sql`SUM(${ledgerEntries.amountCents}) <> 0`);

  return rows.sort((a, b) => b.heldCents - a.heldCents);
}

/** The whole platform, one row per account. */
export async function trialBalance() {
  const rows = await db
    .select({
      account: ledgerEntries.account,
      totalCents: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)::int`,
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.account);

  const byAccount = Object.fromEntries(rows.map((r) => [r.account, r.totalCents])) as Record<
    LedgerAccount,
    number | undefined
  >;

  return {
    cashCents: zero(byAccount.cash ?? 0),
    heldForTherapistsCents: zero(-(byAccount.therapist_payable ?? 0)),
    owedByTherapistsCents: zero(byAccount.therapist_receivable ?? 0),
    revenueCents: zero(-(byAccount.platform_revenue ?? 0)),
    expenseCents: zero(byAccount.platform_expense ?? 0),
    /**
     * Zero if the books are sound. Anything else is a bug that has already
     * happened, and the number is how much of one.
     */
    outOfBalanceCents: zero(rows.reduce((total, r) => total + r.totalCents, 0)),
  };
}

/**
 * Transactions whose legs do not sum to zero.
 *
 * Should always be empty — `journal` cannot create one. It exists because the
 * assertion is worth being able to *run*, against real data, rather than
 * trusting that the only writer was always the only writer.
 */
export async function unbalancedTransactions() {
  const rows = await db
    .select({
      txnId: ledgerEntries.txnId,
      kind: ledgerEntries.txnKind,
      deltaCents: sql<number>`SUM(${ledgerEntries.amountCents})::int`,
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.txnId, ledgerEntries.txnKind)
    .having(sql`SUM(${ledgerEntries.amountCents}) <> 0`)
    .limit(50);
  return rows;
}

/** One clinician's own movements, newest first. */
export async function ledgerForTherapist(therapistId: string, limit = 100) {
  return db
    .select({
      id: ledgerEntries.id,
      txnId: ledgerEntries.txnId,
      txnKind: ledgerEntries.txnKind,
      account: ledgerEntries.account,
      amountCents: ledgerEntries.amountCents,
      memo: ledgerEntries.memo,
      refType: ledgerEntries.refType,
      refId: ledgerEntries.refId,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, therapistId))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit);
}

/** The whole journal, for an administrator. */
export async function recentLedger(limit = 200) {
  return db
    .select({
      id: ledgerEntries.id,
      txnId: ledgerEntries.txnId,
      txnKind: ledgerEntries.txnKind,
      account: ledgerEntries.account,
      amountCents: ledgerEntries.amountCents,
      memo: ledgerEntries.memo,
      userId: ledgerEntries.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .leftJoin(users, eq(users.id, ledgerEntries.userId))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit);
}

/* ------------------------------------------------- posting the real events -- */

/**
 * A patient paid for a session.
 *
 * Two shapes, because there are two ways the money can arrive:
 *
 * `destination` — Stripe routed the gross into the clinician's own account and
 * transferred our fee to us. Only the fee is ours and only the fee is on our
 * books. Writing the gross here would inflate every revenue figure on the
 * platform by an order of magnitude for money we never touched.
 *
 * `platform` — we took the whole charge, because Stripe had not verified the
 * clinician yet. All of it is in our balance and most of it is not ours, which
 * is the entire reason this file exists.
 */
export async function postSessionPayment(payment: {
  id: string;
  organizationId: string;
  therapistId: string;
  capture: "destination" | "platform";
  grossCents: number;
  platformFeeCents: number;
  settledInvoiceCents: number;
  therapistNetCents: number;
}): Promise<void> {
  const org = payment.organizationId;
  const user = payment.therapistId;
  // The fee we keep, after the part of it that cleared their own bills — that
  // part is revenue too, but it is invoice revenue and it is recognised when
  // the invoice is settled, not twice.
  const ourFee = payment.platformFeeCents - payment.settledInvoiceCents;

  if (payment.capture === "destination") {
    await journal({
      kind: "session_payment",
      refType: "session_payment",
      refId: payment.id,
      legs: [
        { account: "cash", amountCents: payment.platformFeeCents, organizationId: org, memo: "Application fee on a session payment" },
        { account: "platform_revenue", amountCents: -ourFee, organizationId: org, userId: user, memo: "Platform fee" },
        ...(payment.settledInvoiceCents > 0
          ? [
              {
                account: "therapist_receivable" as const,
                amountCents: -payment.settledInvoiceCents,
                organizationId: org,
                userId: user,
                memo: "24Therapy bills settled out of the session fee",
              },
            ]
          : []),
      ],
    });
    return;
  }

  await journal({
    kind: "session_payment",
    refType: "session_payment",
    refId: payment.id,
    legs: [
      { account: "cash", amountCents: payment.grossCents, organizationId: org, memo: "Session payment captured by the platform" },
      { account: "platform_revenue", amountCents: -ourFee, organizationId: org, userId: user, memo: "Platform fee" },
      ...(payment.settledInvoiceCents > 0
        ? [
            {
              account: "therapist_receivable" as const,
              amountCents: -payment.settledInvoiceCents,
              organizationId: org,
              userId: user,
              memo: "24Therapy bills settled out of the session fee",
            },
          ]
        : []),
      {
        account: "therapist_payable",
        amountCents: -payment.therapistNetCents,
        organizationId: org,
        userId: user,
        memo: "Held for the clinician until payouts are open",
      },
    ],
  });
}

/** A patient was refunded. Everything the payment posted, backwards. */
export async function postSessionRefund(payment: {
  id: string;
  organizationId: string;
  therapistId: string;
  capture: "destination" | "platform";
  grossCents: number;
  platformFeeCents: number;
  settledInvoiceCents: number;
  therapistNetCents: number;
}): Promise<void> {
  const org = payment.organizationId;
  const user = payment.therapistId;
  const ourFee = payment.platformFeeCents - payment.settledInvoiceCents;

  const legs: Leg[] =
    payment.capture === "destination"
      ? [
          { account: "cash", amountCents: -payment.platformFeeCents, organizationId: org, memo: "Application fee returned" },
          { account: "platform_revenue", amountCents: ourFee, organizationId: org, userId: user, memo: "Platform fee reversed" },
        ]
      : [
          { account: "cash", amountCents: -payment.grossCents, organizationId: org, memo: "Session payment refunded" },
          { account: "platform_revenue", amountCents: ourFee, organizationId: org, userId: user, memo: "Platform fee reversed" },
          {
            account: "therapist_payable",
            amountCents: payment.therapistNetCents,
            organizationId: org,
            userId: user,
            memo: "Held earnings reversed — the session was refunded",
          },
        ];

  if (payment.settledInvoiceCents > 0) {
    legs.push({
      account: "therapist_receivable",
      amountCents: payment.settledInvoiceCents,
      organizationId: org,
      userId: user,
      memo: "Bills settled from this payment are owed again",
    });
  }

  await journal({
    kind: "session_refund",
    refType: "session_payment",
    refId: payment.id,
    legs,
  });
}

/** 24Therapy billed a clinician. */
export async function postInvoiceRaised(invoice: {
  id: string;
  organizationId: string;
  amountCents: number;
  description: string;
}): Promise<void> {
  if (invoice.amountCents <= 0) return;
  await journal({
    kind: "invoice_raised",
    refType: "invoice",
    refId: invoice.id,
    legs: [
      { account: "therapist_receivable", amountCents: invoice.amountCents, organizationId: invoice.organizationId, memo: invoice.description },
      { account: "platform_revenue", amountCents: -invoice.amountCents, organizationId: invoice.organizationId, memo: invoice.description },
    ],
  });
}

/**
 * A clinician's 24Therapy bill cleared out of what we are holding for them.
 *
 * This is the "your credit pays your bills" path, and it is the one place two
 * balances that would otherwise be unrelated meet. No money moves at Stripe:
 * we owe them less and they owe us less, by the same amount, in one
 * transaction that cannot be half-applied.
 */
export async function postInvoiceSettledFromHeld(input: {
  invoiceId: string;
  organizationId: string;
  therapistId: string;
  amountCents: number;
  memo: string;
}): Promise<void> {
  if (input.amountCents <= 0) return;
  await journal({
    kind: "invoice_settled",
    refType: "invoice",
    refId: input.invoiceId,
    legs: [
      { account: "therapist_payable", amountCents: input.amountCents, organizationId: input.organizationId, userId: input.therapistId, memo: input.memo },
      { account: "therapist_receivable", amountCents: -input.amountCents, organizationId: input.organizationId, userId: input.therapistId, memo: input.memo },
    ],
  });
}

/** A clinician paid a bill by card. */
export async function postInvoicePaidByCard(input: {
  invoiceId: string;
  organizationId: string;
  amountCents: number;
  memo: string;
}): Promise<void> {
  if (input.amountCents <= 0) return;
  await journal({
    kind: "invoice_settled",
    refType: "invoice",
    refId: input.invoiceId,
    legs: [
      { account: "cash", amountCents: input.amountCents, organizationId: input.organizationId, memo: input.memo },
      { account: "therapist_receivable", amountCents: -input.amountCents, organizationId: input.organizationId, memo: input.memo },
    ],
  });
}

/** An administrator discounted or waived a bill. The cost is ours, and shows. */
export async function postInvoiceWrittenOff(input: {
  invoiceId: string;
  organizationId: string;
  amountCents: number;
  memo: string;
  /** Null when a standing credit applied itself, with no human in the moment. */
  adminUserId: string | null;
}): Promise<void> {
  if (input.amountCents <= 0) return;
  await journal({
    kind: "invoice_written_off",
    refType: "invoice",
    refId: input.invoiceId,
    createdBy: input.adminUserId,
    legs: [
      { account: "platform_expense", amountCents: input.amountCents, organizationId: input.organizationId, memo: input.memo },
      { account: "therapist_receivable", amountCents: -input.amountCents, organizationId: input.organizationId, memo: input.memo },
    ],
  });
}

/** Money actually left us and reached a clinician's Stripe account. */
export async function postEarningsTransfer(input: {
  transferId: string;
  organizationId: string;
  therapistId: string;
  amountCents: number;
}): Promise<void> {
  await journal({
    kind: "earnings_transfer",
    refType: "earnings_transfer",
    refId: input.transferId,
    legs: [
      { account: "therapist_payable", amountCents: input.amountCents, organizationId: input.organizationId, userId: input.therapistId, memo: "Released to the clinician's Stripe account" },
      { account: "cash", amountCents: -input.amountCents, organizationId: input.organizationId, memo: "Transfer out" },
    ],
  });
}

/**
 * An administrator moved a number by hand.
 *
 * Requires a reason and records who. An adjustment with no memo is how a
 * balance becomes unexplainable, and this is the one entry point where a human
 * can write whatever they like into the books.
 */
export async function postAdjustment(input: {
  organizationId: string;
  therapistId: string | null;
  account: LedgerAccount;
  amountCents: number;
  reason: string;
  adminUserId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const reason = input.reason.trim();
  if (reason.length < 5) return { error: "Say what this adjustment is for." };
  if (!Number.isInteger(input.amountCents) || input.amountCents === 0) {
    return { error: "Enter a whole number of cents, and not zero." };
  }

  await journal({
    kind: "adjustment",
    createdBy: input.adminUserId,
    legs: [
      {
        account: input.account,
        amountCents: input.amountCents,
        organizationId: input.organizationId,
        userId: input.therapistId,
        memo: reason,
      },
      // The other side is always ours. An adjustment is us deciding to be out
      // of pocket or better off; it never invents money from nowhere.
      {
        account: input.amountCents > 0 ? "platform_revenue" : "platform_expense",
        amountCents: -input.amountCents,
        organizationId: input.organizationId,
        memo: reason,
      },
    ],
  });

  log.info("ledger adjustment posted", {
    org: ref(input.organizationId),
    account: input.account,
    amount: input.amountCents,
  });
  return { ok: true };
}

/** One clinician's release history. */
export async function transfersForTherapist(therapistId: string, limit = 20) {
  return db
    .select()
    .from(earningsTransfers)
    .where(eq(earningsTransfers.therapistId, therapistId))
    .orderBy(desc(earningsTransfers.createdAt))
    .limit(limit);
}
