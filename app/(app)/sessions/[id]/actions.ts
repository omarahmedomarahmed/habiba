"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
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
