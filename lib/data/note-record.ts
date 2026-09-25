import "server-only";

import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

import { auditPhi } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { dbFor } from "@/lib/db";
import { regionOfOrganization, regionOfPatient } from "@/lib/db/directory";
import { qualified } from "@/lib/db/qualified";
import {
  noteAddenda,
  sessionNotes,
  type NoteAddendumKind,
  type NoteContent,
} from "@/lib/db/schema";
import { getSession } from "@/lib/data/sessions";
import { mergeSectionText } from "@/lib/notes/formats";
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
 * take a NOTE id, because a session carries one note per format (W2-F01), each
 * signed on its own. The session-level functions under them resolve the note
 * the action names, inside the session, or the session's primary note.
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
                FROM jsonb_each(${qualified(sessionNotes.content)})
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

/**
 * The session, scoped to the actor, and one of its notes.
 *
 * 🔴 W2-F01: a session carries one note per format. `noteId` names which; it
 * is only ever matched INSIDE this session, so an id from another session
 * resolves to nothing. Without one, the session's primary note: the one that
 * carries the patient's copy, and the only note a session had before formats.
 */
async function noteOf(actor: Actor, sessionId: string, noteId?: string | null) {
  const row = await getSession(actor, sessionId);
  if (!row) return null;
  const db = dbFor(await regionFor(row.session.patientId, row.session.organizationId));
  const [note] = await db
    .select({
      id: sessionNotes.id,
      isPrimary: sessionNotes.isPrimary,
      content: sessionNotes.content,
    })
    .from(sessionNotes)
    .where(
      and(
        eq(sessionNotes.sessionId, sessionId),
        noteId ? eq(sessionNotes.id, noteId) : eq(sessionNotes.isPrimary, true),
      ),
    )
    .limit(1);
  return { row, db, noteId: note?.id ?? null, note: note ?? null };
}

/** Edit the clinical note. A draft only: a signed note is refused. */
export async function saveClinicalNote(
  actor: Actor,
  sessionId: string,
  content: NoteContent,
  noteId?: string | null,
): Promise<NoteWriteResult> {
  const found = await noteOf(actor, sessionId, noteId);
  if (!found) return { ok: false, reason: "not_found" };
  if (!found.noteId || !found.note) return { ok: false, reason: "no_note" };

  /*
   * 🔴 W2-F01: a note in a format keeps its sections' keys and headings; the
   * edit changes their text. A SOAP note stores none, and still stores none.
   */
  const stored = found.note.content?.sections;
  const sent: NoteContent = { ...content };
  if (stored?.length) sent.sections = mergeSectionText(stored, content.sections);
  else delete sent.sections;

  const result = await writeClinical(found.db, found.noteId, sent);
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

/**
 * Add an addendum to one of this session's notes, as the actor. A `patient`
 * addendum always goes on the note that carries the patient's copy.
 */
export async function addAddendum(
  actor: Actor,
  sessionId: string,
  kind: NoteAddendumKind,
  body: string,
  noteId?: string | null,
): Promise<NoteWriteResult> {
  if (!body.trim()) return { ok: false, reason: "empty" };
  const found = await noteOf(actor, sessionId, kind === "clinical" ? noteId : null);
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

/**
 * Sign one of the session's notes.
 *
 * 🔴 W2-F01: the patient's plain-language copy stays one per session, from
 * whichever note was signed FIRST. So when the first signature lands on a note
 * other than the primary, and the primary's copy has not gone to anybody, the
 * primary flag moves to the signed note and its copy becomes the one the
 * patient will be offered. A released copy never moves: it is somebody's now.
 * One transaction, because `session_notes_one_primary` allows no moment with
 * two primaries and a session must never be left with none.
 */
export async function signNote(
  actor: Actor,
  sessionId: string,
  noteId?: string | null,
): Promise<NoteWriteResult> {
  const found = await noteOf(actor, sessionId, noteId);
  if (!found) return { ok: false, reason: "not_found" };
  if (!found.noteId || !found.note) return { ok: false, reason: "no_note" };
  const target = found.noteId;
  const wasPrimary = found.note.isPrimary;

  let firstSignature = false;
  let changed = false;
  await found.db.transaction(async (tx) => {
    const signed = await tx
      .update(sessionNotes)
      .set({ status: "approved", approvedAt: new Date(), approvedBy: actor.userId })
      .where(and(eq(sessionNotes.id, target), eq(sessionNotes.status, "draft")))
      .returning({ id: sessionNotes.id });
    changed = signed.length > 0;
    if (signed.length > 0) {
      /* The session's first signed note, whichever format: one event per session. */
      const approved = await tx
        .select({ id: sessionNotes.id })
        .from(sessionNotes)
        .where(and(eq(sessionNotes.sessionId, sessionId), eq(sessionNotes.status, "approved")));
      firstSignature = approved.length === 1;
    }
    if (signed.length === 0 || wasPrimary) return;

    const others = await tx
      .select({
        id: sessionNotes.id,
        isPrimary: sessionNotes.isPrimary,
        status: sessionNotes.status,
        patientStatus: sessionNotes.patientStatus,
      })
      .from(sessionNotes)
      .where(and(eq(sessionNotes.sessionId, sessionId), ne(sessionNotes.id, target)));
    const primary = others.find((note) => note.isPrimary);
    const signedBefore = others.some((note) => note.status === "approved");
    if (!primary || signedBefore || primary.patientStatus !== "draft") return;

    await tx.update(sessionNotes).set({ isPrimary: false }).where(eq(sessionNotes.id, primary.id));
    await tx.update(sessionNotes).set({ isPrimary: true }).where(eq(sessionNotes.id, target));
  });

  /*
   * 🔴 Already signed: nothing was approved, so nothing is written down. An
   * approval row for a press that changed nothing reads, in the PHI audit, as
   * a second signature by whoever pressed it.
   */
  if (!changed) return { ok: true };

  await auditPhi(actor, "note.approve", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: found.row.session.patientId,
  });
  /* 🔴 C6: a partner's clinician signed, so the partner may collect it. */
  if (firstSignature) {
    const { notifySessionEvent } = await import("@/lib/partner/webhooks");
    await notifySessionEvent(sessionId, "note.approved");
  }
  return { ok: true };
}

/** Release the patient's copy: the session's one, on its primary note. */
export async function releasePatientCopy(actor: Actor, sessionId: string): Promise<NoteWriteResult> {
  const found = await noteOf(actor, sessionId);
  if (!found) return { ok: false, reason: "not_found" };
  if (!found.noteId) return { ok: false, reason: "no_note" };

  const released = await found.db
    .update(sessionNotes)
    .set({
      patientStatus: "approved",
      patientApprovedAt: new Date(),
      patientApprovedBy: actor.userId,
    })
    .where(and(eq(sessionNotes.id, found.noteId), eq(sessionNotes.patientStatus, "draft")))
    .returning({ id: sessionNotes.id });

  /* 🔴 Already released: the same rule as signing, no row for a press that changed nothing. */
  if (released.length === 0) return { ok: true };

  await auditPhi(actor, "note.patient.approve", {
    resourceType: "note",
    resourceId: sessionId,
    patientId: found.row.session.patientId,
  });
  return { ok: true };
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
