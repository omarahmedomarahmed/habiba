/**
 * Sprint 76 acceptance: the door is open, and the patient is told once.
 *
 *   npm run verify:sprint76
 *
 * ## What 76.17 changed
 *
 * A patient booked a session and then had no way to know it had begun. The
 * product's only "before a session" message was the reminders cron, which runs
 * hourly at twenty past, so a nine o'clock session would be announced at twenty
 * past nine. That is not an alert, it is an apology.
 *
 * So the alert hangs off the TRANSITION instead: the instant a clinician moves
 * a session out of `scheduled` is the instant there is a room to walk into.
 *
 * ## 🔴 AND THAT PUT A MESSAGE ON A PATH THAT WAS ONLY IDEMPOTENT BY ACCIDENT
 *
 * `startSession` read the status and then wrote it, in two statements. Two taps
 * or two tabs both passed the read, and the second write simply set the same
 * status again — harmless while nothing was watching, and a second buzz on
 * somebody's phone the moment something was. A patient's phone buzzing twice
 * about one session is how a person learns to ignore the buzz, and this is the
 * one message on this product worth interrupting them for.
 *
 * The transition is atomic now and `returning` says who won. These checks prove
 * that against a real row rather than against the source, because sprint 74's
 * lesson was that all three defects it found were true of the source and false
 * of the database.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `verify76-${Date.now().toString(36)}`;

async function main() {
  writesTo();

  /* ================================================================== */
  /*  76.17 · READ FIRST, because the source says what it intends        */
  /* ================================================================== */

  const starter = readSource("lib/data/sessions.ts");

  check(
    "🔴 starting a session is one atomic statement, and the status is in the WHERE",
    /eq\(sessions\.status, "scheduled"\)/.test(starter) &&
      /\.returning\(\{ id: sessions\.id \}\)/.test(starter) &&
      /if \(started\.length === 0\) return;/.test(starter),
    "a read-then-write lets two taps both pass, and a message rides out on the second",
  );

  check(
    "🔴 …and the alert is awaited rather than fired and forgotten",
    /await noticeSessionStarted\(sessionId\)/.test(starter),
    "a server action's un-awaited work is cut off with the response, and this one has to arrive",
  );

  const notice = readSource("lib/sessions/started-notice.ts");

  check(
    "🔴 the link a patient is sent is the JOIN token, never the clinician's page",
    /\/join\/\$\{row\.joinToken\}/.test(notice) && !/\/sessions\/\$\{/.test(notice),
    "a patient sent to /sessions/<id> meets a sign in wall, and this rail exists so they never need one",
  );

  check(
    "🔴 …and a failed message can never fail a session",
    /try \{/.test(notice) && /catch \(error\)/.test(notice),
    "the room is open by the time this runs: throwing would strand a clinician with a patient waiting",
  );

  check(
    "🔴 …and the kind is registered on BOTH sides, so it can leave by either channel",
    /"session\.started"/.test(readSource("lib/notify/index.ts")) &&
      /* Task 40: the templates moved to their own catalog, with both languages. */
      /"session\.started": \{\s*name: "session_started",\s*category: "utility",\s*variables: 1,/.test(
        readSource("lib/notify/templates.ts"),
      ),
    "an unregistered kind does not typecheck; an untemplated one quietly drops to email only",
  );

  /*
   * 🔴 THE BANNER CANNOT COVER THE SOS ORB, and it cannot by construction
   * rather than by agreeing about a z-index. C235: a patient's crisis path
   * never depends on anything else being out of the way.
   */
  const banner = readSource("components/patient/session-started.tsx");
  check(
    "🔴 the in-app alert is in the page flow, so it cannot cover the crisis orb",
    /* W1-09 moved the orb from z-70 to z-300; the orb is still pinned, whatever its layer. */
    !/fixed |z-\[/.test(banner) && /fixed z-\[\d+\]/.test(readSource("components/patient/sos-orb.tsx")),
    "the orb is pinned to a corner and this is a strip at the top: they cannot overlap",
  );

  check(
    "🔴 CONTROL the same scan would catch a banner that pinned itself over the screen",
    /fixed |z-\[/.test('<div className="fixed inset-0 z-[80]">') &&
      !/fixed |z-\[/.test('<span className="absolute inset-0 animate-ping" />'),
    "an absence assertion is worth nothing until it is watched finding something",
  );

  /* ================================================================== */
  /*  AND NOW AGAINST REAL ROWS                                          */
  /* ================================================================== */

  const { db, pool } = connect();
  const made: string[] = [];

  try {
    const { rows: orgRows } = await db.execute<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug)
      VALUES ('Sprint 76 Demo', 'eg', ${fixture})
      RETURNING id
    `);

    const { rows: therapistRows } = await db.execute<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${orgRows[0]!.id}, ${`mona.${fixture}@example.com`}, 'Mona', 'Demo', 'therapist', 'x')
      RETURNING id
    `);

    const { rows: personRows } = await db.execute<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, region)
      VALUES ('Nour', 'Demo', 'eg') RETURNING id
    `);

    const { rows: patientRows } = await db.execute<{ id: string }>(sql`
      INSERT INTO patients (organization_id, person_id, first_name, last_name, email, phone, source)
      VALUES (${orgRows[0]!.id}, ${personRows[0]!.id}, 'Nour', 'Demo', ${`nour.${fixture}@example.com`}, '+201000000001', 'self')
      RETURNING id
    `);

    const { rows: sessionRows } = await db.execute<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality, join_token, feedback_token, scheduled_at)
      VALUES (${orgRows[0]!.id}, ${therapistRows[0]!.id}, ${patientRows[0]!.id}, 'scheduled', 'video', ${`join-${fixture}`}, ${`fb-${fixture}`}, now() + interval '1 minute')
      RETURNING id
    `);
    made.push(sessionRows[0]!.id);

    /*
     * 🔴 THE TRANSITION ITSELF, run the way `startSession` runs it, twice.
     *
     * Not a call into `startSession` — that needs an Actor and a scope, and
     * what is being proved is the DATABASE's behaviour: that the second
     * statement matches nothing, which is what makes the second message
     * impossible rather than unlikely.
     */
    const { rows: first } = await db.execute<{ id: string }>(sql`
      UPDATE sessions SET status = 'in_progress', started_at = now()
      WHERE id = ${sessionRows[0]!.id} AND status = 'scheduled'
      RETURNING id
    `);
    const { rows: second } = await db.execute<{ id: string }>(sql`
      UPDATE sessions SET status = 'in_progress', started_at = now()
      WHERE id = ${sessionRows[0]!.id} AND status = 'scheduled'
      RETURNING id
    `);

    check(
      "🔴 the first Start moves the row and the second matches nothing",
      first.length === 1 && second.length === 0,
      `first ${first.length} row, second ${second.length} rows: one alert, whatever anybody taps`,
    );

    /*
     * 🔴 CONTROL: the same two statements WITHOUT the status guard, which is
     * what this path did until this sprint. Both match, so both would have
     * sent. An absence assertion is worth nothing until the offender is
     * planted and seen.
     */
    await db.execute(sql`UPDATE sessions SET status = 'scheduled' WHERE id = ${sessionRows[0]!.id}`);
    const { rows: loose1 } = await db.execute<{ id: string }>(sql`
      UPDATE sessions SET status = 'in_progress' WHERE id = ${sessionRows[0]!.id} RETURNING id
    `);
    const { rows: loose2 } = await db.execute<{ id: string }>(sql`
      UPDATE sessions SET status = 'in_progress' WHERE id = ${sessionRows[0]!.id} RETURNING id
    `);

    check(
      "🔴 CONTROL without the guard BOTH statements match, which is the old behaviour",
      loose1.length === 1 && loose2.length === 1,
      "two rows moved where one should have: the buzz a patient learns to ignore",
    );

    /*
     * 🔴 AND THE BANNER READS THE SAME FACT, through the patient's own query.
     */
    const { liveSessionForPatient } = await import("../lib/data/patient-view");
    const live = await liveSessionForPatient(personRows[0]!.id);

    check(
      "🔴 a live session gives the patient a door, and it is a join link",
      live !== null && live.href === `/join/join-${fixture}`,
      live ? live.href : "no door offered while a session is in progress",
    );

    await db.execute(
      sql`UPDATE sessions SET status = 'completed', ended_at = now() WHERE id = ${sessionRows[0]!.id}`,
    );
    const after = await liveSessionForPatient(personRows[0]!.id);

    check(
      "🔴 CONTROL and a session that has ended offers none",
      after === null,
      "a banner outliving its room invites somebody into a call that finished",
    );

    /* 🔴 §6 HELD: the patient's live query reaches no clinical column. */
    const view = readSource("lib/data/patient-view.ts");
    const liveQuery = view.split("export async function liveSessionForPatient")[1]?.split("export ")[0] ?? "";
    check(
      "🔴 …and it reads no note, no transcript and no assessment to do it",
      liveQuery.length > 0 && !/sessionNotes|transcript|assessment|soap|summary/.test(liveQuery),
      "§6 is the select list, and a new patient query is a new place to widen one",
    );
  } finally {
    if (made.length) {
      await db.execute(sql`DELETE FROM sessions WHERE id IN (${sql.join(made.map((id) => sql`${id}`), sql`, `)})`);
    }
    await db.execute(sql`DELETE FROM patients WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM people WHERE first_name = 'Nour' AND last_name = 'Demo' AND id NOT IN (SELECT person_id FROM patients WHERE person_id IS NOT NULL)`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("sprint 76");
}

main();
