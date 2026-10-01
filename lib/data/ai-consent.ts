import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { crossBorderConsents, patients } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * What withdrawing the cross-border consent DOES. Due diligence F3.
 *
 * ## The defect
 *
 * `/patient/residency` let a person withdraw their agreement to their record
 * being held in the United States, and withdrawing changed nothing: the record
 * stayed where it was, and every session was still sent to OpenAI in the United
 * States to be transcribed, summarised and read by the copilot. A withdrawal
 * button that does nothing is worse than none, because it reads as control.
 *
 * ## What it does now, and nothing more
 *
 * We cannot move the record (there is no Egyptian database yet, and the page
 * says so). What we can stop, truthfully and at once, is sending this person's
 * sessions to an AI provider abroad. So a withdrawn consent switches off every
 * model call about them, from that moment on:
 *
 *   - no transcription (`app/api/sessions/[id]/transcribe`, the meeting bot)
 *   - no AI note, no diarisation, no model risk pass (`lib/ai/notes.ts`,
 *     `lib/data/session-risk.ts`; the keyword floor still runs, it is local)
 *   - no copilot in the room or afterwards, no profile rebuild, no diagnosis
 *     reading of their documents
 *
 * Nothing already written is deleted; the page says that too.
 *
 * ## The rule
 *
 * The person's NEWEST consent row decides. Withdrawn means paused; agreeing again
 * writes a new row, and AI processing resumes. Somebody who was never asked (no
 * rows) is not paused: this is the switch a person pulls, not a default.
 *
 * 🔴 It fails CLOSED. If the check cannot be made, the model is not called: a
 * missed transcription is a note the clinician writes by hand, and a sent one is
 * a transfer somebody said no to.
 */
export function aiPausedFrom(rows: readonly { agreedAt: Date; withdrawnAt: Date | null }[]): boolean {
  if (rows.length === 0) return false;
  const newest = rows.reduce((a, b) => (b.agreedAt.getTime() > a.agreedAt.getTime() ? b : a));
  return newest.withdrawnAt !== null;
}

export async function aiPausedForPerson(personId: string | null | undefined): Promise<boolean> {
  if (!personId) return false;
  try {
    const rows = await controlDb
      .select({ agreedAt: crossBorderConsents.agreedAt, withdrawnAt: crossBorderConsents.withdrawnAt })
      .from(crossBorderConsents)
      .where(eq(crossBorderConsents.personId, personId))
      .orderBy(desc(crossBorderConsents.agreedAt))
      .limit(5);
    return aiPausedFrom(rows);
  } catch (error) {
    log.error("ai consent check failed, treating as paused", {
      person: ref(personId),
      reason: safeErrorMessage(error),
    });
    return true;
  }
}

/**
 * DD-2 B1: which of these people have AI processing paused, in one query, for
 * a caller that sends several names at once (the clinician's assistant). Fails
 * closed: if the check cannot run, everybody is treated as paused.
 */
export async function pausedAmong(personIds: readonly (string | null)[]): Promise<Set<string>> {
  const ids = [...new Set(personIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Set();
  try {
    const rows = await controlDb
      .select({
        personId: crossBorderConsents.personId,
        agreedAt: crossBorderConsents.agreedAt,
        withdrawnAt: crossBorderConsents.withdrawnAt,
      })
      .from(crossBorderConsents)
      .where(inArray(crossBorderConsents.personId, ids));
    const byPerson = new Map<string, { agreedAt: Date; withdrawnAt: Date | null }[]>();
    for (const row of rows) byPerson.set(row.personId, [...(byPerson.get(row.personId) ?? []), row]);
    return new Set(ids.filter((id) => aiPausedFrom(byPerson.get(id) ?? [])));
  } catch (error) {
    log.error("ai consent check failed, treating everybody as paused", { reason: safeErrorMessage(error) });
    return new Set(ids);
  }
}

/** The same, from a chart. A session with no patient yet (a guest link) has nobody to ask. */
export async function aiPausedForPatient(patientId: string | null | undefined): Promise<boolean> {
  if (!patientId) return false;
  try {
    const [chart] = await controlDb
      .select({ personId: patients.personId })
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);
    return aiPausedForPerson(chart?.personId ?? null);
  } catch (error) {
    log.error("ai consent check failed, treating as paused", {
      patient: ref(patientId),
      reason: safeErrorMessage(error),
    });
    return true;
  }
}

/** Thrown where a model call would have been made for somebody who said no. */
export class AiPausedError extends Error {
  constructor() {
    super("AI processing is paused for this person");
    this.name = "AiPausedError";
  }
}
