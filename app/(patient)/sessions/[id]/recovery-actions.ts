"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patients, sessions, users } from "@/lib/db/schema";
import {
  recordNoShow,
  refundNoShow,
  reassignSession,
  recoveryDue,
  replacementsFor,
  type Replacement,
} from "@/lib/data/recovery";
import { notify } from "@/lib/notify";
import { env } from "@/lib/env";
import { callerKey, consume } from "@/lib/rate-limit";
import { getPatientActor } from "@/lib/patient-auth/session";

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
 * ## 🔴 W1-07 — proof of being the patient, not an id
 *
 * Somebody who booked from a public profile has no account, and the moment
 * their therapist fails to appear is the worst possible moment to ask them to
 * make one. So the proof is the capability they already hold: their own join
 * link. A signed-in patient may instead name the session, and it must belong
 * to their person.
 *
 * These took a bare session id, and an id is not a secret: it is in the
 * clinician's URLs, emails and exports. Anybody holding one could refund or
 * reassign an overdue session. The id alone now proves nothing.
 */
export type RecoveryProof = { token: string } | { sessionId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The session the caller has proved is theirs, or null. Anything else sent is refused. */
async function provenSessionId(proof: unknown): Promise<string | null> {
  if (!proof || typeof proof !== "object") return null;

  const token = (proof as { token?: unknown }).token;
  if (typeof token === "string" && token.length > 0) {
    const [row] = await db
      .select({ id: sessions.id, expiresAt: sessions.joinTokenExpiresAt })
      .from(sessions)
      .where(eq(sessions.joinToken, token))
      .limit(1);
    if (!row || (row.expiresAt && row.expiresAt < new Date())) return null;
    return row.id;
  }

  const sessionId = (proof as { sessionId?: unknown }).sessionId;
  if (typeof sessionId === "string" && UUID.test(sessionId)) {
    const actor = await getPatientActor();
    if (!actor) return null;
    const [row] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(patients, eq(patients.id, sessions.patientId))
      .where(and(eq(sessions.id, sessionId), eq(patients.personId, actor.personId)))
      .limit(1);
    return row?.id ?? null;
  }

  return null;
}

/** The refusal, in the reader's language. */
async function notYours(): Promise<{ error: string }> {
  const { getI18n } = await import("@/lib/i18n/server");
  return { error: (await getI18n()).t("tshow.notYours") };
}

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
export async function offerReplacements(proof: RecoveryProof): Promise<RecoveryView> {
  const throttle = await consume(await callerKey("recovery"), 20, 60 * 60);
  if (!throttle.allowed) return { state: "waiting" };

  const sessionId = await provenSessionId(proof);
  if (!sessionId) return { state: "none" };

  const [row] = await db
    .select({
      id: sessions.id,
      therapistId: sessions.therapistId,
      priceCents: sessions.priceCents,
      startedAt: sessions.startedAt,
      scheduledAt: sessions.scheduledAt,
      patientJoinedAt: sessions.patientJoinedAt,
      status: sessions.status,
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

  /*
   * 🔴 Not due, nothing recorded. `recordNoShow` below lands on the clinician's
   * public reliability score, so an id alone must not be able to write it
   * before the session was even meant to begin.
   */
  if (!recoveryDue(row)) return { state: "waiting" };

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
  proof: RecoveryProof,
  userId: string,
): Promise<RecoveryView | { error: string }> {
  const sessionId = await provenSessionId(proof);
  if (!sessionId || typeof userId !== "string" || !UUID.test(userId)) return notYours();

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
export async function takeRefund(proof: RecoveryProof): Promise<RecoveryView | { error: string }> {
  const sessionId = await provenSessionId(proof);
  if (!sessionId) return notYours();

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
