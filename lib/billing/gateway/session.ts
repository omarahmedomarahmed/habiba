import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import {
  gatewayPayments,
  sessionPayments,
  sessions,
  therapistVerifications,
  users,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";

import { collectionGateway, gatewayNamed } from "./index";
import type { CollectionEvent } from "./types";

/**
 * 🔴 A SESSION PAID BY CARD IN EGYPT, through whichever gateway is contracted.
 *
 * The same money as the transfer rail (`manual-grants.ts`), arriving a
 * different way: the patient is quoted in pounds at the operator's rate, the
 * amount is what they owe after any benefit plus VAT on it, and the money lands
 * in the Egyptian entity's account, so it is always held (`capture: platform`)
 * and the clinician is paid from the manual queue or a payouts provider.
 *
 * Three steps, each safe to repeat:
 *
 *   checkout  a `gateway_payments` row per attempt, and the session's payment
 *             row pending (or, on a covered session, the pot's row as it is)
 *   settle    from the gateway's signed callback or a status read, whichever
 *             comes first: the attempt is claimed `created -> paid` once, the
 *             session claimed paid (never a cancelled or refunded one), and
 *             only then are the books posted
 *   refund    the gateway returns it against its transaction id, and the books
 *             reverse by whoever calls this (`refundSessionPayment`)
 */

type Result = { ok: true; url: string } | { ok: false; error: string };

const NOT_READY =
  "Card payments in that country go through a different rail, which is not switched on yet. Ask your therapist for a free link: the session itself works exactly the same.";

export async function createGatewaySessionCheckout(input: {
  sessionId: string;
  token: string;
  payerName: string;
  payerEmail: string | null;
  payerPhone: string | null;
}): Promise<Result> {
  const gateway = await collectionGateway();
  if (!gateway) return { ok: false, error: NOT_READY };

  const [row] = await db
    .select({
      session: sessions,
      stripeAccountId: users.stripeAccountId,
      payoutsEnabled: users.payoutsEnabled,
      therapistCountry: therapistVerifications.country,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .leftJoin(therapistVerifications, eq(therapistVerifications.userId, users.id))
    .where(eq(sessions.id, input.sessionId))
    .limit(1);
  if (!row) return { ok: false, error: "That session no longer exists." };
  if (row.session.paymentStatus === "paid") return { ok: false, error: "This session is already paid." };
  if (row.session.status === "cancelled") return { ok: false, error: "This session was cancelled." };

  const { patientOwesFor } = await import("@/lib/billing/session-owed");
  const { sessionTransferMoney } = await import("@/lib/billing/manual-entry");
  const { egpRateMicro, egpMinorFor } = await import("@/lib/billing/manual");
  const owed = await patientOwesFor(input.sessionId);
  if (owed.grossCents <= 0) return { ok: false, error: "There is nothing to pay for this session." };
  const money = await sessionTransferMoney({
    organizationId: row.session.organizationId,
    priceCents: owed.grossCents,
  });
  const rate = await egpRateMicro();
  /* What settles the session, in pounds: their share after any benefit, and its VAT. */
  const sessionMinor = egpMinorFor(money.settlesCents, rate);
  /*
   * 🔴 RULING 12: THE PATIENT PAYS THE CARD FEE, on this card part only, since
   * `owed` is already after the company's share. Frozen onto the attempt below,
   * so a rule changed while the card page is open prices the next checkout,
   * not this one. The same function prices the line on the pay page.
   */
  const { cardFeeMinorFor, getSettings: rulesNow } = await import("@/lib/settings");
  const { usdCentsFor } = await import("@/lib/money/convert");
  const cardFeeMinor = cardFeeMinorFor((await rulesNow()).rules, sessionMinor);
  const cardFeeCents = usdCentsFor(cardFeeMinor, rate);
  const amountMinor = sessionMinor + cardFeeMinor;

  const [existing] = await db
    .select()
    .from(sessionPayments)
    .where(eq(sessionPayments.sessionId, input.sessionId))
    .limit(1);

  let sessionPaymentId: string;
  if (existing?.fundingSource === "pot") {
    /* Covered: the pot's row is the session's one row; their share settles onto it. */
    if (existing.status !== "paid") return { ok: false, error: "This session's benefit is not settled." };
    sessionPaymentId = existing.id;
  } else {
    if (existing && existing.status !== "pending") return { ok: false, error: "This session is already paid." };
    const { getSettings, sessionMoney } = await import("@/lib/settings");
    const { crossingFor, payoutRailFor } = await import("@/lib/billing/money");
    const settings = await getSettings();
    const split = sessionMoney({
      grossCents: owed.grossCents,
      feeBps: settings.session.platformFeeBps,
      vatBps: 0,
    });
    const values = {
      organizationId: row.session.organizationId,
      therapistId: row.session.therapistId,
      sessionId: input.sessionId,
      payerName: input.payerName.slice(0, 80),
      payerEmail: input.payerEmail?.trim().toLowerCase() || null,
      grossCents: owed.grossCents,
      currency: "usd",
      vatCents: money.vatCents,
      vatBps: money.vatBps,
      payerCountry: "EG",
      /* The session's figure; the card fee is the gateway's and lives on the attempt. */
      presentedCents: sessionMinor,
      presentedCurrency: "egp",
      fxRateMicro: rate,
      fxQuotedAt: new Date(),
      coverageBps: 0,
      sponsorShareCents: 0,
      patientShareCents: owed.grossCents,
      platformFeeCents: split.platformCutCents,
      platformFeeBps: settings.session.platformFeeBps,
      settledInvoiceCents: 0,
      therapistNetCents: split.therapistNetCents,
      /* Held: the pounds land in the Egyptian entity's account (C309). */
      capture: "platform" as const,
      crossing: crossingFor({
        paidVia: "local_egp",
        therapist: payoutRailFor({
          stripeAccountId: row.stripeAccountId,
          payoutsEnabled: row.payoutsEnabled,
          country: row.therapistCountry,
        }),
      }),
      status: "pending" as const,
      /* The column's `card` answers the only question it is asked: not a pot. */
      fundingSource: "card" as const,
    };
    const [upserted] = await db
      .insert(sessionPayments)
      .values(values)
      .onConflictDoUpdate({
        target: sessionPayments.sessionId,
        setWhere: eq(sessionPayments.status, "pending"),
        set: { ...values, createdAt: new Date() },
      })
      .returning({ id: sessionPayments.id });
    if (!upserted) return { ok: false, error: "This session is already paid." };
    sessionPaymentId = upserted.id;
  }

  const reference = crypto.randomUUID();
  const therapist = [row.therapistFirst, row.therapistLast].filter(Boolean).join(" ");
  const created = await gateway.createCheckout({
    reference,
    amountMinor,
    currency: "egp",
    /* 🔴 They sum to `amountMinor`, which Paymob checks. */
    items: [
      { name: therapist ? `Therapy session with ${therapist}` : "Therapy session", amountMinor: egpMinorFor(money.grossCents, rate) },
      ...(money.vatCents > 0 ? [{ name: "VAT", amountMinor: sessionMinor - egpMinorFor(money.grossCents, rate) }] : []),
      ...(cardFeeMinor > 0 ? [{ name: "Card fee", amountMinor: cardFeeMinor }] : []),
    ],
    payer: { name: input.payerName, email: input.payerEmail, phone: input.payerPhone },
    returnUrl: `${env.appUrl}/pay/${input.token}?gateway=${reference}`,
    callbackUrl: `${env.appUrl}/api/gateway/callback`,
  });
  if (!created.ok) {
    log.error("gateway refused a checkout", { session: ref(input.sessionId), reason: created.reason });
    return { ok: false, error: "The card page could not be opened. Try again, or pay by transfer." };
  }

  await db.insert(gatewayPayments).values({
    id: reference,
    provider: gateway.name,
    purpose: "session",
    refId: input.sessionId,
    sessionPaymentId,
    amountMinor,
    currency: "egp",
    usdCents: money.settlesCents,
    vatCents: money.vatCents,
    cardFeeMinor,
    cardFeeCents,
    providerRef: created.providerRef,
  });

  return { ok: true, url: created.checkoutUrl };
}

/**
 * 🔴 WHAT THE GATEWAY SAID, APPLIED ONCE. The callback route and the payer's
 * return both come here; whichever is first does the work.
 */
export async function applyGatewayEvent(
  provider: string,
  event: CollectionEvent,
): Promise<{ applied: "paid" | "failed" | "ignored" | "returned" }> {
  const [attempt] = await db
    .select()
    .from(gatewayPayments)
    .where(and(eq(gatewayPayments.provider, provider), eq(gatewayPayments.providerRef, event.providerRef)))
    .limit(1);
  if (!attempt) {
    log.warn("gateway event for an attempt we never opened", { provider });
    return { applied: "ignored" };
  }

  if (event.outcome === "failed") {
    await db
      .update(gatewayPayments)
      .set({ state: "failed", failure: (event.failure ?? "declined").slice(0, 300), failedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(gatewayPayments.id, attempt.id), eq(gatewayPayments.state, "created")));
    return { applied: "failed" };
  }
  if (event.outcome !== "paid") return { applied: "ignored" };

  /*
   * 🔴 The amount is the gateway's word, checked against ours. A paid event for
   * a different sum is not our payment to accept: it is refused, loudly, and a
   * person looks.
   */
  if (event.amountMinor !== attempt.amountMinor || event.currency.toLowerCase() !== attempt.currency) {
    log.error("gateway paid a different amount than it was asked for", {
      attempt: ref(attempt.id),
      asked: attempt.amountMinor,
      paid: event.amountMinor,
    });
    return { applied: "ignored" };
  }
  if (!event.transactionId) return { applied: "ignored" };

  const [claimed] = await db
    .update(gatewayPayments)
    .set({ state: "paid", providerTxnId: event.transactionId, paidAt: new Date(), updatedAt: new Date() })
    .where(and(eq(gatewayPayments.id, attempt.id), inArray(gatewayPayments.state, ["created", "failed"])))
    .returning();
  if (!claimed) return { applied: "ignored" };

  const [payment] = claimed.sessionPaymentId
    ? await db.select().from(sessionPayments).where(eq(sessionPayments.id, claimed.sessionPaymentId)).limit(1)
    : [];
  const { claimSessionPaid } = await import("@/lib/billing/session-owed");

  /*
   * A session that no longer wants the money (cancelled, refunded, paid another
   * way while the card page was open) gets it straight back from the gateway.
   */
  const wanted =
    payment &&
    (payment.fundingSource === "pot" || payment.status === "pending") &&
    (await claimSessionPaid(claimed.refId));
  if (!wanted || !payment) {
    await returnAttempt(claimed.id, "the session no longer needs paying");
    return { applied: "returned" };
  }

  if (payment.fundingSource === "pot") {
    await db
      .update(sessionPayments)
      .set({ vatCents: payment.vatCents + claimed.vatCents })
      .where(eq(sessionPayments.id, payment.id));
    const { bookEmployeeShare } = await import("@/lib/billing/employee-share");
    await bookEmployeeShare({ paymentId: payment.id, capture: "platform", vatCents: claimed.vatCents });
  } else {
    const [paid] = await db
      .update(sessionPayments)
      .set({ status: "paid", paidAt: new Date() })
      .where(and(eq(sessionPayments.id, payment.id), eq(sessionPayments.status, "pending")))
      .returning();
    if (paid) {
      const { postSessionPayment } = await import("@/lib/billing/ledger");
      await postSessionPayment({
        id: paid.id,
        organizationId: paid.organizationId,
        therapistId: paid.therapistId,
        capture: "platform",
        grossCents: paid.grossCents,
        vatCents: paid.vatCents,
        platformFeeCents: paid.platformFeeCents,
        settledInvoiceCents: 0,
        therapistNetCents: paid.therapistNetCents,
      });
    }
  }

  await postCardFee(claimed, payment.organizationId);

  const { markInSession } = await import("@/lib/data/radar");
  await markInSession(claimed.refId);
  log.info("gateway payment settled", { attempt: ref(claimed.id) });
  return { applied: "paid" };
}

/** The payer came back: ask the gateway rather than wait for its callback. */
export async function confirmGatewayReturn(reference: string): Promise<void> {
  const [attempt] = await db
    .select()
    .from(gatewayPayments)
    .where(eq(gatewayPayments.id, reference))
    .limit(1);
  /* A declined card can be tried again on the same page, so a failed attempt is asked too. */
  if (!attempt || (attempt.state !== "created" && attempt.state !== "failed")) return;
  const gateway = gatewayNamed(attempt.provider);
  if (!gateway) return;
  const status = await gateway.fetchStatus(attempt.providerRef);
  if ("ok" in status) return;
  await applyGatewayEvent(attempt.provider, status);
}

/** Money that arrived for nothing is sent back, and the attempt says so. */
async function returnAttempt(attemptId: string, why: string): Promise<void> {
  const refunded = await refundAttempt(attemptId);
  if (!refunded.ok) {
    log.error("gateway money for an unpayable session was not returned", { attempt: ref(attemptId), why });
  }
}

async function refundAttempt(attemptId: string): Promise<{ ok: true; usdCents: number } | { ok: false; error: string }> {
  const [attempt] = await db.select().from(gatewayPayments).where(eq(gatewayPayments.id, attemptId)).limit(1);
  if (!attempt || attempt.state !== "paid" || !attempt.providerTxnId) {
    return { ok: false, error: "Nothing paid through the gateway to return." };
  }
  const gateway = gatewayNamed(attempt.provider);
  if (!gateway) return { ok: false, error: "The gateway that took this payment is not available." };
  /*
   * 🔴 CLAIMED FIRST, so two callers cannot both send it back. A claim older
   * than ten minutes belonged to a process that died and may be taken again;
   * the attempt id is the gateway's idempotency key for the refund.
   */
  const [claimed] = await db
    .update(gatewayPayments)
    .set({ refundingAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(gatewayPayments.id, attempt.id),
        eq(gatewayPayments.state, "paid"),
        sql`(${gatewayPayments.refundingAt} IS NULL OR ${gatewayPayments.refundingAt} < now() - interval '10 minutes')`,
      ),
    )
    .returning({ id: gatewayPayments.id });
  if (!claimed) return { ok: false, error: GATEWAY_REFUND_CLAIMED };
  const release = () =>
    db.update(gatewayPayments).set({ refundingAt: null, updatedAt: new Date() }).where(eq(gatewayPayments.id, attempt.id));
  try {
    const result = await gateway.refund({
      transactionId: attempt.providerTxnId,
      amountMinor: attempt.amountMinor - attempt.refundedMinor,
      reference: attempt.id,
    });
    if (!result.ok) {
      await release();
      return { ok: false, error: result.reason };
    }
  } catch (error) {
    await release();
    return { ok: false, error: safeErrorMessage(error) };
  }
  const [moved] = await db
    .update(gatewayPayments)
    .set({ state: "refunded", refundedMinor: attempt.amountMinor, refundedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(gatewayPayments.id, attempt.id), eq(gatewayPayments.state, "paid")))
    .returning({ id: gatewayPayments.id });
  if (!moved) return { ok: false, error: "The payment moved on while it was being returned." };
  await postCardFeeReturned(attempt);
  /* What went back to the payer, in dollars: the session's share and the card fee they paid on it. */
  return { ok: true, usdCents: attempt.usdCents + attempt.cardFeeCents };
}

/**
 * 🔴 RULING 12: THE CARD FEE ON THE BOOKS, AND WHY IT NEEDS NO NEW ACCOUNT.
 *
 * The patient paid the fee on top of the session; the gateway keeps it before
 * it settles, so it never becomes ours. Posted gross so the trail shows it:
 * the patient's money in and straight back out of `cash` to the gateway, and
 * the gateway's charge as a cost in `platform_expense` met in full by the
 * patient's payment of it. Every account nets to zero, nothing reaches
 * `platform_revenue`, and the session's own legs (price, VAT, our fee, the
 * clinician's share) are untouched. A payable to the gateway would be a new
 * account holding a balance for no time at all, because the gateway settles
 * net, so it is not added.
 *
 * Its own transaction kind, `card_fee`, so the per-payment sums that reverse a
 * session on a refund (`session_payment`, `session_refund`) never see it.
 */
async function postCardFee(attempt: { id: string; cardFeeCents: number }, organizationId: string): Promise<void> {
  const fee = attempt.cardFeeCents;
  if (fee <= 0) return;
  const { journal } = await import("@/lib/billing/ledger");
  await journal({
    kind: "card_fee",
    refType: "gateway_payment",
    refId: attempt.id,
    legs: [
      { account: "cash", amountCents: fee, organizationId, memo: "Card fee paid by the patient on top of the session" },
      { account: "cash", amountCents: -fee, organizationId, memo: "Card fee kept by the gateway before it settles" },
      { account: "platform_expense", amountCents: fee, organizationId, memo: "The gateway's card fee" },
      { account: "platform_expense", amountCents: -fee, organizationId, memo: "Met by the patient, so it costs us nothing" },
    ],
  });
}

/**
 * 🔴 A REFUND HANDS THE PATIENT BACK EVERYTHING, CARD FEE INCLUDED (ruling 16
 * is a full refund), while the gateway keeps the fee it charged on the
 * payment. That fee is now ours to bear: out of `cash`, into
 * `platform_expense`. The one card-fee posting that is not a wash.
 */
// PAYMOB-CONFIRM: that Paymob keeps its fee when a payment is refunded; if it returns it, this posting is not owed and should go.
async function postCardFeeReturned(attempt: {
  id: string;
  cardFeeCents: number;
  sessionPaymentId: string | null;
}): Promise<void> {
  const fee = attempt.cardFeeCents;
  if (fee <= 0) return;
  const [payment] = attempt.sessionPaymentId
    ? await db
        .select({ organizationId: sessionPayments.organizationId })
        .from(sessionPayments)
        .where(eq(sessionPayments.id, attempt.sessionPaymentId))
        .limit(1)
    : [];
  const { journal } = await import("@/lib/billing/ledger");
  await journal({
    kind: "card_fee",
    refType: "gateway_payment",
    refId: attempt.id,
    legs: [
      { account: "cash", amountCents: -fee, organizationId: payment?.organizationId ?? null, memo: "Card fee returned to the patient with their refund" },
      { account: "platform_expense", amountCents: fee, organizationId: payment?.organizationId ?? null, memo: "The gateway keeps its fee on a refunded payment" },
    ],
  });
}

/** Another caller holds the refund claim on this attempt. */
export const GATEWAY_REFUND_CLAIMED = "This payment is already being returned.";

/** The paid gateway attempt behind a session payment, if the payer used one. */
export async function paidAttemptFor(sessionPaymentId: string) {
  const [attempt] = await db
    .select()
    .from(gatewayPayments)
    .where(and(eq(gatewayPayments.sessionPaymentId, sessionPaymentId), eq(gatewayPayments.state, "paid")))
    .limit(1);
  return attempt ?? null;
}

/**
 * The refund of a session paid through a gateway: the gateway returns it, and
 * the caller (`refundSessionPayment`) reverses the books and marks the row.
 */
export async function refundThroughGateway(
  sessionPaymentId: string,
): Promise<{ ok: true; usdCents: number } | { ok: false; error: string } | null> {
  const attempt = await paidAttemptFor(sessionPaymentId);
  if (!attempt) return null;
  return refundAttempt(attempt.id);
}
