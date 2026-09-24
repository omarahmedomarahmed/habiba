/**
 * What a confirmed bank transfer actually unlocks.
 *
 * ## 🔴 WHY THIS IS A SEPARATE FILE FROM THE QUEUE
 *
 * `lib/billing/manual.ts` owns the queue: rows, states, who decided, when. It
 * knows nothing about sessions, invoices or pots, and that is deliberate. A
 * single file that both ran the queue and reached into three money tables is a
 * file where a queue bug can take a pot with it, and where the blast radius of
 * "we got the state machine wrong" is everybody's balance.
 *
 * So the queue calls `grantFor` as a callback it was handed. Same shape as
 * C360's rule for the forecast, applied to a different fear.
 *
 * ## 🔴 EVERY GRANT IS IDEMPOTENT
 *
 * An operator double-clicking Confirm, a retry after a timeout, a re-run after
 * the grant threw: all three land here twice. Each branch below is written so
 * the second run changes nothing, because the alternative is a pot credited
 * twice with no processor to reverse it.
 */
import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import {
  invoices,
  manualPayments,
  sessions,
  sponsors,
  therapistVerifications,
  users,
  sponsorPots,
  type ManualPayment,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * Take the action the money was for.
 *
 * Throws on an unknown purpose rather than shrugging: a purpose that reaches
 * here without a branch means somebody added a payment kind and forgot the half
 * that gives the payer what they paid for, and a silent no-op would look exactly
 * like success to the operator who confirmed it.
 */
export async function grantFor(payment: ManualPayment): Promise<void> {
  switch (payment.purpose) {
    case "session":
    case "payg_session":
      return grantSession(payment);
    case "subscription":
      return grantSubscription(payment);
    case "pot_topup":
      return grantPotTopUp(payment);
    default: {
      const unreachable: never = payment.purpose;
      throw new Error(`No grant for payment purpose ${String(unreachable)}`);
    }
  }
}

/* --------------------------------------------------------------- session -- */

/**
 * The patient can join.
 *
 * 🔴 `payment_status` is the server-side gate the join token already reads, so
 * flipping it here is the whole grant: no new state, no second flag, nothing
 * that could disagree with the existing one. The patient's screen goes from a
 * spinner to a live session because the same column it was already watching
 * changed.
 *
 * The WHERE keeps it idempotent and keeps it honest: a session already `paid`
 * is not re-paid, and a session that was cancelled while the money was in
 * flight is NOT quietly revived.
 */
async function grantSession(payment: ManualPayment): Promise<void> {
  if (!payment.refId) throw new Error("A session payment with no session");

  /*
   * 🔴 W2-M03: `pending` alone was not the question. A refund sets a session
   * back to `pending` and a cancelled one stays there, so a transfer confirmed
   * after either marked a refunded or cancelled session paid and posted money
   * against it. `claimSessionPaid` asks all three, and is the same claim the
   * card share settles through.
   */
  const { claimSessionPaid } = await import("./session-owed");
  if (!(await claimSessionPaid(payment.refId))) {
    /*
     * Not an error. Either it was already paid (a second run, which is fine) or
     * the session moved on while the transfer was being checked, which an
     * operator needs to see rather than have swallowed.
     */
    log.warn("manual session payment confirmed but the session was not pending", {
      paymentId: payment.id,
      sessionId: payment.refId,
    });
    /*
     * 🔴 W2-A03: a session already paid is a second run, which is fine. Any
     * other state (cancelled while the transfer was checked, refunded, gone)
     * means the money bought nothing, and that is a decision for a person.
     */
    const [now] = await db
      .select({ status: sessions.status, paymentStatus: sessions.paymentStatus })
      .from(sessions)
      .where(eq(sessions.id, payment.refId))
      .limit(1);
    if (now?.paymentStatus !== "paid") {
      const { flagException } = await import("./rail-exceptions");
      await flagException(
        payment.id,
        "not_payable",
        `session ${now?.status ?? "gone"}, payment ${now?.paymentStatus ?? "none"}`,
      );
    }
    return;
  }

  /*
   * 🔴 AND THE BOOKS, WHICH FOR TWO SPRINTS THIS DID NOT DO AT ALL.
   *
   * Flipping `payment_status` is what lets the patient into the room. It is not
   * what records that money moved, and until this sprint the manual rail did
   * only the first. `postSessionPayment` is the single writer of
   * `platform_revenue`, `vat_payable` and `therapist_payable` for a session, and
   * it had exactly two call sites: Stripe, and a sponsor pot. Egypt has neither.
   *
   * What that cost, in the market this product launches in, where EVERY patient
   * pays by bank transfer:
   *
   *   - our 15% was never recognised, so every revenue figure on `/admin/vault`,
   *     the board and the trial balance read zero for Egypt
   *   - the therapist's held balance stayed at zero, so `requestPayout` refused
   *     every withdrawal with "you can withdraw up to 0.00". **An Egyptian
   *     therapist could never be paid through the product at all.**
   *   - `settleInvoicesFromHeld` could never fire, so their session fees were
   *     billed as cash they owed us separately rather than netted off earnings
   *
   * The only remedy was an operator hand-posting every session as a ledger
   * adjustment.
   *
   * 🔴 SAFE TO POST HERE because the UPDATE above is guarded on
   * `payment_status = 'pending'` and we returned early when it matched nothing.
   * That guard is the idempotency, exactly as `connect.ts` relies on its own
   * `status = 'pending'` guard, so this body runs once per session however many
   * times an operator presses Confirm.
   */
  const [row] = await db
    .select({
      organizationId: sessions.organizationId,
      therapistId: sessions.therapistId,
      priceCents: sessions.priceCents,
      stripeAccountId: users.stripeAccountId,
      payoutsEnabled: users.payoutsEnabled,
      /*
       * 🔴 Their own country, because Egypt is always a manual payout however
       * the money arrived. Left joined: a clinician who has not filed a
       * verification has no country, and `payoutRailFor` reads that as manual
       * rather than assuming Connect.
       */
      therapistCountry: therapistVerifications.country,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .leftJoin(therapistVerifications, eq(therapistVerifications.userId, users.id))
    .where(eq(sessions.id, payment.refId))
    .limit(1);

  if (!row) {
    log.error("manual session payment confirmed for a session that vanished", {
      paymentId: payment.id,
      sessionId: payment.refId,
    });
    return;
  }

  /* A free session has nothing to split. The room still opened; nobody paid. */
  if (row.priceCents <= 0) return;

  const { getSettings, sessionMoney } = await import("@/lib/settings");
  const settings = await getSettings();
  const { sessionPayments } = await import("@/lib/db/schema");

  /*
   * 🔴 76.33 — WHETHER AN EMPLOYER ALREADY PAID FOR PART OF THIS SESSION.
   *
   * `session_payments` has a UNIQUE index on `session_id`, so on a partly
   * covered session `payFromPot` wrote the only row this session will ever
   * have, at booking, and everything below was about to try to write a second.
   * `onConflictDoNothing` swallowed it, the function logged a warning and
   * returned, and the patient's transfer was posted to no account at all.
   *
   * What that cost on the launch market's only rail, for every covered
   * employee:
   *
   *   - the VAT they actually paid was never recorded as owed to anybody, so
   *     we hold a tax liability the books say is zero
   *   - the money arriving was invisible to `/admin/vault` and the board, so a
   *     bank line for a covered session reconciles against nothing
   *   - an operator saw `Confirm` succeed and a warning in a log they do not read
   *
   * Read first, then branch. The two cases are genuinely different postings
   * and pretending otherwise is what produced the silent one.
   */
  const [priorPayment] = await db
    .select({
      id: sessionPayments.id,
      patientShareCents: sessionPayments.patientShareCents,
      sponsorShareCents: sessionPayments.sponsorShareCents,
      vatCents: sessionPayments.vatCents,
    })
    .from(sessionPayments)
    .where(eq(sessionPayments.sessionId, payment.refId))
    .limit(1);

  /*
   * 🔴 WHAT THIS PAYER WAS ASKED FOR, which is the patient's share and not the
   * price. `declareSessionTransfer` quotes `patientOwesFor(...)` plus VAT on
   * it, so the tax has to be derived against the same base or the subtraction
   * below goes negative and clamps to zero.
   *
   * With no prior row the two are the same number, which is why the uncovered
   * case is unchanged by this.
   */
  const patientShareCents = priorPayment?.patientShareCents ?? row.priceCents;

  /*
   * 🔴 75.7 — THE VAT THAT ACTUALLY ARRIVED, DERIVED FROM THE MONEY ITSELF.
   *
   * `settles_cents` is what the payer was asked for and what an operator
   * matched on a bank statement. `price_cents` is the therapist's fee. The
   * difference between them IS the tax, by construction, because
   * `sessionTransferMoney` is the one place that builds the figure and it
   * builds it as gross plus VAT.
   *
   * Deriving it rather than re-reading the rate is deliberate. A rate an
   * operator changed between the quote and the confirmation would make a
   * recomputed figure disagree with the money in the account, and the money in
   * the account is the fact. This cannot drift from it.
   *
   * ⚠️ It was ZERO for two sprints, and correctly so at the time: the transfer
   * branch quoted the bare price, so no VAT was asked for and none arrived.
   * Posting a liability for money we had not collected would have invented a
   * debt. Now it is collected, so it is recorded.
   */
  const vatCents = Math.max(0, payment.settlesCents - patientShareCents);

  /*
   * 🔴 76.33 — THE COVERED CASE, WHICH USED TO BE A WARNING AND A RETURN.
   *
   * Everything about the SESSION was posted at booking: our fee and the
   * clinician's net were computed on the full price there, correctly, because
   * a partly covered session is not a cheaper session (C313). None of that is
   * redone here and redoing it would double the revenue.
   *
   * What was never posted is the TAX, because at booking there was none: a pot
   * spend carries `vat_cents = 0` by C241, the employer's half having been
   * taxed when the pot was funded. The patient's half is taxed when the
   * patient pays, which is now.
   *
   * So: one journal, two legs, for the money that genuinely just arrived.
   */
  if (priorPayment) {
    if (vatCents > 0) {
      await db
        .update(sessionPayments)
        .set({
          vatCents: priorPayment.vatCents + vatCents,
          vatBps: Math.round((vatCents * 10_000) / Math.max(1, patientShareCents)),
        })
        .where(eq(sessionPayments.id, priorPayment.id));
    }

    /*
     * 🔴 W2-M01: the employee's leg, and their VAT, on our books now that the
     * money is in our account. `payFromPot` books only the pot's leg; a row it
     * booked whole before W2-M01 gets only the VAT (`bookEmployeeShare`).
     */
    const { bookEmployeeShare } = await import("./employee-share");
    await bookEmployeeShare({ paymentId: priorPayment.id, capture: "platform", vatCents });

    log.info("manual session payment settled a sponsored session's patient share", {
      paymentId: payment.id,
      sessionId: payment.refId,
      patientShareCents,
      sponsorShareCents: priorPayment.sponsorShareCents,
      vatCents,
    });
    return;
  }

  const money = sessionMoney({
    grossCents: row.priceCents,
    feeBps: settings.session.platformFeeBps,
    /*
     * Zero here because `vatCents` is passed explicitly below. `sessionMoney`
     * would recompute it from a rate, and the rate is exactly what must not be
     * trusted at this point.
     */
    vatBps: 0,
  });

  const { crossingFor, payoutRailFor } = await import("./money");

  const [created] = await db
    .insert(sessionPayments)
    .values({
      organizationId: row.organizationId,
      therapistId: row.therapistId,
      sessionId: payment.refId,
      payerName: null,
      payerEmail: null,
      grossCents: row.priceCents,
      currency: "usd",
      vatCents,
      /*
       * The rate as it stands now, for the record. The AMOUNT above is the one
       * that has to be right, and it came from the money rather than from here.
       */
      vatBps: vatCents > 0 ? Math.round((vatCents * 10_000) / row.priceCents) : 0,
      coverageBps: 0,
      sponsorShareCents: 0,
      patientShareCents: row.priceCents,
      platformFeeCents: money.platformCutCents,
      platformFeeBps: settings.session.platformFeeBps,
      settledInvoiceCents: 0,
      therapistNetCents: money.therapistNetCents,
      /*
       * 🔴 `platform`, because WE are holding it. The pounds landed in our
       * account and the therapist's share is ours to pay out by hand, which is
       * the whole reason the payouts queue exists.
       */
      capture: "platform",
      crossing: crossingFor({
        paidVia: "local_egp",
        therapist: payoutRailFor({
          stripeAccountId: row.stripeAccountId,
          payoutsEnabled: row.payoutsEnabled,
          country: row.therapistCountry,
        }),
      }),
      status: "paid",
      paidAt: payment.decidedAt ?? new Date(),
      /*
       * ⚠️ `card` is the wrong WORD and the right BEHAVIOUR. The column allows
       * only `card` and `pot`, every reader in the product asks it exactly one
       * question (`=== "pot"`), and the honest answer to that question is no.
       * The rail itself is recorded truthfully one field up, in `crossing`, as
       * `egp_local_to_manual`. Widening the CHECK to add `transfer` is a
       * migration, and a migration to rename a value nothing reads is not what
       * should be shipped in the same change as the money it was hiding.
       */
      fundingSource: "card",
    })
    .onConflictDoNothing({ target: sessionPayments.sessionId })
    .returning({ id: sessionPayments.id });

  if (!created) {
    /* Something else already booked this session's money. Do not post twice. */
    log.warn("manual session payment: a payment row already existed", {
      paymentId: payment.id,
      sessionId: payment.refId,
    });
    // W2-A03: paid twice, once another way. The transfer is ours and bought nothing.
    const { flagException } = await import("./rail-exceptions");
    await flagException(payment.id, "not_payable", "the session was already paid another way");
    return;
  }

  const { postSessionPayment } = await import("./ledger");
  await postSessionPayment({
    id: created.id,
    organizationId: row.organizationId,
    therapistId: row.therapistId,
    capture: "platform",
    grossCents: row.priceCents,
    vatCents,
    platformFeeCents: money.platformCutCents,
    settledInvoiceCents: 0,
    therapistNetCents: money.therapistNetCents,
  });

  log.info("manual session payment posted to the ledger", {
    paymentId: payment.id,
    sessionId: payment.refId,
    ourFeeCents: money.platformCutCents,
    therapistNetCents: money.therapistNetCents,
    vatCents,
  });
}

/* ---------------------------------------------------------- subscription -- */

/**
 * The bill is settled, oldest invoice first, until the money runs out.
 *
 * ## 🔴 A WHOLE BILL, NOT ONE INVOICE, BECAUSE THE CARD RAIL DOES THE SAME
 *
 * `createInvoiceCheckout` puts every outstanding invoice into one Stripe
 * checkout. A transfer rail that settled one invoice per transfer would mean a
 * therapist on pay-as-you-go making six bank transfers of $4, which nobody does:
 * they would make one transfer for the total and an operator would be left
 * deciding by hand which invoices it covered.
 *
 * So `ref_id` on a subscription payment is the ORGANISATION, which is also what
 * makes the partial unique index mean "one claim in flight per account", and the
 * money is applied here the way a person would apply it.
 *
 * ## 🔴 IDEMPOTENT BECAUSE `due` IS IN THE WHERE
 *
 * A second run finds the invoices it settled already `paid`, so they no longer
 * match and nothing moves. `paidAt` cannot drift for the same reason — the row
 * is only touched while it is still due — and a payment date that drifts is one
 * nobody can reconcile against a bank statement.
 *
 * ## 🔴 AND IT STOPS RATHER THAN PART-PAYING
 *
 * An invoice the money does not fully cover is left alone. A half-settled
 * invoice is a number two systems disagree about, and the therapist's next
 * transfer clears it whole.
 */
async function grantSubscription(payment: ManualPayment): Promise<void> {
  /*
   * 🔴 From `ref_id`, NOT from `organization_id`. That column is
   * `ON DELETE SET NULL` for C367's reason, and a grant that reads it would
   * stop working on exactly the rows the null was there to preserve.
   */
  if (!payment.refId) throw new Error("A subscription payment with no organisation");

  const due = await db
    .select({
      id: invoices.id,
      amountCents: invoices.amountCents,
      discountCents: invoices.discountCents,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, payment.refId), eq(invoices.status, "due")))
    .orderBy(invoices.issuedAt);

  let remaining = payment.settlesCents;
  const settled: string[] = [];

  for (const invoice of due) {
    const payable = Math.max(0, invoice.amountCents - invoice.discountCents);
    if (payable > remaining) continue;

    const updated = await db
      .update(invoices)
      .set({ status: "paid", paidAt: new Date() })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "due")))
      .returning({ id: invoices.id });

    if (updated.length > 0) {
      remaining -= payable;
      settled.push(invoice.id);
    }
  }

  if (settled.length === 0) {
    /*
     * Not an error. Either this ran twice (fine) or the bill was cleared some
     * other way while the transfer was being checked, which an operator needs to
     * see rather than have swallowed. The money is recorded either way, and the
     * next invoice is the one it should have gone to.
     */
    log.warn("manual subscription payment confirmed but nothing was due", {
      paymentId: payment.id,
      organizationId: payment.refId,
      settlesCents: payment.settlesCents,
    });
    // W2-A03: the money is ours and settled nothing. A person decides where it goes.
    const { flagException } = await import("./rail-exceptions");
    await flagException(payment.id, "not_payable", "nothing was due when it was confirmed");
    return;
  }

  if (remaining > 0) {
    /*
     * They sent more than the bill. Loud rather than silently kept: there is no
     * credit balance on this rail to put it in, so an operator decides — refund
     * it, or hold it against next month.
     */
    log.warn("manual subscription payment left money over", {
      paymentId: payment.id,
      organizationId: payment.refId,
      settledCount: settled.length,
      remainingCents: remaining,
    });
    // W2-A03 / A4: an overpayment is on /admin/transfers as work, with the difference.
    const { flagException } = await import("./rail-exceptions");
    await flagException(payment.id, "overpaid", `$${(remaining / 100).toFixed(2)} over the bill`);
  }

  /*
   * 🔴 74.3 — AND THE PLAN STARTS, WHICH THE INVOICE ABOVE DOES NOT DO.
   *
   * A settled invoice is a debt cleared; an entitlement is a different row.
   * `entitledTier` reads a PAID obligation first and the Stripe mirror second,
   * and an Egyptian account has no mirror at all — so without this a therapist
   * could transfer $100 a month forever and stay on pay as you go, with every
   * screen agreeing they had paid.
   *
   * Not fatal if it finds nothing: a pay-as-you-go therapist clearing session
   * fees has no obligation and wants none.
   */
  const { settleOldestObligationByTransfer } = await import("./service");
  await settleOldestObligationByTransfer({
    organizationId: payment.refId,
    ref: payment.id,
    paidAt: payment.decidedAt ?? new Date(),
    /*
     * 🔴 WHAT ACTUALLY ARRIVED, so a month cannot be granted by a transfer that
     * did not cover it. Passing this was the missing half of the fix: the
     * function now refuses when the money is short, and it can only do that if
     * somebody tells it how much there was.
     */
    settlesCents: payment.settlesCents,
  });
}

/* -------------------------------------------------------------- the pot -- */

/**
 * The company's pot goes up, and their people can book against it immediately.
 *
 * 🔴 IDEMPOTENT BY LEDGER, NOT BY BALANCE. A bare `balance = balance + n` run
 * twice credits twice and nothing in the row remembers it happened. So the
 * credit is conditional on this payment not already having been applied, which
 * is asked of the payments table itself: a confirmed payment whose
 * `decided_at` predates the pot's `updated_at` is not re-applied.
 *
 * That check is deliberately conservative. When it cannot prove the credit is
 * new it refuses, and an operator re-runs it, which is the right direction to
 * be wrong in for money moving into an account.
 *
 * 🔴 AND IT CREDITS `settles_cents`, NOT `amount_cents`. 0106: the pot is in
 * dollars and the payer sent pounds. This line read `amount_cents` before that
 * column existed, so a company that sent 10,000 EGP had a million cents put in
 * its pot — fifty times what it paid, with no processor to reverse it.
 */
async function grantPotTopUp(payment: ManualPayment): Promise<void> {
  if (!payment.sponsorId) throw new Error("A pot top-up with no sponsor");

  /*
   * 🔴 75.8 — THE TAX AND THE LEDGER, BOTH OF WHICH THIS PATH SKIPPED.
   *
   * `topUpPot` credits the pot the NET, raises `vat_payable` for the tax and
   * journals three legs. This function did neither: it credited the whole
   * amount to `sponsor_pots.balance_cents` and posted nothing at all.
   *
   * Two consequences, and the second is the one a customer sees:
   *
   *   - `pot.ts` says in its own words what crediting the gross costs, and it
   *     was describing this path: it *"let the sponsor spend the tax on
   *     sessions and left us owing a tax authority out of money we had already
   *     promised to somebody else."*
   *   - `ledgerPotBalance` is what a sponsor is SHOWN, on the rule that a
   *     figure on a screen which disagrees with the books is how a customer
   *     finds a bug we should have found. With no legs posted it returns zero,
   *     so a company that transferred $5,000 read **$0** on its own pot screen
   *     while every booking decision thought the money was there. And
   *     `reconcilePots` would have reported the whole top-up as drift.
   *
   * `topUpPot` refuses `entity = 'eg'`, so for an Egyptian sponsor the manual
   * rail is not the fallback path, it is the ONLY path. There was no card
   * branch getting this right underneath.
   */
  const { entityVatBps } = await import("./pot");
  const { journal } = await import("./ledger");

  const [sponsor] = await db
    .select({ entity: sponsors.entity })
    .from(sponsors)
    .where(eq(sponsors.id, payment.sponsorId))
    .limit(1);

  /*
   * 🔴 76.1 — WORKED BACKWARDS OUT OF WHAT ARRIVED, WHICH IS THE ONLY SAFE
   * DIRECTION AT THIS END.
   *
   * The company chose a CREDIT on the stepper and `declarePotTransfer` stored
   * the credit plus the tax as `settles_cents`, so forwards and backwards give
   * the same pair of numbers. This end still derives it backwards anyway, for
   * the same reason the session grant does: the rate is an operator's setting
   * and they can change it between the quote and the confirmation. Deriving
   * from the money that actually arrived means a rate change cannot move a
   * figure that has already been posted.
   */
  const vatBps = await entityVatBps(sponsor?.entity ?? "us");
  const net =
    vatBps > 0
      ? Math.round((payment.settlesCents * 10_000) / (10_000 + vatBps))
      : payment.settlesCents;
  const vat = payment.settlesCents - net;

  /*
   * One statement, so the read and the write cannot be separated by another
   * confirmation of the same payment landing between them.
   *
   * 🔴 IT RUNS BEFORE THE JOURNAL, and that order is the idempotency. This is
   * the only guard against a second Confirm, so a double press has to be
   * refused HERE, before any leg is posted. `topUpPot` journals first because
   * its caller is a Stripe webhook with its own replay guard; this one has
   * none, and two sets of legs for one transfer is a set of books nothing can
   * reconcile afterwards.
   */
  const result = await db.execute(sql`
    UPDATE sponsor_pots
       SET balance_cents = balance_cents + ${net},
           updated_at = now()
     WHERE sponsor_id = ${payment.sponsorId}
       AND NOT EXISTS (
         SELECT 1 FROM manual_payments p
          WHERE p.id = ${payment.id}
            AND p.state = 'confirmed'
            AND p.decided_at < sponsor_pots.updated_at
       )
    RETURNING sponsor_pots.id`);

  if (result.rows.length === 0) {
    log.warn("manual pot top-up confirmed but the pot was not credited", {
      paymentId: payment.id,
      sponsorId: payment.sponsorId,
      why: "either there is no pot, or this payment had already been applied",
    });
    throw new Error("The pot was not credited. Check it before confirming again.");
  }

  /*
   * The same three legs `topUpPot` posts, with the same signs, so
   * `reconcilePots` and `ledgerPotBalance` read one rail exactly as they read
   * the other. Cash is an asset and rises positive; the pot and the tax are
   * both somebody else's money and rise negative.
   */
  await journal({
    kind: "pot_topup",
    refType: "sponsor",
    refId: payment.sponsorId,
    legs: [
      {
        account: "cash",
        amountCents: payment.settlesCents,
        memo: "A sponsor topped up their pot by bank transfer",
      },
      {
        account: "vat_payable",
        amountCents: -vat,
        memo: "VAT on the top-up, owed to the tax authority",
      },
      {
        account: "sponsor_pot",
        amountCents: -net,
        memo: "Held for this sponsor until a session spends it",
      },
    ],
  });

  /* W2-S02: published at once, after the legs so a first publication sees them. */
  const { publishTopUp } = await import("./pot");
  await publishTopUp(payment.sponsorId, net);

  log.info("manual pot top-up posted to the ledger", {
    paymentId: payment.id,
    sponsorId: payment.sponsorId,
    settlesCents: payment.settlesCents,
    netCents: net,
    vatCents: vat,
  });
}

/** Re-export so a caller needs one import rather than two. */
export { manualPayments };
