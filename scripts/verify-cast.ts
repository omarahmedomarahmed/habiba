/**
 * 🔴 76.54 — CAN YOU ACTUALLY SIGN IN AS EACH OF THEM?
 *
 *     npm run verify:cast              # a progress report during the run
 *     npm run verify:cast -- --complete # at the end, when missing means unfinished
 *
 * ## Why this is not "SELECT count(*) FROM users"
 *
 * The run leaves six months of records on a database nobody deletes afterwards,
 * and the whole value of that depends on being able to open each person's
 * record. Checking a row exists proves the row exists. What the founder needs is
 * that **the password works**, which is a different fact and the one that goes
 * wrong: an agent signs somebody up with a password of their own invention,
 * everything about the run looks perfect, and six months of Mostafa's care is
 * behind a password nobody wrote down.
 *
 * So this verifies the hash. It is the only check here that could not have been
 * written by reading the schema.
 *
 * ## 🔴 IT READS AND WRITES NOTHING, which is why it may be pointed at production
 *
 * It is the one verifier in this directory that is useful against the real run
 * and safe there: `verifyPassword` hashes a candidate and compares, and no row
 * is created, updated or deleted. `npm run on:production -- verify:cast`.
 *
 * ## Why a missing person is not a failure by default
 *
 * Mostafa arrives in wave 2 and Nadia in wave 3. Running this in wave 1 and
 * getting fourteen red lines would teach everybody to ignore it, which is H20:
 * a gate nobody reads. So absence is reported by wave and counted, and only
 * `--complete` turns it into a failure.
 */
import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";

import { CAST, PAYROLL, SIMULATION_PASSWORD, WITH_LOGINS } from "./_cast";
import { hostOf, reporter } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

/** Digits only, so `+20 100 900 0041` and `+201009000041` are one number. */
function digitsOf(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** The file that tells a human how many people there are. */
const CAST_DOC = "docs/simulation/01-THE-CAST.md";

/**
 * 🔴 76.55 — THE COUNT THIS DOCUMENT CLAIMS, PARSED RATHER THAN REMEMBERED.
 *
 * `01-THE-CAST.md` has a row reading `| **People** | **27** |`. This pulls the
 * number out of it. The check below then asserts it equals `CAST.length`, which
 * is the thing that was NOT true when this was written: the document said twenty
 * one and the array held nineteen, and the four people in the gap — `T5`, `T6`,
 * `P7` and `D1` — had no address, so `verify:cast` could not have reported them
 * missing, `logins.ts` could not have listed them, and the run would have found
 * out in wave 4 with the report half written.
 *
 * Every other check in this file reads the database. This one reads the two
 * places the expectation is written down and makes them argue, which is the only
 * way an expectation nobody has met gets noticed.
 */
function peopleClaimedByTheDocument(): number | null {
  let text: string;
  try {
    text = readFileSync(CAST_DOC, "utf8");
  } catch {
    return null;
  }
  const row = text.match(/\|\s*\*\*People\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/);
  return row ? Number(row[1]) : null;
}

async function main() {
  const complete = process.argv.includes("--complete");
  console.log(`reading ${hostOf()}\n`);

  const { pool, db } = connect();

  try {
    const { verifyPassword } = await import("../lib/auth/password");

    const rows = await db.execute<{
      email: string;
      role: string;
      password_hash: string;
      first_name: string;
      last_name: string;
    }>(sql`
      SELECT email, role, password_hash, first_name, last_name
        FROM users WHERE deleted_at IS NULL`);

    /*
     * 🔴 PATIENTS ARE NOT IN `users`, and a version of this that only read that
     * table would have reported every patient in the run as missing.
     *
     * A clinician is a `users` row. A patient who has claimed their record is a
     * `patient_accounts` row with its own password, its own sessions table and
     * its own sign-in page, because the two are different principals and sprint
     * 40 split them on purpose. One list of people, two tables, and the check has
     * to know that.
     */
    const accounts = await db.execute<{
      email: string | null;
      phone: string | null;
      password_hash: string | null;
    }>(sql`
      SELECT email, phone, password_hash FROM patient_accounts WHERE deleted_at IS NULL`);

    /*
     * 🔴 AND A THIRD TABLE, because `D1`'s developer is a sixth principal.
     *
     * `partner_users` has its own password, its own sessions table and its own
     * sign-in page, for the reason `lib/partner-auth/session.ts` spends forty
     * lines on: a `PartnerActor` carries no organisation id and no clinical role,
     * so there is no call site anywhere that could hand one to a chart query. A
     * version of this check that read two tables would have reported Tamer as
     * never having signed up while he sat in the third, which is the same §6
     * mistake that let patients look missing before sprint 40.
     */
    const partners = await db.execute<{ email: string; password_hash: string | null }>(sql`
      SELECT email, password_hash FROM partner_users WHERE deleted_at IS NULL`);

    const byEmail = new Map<string, { hash: string | null; what: string }>();
    for (const row of rows.rows) {
      byEmail.set(row.email.toLowerCase(), { hash: row.password_hash, what: row.role });
    }
    for (const row of accounts.rows) {
      if (row.email) {
        byEmail.set(row.email.toLowerCase(), { hash: row.password_hash, what: "patient account" });
      }
      /*
       * 🔴 76.58 — AND BY PHONE, WHICH IS THE HANDLE A PATIENT ACTUALLY HAS.
       *
       * `/patient/signup` never asks for an email and no screen lets her add
       * one, so `patient_accounts.email` is null for every patient who signs
       * herself up. A version of this check that looked only at the address
       * would have reported all seven patients as missing at the end of six
       * months, which reads as an agent who never finished a wave and is the
       * product working exactly as designed. Found by the mini simulation being
       * refused at the form.
       *
       * Stored E.164, written in the cast with spaces, so both are stripped to
       * digits before they are compared.
       */
      if (row.phone) {
        byEmail.set(digitsOf(row.phone), { hash: row.password_hash, what: "patient account, by phone" });
      }
    }
    for (const row of partners.rows) {
      byEmail.set(row.email.toLowerCase(), { hash: row.password_hash, what: "partner developer" });
    }

    const missing: string[] = [];
    const wrongPassword: string[] = [];
    const otherWayIn: string[] = [];
    const found: string[] = [];

    for (const person of WITH_LOGINS) {
      /*
       * A patient is looked up by her number first and her address second,
       * because the number is the one she was actually able to give us.
       */
      const row =
        (person.phone ? byEmail.get(digitsOf(person.phone)) : undefined) ??
        byEmail.get(person.email!.toLowerCase());
      if (!row) {
        missing.push(`${person.key} ${person.name} (wave ${person.wave})`);
        continue;
      }

      /*
       * 🔴 A NULL HASH IS NOT A FAILED PASSWORD.
       *
       * `patient_accounts.password_hash` is nullable, because a patient may hold
       * their account by phone and a one-time code and never set one. Reporting
       * that as "cannot sign in" would be wrong about the product, and reporting
       * it as fine would leave the founder unable to open the record. So it is
       * its own line, and the answer is a code to the phone rather than a bug.
       */
      if (row.hash === null) {
        otherWayIn.push(`${person.key} ${person.email}`);
        continue;
      }

      const works = await verifyPassword(SIMULATION_PASSWORD, row.hash);
      if (works) found.push(`${person.key} ${person.email} as ${row.what}`);
      else wrongPassword.push(`${person.key} ${person.email}`);
    }

    /* ------------------------------------------------------------- report -- */

    for (const line of found) console.log(`       ${line}`);
    if (found.length > 0) console.log("");

    if (otherWayIn.length > 0) {
      console.log(`       no password set, signs in by phone code: ${otherWayIn.join(", ")}\n`);
    }

    check(
      "🔴 every login that EXISTS opens with the run's one password",
      wrongPassword.length === 0,
      wrongPassword.length === 0
        ? `${found.length} of ${WITH_LOGINS.length} can sign in with ${SIMULATION_PASSWORD}`
        : `cannot sign in as: ${wrongPassword.join(", ")}. Their record is unreadable`,
    );

    check(
      complete
        ? "🔴 …and every one of them has arrived, because the run is over"
        : "who has arrived so far, which is a progress report rather than a gate",
      complete ? missing.length === 0 : true,
      missing.length === 0
        ? "all of them"
        : `${missing.length} still to sign up: ${missing.join(", ")}`,
    );

    /*
     * 🔴 THE CONTROL, and without it the check above passes on an empty database.
     *
     * "Every login that exists opens with the password" is trivially true when no
     * login exists. This is the §6 shape the repository keeps finding: a check
     * that passes by measuring nothing. So the three seeded people must be there,
     * always, because `simulate:seed` creates them before anybody acts.
     */
    const seeded = PAYROLL.map((person) => person.email!.toLowerCase());
    const seededFound = seeded.filter((email) => byEmail.has(email));

    check(
      "🔴 CONTROL every seeded login is present, so 'all fine' cannot mean 'nobody checked'",
      seededFound.length === seeded.length,
      seededFound.length === seeded.length
        ? `all ${String(seeded.length)} of us, each one able to work their own queue`
        : `only ${seededFound.length} of ${String(seeded.length)}: missing ` +
          `${seeded.filter((email) => !byEmail.has(email)).join(", ")}. ` +
          "Has simulate:seed run against this database since 76.55?",
    );

    /*
     * 🔴 AND THE ONE WHO MUST NOT BE THERE.
     *
     * `P6` Ziad Example never creates an account: three sessions through join
     * links and he stays a stranger. If an address of his turns up in either
     * table, an agent signed him up for convenience and the thinnest record in
     * the run, the one the copilot exam measures the deepest against, is not thin
     * any more.
     */
    const ziad = CAST.find((person) => person.key === "P6")!;
    const ziadSignedUp = [...byEmail.keys()].some((email) => email.startsWith("ziad."));

    check(
      "🔴 CONTROL Ziad never signed up, because that is what he is for",
      !ziadSignedUp,
      ziadSignedUp
        ? `somebody created an account for ${ziad.name}. He is the record with no account`
        : "no account, three join links, and the product still works for him",
    );

    /*
     * 🔴 THE PLANTED-ABSENCE CONTROL, and it is the one that would have caught
     * the defect this sprint was opened for.
     *
     * Everything above asks the database about people this array names. Nothing
     * above can notice a person the array DOES NOT NAME, which is exactly the
     * failure that happened: four documented cast members were absent from the
     * code, so every check was green about a cast that was four people short.
     *
     * The §6 shape, in its quietest costume: a check that is correct about what
     * it measures and silent about what it was never handed.
     */
    const claimed = peopleClaimedByTheDocument();

    check(
      `🔴 CONTROL ${CAST_DOC} and scripts/_cast.ts name the same number of people`,
      claimed !== null && claimed === CAST.length,
      claimed === null
        ? `could not read a "| **People** | **NN** |" row out of ${CAST_DOC}. ` +
          "Either the file moved or the row was reworded, and this control is now measuring nothing"
        : claimed === CAST.length
          ? `${String(claimed)}: ${String(CAST.length - PAYROLL.length)} customers with an ` +
            `agent each and ${String(PAYROLL.length)} of us on the payroll`
          : `the document says ${String(claimed)} and the code holds ${String(CAST.length)}. ` +
            "Whichever is right, somebody in the run has no address and nothing else here can see it",
    );
  } finally {
    await pool.end();
  }

  finish("sprint 76 cast");
}

main();
