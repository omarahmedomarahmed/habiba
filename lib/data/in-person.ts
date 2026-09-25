import "server-only";

import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { qualified } from "@/lib/db/qualified";
import { sessionPayments, sessions } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * 🔴 PAY BEFORE START, THE TWO ENDS THAT NEED A CLOCK (docs/IN-PERSON-PAID.md).
 *
 * 1. An in-person session the patient was to pay through us, whose pay link
 *    ran out with nothing paid and nothing on its way: it is cancelled. No debt,
 *    no reminders, because nothing started.
 * 2. One that was paid and never started before the link ran out: the money
 *    goes back, when `rules.inPerson.refundIfNotStarted` says so. Nothing proves
 *    an in-person session happened except its start, so a paid one that never
 *    started is money for nothing.
 *
 * Both run hourly. Neither ever touches a session that started: the status is
 * in every WHERE, and a started session is `in_progress` or `completed`.
 */
export async function sweepInPerson(now = new Date()): Promise<{ expired: number; refunded: number }> {
  /* 1 · unpaid, expired, nothing in flight: cancelled, and the link with it. */
  const expired = await controlDb
    .update(sessions)
    .set({ status: "cancelled", joinToken: null, joinTokenExpiresAt: null, updatedAt: now })
    .where(
      and(
        eq(sessions.modality, "in_person"),
        eq(sessions.status, "scheduled"),
        eq(sessions.paymentStatus, "pending"),
        isNull(sessions.patientJoinedAt),
        gt(sessions.priceCents, 0),
        lt(sessions.joinTokenExpiresAt, now),
        sql`NOT EXISTS (SELECT 1 FROM session_payments sp WHERE sp.session_id = ${qualified(sessions.id)})`,
        sql`NOT EXISTS (SELECT 1 FROM gateway_payments g WHERE g.ref_id = ${qualified(sessions.id)}
                         AND (g.state = 'paid' OR g.created_at > now() - interval '1 hour'))`,
      ),
    )
    .returning({ id: sessions.id });

  /* 2 · paid, never started, link run out: the money goes back. */
  const { getSettings } = await import("@/lib/settings");
  const rules = (await getSettings()).rules.inPerson;
  let refunded = 0;
  if (rules.refundIfNotStarted) {
    const stale = await controlDb
      .select({ sessionId: sessions.id, paymentId: sessionPayments.id })
      .from(sessions)
      .innerJoin(sessionPayments, eq(sessionPayments.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.modality, "in_person"),
          eq(sessions.status, "scheduled"),
          eq(sessions.paymentStatus, "paid"),
          isNull(sessions.startedAt),
          lt(sessions.joinTokenExpiresAt, now),
          sql`${sessionPayments.status} <> 'refunded'`,
        ),
      )
      .limit(100);

    const { refundSessionPayment, refundSessionToWallet } = await import("@/lib/billing/connect");
    for (const row of stale) {
      const reason = "Paid in person and never started before the link ran out";
      /*
       * 🔴 K16d (ME47): `rules.inPerson.refundTo` decides where it goes, and it
       * was never read. `wallet` credits what the patient paid to their wallet
       * where the money is ours to hold; anything else, and a payment that
       * cannot go that way, takes the ordinary refund.
       */
      if (rules.refundTo === "wallet") {
        const toWallet = await refundSessionToWallet({ paymentId: row.paymentId, reason });
        if (toWallet.ok) {
          await controlDb
            .update(sessions)
            .set({ status: "cancelled", joinToken: null, joinTokenExpiresAt: null, updatedAt: now })
            .where(and(eq(sessions.id, row.sessionId), eq(sessions.status, "scheduled"), isNull(sessions.patientJoinedAt), isNull(sessions.startedAt)));
          refunded += 1;
          continue;
        }
      }
      /*
       * `refundSessionPayment` returns the company's share to its pot and the
       * patient's to them (card back through the gateway, or the refund queue),
       * and marks the session refunded, which ends it.
       */
      const back = await refundSessionPayment({
        paymentId: row.paymentId,
        reason,
        adminUserId: null,
        why: "not_started",
      });
      if (back.error) {
        log.error("in-person refund not issued", { session: ref(row.sessionId), reason: back.error });
        continue;
      }
      await controlDb
        .update(sessions)
        .set({ status: "cancelled", joinToken: null, joinTokenExpiresAt: null, updatedAt: now })
        .where(and(eq(sessions.id, row.sessionId), eq(sessions.status, "scheduled"), isNull(sessions.patientJoinedAt), isNull(sessions.startedAt)));
      refunded += 1;
    }
  }

  if (expired.length + refunded > 0) log.info("in-person sweep", { expired: expired.length, refunded });
  return { expired: expired.length, refunded };
}
