import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";

import { sql } from "drizzle-orm";

import type { Actor } from "../lib/auth/session";
import { auditFixtures } from "../scripts/_audit-fixtures";

/**
 * Tenancy, against a real database: two practices, one clinician and one
 * patient each. Clinician A must not reach anything of clinician B's through
 * the data layer: the chart, its sessions, transcript, notes, files, the AI
 * profile behind it, the copilot thread, or an export.
 *
 * Every refusal is paired with the same call made by B, so a check cannot pass
 * just because the fixture is missing. Plants its own rows and removes them.
 */

type Side = {
  orgId: string;
  userId: string;
  personId: string;
  patientId: string;
  sessionId: string;
  noteId: string;
  documentId: string;
  threadId: string;
  email: string;
  phone: string;
  actor: Actor;
};

const tag = `tenancy-${Date.now().toString(36)}`;
let a: Side;
let b: Side;

async function plant(letter: "a" | "b", phone: string): Promise<Side> {
  const { controlDb: db } = await import("../lib/db");
  const s = await import("../lib/db/schema");
  const { emptyContent, SOAP } = await import("../lib/notes/formats");

  const [org] = await db
    .insert(s.organizations)
    .values({ name: `${tag} ${letter}`, slug: `${tag}-${letter}`, kind: "solo" })
    .returning({ id: s.organizations.id });
  const orgId = org!.id;

  const [user] = await db
    .insert(s.users)
    .values({
      organizationId: orgId,
      email: `${tag}-${letter}@example.com`,
      passwordHash: "not-a-hash",
      firstName: `Clinician${letter.toUpperCase()}`,
      lastName: "Example",
      role: "therapist",
    })
    .returning({ id: s.users.id });
  const userId = user!.id;

  const [person] = await db
    .insert(s.people)
    .values({ firstName: `${tag}-${letter}`, phone, claimedAt: new Date() })
    .returning({ id: s.people.id });
  const personId = person!.id;

  const email = `${tag}-patient-${letter}@example.com`;
  const [patient] = await db
    .insert(s.patients)
    .values({
      organizationId: orgId,
      therapistId: userId,
      personId,
      firstName: `${tag}-${letter}`,
      email,
      phone,
    })
    .returning({ id: s.patients.id });
  const patientId = patient!.id;

  const now = new Date();
  const [session] = await db
    .insert(s.sessions)
    .values({
      organizationId: orgId,
      therapistId: userId,
      patientId,
      status: "completed",
      modality: "video",
      feedbackToken: randomBytes(16).toString("hex"),
      startedAt: now,
      endedAt: now,
    })
    .returning({ id: s.sessions.id });
  const sessionId = session!.id;

  await db.insert(s.transcriptSegments).values({
    sessionId,
    organizationId: orgId,
    sequence: 1,
    speaker: "patient",
    text: `${tag} ${letter} said this`,
  });

  const [note] = await db
    .insert(s.sessionNotes)
    .values({
      sessionId,
      organizationId: orgId,
      therapistId: userId,
      content: emptyContent(SOAP),
      language: "en",
      status: "draft",
      format: "soap",
    } as never)
    .returning({ id: s.sessionNotes.id });

  const [document] = await db
    .insert(s.personDocuments)
    .values({
      personId,
      ordinal: 1,
      source: "upload",
      title: `${tag} ${letter} file`,
      uploadedByUserId: userId,
      organizationId: orgId,
      blobUrl: `https://example.com/${tag}-${letter}.pdf`,
      mimeType: "application/pdf",
    } as never)
    .returning({ id: s.personDocuments.id });

  await db.insert(s.personProfiles).values({
    personId,
    sections: [{ heading: "Profile", body: `${tag} ${letter} profile`, refs: ["S1:1"] }] as never,
    sessionCount: 1,
  });

  const [thread] = await db
    .insert(s.copilotThreads)
    .values({ patientId, organizationId: orgId, therapistId: userId })
    .returning({ id: s.copilotThreads.id });

  const actor: Actor = {
    userId,
    organizationId: orgId,
    role: "therapist",
    email: `${tag}-${letter}@example.com`,
    firstName: `Clinician${letter.toUpperCase()}`,
    lastName: "Example",
    verificationStatus: "verified",
    region: "us",
    timezone: null,
  };

  return {
    orgId,
    userId,
    personId,
    patientId,
    sessionId,
    noteId: note!.id,
    documentId: document!.id,
    threadId: thread!.id,
    email,
    phone,
    actor,
  };
}

before(async () => {
  a = await plant("a", "+201555000901");
  b = await plant("b", "+201555000902");
});

after(async () => {
  const { controlDb: db } = await import("../lib/db");
  const orgs = [a?.orgId, b?.orgId].filter(Boolean) as string[];
  const persons = [a?.personId, b?.personId].filter(Boolean) as string[];
  if (orgs.length === 0) return;
  const inOrgs = sql.join(orgs.map((id) => sql`${id}::uuid`), sql`, `);
  const inPersons = sql.join(persons.map((id) => sql`${id}::uuid`), sql`, `);

  await db.execute(sql`DELETE FROM copilot_threads WHERE organization_id IN (${inOrgs})`);
  await db.execute(sql`DELETE FROM person_profiles WHERE person_id IN (${inPersons})`);
  await db.execute(sql`DELETE FROM person_documents WHERE person_id IN (${inPersons})`);
  await db.execute(sql`DELETE FROM session_notes WHERE organization_id IN (${inOrgs})`);
  await db.execute(sql`DELETE FROM transcript_segments WHERE organization_id IN (${inOrgs})`);
  await db.execute(sql`DELETE FROM sessions WHERE organization_id IN (${inOrgs})`);
  await db.execute(sql`DELETE FROM patients WHERE organization_id IN (${inOrgs})`);
  await db.execute(sql`DELETE FROM people WHERE id IN (${inPersons})`);
  await db.execute(sql`DELETE FROM audit_log WHERE ${auditFixtures()} AND organization_id IN (${inOrgs})`);
  await db.execute(sql`DELETE FROM users WHERE organization_id IN (${inOrgs})`);
  await db.execute(sql`DELETE FROM organizations WHERE id IN (${inOrgs})`);
});

test("A cannot read B's patient", async () => {
  const { getPatient, getPatientHistory, listPatients, findPatientByEmail, patientsWithPhone } =
    await import("../lib/data/patients");

  assert.ok(await getPatient(b.actor, b.patientId), "CONTROL: B reads their own patient");
  assert.equal(await getPatient(a.actor, b.patientId), null, "A read B's patient");

  assert.ok((await listPatients(b.actor)).some((p) => p.id === b.patientId), "CONTROL: B lists them");
  assert.ok(!(await listPatients(a.actor)).some((p) => p.id === b.patientId), "B's patient is on A's list");

  assert.ok((await getPatientHistory(b.actor, b.patientId)).length > 0, "CONTROL: B sees the history");
  assert.deepEqual(await getPatientHistory(a.actor, b.patientId), [], "A read B's history");

  assert.ok(await findPatientByEmail(b.actor, b.email), "CONTROL: B finds them by email");
  assert.equal(await findPatientByEmail(a.actor, b.email), null, "A found B's patient by email");
  assert.deepEqual(await patientsWithPhone(a.actor, b.phone), [], "A found B's patient by phone");
});

test("A cannot read B's sessions, transcript or notes", async () => {
  const { getSession, listSessions, getTranscript, getNotes, notesForSessions, listRecentNotes } =
    await import("../lib/data/sessions");

  assert.ok(await getSession(b.actor, b.sessionId), "CONTROL: B reads their own session");
  assert.equal(await getSession(a.actor, b.sessionId), null, "A read B's session");

  assert.ok((await listSessions(b.actor)).some((r) => r.id === b.sessionId), "CONTROL: B lists it");
  assert.ok(!(await listSessions(a.actor)).some((r) => r.id === b.sessionId), "B's session is on A's list");

  assert.equal((await getTranscript(b.actor, b.sessionId)).length, 1, "CONTROL: B reads the transcript");
  assert.deepEqual(await getTranscript(a.actor, b.sessionId), [], "A read B's transcript");

  assert.equal((await getNotes(b.actor, b.sessionId)).length, 1, "CONTROL: B reads the note");
  assert.deepEqual(await getNotes(a.actor, b.sessionId), [], "A read B's note");
  assert.deepEqual(await notesForSessions(a.actor, [b.sessionId]), [], "A listed B's notes");
  assert.ok(!(await listRecentNotes(a.actor)).some((n) => n.id === b.noteId), "B's note is in A's recent notes");
});

test("A cannot read B's files or the AI profile behind B's chart", async () => {
  const { accessFor } = await import("../lib/data/grants");
  const { documentReadDecision } = await import("../lib/documents/read-access");

  const own = await documentReadDecision({
    personId: b.personId,
    uploadedByUserId: b.userId,
    actor: b.actor,
    patient: null,
  });
  assert.equal(own.allowed, true, "CONTROL: B reads the file they uploaded");

  const theirs = await documentReadDecision({
    personId: b.personId,
    uploadedByUserId: b.userId,
    actor: a.actor,
    patient: null,
  });
  assert.equal(theirs.allowed, false, "A read B's patient's file");

  /*
   * The profile, timeline and files are keyed by person, and a clinician only
   * reaches a person through a chart they hold. Holding none, A gets no person
   * id and no capability to read anything about one.
   */
  const ownAccess = await accessFor(b.actor, b.patientId);
  assert.equal(ownAccess.personId, b.personId, "CONTROL: B reaches the person");

  const access = await accessFor(a.actor, b.patientId);
  assert.equal(access.personId, null, "A reached B's patient's person record");
  assert.equal(access.capabilities.liveProfile, false, "A may read B's patient's AI profile");
  assert.equal(access.capabilities.patientFiles, false, "A may read B's patient's files");
  assert.equal(access.capabilities.copilot, false, "A may ask the copilot about B's patient");
});

test("A cannot open B's copilot thread or export B's patient", async () => {
  const { getOrCreateThread, getMessages, listThreads } = await import("../lib/data/copilot");
  const { requestPatientExport } = await import("../lib/data/export");

  assert.equal(await getOrCreateThread(a.actor, b.patientId), null, "A opened a thread on B's patient");
  assert.deepEqual(await getMessages(a.actor, b.threadId), [], "A read B's copilot messages");
  assert.ok((await listThreads(b.actor)).some((t) => t.threadId === b.threadId), "CONTROL: B lists it");
  assert.ok(!(await listThreads(a.actor)).some((t) => t.threadId === b.threadId), "B's thread is in A's inbox");

  const exported = await requestPatientExport(a.actor, b.patientId);
  assert.equal(exported.ok, false, "A exported B's patient");
});
