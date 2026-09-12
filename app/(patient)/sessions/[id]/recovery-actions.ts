"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patients, sessions, users } from "@/lib/db/schema";
import {
  recordNoShow,
  refundNoShow,
  reassignSession,
  replacementsFor,
  type Replacement,
} from "@/lib/data/recovery";
import { notify } from "@/lib/notify";
import { env } from "@/lib/env";
import { callerKey, consume } from "@/lib/rate-limit";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(patient)/sessions/[id]/recovery-actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * The patient's side of a no-show. PLAN.md 14.2–14.6.
 *
 * ## Unauthenticated, on purpose
 *
 * Somebody who booked from a public profile has no account, and the moment
 * their therapist fails to appear is the worst possible moment to ask them to
 * make one. The session id is the capability, exactly as it is for the join
 * link — and the actions below can only ever act on the session that id names.
 */

export type RecoveryView =
  | { state: "waiting" }
  | { state: "offer"; replacements: Replacement[] }
  | { state: "none" }
  | { state: "done"; outcome: "reassigned" | "refunded"; creditCents?: number };

/**
 * Who could step in, and the no-show recorded at the same moment. 14.2.
 *
 * The recording happens here rather than when the patient presses something,
 * because the commonest outcome is that they close the tab — and a let-down
 * that leaves no trace is one nobody can be held to.
 */
export async function offerReplacements(sessionId: string): Promise<RecoveryView> {
  const throttle = await consume(await callerKey("recovery"), 20, 60 * 60);
  if (!throttle.allowed) return { state: "waiting" };

  const [row] = await db
    .select({
      id: sessions.id,
      therapistId: sessions.therapistId,
      priceCents: sessions.priceCents,
      startedAt: sessions.startedAt,
      outcome: sessions.recoveryOutcome,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return { state: "none" };

  // The therapist turned up after all. Nothing to recover from.
  if (row.startedAt) return { state: "waiting" };
  if (row.outcome) {
    return { state: "done", outcome: row.outcome === "reassigned" ? "reassigned" : "refunded" };
  }

  await recordNoShow(sessionId);

  await db
    .update(sessions)
    .set({ recoveryOfferedAt: new Date() })
    .where(eq(sessions.id, sessionId));

  const replacements = await replacementsFor({
    sessionId,
    paidCents: row.priceCents,
    excludeUserId: row.therapistId,
  });

  return replacements.length > 0 ? { state: "offer", replacements } : { state: "none" };
}

/** They picked somebody. 14.5. */
export async function takeReplacement(
  sessionId: string,
  userId: string,
): Promise<RecoveryView | { error: string }> {
  const result = await reassignSession({ sessionId, toUserId: userId });
  if (!result.ok) return { error: result.error };

  /*
   * The replacement is told, because they are about to have somebody in their
   * room. 🔴 A name and a link, no clinical content — this goes to WhatsApp
   * and an inbox.
   */
  /*
   * A clinician has no phone column — §3b's number requirement is the
   * *patient* identity, and a therapist signs in with an address. So this
   * reaches them by email, which is the channel they actually have.
   */
  const [taker] = await db
    .select({ email: users.email, timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (taker) {
    await notify(
      { email: taker.email, phone: null, timezone: taker.timezone },
      {
        kind: "booking.confirmed",
        subject: "Somebody needs a session now",
        body: "A patient was left waiting when their therapist did not join, and they have chosen you. They are in the room now.",
        link: { label: "Join the session", url: `${env.appUrl}/sessions/${sessionId}` },
        variables: ["24Therapy", "now"],
      },
    );
  }

  revalidatePath(`/sessions/${sessionId}`);
  return {
    state: "done",
    outcome: "reassigned",
    creditCents: result.outcome === "reassigned" ? result.creditCents : 0,
  };
}

/** Nobody suitable, or they would rather not. 14.4. */
export async function takeRefund(sessionId: string): Promise<RecoveryView | { error: string }> {
  const result = await refundNoShow({ sessionId });
  if (!result.ok) return { error: result.error };

  const [row] = await db
    .select({
      email: patients.email,
      phone: patients.phone,
      timezone: patients.timezone,
      guestEmail: sessions.guestEmail,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  /*
   * 🔴 The apology is the product's, not the therapist's, and it does not
   * explain itself away. "Your therapist could not make it" is a sentence that
   * blames a person we cannot speak for; "we could not put you in front of
   * anybody" is what actually happened.
   */
  if (row) {
    await notify(
      {
        email: row.email ?? row.guestEmail ?? null,
        phone: row.phone ?? null,
        timezone: row.timezone,
      },
      {
        kind: "booking.cancelled",
        subject: "We are sorry. Your session did not happen",
        body: "Nobody joined your session and we could not find anybody else free. You have been refunded in full, including our fee.\n\nThis is our failure, not yours, and you do not need to do anything. Book again whenever you are ready.",
        link: { label: "Find somebody now", url: `${env.appUrl}/radar` },
        variables: ["24Therapy", "your session"],
      },
    );
  }

  revalidatePath(`/sessions/${sessionId}`);
  return { state: "done", outcome: "refunded" };
}
