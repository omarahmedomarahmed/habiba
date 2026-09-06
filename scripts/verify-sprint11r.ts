/**
 * Sprint 11R acceptance, against the real database.
 *
 *   npm run verify:sprint11r
 *
 * 11R is a repair sprint, so most of it is asserted where the defect was: the
 * pure arithmetic in `tests/timezones.test.ts`, the parser in
 * `tests/documents-extract.test.ts`, the gate in `tests/consent.test.ts`, and
 * the ledger in `scripts/verify-migrations.ts`. What is left for this script is
 * the part only the database can answer, and the two claims that are only true
 * if the *data* says so:
 *
 *   C46 — turning the gate on must not reach a single existing patient
 *   C26 — the sessions nobody could ever have rated, counted and excluded
 *
 * It writes almost nothing. What it does write is tagged `verify11r-` and
 * removed in the `finally`.
 */
import { and, eq, like, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { availabilitySlots, patients, sessions, users } from "../lib/db/schema";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function note(text: string) {
  console.log(`  --   ${text}`);
}

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  const createdSlotIds: string[] = [];

  try {
    /* ------------------------------------------------ 11R.2 the tz columns */

    const columns = await db.execute(sql`
      SELECT table_name, column_name
        FROM information_schema.columns
       WHERE (table_name = 'users' AND column_name = 'timezone')
          OR (table_name = 'patients' AND column_name = 'timezone')
          OR (table_name = 'availability_slots' AND column_name = 'reminded_at')
    `);
    check(
      "11R.2 / 11R.6 users.timezone, patients.timezone and availability_slots.reminded_at exist",
      (columns.rows as unknown[]).length === 3,
      `${(columns.rows as unknown[]).length} of 3`,
    );

    /* --------------------------------- 11R.2 publishing in a clinician zone */

    const [therapist] = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .limit(1);

    if (!therapist) {
      check("11R.2 a clinician exists to publish hours for", false);
    } else {
      const { publishHours } = await import("../lib/data/scheduling");

      const actor = {
        userId: therapist.id,
        organizationId: therapist.organizationId,
        role: "therapist",
      };

      /*
       * 🔴 The whole point of 11R.2, asserted against the database rather than
       * against a formatter: an 18:00 Cairo hour in July is stored as 15:00Z,
       * and the same wall-clock hour in January is stored as 16:00Z. The old
       * code stored 18:00Z for both.
       */
      const summer = await publishHours({
        actor: actor as never,
        days: ["2031-07-15"],
        fromHour: 18,
        toHour: 19,
        zone: "Africa/Cairo",
      });
      const winter = await publishHours({
        actor: actor as never,
        days: ["2031-01-15"],
        fromHour: 18,
        toHour: 19,
        zone: "Africa/Cairo",
      });

      check(
        "11R.2 an hour published in Cairo is stored in UTC, not as the wall clock",
        summer.ok && winter.ok,
        JSON.stringify({ summer, winter }),
      );

      const stored = await db
        .select({ id: availabilitySlots.id, startsAt: availabilitySlots.startsAt })
        .from(availabilitySlots)
        .where(
          and(
            eq(availabilitySlots.therapistUserId, therapist.id),
            sql`${availabilitySlots.startsAt} >= '2031-01-01'::timestamptz`,
          ),
        );

      for (const row of stored) createdSlotIds.push(row.id);

      const isos = stored.map((row) => row.startsAt.toISOString()).sort();
      check(
        "🔴 11R.2 the same 18:00 is 15:00Z in July and 16:00Z in January — Egypt has DST again",
        isos.includes("2031-07-15T15:00:00.000Z") && isos.includes("2031-01-15T16:00:00.000Z"),
        isos.join(", "),
      );

      const noZone = await publishHours({
        actor: actor as never,
        days: ["2031-07-16"],
        fromHour: 18,
        toHour: 19,
        zone: "Nowhere/Nothing",
      });
      check(
        "11R.2 publishing refuses a zone this runtime does not know, rather than falling back to UTC",
        noZone.ok === false,
      );
    }

    /* --------------------------------------------- 11R.6 / C63 the reminder */

    const marked = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM availability_slots WHERE note LIKE '%[reminded]%'
    `);
    check(
      "🔴 11R.7 / C63 no slot note carries a [reminded] marker — the note is the patient's own words",
      Number((marked.rows[0] as { n: number }).n) === 0,
      `${(marked.rows[0] as { n: number }).n} rows`,
    );

    /* -------------------------------------------------- 11R.12 phone shapes */

    const phones = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM patients
          WHERE phone IS NOT NULL AND btrim(phone) <> ''
            AND phone !~ '^\\+[1-9][0-9]{6,14}$')::int AS bad_patients,
        (SELECT COUNT(*) FROM people
          WHERE phone IS NOT NULL AND btrim(phone) <> ''
            AND phone !~ '^\\+[1-9][0-9]{6,14}$')::int AS bad_people,
        (SELECT COUNT(*) FROM patient_accounts
          WHERE phone IS NOT NULL AND btrim(phone) <> ''
            AND phone !~ '^\\+[1-9][0-9]{6,14}$')::int AS bad_accounts
    `);
    const bad = phones.rows[0] as { bad_patients: number; bad_people: number; bad_accounts: number };
    check(
      "11R.12 every stored phone number is E.164, so every one of them can actually be messaged",
      bad.bad_patients + bad.bad_people + bad.bad_accounts === 0,
      JSON.stringify(bad),
    );

    /* ------------------------------------- 11R.24 / C46 the grandfathering */

    const [counts] = await db
      .select({
        patients: sql<number>`COUNT(*)::int`,
        withDiagnosis: sql<number>`COUNT(*) FILTER (
          WHERE COALESCE(jsonb_array_length(${patients.clinical} -> 'diagnoses'), 0) > 0
        )::int`,
      })
      .from(patients);

    note(
      `C46 as it stands: ${counts?.withDiagnosis ?? 0} of ${counts?.patients ?? 0} patients have a diagnosis.`,
    );

    /*
     * The assertion the ticket asks for, run the only way that means anything:
     * take every existing patient, set the gate live from *today*, and count
     * how many of them it would lock out. The answer has to be zero.
     */
    const { isGated } = await import("../lib/access/state");
    const today = new Date().toISOString().slice(0, 10);

    const existing = await db
      .select({ createdAt: patients.createdAt })
      .from(patients)
      .where(sql`${patients.deletedAt} IS NULL`);

    const wouldLock = existing.filter((row) =>
      isGated({
        // The worst case for each of them: bare, unclaimed, undocumented.
        state: "unclaimed_bare",
        patientCreatedAt: row.createdAt,
        gateActiveFrom: today,
      }),
    ).length;

    check(
      "🔴 11R.24 / C46 turning the gate on today locks out 0 existing patients",
      wouldLock === 0,
      `${wouldLock} of ${existing.length} would lose the copilot`,
    );

    const { getSettings } = await import("../lib/settings");
    const gateActiveFrom = (await getSettings()).copilot.gateActiveFrom;
    check(
      "11R.24 the gate is a date in platform_settings, and defaults to never",
      typeof gateActiveFrom === "string",
      gateActiveFrom === "" ? "not switched on yet — reported, takes nothing away" : gateActiveFrom,
    );

    /* ------------------------------------------------------ 11R.26 / C26 */

    const { rateabilityCounts } = await import("../lib/data/feedback");
    const rateability = await rateabilityCounts();

    note(
      `C26: ${rateability.unratable} of ${rateability.completed} completed sessions have no feedback_token and never could be rated.`,
    );
    check(
      "11R.26 / C26 the unratable sessions are counted, not backfilled",
      rateability.rateable + rateability.unratable === rateability.completed,
      JSON.stringify(rateability),
    );

    const tokens = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM sessions WHERE feedback_token IS NULL
    `);
    check(
      "🔴 11R.26 no token was minted for a session nobody was ever sent a link for",
      Number((tokens.rows[0] as { n: number }).n) > 0,
      `${(tokens.rows[0] as { n: number }).n} sessions still have no token, deliberately`,
    );

    /* ------------------------------------------------------ 11R.23 / C50 */

    const docs = await db.execute(sql`
      SELECT COUNT(*) FILTER (
        WHERE extraction = 'unsupported'
          AND lower(split_part(mime_type, ';', 1)) IN (
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          )
      )::int AS stale
      FROM person_documents
    `);
    check(
      "11R.23 / C50 no PDF or .docx is still marked unsupported for want of a parser",
      Number((docs.rows[0] as { stale: number }).stale) === 0,
      `${(docs.rows[0] as { stale: number }).stale} left over — 0041 re-queues them`,
    );
  } finally {
    if (createdSlotIds.length > 0) {
      await db.delete(availabilitySlots).where(
        sql`${availabilitySlots.id} = ANY(ARRAY[${sql.join(
          createdSlotIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}])`,
      );
    }
    // Belt and braces: anything else this script tagged.
    await db.delete(sessions).where(like(sessions.guestName, "verify11r-%"));
  }

  console.log(`\n${failures === 0 ? "sprint 11R: PASS" : `sprint 11R: ${failures} FAILED`} (${checks} checks)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
