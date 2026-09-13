import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  enrolments,
  ledgerEntries,
  patients,
  sessionPayments,
  sessions,
  sponsorPots,
  sponsors,
  users,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { getSettings, sessionMoney } from "@/lib/settings";

import { journal } from "./ledger";

/**
 * The corporate pot. PLAN.md 53.10 to 53.16, 53.21, C226, C232, C239, C244.
 *
 * ## 🔴 A PAYMENT METHOD, NOT A BILLING SYSTEM (C226)
 *
 * One new ledger account (`sponsor_pot`), one new funding source (`pot` on
 * `session_payments`), and one new crossing. No new session type, no parallel
 * invoice path, no second fee table. A pot-funded session is an ordinary
 * session that produced an ordinary `session_payments` row, and every screen
 * downstream — the earnings page, the receipt, the reconciliation — reads it
 * through the code that was already there.
 *
 * That is the whole of C226, and the temptation it rules out is real: a
 * corporate rail *looks* like it wants its own invoices, its own statements and
 * its own session kind, and every one of those would be a second place where
 * money is counted.
 *
 * ## 🔴 WE HOLD THE MONEY, AND THAT IS §3c's EXPOSURE, NOT A NEW ONE
 *
 * A pot is a prepayment: cash arrives months before any session spends it, and
 * it is spent by third parties. Holding funds and paying them out later is money
 * transmission, which is what 1.8 forbade and what §3c and C73 deliberately
 * reversed — "build it and ship it", with the row left permanently open as an
 * accepted risk.
 *
 * So the pot does not introduce that exposure, it extends it to a new
 * counterparty class. Two consequences are recorded here rather than discovered:
 *
 *   1. **C6 is no longer true as written.** It was closed with "only
 *      `capture: 'destination'` is reachable; 0 historical platform rows". A
 *      pot-funded session has no card charge at session time and no transfer for
 *      Stripe to make, so it is `capture: "platform"` — money on our balance,
 *      paid out later by `releaseHeldEarnings`, which is why that path still
 *      exists. `capture: "platform"` is reachable again.
 *   2. **C232's question is live and is a precondition, not a parallel task.**
 *      Whether unspent pot balance is a liability we may hold is the one thing
 *      counsel has to answer before a second deal, and it is the reason the
 *      account is modelled as a liability rather than as revenue.
 *
 * ## 🔴 VAT IS CHARGED ON THE TOP-UP, NOT ON THE SESSION (C241)
 *
 * The taxable supply is the prepayment from the sponsor, in the jurisdiction of
 * the entity that holds it. Charging VAT again when a session spends the pot
 * would tax the same money twice, and charging it in the *patient's* country
 * would invent a tax relationship between an employee and their employer's
 * purchase. So a pot-funded `session_payments` row has `vat_cents = 0`, and the
 * VAT lives on the top-up invoice where the money actually changed hands.
 *
 * C241 also gates the Egyptian entity: Egyptian e-invoicing is confirmed with
 * counsel BEFORE the Egyptian entity takes a corporate payment. `topUpPot`
 * refuses an `eg` sponsor in plain words rather than issuing a document we
 * cannot stand behind.
 *
 * ## 🔴 NO PAYER NAME ON A POT PAYMENT (C243, C244)
 *
 * `payer_name` stays NULL. It is the column a therapist surface reads, and
 * writing the employer's name into it would put "who pays for this patient" on
 * a clinician's earnings page — the exact leak C243 was raised about, arriving
 * through a column that already existed. A pot payment is identified by its
 * funding source, never by naming the payer.
 */

/** How much a pot may go below zero is per pot; this is what a missing pot gets. */
const NO_POT = { potId: null, balanceCents: 0, overdraftCents: 0 } as const;

export type PotSpend =
  | { paid: true; sponsorId: string; amountCents: number }
  | { paid: false; reason: "no_benefit" | "no_pot" | "insufficient" | "nothing_to_pay" };

/**
 * 🔴 53.21 — POT FIRST, ALWAYS. A badged patient never pays out of pocket
 * while their sponsor's pot has money in it.
 *
 * Called when a session is booked, before any pay link is shown. Everything it
 * needs is resolved from the session id: the patient row, the person behind it,
 * their ONE primary enrolment, and that sponsor's pot. Nothing is passed in,
 * because a caller that could pass a sponsor id could pass the wrong one.
 *
 * ## 🔴 It is safe to call twice
 *
 * The spend is claimed with a conditional UPDATE on
 * `payment_status = 'pending'`, and the ledger is posted only if that update
 * matched. Two booking paths both calling this, or a retry after a timeout,
 * cannot spend the pot twice — the same construction `settleSessionPayment`
 * uses, and for the same reason.
 */
export async function payFromPot(sessionId: string): Promise<PotSpend> {
  const [row] = await controlDb
    .select({
      sessionId: sessions.id,
      organizationId: sessions.organizationId,
      therapistId: sessions.therapistId,
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      personId: patients.personId,
      autoSettle: users.autoSettleFromEarnings,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return { paid: false, reason: "no_benefit" };
  if (row.priceCents <= 0 || row.paymentStatus !== "pending") {
    return { paid: false, reason: "nothing_to_pay" };
  }
  if (!row.personId) return { paid: false, reason: "no_benefit" };

  /*
   * 🔴 The ONE primary enrolment, and a paused one funds nothing.
   *
   * C249 says exactly one enrolment is primary and the patient chooses it, and a
   * partial unique index makes a second one impossible. C247's pause is a
   * separate column from removal on purpose: an unanswered re-verification stops
   * the funding and touches nothing else, so it is checked here and nowhere near
   * the record.
   */
  const [benefit] = await controlDb
    .select({ sponsorId: enrolments.sponsorId })
    .from(enrolments)
    .innerJoin(sponsors, eq(sponsors.id, enrolments.sponsorId))
    .where(
      and(
        eq(enrolments.personId, row.personId),
        eq(enrolments.isPrimary, true),
        eq(enrolments.state, "active"),
        isNull(enrolments.removedAt),
        isNull(enrolments.pausedAt),
        eq(sponsors.state, "active"),
      ),
    )
    .limit(1);

  if (!benefit) return { paid: false, reason: "no_benefit" };

  const pot = await potRow(benefit.sponsorId);
  if (!pot.potId) return { paid: false, reason: "no_pot" };

  const gross = row.priceCents;

  /*
   * 🔴 C239 — A SESSION THAT HAS STARTED ALWAYS COMPLETES AND IS ALWAYS PAID,
   * and the overdraft is how that is true without being unbounded.
   *
   * The balance may go below zero by at most the overdraft this sponsor was
   * granted, which the database also refuses to exceed. Past that the pot
   * cannot fund the booking and the patient is offered the ordinary pay link
   * rather than a session that quietly does not happen.
   *
   * A session ALREADY UNDER WAY is a different question and is not decided
   * here: this runs at booking. `sessions.payment_status` is never read by the
   * room, which is what makes that true rather than hopeful.
   */
  if (pot.balanceCents + pot.overdraftCents < gross) {
    log.info("pot cannot fund this booking", { session: ref(sessionId) });
    return { paid: false, reason: "insufficient" };
  }

  const settings = await getSettings();
  const money = sessionMoney({
    grossCents: gross,
    feeBps: settings.session.platformFeeBps,
    /*
     * 🔴 Zero, and the reason is above: the taxable supply was the top-up.
     * Passing the patient's country VAT here would tax the employer's money a
     * second time in a jurisdiction that has no claim on it.
     */
    vatBps: 0,
  });

  /*
   * The claim on the session, conditional on it still being unpaid. If this
   * matches nothing, another path already settled it and we must not spend the
   * pot: the pot debit below happens only inside this branch.
   */
  const [claimed] = await controlDb
    .update(sessions)
    .set({ paymentStatus: "paid", updatedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.paymentStatus, "pending")))
    .returning({ id: sessions.id });

  if (!claimed) return { paid: false, reason: "nothing_to_pay" };

  const [payment] = await controlDb
    .insert(sessionPayments)
    .values({
      organizationId: row.organizationId,
      therapistId: row.therapistId,
      sessionId,
      /* 🔴 C243 — NULL. The employer is never the payer name on a clinical surface. */
      payerName: null,
      payerEmail: null,
      grossCents: gross,
      currency: "usd",
      vatCents: 0,
      vatBps: 0,
      platformFeeCents: money.platformCutCents,
      platformFeeBps: settings.session.platformFeeBps,
      /*
       * 🔴 No invoice settlement out of a pot payment, and that is deliberate.
       *
       * Netting a clinician's own 24Therapy bills out of an employer's
       * prepayment would spend a third party's money on our receivable. C69's
       * netting is against money we hold FOR THE CLINICIAN; this is money we
       * hold for a sponsor.
       */
      settledInvoiceCents: 0,
      therapistNetCents: money.therapistNetCents,
      /*
       * 🔴 `platform`, and C6 is amended rather than quietly contradicted.
       *
       * There is no card charge at session time, so there is nothing for Stripe
       * to split. The money is already on our balance and leaves it later
       * through `releaseHeldEarnings`, which is the path this value selects.
       */
      capture: "platform",
      crossing: "pot_held_to_payout",
      status: "paid",
      paidAt: new Date(),
      fundingSource: "pot",
    })
    .returning({ id: sessionPayments.id });

  if (!payment) {
    /*
     * The session is marked paid and there is no payment row: that is a figure
     * that will not reconcile, so it is logged as the error it is rather than
     * swallowed. The unique index on `session_id` is the only realistic cause,
     * which means a payment already exists and the session is correctly paid.
     */
    log.warn("pot payment row not written", { session: ref(sessionId) });
    return { paid: false, reason: "nothing_to_pay" };
  }

  /*
   * 🔴 53.16 / C232 — ONE txn id across both halves, which is what makes
   * "every pot cent traces to one payment in and one session out" true.
   *
   * Two calls rather than one, because the legs of a `journal` call carry ONE
   * `ref_type`/`ref_id` pair and these two halves are about different things:
   * the first is the sponsor's pot going down, the second is the session
   * payment being distributed. They share the `txnId`, so the daily
   * reconciliation still sums each transaction to zero and a person auditing a
   * pot cent can walk from the pot leg to the session payment.
   *
   * The two `cash` legs cancel, and that cancellation is the statement: NO CASH
   * MOVES when a pot pays. It arrived at top-up.
   */
  const txnId = crypto.randomUUID();

  await journal({
    kind: "session_payment",
    txnId,
    /*
     * 🔴 The sponsor is on `ref_type`/`ref_id` and nowhere else.
     *
     * `ledger_entries` has `organization_id` and `user_id` and a sponsor is
     * neither (C259): an FK to `organizations` would be the join C244 forbids,
     * written into the ledger. The generic ref is what every sponsor figure in
     * `lib/data/sponsors.ts` queries.
     */
    refType: "sponsor",
    refId: benefit.sponsorId,
    legs: [
      {
        account: "sponsor_pot",
        /*
         * 🔴 POSITIVE, because `sponsor_pot` is a LIABILITY and spending it
         * reduces what we owe. A top-up is the negative one. The first draft of
         * `weeklySpend` read the signs the other way round and would have
         * charted every deposit as expenditure.
         */
        amountCents: gross,
        memo: "A session spent this sponsor's pot",
      },
      {
        account: "cash",
        amountCents: -gross,
        memo: "Funded from the pot; the cash for it arrived at top-up",
      },
    ],
  });

  const { postSessionPayment } = await import("./ledger");
  await postSessionPayment({
    id: payment.id,
    organizationId: row.organizationId,
    therapistId: row.therapistId,
    capture: "platform",
    grossCents: gross,
    platformFeeCents: money.platformCutCents,
    settledInvoiceCents: 0,
    therapistNetCents: money.therapistNetCents,
  });

  await controlDb
    .update(sponsorPots)
    .set({ balanceCents: sql`${sponsorPots.balanceCents} - ${gross}`, updatedAt: new Date() })
    .where(eq(sponsorPots.id, pot.potId));

  log.info("session funded from a pot", { session: ref(sessionId) });
  return { paid: true, sponsorId: benefit.sponsorId, amountCents: gross };
}

/**
 * Money in. PLAN.md 53.11, 53.12, 53.13, C233, C241.
 *
 * 🔴 The terms are a precondition rather than a footnote. A pot with no refund
 * policy and no expiry cannot hold money — the database refuses it — so this
 * refuses the top-up with the reason rather than letting the insert fail with a
 * constraint name.
 */
export async function topUpPot(input: {
  sponsorId: string;
  amountCents: number;
  /** Who authorised it, for the audit. A sponsor user id, never an `Actor`. */
  bySponsorUserId: string | null;
}): Promise<{ ok?: true; error?: string }> {
  const settings = await getSettings();

  const [sponsor] = await controlDb
    .select({ id: sponsors.id, entity: sponsors.entity, state: sponsors.state })
    .from(sponsors)
    .where(eq(sponsors.id, input.sponsorId))
    .limit(1);

  if (!sponsor) return { error: "That account no longer exists." };
  if (sponsor.state !== "active") {
    return { error: "This account is not active yet. We will call you first." };
  }

  /*
   * 🔴 C241 — THE EGYPTIAN ENTITY DOES NOT TAKE A CORPORATE PAYMENT YET.
   *
   * Egyptian e-invoicing is confirmed with counsel before it does. Refused in
   * plain words, here, rather than taking the money and issuing a document we
   * cannot stand behind: an invoice that does not satisfy the ETA is worse than
   * no invoice, because the customer files it.
   */
  if (sponsor.entity === "eg") {
    return {
      error:
        "We cannot take a corporate payment into our Egyptian entity yet. Talk to us and we will arrange it another way.",
    };
  }

  if (input.amountCents < settings.sponsor.minTopUpCents) {
    return { error: "That is below the minimum top up." };
  }

  const pot = await potRow(input.sponsorId);
  if (!pot.potId) {
    return { error: "This account has no pot yet. We open it with you, with the terms agreed." };
  }

  /*
   * 🔴 C233 — the terms are decided before any money, and read before this
   * line. The database refuses a balance above zero without them, so this check
   * is the message rather than the rule.
   */
  const [terms] = await controlDb
    .select({ refundPolicy: sponsorPots.refundPolicy, expiresAt: sponsorPots.expiresAt })
    .from(sponsorPots)
    .where(eq(sponsorPots.id, pot.potId))
    .limit(1);

  if (!terms?.refundPolicy || !terms.expiresAt) {
    return { error: "The refund and expiry terms have to be agreed before a top up." };
  }

  await journal({
    kind: "pot_topup",
    refType: "sponsor",
    refId: input.sponsorId,
    legs: [
      { account: "cash", amountCents: input.amountCents, memo: "A sponsor topped up their pot" },
      {
        account: "sponsor_pot",
        /* Negative: a liability rises with a negative amount. It is their money. */
        amountCents: -input.amountCents,
        memo: "Held for this sponsor until a session spends it",
      },
    ],
  });

  await controlDb
    .update(sponsorPots)
    .set({
      balanceCents: sql`${sponsorPots.balanceCents} + ${input.amountCents}`,
      updatedAt: new Date(),
    })
    .where(eq(sponsorPots.id, pot.potId));

  log.info("pot topped up", { sponsor: ref(input.sponsorId) });
  return { ok: true };
}

/**
 * 🔴 53.16 / C232 — the pot's half of the daily reconciliation.
 *
 * Two numbers that must agree: the balance on `sponsor_pots`, which every
 * spending decision reads, and the ledger, which is the record. They are
 * maintained by the same functions and they can still drift — a crash between
 * the journal and the balance update leaves exactly that. So the redundancy is
 * the check rather than a smell: a disagreement is a number, found by a job,
 * rather than a pot that quietly over- or under-spends for a month.
 */
export async function reconcilePots(): Promise<
  { sponsorId: string; tableCents: number; ledgerCents: number; deltaCents: number }[]
> {
  const rows = await controlDb.execute(sql`
    SELECT p.sponsor_id                                       AS sponsor_id,
           p.balance_cents                                    AS table_cents,
           COALESCE((SELECT -SUM(l.amount_cents)
                       FROM ledger_entries l
                      WHERE l.account   = 'sponsor_pot'
                        AND l.ref_type  = 'sponsor'
                        AND l.ref_id    = p.sponsor_id), 0)   AS ledger_cents
      FROM sponsor_pots p`);

  return (rows.rows as { sponsor_id: string; table_cents: number; ledger_cents: number }[])
    .map((row) => ({
      sponsorId: row.sponsor_id,
      tableCents: Number(row.table_cents),
      ledgerCents: Number(row.ledger_cents),
      deltaCents: Number(row.table_cents) - Number(row.ledger_cents),
    }))
    .filter((row) => row.deltaCents !== 0);
}

/**
 * 🔴 53.27 — the balance a SPONSOR reads comes from the ledger.
 *
 * `sponsor_pots.balance_cents` is what the spending decision reads, because a
 * booking cannot afford an aggregate over every leg ever posted. What a sponsor
 * is SHOWN is the ledger, because the ledger is the record and because a figure
 * on a screen that disagrees with the books is how a customer finds a bug we
 * should have found.
 */
export async function ledgerPotBalance(sponsorId: string): Promise<number> {
  const [row] = await controlDb
    .select({
      cents: sql<number>`COALESCE(-SUM(${ledgerEntries.amountCents}), 0)::int`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        eq(ledgerEntries.refId, sponsorId),
      ),
    );

  return row?.cents ?? 0;
}

/** Total spent out of this pot, ever, from the ledger. 53.25, 53.27. */
export async function potTotals(
  sponsorId: string,
): Promise<{ spentCents: number; sessions: number }> {
  const [row] = await controlDb
    .select({
      cents: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)::int`,
      sessions: sql<number>`COUNT(*)::int`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        eq(ledgerEntries.refId, sponsorId),
        sql`${ledgerEntries.amountCents} > 0`,
      ),
    );

  return { spentCents: row?.cents ?? 0, sessions: row?.sessions ?? 0 };
}

async function potRow(sponsorId: string) {
  const [pot] = await controlDb
    .select({
      potId: sponsorPots.id,
      balanceCents: sponsorPots.balanceCents,
      overdraftCents: sponsorPots.overdraftCents,
    })
    .from(sponsorPots)
    .where(eq(sponsorPots.sponsorId, sponsorId))
    .limit(1);

  return pot ?? NO_POT;
}
