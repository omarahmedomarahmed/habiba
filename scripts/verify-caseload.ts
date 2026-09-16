/**
 * 🔴 76.36 — A CLINICIAN WHO SAW SOMEBODY HAS A PATIENT.
 *
 *   npm run verify:caseload
 *
 * ## The defect this is named after
 *
 * A therapist ran an offline session with somebody in the room, typed their
 * first name, pressed Start, recorded it, generated the note and signed it.
 * Their Patients tab said **0**.
 *
 * Everything about that session was correct. The room worked, the transcript
 * worked, the note was good. What did not exist was the person: `createSession`
 * created a chart only when there was a phone or an email, and the in-person
 * form asks for neither. So the note was written about `sessions.guest_name`
 * and the caseload counted charts, and the two never met.
 *
 * ## 🔴 WHY SOURCE READING COULD NOT HAVE FOUND IT
 *
 * Every line involved was right. The `if` was deliberate and carried a long
 * comment explaining a ruling from sprint 52 that was made for good reasons:
 * `patients_phone_present` requires a phone on a chart a therapist wrote down,
 * because a chart nobody can reach is a chart nobody can act on, and inventing
 * an unreachable record is worse than having none.
 *
 * What that ruling forgot is the clinician standing in front of somebody. The
 * constraint guards a record nobody can REACH; a walk-in is a record of
 * somebody who was in the room. Different claim, different `source`, and the
 * constraint has no opinion about it.
 *
 * Only a run against rows can tell you the caseload is empty. This is that run.
 *
 * Everything it makes is deleted in a `finally`, and `writesTo()` refuses
 * production by name.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `case${Date.now().toString(36)}`;

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
      VALUES ('Caseload Demo Practice', 'eg', ${fixture}, 'solo') RETURNING id`);

    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`wafaa.${fixture}@example.com`}, 'Wafaa', 'Demo', 'therapist', 'x')
      RETURNING id`);

    const actor = {
      userId: therapist.id,
      organizationId: org.id,
      role: "therapist" as const,
      email: `wafaa.${fixture}@example.com`,
      timezone: "UTC",
    };

    const { createSession } = await import("../lib/data/sessions");
    const { listPatients } = await import("../lib/data/patients");

    /* ================================================================ */
    /*  1 · SOMEBODY IN THE ROOM, WITH A NAME AND NOTHING ELSE           */
    /* ================================================================ */

    /*
     * 🔴 A NAME IS ALL THE IN-PERSON FORM REQUIRES, which is the whole point.
     * The phone is optional on it and the email is labelled optional, because a
     * clinician with a person in front of them is not collecting contact
     * details, they are starting a session.
     */
    const walkIn = await createSession(actor as never, {
      modality: "in_person",
      guestName: "Hassan Demo",
      priceCents: 0,
    } as never);

    check(
      "🔴 76.36 an in-person session with only a name actually starts",
      Boolean(walkIn?.id),
      walkIn?.id ? "the session exists" : "createSession returned nothing",
    );

    const chart = await one<{ id: string; source: string; phone: string | null } | undefined>(sql`
      SELECT id, source, phone FROM patients WHERE organization_id = ${org.id}`);

    check(
      "🔴 76.36 …and it creates a CHART, which for ten sprints it did not",
      Boolean(chart?.id),
      chart?.id
        ? `one chart, source ${chart.source}`
        : "no chart: the clinician saw somebody and their caseload says nobody",
    );

    check(
      "🔴 76.36 …with a source the phone constraint has no opinion about",
      chart?.source === "walk_in" && chart?.phone === null,
      `source ${chart?.source}, phone ${chart?.phone ?? "none"}`,
    );

    /*
     * 🔴 THE CONSTRAINT IS STILL THERE AND STILL MEANS WHAT IT MEANT.
     *
     * The fix is a different `source`, not a relaxed rule. A chart a therapist
     * WROTE DOWN to see later must still carry a phone, and this plants one to
     * watch the database refuse it.
     */
    let refused = false;
    try {
      await db.execute(sql`
        INSERT INTO patients (organization_id, therapist_id, first_name, source)
        VALUES (${org.id}, ${therapist.id}, 'Planted', 'therapist')`);
    } catch {
      refused = true;
    }

    check(
      "🔴 CONTROL a `therapist` chart with no phone is still refused by the database",
      refused,
      "the constraint guards reachability and this fix did not weaken it",
    );

    /* ================================================================ */
    /*  2 · AND THE CASELOAD SAYS ONE                                    */
    /* ================================================================ */

    const listed = await listPatients(actor as never);

    check(
      "🔴 76.36 the Patients tab shows the person the clinician just saw",
      listed.length === 1 && listed[0]?.firstName === "Hassan",
      `${listed.length} patients: ${listed.map((row) => row.firstName).join(", ") || "none"}`,
    );

    const attached = await one<{ attached: boolean }>(sql`
      SELECT patient_id IS NOT NULL AS attached FROM sessions WHERE organization_id = ${org.id}`);

    /*
     * 🔴 AND THE SESSION IS ATTACHED TO IT, which is what makes the next one
     * land in the same record. An unattached session is a note about a stranger
     * every time, and a profile and a copilot with nothing to accumulate
     * against.
     */
    check(
      "🔴 76.36 …and the session hangs off that chart rather than off a name",
      attached.attached === true,
      attached.attached ? "session.patient_id is set" : "the session knows a name and not a person",
    );

    /* ================================================================ */
    /*  3 · THE OTHER TWO SOURCES STILL BEHAVE                           */
    /* ================================================================ */

    const withPhone = await createSession(actor as never, {
      modality: "in_person",
      guestName: "Salma Demo",
      guestPhone: "+201009000042",
      priceCents: 0,
    } as never);

    const phoned = await one<{ source: string }>(sql`
      SELECT source FROM patients WHERE organization_id = ${org.id} AND first_name = 'Salma'`);

    check(
      "🔴 a walk-in WITH a number is an ordinary written-down patient",
      Boolean(withPhone?.id) && phoned.source === "therapist",
      `source ${phoned.source}`,
    );

    const withEmail = await createSession(actor as never, {
      modality: "video",
      guestName: "Nour Demo",
      guestEmail: `nour.${fixture}@example.com`,
      priceCents: 0,
    } as never);

    const emailed = await one<{ source: string }>(sql`
      SELECT source FROM patients WHERE organization_id = ${org.id} AND first_name = 'Nour'`);

    check(
      "🔴 …and one with only an email is `join_link`, which is what sprint 52 already allowed",
      Boolean(withEmail?.id) && emailed.source === "join_link",
      `source ${emailed.source}`,
    );

    const total = await listPatients(actor as never);
    check(
      "🔴 three sessions, three people, and the caseload counts all three",
      total.length === 3,
      `${total.length} patients`,
    );
  } finally {
    await db.execute(sql`DELETE FROM sessions WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM patients WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("the caseload");
}

main();
