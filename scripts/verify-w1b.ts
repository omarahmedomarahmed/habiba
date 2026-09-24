/**
 * 🔴 WAVE 1B: CLINICAL INTEGRITY AND CONSENT.
 *
 *   npm run verify:w1b
 *
 * One section per item in `takeover/FIX-PLAN.md`, each written to fail on the
 * code as it was before the fix and planted against real rows, because every
 * one of these is a property of what the database keeps.
 *
 * Everything it makes is deleted in a `finally`, and `writesTo()` refuses
 * production by name.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `w1b${Date.now().toString(36)}`;

async function main() {
  writesTo();

  const { db, pool } = connect();

  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  try {
    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind)
      VALUES ('Wave 1B Demo Practice', 'eg', ${fixture}, 'solo') RETURNING id`);

    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`nour.${fixture}@example.com`}, 'Nour', 'Demo', 'therapist', 'x')
      RETURNING id`);

    const actor = {
      userId: therapist.id,
      organizationId: org.id,
      role: "therapist" as const,
      email: `nour.${fixture}@example.com`,
      firstName: "Nour",
      lastName: "Demo",
      verificationStatus: "verified" as const,
      region: "eg" as const,
      timezone: "UTC",
    };

    /* ================================================================ */
    /*  W1-03 · A SIGNED NOTE IS LOCKED, A CHANGE IS AN ADDENDUM         */
    /* ================================================================ */

    const session = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, status, modality, feedback_token)
      VALUES (${org.id}, ${therapist.id}, 'completed', 'in_person', ${`fb-${fixture}`})
      RETURNING id`);

    const SIGNED = "Signed assessment, as attested";
    const BRIEF = "What you were sent";
    const note = {
      soap: { subjective: "", objective: "", assessment: SIGNED, plan: "" },
      summary: "",
      talkingPoints: [],
      observations: "",
      impressions: "",
      recommendations: [],
      followUp: "",
      patientBrief: BRIEF,
      patientSteps: [],
      patientNext: "",
    };

    await db.execute(sql`
      INSERT INTO session_notes (session_id, organization_id, therapist_id, content,
                                 status, approved_at, approved_by,
                                 patient_status, patient_approved_at, patient_approved_by)
      VALUES (${session.id}, ${org.id}, ${therapist.id}, ${JSON.stringify(note)}::jsonb,
              'approved', now(), ${therapist.id}, 'approved', now(), ${therapist.id})`);

    const { saveClinicalNote, savePatientCopy } = await import("../lib/data/note-record");

    const rewrite = await saveClinicalNote(actor as never, session.id, {
      ...note,
      soap: { ...note.soap, assessment: "Rewritten after signing" },
    } as never);
    const afterRewrite = await one<{ assessment: string }>(sql`
      SELECT content->'soap'->>'assessment' AS assessment FROM session_notes
       WHERE session_id = ${session.id}`);

    check(
      "🔴 W1-03 saveNote on a SIGNED note refuses, and the signed text is still there",
      !rewrite.ok && afterRewrite.assessment === SIGNED,
      `ok=${rewrite.ok}, assessment now "${afterRewrite.assessment}"`,
    );

    const rebrief = await savePatientCopy(actor as never, session.id, {
      patientBrief: "Rewritten after release",
      patientSteps: [],
      patientNext: "",
    });
    const afterRebrief = await one<{ brief: string }>(sql`
      SELECT content->>'patientBrief' AS brief FROM session_notes WHERE session_id = ${session.id}`);

    check(
      "🔴 W1-03 savePatientNote on a RELEASED copy refuses, and what they were sent is still there",
      !rebrief.ok && afterRebrief.brief === BRIEF,
      `ok=${rebrief.ok}, brief now "${afterRebrief.brief}"`,
    );

    /*
     * 🔴 The lock is the DATABASE's, not only this module's. A write path
     * nobody has written yet, here raw SQL, is refused by the trigger.
     */
    let rawRefused = false;
    try {
      await db.execute(sql`
        UPDATE session_notes SET content = jsonb_set(content, '{soap,assessment}', '"raw"')
         WHERE session_id = ${session.id}`);
    } catch {
      rawRefused = true;
    }
    check("🔴 W1-03 a raw UPDATE of a signed note is refused by the database", rawRefused);

    const { addAddendum, addendaFor } = await import("../lib/data/note-record");
    const first = await addAddendum(actor as never, session.id, "clinical", "First addendum");
    const second = await addAddendum(actor as never, session.id, "clinical", "Second addendum");
    const CLINICAL_ONLY = `clinical-only-${fixture}`;
    await addAddendum(actor as never, session.id, "clinical", CLINICAL_ONLY);
    const toPatient = await addAddendum(actor as never, session.id, "patient", "A line for you");

    const noteRow = await one<{ id: string }>(sql`
      SELECT id FROM session_notes WHERE session_id = ${session.id}`);
    const scope = { patientId: null, organizationId: org.id };
    const clinical = (await addendaFor([noteRow.id], "clinical", scope)).get(noteRow.id) ?? [];
    check(
      "🔴 W1-03 addenda are appended to the NOTE, with the author, in order",
      first.ok && second.ok && toPatient.ok &&
        clinical.map((a) => a.body).join("|") === `First addendum|Second addendum|${CLINICAL_ONLY}` &&
        clinical.every((a) => a.authorName === "Nour Demo"),
      clinical.map((a) => `${a.authorName}: ${a.body}`).join(" / "),
    );

    let addendumRewritten = true;
    try {
      await db.execute(sql`UPDATE note_addenda SET body = 'changed' WHERE note_id = ${noteRow.id}`);
    } catch {
      addendumRewritten = false;
    }
    let addendumDeleted = true;
    try {
      await db.execute(sql`DELETE FROM note_addenda WHERE note_id = ${noteRow.id}`);
    } catch {
      addendumDeleted = false;
    }
    check(
      "🔴 W1-03 an addendum cannot be edited or deleted, it is kept for ever",
      !addendumRewritten && !addendumDeleted,
    );

    /* A draft stays editable, and cannot take an addendum yet. */
    const draft = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, status, modality, feedback_token)
      VALUES (${org.id}, ${therapist.id}, 'completed', 'in_person', ${`fb2-${fixture}`})
      RETURNING id`);
    await db.execute(sql`
      INSERT INTO session_notes (session_id, organization_id, therapist_id, content)
      VALUES (${draft.id}, ${org.id}, ${therapist.id}, ${JSON.stringify(note)}::jsonb)`);
    const edited = await saveClinicalNote(actor as never, draft.id, {
      ...note,
      soap: { ...note.soap, assessment: "Edited while a draft" },
    } as never);
    const early = await addAddendum(actor as never, draft.id, "clinical", "Too early");
    const draftNow = await one<{ assessment: string }>(sql`
      SELECT content->'soap'->>'assessment' AS assessment FROM session_notes
       WHERE session_id = ${draft.id}`);
    check(
      "W1-03 an unsigned draft is still editable, and takes no addendum until signed",
      edited.ok && draftNow.assessment === "Edited while a draft" && !early.ok,
      `edit ok=${edited.ok}, addendum ok=${early.ok}`,
    );

    /*
     * 🔴 The patient sees the addendum to THEIR copy, and never a clinical one.
     * Planted on a session with a person so `sessionsForPatient` can read it.
     */
    const person = await one<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, email)
      VALUES ('Salma', 'Demo', ${`salma.${fixture}@example.com`}) RETURNING id`);
    const patient = await one<{ id: string }>(sql`
      INSERT INTO patients (organization_id, person_id, first_name, last_name, email, source)
      VALUES (${org.id}, ${person.id}, 'Salma', 'Demo', ${`salma.${fixture}@example.com`}, 'walk_in')
      RETURNING id`);
    await db.execute(sql`UPDATE sessions SET patient_id = ${patient.id} WHERE id = ${session.id}`);

    const { sessionsForPatient } = await import("../lib/data/patient-view");
    const mine = await sessionsForPatient(person.id);
    const payload = JSON.stringify(mine);
    check(
      "🔴 W1-03 the patient's released copy shows its addendum…",
      mine[0]?.briefAddenda?.[0]?.body === "A line for you",
      JSON.stringify(mine[0]?.briefAddenda ?? null),
    );
    check(
      "🔴 W1-03 …and never a clinical addendum",
      !payload.includes(CLINICAL_ONLY),
      payload.includes(CLINICAL_ONLY) ? "A CLINICAL ADDENDUM LEAKED" : "absent",
    );
  } finally {
    await db.execute(sql`DELETE FROM sessions WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM patients WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM people WHERE email LIKE ${`%${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("wave 1B");
}

main();
