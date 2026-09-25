import "server-only";

import { and, eq, inArray, isNotNull, like, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import {
  manualPayments,
  patientCredits,
  patients,
  refundRequests,
  sessions,
  type ManualPayment,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * 🔴 K20, THE FOUNDER'S DECISION: MONEY FOR A BOOKING CANCELLED WHILE ITS
 * TRANSFER WAITED GOES TO THE PATIENT'S WALLET, AND BACK TO THEIR BANK ONLY IF
 * THEY ASK.
 *
 * The transfer arrived (an operator confirmed it) for a session that no longer
 * wanted it. It used to sit under Needs a decision with nobody's money moving.
 * Now, once the money is confirmed:
 *
 *   - the whole amount received becomes a wallet credit, in the same
 *     transaction that resolves the exception, so the credit and the record of
 *     it cannot part (a second run finds it resolved and credits nothing)
 *   - the books take in the cash that arrived and owe it to the patient:
 *     `cash` +X, `patient_wallet` -X, through `creditWallet` (`wallet_credit`)
 *   - the patient is told, in their language, that it is in their wallet and
 *     that they can ask for it back
 *
 * Staff keep "Refund instead" while the credit is unspent: the credit is
 * reversed on the books and the normal refund queue sends the pounds back.
 *
 * A transfer that was only submitted and then rejected moves nothing, as
 * before: nothing arrived.
 */

/** The start of the resolution a wallet credit writes, and what "Refund instead" reads. */
export const WALLET_RESOLUTION = "Credited to the patient's wallet as credit ";

function creditIdIn(resolution: string | null): string | null {
  if (!resolution?.startsWith(WALLET_RESOLUTION)) return null;
  const match = resolution.slice(WALLET_RESOLUTION.length).match(/^[0-9a-f-]{36}/);
  return match?.[0] ?? null;
}

/**
 * Credit one confirmed transfer for a cancelled, unpaid booking to the
 * patient's wallet. Nothing when it is not that (still waiting, rejected,
 * already resolved, a guest with no wallet, the wallet switched off).
 */
export async function creditCancelledTransfer(paymentId: string): Promise<{ credited: boolean; creditId?: string }> {
  const [row] = await db
    .select({
      id: manualPayments.id,
      purpose: manualPayments.purpose,
      state: manualPayments.state,
      exception: manualPayments.exception,
      resolvedAt: manualPayments.exceptionResolvedAt,
      decidedBy: manualPayments.decidedBy,
      settlesCents: manualPayments.settlesCents,
      amountCents: manualPayments.amountCents,
      currency: manualPayments.currency,
      sessionId: sessions.id,
      sessionStatus: sessions.status,
      paymentStatus: sessions.paymentStatus,
      organizationId: sessions.organizationId,
      personId: patients.personId,
    })
    .from(manualPayments)
    .innerJoin(sessions, eq(sessions.id, manualPayments.refId))
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(manualPayments.id, paymentId))
    .limit(1);

  if (
    !row ||
    !(row.purpose === "session" || row.purpose === "payg_session") ||
    row.state !== "confirmed" ||
    row.exception !== "not_payable" ||
    row.resolvedAt ||
    row.sessionStatus !== "cancelled" ||
    row.paymentStatus === "paid" ||
    row.settlesCents <= 0
  ) {
    return { credited: false };
  }

  /*
   * Left for a person when there is no wallet to put it in (a guest who never
   * had an account), when the wallet is switched off, or when nobody is named
   * on the confirmation (the resolution needs a name, 0142's CHECK).
   */
  const { getSettings } = await import("@/lib/settings");
  if (!row.personId || !row.decidedBy || !(await getSettings()).rules.wallet.enabled) {
    return { credited: false };
  }
  const personId = row.personId;
  const decidedBy = row.decidedBy;

  /* Read before the transaction, which holds the pool's one connection. */
  const { creditWallet, walletExpiryFrom } = await import("./wallet");
  const expiresAt = await walletExpiryFrom(new Date());

  const creditId = await db
    .transaction(async (tx) => {
      const credit = await creditWallet({
        personId,
        cents: row.settlesCents,
        reason: "A booking cancelled before your transfer was checked",
        fromSessionId: row.sessionId,
        executor: tx,
        expiresAt,
        from: [
          {
            account: "cash",
            amountCents: row.settlesCents,
            organizationId: row.organizationId,
            memo: "Transfer for a cancelled booking, held in the patient's wallet",
          },
        ],
      });
      if (!credit) throw new NothingToCredit();
      /* The claim: only while unresolved, so a second run rolls its credit back. */
      const [claimed] = await tx
        .update(manualPayments)
        .set({
          exceptionResolvedAt: new Date(),
          exceptionResolvedBy: decidedBy,
          exceptionResolution: `${WALLET_RESOLUTION}${credit.creditId}. Refund instead from here if they ask.`,
        })
        .where(
          and(
            eq(manualPayments.id, row.id),
            eq(manualPayments.exception, "not_payable"),
            sql`${manualPayments.exceptionResolvedAt} IS NULL`,
          ),
        )
        .returning({ id: manualPayments.id });
      if (!claimed) throw new NothingToCredit();
      return credit.creditId;
    })
    .catch((error: unknown) => {
      if (error instanceof NothingToCredit) return null;
      throw error;
    });

  if (!creditId) return { credited: false };
  log.info("cancelled booking's transfer credited to the wallet", { payment: ref(row.id), cents: row.settlesCents });

  await tellPatient({ personId, amountCents: row.amountCents, currency: row.currency }).catch((error) =>
    log.warn("wallet credit notice not sent", { payment: ref(row.id), reason: String(error).slice(0, 200) }),
  );
  return { credited: true, creditId };
}

class NothingToCredit extends Error {}

/** In their own language, in the app and by email: it is in the wallet, and they can ask for it back. */
async function tellPatient(input: { personId: string; amountCents: number; currency: string }): Promise<void> {
  const { people } = await import("@/lib/db/schema");
  const [person] = await db
    .select({ email: people.email, phone: people.phone })
    .from(people)
    .where(eq(people.id, input.personId))
    .limit(1);
  const { wordsFor } = await import("@/lib/i18n/message-words");
  const words = await wordsFor({ personId: input.personId });
  const { formatMoney } = await import("./plans");
  const { notify } = await import("@/lib/notify");
  const { env } = await import("@/lib/env");
  await notify(
    { personId: input.personId, email: person?.email ?? null, phone: person?.phone ?? null, locale: words.locale },
    {
      notice: { kind: "payment_confirmed", key: "pnotice.walletCredited" },
      kind: "payment.wallet_credited",
      subject: words.t("pmsg.walletCredited.subject"),
      body: words.t("pmsg.walletCredited.body", {
        amount: formatMoney(input.amountCents, input.currency.toUpperCase(), words.locale),
      }),
      link: { label: words.t("pmsg.walletCredited.open"), url: `${env.appUrl}/patient/billing` },
    },
  );
}

/**
 * The confirmed transfers for cancelled bookings sitting in a wallet, whose
 * credit is still whole: the rows "Refund instead" can act on.
 */
export async function walletCreditedTransfers(): Promise<(ManualPayment & { creditId: string })[]> {
  const rows = await db
    .select()
    .from(manualPayments)
    .where(
      and(
        eq(manualPayments.state, "confirmed"),
        isNotNull(manualPayments.exceptionResolvedAt),
        like(manualPayments.exceptionResolution, `${WALLET_RESOLUTION}%`),
      ),
    )
    .orderBy(sql`${manualPayments.exceptionResolvedAt} DESC`)
    .limit(100);
  const withCredit = rows
    .map((row) => ({ ...row, creditId: creditIdIn(row.exceptionResolution) }))
    .filter((row): row is ManualPayment & { creditId: string } => Boolean(row.creditId));
  if (withCredit.length === 0) return [];
  const whole = await db
    .select({ id: patientCredits.id })
    .from(patientCredits)
    .where(
      and(
        inArray(patientCredits.id, withCredit.map((row) => row.creditId)),
        eq(patientCredits.spentCents, 0),
        eq(patientCredits.expiredCents, 0),
        sql`${patientCredits.expiresAt} > now()`,
      ),
    );
  const unspent = new Set(whole.map((c) => c.id));
  return withCredit.filter((row) => unspent.has(row.creditId));
}

/**
 * 🔴 "REFUND INSTEAD": the patient asked for the money back.
 *
 * Only while the wallet credit is whole (nothing spent, held or expired from
 * it), claimed with one conditional UPDATE that marks it used, so two presses
 * refund once and a credit already spent cannot be refunded as well. In one
 * transaction with the claim: the credit is reversed on the books
 * (`patient_wallet` +X, `cash` -X, the mirror of how it came in) and the
 * normal refund is queued for the whole amount, which staff send like any
 * other. Sending it posts nothing more: the money left the books here.
 */
export async function refundTransferInstead(input: {
  paymentId: string;
  byUserId: string;
  reason: string;
}): Promise<{ ok?: true; requestId?: string; error?: string }> {
  const { MIN_REASON } = await import("@/lib/admin/reason");
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON) return { error: "Say why the patient wants it refunded instead." };

  const [payment] = await db
    .select({
      id: manualPayments.id,
      state: manualPayments.state,
      resolution: manualPayments.exceptionResolution,
      settlesCents: manualPayments.settlesCents,
      organizationId: sessions.organizationId,
      guestName: sessions.guestName,
      firstName: patients.firstName,
      lastName: patients.lastName,
    })
    .from(manualPayments)
    .innerJoin(sessions, eq(sessions.id, manualPayments.refId))
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(manualPayments.id, input.paymentId))
    .limit(1);
  const creditId = creditIdIn(payment?.resolution ?? null);
  if (!payment || payment.state !== "confirmed" || !creditId) {
    return { error: "That transfer is not in a patient's wallet." };
  }
  const organizationId = payment.organizationId;

  const { journal } = await import("./ledger");
  const outcome = await db
    .transaction(async (tx) => {
      const [taken] = await tx
        .update(patientCredits)
        .set({ spentCents: sql`${patientCredits.amountCents}`, updatedAt: new Date() })
        .where(
          and(
            eq(patientCredits.id, creditId),
            eq(patientCredits.spentCents, 0),
            eq(patientCredits.expiredCents, 0),
            sql`${patientCredits.expiresAt} > now()`,
          ),
        )
        .returning({ cents: patientCredits.amountCents });
      if (!taken) return { error: "The wallet credit has been used or has expired, so it cannot be refunded instead." };

      await journal({
        kind: "wallet_credit",
        refType: "patient_credit",
        refId: creditId,
        executor: tx,
        createdBy: input.byUserId,
        legs: [
          { account: "patient_wallet", amountCents: taken.cents, organizationId, memo: "Refund asked instead of the wallet" },
          { account: "cash", amountCents: -taken.cents, organizationId, memo: "Owed back to the patient by transfer" },
        ],
      });

      const [queued] = await tx
        .insert(refundRequests)
        .values({
          manualPaymentId: payment.id,
          organizationId,
          amountCents: taken.cents,
          currency: "usd",
          payeeName: [payment.firstName, payment.lastName].filter(Boolean).join(" ") || payment.guestName || null,
          reason: "patient_cancel",
          requestedByUserId: input.byUserId,
        })
        .returning({ id: refundRequests.id });

      await tx
        .update(manualPayments)
        .set({
          exceptionResolution: sql`left(${manualPayments.exceptionResolution} || ${` Refund asked instead: ${reason}`}, 500)`,
        })
        .where(eq(manualPayments.id, payment.id));
      return { ok: true as const, requestId: queued!.id };
    });

  if (outcome.ok) log.info("wallet credit refunded instead", { payment: ref(payment.id) });
  return outcome;
}

/**
 * A "Refund instead" whose refund was cancelled after all: the money goes back
 * into the wallet as a fresh credit, so cancelling the refund never loses it.
 */
export async function rewalletCancelledRefund(requestId: string): Promise<void> {
  const [row] = await db
    .select({
      manualPaymentId: refundRequests.manualPaymentId,
      amountCents: refundRequests.amountCents,
      organizationId: refundRequests.organizationId,
      status: refundRequests.status,
      sessionId: sessions.id,
      personId: patients.personId,
    })
    .from(refundRequests)
    .innerJoin(manualPayments, eq(manualPayments.id, refundRequests.manualPaymentId))
    .innerJoin(sessions, eq(sessions.id, manualPayments.refId))
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(refundRequests.id, requestId))
    .limit(1);
  if (!row || row.status !== "cancelled" || !row.personId) return;
  const { creditWallet } = await import("./wallet");
  await creditWallet({
    personId: row.personId,
    cents: row.amountCents,
    reason: "A refund you asked for was cancelled; the money is back in your wallet",
    fromSessionId: row.sessionId,
    from: [{ account: "cash", amountCents: row.amountCents, organizationId: row.organizationId, memo: "Refund cancelled, back in the wallet" }],
  });
}
