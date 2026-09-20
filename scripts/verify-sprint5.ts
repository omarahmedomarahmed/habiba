/**
 * Sprint 5 acceptance, against the real database.
 *
 *   node --import tsx --conditions=react-server scripts/verify-sprint5.ts
 *
 * The claim that matters is 5.3: **every patient became its own person, and
 * nothing was merged.** That is not checkable by reading the migration — an
 * INSERT…SELECT joined back by `row_number()` is exactly the kind of statement
 * that looks right and silently pairs the wrong rows. So this compares the two
 * tables field by field.
 */
import { sql } from "drizzle-orm";

import { connect, schema } from "./db";

const { patients, people } = schema;

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? `, ${detail}` : ""}`);
  if (!ok) failures += 1;
};

async function main() {
  const { pool, db } = connect();
  try {
    const [counts] = await db
      .select({
        patients: sql<number>`(SELECT COUNT(*)::int FROM ${patients})`,
        people: sql<number>`(SELECT COUNT(*)::int FROM ${people})`,
        orphans: sql<number>`(SELECT COUNT(*)::int FROM ${patients} WHERE person_id IS NULL)`,
        distinct: sql<number>`(SELECT COUNT(DISTINCT person_id)::int FROM ${patients} WHERE person_id IS NOT NULL)`,
        claimed: sql<number>`(SELECT COUNT(*)::int FROM ${people} WHERE claimed_at IS NOT NULL)`,
      })
      .from(sql`(SELECT 1) AS one`);

    console.log(
      `${counts!.patients} patients · ${counts!.people} people · ${counts!.claimed} claimed`,
    );

    check("5.1 every patient has a person", counts!.orphans === 0, `${counts!.orphans} orphaned`);
    /*
     * 🔴 78.5 — SCOPED TO ONE PRACTICE, because the product outgrew the
     * migration this check was written for.
     *
     * It asserted `COUNT(DISTINCT person_id) === COUNT(patients)`: one person,
     * one chart, nothing merged. That was the right statement about a backfill
     * whose only risk was an `INSERT…SELECT` joined by `row_number()` pairing
     * the wrong rows.
     *
     * It is the wrong statement about the product now. A person who changes
     * practice has a chart at each, which is the ENTIRE portability claim the
     * public site rests on: two `clinical_summaries` versions, approved by two
     * clinicians at two organisations, reached through a `history_grants` row.
     * As written, this would have gone red the first time a real patient moved,
     * and the red line would have said "nothing was merged" about a person
     * whose record had done exactly what it was designed to do.
     *
     * The rule that survives is per-practice: two charts in the SAME
     * organisation pointing at one person is a duplicate, which is the merge
     * failure 5.3 is actually about.
     */
    const [doubled] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(
        sql`(SELECT organization_id, person_id FROM ${patients}
              WHERE person_id IS NOT NULL AND deleted_at IS NULL
              GROUP BY 1, 2 HAVING COUNT(*) > 1) AS doubled`,
      );
    check(
      "🔴 5.3 no two charts at one practice share a person. Nothing was merged",
      (doubled?.n ?? 0) === 0,
      `${String(doubled?.n ?? 0)} doubled, across ${counts!.patients} charts and ${counts!.distinct} people`,
    );

    /*
     * 🔴 CONTROL, because a GROUP BY that groups on the wrong columns also
     * returns nothing. The same query without the organisation in the key must
     * FIND the person who legitimately holds a chart at two practices — if it
     * does not, the check above is not looking at people at all.
     */
    const [moved] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(
        sql`(SELECT person_id FROM ${patients}
              WHERE person_id IS NOT NULL AND deleted_at IS NULL
              GROUP BY 1 HAVING COUNT(*) > 1) AS moved`,
      );
    console.log(
      `  --   ${String(moved?.n ?? 0)} ${(moved?.n ?? 0) === 1 ? "person holds" : "people hold"} ` +
        "a chart at more than one practice, which is the portability claim working",
    );

    /*
     * The pairing check.
     *
     * Counting rows proves nothing about *which* person each patient got. If
     * the row_number join had been off by one, every count above would still
     * be right and every patient would be pointing at somebody else's record —
     * which in this product means a clinician opening the wrong chart.
     */
    const [mismatch] = await db
      .select({
        pairs: sql<number>`COUNT(*)::int`,
        wrongFirst: sql<number>`COUNT(*) FILTER (WHERE pe.first_name IS DISTINCT FROM pa.first_name)::int`,
        wrongLast: sql<number>`COUNT(*) FILTER (WHERE pe.last_name IS DISTINCT FROM pa.last_name)::int`,
        wrongEmail: sql<number>`COUNT(*) FILTER (WHERE pe.email IS DISTINCT FROM lower(nullif(btrim(pa.email), '')))::int`,
      })
      .from(sql`${patients} pa JOIN ${people} pe ON pe.id = pa.person_id`);

    check(
      "5.3 each patient points at its OWN person, not somebody else's",
      mismatch!.wrongFirst === 0 && mismatch!.wrongLast === 0 && mismatch!.wrongEmail === 0,
      `${mismatch!.pairs} pairs · ${mismatch!.wrongFirst} name / ${mismatch!.wrongEmail} email mismatches`,
    );

    /*
     * Duplicate emails must not collapse two DIFFERENT people.
     *
     * The database this was written against had three addresses on more than
     * one patient, including one shared by patients named "Omar" and "Sam" in
     * different organisations. If the backfill had merged those, one person's
     * record would be inside another's, and the count of people would be lower
     * than the count of patients.
     *
     * 🔴 78.5 — SO IT COMPARES NAMES, NOT COUNTS.
     *
     * The old form asserted one person per chart for every repeated address,
     * and that is false of the product now: a patient who changes practice has
     * a chart at each, with the same address on both, pointing at ONE person.
     * That is the portability claim rather than a merge, and this check read it
     * as a merge the moment a seeded cast contained one.
     *
     * An address is a bad key for identity and always was. The defect is two
     * distinct NAMES sharing one person, and that is what is counted here: a
     * repeated address with one name may be one person moving, and a repeated
     * address with two names must be two people.
     */
    const dupes = await db
      .select({
        email: sql<string>`lower(email)`,
        patients: sql<number>`COUNT(*)::int`,
        people: sql<number>`COUNT(DISTINCT person_id)::int`,
        names: sql<string>`string_agg(DISTINCT coalesce(first_name,'') || ' ' || coalesce(last_name,''), ' | ')`,
        distinctNames: sql<number>`COUNT(DISTINCT coalesce(first_name,'') || ' ' || coalesce(last_name,''))::int`,
      })
      .from(patients)
      .where(sql`email IS NOT NULL AND deleted_at IS NULL`)
      .groupBy(sql`lower(email)`)
      .having(sql`COUNT(*) > 1`);

    for (const d of dupes) {
      const moving = d.distinctNames === 1;
      check(
        moving
          ? `5.3 "${d.email}" is one person at ${d.patients} practices (${d.names.trim()})`
          : `5.3 "${d.email}" stayed ${d.distinctNames} separate people (${d.names})`,
        moving ? d.people === 1 : d.people === d.distinctNames,
        `${d.people} people, ${d.distinctNames} names, ${d.patients} charts`,
      );
    }
    if (dupes.length === 0) console.log("  --   no duplicate emails in this database to test against");

    /*
     * 🔴 CONTROL, because a rule that lets "one name is one person" through
     * would also let a genuine merge through if it stopped looking at names.
     * Two charts under one address with two different names must be two people,
     * and the offender is planted rather than waited for.
     */
    const [anyChart] = await db
      .select({ org: patients.organizationId, therapist: patients.therapistId })
      .from(patients)
      .limit(1);

    if (anyChart) {
      const shared = `merge-control-${String(Date.now())}@example.com`;
      let plantedPeople: string[] = [];
      let plantedCharts: string[] = [];
      try {
        for (const [first, last] of [
          ["Control", "Demo"],
          ["Offender", "Example"],
        ] as const) {
          const [person] = await db
            .execute<{ id: string }>(
              sql`INSERT INTO people (first_name, last_name, email, region)
                  VALUES (${first}, ${last}, ${shared}, 'eg') RETURNING id`,
            )
            .then((r) => r.rows);
          plantedPeople.push(person!.id);
          const [chart] = await db
            .execute<{ id: string }>(
              sql`INSERT INTO patients (organization_id, therapist_id, person_id, first_name,
                                        last_name, email, source)
                  VALUES (${anyChart.org}, ${anyChart.therapist}, ${person!.id}, ${first},
                          ${last}, ${shared}, 'self') RETURNING id`,
            )
            .then((r) => r.rows);
          plantedCharts.push(chart!.id);
        }

        const [planted] = await db
          .execute<{ people: number; names: number }>(
            sql`SELECT COUNT(DISTINCT person_id)::int AS people,
                       COUNT(DISTINCT coalesce(first_name,'') || ' ' || coalesce(last_name,''))::int AS names
                  FROM patients WHERE lower(email) = ${shared} AND deleted_at IS NULL`,
          )
          .then((r) => r.rows);

        check(
          "🔴 CONTROL two names under one address are seen as two people",
          planted?.names === 2 && planted?.people === 2,
          `${String(planted?.people)} people, ${String(planted?.names)} names`,
        );
      } finally {
        for (const id of plantedCharts) {
          await db.execute(sql`DELETE FROM patients WHERE id = ${id}`);
        }
        for (const id of plantedPeople) {
          await db.execute(sql`DELETE FROM people WHERE id = ${id}`);
        }
      }
    }

    /* --------------------------------------------------- 5.4 suggest only */

    const { findMatches, redactName } = await import("../lib/data/people");

    const withEmail = await db
      .select({ email: people.email })
      .from(people)
      .where(sql`email IS NOT NULL`)
      .limit(1);

    if (withEmail[0]?.email) {
      const matches = await findMatches({ email: withEmail[0].email });
      check("5.4 matching finds candidates", matches.length > 0, `${matches.length} candidate(s)`);
      check(
        "5.4 …and returns nothing that could be harvested",
        matches.every((m) => !("email" in m) && !("phone" in m)),
        "no address or number in the result",
      );
      check(
        "5.4 …and every candidate can be shown redacted",
        matches.every((m) => {
          const r = redactName(m.firstName, m.lastName);
          return r.length > 0 && !r.includes(m.firstName.slice(1));
        }),
      );

      // Nothing was written by looking.
      const [after] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(people);
      check("5.4 matching wrote nothing", after!.n === counts!.people, "suggestions, not decisions");
    }

    /* ------------------------------------------------------- 5.5 the rule */

    const { assertClaimed, UnclaimedError } = await import("../lib/data/people");
    const [anyUnclaimed] = await db
      .select({ id: people.id, claimedAt: people.claimedAt })
      .from(people)
      .where(sql`claimed_at IS NULL`)
      .limit(1);

    if (anyUnclaimed) {
      let threw = false;
      try {
        assertClaimed(anyUnclaimed, "shared");
      } catch (e) {
        threw = e instanceof UnclaimedError;
      }
      check("5.5 a real unclaimed person is refused, on real data", threw);
    }
  } finally {
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 5: PASS" : `\nsprint 5: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
