"use server";

import { qualified } from "@/lib/db/qualified";
import { revalidatePath } from "next/cache";

import { requireUser, requireVerified } from "@/lib/auth/guard";
import { getSession } from "@/lib/data/sessions";
import { issueIngestToken, revokeIngestToken } from "@/lib/data/session-sources";
import { bindVoice, unbindVoice } from "@/lib/data/session-voices";
import type { VoiceRoleColumn } from "@/lib/db/schema";

export type SessionPanelState = { error?: string; ok?: boolean; token?: string };

/**
 * The session's source and its voices. PLAN.md 51.6, 37R.21, 37R.22, C179.
 *
 * Both tables had a migration, a service, a trigger and no screen. These are
 * the actions behind the two panels that close that, and every one of them
 * re-fetches the session through `getSession` first: the id in the URL is a
 * claim, and `getSession` is the function that decides whether this clinician
 * may act on it.
 */
async function gate(sessionId: string) {
  const actor = await requireUser();
  const row = await getSession(actor, sessionId);
  if (!row) return { error: "That session is not in your practice." } as const;
  return { actor, patientId: row.session.patientId ?? null } as const;
}

/**
 * 🔴 36.2 — mint the upload credential, and hand it back exactly once.
 *
 * The token is returned to this one render and stored only as a hash, so the
 * screen says so rather than offering a "show it again" nobody can honour.
 */
export async function issueUploadCredential(sessionId: string): Promise<SessionPanelState> {
  const g = await gate(sessionId);
  if ("error" in g) return { error: g.error };

  try {
    const minted = await issueIngestToken(g.actor, sessionId, g.patientId);
    revalidatePath(`/sessions/${sessionId}`);
    return { ok: true, token: minted.token };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "That credential could not be issued.",
    };
  }
}

export async function revokeUploadCredential(sessionId: string): Promise<SessionPanelState> {
  const g = await gate(sessionId);
  if ("error" in g) return { error: g.error };

  await revokeIngestToken(g.actor, sessionId, g.patientId);
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/**
 * A named human says who a voice is. 37.2.
 *
 * 🔴 There is no third option here and there must not be. `bindVoice` writes
 * `bound_by = 'operator'` because a person decided; the only other value the
 * column accepts is `track`, which the recording writes when it already knew.
 * Neither is a model's guess, and this action offers no way to record one.
 */
export async function nameVoice(
  sessionId: string,
  voiceId: string,
  role: VoiceRoleColumn,
): Promise<SessionPanelState> {
  const g = await gate(sessionId);
  if ("error" in g) return { error: g.error };

  await bindVoice(g.actor, {
    voiceId,
    sessionId,
    role,
    patientId: role === "patient" ? g.patientId : null,
    patientRegionId: g.patientId,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/**
 * Take a name back off.
 *
 * The `session_voices_unbind_clears_lines` trigger puts every line that
 * claimed that person back to unknown in the same statement, so a correction
 * does not leave a transcript still asserting the thing just corrected.
 * Unbinding is also the only route from one person to another: the no-repoint
 * trigger refuses a direct swap.
 */
export async function unnameVoice(
  sessionId: string,
  voiceId: string,
): Promise<SessionPanelState> {
  const g = await gate(sessionId);
  if ("error" in g) return { error: g.error };

  await unbindVoice(g.actor, { voiceId, sessionId, patientRegionId: g.patientId });

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/**
 * 🔴 76.38 — A CLINICIAN SAYS WHO SAID A LINE, BY HAND.
 *
 * ## The gap, reported from a real session
 *
 * Two people on one microphone. Every line came back "Speaker", and there was
 * no control anywhere to correct a single one of them. `diariseSession` now
 * runs at the end of a session, which fixes the common case; this is the other
 * half, because a model reading Arabic with English words in it will get some
 * of them wrong and a clinician sitting with the transcript knows which.
 *
 * ## 🔴 PER LINE, AND ONLY WHERE THERE IS NO VOICE TO ASK
 *
 * When a recording separated voices, WHO a voice is belongs to the voice, not
 * to each line: `VoicesPanel` binds it once and migration 0065's trigger keeps
 * every line in step. Attributing one line of a bound voice to somebody else
 * would be asserting that a measured voice said something a different person
 * said, and the database refuses it outright.
 *
 * So this is for the case the trigger has no opinion about, which is exactly
 * the one the clinician hit: one microphone, no separation, `voice_id` null.
 * A segment that carries a voice is refused here, with a sentence naming the
 * control that does own it rather than a database error.
 *
 * ## 🔴 AND IT IS NOT AN INFERENCE
 *
 * `speaker_inferred` goes FALSE. That column is what the transcript panel
 * underlines with a dotted line to say "worked out from the words", and a
 * clinician's own correction is the opposite of that: it is the one attribution
 * in this product with a person behind it. Writing it as inferred would make
 * the panel hedge about the only line it has no reason to hedge about.
 */
export async function attributeLine(
  sessionId: string,
  segmentId: string,
  speaker: "therapist" | "patient" | "unknown",
): Promise<SessionPanelState> {
  const g = await gate(sessionId);
  if ("error" in g) return { error: g.error };

  if (speaker !== "therapist" && speaker !== "patient" && speaker !== "unknown") {
    return { error: "That is not somebody who could have said it." };
  }

  const { controlDb } = await import("@/lib/db");
  const { transcriptSegments } = await import("@/lib/db/schema");
  const { and, eq, isNull } = await import("drizzle-orm");

  /*
   * 🔴 THE SCOPE IS IN THE WHERE CLAUSE, all four conditions.
   *
   * The segment id arrives from a browser. Pinning the session AND the
   * organisation means a foreign id updates nothing, silently, rather than
   * being checked first and then updated in a second statement with a window
   * between them.
   *
   * `isNull(voiceId)` is the fourth: it is what makes "refused because a voice
   * owns this line" a row that did not match rather than a trigger exception.
   */
  const [updated] = await controlDb
    .update(transcriptSegments)
    .set({ speaker, speakerInferred: false })
    .where(
      and(
        eq(transcriptSegments.id, segmentId),
        eq(transcriptSegments.sessionId, sessionId),
        eq(transcriptSegments.organizationId, g.actor.organizationId),
        isNull(transcriptSegments.voiceId),
      ),
    )
    .returning({ id: transcriptSegments.id });

  if (!updated) {
    return {
      error:
        "That line belongs to a separated voice. Name the voice above and every line it said follows.",
    };
  }

  /*
   * 🔴 AUDITED, because this edits a clinical record. Somebody reading the
   * transcript in six months is entitled to know that a line saying "patient"
   * says so because a named clinician decided it, and when.
   */
  const { audit } = await import("@/lib/audit");
  await audit({
    actor: g.actor,
    category: "clinical",
    action: "transcript.attributed",
    resourceType: "session",
    resourceId: sessionId,
    reason: `a line was attributed to ${speaker} by hand`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/**
 * 🔴 PAY BEFORE START: the patient paid the therapist in the room after all.
 * Only while nothing has been paid or is on its way through us, and it kills
 * the pay link in the same statement, so no payment can land afterwards.
 */
export async function paidDirectly(sessionId: string): Promise<{ error?: string; ok?: boolean }> {
  const actor = await requireVerified();
  const { controlDb } = await import("@/lib/db");
  const { sessions } = await import("@/lib/db/schema");
  const { and, eq, sql } = await import("drizzle-orm");
  const moved = await controlDb
    .update(sessions)
    .set({ priceCents: 0, paymentStatus: "not_required", joinToken: null, joinTokenExpiresAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.therapistId, actor.userId),
        eq(sessions.modality, "in_person"),
        eq(sessions.status, "scheduled"),
        eq(sessions.paymentStatus, "pending"),
        sql`NOT EXISTS (SELECT 1 FROM session_payments sp WHERE sp.session_id = ${qualified(sessions.id)})`,
        sql`NOT EXISTS (SELECT 1 FROM gateway_payments g WHERE g.ref_id = ${qualified(sessions.id)}
                         AND (g.state = 'paid' OR g.created_at > now() - interval '1 hour'))`,
        sql`NOT EXISTS (SELECT 1 FROM manual_payments m WHERE m.purpose = 'session' AND m.ref_id = ${qualified(sessions.id)}
                         AND m.state IN ('submitted', 'confirmed'))`,
      ),
    )
    .returning({ id: sessions.id });
  if (moved.length === 0) {
    return { error: "A payment through us has already started or arrived. Wait for it instead." };
  }
  const { audit } = await import("@/lib/audit");
  await audit({ actor, category: "billing", action: "session.paid_directly", resourceType: "session", resourceId: sessionId });
  return { ok: true };
}

/** Send the pay link to the patient's email and phone, the same link the QR code holds. */
export async function sendPayLink(sessionId: string): Promise<{ error?: string; ok?: boolean }> {
  const actor = await requireVerified();
  const row = await getSession(actor, sessionId);
  if (!row?.session.joinToken || row.session.paymentStatus !== "pending") return { error: "There is nothing to pay on this session." };
  const email = row.patient?.email ?? row.session.guestEmail ?? null;
  const phone = row.patient?.phone ?? null;
  if (!email && !phone) return { error: "This patient has no email or phone yet." };
  const { notify } = await import("@/lib/notify");
  const { env } = await import("@/lib/env");
  /* 🔴 Ruling 8: in the patient's own language. */
  const { wordsFor } = await import("@/lib/i18n/message-words");
  const personId = row.patient?.personId ?? null;
  const { t, locale } = await wordsFor(personId ? { personId } : null);
  const therapist = [actor.firstName, actor.lastName].filter(Boolean).join(" ");
  const delivery = await notify(
    { personId, email, phone, timezone: row.patient?.timezone ?? null, locale },
    {
      notice: { kind: "session_invited", key: "pnotice.payLink", sessionId },
      kind: "session.invite",
      subject: t("pmsg.payLink.subject"),
      body: t("pmsg.payLink.body", { therapist }),
      link: { label: t("pmsg.payLink.link"), url: `${env.appUrl}/pay/${row.session.joinToken}` },
      /* The one variable `session_invite` takes. */
      variables: [therapist],
    },
  );
  return delivery.sent ? { ok: true } : { error: "It could not be sent. Show the QR code instead." };
}
