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

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb as db } from "@/lib/db";
import {
  manualPayments,
  type ManualPayment,
  type ManualPaymentPurpose,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

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
  | { kind: "sponsor"; sponsorId: string };

function payerColumns(payer: Payer) {
  switch (payer.kind) {
    case "user":
      return {
        userId: payer.userId,
        patientAccountId: null,
        sponsorId: null,
        organizationId: payer.organizationId ?? null,
      };
    case "patient":
      return {
        userId: null,
        patientAccountId: payer.patientAccountId,
        sponsorId: null,
        organizationId: null,
      };
    case "sponsor":
      return { userId: null, patientAccountId: null, sponsorId: payer.sponsorId, organizationId: null };
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
  amountCents: number;
  currency?: string;
  payer: Payer;
}): Promise<{ id?: string; error?: string }> {
  if (input.amountCents <= 0) return { error: "There is nothing to pay." };

  /* An existing live row for the same thing IS the answer, not a conflict. */
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

  const [row] = await db
    .insert(manualPayments)
    .values({
      purpose: input.purpose,
      refId: input.refId,
      amountCents: input.amountCents,
      currency: input.currency ?? "EGP",
      ...payerColumns(input.payer),
    })
    .returning({ id: manualPayments.id });

  return { id: row!.id };
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
  return { ok: true };
}

/* ------------------------------------------------------------ the decision */

/** Everything an operator has to look at, oldest first because they are waiting. */
export async function queue(): Promise<ManualPayment[]> {
  return db
    .select()
    .from(manualPayments)
    .where(eq(manualPayments.state, "submitted"))
    .orderBy(manualPayments.submittedAt)
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
  const decided = await db
    .update(manualPayments)
    .set({ state: "confirmed", decidedAt: new Date(), decidedBy: input.byUserId })
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
      return { error: "The payment was recorded but the account was not updated. Tell an engineer." };
    }
  }

  return { ok: true };
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
  if (reason.length < 10) {
    return { error: "Give a reason they can act on. At least a sentence." };
  }

  const decided = await db
    .update(manualPayments)
    .set({
      state: "rejected",
      decidedAt: new Date(),
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
