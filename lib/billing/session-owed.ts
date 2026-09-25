import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { sessionPayments, sessions } from "@/lib/db/schema";

import type { PaymentLine } from "./manual";

/**
 * 🔴 W2-M01 / W2-M03: THE PATIENT'S MONEY ARRIVED, AND THE SESSION STILL WANTS IT.
 *
 * The one claim both rails make when the patient's own money lands, whole or
 * the share left after their benefit: `payment_status` from `pending` to
 * `paid`, and only if the session is still worth paying for. `pending` alone
 * was not that question. A refund sets the session back to `pending`, and a
 * cancelled session stays `pending`, so a transfer confirmed after either
 * marked a refunded or cancelled session paid and posted money against it.
 *
 * True only for the call that made the move, so what follows it runs once.
 */
export async function claimSessionPaid(sessionId: string): Promise<boolean> {
  const moved = await db
    .update(sessions)
    .set({ paymentStatus: "paid", updatedAt: new Date() })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.paymentStatus, "pending"),
        ne(sessions.status, "cancelled"),
        sql`NOT EXISTS (SELECT 1 FROM ${sessionPayments}
                         WHERE ${sessionPayments.sessionId} = ${sessionId}
                           AND ${sessionPayments.status} = 'refunded')`,
      ),
    )
    .returning({ id: sessions.id });
  if (moved.length === 0) return false;
  /* 🔴 0169: the wallet's hold is spent by the same claim, whichever rail made it. */
  const { spendHold } = await import("./wallet");
  await spendHold(sessionId);
  return true;
}

/**
 * 🔴 76.27 — WHAT A PATIENT STILL OWES, AFTER THEIR BENEFIT HAS PAID ITS HALF.
 *
 * ## The defect this exists to close, and it was live
 *
 * `payFromPot` runs at BOOKING. For a company covering 50% of a $20 session it
 * debits the pot $10, writes a `session_payments` row carrying the frozen split
 * — `sponsorShareCents` and `patientShareCents`, with a comment saying *"written
 * here and read for ever after"* — and deliberately leaves the session
 * `pending`, because *"a partly covered session is not a paid session: the
 * patient owes their share."*
 *
 * Both screens that then ask the patient for money read `sessions.price_cents`.
 *
 * So the employer's ten dollars were spent, and the employee was asked for
 * twenty. On a rail with no processor that is money taken twice with nothing to
 * reverse it, on the one commercial offer the Egyptian go-to-market rests on.
 * The row built to answer this question was being ignored by the only two
 * callers that needed the answer.
 *
 * ## 🔴 THE FROZEN SHARE, NEVER A PERCENTAGE RECOMPUTED NOW
 *
 * `coverageNow` is read once, at booking, because *"an employer lowering their
 * percentage on a Tuesday must not change what a patient owes for a session
 * they agreed to on Monday."* Recomputing here would undo that on the screen
 * where it matters most. This reads the stored share and nothing else.
 *
 * ## And it names no employer
 *
 * C227 and C243: a covered session is named without naming who covered it, the
 * rule `pbilling.covered` already follows. The patient knows who their employer
 * is; the product does not need to put them on a money surface to prove it.
 */
export type SessionOwed = {
  /** What the patient owes before tax. The whole price when nothing covered it. */
  grossCents: number;
  /** What a benefit already paid. Zero when there is no benefit. */
  coveredCents: number;
  /** The full price, for the line that says what the session cost. */
  priceCents: number;
  /** 🔴 0169: what the patient's wallet holds or paid for it, already out of `grossCents`. */
  walletCents: number;
};

export async function patientOwesFor(sessionId: string): Promise<SessionOwed> {
  const before = await owedBeforeWallet(sessionId);
  const { walletCentsOn } = await import("./wallet");
  const walletCents = Math.min(before.grossCents, await walletCentsOn(sessionId));
  return { ...before, grossCents: before.grossCents - walletCents, walletCents };
}

async function owedBeforeWallet(sessionId: string): Promise<Omit<SessionOwed, "walletCents">> {
  const [row] = await db
    .select({ priceCents: sessions.priceCents })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const priceCents = Math.max(0, row?.priceCents ?? 0);

  /* The session's one payment row: `session_payments` is unique on the session. */
  const [split] = await db
    .select({
      sponsorShareCents: sessionPayments.sponsorShareCents,
      patientShareCents: sessionPayments.patientShareCents,
      status: sessionPayments.status,
      fundingSource: sessionPayments.fundingSource,
    })
    .from(sessionPayments)
    .where(eq(sessionPayments.sessionId, sessionId))
    .limit(1);

  /*
   * 🔴 W2-M02: ONLY A POT ROW CARRIES A SPLIT. A card checkout writes its row
   * before the patient pays, with both shares left at their default of zero,
   * so reading its share said a patient who closed the Stripe page owed
   * nothing, and every screen asking them for money showed zero.
   */
  if (!split || split.fundingSource !== "pot" || split.patientShareCents === null) {
    return { grossCents: priceCents, coveredCents: 0, priceCents };
  }

  /*
   * 🔴 W2-S12: A REFUNDED SPLIT IS OWED BY NOBODY. The refund gave the pot its
   * share back and the employee theirs, or, when they had not paid it yet,
   * simply ended it. Reading the frozen share off a refunded row would go on
   * asking them for their half of a session that was refunded.
   */
  if (split.fundingSource === "pot" && split.status === "refunded") {
    return { grossCents: 0, coveredCents: 0, priceCents };
  }

  /*
   * Clamped, because a share is money and a negative one is a refund rather
   * than a charge. `Math.min` guards the other direction: a stored share above
   * the price would ask a patient for more than the session costs.
   */
  const owed = Math.min(priceCents, Math.max(0, split.patientShareCents));

  return {
    grossCents: owed,
    coveredCents: Math.max(0, split.sponsorShareCents ?? priceCents - owed),
    priceCents,
  };
}

/**
 * 🔴 76.27 — THE THREE LINES A PARTLY COVERED PATIENT NEEDS TO SEE.
 *
 *   Session with Dr Mona          1,000 EGP
 *   Your benefit paid              -500 EGP
 *   VAT                              70 EGP
 *
 * They add up to what is being asked for, which is the point: a patient looking
 * at 570 EGP for a session priced at 1,000 has a question, and an unanswered
 * question about money is a payment that does not happen.
 *
 * 🔴 EMPTY WHEN NOTHING COVERED IT. One line saying "session" above a total
 * that already says "session" is noise on the screen where somebody is copying
 * an account number, which is the rule every other caller of `lines` follows.
 */
export function sessionLines(input: {
  owed: SessionOwed;
  vatCents: number;
  /** "Session with Dr Mona Demo", from the caller's own translated copy. */
  sessionLabel: string;
  /** "Your benefit paid", translated. Never the employer's name (C227). */
  benefitLabel: string;
  /** "VAT", translated. */
  vatLabel: string;
  /** "From your wallet", translated. */
  walletLabel?: string;
}): PaymentLine[] {
  if (input.owed.coveredCents <= 0 && input.owed.walletCents <= 0) return [];

  return [
    { label: input.sessionLabel, cents: input.owed.priceCents },
    /* Negative, so the lines sum to the figure above them. */
    ...(input.owed.coveredCents > 0 ? [{ label: input.benefitLabel, cents: -input.owed.coveredCents }] : []),
    ...(input.owed.walletCents > 0 ? [{ label: input.walletLabel ?? input.benefitLabel, cents: -input.owed.walletCents }] : []),
    ...(input.vatCents > 0 ? [{ label: input.vatLabel, cents: input.vatCents }] : []),
  ];
}
