/**
 * Sprint 9 acceptance, against the real database.
 *
 *   npm run verify:sprint9
 *
 * The filters are tested pure in `tests/memory.test.ts`. What this checks is
 * the part that only exists once there are rows — and above all the one rule
 * that is a promise to a person rather than a property of a function:
 *
 * > ⚠️ A completion rate shown to a depressed patient is a scoreboard of their
 * > failures. **Trend to the therapist; next action to the patient.**
 *
 * So it calls the patient's own query and asserts that no count, rate or
 * streak comes back at all — not that a component hides them.
 *
 * It writes. Everything is tagged `verify9-` and removed in the `finally`, and
 * it refuses to run against the production endpoint.
 */
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import { connect, schema } from "./db";

const { homeworkItems, observations, patientAccounts, patients, people, personProfiles } = schema;

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};
const skip = (name: string, why: string) => console.log(`  --   ${name} — NOT EXERCISED: ${why}`);

const TAG = `verify9-${randomUUID().slice(0, 8)}`;

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

  try {
    /* -------------------------------------------------------- the schema -- */

    for (const [table, expected] of [
      ["person_profiles", 8],
      ["observations", 8],
      ["homework_items", 15],
    ] as const) {
      const [row] = await db
        .execute<{ n: number }>(
          sql`SELECT COUNT(*)::int AS n FROM information_schema.columns
               WHERE table_schema='public' AND table_name=${table}`,
        )
        .then((r) => r.rows);
      check(`9.x ${table} exists with ${expected} columns`, row?.n === expected, `${row?.n}`);
    }

    const idx = await db.execute<{ indexname: string }>(
      sql`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='person_profiles_person_unique'`,
    );
    check(
      "9.1 one profile per person — there is nowhere to keep a hand-written second copy",
      idx.rows.length === 1,
    );

    /*
     * The backfill that deliberately did not happen. `note_content.patientSteps`
     * drafted steps into existing notes; promoting them would hand every
     * patient with an account a backlog of tasks nobody set, dated to sessions
     * that ended months ago.
     */
    const [drafted] = await db
      .execute<{ notes: number; live: number }>(
        sql`SELECT
              (SELECT COUNT(*)::int FROM session_notes
                WHERE jsonb_array_length(COALESCE(content->'patientSteps','[]'::jsonb)) > 0) AS notes,
              (SELECT COUNT(*)::int FROM homework_items) AS live`,
      )
      .then((r) => r.rows);
    check(
      "9.5 drafted steps in existing notes were NOT auto-promoted to homework",
      drafted?.live === 0,
      `${drafted?.notes} notes carry drafted steps; ${drafted?.live} live homework rows`,
    );

    /* --------------------------------------------- 9.5 the asymmetry rule -- */

    const [therapist] = await db
      .execute<{ id: string; org: string }>(
        sql`SELECT id, organization_id AS org FROM users WHERE deleted_at IS NULL LIMIT 1`,
      )
      .then((r) => r.rows);

    if (!therapist) {
      skip("9.5 homework", "no clinician rows in this database");
    } else {
      const personId = await newPerson(db);
      const accountId = await newAccount(db, personId);
      const actor = {
        userId: therapist.id,
        organizationId: therapist.org,
        role: "therapist" as const,
      };

      const { assignStep, closeStep, homeworkTrend, nextStepFor, openStepsFor, withdrawStep } =
        await import("../lib/data/homework");

      const one = await assignStep({
        actor: actor as never,
        personId,
        title: "Write down the three times you noticed it starting",
      });
      const two = await assignStep({
        actor: actor as never,
        personId,
        title: "Walk to the end of the road on Tuesday",
      });
      const three = await assignStep({ actor: actor as never, personId, title: "Third thing" });
      check("9.5 a clinician can set a step", one.ok && two.ok && three.ok);

      const empty = await assignStep({ actor: actor as never, personId, title: "   " });
      check("9.5 an empty step is refused", empty.ok === false);

      /* ------ 🔴 the warning, checked on the shape of what each side receives */

      const next = await nextStepFor(personId);
      check("⚠️ the patient's query returns ONE step", next !== null && "title" in next);

      const keys = next ? Object.keys(next).sort() : [];
      check(
        "🔴 ⚠️ …and no count, rate, streak or history comes back with it",
        JSON.stringify(keys) ===
          JSON.stringify(["detail", "dueAt", "id", "othersWaiting", "title"]),
        keys.join(", "),
      );
      check(
        "⚠️ …`othersWaiting` is orientation, not a score, and is capped",
        next?.othersWaiting === 2,
        `${next?.othersWaiting}`,
      );

      const openOnly = await openStepsFor(personId);
      check("⚠️ the patient's list is open items only", openOnly.length === 3);

      /* ---------------------------------------------- closing, both outcomes */

      if (one.ok) {
        const done = await closeStep({
          itemId: one.itemId,
          personId,
          accountId,
          outcome: "done",
        });
        check("9.5 the person closes a step themselves", done.ok === true);

        const twice = await closeStep({
          itemId: one.itemId,
          personId,
          accountId,
          outcome: "skipped",
        });
        check("9.5 …and a second answer to the same step is refused", twice.ok === false);
      }

      if (two.ok) {
        const skipped = await closeStep({
          itemId: two.itemId,
          personId,
          accountId,
          outcome: "skipped",
          note: "I could not face it",
        });
        check(
          "9.5 'I could not' is a first-class answer, with an optional note",
          skipped.ok === true,
        );
      }

      // Somebody else's step is not theirs to close.
      const otherPerson = await newPerson(db);
      if (three.ok) {
        const stolen = await closeStep({
          itemId: three.itemId,
          personId: otherPerson,
          accountId,
          outcome: "done",
        });
        check("🔴 9.5 a borrowed item id closes nothing", stolen.ok === false);
      }

      /* ------------------------------------------- the clinician's side only */

      const trend = await homeworkTrend(personId);
      check(
        "⚠️ the clinician's query DOES return the trend",
        trend.done === 1 && trend.skipped === 1 && trend.open === 1,
        `open ${trend.open} · done ${trend.done} · skipped ${trend.skipped}`,
      );
      check(
        "9.5 …with a completion rate that exists once something is closed",
        trend.completionRate === 0.5,
        `${trend.completionRate}`,
      );

      const fresh = await homeworkTrend(otherPerson);
      check(
        "🔴 9.5 a person who has closed nothing has a NULL rate, not 0%",
        fresh.completionRate === null,
        `${fresh.completionRate}`,
      );

      /* ------------------------------------------------ withdrawing a step */

      if (three.ok) {
        const withdrawn = await withdrawStep({
          actor: actor as never,
          itemId: three.itemId,
          personId,
        });
        check("9.5 an unanswered step can be withdrawn", withdrawn === true);
      }
      if (two.ok) {
        const answered = await withdrawStep({
          actor: actor as never,
          itemId: two.itemId,
          personId,
        });
        check(
          "🔴 9.5 an ANSWERED step cannot be withdrawn — the answer is theirs",
          answered === false,
        );
      }

      /* ------------------------------------------- 9.1 the profile is a row */

      await db.insert(personProfiles).values({
        personId,
        sections: [{ heading: "Presenting problem", body: "Panic at work.", refs: ["S1:1"] }],
        conflicts: [
          { text: "Letter says X [D1:1]; session says Y [S1:1].", refs: ["D1:1", "S1:1"] },
        ],
        sessionCount: 1,
        documentCount: 1,
      });

      let second = false;
      try {
        await db.insert(personProfiles).values({ personId, sections: [] });
      } catch {
        second = true;
      }
      check("🔴 9.1 a second profile for the same person is refused by the database", second);

      const { profileFor, isStale } = await import("../lib/data/memory");
      const stored = await profileFor(personId);
      check(
        "9.1 the profile reads back with its citations",
        stored?.sections[0]?.refs[0] === "S1:1",
      );
      check("9.4 …and its conflicts, unresolved", stored?.conflicts.length === 1);
      check(
        "9.1 a profile behind its sources is marked stale",
        isStale(stored, { sessions: 2, documents: 1 }) === true,
      );

      /* --------------------------------------------------- 9.2 the timeline */

      await db.insert(observations).values([
        {
          personId,
          observedAt: new Date("2024-01-01"),
          text: "Later",
          source: "session",
          ref: "S1:1",
        },
        {
          personId,
          observedAt: new Date("2019-04-02"),
          text: "Earlier",
          source: "document",
          ref: "D1:1",
        },
      ]);

      const { timelineFor } = await import("../lib/data/memory");
      const timeline = await timelineFor(personId);
      check(
        "9.2 the timeline is ordered by when things HAPPENED",
        timeline[0]?.text === "Earlier" && timeline[1]?.text === "Later",
        timeline.map((t) => t.text).join(" → "),
      );
    }
  } finally {
    await db
      .delete(homeworkItems)
      .where(sql`person_id IN (SELECT id FROM people WHERE last_name = ${TAG})`);
    await db.delete(patients).where(sql`last_name = ${TAG}`);
    await db.delete(patientAccounts).where(sql`email LIKE ${`${TAG}%`}`);
    // profiles and observations cascade from people.
    await db.delete(people).where(sql`last_name = ${TAG}`);
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 9: PASS" : `\nsprint 9: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

type Db = ReturnType<typeof connect>["db"];

async function newPerson(db: Db): Promise<string> {
  const [row] = await db
    .insert(people)
    .values({ firstName: "Verify", lastName: TAG })
    .returning({ id: people.id });
  return row!.id;
}

async function newAccount(db: Db, personId: string): Promise<string> {
  const [row] = await db
    .insert(patientAccounts)
    .values({
      personId,
      email: `${TAG}-${randomUUID().slice(0, 6)}@example.invalid`,
      passwordHash: "x",
    })
    .returning({ id: patientAccounts.id });
  return row!.id;
}

main();
