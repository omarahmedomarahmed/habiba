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
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
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
    check(
      "5.3 one person per patient — nothing was merged",
      counts!.distinct === counts!.patients,
      `${counts!.distinct} distinct people across ${counts!.patients} patients`,
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
     * Duplicate emails must survive as separate people.
     *
     * This database has three addresses on more than one patient, including one
     * on patients named "Omar" and "Sam" in different organisations. If the
     * backfill had collapsed those, the count of people would be lower than the
     * count of patients — and one person's record would be inside another's.
     */
    const dupes = await db
      .select({
        email: sql<string>`lower(email)`,
        patients: sql<number>`COUNT(*)::int`,
        people: sql<number>`COUNT(DISTINCT person_id)::int`,
        names: sql<string>`string_agg(DISTINCT first_name, ' | ')`,
      })
      .from(patients)
      .where(sql`email IS NOT NULL AND deleted_at IS NULL`)
      .groupBy(sql`lower(email)`)
      .having(sql`COUNT(*) > 1`);

    for (const d of dupes) {
      check(
        `5.3 "${d.email}" stayed ${d.patients} separate people (${d.names})`,
        d.people === d.patients,
        `${d.people} people for ${d.patients} patients`,
      );
    }
    if (dupes.length === 0) console.log("  --   no duplicate emails in this database to test against");

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
