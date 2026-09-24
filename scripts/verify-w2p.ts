/**
 * 🔴 WAVE 2, THE PATIENT: EVERY DEAD END GETS A WAY FORWARD.
 *
 *   npm run verify:w2p
 *
 * One section per item in `takeover/FIX-PLAN.md` that needs rows to prove.
 * The ones that do not are in `tests/patient-stuck.test.ts`. Each was written
 * to fail on the code before its fix.
 *
 * Everything it makes is deleted in a `finally`, and `writesTo()` refuses
 * production by name.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `w2p${Date.now().toString(36)}`;

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
      VALUES ('Wave 2 Patient Demo Practice', 'eg', ${fixture}, 'solo') RETURNING id`);

    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`salma.${fixture}@example.com`}, 'Salma', 'Demo', 'therapist', 'x')
      RETURNING id`);

    const person = await one<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, email)
      VALUES ('Laila', 'Demo', ${`laila.${fixture}@example.com`}) RETURNING id`);

    const account = await one<{ id: string }>(sql`
      INSERT INTO patient_accounts (person_id, phone)
      VALUES (${person.id}, ${`+2010${String(Date.now()).slice(-8)}`}) RETURNING id`);

    /* ================================================================ */
    /*  W2-P03 · AN EMAIL CAN BE ADDED, AND ONLY ONCE IT IS PROVED       */
    /* ================================================================ */

    const { issueEmailCode, confirmEmailCode } = await import("../lib/patient-auth/email");
    const address = `laila.${fixture}@example.com`;

    const issued = await issueEmailCode(account.id, address);
    const before = await one<{ email: string | null }>(sql`
      SELECT email FROM patient_accounts WHERE id = ${account.id}`);
    check(
      "W2-P03 asking for a code writes no address yet, so nobody can park a stranger's",
      issued.ok && issued.code !== null && before.email === null,
      `issued=${issued.ok}, email=${before.email}`,
    );

    const code = issued.ok ? (issued.code ?? "") : "";
    const elsewhere = await confirmEmailCode(account.id, `someone.${fixture}@example.com`, code);
    check(
      "🔴 W2-P03 CONTROL the right code for a DIFFERENT address writes nothing",
      !elsewhere.ok,
      elsewhere.ok ? "IT WROTE AN ADDRESS NOBODY PROVED" : "refused",
    );

    const proved = await confirmEmailCode(account.id, address, code);
    const after = await one<{ email: string | null; verified: boolean }>(sql`
      SELECT email, email_verified_at IS NOT NULL AS verified FROM patient_accounts
       WHERE id = ${account.id}`);
    check(
      "🔴 W2-P03 the code and the address together add it, verified",
      proved.ok && after.email === address && after.verified,
      `email=${after.email}, verified=${after.verified}`,
    );

    /* ================================================================ */
    /*  W2-P04 · A SESSION A SIGNED-IN PATIENT BOOKS IS THEIRS           */
    /* ================================================================ */

    const personOf = async (sessionId: string) =>
      one<{ person: string | null }>(sql`
        SELECT p.person_id AS person FROM sessions s
          LEFT JOIN patients p ON p.id = s.patient_id WHERE s.id = ${sessionId}`);

    const joinable = async (label: string) =>
      one<{ id: string; token: string }>(sql`
        INSERT INTO sessions (organization_id, therapist_id, status, modality, feedback_token,
                              join_token, join_token_expires_at, session_type)
        VALUES (${org.id}, ${therapist.id}, 'scheduled', 'video', ${`fb-${label}-${fixture}`},
                ${`jt-${label}-${fixture}`}, now() + interval '3 hours', 'radar')
        RETURNING id, join_token AS token`);

    const { joinByToken } = await import("../lib/data/sessions");

    const stranger = await joinable("stranger");
    await joinByToken(stranger.token, "Laila");
    const strangerPerson = await personOf(stranger.id);
    check(
      "W2-P04 CONTROL a guest with no account still gets a person of their own",
      strangerPerson.person !== null && strangerPerson.person !== person.id,
      "the stranger path is unchanged",
    );

    const mine = await joinable("mine");
    await joinByToken(mine.token, "Laila", person.id);
    const minePerson = await personOf(mine.id);
    check(
      "🔴 W2-P04 a signed-in patient joining a link is attached to THEIR person, not a new one",
      minePerson.person === person.id,
      `session person ${minePerson.person === person.id ? "is theirs" : "is a stranger"}`,
    );

    const again = await joinable("again");
    await joinByToken(again.token, "Laila", person.id);
    const files = await one<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM patients
       WHERE person_id = ${person.id} AND therapist_id = ${therapist.id}`);
    check(
      "W2-P04 the second booking with the same clinician reuses their file",
      files.n === 1,
      `${files.n} files`,
    );

    const slot = await one<{ id: string }>(sql`
      INSERT INTO availability_slots (therapist_user_id, organization_id, starts_at, status)
      VALUES (${therapist.id}, ${org.id}, date_trunc('hour', now()) + interval '3 days', 'open')
      RETURNING id`);
    const { bookSlot } = await import("../lib/data/scheduling");
    const booked = await bookSlot({
      slotId: slot.id,
      patientName: "Laila",
      patientEmail: `typed.${fixture}@example.com`,
      personId: person.id,
      accountId: account.id,
    });
    const bookedPerson = booked.ok ? await personOf(booked.sessionId) : { person: null };
    check(
      "🔴 W2-P04 an hour a signed-in patient books from a profile is on their own person",
      booked.ok && bookedPerson.person === person.id,
      booked.ok ? `person ${bookedPerson.person === person.id ? "is theirs" : "is a stranger"}` : booked.error,
    );

    const { sessionsForPatient } = await import("../lib/data/patient-view");
    const listed = await sessionsForPatient(person.id);
    check(
      "W2-P04 …and all three appear on their own sessions list",
      [mine.id, again.id, booked.ok ? booked.sessionId : ""].every((id) =>
        listed.some((row) => row.id === id),
      ),
      `${listed.length} on the list`,
    );

    /* ================================================================ */
    /*  W2-P06 / W2-P14 · A CARD OPENS SOMETHING, AND WHAT IS OWED SHOWS */
    /* ================================================================ */

    const own = await one<{ id: string }>(sql`
      SELECT id FROM patients WHERE person_id = ${person.id} AND therapist_id = ${therapist.id}`);
    const owed = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            feedback_token, join_token, join_token_expires_at,
                            price_cents, payment_status)
      VALUES (${org.id}, ${therapist.id}, ${own.id}, 'scheduled', 'video', ${`fb-owed-${fixture}`},
              ${`jt-owed-${fixture}`}, now() + interval '3 hours', 2000, 'pending')
      RETURNING id`);
    const checking = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            feedback_token, join_token, join_token_expires_at,
                            price_cents, payment_status)
      VALUES (${org.id}, ${therapist.id}, ${own.id}, 'scheduled', 'video', ${`fb-chk-${fixture}`},
              ${`jt-chk-${fixture}`}, now() + interval '3 hours', 2000, 'pending')
      RETURNING id`);
    await db.execute(sql`
      INSERT INTO manual_payments (purpose, ref_id, amount_cents, settles_cents, payer_kind,
                                   organization_id, state, reference, submitted_at)
      VALUES ('session', ${checking.id}, 100000, 2000, 'session', ${org.id}, 'submitted',
              ${`ref-${fixture}`}, now())`);

    const { sessionDoors } = await import("../lib/data/patient-view");
    const doors = await sessionDoors(person.id);
    const doorOf = (id: string) => doors.find((row) => row.sessionId === id)?.door?.kind ?? "none";
    check(
      "🔴 W2-P06 an unpaid session's card opens the payment, a submitted transfer's says it is being checked",
      doorOf(owed.id) === "pay" && doorOf(checking.id) === "checking" && doorOf(mine.id) === "join",
      `owed=${doorOf(owed.id)}, transfer=${doorOf(checking.id)}, free=${doorOf(mine.id)}`,
    );

    /* ================================================================ */
    /*  W2-P07 · AN APPROVED NUMBER CHANGE CAN BE FINISHED               */
    /* ================================================================ */

    const { hashPassword } = await import("../lib/auth/password");
    const oldPhone = (
      await one<{ phone: string }>(sql`SELECT phone FROM patient_accounts WHERE id = ${account.id}`)
    ).phone;
    const newPhone = `+2011${String(Date.now()).slice(-8)}`;
    await db.execute(sql`
      INSERT INTO phone_change_requests (patient_account_id, old_phone, new_phone, reason,
                                         contact_consent, status, approved_by_user_id,
                                         verification_hash, verification_expires_at)
      VALUES (${account.id}, ${oldPhone}, ${newPhone}, 'Lost the old phone on holiday', true,
              'verifying', ${therapist.id}, ${await hashPassword("424242")},
              now() + interval '1 day')`);

    const { awaitingChangeCode, completeOwnChange } = await import("../lib/data/phone-change");
    const waiting = await awaitingChangeCode(account.id);
    const wrongCode = await completeOwnChange({ accountId: account.id, code: "111111" });
    const moved = await completeOwnChange({ accountId: account.id, code: "424242" });
    const nowPhone = await one<{ phone: string }>(sql`
      SELECT phone FROM patient_accounts WHERE id = ${account.id}`);
    check(
      "🔴 W2-P07 the patient's own code finishes the approved change, and a wrong one does not",
      waiting && Boolean(wrongCode.error) && moved.ok === true && nowPhone.phone === newPhone,
      `waiting=${waiting}, wrong=${wrongCode.error ? "refused" : "ACCEPTED"}, moved=${moved.ok}`,
    );

    /* ================================================================ */
    /*  W2-P08 · A PAUSED BENEFIT CAN BE CONFIRMED AGAIN                 */
    /* ================================================================ */

    const sponsor = await one<{ id: string }>(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES (${`W2P Demo Foundry ${fixture}`}, 'company', 'eg', 'EGP', 'active') RETURNING id`);
    const { hashIdentifier, reconfirmEnrolment } = await import("../lib/data/enrolment");
    const paused = await one<{ id: string }>(sql`
      INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash,
                              identifier_kind, last_verified_at, paused_at)
      VALUES (${sponsor.id}, ${person.id}, 'active', true,
              ${hashIdentifier(sponsor.id, "EMP-40417")}, 'id_number', now() - interval '200 days', now())
      RETURNING id`);

    const guessed = await reconfirmEnrolment({
      personId: person.id,
      enrolmentId: paused.id,
      identifier: "EMP-99999",
    });
    const stillPaused = await one<{ paused: boolean }>(sql`
      SELECT paused_at IS NOT NULL AS paused FROM enrolments WHERE id = ${paused.id}`);
    check(
      "🔴 W2-P08 CONTROL a value that is not what enrolled them restarts nothing",
      !guessed.ok && stillPaused.paused,
      guessed.ok ? "IT UNPAUSED ON A GUESS" : "refused, still paused",
    );

    const borrowed = await reconfirmEnrolment({
      personId: strangerPerson.person!,
      enrolmentId: paused.id,
      identifier: "EMP-40417",
    });
    check(
      "W2-P08 CONTROL …and the right value from somebody else's session restarts nothing",
      !borrowed.ok,
      borrowed.ok ? "A BORROWED ENROLMENT ID WORKED" : "refused",
    );

    const again2 = await reconfirmEnrolment({
      personId: person.id,
      enrolmentId: paused.id,
      identifier: "EMP-40417",
    });
    const restarted = await one<{ paused: boolean }>(sql`
      SELECT paused_at IS NOT NULL AS paused FROM enrolments WHERE id = ${paused.id}`);
    check(
      "🔴 W2-P08 the paused person types what enrolled them and the benefit restarts",
      again2.ok && !restarted.paused,
      `ok=${again2.ok}, paused=${restarted.paused}`,
    );

    /* ================================================================ */
    /*  W2-P10 · THE SUMMARY IS NOT HELD BEHIND A RATING OR AN ADDRESS   */
    /* ================================================================ */

    const { feedbackContext, submitFeedback } = await import("../lib/data/feedback");
    const rated = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, status, modality, feedback_token, ended_at)
      VALUES (${org.id}, ${therapist.id}, 'completed', 'video', ${`fb-rated-${fixture}`}, now())
      RETURNING id`);
    await db.execute(sql`
      INSERT INTO session_notes (session_id, organization_id, therapist_id, content, status,
                                 patient_status, patient_approved_at, patient_approved_by)
      VALUES (${rated.id}, ${org.id}, ${therapist.id},
              ${JSON.stringify({ summary: "", patientBrief: "What you worked on today" })}::jsonb,
              'approved', 'approved', now(), ${therapist.id})`);

    const unrated = await feedbackContext(`fb-rated-${fixture}`);
    check(
      "🔴 W2-P10 a signed summary is there for a patient who has rated nothing",
      unrated?.done === false && unrated?.brief === "What you worked on today",
      `done=${unrated?.done}, brief=${unrated?.brief ? "present" : "absent"}`,
    );

    const noAddress = await submitFeedback({
      token: `fb-rated-${fixture}`,
      therapistStars: 4,
      sessionStars: 5,
      serviceStars: 4,
      therapistTags: [],
      serviceTags: [],
      comment: "",
      email: "",
    });
    const stored = await one<{ email: string | null; stars: number | null }>(sql`
      SELECT patient_email AS email, therapist_stars AS stars FROM session_feedback
       WHERE session_id = ${rated.id}`);
    check(
      "🔴 W2-P10 a rating with no address is kept, and no address is invented for it",
      noAddress.ok === true && stored?.stars === 4 && stored.email === null,
      noAddress.error ?? `stars=${stored?.stars}, email=${stored?.email}`,
    );

    /* ================================================================ */
    /*  W2-P12 · AN EMPTY RADAR OFFERS THE FIRST HOUR, NOT A DEAD END    */
    /* ================================================================ */

    const cleared = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`hana.${fixture}@example.com`}, 'Hana', 'Demo', 'therapist', 'x')
      RETURNING id`);
    await db.execute(sql`
      INSERT INTO therapist_verifications (user_id, organization_id, state, country, license_body,
                                           license_number, submitted_at, reviewed_at)
      VALUES (${cleared.id}, ${org.id}, 'approved', 'EG', 'Egyptian Psychological Association',
              ${`DEMO-${fixture}`}, now(), now())`);
    /* Soonest of all, so it is on the list whatever else dev holds. */
    await db.execute(sql`
      INSERT INTO availability_slots (therapist_user_id, organization_id, starts_at, status)
      VALUES (${cleared.id}, ${org.id}, date_trunc('hour', now()) + interval '1 hour', 'open'),
             (${therapist.id}, ${org.id}, date_trunc('hour', now()) + interval '1 hour', 'open')`);

    const { firstOpenHours } = await import("../lib/data/scheduling");
    const hours = await firstOpenHours(50);
    check(
      "🔴 W2-P12 a cleared clinician's next open hour is offered when nobody is on shift",
      hours.some((hour) => hour.therapistUserId === cleared.id),
      `${hours.length} offered`,
    );
    check(
      "W2-P12 CONTROL …and an uncleared clinician's is not, the same rule as their own calendar",
      !hours.some((hour) => hour.therapistUserId === therapist.id),
      "uncleared left out",
    );

    /* ================================================================ */
    /*  W2-P13 · THE WALL CODE CONNECTS THE ACCOUNT TO ITS CLINICIAN     */
    /* ================================================================ */

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const wall = () =>
      Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    const live = wall();
    const retired = wall();
    await db.execute(sql`
      INSERT INTO therapist_codes (code, user_id, organization_id, revoked_at)
      VALUES (${live}, ${cleared.id}, ${org.id}, NULL), (${retired}, ${therapist.id}, ${org.id}, now())`);
    const scanner = await one<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, email)
      VALUES ('Omar', 'Demo', ${`omar.${fixture}@example.com`}) RETURNING id`);

    const { connectByCode } = await import("../lib/data/therapist-codes");
    const joined = await connectByCode(live.toLowerCase(), scanner.id);
    const refused = await connectByCode(retired, scanner.id);
    const files2 = await one<{ live: number; retired: number }>(sql`
      SELECT COUNT(*) FILTER (WHERE therapist_id = ${cleared.id})::int AS live,
             COUNT(*) FILTER (WHERE therapist_id = ${therapist.id})::int AS retired
        FROM patients WHERE person_id = ${scanner.id}`);
    check(
      "🔴 W2-P13 scanning a live wall code connects the person to that clinician",
      joined.ok && files2.live === 1,
      `ok=${joined.ok}, files=${files2.live}`,
    );
    check(
      "W2-P13 CONTROL …and a revoked code connects nobody",
      !refused.ok && files2.retired === 0,
      `ok=${refused.ok}, files=${files2.retired}`,
    );

    /* ================================================================ */
    /*  W2-P15 · E5: A BENEFIT THAT DID NOT PAY SAYS WHO TO ASK          */
    /* ================================================================ */

    const { benefitShortfall } = await import("../lib/billing/pot");
    /* `paused` was restarted by W2-P08 above, so this person has a live benefit. */
    const unfunded = await benefitShortfall(owed.id);
    await db.execute(sql`UPDATE enrolments SET paused_at = now() WHERE id = ${paused.id}`);
    const pausedNow = await benefitShortfall(owed.id);
    const nothingOwed = await benefitShortfall(mine.id);
    check(
      "🔴 W2-P15 an unpaid session of a covered employee names who to ask, and a paused benefit says so",
      unfunded?.state === "unfunded" &&
        unfunded.sponsorName === `W2P Demo Foundry ${fixture}` &&
        pausedNow?.state === "paused",
      `live=${unfunded?.state}, paused=${pausedNow?.state}`,
    );
    check(
      "W2-P15 CONTROL …and a session with nothing owed says nothing",
      nothingOwed === null,
      String(nothingOwed),
    );
  } finally {
    await db.execute(sql`DELETE FROM therapist_codes WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM therapist_verifications WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM session_feedback WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM session_notes WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM enrolment_verifications WHERE enrolment_id IN
      (SELECT id FROM enrolments WHERE sponsor_id IN
        (SELECT id FROM sponsors WHERE name = ${`W2P Demo Foundry ${fixture}`}))`);
    await db.execute(sql`DELETE FROM enrolments WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name = ${`W2P Demo Foundry ${fixture}`})`);
    await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE name = ${`W2P Demo Foundry ${fixture}`})`);
    await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name = ${`W2P Demo Foundry ${fixture}`})`);
    await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name = ${`W2P Demo Foundry ${fixture}`})`);
    await db.execute(sql`DELETE FROM sponsors WHERE name = ${`W2P Demo Foundry ${fixture}`}`);
    await db.execute(sql`DELETE FROM phone_change_requests WHERE patient_account_id IN
      (SELECT id FROM patient_accounts WHERE person_id IN
        (SELECT id FROM people WHERE email LIKE ${`%${fixture}@example.com`}))`);
    await db.execute(sql`DELETE FROM manual_payments WHERE reference = ${`ref-${fixture}`}`);
    await db.execute(sql`DELETE FROM availability_slots WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM sessions WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    /* The people a guest join made have no address to find them by, only their file. */
    const { rows: made } = await db.execute(sql`
      SELECT DISTINCT person_id AS id FROM patients WHERE person_id IS NOT NULL AND organization_id IN
        (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM patients WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM patient_accounts WHERE person_id IN
      (SELECT id FROM people WHERE email LIKE ${`%${fixture}@example.com`})`);
    for (const row of made as { id: string }[]) {
      /* Only a person no account owns: nothing outside this fixture is touched. */
      await db.execute(sql`DELETE FROM people WHERE id = ${row.id} AND NOT EXISTS
        (SELECT 1 FROM patient_accounts WHERE person_id = ${row.id})`);
    }
    await db.execute(sql`DELETE FROM people WHERE email LIKE ${`%${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("wave 2, the patient");
}

main();
