import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { auditPhi } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { dbFor } from "@/lib/db";
import { regionOfOrganization, regionOfPatient } from "@/lib/db/directory";
import {
  noteAddenda,
  sessionNotes,
  type NoteAddendumKind,
  type NoteContent,
} from "@/lib/db/schema";
import { getSession } from "@/lib/data/sessions";
import { fullName } from "@/lib/utils";

/**
 * 🔴 W1-03 / P4: a signed note keeps its words.
 *
 * `saveNote` used to overwrite `session_notes.content` whatever its status, so
 * a signed chart could be rewritten and the text the clinician had attested to
 * was gone, with an audit row saying only that an edit happened. The same was
 * true of a patient copy already released to somebody's phone.
 *
 * Now each half locks when it is signed, and a change after that is an
 * addendum: author, time, text, appended for ever. The lock is held twice: by
 * the `WHERE` on each write here, which is what turns it into a sentence the
 * clinician can read, and by a trigger on `session_notes` (migration 0116),
 * which is what holds it against a write path nobody has written yet.
 *
 * ## Keyed to the note, not the session
 *
 * The three writes below (`writeClinical`, `writePatient`, `appendAddendum`)
 * take a NOTE id, because a session will soon carry one note per format, each
 * signed on its own. The session-level functions under them resolve today's
 * one note and are what the actions call. The three stay unexported until a
 * second format calls them, so `verify:reachable` counts no dead export.
 *
 * Routed on the patient, then the organisation (C154), like every clinical row.
 */

async function regionFor(patientId: string | null, organizationId: string) {
  return patientId ? regionOfPatient(patientId) : regionOfOrganization(organizationId);
}

type Db = ReturnType<typeof dbFor>;

/** Why a write did not land. The action turns each into a sentence. */
export type NoteRefusal = "not_found" | "no_note" | "locked" | "not_signed" | "empty";
export type NoteWriteResult = { ok: true } | { ok: false; reason: NoteRefusal };

const PATIENT_FIELDS = ["patientBrief", "patientSteps", "patientNext"] as const;

/** SQLSTATE the lock trigger raises with. */
const LOCKED = "0A000";

function isLockError(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === LOCKED || e?.cause?.code === LOCKED;
}

/* ------------------------------------------------ writes, by note id -- */

/**
 * Replace a note's clinical half. A draft only.
 *
 * The patient's three fields are carried over from the stored row, never taken
 * from what was sent: this editor is the chart's, and a released patient copy
 * must not change because a stale client posted the whole blob back.
 */
async function writeClinical(db: Db, noteId: string, content: NoteContent) {
  const sent = { ...content } as Record<string, unknown>;
  for (const key of PATIENT_FIELDS) delete sent[key];
  return guarded(() =>
    db
      .update(sessionNotes)
      .set({
        content: sql`${JSON.stringify(sent)}::jsonb
          || (SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
                FROM jsonb_each(${sessionNotes.content})
               WHERE key IN ('patientBrief', 'patientSteps', 'patientNext'))`,
        updatedAt: new Date(),
      })
      .where(and(eq(sessionNotes.id, noteId), eq(sessionNotes.status, "draft")))
      .returning({ id: sessionNotes.id }),
  );
}

/**
 * Replace a note's patient copy: three fields and no others, until released.
 * Merged in the database rather than read, spread and written back, so a
 * clinical edit landing between the two cannot be undone by this one.
 */
async function writePatient(
  db: Db,
  noteId: string,
  fields: { patientBrief: string; patientSteps: string[]; patientNext: string },
) {
  return guarded(() =>
    db
      .update(sessionNotes)
      .set({
        content: sql`${sessionNotes.content} || ${JSON.stringify(fields)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(and(eq(sessionNotes.id, noteId), eq(sessionNotes.patientStatus, "draft")))
      .returning({ id: sessionNotes.id }),
  );
}

async function guarded(write: () => Promise<{ id: string }[]>): Promise<NoteWriteResult> {
  try {
    const landed = await write();
    return landed.length > 0 ? { ok: true } : { ok: false, reason: "locked" };
  } catch (error) {
    if (isLockError(error)) return { ok: false, reason: "locked" };
    throw error;
  }
}

/**
 * Add to a signed note. `clinical` needs the chart signed, `patient` the copy
 * released: before that, the draft is still the place to change.
 */
async function appendAddendum(
  db: Db,
  input: {
    noteId: string;
    kind: NoteAddendumKind;
    authorUserId: string;
    authorName: string;
    body: string;
  },
): Promise<NoteWriteResult> {
  const text = input.body.trim();
  if (!text) return { ok: false, reason: "empty" };

  const [note] = await db
    .select({
      sessionId: sessionNotes.sessionId,
      organizationId: sessionNotes.organizationId,
      status: sessionNotes.status,
      patientStatus: sessionNotes.patientStatus,
    })
    .from(sessionNotes)
    .where(eq(sessionNotes.id, input.noteId))
    .limit(1);
  if (!note) return { ok: false, reason: "no_note" };
  const signed = input.kind === "clinical" ? note.status : note.patientStatus;
  if (signed !== "approved") return { ok: false, reason: "not_signed" };

  await db.insert(noteAddenda).values({
    noteId: input.noteId,
    sessionId: note.sessionId,
    organizationId: note.organizationId,
    kind: input.kind,
    authorUserId: input.authorUserId,
    authorName: input.authorName,
    body: text.slice(0, 4000),
  });
  return { ok: true };
}

/* ------------------------------------- what the actions call, by session -- */

/** The session, scoped to the actor, and its one note today. */
async function noteOf(actor: Actor, sessionId: string) {
  const row = await getSession(actor, sessionId);
  if (!row) return null;
  const db = dbFor(await regionFor(row.session.patientId, row.session.organizationId));
  const [note] = await db
    .select({ id: sessionNotes.id })
    .from(sessionNotes)
    .where(eq(sessionNotes.sessionId, sessionId))
    .limit(1);
  return { row, db, noteId: note?.id ?? null };
}

/** Edit the clinical note. A draft only: a signed note is refused. */
export async function saveClinicalNote(
  actor: Actor,
  sessionId: string,
  content: NoteContent,
): Promise<NoteWriteResult> {
  const found = await noteOf(actor, sessionId);
  if (!found) return { ok: false, reason: "not_found" };
  if (!found.noteId) return { ok: false, reason: "no_note" };

  const result = await writeClinical(found.db, found.noteId, content);
  if (!result.ok) return result;

  await auditPhi(actor, "note.update", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: found.row.session.patientId,
  });
  return result;
}

/** Edit what the patient will read, until it is released. */
export async function savePatientCopy(
  actor: Actor,
  sessionId: string,
  patch: { patientBrief: string; patientSteps: string[]; patientNext: string },
): Promise<NoteWriteResult> {
  const found = await noteOf(actor, sessionId);
  if (!found) return { ok: false, reason: "not_found" };
  if (!found.noteId) return { ok: false, reason: "no_note" };

  const result = await writePatient(found.db, found.noteId, {
    patientBrief: patch.patientBrief.trim(),
    patientSteps: patch.patientSteps.map((s) => s.trim()).filter(Boolean).slice(0, 4),
    patientNext: patch.patientNext.trim(),
  });
  if (!result.ok) return result;

  await auditPhi(actor, "note.patient.update", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: found.row.session.patientId,
  });
  return result;
}

/** Add an addendum to this session's note, as the actor. */
export async function addAddendum(
  actor: Actor,
  sessionId: string,
  kind: NoteAddendumKind,
  body: string,
): Promise<NoteWriteResult> {
  if (!body.trim()) return { ok: false, reason: "empty" };
  const found = await noteOf(actor, sessionId);
  if (!found) return { ok: false, reason: "not_found" };
  if (!found.noteId) return { ok: false, reason: "no_note" };

  const result = await appendAddendum(found.db, {
    noteId: found.noteId,
    kind,
    authorUserId: actor.userId,
    authorName: fullName(actor.firstName, actor.lastName, actor.email),
    body,
  });
  if (!result.ok) return result;

  await auditPhi(actor, kind === "clinical" ? "note.addendum" : "note.patient.addendum", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: found.row.session.patientId,
  });
  return result;
}

/* ------------------------------------------------------------ reading -- */

export type AddendumView = { id: string; authorName: string; body: string; createdAt: Date };

/**
 * Addenda of one kind for some notes, oldest first, keyed by note id. The
 * caller has already scoped each note to the reader: this takes ids it was
 * handed by a scoped read, never ones from a request.
 */
export async function addendaFor(
  noteIds: string[],
  kind: NoteAddendumKind,
  where: { patientId: string | null; organizationId: string },
): Promise<Map<string, AddendumView[]>> {
  const out = new Map<string, AddendumView[]>();
  if (noteIds.length === 0) return out;
  const db = dbFor(await regionFor(where.patientId, where.organizationId));

  const rows = await db
    .select({
      id: noteAddenda.id,
      noteId: noteAddenda.noteId,
      authorName: noteAddenda.authorName,
      body: noteAddenda.body,
      createdAt: noteAddenda.createdAt,
    })
    .from(noteAddenda)
    .where(and(inArray(noteAddenda.noteId, noteIds), eq(noteAddenda.kind, kind)))
    .orderBy(asc(noteAddenda.createdAt));

  for (const { noteId, ...rest } of rows) {
    const list = out.get(noteId) ?? [];
    list.push(rest);
    out.set(noteId, list);
  }
  return out;
}
