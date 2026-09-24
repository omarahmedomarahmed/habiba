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
  } finally {
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
