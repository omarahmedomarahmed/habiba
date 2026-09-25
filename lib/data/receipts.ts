import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  gatewayPayments,
  manualPayments,
  patients,
  sessionPayments,
  sessions,
  users,
} from "@/lib/db/schema";

/**
 * 🔴 Task 40: A PATIENT'S RECEIPT FOR ONE PAYMENT, AND ONLY THEIR OWN.
 *
 * Ruling 4 and the agent model (ruling 1): our document is a payment receipt,
 * never a tax invoice. It lists what the patient paid and nothing else: a
 * session the company benefit covered in full has no receipt for them,
 * because they paid nothing.
 *
 * Asked by person, in the WHERE: a payment id alone opens nothing. A payment
 * of somebody else's comes back exactly like one that does not exist.
 */
export type Receipt = {
  paymentId: string;
  number: string;
  paidAt: Date | null;
  refunded: boolean;
  payerName: string;
  therapistName: string;
  sessionAt: Date | null;
  currency: string;
  /** The session's price, the company's share, VAT and the card fee, in `currency`. */
  priceCents: number;
  coveredCents: number;
  vatCents: number;
  cardFeeCents: number;
  totalCents: number;
  /** What was actually taken, when it was taken in another currency. */
  charged: { minor: number; currency: string } | null;
  method: { kind: "card"; last4: string | null } | { kind: "transfer" } | null;
};

function receiptNumber(paymentId: string): string {
  return `R-${paymentId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

export async function receiptFor(personId: string, paymentId: string): Promise<Receipt | null> {
  const [row] = await controlDb
    .select({
      id: sessionPayments.id,
      sessionId: sessionPayments.sessionId,
      status: sessionPayments.status,
      paidAt: sessionPayments.paidAt,
      grossCents: sessionPayments.grossCents,
      vatCents: sessionPayments.vatCents,
      currency: sessionPayments.currency,
      fundingSource: sessionPayments.fundingSource,
      coverageBps: sessionPayments.coverageBps,
      sponsorShareCents: sessionPayments.sponsorShareCents,
      patientShareCents: sessionPayments.patientShareCents,
      presentedCents: sessionPayments.presentedCents,
      presentedCurrency: sessionPayments.presentedCurrency,
      payerName: sessionPayments.payerName,
      last4: sessionPayments.paymentLast4,
      stripePaymentIntentId: sessionPayments.stripePaymentIntentId,
      scheduledAt: sessions.scheduledAt,
      startedAt: sessions.startedAt,
      guestName: sessions.guestName,
      firstName: patients.firstName,
      lastName: patients.lastName,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
    })
    .from(sessionPayments)
    .innerJoin(sessions, eq(sessions.id, sessionPayments.sessionId))
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .where(
      and(
        eq(sessionPayments.id, paymentId),
        eq(patients.personId, personId),
        inArray(sessionPayments.status, ["paid", "refunded"]),
      ),
    )
    .limit(1);
  if (!row) return null;

  const pot = row.fundingSource === "pot";
  const fullyCoveredLegacy = pot && row.coverageBps === 0 && row.sponsorShareCents === 0 && row.patientShareCents === 0;
  const ownShare = pot ? (fullyCoveredLegacy ? 0 : row.patientShareCents) : row.grossCents;
  /* Covered in full: the patient paid nothing, so there is nothing to receipt. */
  if (ownShare <= 0) return null;

  const [card] = await controlDb
    .select({
      amountMinor: gatewayPayments.amountMinor,
      currency: gatewayPayments.currency,
      cardFeeCents: gatewayPayments.cardFeeCents,
    })
    .from(gatewayPayments)
    .where(
      and(
        eq(gatewayPayments.sessionPaymentId, row.id),
        inArray(gatewayPayments.state, ["paid", "refunded"]),
      ),
    )
    .limit(1);

  const [transfer] = card
    ? []
    : await controlDb
        .select({ amountCents: manualPayments.amountCents, currency: manualPayments.currency })
        .from(manualPayments)
        .where(
          and(
            eq(manualPayments.refId, row.sessionId),
            inArray(manualPayments.purpose, ["session", "payg_session"]),
            eq(manualPayments.state, "confirmed"),
          ),
        )
        .limit(1);

  const cardFeeCents = card?.cardFeeCents ?? 0;
  const vatCents = Math.max(0, row.vatCents);

  return {
    paymentId: row.id,
    number: receiptNumber(row.id),
    paidAt: row.paidAt,
    refunded: row.status === "refunded",
    payerName:
      row.payerName ||
      [row.firstName, row.lastName].filter(Boolean).join(" ") ||
      row.guestName ||
      "",
    therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
    sessionAt: row.scheduledAt ?? row.startedAt,
    currency: row.currency,
    priceCents: row.grossCents,
    coveredCents: pot ? row.grossCents - ownShare : 0,
    vatCents,
    cardFeeCents,
    totalCents: ownShare + vatCents + cardFeeCents,
    charged: card
      ? { minor: card.amountMinor, currency: card.currency }
      : transfer
        ? { minor: transfer.amountCents, currency: transfer.currency }
        : row.presentedCents !== null && row.presentedCurrency
          ? { minor: row.presentedCents, currency: row.presentedCurrency }
          : null,
    method: card || row.stripePaymentIntentId
      ? { kind: "card", last4: row.last4 }
      : transfer
        ? { kind: "transfer" }
        : null,
  };
}
