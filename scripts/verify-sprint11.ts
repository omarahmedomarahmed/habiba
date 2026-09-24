/**
 * Sprint 11 acceptance, against the real database.
 *
 *   npm run verify:sprint11
 *
 * The arithmetic is tested pure in `tests/scheduling.test.ts`. What this checks
 * is what only the database can answer: that a 19:15 slot **cannot be
 * inserted**, that two patients racing for one hour produce one winner, and
 * that a clinician inside a booked window disappears from the radar's own
 * reachability predicate rather than from a component.
 *
 * It writes. Everything is tagged `verify11-` and removed in the `finally`.
 */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { connect, schema } from "./db";

const { availabilitySlots, patients, people, sessions } = schema;

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? `, ${detail}` : ""}`);
  if (!ok) failures += 1;
};
const skip = (name: string, why: string) => console.log(`  --   ${name}, NOT EXERCISED: ${why}`);

const TAG = `verify11-${randomUUID().slice(0, 8)}`;
/** Far enough out that nothing real is near it. */
const HOUR = new Date("2031-03-04T19:00:00.000Z");

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";
  console.log(`writing to ${host}\n`);
  // `ep-wild-lake-a6tgm2r6` is production. Refused by name.
  if (host.includes("ep-wild-lake-a6tgm2r6")) {
    console.error("Refusing to run: that is the production endpoint.");
    process.exit(1);
  }
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const { pool, db } = connect();
  let slotId: string | null = null;

  try {
    /* -------------------------------------------------------- the schema -- */

    const [cols] = await db
      .execute<{ n: number }>(
        sql`SELECT COUNT(*)::int AS n FROM information_schema.columns
             WHERE table_schema='public' AND table_name='availability_slots'`,
      )
      .then((r) => r.rows);
    // 13 since 11R.6, not 12: `reminded_at` (migration 0040) replaced the
    // ` [reminded]` marker that used to be appended to the patient's own note.
    check("11.1 availability_slots exists with 13 columns", cols?.n === 13, `${cols?.n}`);

    const [scheduled] = await db
      .execute<{ n: number }>(
        sql`SELECT COUNT(*)::int AS n FROM information_schema.columns
             WHERE table_schema='public' AND table_name='sessions' AND column_name='scheduled_at'`,
      )
      .then((r) => r.rows);
    check("11.2 / C57 sessions.scheduled_at exists", scheduled?.n === 1);

    const [check_] = await db
      .execute<{ n: number }>(
        sql`SELECT COUNT(*)::int AS n FROM pg_constraint
             WHERE conrelid='availability_slots'::regclass AND conname='availability_slots_whole_hour'`,
      )
      .then((r) => r.rows);
    check("11.1 the whole-hour CHECK constraint exists", check_?.n === 1);

    /*
     * Deliberately not backfilled. Every session that predates `0039_scheduling`
     * came off the radar or a join link and was unplanned by definition; writing
     * a scheduled time onto them would invent appointments nobody made — and
     * sprint 12 reads exactly the gap between `scheduled_at` and `started_at` to
     * decide whether somebody turned up.
     *
     * 🔴 76.64 — SCOPED TO THOSE SESSIONS, BECAUSE IT USED TO COUNT ALL OF THEM.
     *
     * This was `COUNT(scheduled_at) FROM sessions` with no window, so it asserted
     * that NO session anywhere is ever scheduled. That was true the day sprint 11
     * shipped and is false of the product it describes: scheduling an appointment
     * is a feature now, and eight other verifiers plant a scheduled session and
     * remove it in a `finally`.
     *
     * It went red in a full pass reporting "2 of 10" while the database held 8
     * sessions and none scheduled by the time anybody looked — two fixtures, alive
     * for the seconds the count ran. The message names a backfill that never
     * happened, which is the wrong diagnosis rather than a flaky one, and H29's
     * rule says it out loud: never a sum over whatever is there.
     *
     * The window is DERIVED from the ledger, not typed here, so it stays correct
     * if the migration is ever renumbered (H41).
     */
    const [applied] = await db
      .execute<{ when: string }>(
        sql`SELECT created_at::text AS when FROM drizzle.__drizzle_migrations
             WHERE id = (SELECT MIN(id) FROM drizzle.__drizzle_migrations) + 39`,
      )
      .then((r) => r.rows);

    /*
     * 🔴 78.5 — THE OLD SESSION IS PLANTED, BECAUSE THE DATABASE STOPPED
     * HAVING ONE.
     *
     * The control below exists because a window matching nothing also reports
     * zero. It was satisfied by whatever pre-migration sessions happened to be
     * lying around, and `seed:demo` wiped them: every session on the branch is
     * now newer than migration 40, the window matches nothing, the check above
     * passes vacuously and the control says so.
     *
     * The control was right and the arrangement was wrong. A check that depends
     * on the database happening to hold an old row is a check that goes quiet
     * the first time anybody cleans up, and it goes quiet by PASSING. So the
     * window is filled here: one session written with `created_at` a day before
     * the migration and no `scheduled_at`, which is exactly what an unplanned
     * radar session from before sprint 11 looks like.
     */
    const window = Number(applied?.when ?? 0);
    const [host] = await db
      .execute<{ id: string; org: string }>(
        sql`SELECT id, organization_id AS org FROM users WHERE deleted_at IS NULL LIMIT 1`,
      )
      .then((r) => r.rows);

    let plantedOld: string | null = null;
    try {
      if (host && window > 0) {
        const [row] = await db
          .execute<{ id: string }>(
            sql`INSERT INTO sessions
                  (organization_id, therapist_id, status, modality, join_token, feedback_token,
                   created_at, scheduled_at)
                VALUES (${host.org}, ${host.id}, 'completed', 'video',
                        ${`v11-old-${String(Date.now())}`}, ${`v11-oldfb-${String(Date.now())}`},
                        to_timestamp(${window} / 1000.0) - interval '1 day', NULL)
                RETURNING id`,
          )
          .then((r) => r.rows);
        plantedOld = row?.id ?? null;
      }

      const [existing] = await db
        .execute<{ total: number; scheduled: number }>(
          sql`SELECT COUNT(*)::int AS total, COUNT(scheduled_at)::int AS scheduled
                FROM sessions
               WHERE created_at < to_timestamp(${window} / 1000.0)`,
        )
        .then((r) => r.rows);

      check(
        "11.2 no session that predates the scheduling migration carries an invented appointment",
        applied !== undefined && existing?.scheduled === 0,
        `${existing?.scheduled ?? "?"} of ${existing?.total ?? "?"} sessions older than ${
          applied ? new Date(window).toISOString().slice(0, 10) : "(ledger unreadable)"
        }`,
      );

      check(
        "🔴 CONTROL …and that window actually contains sessions, so zero means something",
        (existing?.total ?? 0) > 0,
        `${existing?.total ?? 0} sessions predate the migration`,
      );

      /*
       * 🔴 AND THE OFFENDER, planted, because the two checks above both pass on
       * a query that reads the wrong column. An old session WITH a scheduled
       * time is the backfill 11.2 forbids, and the count must find it.
       */
      if (plantedOld) {
        await db.execute(
          sql`UPDATE sessions SET scheduled_at = date_trunc('hour', now()) WHERE id = ${plantedOld}`,
        );
        const [caught] = await db
          .execute<{ scheduled: number }>(
            sql`SELECT COUNT(scheduled_at)::int AS scheduled FROM sessions
                 WHERE created_at < to_timestamp(${window} / 1000.0)`,
          )
          .then((r) => r.rows);
        check(
          "🔴 CONTROL …and a backfilled appointment on an old session IS counted",
          (caught?.scheduled ?? 0) === 1,
          `${caught?.scheduled ?? 0} found`,
        );
      }
    } finally {
      if (plantedOld) await db.execute(sql`DELETE FROM sessions WHERE id = ${plantedOld}`);
    }

    /* --------------------------------------- 🔴 11.1 the constraint bites -- */

    const [therapist] = await db
      .execute<{ id: string; org: string }>(
        // W1-16: only an approved clinician's hours are offered, so the race
        // below needs one; an unapproved fixture fails 11.3 for the rule itself.
        sql`SELECT u.id, u.organization_id AS org FROM users u
              JOIN therapist_verifications v ON v.user_id = u.id AND v.state = 'approved'
             WHERE u.deleted_at IS NULL LIMIT 1`,
      )
      .then((r) => r.rows);

    if (!therapist) {
      skip("11.x scheduling", "no clinician rows in this database");
    } else {
      const actor = {
        userId: therapist.id,
        organizationId: therapist.org,
        role: "therapist" as const,
      };

      let quarterPastRefused = false;
      try {
        await db.insert(availabilitySlots).values({
          therapistUserId: therapist.id,
          organizationId: therapist.org,
          startsAt: new Date("2031-03-04T19:15:00.000Z"),
        });
      } catch {
        quarterPastRefused = true;
      }
      check("🔴 11.1 a 19:15 slot is refused BY THE DATABASE", quarterPastRefused);

      /* --------------------------------------------------- publishing hours */

      const { publishHours, openHours, holdSlot, bookSlot, withdrawHour, inBookedWindow } =
        await import("../lib/data/scheduling");

      const published = await publishHours({
        actor: actor as never,
        days: ["2031-03-04"],
        fromHour: 18,
        toHour: 21,
        zone: "UTC",
      });
      check(
        "11.1 three hours publish",
        published.ok && published.added === 3,
        JSON.stringify(published),
      );

      // Republishing an overlapping range must not disturb anything.
      const again = await publishHours({
        actor: actor as never,
        days: ["2031-03-04"],
        fromHour: 19,
        toHour: 22,
        zone: "UTC",
      });
      check(
        "11.1 republishing adds only what is new and leaves existing hours alone",
        again.ok && again.added === 1,
        JSON.stringify(again),
      );

      const inverted = await publishHours({
        actor: actor as never,
        days: ["2031-03-04"],
        fromHour: 21,
        toHour: 18,
        zone: "UTC",
      });
      check(
        "11.1 an inverted range is refused rather than wrapping midnight",
        inverted.ok === false,
      );

      /* ------------------------------------------------- 11.3 the race -- */

      const open = await openHours(therapist.id, 3000);
      const target = open.find((s) => s.startsAt.getTime() === HOUR.getTime());
      check("11.3 the published hour is offered publicly", Boolean(target));
      slotId = target?.id ?? null;

      if (slotId) {
        const first = await holdSlot(slotId);
        check("11.3 one patient takes the hold", first.ok === true);

        const second = await holdSlot(slotId);
        check(
          "🔴 11.3 the second patient is refused, not silently overwritten",
          second.ok === false,
          second.ok ? "BOTH WON" : second.error,
        );

        const booked = await bookSlot({ slotId, patientName: `Verify ${TAG}` });
        check("11.3 the hold becomes a booking", booked.ok === true);

        if (booked.ok) {
          const [session] = await db
            .select({
              scheduledAt: sessions.scheduledAt,
              startedAt: sessions.startedAt,
              status: sessions.status,
            })
            .from(sessions)
            .where(eq(sessions.id, booked.sessionId))
            .limit(1);

          check(
            "🔴 11.2 the session is SCHEDULED, not started, the gap sprint 12 reads",
            session?.scheduledAt?.getTime() === HOUR.getTime() && session?.startedAt === null,
            `scheduledAt=${session?.scheduledAt?.toISOString()} startedAt=${session?.startedAt}`,
          );
          check("11.2 …and its status says so", session?.status === "scheduled", session?.status);
        }

        const third = await bookSlot({ slotId, patientName: `Loser ${TAG}` });
        check("🔴 11.3 a booked hour cannot be booked again", third.ok === false);

        const gone = await openHours(therapist.id, 3000);
        check(
          "11.3 …and it disappears from the public calendar",
          !gone.some((s) => s.id === slotId),
        );

        const removal = await withdrawHour(actor as never, slotId);
        check(
          "🔴 11.1 a booked hour cannot be deleted out from under the patient",
          removal === false,
        );

        /* ------------------------------------------- 11.5 the radar hides */

        const during = await inBookedWindow(therapist.id, new Date(HOUR.getTime() + 60_000));
        const before = await inBookedWindow(therapist.id, new Date(HOUR.getTime() - 10 * 60_000));
        const clear = await inBookedWindow(therapist.id, new Date(HOUR.getTime() - 60 * 60_000));

        check("11.5 inside the booked hour, they are off the radar", during === true);
        check("11.5 ten minutes before it, they are off the radar", before === true);
        check("11.5 an hour before it, they are on it", clear === false);

        /*
         * And the same rule inside the radar's own predicate, which is the one
         * that actually decides what a patient in crisis sees. A component
         * could be right while the query is wrong.
         */
        const [visible] = await db
          .execute<{ n: number }>(
            sql`SELECT COUNT(*)::int AS n
                  FROM therapist_radar r
                 WHERE r.user_id = ${therapist.id}
                   AND NOT EXISTS (
                     SELECT 1 FROM availability_slots a
                      WHERE a.therapist_user_id = r.user_id
                        AND a.status = 'booked'
                        AND ${new Date(HOUR.getTime() + 60_000)} >= a.starts_at - interval '15 minutes'
                        AND ${new Date(HOUR.getTime() + 60_000)} <  a.starts_at + (a.duration_minutes * interval '1 minute')
                   )`,
          )
          .then((r) => r.rows);
        check(
          "🔴 11.5 the radar's own reachability predicate excludes them too",
          visible?.n === 0,
          `${visible?.n} row(s) still reachable`,
        );
      }

      /* -------------------------------------------------- 11.7 the seam -- */

      const { reachable, emailConfigured } = await import("../lib/notify");
      const { whatsappConfigured } = await import("../lib/notify/whatsapp");

      check(
        "11.7 a patient with no email and no phone is reported unreachable, not assumed sent",
        reachable({ email: null, phone: null }) === false,
      );
      check("11.7 …and one with either is reachable", reachable({ email: "a@b.c", phone: null }));

      console.log(
        `       (email configured: ${emailConfigured()}; whatsapp configured: ${whatsappConfigured()})`,
      );
    }
  } finally {
    /*
     * Order matters and so does breadth. `bookSlot` writes the session row
     * *before* it claims the hour, so a booking that loses the race still
     * leaves a cancelled session behind — the first version of this cleanup
     * filtered on a patient name the losing call did not use, and left one
     * row in the branch database. Both patients are tagged now, and the slot
     * FK is cleared first so the session delete is not blocked by it.
     */
    await db
      .delete(availabilitySlots)
      .where(sql`starts_at >= '2031-03-01' AND starts_at < '2031-04-01'`);
    await db
      .delete(sessions)
      .where(
        sql`patient_id IN (SELECT id FROM patients WHERE last_name LIKE ${`%${TAG}%`} OR first_name LIKE ${`%${TAG}%`})`,
      );
    await db
      .delete(patients)
      .where(sql`first_name LIKE ${`%${TAG}%`} OR last_name LIKE ${`%${TAG}%`}`);
    await db
      .delete(people)
      .where(sql`first_name LIKE ${`%${TAG}%`} OR last_name LIKE ${`%${TAG}%`}`);
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 11: PASS" : `\nsprint 11: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
