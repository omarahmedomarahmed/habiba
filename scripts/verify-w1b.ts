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

    /* ================================================================ */
    /*  W1-16 · AN EXPIRED LICENCE STOPS CLEARING ANYBODY                */
    /* ================================================================ */

    const clinician = async (name: string, expiry: string) => {
      const user = await one<{ id: string }>(sql`
        INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
        VALUES (${org.id}, ${`${name}.${fixture}@example.com`}, ${name}, 'Demo', 'therapist', 'x')
        RETURNING id`);
      await db.execute(sql`
        INSERT INTO therapist_verifications (user_id, organization_id, state, submitted_at,
                                             reviewed_at, license_body, license_number,
                                             license_expiry)
        VALUES (${user.id}, ${org.id}, 'approved', now(), now(), 'Demo Board', 'X-1', ${expiry})`);
      await db.execute(sql`
        INSERT INTO therapist_radar (user_id, organization_id, status)
        VALUES (${user.id}, ${org.id}, 'online')`);
      return user;
    };

    const day = 86_400_000;
    const iso = (at: number) => new Date(at).toISOString().slice(0, 10);
    const lapsed = await clinician("lapsed", iso(Date.now() - 2 * day));
    const soon = await clinician("soon", iso(Date.now() + 10 * day));
    const fine = await clinician("fine", iso(Date.now() + 200 * day));

    const slot = await one<{ id: string }>(sql`
      INSERT INTO availability_slots (therapist_user_id, organization_id, starts_at, duration_minutes)
      VALUES (${lapsed.id}, ${org.id}, date_trunc('hour', now()) + interval '2 days', 60)
      RETURNING id`);
    const booked = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, status, modality, feedback_token,
                            scheduled_at)
      VALUES (${org.id}, ${lapsed.id}, 'scheduled', 'video', ${`fb3-${fixture}`},
              now() + interval '3 days')
      RETURNING id`);

    const warnedAt = async () =>
      (
        await one<{ at: string | null }>(sql`
          SELECT to_jsonb(v)->>'license_expiry_warned_at' AS at
            FROM therapist_verifications v WHERE v.user_id = ${soon.id}`)
      ).at;
    let firstWarning: string | null = null;
    let secondWarning: string | null = null;
    try {
      const { sweepLicences } = await import("../lib/data/licence-expiry" as string);
      await sweepLicences(new Date());
      firstWarning = await warnedAt();
      await sweepLicences(new Date(Date.now() + 60_000));
      secondWarning = await warnedAt();
    } catch (error) {
      console.log(`  --    no licence sweep: ${(error as Error).message.split("\n")[0]}`);
    }

    const standing = async (userId: string) =>
      one<{ state: string; expired: boolean; warned: boolean; radar: string; status: string }>(sql`
        SELECT v.state, to_jsonb(v)->>'license_expired_at' IS NOT NULL AS expired,
               to_jsonb(v)->>'license_expiry_warned_at' IS NOT NULL AS warned,
               r.status AS radar, u.verification_status AS status
          FROM therapist_verifications v
          JOIN users u ON u.id = v.user_id
          LEFT JOIN therapist_radar r ON r.user_id = v.user_id
         WHERE v.user_id = ${userId}`);

    const lapsedNow = await standing(lapsed.id);
    check(
      "🔴 W1-16 an approved clinician whose licence expired is no longer cleared, and is in the re-review queue",
      lapsedNow.state === "submitted" && lapsedNow.expired && lapsedNow.status !== "verified",
      JSON.stringify(lapsedNow),
    );
    check(
      "🔴 W1-16 …and is off the radar",
      lapsedNow.radar === "offline",
      `radar ${lapsedNow.radar}`,
    );

    const { holdSlot, openHours } = await import("../lib/data/scheduling");
    const hours = await openHours(lapsed.id, 7);
    const hold = await holdSlot(slot.id);
    check(
      "🔴 W1-16 …and cannot be newly booked: the hour is neither listed nor holdable",
      !hold.ok && hours.length === 0,
      `hold ok=${hold.ok}, ${hours.length} open hours`,
    );

    const keptSession = await one<{ status: string }>(sql`
      SELECT status FROM sessions WHERE id = ${booked.id}`);
    check(
      "W1-16 …and a session already booked is NOT cancelled automatically",
      keptSession.status === "scheduled",
      keptSession.status,
    );

    const { reviewQueue } = await import("../lib/data/verification");
    const queue = await reviewQueue("submitted");
    const inQueue = queue.find((row) => row.userId === lapsed.id);
    check(
      "🔴 W1-16 the operator's queue shows them, marked expired",
      Boolean(inQueue) && Boolean((inQueue as { licenseExpiredAt?: Date | null })?.licenseExpiredAt),
      inQueue ? "queued" : "not in the queue",
    );

    const soonNow = await standing(soon.id);
    const fineNow = await standing(fine.id);
    check(
      "🔴 W1-16 a licence expiring within 30 days is warned once, and stays cleared",
      soonNow.state === "approved" && soonNow.warned && firstWarning !== null &&
        firstWarning === secondWarning,
      `${JSON.stringify(soonNow)}, warned at ${firstWarning}, then ${secondWarning}`,
    );
    /* ================================================================ */
    /*  W1-23 · A LICENCE CHANGE AFTER APPROVAL GOES THROUGH REVIEW      */
    /* ================================================================ */

    const changer = await clinician("changer", iso(Date.now() + 400 * day));
    await db.execute(sql`
      UPDATE users SET profile = ${JSON.stringify({
        credentials: "LPC",
        licenseType: "LPC",
        licenseNumber: "X-1",
        licenseState: "Cairo",
      })}::jsonb WHERE id = ${changer.id}`);
    const changerActor = {
      ...actor,
      userId: changer.id,
      email: `changer.${fixture}@example.com`,
      firstName: "changer",
    };

    const { writeProfile, writeVerificationDetails } = await import("../lib/data/licence-change");
    await writeProfile(changerActor as never, {
      firstName: "changer",
      lastName: "Demo",
      credentials: "PhD, invented",
      licenseType: "Psychiatrist",
      licenseNumber: "FAKE-9",
      licenseState: "Nowhere",
    });
    const profileNow = await one<{ credentials: string; number: string; first: string }>(sql`
      SELECT profile->>'credentials' AS credentials, profile->>'licenseNumber' AS number,
             first_name AS first
        FROM users WHERE id = ${changer.id}`);
    check(
      "🔴 W1-23 after approval, /settings cannot change credentials or licence fields unreviewed",
      profileNow.credentials === "LPC" && profileNow.number === "X-1",
      JSON.stringify(profileNow),
    );

    await writeVerificationDetails(changerActor as never, {
      country: "EG",
      licenseBody: "Another Board",
      licenseNumber: "Y-2",
      licenseExpiry: iso(Date.now() + 700 * day),
      specialties: [],
      languages: [],
    });
    const changed = await one<{
      state: string;
      body: string;
      number: string;
      pending: string | null;
      status: string;
    }>(sql`
      SELECT v.state, v.license_body AS body, v.license_number AS number,
             to_jsonb(v)->>'pending_licence' AS pending, u.verification_status AS status
        FROM therapist_verifications v JOIN users u ON u.id = v.user_id
       WHERE v.user_id = ${changer.id}`);
    check(
      "🔴 W1-23 a licence change after approval is held for review, not written over what was checked",
      changed.body === "Demo Board" && changed.number === "X-1" &&
        (changed.pending ?? "").includes("Y-2"),
      JSON.stringify(changed),
    );
    check(
      "🔴 W1-23 …and the clinician stays cleared while the operator decides",
      changed.state === "approved" && changed.status === "verified",
      `${changed.state}, ${changed.status}`,
    );
    const recheckQueue = await reviewQueue("submitted");
    check(
      "🔴 W1-23 …and it is in the operator's queue",
      recheckQueue.some((row) => row.userId === changer.id),
      recheckQueue.some((row) => row.userId === changer.id) ? "queued" : "not queued",
    );

    const { requestLicenceChange } = await import("../lib/data/licence-change");
    await requestLicenceChange(changerActor as never, { credentials: "MSc, checked" });
    const { decideVerification } = await import("../lib/data/verification");
    const vid = recheckQueue.find((row) => row.userId === changer.id)?.id ?? "";
    const decided = await decideVerification({
      verificationId: vid,
      approve: true,
      note: "",
      adminUserId: therapist.id,
    });
    const afterApproval = await one<{
      state: string;
      number: string;
      pending: string | null;
      credentials: string;
    }>(sql`
      SELECT v.state, v.license_number AS number, to_jsonb(v)->>'pending_licence' AS pending,
             u.profile->>'credentials' AS credentials
        FROM therapist_verifications v JOIN users u ON u.id = v.user_id
       WHERE v.user_id = ${changer.id}`);
    check(
      "W1-23 an operator's approval moves the change in, and the request is gone",
      Boolean(decided?.recheck) && afterApproval.state === "approved" &&
        afterApproval.number === "Y-2" && afterApproval.credentials === "MSc, checked" &&
        afterApproval.pending === null,
      JSON.stringify(afterApproval),
    );

    await requestLicenceChange(changerActor as never, { licenseNumber: "Z-3" });
    await decideVerification({ verificationId: vid, approve: false, note: "Unreadable", adminUserId: therapist.id });
    const afterRejection = await one<{ state: string; number: string; pending: string | null }>(sql`
      SELECT v.state, v.license_number AS number, to_jsonb(v)->>'pending_licence' AS pending
        FROM therapist_verifications v WHERE v.user_id = ${changer.id}`);
    check(
      "W1-23 a rejected change is dropped, and the clinician keeps what was checked",
      afterRejection.state === "approved" && afterRejection.number === "Y-2" &&
        afterRejection.pending === null,
      JSON.stringify(afterRejection),
    );

    check(
      "W1-16 a licence well in date is left alone",
      fineNow.state === "approved" && !fineNow.warned && fineNow.radar === "online",
      JSON.stringify(fineNow),
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
