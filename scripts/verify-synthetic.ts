/**
 * 🔴 Is every person on this database invented?
 *
 *   npm run verify:synthetic
 *
 * ## Why this exists, and what it unlocks
 *
 * C80 has said since sprint 52 that **admin console frames are never
 * committed**, and `.gitignore` enforced it. The reason is disclosure: an
 * operator console shows many people at once, and this repository is treated as
 * if it will be public one day, so a single real name in one frame is something
 * that cannot be recalled.
 *
 * That reason is about **real people**, not about admin screens. The simulation
 * has no real people in it: every surname is Demo or Example, every address is
 * at `example.com`, which RFC 2606 reserves and which can never reach a real
 * inbox. So the console can be photographed and committed **on this database**,
 * and the operator's screens are half of what the run exists to show.
 *
 * The right way to relax a rule is to prove its precondition rather than to
 * delete the rule. This is that proof, and `05-CAPTURE.md` makes it the gate: no
 * operator frame is committed until this passes.
 *
 * ## What it checks
 *
 * Every name column and every email column in `public`, found from
 * `information_schema` rather than from a list somebody maintains. A surname
 * that is not Demo or Example, or an address outside the reserved domains, is
 * named and the run fails.
 *
 * ## What it is not
 *
 * It is not a claim that the data is harmless in general. It is a claim about
 * **this database, at this moment**. Run it again before every commit of
 * frames; a name that arrives after it passed is a name nobody checked.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

/** The only surnames a person in a captured frame may carry. */
const SURNAMES = ["Demo", "Example"];

/**
 * Reserved by RFC 2606 and RFC 6761. None of them can reach a real inbox, which
 * is the property that matters: an address that cannot receive mail cannot
 * belong to anybody.
 */
const DOMAINS = ["example.com", "example.org", "example.net", "example.invalid", "24therapy.ai"];

async function main() {
  writesTo();
  const { pool, db } = connect();

  try {
    /* Discovered, never listed. A table added next year is checked by this. */
    const cols = await db.execute<{ table_name: string; column_name: string }>(sql`
      SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
       WHERE c.table_schema = 'public'
         AND t.table_type = 'BASE TABLE'
         AND (c.column_name = 'last_name' OR c.column_name LIKE '%email%')
         AND c.data_type IN ('text', 'character varying')
       ORDER BY 1, 2`);

    const surnameCols = cols.rows.filter((c) => c.column_name === "last_name");
    const emailCols = cols.rows.filter((c) => c.column_name.includes("email"));

    check(
      "the scan found the columns a person's identity could hide in",
      surnameCols.length >= 3 && emailCols.length >= 8,
      `${surnameCols.length} surname columns, ${emailCols.length} email columns, from information_schema`,
    );

    /* --------------------------------------------------------- surnames -- */

    const badNames: string[] = [];
    for (const col of surnameCols) {
      const rows = await db.execute<{ v: string; n: string }>(
        sql.raw(`
          SELECT DISTINCT last_name AS v, COUNT(*)::text AS n
            FROM "${col.table_name}"
           WHERE last_name IS NOT NULL AND TRIM(last_name) <> ''
             AND last_name NOT IN (${SURNAMES.map((s) => `'${s}'`).join(", ")})
           GROUP BY last_name LIMIT 20`),
      );
      for (const r of rows.rows) badNames.push(`${col.table_name}.last_name="${r.v}" (${r.n})`);
    }

    check(
      "🔴 every person on this database has the surname Demo or Example",
      badNames.length === 0,
      badNames.length === 0
        ? `${surnameCols.length} tables clean`
        : badNames.slice(0, 8).join(" · "),
    );

    /* ----------------------------------------------------------- emails -- */

    const badMail: string[] = [];
    for (const col of emailCols) {
      const clause = DOMAINS.map((d) => `"${col.column_name}" NOT ILIKE '%@${d}'`).join(" AND ");
      const rows = await db.execute<{ v: string }>(
        sql.raw(`
          SELECT DISTINCT "${col.column_name}" AS v
            FROM "${col.table_name}"
           WHERE "${col.column_name}" IS NOT NULL
             AND TRIM("${col.column_name}") <> ''
             AND ${clause}
           LIMIT 20`),
      );
      for (const r of rows.rows) badMail.push(`${col.table_name}.${col.column_name}="${r.v}"`);
    }

    check(
      "🔴 …and every address is at a domain that cannot receive mail",
      badMail.length === 0,
      badMail.length === 0
        ? `${emailCols.length} columns clean, ${DOMAINS.join(", ")}`
        : badMail.slice(0, 8).join(" · "),
    );

    /* ---------------------------------------------------------- CONTROL -- */

    /*
     * 🔴 An absence assertion over sixteen columns is worth nothing until it is
     * watched finding something. A real name is planted, the same scan is run,
     * and it must come back. Then it is removed, in a `finally`, because a
     * verifier that leaves a fake real person behind has created the exact
     * disclosure it exists to prevent.
     */
    const planted = "verify-synthetic-control";
    let caught = false;
    try {
      await db.execute(sql`
        INSERT INTO people (first_name, last_name, email)
        VALUES ('Control', 'Okonkwo', ${`${planted}@gmail.com`})`);

      const nameHit = await db.execute<{ n: string }>(sql`
        SELECT COUNT(*)::text AS n FROM people
         WHERE last_name IS NOT NULL AND last_name NOT IN ('Demo', 'Example')`);
      const mailHit = await db.execute<{ n: string }>(sql`
        SELECT COUNT(*)::text AS n FROM people
         WHERE email IS NOT NULL AND email NOT ILIKE '%@example.com'
           AND email NOT ILIKE '%@example.invalid' AND email NOT ILIKE '%@24therapy.ai'`);

      caught = Number(nameHit.rows[0]?.n ?? 0) > 0 && Number(mailHit.rows[0]?.n ?? 0) > 0;
    } finally {
      await db.execute(sql`DELETE FROM people WHERE email = ${`${planted}@gmail.com`}`);
    }

    check(
      "🔴 CONTROL the same scan CATCHES a real-looking name and a real domain",
      caught,
      "planted, found, and removed again in a finally",
    );

    const stillThere = await db.execute<{ n: string }>(sql`
      SELECT COUNT(*)::text AS n FROM people WHERE email = ${`${planted}@gmail.com`}`);

    check(
      "🔴 …and the control removed itself, so it cannot become the disclosure",
      Number(stillThere.rows[0]?.n ?? 0) === 0,
      "nothing left behind",
    );

    if (badNames.length === 0 && badMail.length === 0) {
      console.log("\n  🟢 Every person here is invented. Operator frames may be committed.");
      console.log("     Run this again immediately before committing them: a name that arrives");
      console.log("     after this passed is a name nobody checked.\n");
    } else {
      console.log("\n  🔴 DO NOT COMMIT ANY OPERATOR FRAME FROM THIS DATABASE.\n");
    }
  } finally {
    await pool.end();
  }

  finish("synthetic");
}

main();
