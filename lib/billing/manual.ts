/**
 * The Egyptian rail: a bank transfer, a claim, and an operator who checks it.
 *
 * ## 🔴 WHY THIS EXISTS, WHICH IS NOT A TECHNICAL REASON
 *
 * `topUpPot` refuses `entity = 'eg'`, correctly: we cannot take a corporate card
 * payment into an Egyptian entity that does not exist yet. The consequence
 * nobody had costed is that the **entire Egyptian go-to-market has no way to pay
 * us.** Three call centres, six clinics, nine therapists, and every patient
 * behind them.
 *
 * Most money in Egypt moves by transfer anyway. So the fallback is not a
 * stopgap: it is the rail, until a gateway arrives, and building it properly
 * means the product works on day one rather than waiting on a licence.
 *
 * ## 🔴 THE ACTION IS TAKEN ON CONFIRMATION, NEVER BEFORE
 *
 * A patient sees a session they can join the moment an operator confirms it, and
 * not one second earlier. There is no optimistic grant anywhere in this file.
 * An unconfirmed transfer is a CLAIM, and a product that acts on a claim about
 * money is a product that can be robbed by typing a plausible reference number.
 *
 * The cost of that ruling is a patient staring at a spinner, and it is paid
 * deliberately: `pending()` is designed to be closed and come back to.
 *
 * ## 🔴 ONE QUEUE, THREE PURPOSES
 *
 * A session, a subscription and a pot top-up are three tables. Hanging "awaiting
 * a human" off each separately gives three half-built states, three places to
 * forget the rejection path, and no single screen an operator can work.
 */
import "server-only";

import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb as db } from "@/lib/db";
import {
  manualPayments,
  type ManualPayment,
  type ManualPaymentPurpose,
  users,
} from "@/lib/db/schema";
import { likePattern } from "@/lib/admin/paging";
import { MIN_REASON } from "@/lib/admin/reason";
import { log } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

/* ------------------------------------------------------------ line items -- */

/**
 * 🔴 76.16 — ONE THING THIS TRANSFER COVERS, in the payer's own words.
 *
 * `cents` is USD, like every other figure this product stores. The label is
 * whatever the payer was shown — "Session, 12 March", "Platform fee, February"
 * — and it is a STRING rather than a reference on purpose: the lines outlive
 * the rows they were built from, which is the whole argument in 0107.
 *
 * 🔴 AND THE LINES ARE NOT THE TOTAL. `settlesCents` is the total and stays the
 * one number anything acts on. Lines can legitimately fall short of it, because
 * tax is added on top and is never a line here; nothing reads these to decide
 * what to credit, and `verify:rail` holds that.
 */
export type PaymentLine = { label: string; cents: number };

/* ------------------------------------------------------------- the payer -- */

/**
 * Exactly one of these, and the database CHECK agrees.
 *
 * A union rather than three optional columns in the argument, so "who is
 * paying" cannot be left unanswered or answered twice by a call site.
 */
export type Payer =
  | { kind: "user"; userId: string; organizationId?: string | null }
  | { kind: "patient"; patientAccountId: string }
  | { kind: "sponsor"; sponsorId: string }
  /**
   * 🔴 A guest paying for a session off the radar. They have no account and may
   * never make one, and asking for one before a crisis session would be the
   * wrong trade. The session in `refId` is the identification: it carries the
   * therapist, the price, the time and the token they held.
   */
  | { kind: "session"; organizationId?: string | null };

function payerColumns(payer: Payer) {
  switch (payer.kind) {
    case "user":
      return {
        payerKind: "user" as const,
        userId: payer.userId,
        patientAccountId: null,
        sponsorId: null,
        organizationId: payer.organizationId ?? null,
      };
    case "patient":
      return {
        payerKind: "patient" as const,
        userId: null,
        patientAccountId: payer.patientAccountId,
        sponsorId: null,
        organizationId: null,
      };
    case "sponsor":
      return {
        payerKind: "sponsor" as const,
        userId: null,
        patientAccountId: null,
        sponsorId: payer.sponsorId,
        organizationId: null,
      };
    case "session":
      return {
        payerKind: "session" as const,
        userId: null,
        patientAccountId: null,
        sponsorId: null,
        organizationId: payer.organizationId ?? null,
      };
  }
}

/* ------------------------------------------------------ what a payer sees -- */

export type TransferDetails = {
  /**
   * 🔴 The heading, and it differs by audience on purpose.
   *
   * A patient and a therapist in Egypt recognise "InstaPay", which is the rail
   * they actually use from their phone. A company finance team recognises "Bank
   * Transfer" and would be confused by a consumer brand on an invoice. Same
   * account details underneath; different word on top.
   */
  label: string;
  fields: { key: string; label: string; value: string; hint: string }[];
  cardsComingSoon: boolean;
  /** True when nobody has filled the details in. The screens must say so. */
  unconfigured: boolean;
};

export type Audience = "patient" | "therapist" | "clinic" | "company";

export async function transferDetails(audience: Audience): Promise<TransferDetails> {
  const settings = await getSettings();
  const fields = settings.payouts.transferFields
    .filter((f) => f.audiences.includes(audience))
    .sort((a, b) => a.position - b.position)
    .map((f) => ({ key: f.key, label: f.label, value: f.value, hint: f.hint }));

  return {
    label: audience === "company" ? "Bank Transfer" : "InstaPay / Bank Transfer",
    fields,
    cardsComingSoon: settings.payouts.cardsComingSoon,
    unconfigured: fields.length === 0,
  };
}

/* --------------------------------------------------------------- the rate -- */

/**
 * 🔴 WHAT WE ASK AN EGYPTIAN PAYER TO SEND, FOR A PRICE WE HOLD IN DOLLARS.
 *
 * Every price in this product is USD cents: a session, an invoice, a pot. Every
 * payer on this rail sends pounds. Something has to bridge that, and it is
 * deliberately NOT `quoteFor`:
 *
 *   * `quoteFor` refuses a `static` rate in production (C37), so in production
 *     it returns nothing and this rail would have no number to show at all.
 *   * A rate that moves hourly is not what a manual rail runs on. Nobody is
 *     hedging: an operator reads a bank statement and matches the figure we
 *     asked for, and a figure that changed between the quote and the morning is
 *     a transfer they cannot match.
 *
 * So it is an operator's decided rate, and `settles_cents` on the row records
 * what the dollars were, so a payment can always be read back against the rate
 * that priced it.
 */
export async function egpRateMicro(): Promise<number> {
  const settings = await getSettings();
  return settings.payouts.egpRateMicro;
}

/** USD cents to piastres, the one conversion the screens share (`lib/money/convert.ts`). */
export { egpMinorFor } from "@/lib/money/convert";

/* ---------------------------------------------------------- raising a row -- */

/**
 * Open a payment that is waiting for somebody to transfer the money.
 *
 * 🔴 Idempotent on `(purpose, refId)` by a partial unique index, so a patient
 * tapping "I have paid" four times on a slow connection makes one row. Without
 * it an operator confirms two of them and a session is paid for twice with no
 * processor to reverse it.
 */
export async function openManualPayment(input: {
  purpose: ManualPaymentPurpose;
  refId: string | null;
  /** 🔴 What the payer sends, in minor units of `currency`. */
  amountCents: number;
  /** 🔴 What it is worth to us, in USD cents. See the column comment in 0106. */
  settlesCents: number;
  currency?: string;
  payer: Payer;
  /** 🔴 76.16 — what it covers, in the payer's words. See the column in 0107. */
  lineItems?: PaymentLine[] | null;
}): Promise<{ id?: string; error?: string }> {
  if (input.amountCents <= 0) return { error: "There is nothing to pay." };
  if (input.settlesCents <= 0) return { error: "There is nothing to pay." };

  /*
   * An existing live row for the same thing IS the answer, not a conflict.
   *
   * 🔴 BUT THE AMOUNT ON IT IS RE-STATED, AND IT USED TO BE FROZEN FOREVER.
   *
   * The row was returned untouched, so whatever the FIRST declaration said was
   * the amount an operator would eventually credit, however many times the
   * payer came back with a different one. `submitProof` writes the reference
   * and the receipt and no money, so the two halves of a claim could describe
   * different sums with nothing saying so.
   *
   * The worst case is the sponsor pot, where the payer types the figure and the
   * floor is $5,000:
   *
   *   1. Finance declares $5,000. Row opens at 500000.
   *   2. They change their mind, transfer $20,000, and declare again.
   *   3. The old row came back, and the new reference was written onto it.
   *   4. An operator matched a $20,000 line on the statement and confirmed.
   *   5. The pot was credited $5,000.
   *
   * Fifteen thousand dollars received and not credited, on a rail with no
   * processor to reverse it, and the only trace a log line nobody reads.
   *
   * Re-stating is safe because a live row is by definition one nobody has acted
   * on: `awaiting_proof` and `submitted` are both before an operator's
   * decision, and `confirmed` and `rejected` are excluded by the WHERE.
   */
  if (input.refId) {
    const [live] = await db
      .update(manualPayments)
      .set({
        amountCents: input.amountCents,
        settlesCents: input.settlesCents,
        currency: input.currency ?? "EGP",
        /*
         * 🔴 76.16 — RE-STATED WITH THE TOTAL, never left behind it. The whole
         * reason the amount is re-stated here is that a payer who changes their
         * mind must not leave an operator holding the first answer; a
         * composition that stayed frozen while the total moved would reintroduce
         * exactly that, one field down. `?? null` rather than a skip, so
         * dropping back to a single-subject payment clears the old lines.
         */
        lineItems: input.lineItems ?? null,
      })
      .where(
        and(
          eq(manualPayments.purpose, input.purpose),
          eq(manualPayments.refId, input.refId),
          inArray(manualPayments.state, ["awaiting_proof", "submitted"]),
        ),
      )
      .returning({ id: manualPayments.id });

    if (live) return { id: live.id };
  }

  /*
   * 🔴 `onConflictDoNothing` AND A RE-READ, because two taps are ordinary.
   *
   * The SELECT above and this INSERT are two statements, so two concurrent
   * declares can both miss the first and both reach the second. There is a
   * partial unique index (`manual_payments_one_live_per_ref`) and nothing was
   * catching the 23505 it raises: the throw escaped the server action, and with
   * no route-level error boundary the payer got a blank error page **with no
   * SOS orb on it**. On Egyptian mobile data, with a receipt upload in flight,
   * a double tap is not exotic.
   */
  const [row] = await db
    .insert(manualPayments)
    .values({
      purpose: input.purpose,
      refId: input.refId,
      amountCents: input.amountCents,
      settlesCents: input.settlesCents,
      currency: input.currency ?? "EGP",
      lineItems: input.lineItems ?? null,
      ...payerColumns(input.payer),
    })
    .onConflictDoNothing()
    .returning({ id: manualPayments.id });

  if (row) return { id: row.id };

  /* The other tap won. Its row is the answer, exactly as if we had seen it above. */
  if (input.refId) {
    const [live] = await db
      .select({ id: manualPayments.id })
      .from(manualPayments)
      .where(
        and(
          eq(manualPayments.purpose, input.purpose),
          eq(manualPayments.refId, input.refId),
          inArray(manualPayments.state, ["awaiting_proof", "submitted"]),
        ),
      )
      .limit(1);
    if (live) return { id: live.id };
  }

  return { error: "That payment could not be opened. Try again." };
}

/**
 * The payer says they have sent it, and hands over a reference or a receipt.
 *
 * 🔴 ONE OF THE TWO IS REQUIRED, not both and not neither. A claim with neither
 * is unverifiable and wastes an operator's afternoon; demanding both turns away
 * somebody whose bank app shows a reference but will not export a receipt.
 */
export async function submitProof(input: {
  paymentId: string;
  reference: string | null;
  proofUrl: string | null;
}): Promise<{ ok?: true; error?: string }> {
  const reference = input.reference?.trim() || null;
  if (!reference && !input.proofUrl) {
    return { error: "Add the transfer reference, or a screenshot of it." };
  }

  const updated = await db
    .update(manualPayments)
    .set({ reference, proofUrl: input.proofUrl, state: "submitted", submittedAt: new Date() })
    .where(
      and(
        eq(manualPayments.id, input.paymentId),
        /*
         * 🔴 The state is in the WHERE, not checked first.
         *
         * Read-then-write here would let two taps in the same second both pass
         * the read and both write, and the second would reopen a payment an
         * operator had already decided.
         */
        inArray(manualPayments.state, ["awaiting_proof", "submitted"]),
      ),
    )
    .returning({ id: manualPayments.id });

  if (updated.length === 0) {
    return { error: "That payment has already been decided. Ask us if that looks wrong." };
  }

  /*
   * 🔴 76.14 — THEY ARE TOLD THEIR CLAIM ARRIVED, and it is deliberately here
   * rather than in each of the three server actions that reach this function.
   *
   * A message wired at the call sites is a message the fourth call site forgets,
   * and "the payer heard nothing" is indistinguishable to them from "the payment
   * was lost" — which on this rail is how a second transfer gets sent.
   *
   * Awaited but never allowed to fail the submit: the claim is already written,
   * and `noticePaymentSubmitted` swallows its own errors for that reason.
   */
  const { noticePaymentSubmitted } = await import("./payment-notices");
  await noticePaymentSubmitted(updated[0]!.id);

  return { ok: true };
}

/* ------------------------------------------------------------ the decision */

/** Everything an operator has to look at, oldest first because they are waiting. */
export async function queue(
  /**
   * 🔴 W2-A09: how an operator matches a bank line, which is by its reference
   * or its amount. The queue was the oldest 200 with no search and nothing past
   * them. An amount matches what was sent or what it settles, typed either way
   * ("1500" or "1,500.00").
   */
  opts: { q?: string | null; offset?: number; limit?: number } = {},
): Promise<ManualPayment[]> {
  const amount = opts.q ? Number(opts.q.replace(/[,\s]/g, "")) : NaN;
  const cents = Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
  const search = opts.q
    ? or(
        ilike(manualPayments.reference, likePattern(opts.q)),
        cents !== null ? eq(manualPayments.amountCents, cents) : undefined,
        cents !== null ? eq(manualPayments.settlesCents, cents) : undefined,
      )
    : undefined;

  return db
    .select()
    .from(manualPayments)
    .where(and(eq(manualPayments.state, "submitted"), search))
    .orderBy(manualPayments.submittedAt)
    .limit(opts.limit ?? 200)
    .offset(opts.offset ?? 0);
}

/**
 * 🔴 76.15 — PAYMENTS SOMEBODY OPENED AND NEVER SUBMITTED.
 *
 * ## The case this exists for, which is not hypothetical
 *
 * Money arrives in our bank as a line with a name on it. Most of the time a
 * claim is waiting in the queue and the two match. Sometimes there is no claim
 * at all, because the payer opened the sheet, read the account number, sent the
 * money from their banking app and never came back to press Submit.
 *
 * Before the cart existed there was nothing to look at: an operator had an
 * unmatched line and a database with no record that anybody had even opened a
 * payment. Now there is one, and it usually carries the amount and the payer.
 * This is the list an operator searches when a line will not match.
 *
 * ## 🔴 IT IS NOT THE QUEUE AND MUST NEVER BE WORKED LIKE ONE
 *
 * Nobody here has claimed anything. Most of these people did not pay, and a
 * screen that invited an operator to confirm them one by one would be a screen
 * for inventing payments. It answers "did anybody open one for this amount",
 * and the only act it offers is the override, which asks for a reason.
 */
export async function openCarts(): Promise<ManualPayment[]> {
  return db
    .select()
    .from(manualPayments)
    .where(eq(manualPayments.state, "awaiting_proof"))
    /* Newest first: an unmatched bank line is almost always about today. */
    .orderBy(desc(manualPayments.createdAt))
    .limit(200);
}

/** How many are waiting, for the badge that makes the queue impossible to miss. */
export async function waitingCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(manualPayments)
    .where(eq(manualPayments.state, "submitted"));
  return row?.n ?? 0;
}

/** One payer's payments, for the screen they come back to. */
export async function paymentsFor(payer: Payer): Promise<ManualPayment[]> {
  const cols = payerColumns(payer);
  /*
   * 🔴 A session payer has no id to look them up by, so there is no history to
   * show them: their whole record is the one payment on the session in front of
   * them, and `livePaymentFor` is what finds it. Returning everything with a
   * null payer would show one guest another guest's payments.
   */
  if (cols.payerKind === "session") return [];

  const who =
    cols.userId !== null
      ? eq(manualPayments.userId, cols.userId)
      : cols.patientAccountId !== null
        ? eq(manualPayments.patientAccountId, cols.patientAccountId)
        : eq(manualPayments.sponsorId, cols.sponsorId!);

  return db
    .select()
    .from(manualPayments)
    .where(who)
    .orderBy(desc(manualPayments.createdAt))
    .limit(50);
}

/** The live one for a thing, so a screen knows whether to show a spinner. */
export async function livePaymentFor(
  purpose: ManualPaymentPurpose,
  refId: string,
): Promise<ManualPayment | null> {
  const [row] = await db
    .select()
    .from(manualPayments)
    .where(
      and(
        eq(manualPayments.purpose, purpose),
        eq(manualPayments.refId, refId),
        inArray(manualPayments.state, ["awaiting_proof", "submitted"]),
      ),
    )
    .limit(1);
  return row ?? null;
}

export type Decision = { ok?: true; error?: string };

/**
 * An operator confirms the money arrived, and the thing being paid for happens.
 *
 * 🔴 `onConfirmed` is passed in rather than imported, and that is the C360 shape
 * applied to a different problem: this module owns the QUEUE, and what a
 * confirmation unlocks belongs to whichever module owns that object. A file that
 * both ran the queue and reached into sessions, invoices and pots would be a
 * file where a queue bug can take a pot with it.
 *
 * It runs INSIDE the state transition's success path and its failure leaves the
 * row confirmed, which is the right direction to be wrong in: money that arrived
 * is money that arrived, and an operator can re-run a grant. The alternative,
 * rolling the confirmation back because a grant failed, loses the record that
 * the transfer was checked by a person.
 */
export async function confirmPayment(input: {
  paymentId: string;
  byUserId: string;
  onConfirmed?: (payment: ManualPayment) => Promise<void>;
}): Promise<Decision> {
  /*
   * 🔴 78.6 — `decided_at` IS THE DATABASE'S CLOCK, NOT THIS PROCESS'S, AND A
   * COMPANY'S TRANSFER WENT MISSING BECAUSE IT WAS NOT.
   *
   * `grantPotTopUp` will not credit a pot twice, and the way it refuses the
   * second attempt is a comparison:
   *
   *     AND p.decided_at < sponsor_pots.updated_at
   *
   * `sponsor_pots.updated_at` is written by Postgres with `now()`. `decided_at`
   * was written here with the Node process's `new Date()`. Those are two
   * different clocks on two different machines, and nothing keeps them in step.
   *
   * On the branch this was found, the database ran **800 milliseconds ahead**.
   * A pot opened and its first transfer confirmed within that second produced
   * `decided_at` earlier than the `updated_at` stamped moments before it, the
   * guard read a legitimate first confirmation as a replay, and the UPDATE
   * matched no rows. What the operator saw was a payment marked confirmed. What
   * the company got was nothing: the pot kept its welcome credit, the top-up
   * was never credited, and `confirmPayment` logged the failure and returned
   * success, so no screen anywhere said the money had not arrived.
   *
   * An operator confirming a transfer minutes after the pot opens is the
   * ordinary case and hides it. An operator doing both in one sitting, which is
   * exactly what a first sale looks like, does not.
   *
   * So both sides of that comparison are now the database's clock. This is an
   * audit timestamp for money either way, and the machine that stores it is the
   * one that should date it.
   */
  const decided = await db
    .update(manualPayments)
    .set({ state: "confirmed", decidedAt: sql`now()`, decidedBy: input.byUserId })
    .where(
      and(eq(manualPayments.id, input.paymentId), eq(manualPayments.state, "submitted")),
    )
    .returning();

  const payment = decided[0];
  if (!payment) return { error: "That payment is not waiting for a decision." };

  if (input.onConfirmed) {
    try {
      await input.onConfirmed(payment);
    } catch (error) {
      /*
       * Loud, and it does NOT unwind the confirmation. See the note above: the
       * money arrived whatever the grant did, and an operator needs to see this
       * rather than have it disappear into a rollback.
       */
      log.error("manual payment confirmed but the grant failed", {
        paymentId: payment.id,
        purpose: payment.purpose,
        error: String(error),
      });
      /*
       * 🔴 W2-A03: and on the screen, as work with a Retry. "Tell an engineer"
       * was the whole of it before, and nothing listed or re-ran the grant.
       */
      const { flagException } = await import("./rail-exceptions");
      await flagException(payment.id, "grant_failed", String(error));
      return { error: "The payment was recorded but the account was not updated. It is under Needs a decision." };
    }
  }

  /*
   * 🔴 76.14 — AND AFTER THE GRANT, NEVER BEFORE IT.
   *
   * The message tells a patient their session is ready and carries the link. If
   * it were sent before `onConfirmed` ran, a grant that failed would leave
   * somebody holding a link to a session the join gate still refuses, which is
   * a worse outcome than silence and much harder to explain.
   */
  const { noticePaymentConfirmed } = await import("./payment-notices");
  await noticePaymentConfirmed(payment.id);

  return { ok: true };
}

/**
 * 🔴 76.15 — THE MONEY ARRIVED AND NOBODY EVER CLAIMED IT.
 *
 * ## Why an override has to exist
 *
 * The rail's whole design is that nothing moves until a person confirms a
 * CLAIM. That is right, and it has one gap it cannot close by itself: a payer
 * who sends the money and never presses Submit. They have paid us. The bank
 * line is real. Refusing to credit them because the product did not get a form
 * would be the product punishing somebody for its own middle state.
 *
 * ## What makes this safe to have
 *
 * Three things, and none of them is optional:
 *
 *   - **A reason is required**, by this function and by the operator's screen.
 *     An override with no reason is indistinguishable from a mistake.
 *   - **It is flagged on the row forever.** `rejectReason` is reused to carry
 *     the note precisely because it is the column an operator already reads on
 *     every screen that shows this payment: the fact that no proof was ever
 *     given must follow the payment everywhere it appears, not sit in a log.
 *   - **It goes through `confirmPayment`.** The grant, the ledger posting and
 *     the notification are all the same code path as an ordinary confirmation,
 *     so there is no second way for money to reach an account. A separate
 *     "mark as paid" that wrote its own rows is how two systems start
 *     disagreeing about what somebody paid.
 *
 * ## 🔴 IT CANNOT INVENT A PAYMENT FROM NOTHING
 *
 * It operates on a row that already exists, which means somebody opened the
 * sheet for this exact thing at this exact amount. An operator who wants to
 * credit an account with no such row has to go and make one the way a payer
 * would, which is deliberately more work than pressing a button.
 */
export async function confirmWithoutProof(input: {
  paymentId: string;
  byUserId: string;
  /** What the operator saw in the bank. Required, and stored on the row. */
  reason: string;
  onConfirmed?: (payment: ManualPayment) => Promise<void>;
}): Promise<Decision> {
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON) {
    return { error: "Say what you saw in the bank. This stays on the payment." };
  }

  /*
   * 🔴 The row is moved to `submitted` first, then confirmed by the ordinary
   * path. Not because the state machine demands the hop, but because it means
   * `confirmPayment` is the only function in this file that can turn a payment
   * into money, and every guard it carries applies here unchanged.
   */
  const [moved] = await db
    .update(manualPayments)
    .set({
      state: "submitted",
      submittedAt: new Date(),
      rejectReason: `Received without proof. ${reason}`,
    })
    .where(
      and(
        eq(manualPayments.id, input.paymentId),
        eq(manualPayments.state, "awaiting_proof"),
      ),
    )
    .returning({ id: manualPayments.id });

  if (!moved) {
    return { error: "That payment is not an open one. Refresh and look again." };
  }

  /*
   * 🔴 AUDITED AS A BILLING ACT BY A NAMED PERSON, because that is exactly what
   * it is: somebody decided, on their own judgement, that money arrived without
   * the product having any record of a claim. It is the one act on this rail
   * with no payer-side evidence behind it, so the evidence has to be the
   * operator.
   */
  const [operator] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, input.byUserId))
    .limit(1);

  await audit({
    actor: { userId: input.byUserId, organizationId: operator?.organizationId ?? "" },
    category: "billing",
    action: "payment.confirmed_without_proof",
    resourceType: "manual_payment",
    resourceId: input.paymentId,
    reason,
  });

  return confirmPayment({
    paymentId: input.paymentId,
    byUserId: input.byUserId,
    onConfirmed: input.onConfirmed,
  });
}

/**
 * An operator says it did not arrive, and says why.
 *
 * 🔴 The reason is required by the database, not by this function, so no code
 * path anywhere can create a rejection somebody cannot understand. A rejected
 * payment is a person who believes they have paid; telling them only "rejected"
 * guarantees a support ticket and loses their trust in the rail.
 */
export async function rejectPayment(input: {
  paymentId: string;
  byUserId: string;
  reason: string;
}): Promise<Decision> {
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON) {
    return { error: "Give a reason they can act on. At least a sentence." };
  }

  const decided = await db
    .update(manualPayments)
    .set({
      state: "rejected",
      /* The database's clock, for the same reason the confirmation uses it. */
      decidedAt: sql`now()`,
      decidedBy: input.byUserId,
      rejectReason: reason,
    })
    .where(and(eq(manualPayments.id, input.paymentId), eq(manualPayments.state, "submitted")))
    .returning({ id: manualPayments.id });

  if (decided.length === 0) return { error: "That payment is not waiting for a decision." };
  return { ok: true };
}

/* ------------------------------------------------------------- the lock -- */

/**
 * 🔴 THE DETAILS CANNOT CHANGE WHILE SOMEBODY IS TRANSFERRING AGAINST THEM.
 *
 * An operator who edits the account number while eleven payers are mid-transfer
 * has sent eleven people to an account that is no longer the one we will check,
 * and every one of those transfers is real money into a real account with no
 * record tying it to anything. The queue has to be empty first.
 *
 * Returns the number blocking, so the screen can say "4 payments waiting" rather
 * than "you cannot do that".
 */
export async function detailsLockedBy(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(manualPayments)
    .where(inArray(manualPayments.state, ["awaiting_proof", "submitted"]));
  return row?.n ?? 0;
}
