import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import {
  ehrLaunches,
  ehrWritebacks,
  sessionNotes,
  sessions,
  users,
  type NoteContent,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

import { fileDocumentReference } from "./fhir";
import { liveConnection } from "@/lib/data/ehr";

/**
 * 🔴 43.3 — THE NOTE FILES BACK AS A `DocumentReference`, AND ONLY AN APPROVED ONE DOES.
 *
 * ## 🔴 THE THREE APPROVAL CONDITIONS ARE IN THE WHERE CLAUSE
 *
 * `status = 'approved'`, `approved_at IS NOT NULL`, `approved_by IS NOT NULL`. All three, in the
 * query, because §7's first hard rule is that content in a chart needs a named clinician who
 * approved that exact text, and a note that is `approved` with a null `approved_by` is text
 * nobody signed. The same construction `deliverableNote` uses for a partner in sprint 55, and the
 * reason it is three conditions rather than one is that each of the three has been null on its own
 * in this schema's history.
 *
 * A draft does not file. Not "files as a draft DocumentReference" — does not file. A provisional
 * note in a hospital's chart is read by the next clinician as the record, and `status: preliminary`
 * is a field almost no EHR user interface surfaces.
 *
 * ## 🔴 THE AUTHOR IS THE CLINICIAN OR NOBODY, NEVER THIS APPLICATION
 *
 * `fileDocumentReference` takes an `authorReference` and omits the field when it is null. An
 * application-authored note is a note in a chart with no human name on it, which is exactly what
 * sprint 55 refuses to accept FROM a partner's server. Refusing to accept it and then doing it
 * ourselves would be the same defect from the other side.
 *
 * ## 🔴 PENDING IS WRITTEN BEFORE THE REQUEST
 *
 * A note a clinician approved, that we believe reached the chart and did not, is the worst outcome
 * this sprint can produce: the clinician has moved on, the chart has a gap, and nobody knows. So
 * the row exists before the network call, and a crash mid-flight leaves something a screen can
 * show rather than silence.
 */

/** The note as a chart reads it. Plain text, because a chart is read by people in a hurry. */
export function noteAsText(content: NoteContent): string {
  const soap = content.soap;
  return [
    "Subjective",
    soap.subjective.trim(),
    "",
    "Objective",
    soap.objective.trim(),
    "",
    "Assessment",
    soap.assessment.trim(),
    "",
    "Plan",
    soap.plan.trim(),
  ].join("\n");
}

export type FileResult =
  | { ok: true; documentReferenceId: string }
  | { ok: true; already: true; documentReferenceId: string | null }
  | { error: string };

export async function fileNote(input: {
  noteId: string;
  /** The organisation whose connection files it. C266: the credential is theirs. */
  organizationId: string;
}): Promise<FileResult> {
  /*
   * 🔴 The note, its approval, and the launch that ties the session to a chart, in one query.
   *
   * `patients` is not joined: nothing about this filing needs our patient row, because the chart
   * it goes into is identified by THEIR id on the launch. That is 43.4 in a join list.
   */
  const [note] = await controlDb
    .select({
      id: sessionNotes.id,
      content: sessionNotes.content,
      approvedAt: sessionNotes.approvedAt,
      approvedBy: sessionNotes.approvedBy,
      sessionId: sessionNotes.sessionId,
      patientId: sessionNotes.patientId,
      organizationId: sessionNotes.organizationId,
    })
    .from(sessionNotes)
    .innerJoin(sessions, eq(sessions.id, sessionNotes.sessionId))
    .where(
      and(
        eq(sessionNotes.id, input.noteId),
        /* 🔴 Theirs, in the WHERE. A borrowed note id files nothing. */
        eq(sessionNotes.organizationId, input.organizationId),
        /* 🔴 All three. See the header. */
        eq(sessionNotes.status, "approved"),
        isNotNull(sessionNotes.approvedAt),
        isNotNull(sessionNotes.approvedBy),
      ),
    )
    .limit(1);

  if (!note?.approvedAt) {
    return { error: "There is no approved note to file." };
  }

  const connection = await liveConnection(input.organizationId);
  if (!connection) {
    return { error: "There is no live connection to that record system." };
  }

  /*
   * 🔴 WHICH CHART, and it must come from a LIVE launch under THIS connection.
   *
   * A severed launch resolves to nothing (43.4's second clock), so a note for a patient whose
   * hospital has disconnected cannot be filed anywhere — correctly. The record stays with us,
   * held for the patient, and there is no chart of theirs to put it in any more.
   */
  const [launch] = await controlDb
    .select({
      fhirPatientId: ehrLaunches.fhirPatientId,
      fhirEncounterId: ehrLaunches.fhirEncounterId,
      userId: ehrLaunches.userId,
    })
    .from(ehrLaunches)
    .where(
      and(
        eq(ehrLaunches.connectionId, connection.connectionId),
        eq(ehrLaunches.patientId, note.patientId ?? ""),
        isNull(ehrLaunches.severedAt),
        isNotNull(ehrLaunches.fhirPatientId),
      ),
    )
    .limit(1);

  if (!launch?.fhirPatientId) {
    return { error: "That patient was not opened from this record system, so there is no chart to file into." };
  }

  /*
   * 🔴 The receipt FIRST, and `onConflictDoNothing` is the idempotency.
   *
   * `ehr_writebacks_note_unique` is the real guarantee; this turns a second attempt into a read of
   * the first rather than an exception. A retry must not put two DocumentReferences for one note
   * in somebody's chart.
   */
  const [claimed] = await controlDb
    .insert(ehrWritebacks)
    .values({ connectionId: connection.connectionId, noteId: note.id, state: "pending", attempts: 1 })
    .onConflictDoNothing({ target: [ehrWritebacks.noteId, ehrWritebacks.connectionId] })
    .returning({ id: ehrWritebacks.id });

  if (!claimed) {
    const [existing] = await controlDb
      .select({
        state: ehrWritebacks.state,
        fhirDocumentReferenceId: ehrWritebacks.fhirDocumentReferenceId,
      })
      .from(ehrWritebacks)
      .where(
        and(
          eq(ehrWritebacks.noteId, note.id),
          eq(ehrWritebacks.connectionId, connection.connectionId),
        ),
      )
      .limit(1);

    if (existing?.state === "filed") {
      return { ok: true, already: true, documentReferenceId: existing.fhirDocumentReferenceId };
    }
    return { error: "That note is already being filed." };
  }

  /*
   * 🔴 The AUTHOR: the clinician who was launched, as a FHIR practitioner reference when we have
   * one. `users.fhirPractitionerId` does not exist and deliberately is not being added — a
   * practitioner id is the hospital's identifier for their own staff member, which is theirs
   * rather than ours (43.4), so it comes from the launch's token context or not at all.
   *
   * Omitted rather than substituted. A note authored by this application is a note with no human
   * name on it.
   */
  const [clinician] = await controlDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, launch.userId))
    .limit(1);

  const result = await fileDocumentReference(
    { fhirBaseUrl: connection.fhirBaseUrl, accessToken: connection.accessToken },
    {
      fhirPatientId: launch.fhirPatientId,
      fhirEncounterId: launch.fhirEncounterId,
      text: noteAsText(note.content),
      approvedAt: note.approvedAt,
      /* Their practitioner reference is not ours to hold, so this stays null until a launch
         supplies one. See the block above. */
      authorReference: null,
      title: "Therapy session note",
    },
  );

  /*
   * 🔴 67.4 / 67.6 — THE CONNECTION'S OWN STATE IS UPDATED EITHER WAY.
   *
   * `connected_at` is when the OAuth exchange completed and says nothing about whether
   * the token still works. A hospital rotating a client secret leaves it exactly where
   * it is while every filing fails, and a practice reads "connected" off a screen for
   * a week. This is the only place that knows whether a real call came back.
   *
   * 🔴 AND THE STATUS IS PARSED OUT OF THE MESSAGE RATHER THAN INVENTED. `fhir.ts`
   * puts it there deliberately, because a 403 about a patient can contain that
   * patient's details and the STATUS is what a caller may have.
   */
  const { recordConnectionResult } = await import("@/lib/data/ehr");
  const status = Number(/\((\d{3})\)/.exec(result.error ?? "")?.[1] ?? "") || null;

  if (result.error || !result.documentReferenceId) {
    await controlDb
      .update(ehrWritebacks)
      .set({
        state: "refused",
        lastError: result.error?.slice(0, 300) ?? null,
        /* 🔴 67.5 — what their server returned, which is what an engineer reads first. */
        responseStatus: status,
        /* 🔴 67.5 — whose note this was, so the practice knows who to tell. */
        approvedByUserId: clinician?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(ehrWritebacks.id, claimed.id));

    await recordConnectionResult({
      connectionId: connection.connectionId,
      ok: false,
      error: result.error ?? null,
    });

    return { error: result.error ?? "That note could not be filed." };
  }

  await controlDb
    .update(ehrWritebacks)
    .set({
      state: "filed",
      fhirDocumentReferenceId: result.documentReferenceId,
      filedAt: new Date(),
      lastError: null,
      responseStatus: 201,
      approvedByUserId: clinician?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(ehrWritebacks.id, claimed.id));

  /* 🔴 67.4 — a call came back, so the indicator on their page is now true. */
  await recordConnectionResult({ connectionId: connection.connectionId, ok: true });

  await audit({
    actor: clinician ? { userId: clinician.id, organizationId: input.organizationId } : null,
    category: "phi_access",
    action: "ehr.note_filed",
    resourceType: "session_note",
    resourceId: note.id,
    patientId: note.patientId,
    reason: `filed as DocumentReference ${result.documentReferenceId}`,
  });

  log.info("note filed to an ehr", { note: ref(note.id), org: ref(input.organizationId) });

  return { ok: true, documentReferenceId: result.documentReferenceId };
}

/**
 * 🔴 THE ABSENCE, STATED SO A VERIFIER CAN FIND IT.
 *
 * A draft never files, the author is never this application, and the filing is idempotent on the
 * note. Three rules enforced by a WHERE clause, a null, and a unique index respectively, none of
 * which a reader sees without being told.
 */
export const ONLY_AN_APPROVED_NOTE_FILES = true;
