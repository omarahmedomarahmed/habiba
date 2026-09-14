import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  earningsTransfers,
  ledgerEntries,
  users,
  type Entity,
  type LedgerAccount,
  type LedgerTxnKind,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/billing/ledger.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
  /**
   * 16.9 — which entity holds this leg. Defaults to `us`, which is what every
   * pre-sprint-16 posting was: one entity, one Stripe balance. A leg that
   * crosses entities is not a default, it is `postEntityTransfer`.
   */
  entity?: Entity;
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
      entity: leg.entity ?? "us",
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
 * 🔴 46.7 — the same balance, for a whole practice.
 *
 * The plan page shows a therapist what we hold for them beside what they owe
 * us, because 46.5 lets them choose which of the two settles a bill first and
 * a choice between two numbers is not a choice until both are on the screen.
 *
 * Scoped by organisation rather than by user, because the bill is the
 * practice's: an invoice is raised against `organizationId`, so netting it
 * against one clinician's personal balance inside a two-person practice would
 * quietly take one clinician's earnings to pay the other's session.
 */
export async function heldForTherapistOrg(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.account, "therapist_payable"),
        eq(ledgerEntries.organizationId, organizationId),
      ),
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
    /*
     * 🔴 THE OTHER TWO LIABILITIES, which this summary did not carry.
     *
     * Both are somebody else's money sitting in our bank, exactly as
     * `therapist_payable` is, and a cash figure quoted without them reads as a
     * balance rather than as a float. The pot has been a liability since 53.10
     * and never appeared here; `vat_payable` did not exist at all.
     */
    potsHeldCents: zero(-(byAccount.sponsor_pot ?? 0)),
    vatOwedCents: zero(-(byAccount.vat_payable ?? 0)),
    /*
     * 🔴 59.19 — what currency movement has cost us, as its own number.
     *
     * Positive is a loss. It is reported rather than folded into expense
     * because it is the one figure on this page nobody decided: it is what the
     * rate did between a session and a transfer, and a business that cannot see
     * it will eventually price as though it were zero.
     */
    fxDifferenceCents: zero(byAccount.fx_difference ?? 0),
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
  /**
   * 🔴 The tax the patient paid ON TOP of `grossCents`, which for four sprints
   * appeared in no account at all. See `vat_payable` in the schema.
   */
  vatCents: number;
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
  const vat = Math.max(0, payment.vatCents);

  /*
   * 🔴 C392, AS A THROW RATHER THAN A PARAGRAPH.
   *
   * A destination charge is Stripe, Stripe is the USD rail, and the USD rail is
   * every country except Egypt. VAT in this product is Egypt only, and Egypt
   * collects through its own gateway into its own entity, so a destination
   * charge carrying tax is a contradiction rather than an edge case.
   *
   * Left unchecked, the moment somebody set a non-zero VAT rate on a Stripe
   * country this branch would swallow the tax in silence: the connected account
   * is merchant of record, the whole charge including the tax line lands in the
   * clinician's balance, our application fee contains none of it, and we would
   * be telling the patient on their own bill that it went to a government while
   * relying on a clinician who may not be registered to send it there.
   *
   * Thrown at the moment of posting, like `audit`'s one-actor check and for the
   * same reason: this is the invariant the column split exists to hold, not a
   * defensive check against something that cannot happen.
   */
  if (payment.capture === "destination" && vat > 0) {
    throw new Error(
      "ledger: a destination charge collected VAT. Stripe is the USD rail and VAT is Egypt only, so that country's settings disagree with the two-currency model",
    );
  }

  if (payment.capture === "destination") {
    await journal({
      kind: "session_payment",
      refType: "session_payment",
      refId: payment.id,
      /*
       * 🔴 NO VAT LEG HERE, AND ON THIS PATH THERE IS NEVER ANY VAT TO POST.
       *
       * A destination charge is Stripe, Stripe is the USD rail, and the USD rail
       * is every country except Egypt. VAT in this product is Egypt only, and
       * Egypt collects through its own gateway into its own entity. So
       * `vatCents` is structurally zero here, and the assertion below says so
       * rather than trusting it.
       *
       * 🔴 THE ASSERTION IS THE POINT. Without it this branch would silently
       * swallow a tax the moment somebody enabled a non-zero VAT rate on a
       * Stripe country: the connected account is merchant of record, the whole
       * charge including a tax line would land in the clinician's balance, our
       * application fee contains none of it, and we would be telling the patient
       * on their own bill that it went to a government while relying on a
       * clinician who may not be registered to send it there. That is C392, and
       * it is now a thrown error at the moment of posting rather than a
       * paragraph somebody reads later.
       */

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
      /*
       * 🔴 GROSS PLUS VAT, because that is what arrived.
       *
       * The patient was charged the price and the tax as two Stripe line items
       * and both cleared into our balance. Recording only the price left the
       * books short by every VAT cent held, in the one direction that looks
       * fine: cash too low never trips a reconciliation that compares our own
       * numbers to each other.
       */
      { account: "cash", amountCents: payment.grossCents + vat, organizationId: org, memo: "Session payment captured by the platform" },
      {
        /*
         * 🔴 Negative, because a liability rises with a negative amount, the
         * same convention `therapist_payable` and `sponsor_pot` carry. This is
         * somebody else's money sitting in our account until it is remitted.
         */
        account: "vat_payable",
        amountCents: -vat,
        organizationId: org,
        memo: "VAT collected from the patient, owed to the tax authority",
      },
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
  /**
   * 🔴 Returned to the patient too, because `refunds.create` is sent with no
   * `amount` and refunds the whole charge, tax line included. The books said
   * otherwise: cash came back by the price alone, so a refunded payment left
   * the ledger holding a VAT liability against money that had gone.
   */
  vatCents: number;
  platformFeeCents: number;
  settledInvoiceCents: number;
  therapistNetCents: number;
}): Promise<void> {
  const org = payment.organizationId;
  const user = payment.therapistId;
  const ourFee = payment.platformFeeCents - payment.settledInvoiceCents;
  const vat = Math.max(0, payment.vatCents);

  const legs: Leg[] =
    payment.capture === "destination"
      ? [
          { account: "cash", amountCents: -payment.platformFeeCents, organizationId: org, memo: "Application fee returned" },
          { account: "platform_revenue", amountCents: ourFee, organizationId: org, userId: user, memo: "Platform fee reversed" },
        ]
      : [
          { account: "cash", amountCents: -(payment.grossCents + vat), organizationId: org, memo: "Session payment refunded" },
          {
            account: "vat_payable",
            amountCents: vat,
            organizationId: org,
            memo: "VAT returned with the refund, so it is no longer owed",
          },
          { account: "platform_revenue", amountCents: ourFee, organizationId: org, userId: user, memo: "Platform fee reversed" },
          {
            account: "therapist_payable",
            amountCents: payment.therapistNetCents,
            organizationId: org,
            userId: user,
            memo: "Held earnings reversed. The session was refunded",
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

/* --------------------------------------------------- §3c · the two rails -- */

/**
 * A manual EGP payout actually left the Egyptian entity's bank account. 16.2.
 *
 * Posted at **sent**, not at approved and not at confirmed. Approval is a
 * decision and confirmation is a receipt; the money leaves when somebody
 * presses send at the bank, and the books have to say so on that day or the
 * daily reconciliation is out by the size of the queue.
 *
 * The amount is in settlement cents (USD) — the same unit as the held balance
 * it discharges. What was actually transferred in EGP, and at what frozen
 * rate, is on the payout request, because that is the number a therapist
 * disputes and it must not be re-derived from a rate that has since moved.
 */
export async function postManualPayout(input: {
  requestId: string;
  organizationId: string;
  therapistId: string;
  amountCents: number;
  entity: Entity;
  sentByUserId: string;
}): Promise<string> {
  return journal({
    kind: "manual_payout",
    refType: "payout_request",
    refId: input.requestId,
    createdBy: input.sentByUserId,
    legs: [
      {
        account: "therapist_payable",
        amountCents: input.amountCents,
        organizationId: input.organizationId,
        userId: input.therapistId,
        entity: input.entity,
        memo: "Manual payout sent",
      },
      {
        account: "cash",
        amountCents: -input.amountCents,
        organizationId: input.organizationId,
        entity: input.entity,
        memo: "Manual payout sent",
      },
    ],
  });
}

/**
 * Money moved between the two entities. 16.9.
 *
 * 🔴 **Never an accounting side effect.** The two cross-border crossings of
 * §3c end with one entity holding cash and the other owing the clinician, and
 * the temptation is to net them at read time — which produces a balance that
 * is correct on a screen and unsupportable in an audit. This is the explicit,
 * audited event instead: cash leaves one entity and arrives at the other, in
 * one transaction that cannot be half-applied.
 */
export async function postEntityTransfer(input: {
  organizationId: string;
  fromEntity: Entity;
  toEntity: Entity;
  amountCents: number;
  /**
   * 🔴 59.19 / C339 — WHAT ACTUALLY ARRIVED, when it is not what left.
   *
   * §3c freezes a rate onto a transaction so a receipt and its refund read the
   * same number, and that has a consequence: money collected in EGP at
   * Tuesday's rate and moved on Friday arrives as a different number of
   * dollars than Tuesday said.
   *
   * Omit it and the transfer is exact, which is the only honest default for a
   * same-currency move. Supply it and the difference is posted to
   * `fx_difference` rather than absorbed into `platform_revenue`, where it
   * would read as margin we earned instead of a currency movement we did not
   * choose.
   */
  arrivedCents?: number;
  reason: string;
  adminUserId: string | null;
}): Promise<{ ok?: boolean; error?: string; txnId?: string }> {
  if (input.fromEntity === input.toEntity) {
    return { error: "A transfer between one entity and itself moves nothing." };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { error: "Enter a whole number of cents above zero." };
  }
  if (input.reason.trim().length < 5) return { error: "Say what this transfer is for." };

  const arrived = input.arrivedCents ?? input.amountCents;
  if (!Number.isInteger(arrived) || arrived <= 0) {
    return { error: "What arrived is a whole number of cents above zero." };
  }

  /*
   * 🔴 The difference, and its SIGN.
   *
   * `journal` refuses legs that do not sum to zero, so a transfer where less
   * arrived than left cannot be posted at all without this. The leg is the
   * balancing figure: positive when we lost on the movement, which is an
   * expense, and negative when we gained, which is the same convention
   * `platform_expense` carries and the reason this is not called "fx loss".
   */
  const difference = input.amountCents - arrived;

  const txnId = await journal({
    kind: "entity_transfer",
    createdBy: input.adminUserId,
    legs: [
      {
        account: "cash",
        amountCents: -input.amountCents,
        organizationId: input.organizationId,
        entity: input.fromEntity,
        memo: input.reason.trim(),
      },
      {
        account: "cash",
        amountCents: arrived,
        organizationId: input.organizationId,
        entity: input.toEntity,
        memo: input.reason.trim(),
      },
      {
        account: "fx_difference",
        amountCents: difference,
        organizationId: input.organizationId,
        entity: input.toEntity,
        memo: `Rate movement between ${input.fromEntity} and ${input.toEntity}`,
      },
    ],
  });

  log.info("entity transfer posted", {
    from: input.fromEntity,
    to: input.toEntity,
    amount: input.amountCents,
  });
  return { ok: true, txnId };
}

/**
 * C69 / 17.1 — a session fee taken out of what we already hold.
 *
 * This is the posting that makes *"the session pays for itself out of your
 * earnings"* a description of something that happens rather than a metaphor.
 * We owe them less and they owe us nothing new; no money moves anywhere, and
 * the two balances that meet here are the only two that ever should.
 *
 * Only reachable when `payouts.netFeeFromHeldEarnings` is on and there is
 * actually a held balance to take it from — see `lib/billing/service.ts`.
 */
export async function postFeeNettedFromHeld(input: {
  sessionId: string;
  organizationId: string;
  therapistId: string;
  amountCents: number;
  entity: Entity;
}): Promise<void> {
  if (input.amountCents <= 0) return;
  await journal({
    kind: "fee_netted",
    refType: "session",
    refId: input.sessionId,
    legs: [
      {
        account: "therapist_payable",
        amountCents: input.amountCents,
        organizationId: input.organizationId,
        userId: input.therapistId,
        entity: input.entity,
        memo: "Session fee taken from held earnings",
      },
      {
        account: "platform_revenue",
        amountCents: -input.amountCents,
        organizationId: input.organizationId,
        userId: input.therapistId,
        entity: input.entity,
        memo: "Session fee taken from held earnings",
      },
    ],
  });
}

/* ------------------------------------------------------- 16.8 · the proof -- */

/**
 * 🔴 **Money held is money owed**, checked rather than asserted. 16.8.
 *
 * Four questions, each of which has a right answer of zero, and each of which
 * is a different way the books can be wrong:
 *
 *   1. `outOfBalanceCents` — the whole journal nets to zero. A non-zero here
 *      means a transaction exists that `journal()` did not write.
 *   2. `unbalancedTxns` — the same failure, per transaction, so it can be
 *      found rather than only detected.
 *   3. `negativeHolds` — a clinician we owe a *negative* amount. That is money
 *      paid out that was never received, and it is the shape a double payout
 *      takes.
 *   4. `unbackedEntity` — an entity holding negative cash: paying out of a
 *      bank account that never took the money in, which is what the two
 *      cross-border crossings turn into if the `entity_transfer` is forgotten.
 *
 * Run daily. It is deliberately a *report* and not an alarm: it returns the
 * numbers and lets the caller decide, because an alarm nobody can interrogate
 * is an alarm that gets muted.
 */
export async function reconcile() {
  const balance = await trialBalance();
  const unbalanced = await unbalancedTransactions();

  const negativeHolds = await db
    .select({
      therapistId: ledgerEntries.userId,
      heldCents: sql<number>`(-SUM(${ledgerEntries.amountCents}))::int`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.account, "therapist_payable"))
    .groupBy(ledgerEntries.userId)
    .having(sql`SUM(${ledgerEntries.amountCents}) > 0`);

  const byEntity = await db
    .select({
      entity: ledgerEntries.entity,
      account: ledgerEntries.account,
      totalCents: sql<number>`SUM(${ledgerEntries.amountCents})::int`,
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.entity, ledgerEntries.account);

  const cashByEntity = byEntity.filter((r) => r.account === "cash");
  const heldByEntity = byEntity
    .filter((r) => r.account === "therapist_payable")
    .map((r) => ({ entity: r.entity, heldCents: -r.totalCents }));

  return {
    ...balance,
    unbalancedTxns: unbalanced,
    negativeHolds,
    cashByEntity: cashByEntity.map((r) => ({ entity: r.entity, cashCents: r.totalCents })),
    heldByEntity,
    /** An entity paying out of a bank account it never collected into. */
    unbackedEntity: cashByEntity.filter((r) => r.totalCents < 0).map((r) => r.entity),
    /**
     * 🔴 The one line a finance team reads. Zero, or the books are wrong and
     * this is by how much and in how many places.
     */
    balances:
      balance.outOfBalanceCents === 0 &&
      unbalanced.length === 0 &&
      negativeHolds.length === 0 &&
      cashByEntity.every((r) => r.totalCents >= 0),
  };
}

/**
 * Every held cent, traced. 16.8's other half.
 *
 * "Money held is money owed" is a claim about *provenance*, not only about a
 * sum: each held cent must trace to one payment in and at most one payout
 * out. This lists the transactions on one clinician's payable account with
 * what each of them refers to, so the trace can be walked by a person.
 */
export async function traceHeld(therapistId: string) {
  const rows = await db
    .select({
      txnId: ledgerEntries.txnId,
      kind: ledgerEntries.txnKind,
      refType: ledgerEntries.refType,
      refId: ledgerEntries.refId,
      amountCents: ledgerEntries.amountCents,
      entity: ledgerEntries.entity,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .where(
      and(eq(ledgerEntries.account, "therapist_payable"), eq(ledgerEntries.userId, therapistId)),
    )
    .orderBy(ledgerEntries.createdAt);

  const inCents = rows.filter((r) => r.amountCents < 0).reduce((t, r) => t - r.amountCents, 0);
  const outCents = rows.filter((r) => r.amountCents > 0).reduce((t, r) => t + r.amountCents, 0);

  return {
    entries: rows,
    inCents,
    outCents,
    heldCents: inCents - outCents,
    /** More than one payout against the same request is the double-pay bug. */
    duplicatePayouts: Object.entries(
      rows
        .filter((r) => r.kind === "manual_payout" && r.refId)
        .reduce<Record<string, number>>((acc, r) => {
          acc[r.refId!] = (acc[r.refId!] ?? 0) + 1;
          return acc;
        }, {}),
    )
      .filter(([, count]) => count > 1)
      .map(([refId]) => refId),
  };
}
