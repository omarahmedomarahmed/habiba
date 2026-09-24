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

import { startMockOpenAi } from "../tests/mock-openai";
import { readSource, reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `w1b${Date.now().toString(36)}`;

/** A WAV of silence: 16 kHz, mono, 16-bit, so one second is 32,000 bytes. */
function silentWav(seconds: number): Buffer {
  const data = 32_000 * seconds;
  const out = Buffer.alloc(44 + data);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + data, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16_000, 24);
  out.writeUInt32LE(32_000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(data, 40);
  return out;
}

async function main() {
  writesTo();

  /*
   * The partner routes transcribe and draft, so they are pointed at the same
   * stand-in the e2e suite uses, which records what it was sent. Set before any
   * product module is imported, because the client reads it once.
   */
  const mock = startMockOpenAi(4319);
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:4319/v1";
  process.env.OPENAI_API_KEY ||= "sk-mock";

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
    const reviewer = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`reviewer.${fixture}@example.com`}, 'Second', 'Reviewer', 'staff', 'x')
      RETURNING id`);
    /* 🔴 0154: one reviewer proposes, a second one who agrees decides. */
    const decideTwice = async (o: Parameters<typeof decideVerification>[0]) => {
      await decideVerification(o);
      return decideVerification({ ...o, adminUserId: reviewer.id });
    };
    const vid = recheckQueue.find((row) => row.userId === changer.id)?.id ?? "";
    const decided = await decideTwice({
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
    await decideTwice({ verificationId: vid, approve: false, note: "Unreadable", adminUserId: therapist.id });
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
    /* ================================================================ */
    /*  PARTNER FIXTURE · a partner, a key, and their routes              */
    /* ================================================================ */

    const partner = await one<{ id: string }>(sql`
      INSERT INTO partners (name, slug, state) VALUES (${fixture}, ${fixture}, 'active')
      RETURNING id`);
    const { mintKey } = await import("../lib/partner/keys");
    const minted = await mintKey({
      partnerId: partner.id,
      label: "wave 1B",
      environment: "sandbox",
      sponsorId: null,
      scopes: ["consent:write", "session:media", "transcript:read", "note:review",
        "copilot:chat", "memory:read"],
    });
    const bearer = { authorization: `Bearer ${minted.key?.raw}` };
    const base = "http://localhost/api/partner/v1";

    const consentRoute = await import("../app/api/partner/v1/consent/route");
    const mediaRoute = await import("../app/api/partner/v1/sessions/[ref]/media/route");
    const consent = (session: string, subject: string, state: string, offset: number) =>
      consentRoute.POST(
        new Request(`${base}/consent`, {
          method: "POST",
          headers: { ...bearer, "content-type": "application/json" },
          body: JSON.stringify({
            session,
            subject,
            state,
            answered_at: new Date().toISOString(),
            offset_seconds: offset,
          }),
        }),
      );
    const media = (ref: string, audio: Buffer, type: string, headers: Record<string, string> = {}) =>
      mediaRoute.POST(
        new Request(`${base}/sessions/${ref}/media`, {
          method: "POST",
          headers: { ...bearer, "content-type": type, ...headers },
          body: audio,
        }),
        { params: Promise.resolve({ ref }) },
      );

    /* ================================================================ */
    /*  W1-17 · NOTHING BEFORE THE CONSENT OFFSET IS TRANSCRIBED         */
    /* ================================================================ */

    const late = `${fixture}-late`;
    await consent(late, `${fixture}-P1`, "given", 5);
    const before = mock.state.transcriptionRequests.length;
    const wav = await media(late, silentWav(10), "audio/wav");
    const sent = mock.state.transcriptionRequests.slice(before);
    const sentBytes = sent.reduce((sum, request) => sum + request.bytes, 0);
    check(
      "🔴 W1-17 a WAV from a session consented 5 s in: only the 5 s after the offset reach the transcriber",
      wav.status === 200 && sent.length === 1 && sentBytes < 32_000 * 6 && sentBytes > 32_000 * 4,
      `status ${wav.status}, ${sent.length} request(s), ${sentBytes} bytes sent of a ${32_000 * 10} byte recording`,
    );

    const whole = `${fixture}-whole`;
    await consent(whole, `${fixture}-P1`, "given", 5);
    const beforeWebm = mock.state.transcriptionRequests.length;
    const webm = await media(whole, Buffer.alloc(4_000, 1), "audio/webm");
    check(
      "🔴 W1-17 audio we cannot cut, reaching back before the offset, is refused rather than transcribed",
      webm.status === 422 && mock.state.transcriptionRequests.length === beforeWebm,
      `status ${webm.status}, ${mock.state.transcriptionRequests.length - beforeWebm} sent`,
    );
    const afterOffset = await media(whole, Buffer.alloc(4_000, 1), "audio/webm", {
      "x-audio-start-seconds": "5",
    });
    check(
      "W1-17 …and the same audio, declared to start at the offset, is taken",
      afterOffset.status === 200,
      `status ${afterOffset.status}`,
    );

    await db.execute(sql`
      UPDATE partner_sessions SET note_draft = 'A draft note', summary_text = 'A summary'
       WHERE partner_id = ${partner.id} AND external_session_ref = ${late}`);
    await consent(late, `${fixture}-P1`, "withdrawn", 0);
    const purged = await one<{ transcript: string | null; draft: string | null; summary: string | null }>(sql`
      SELECT transcript_text AS transcript, note_draft AS draft, summary_text AS summary
        FROM partner_sessions
       WHERE partner_id = ${partner.id} AND external_session_ref = ${late}`);
    check(
      "🔴 W1-17 a withdrawal purges the stored transcript, draft and summary",
      purged.transcript === null && purged.draft === null && purged.summary === null,
      JSON.stringify(purged),
    );

    /* ================================================================ */
    /*  W1-18 · COPILOT AND MEMORY ASK ABOUT CONSENT AND REVOCATION      */
    /* ================================================================ */

    /*
     * `ended_at` is planted, because nothing writes it yet (W2-X02 will). That
     * is exactly the point: these checks must hold the day something does.
     */
    const copilotRoute = await import("../app/api/partner/v1/copilot/route");
    const memoryRoute = await import("../app/api/partner/v1/subjects/[ref]/memory/route");
    await copilotRoute.PUT(
      new Request(`${base}/copilot`, {
        method: "PUT",
        headers: { ...bearer, "content-type": "application/json" },
        body: JSON.stringify({ clinician: `${fixture}-C1`, enabled: true }),
      }),
    );
    const ask = (subject: string) =>
      copilotRoute.POST(
        new Request(`${base}/copilot`, {
          method: "POST",
          headers: { ...bearer, "content-type": "application/json" },
          body: JSON.stringify({ subject, clinician: `${fixture}-C1`, question: "What did we cover?" }),
        }),
      );
    const remember = (subject: string) =>
      memoryRoute.GET(new Request(`${base}/subjects/${subject}/memory`, { headers: bearer }), {
        params: Promise.resolve({ ref: subject }),
      });
    const endedSession = async (ref: string, subject: string) => {
      await consent(ref, subject, "given", 0);
      await db.execute(sql`
        UPDATE partner_sessions
           SET ended_at = now(), transcript_text = 'They talked about sleep.',
               note_approved_text = 'Approved note about sleep.', note_approved_by_ref = 'C1',
               note_approved_at = now()
         WHERE partner_id = ${partner.id} AND external_session_ref = ${ref}`);
    };

    const withdrawer = `${fixture}-P2`;
    await endedSession(`${fixture}-w1`, withdrawer);
    const beforeWithdrawal = await remember(withdrawer);
    const beforeBody = (await beforeWithdrawal.json()) as { sessions?: unknown[] };
    await consent(`${fixture}-w1`, withdrawer, "withdrawn", 0);
    const askAfter = await ask(withdrawer);
    const memoryAfter = await remember(withdrawer);
    check(
      "🔴 W1-18 after the subject withdraws consent, copilot and memory refuse with 403",
      (beforeBody.sessions?.length ?? 0) === 1 && askAfter.status === 403 && memoryAfter.status === 403,
      `memory had ${beforeBody.sessions?.length ?? 0} before; copilot ${askAfter.status}, memory ${memoryAfter.status}`,
    );
    const refusal = (await memoryAfter.clone().json().catch(() => ({}))) as { error?: string };
    check(
      "W1-18 …and the refusal says why",
      /consent/i.test(refusal.error ?? ""),
      refusal.error ?? "no error sentence",
    );

    const unlinked = `${fixture}-P3`;
    await endedSession(`${fixture}-u1`, unlinked);
    await db.execute(sql`
      INSERT INTO partner_subjects (partner_id, external_ref, revoked_at)
      VALUES (${partner.id}, ${unlinked}, now())`);
    const askUnlinked = await ask(unlinked);
    const memoryUnlinked = await remember(unlinked);
    check(
      "🔴 W1-18 a subject who unlinked is refused with 403 by both",
      askUnlinked.status === 403 && memoryUnlinked.status === 403,
      `copilot ${askUnlinked.status}, memory ${memoryUnlinked.status}`,
    );

    const { sessionMaterial } = await import("../lib/partner/copilot");
    const leaked = [
      ...(await sessionMaterial({ partnerId: partner.id, externalSubjectRef: withdrawer })),
      ...(await sessionMaterial({ partnerId: partner.id, externalSubjectRef: unlinked })),
    ];
    check(
      "🔴 W1-18 …and the material itself holds nothing for either, whatever route asks next",
      leaked.length === 0,
      `${leaked.length} sessions`,
    );

    /* ================================================================ */
    /*  W1-24 · CONSENT AND COVERAGE STAY OUT OF THE NOTE TEXT           */
    /* ================================================================ */

    const noteRoute = await import("../app/api/partner/v1/sessions/[ref]/note/route");
    const { coverageSentence } = await import("../lib/partner/consent");
    const drafted = `${fixture}-n1`;
    await consent(drafted, `${fixture}-P4`, "given", 600);
    await db.execute(sql`
      UPDATE partner_sessions
         SET transcript_text = 'The patient described a hard week at work and poor sleep, and we agreed a plan.'
       WHERE partner_id = ${partner.id} AND external_session_ref = ${drafted}`);
    const noteResponse = await noteRoute.GET(
      new Request(`${base}/sessions/${drafted}/note`, { headers: bearer }),
      { params: Promise.resolve({ ref: drafted }) },
    );
    const noteBody = (await noteResponse.json()) as { draft?: string | null; coverage?: string };
    const storedDraft = await one<{ draft: string | null }>(sql`
      SELECT note_draft AS draft FROM partner_sessions
       WHERE partner_id = ${partner.id} AND external_session_ref = ${drafted}`);
    const coverage = coverageSentence(600);
    check(
      "🔴 W1-24 the stored draft and the draft we return carry no consent or coverage sentence",
      Boolean(storedDraft.draft) &&
        !(storedDraft.draft ?? "").includes("Recording started") &&
        !(noteBody.draft ?? "").includes("Recording started"),
      (storedDraft.draft ?? "no draft").slice(0, 90),
    );
    check(
      "W1-24 …and coverage is still said, as its own field",
      noteBody.coverage === coverage,
      noteBody.coverage ?? "no coverage field",
    );

    /* ================================================================ */
    /*  W1-30 · OUR OWN NOTES: THE LATE START IS PROVENANCE, NOT TEXT    */
    /* ================================================================ */

    /*
     * `generateAndStoreNote` prepended "Recording began at 10:10; the first 10
     * minutes ... do not exist." to the summary, and to the English copy: a
     * recording fact written by the machine into clinical text, the pattern
     * W1-24 took out of partner drafts. The fact belongs to the note's
     * provenance, shown above the note.
     */
    const lateStart = new Date(Date.now() - 60 * 60_000);
    const lateSession = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, status, modality, feedback_token,
                            started_at, recording_started_at, ended_at, recording_consent)
      VALUES (${org.id}, ${therapist.id}, 'completed', 'in_person', ${`fb-late-${fixture}`},
              ${lateStart}, ${new Date(lateStart.getTime() + 10 * 60_000)},
              ${new Date(lateStart.getTime() + 50 * 60_000)}, 'granted')
      RETURNING id`);
    await db.execute(sql`
      INSERT INTO transcript_segments (session_id, organization_id, sequence, speaker, text, start_ms, end_ms)
      VALUES (${lateSession.id}, ${org.id}, 1, 'patient', 'I slept badly again this week, and the deadline at work kept me up most nights until three.', 0, 2400000)`);
    const { generateAndStoreNote } = await import("../lib/ai/notes");
    await generateAndStoreNote({
      sessionId: lateSession.id,
      organizationId: org.id,
      therapistId: therapist.id,
      patientId: null,
    });
    const lateNote = await one<{
      summary: string | null;
      summary_en: string | null;
      provenance: string;
      off_record_seconds: number | null;
    } | undefined>(sql`
      SELECT content->>'summary' AS summary, content_en->>'summary' AS summary_en,
             provenance, off_record_seconds
        FROM session_notes WHERE session_id = ${lateSession.id}`);
    check(
      "🔴 W1-30 a late-recorded session's note text carries no recording sentence",
      Boolean(lateNote) &&
        !(lateNote!.summary ?? "").includes("Recording began") &&
        !(lateNote!.summary_en ?? "").includes("Recording began"),
      lateNote ? (lateNote.summary ?? "").slice(0, 90) : "no note written",
    );
    check(
      "W1-30 …and the late start is the note's provenance: partial, ten minutes off record",
      lateNote?.provenance === "partial" && (lateNote?.off_record_seconds ?? 0) >= 600,
      `${lateNote?.provenance}, ${lateNote?.off_record_seconds}s`,
    );

    /* ================================================================ */
    /*  T17 · A SIGNED NOTE IS NOT REGENERATED, NOR FED ANYWHERE ELSE     */
    /* ================================================================ */

    /*
     * W1-03 kept a regeneration off a signed note at the upsert, and the new summary
     * still went on into the copilot thread (`recordSessionNote`) and the rolling
     * profile. The upsert alone leaves the note untouched either way, so what tells
     * the old code from the new is the copilot thread: a session note message per
     * regeneration that went through. The session is given a patient so the thread
     * exists to be written to.
     *
     * CONTROL first: on a DRAFT the same call rewrites the row and does write the
     * thread, so the silence below is about the signature and not a no-op.
     */
    const t17Patient = await one<{ id: string }>(sql`
      INSERT INTO patients (organization_id, therapist_id, first_name, source)
      VALUES (${org.id}, ${therapist.id}, 'Tee Seventeen', 'walk_in')
      RETURNING id`);
    await db.execute(sql`UPDATE sessions SET patient_id = ${t17Patient.id} WHERE id = ${lateSession.id}`);

    const stamp = async () =>
      one<{ updated_at: string; status: string; note_status: string; fed: number }>(sql`
        SELECT n.updated_at::text AS updated_at, n.status, s.note_status,
               (SELECT count(*)::int FROM copilot_messages m
                 WHERE m.session_id = s.id AND m.role = 'session_note') AS fed
          FROM session_notes n JOIN sessions s ON s.id = n.session_id
         WHERE n.session_id = ${lateSession.id}`);
    const regenerate = () =>
      generateAndStoreNote({
        sessionId: lateSession.id,
        organizationId: org.id,
        therapistId: therapist.id,
        patientId: t17Patient.id,
      });

    const draftBefore = await stamp();
    await regenerate();
    const draftAfter = await stamp();
    check(
      "🔴 T17 CONTROL a DRAFT note is rewritten by a regeneration, and its summary reaches the thread",
      draftAfter.updated_at !== draftBefore.updated_at &&
        draftAfter.status === "draft" &&
        draftAfter.fed === draftBefore.fed + 1,
      `${draftBefore.updated_at} then ${draftAfter.updated_at}; thread ${draftBefore.fed} then ${draftAfter.fed}`,
    );

    await db.execute(sql`
      UPDATE session_notes SET status = 'approved', approved_at = now()
       WHERE session_id = ${lateSession.id}`);
    const signedBefore = await stamp();
    await regenerate();
    const signedAfter = await stamp();
    check(
      "🔴 T17 a SIGNED note is left as signed, nothing reaches the thread, and the session reads ready",
      signedAfter.updated_at === signedBefore.updated_at &&
        signedAfter.status === "approved" &&
        signedAfter.note_status === "ready" &&
        signedAfter.fed === signedBefore.fed,
      `${signedBefore.updated_at} then ${signedAfter.updated_at}, ${signedAfter.note_status}; thread ${signedBefore.fed} then ${signedAfter.fed}`,
    );

    /*
     * And the action refuses before it marks the session "generating" or schedules
     * anything, with the note screen's own translated sentence. The action needs a
     * signed-in clinician, so this reads its body; the behaviour is proved above.
     */
    const actionsSource = readSource("app/(app)/sessions/actions.ts");
    const actionStart = actionsSource.indexOf("export async function regenerateNote");
    const regenerateAction =
      actionStart === -1
        ? ""
        : actionsSource.slice(actionStart, actionsSource.indexOf("\n}\n", actionStart));
    check(
      "🔴 T17 regenerateNote refuses a signed note, translated, before marking it generating",
      /refusalText\("locked"/.test(regenerateAction) &&
        regenerateAction.indexOf('refusalText("locked"') < regenerateAction.indexOf('"generating"'),
      regenerateAction ? "refusal precedes the status write" : "regenerateNote not found",
    );

    /* ================================================================ */
    /*  T15 · UPCOMING SOONEST FIRST, PAST MOST RECENT FIRST, PAGED       */
    /*  T18 · A CANCELLED SESSION OPENS ITS PAGE, NOT A VIDEO ROOM        */
    /* ================================================================ */

    /*
     * `/sessions` was the fifty most recently CREATED rows, so next week's booking,
     * made in March, fell off the end. A clinician of their own, so the lists hold
     * only these rows; they are created in an order that is neither of the orders
     * the lists must come back in.
     */
    const t15 = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`t15.${fixture}@example.com`}, 'Tee', 'Fifteen', 'therapist', 'x')
      RETURNING id`);
    const oneDay = 24 * 60 * 60 * 1000;
    const planted: { key: string; status: string; at: Date; ended: Date | null }[] = [
      { key: "in3", status: "scheduled", at: new Date(Date.now() + 3 * oneDay), ended: null },
      { key: "past2", status: "completed", at: new Date(Date.now() - 2 * oneDay), ended: new Date(Date.now() - 2 * oneDay) },
      { key: "in1", status: "scheduled", at: new Date(Date.now() + 1 * oneDay), ended: null },
      { key: "past1", status: "cancelled", at: new Date(Date.now() - 1 * oneDay), ended: null },
      { key: "in2", status: "scheduled", at: new Date(Date.now() + 2 * oneDay), ended: null },
    ];
    const idOf = new Map<string, string>();
    for (const row of planted) {
      const made = await one<{ id: string }>(sql`
        INSERT INTO sessions (organization_id, therapist_id, status, modality, scheduled_at,
                              ended_at, feedback_token)
        VALUES (${org.id}, ${t15.id}, ${row.status}, 'video', ${row.at}, ${row.ended},
                ${`${fixture}-t15-${row.key}`})
        RETURNING id`);
      idOf.set(made.id, row.key);
    }

    const sessionsLib = await import("../lib/data/sessions");
    const t15Actor = { ...actor, userId: t15.id, email: `t15.${fixture}@example.com` };
    const keys = (items: { id: string }[]) => items.map((item) => idOf.get(item.id)).join(",");

    const up0 = await sessionsLib.listSessionsPage(t15Actor, { when: "upcoming", page: 0, pageSize: 2 });
    const up1 = await sessionsLib.listSessionsPage(t15Actor, { when: "upcoming", page: 1, pageSize: 2 });
    const past0 = await sessionsLib.listSessionsPage(t15Actor, { when: "past", page: 0, pageSize: 2 });
    check(
      "🔴 T15 upcoming is soonest first and pages on, past is most recent first",
      keys(up0.items) === "in1,in2" &&
        up0.hasMore &&
        keys(up1.items) === "in3" &&
        !up1.hasMore &&
        keys(past0.items) === "past1,past2" &&
        !past0.hasMore,
      `upcoming ${keys(up0.items)} | ${keys(up1.items)}; past ${keys(past0.items)}`,
    );

    /* CONTROL: the old list, by creation, is in neither order, so the check can tell. */
    const byCreation = await sessionsLib.listSessions(t15Actor, { limit: 5 });
    check(
      "🔴 T15 CONTROL …the list by creation, which `/sessions` used to show, puts the latest-made first",
      keys(byCreation) === "in2,past1,in1,past2,in3",
      keys(byCreation),
    );

    const cancelled = { id: "x", status: "cancelled" };
    check(
      "🔴 T18 a cancelled session opens its own page, and the dashboard asks the same function",
      sessionsLib.sessionHref(cancelled) === "/sessions/x" &&
        /sessionHref\(session\)/.test(readSource("app/(app)/dashboard/page.tsx")) &&
        !/\/room`\s*:/.test(readSource("app/(app)/dashboard/page.tsx")),
      sessionsLib.sessionHref(cancelled),
    );
    check(
      "🔴 T18 CONTROL …while a scheduled one still opens the room",
      sessionsLib.sessionHref({ id: "x", status: "scheduled" }) === "/sessions/x/room",
      sessionsLib.sessionHref({ id: "x", status: "scheduled" }),
    );
  } finally {
    /* T17 writes a copilot thread for its patient; it goes before the patient does. */
    await db.execute(sql`DELETE FROM copilot_messages WHERE thread_id IN
      (SELECT id FROM copilot_threads WHERE organization_id IN
        (SELECT id FROM organizations WHERE slug = ${fixture}))`);
    await db.execute(sql`DELETE FROM copilot_threads WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM session_notes WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM transcript_segments WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    mock.server.close();
    await db.execute(sql`DELETE FROM partner_sessions WHERE external_session_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_consents WHERE external_session_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_subjects WHERE external_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_clinicians WHERE partner_id IN
      (SELECT id FROM partners WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM partner_api_keys WHERE partner_id IN
      (SELECT id FROM partners WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM partners WHERE slug = ${fixture}`);
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
