import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { dbFor } from "@/lib/db";
import { regionOfOrganization, regionOfPatient } from "@/lib/db/directory";
import { sessionVoices, transcriptSegments, type SessionVoice } from "@/lib/db/schema";
import { speakerFor, type BoundBy, type Voice, type VoiceRole } from "@/lib/diarisation/voices";

/**
 * The voices of a session, written down. PLAN.md 37.2, 37.3.
 *
 * 🔴 Routed on the patient, then the organisation (C154), like every clinical
 * read since the seam.
 *
 * ## What this module will not do
 *
 * It will not name a voice. `recordVoices` writes the roster a recording
 * produced and the roles the *evidence* proved, and `bindVoice` takes a named
 * human's decision with their user id on it. There is no third path, because
 * the column has no third value: `bound_by` is `track` or `operator`, and
 * migration 0065's trigger refuses a transcript line that claims a person for
 * a voice nothing has bound.
 */

async function regionFor(patientId: string | null, organizationId: string) {
  return patientId ? regionOfPatient(patientId) : regionOfOrganization(organizationId);
}

export type VoiceRow = Voice & { speakingMs?: number; patientId?: string | null };

/**
 * Record a recording's voices. One row per distinct voice, numbered as heard.
 *
 * Idempotent on `(session_id, label)` by unique index rather than by asking
 * first: re-running diarisation over the same audio must not double the room.
 */
export async function recordVoices(
  session: { id: string; organizationId: string; patientId: string | null },
  voices: readonly VoiceRow[],
): Promise<SessionVoice[]> {
  if (voices.length === 0) return [];
  const db = dbFor(await regionFor(session.patientId, session.organizationId));

  const now = new Date();
  const rows = await db
    .insert(sessionVoices)
    .values(
      voices.map((voice) => ({
        sessionId: session.id,
        organizationId: session.organizationId,
        label: voice.label,
        ordinal: voice.ordinal,
        role: voice.role ?? null,
        patientId: voice.role === "patient" ? (voice.patientId ?? null) : null,
        boundBy: voice.role ? (voice.boundBy ?? "track") : null,
        boundAt: voice.role ? now : null,
        speakingMs: voice.speakingMs ?? 0,
      })),
    )
    .onConflictDoNothing()
    .returning();

  return rows;
}

export async function voicesFor(
  sessionId: string,
  organizationId: string,
  patientId: string | null = null,
): Promise<SessionVoice[]> {
  const db = dbFor(await regionFor(patientId, organizationId));

  return db
    .select()
    .from(sessionVoices)
    .where(
      and(eq(sessionVoices.sessionId, sessionId), eq(sessionVoices.organizationId, organizationId)),
    )
    .orderBy(asc(sessionVoices.ordinal));
}

/**
 * Attach transcript lines to the voices that spoke them.
 *
 * 🔴 The speaker written beside the voice is `speakerFor(voice)`, which is the
 * voice's role or `unknown`. It is computed here **and** enforced by the
 * database, on purpose: this is the line a developer reads, and the trigger is
 * the one that survives the next path into the table.
 */
export async function attachLines(
  session: { id: string; organizationId: string; patientId: string | null },
  voice: Voice & { id: string },
  segmentIds: readonly string[],
): Promise<number> {
  if (segmentIds.length === 0) return 0;
  const db = dbFor(await regionFor(session.patientId, session.organizationId));

  let updated = 0;
  /* Chunked: `inArray` is one bind parameter per id and Postgres caps a
     statement at 65535 of them (H7). */
  for (let i = 0; i < segmentIds.length; i += 500) {
    const slice = segmentIds.slice(i, i + 500);
    await db
      .update(transcriptSegments)
      .set({
        voiceId: voice.id,
        speaker: speakerFor(voice),
        /* Acoustic separation is a measurement of the audio; the identity came
           from a track or a person. Neither is the semantic layer's guess. */
        speakerInferred: false,
      })
      .where(
        and(
          eq(transcriptSegments.sessionId, session.id),
          inArray(transcriptSegments.id, slice),
        ),
      );
    updated += slice.length;
  }

  return updated;
}

/**
 * A named human says who a voice is.
 *
 * Audited, because this is the one place a person's words are attached to a
 * person's name by a decision rather than by a measurement, and a year later
 * somebody may need to ask who decided.
 */
export async function bindVoice(
  actor: { userId: string; organizationId: string },
  input: {
    voiceId: string;
    sessionId: string;
    role: VoiceRole;
    patientId?: string | null;
    patientRegionId?: string | null;
  },
): Promise<void> {
  const db = dbFor(await regionFor(input.patientRegionId ?? null, actor.organizationId));

  const boundBy: BoundBy = "operator";
  await db
    .update(sessionVoices)
    .set({
      role: input.role,
      patientId: input.role === "patient" ? (input.patientId ?? null) : null,
      boundBy,
      boundByUserId: actor.userId,
      boundAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sessionVoices.id, input.voiceId),
        eq(sessionVoices.organizationId, actor.organizationId),
      ),
    );

  await audit({
    actor,
    category: "clinical",
    action: "session.voice.bind",
    resourceType: "session",
    resourceId: input.sessionId,
  });
}

/**
 * Take a name back off a voice.
 *
 * The database's `session_voices_unbind_clears_lines` trigger puts every line
 * that claimed that person back to `unknown` in the same statement, so the
 * transcript stops asserting the thing somebody just said was wrong. Unbinding
 * is also the only route from one person to another: the no-repoint trigger
 * refuses a direct swap, so a correction is two deliberate steps.
 */
export async function unbindVoice(
  actor: { userId: string; organizationId: string },
  input: { voiceId: string; sessionId: string; patientRegionId?: string | null },
): Promise<void> {
  const db = dbFor(await regionFor(input.patientRegionId ?? null, actor.organizationId));

  await db
    .update(sessionVoices)
    .set({
      role: null,
      patientId: null,
      boundBy: null,
      boundByUserId: null,
      boundAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sessionVoices.id, input.voiceId),
        eq(sessionVoices.organizationId, actor.organizationId),
      ),
    );

  await audit({
    actor,
    category: "clinical",
    action: "session.voice.unbind",
    resourceType: "session",
    resourceId: input.sessionId,
  });
}
