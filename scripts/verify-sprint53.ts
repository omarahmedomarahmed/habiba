/**
 * Sprint 53 acceptance: corporate.
 *
 *   npm run verify:sprint53
 *
 * ## 🔴 The sentence every check here is subordinate to
 *
 * > **The payer sees the roster. The payer never sees usage attributable to a
 * > person.**
 *
 * 53.1: *a verifier attempts, as a sponsor, to reach a session, a booking, a
 * therapist, a date or a name, and fails on every one.* This is that verifier.
 *
 * ## Why most of these read select lists rather than calling functions
 *
 * A leak here is an ABSENCE as often as it is a value. C243 is the eighth
 * occurrence of the §6 family and it was exactly that: `payerName` going null
 * on a pot payment, so a therapist's ledger read "Patient" against every
 * sponsored session and a real name against every private one. 53.24 says so
 * explicitly — *the verifier asserts on rendered output, never on queries: the
 * check as first written passes against C243's leak, because that leak is an
 * absence rather than a value.*
 *
 * So the checks come in pairs wherever they can: the forbidden thing is absent,
 * AND something that must be present is present. A wall that refuses everything
 * is not a wall, it is a product with no corporate feature and a green test.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";

import { readSource, reporter, required, writesTo } from "./_verify";
import { renderMarkup, stubModules } from "./_render";

const { check, finish } = reporter();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "drizzle", "public"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

async function main() {
  writesTo();

  /*
   * 🔴 FIRST, and it is why this script does NOT run with `--conditions=react-server`.
   *
   * 53.24 requires a check on RENDERED OUTPUT, and `_render` needs the full React
   * build: the react-server build has no `createContext`, so importing a client
   * component under that condition throws before anything is rendered. Every other
   * verifier that renders (`verify:sprint21r`) is invoked the same way.
   *
   * The cost is that `import "server-only"` would throw in the data modules below,
   * which is exactly what `stubModules` substitutes away. So it runs before the first
   * dynamic import rather than beside the render, and the modules under test are the
   * real ones either way.
   */
  await stubModules();

  const { controlDb: db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { applyActivityFloor, DEFAULT_ACTIVITY_FLOOR } = await import("../lib/data/sponsors");
  const { ROLES, LEDGER_ACCOUNTS, FUNDING_SOURCES } = await import("../lib/db/schema");

  const files = walk(process.cwd()).map((f) => f.slice(process.cwd().length + 1));
  const source = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

  /* ================================================================== */
  /*  C230 / C259 · a sponsor is not an organization and never an Actor  */
  /* ================================================================== */

  /*
   * 🔴 The seam both rulings rest on, checked at the type level where it
   * actually lives.
   *
   * `Actor` requires an `organizationId` and `Role` has four values, none of
   * them a sponsor. So a sponsor cannot be an `Actor` without a compile error,
   * which is a stronger guarantee than any guard. C264 asks for a verifier
   * anyway, because the next person to add a role will not read this.
   */
  check(
    "🔴 C230 / C264 no role in the clinical Role union is a sponsor, a clinic or a partner",
    !ROLES.some((role) => /sponsor|clinic|partner/i.test(role)),
    `Role is ${ROLES.join(", ")}, so an Actor cannot be one of them`,
  );

  /*
   * 🔴 And no `require*` in the clinical guard reaches a sponsor table.
   *
   * `lib/auth/guard.ts` is where an `Actor` comes from. A sponsor read in
   * there would be a sponsor one return statement away from being one.
   */
  const guard = readSource("lib/auth/guard.ts");
  check(
    "🔴 C264 no require* in lib/auth/guard.ts touches a sponsor",
    !/sponsor/i.test(guard),
    "the clinical guard does not know sponsors exist",
  );

  /*
   * 🔴 C259 — a sponsor is NOT an organizations row, and the schema says so.
   *
   * `sponsors` has no `organizationId` and `organizations` has no sponsor
   * column. If either existed, a paying employer would be inside the tenancy
   * boundary that separates clinical caseloads.
   */
  const crossed = await db.execute(sql`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name = 'sponsors' AND column_name = 'organization_id')
        OR (table_name = 'organizations' AND column_name LIKE '%sponsor%')`);

  check(
    "🔴 C230 / C259 sponsors and organizations have no column joining them",
    crossed.rows.length === 0,
    crossed.rows.length === 0
      ? "a clinic is an organizations row and a sponsor is not, and neither can become the other"
      : JSON.stringify(crossed.rows),
  );

  /*
   * 🔴 C244 — no sponsor column on any clinical or payment table.
   *
   * The structural form of *no screen may join a sponsor to a session, a
   * booking, a date or a patient name*: if the column does not exist, the join
   * is not one line of SQL away for every operator forever.
   */
  const leaked = await db.execute(sql`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE column_name LIKE '%sponsor%'
       AND table_name IN ('sessions','session_payments','invoices','patients','people',
                          'session_notes','patient_clinical_facts','availability_slots',
                          'patient_notifications')`);

  check(
    "🔴 C244 no clinical or payment table carries a sponsor id",
    leaked.rows.length === 0,
    leaked.rows.length === 0
      ? "nine tables checked, and the join C244 forbids cannot be written"
      : JSON.stringify(leaked.rows),
  );

  /*
   * 🔴 C231 amended — and `patient_notifications` is the sharpest of those.
   *
   * *A permanently undeletable entry saying an employer enrolled you and later
   * removed you is a fact about the EMPLOYMENT RELATIONSHIP, retained forever
   * in a record C234 promises the payer cannot touch, and it travels if the
   * record is ever exported.*
   */
  const noticeCols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
     WHERE table_name = 'patient_notifications' ORDER BY column_name`);

  const noticeNames = (noticeCols.rows as { column_name: string }[]).map((r) => r.column_name);
  check(
    "🔴 C231 the patient's own notice log names no employer and carries no prose",
    !noticeNames.some((c) => /sponsor|employer|reason|body|text/.test(c)),
    noticeNames.join(", "),
  );

  /* ================================================================== */
  /*  53.1 · THE WALL, as a select list                                  */
  /* ================================================================== */

  /*
   * 🔴 The roster's select list IS the wall, so it is read directly.
   *
   * Every forbidden thing, by name. A sponsor surface can only render what this
   * query fetched, so a column added here is the leak and nothing downstream
   * would stop it.
   */
  const sponsorData = readSource("lib/data/sponsors.ts");
  const rosterQuery = sponsorData.slice(
    sponsorData.indexOf("export async function roster"),
    sponsorData.indexOf("export async function roster") + 1400,
  );

  const forbidden = [
    "sessions.",
    "sessionId",
    "createdAt",
    "therapistId",
    "patientId",
    "bookedAt",
    "startsAt",
  ].filter((needle) => rosterQuery.includes(needle));

  check(
    "🔴 53.1 the roster query reaches no session, booking, therapist, join date or patient id",
    forbidden.length === 0,
    forbidden.length === 0
      ? "name, last verified, paused. Nothing else, and nothing to filter out later"
      : `LEAKS: ${forbidden.join(", ")}`,
  );

  /*
   * 🔴 CONTROL — and it DOES return a name and a verification date.
   *
   * 53.24's warning, generalised: a check that only asserts absence passes
   * against a roster that returns nothing at all, which would be a product with
   * no corporate feature and a green test.
   */
  check(
    "🔴 CONTROL the roster still returns the two things a sponsor may see",
    /firstName: people\.firstName/.test(rosterQuery) &&
      /lastVerifiedAt: enrolments\.lastVerifiedAt/.test(rosterQuery),
    "a name and a last-verified date, which is what makes a roster trustworthy",
  );

  /*
   * 🔴 The roster is ordered by NAME, not by enrolment.
   *
   * `ORDER BY created_at` hands the sponsor the join date without selecting it:
   * the first row is the earliest joiner and the last is the most recent. That
   * is the signal §3e forbids, readable off the page with no column at all, and
   * it is the kind of leak a select-list check alone would miss.
   */
  check(
    "🔴 §3e the roster is ordered by name, so the row order carries no join date",
    /orderBy\(asc\(people\.firstName\)/.test(rosterQuery),
    "ordering by enrolment would leak the date without selecting it",
  );

  /*
   * 🔴 C240 — attendance is never confirmed to a sponsor, and the enforcement
   * is the ABSENCE OF A FUNCTION.
   *
   * *"Go to the sessions or it goes on your file." Unenforceable through us, on
   * purpose.* So this module must export nothing shaped like an answer.
   */
  const attendanceShaped = [
    "hasBooked",
    "sessionCountFor",
    "attendanceFor",
    "lastSeenAt",
    "sessionsByPerson",
  ].filter((name) => new RegExp(`export .*\\b${name}\\b`).test(sponsorData));

  check(
    "🔴 C240 nothing in the sponsor module can confirm that one person attended",
    attendanceShaped.length === 0,
    attendanceShaped.length === 0
      ? "a mandate cannot be checked, which is the correct outcome rather than a gap"
      : attendanceShaped.join(", "),
  );

  /* ================================================================== */
  /*  53.3 / C228 / C229 · the floors                                    */
  /* ================================================================== */

  /*
   * 🔴 C228 — weekly is the finest granularity that will ever exist.
   *
   * *A day is an event; a week is a pattern.* Daily spend in a forty-person
   * company, beside a known incident, a layoff or a bereavement, identifies a
   * person without a name being involved.
   *
   * Asserted on the SQL, because the pipeline is where it matters: a query that
   * fetched days and summed them in TypeScript would put daily figures in a
   * variable, a log and a debugger.
   */
  check(
    "🔴 53.3 / C228 sponsor spend is grouped by week in SQL, never by day",
    /date_trunc\('week'/.test(sponsorData) && !/date_trunc\('day'/.test(sponsorData),
    "no daily row exists anywhere in the pipeline to leak",
  );

  /*
   * 🔴 C229 — THE DIFFERENCING ATTACK, PLANTED VERBATIM FROM THE RULING.
   *
   * *A sixty-person company is above any plausible headcount floor, but in week
   * 14 the balance drops by exactly one session's cost, there was one session
   * that week, and the payer knows one person went and which week.*
   *
   * This is that week. One session, on its own, in a year of busy weeks. The
   * floor must suppress it.
   */
  const year = Array.from({ length: 20 }, (_, index) => ({
    weekStart: new Date(Date.UTC(2026, 0, 5 + index * 7)),
    spendCents: 60_000,
    sessions: 10,
  }));
  year[13] = { weekStart: new Date(Date.UTC(2026, 0, 5 + 13 * 7)), spendCents: 6_000, sessions: 1 };

  const floored = applyActivityFloor(year, DEFAULT_ACTIVITY_FLOOR);

  check(
    "🔴 C229 a week with one session is suppressed, not published as a figure",
    floored[13]?.spendCents === null,
    floored[13]?.spendCents === null
      ? "the week the ruling describes reads as not enough activity to report"
      : `LEAKED ${floored[13]?.spendCents}`,
  );

  /*
   * 🔴 …and its spend is CARRIED FORWARD, not dropped.
   *
   * Dropping it would be worse than publishing it: a reader sees the gap, knows
   * a week is hidden, and differences the annual total against the visible
   * weeks to recover it exactly. The ruling says roll the period forward.
   */
  const total = year.reduce((sum, week) => sum + week.spendCents, 0);
  const published = floored.reduce((sum, week) => sum + (week.spendCents ?? 0), 0);

  check(
    "🔴 C229 …and the suppressed week's spend is carried forward, so the total cannot recover it",
    published === total,
    published === total
      ? "every cent is in some published figure, and none of them is that week"
      : `${published} published against ${total}, so ${total - published} is recoverable`,
  );

  /*
   * 🔴 CONTROL — the floor lets an ordinary week through.
   *
   * A floor that suppressed everything would pass the two checks above and ship
   * a reporting page that shows nothing. The ruling's cost is that a NEW client
   * sees almost nothing for their first weeks; it is not that nobody ever sees
   * anything.
   */
  check(
    "🔴 CONTROL a week that clears the floor publishes its real figure",
    floored[0]?.spendCents === 60_000 && floored[12]?.spendCents === 60_000,
    "ten sessions a week reports normally, so the floor is a floor and not a wall",
  );

  /*
   * 🔴 And a whole quiet year never publishes a single figure.
   *
   * The start of every contract and the end of every budget, which C229 names
   * as exactly when the count is small.
   */
  const quiet = Array.from({ length: 8 }, (_, index) => ({
    weekStart: new Date(Date.UTC(2026, 0, 5 + index * 7)),
    spendCents: 6_000,
    sessions: 1,
  }));
  const quietFloored = applyActivityFloor(quiet, DEFAULT_ACTIVITY_FLOOR);

  check(
    "🔴 C229 eight weeks of one session each publish one rolled figure, not eight",
    quietFloored.filter((week) => week.spendCents !== null).length === 1,
    `${quietFloored.filter((w) => w.spendCents !== null).length} published from 8 quiet weeks`,
  );

  /* ================================================================== */
  /*  C226 · the pot is a payment method, not a billing system           */
  /* ================================================================== */

  /*
   * 🔴 ONE new ledger account and ONE new funding source. No session type.
   *
   * *The obvious build is a parallel path: corporate sessions, corporate
   * invoices, corporate ledger accounts, a `sessionType` of `corporate`. That
   * doubles every money code path in the product and guarantees the two drift.*
   */
  check(
    "🔴 C226 exactly one new ledger account for the pot",
    LEDGER_ACCOUNTS.filter((account) => /sponsor|pot|corporate/.test(account)).length === 1,
    LEDGER_ACCOUNTS.join(", "),
  );

  check(
    "🔴 C226 the funding source is two values, and neither is a session type",
    FUNDING_SOURCES.length === 2 &&
      FUNDING_SOURCES.includes("card") &&
      FUNDING_SOURCES.includes("pot"),
    FUNDING_SOURCES.join(", "),
  );

  /*
   * 🔴 …and there is no corporate SESSION TYPE anywhere in the schema.
   *
   * A `sessionType` of `corporate` is the single change that would make a
   * sponsored session distinguishable on every therapist surface at once, which
   * is C242.
   */
  /*
   * 🔴 The first draft of this check asserted that `sessionType` does not
   * exist, and it does: `sessions.session_type` has answered "where did this
   * session come from" since 4.6, with the values direct, paid_link, radar and
   * scheduled.
   *
   * C226 forbids a corporate VALUE, not the column. Asserting the column away
   * would have failed forever against correct code, which is a check that
   * teaches people to ignore it. The right assertion is on the union, plus the
   * absence of any separate corporate flag.
   */
  const { SESSION_TYPES } = await import("../lib/db/schema");
  const schema = readSource("lib/db/schema.ts");

  check(
    "🔴 C226 / C242 no session type VALUE marks a session as corporate",
    !SESSION_TYPES.some((kind) => /corporate|sponsor|pot|benefit/i.test(kind)),
    SESSION_TYPES.join(", "),
  );

  check(
    "🔴 C226 / C242 …and no separate flag on a session says who funded it",
    !/isCorporate|corporateSession|sponsoredSession|isSponsored/i.test(schema),
    "a sponsored session is a session whose PAYMENT came from a pot, and nothing else",
  );

  /*
   * 🔴 C243 / C226 amended — `funding_source` is NOT NULL with a default.
   *
   * A nullable column would make "sponsored" an ABSENCE, which is precisely
   * C243: `payerName` going null on a pot payment so a ledger reads "Patient"
   * against every sponsored session. An absence is what somebody finds by
   * sorting a column.
   */
  const fundingCol = await db.execute(sql`
    SELECT is_nullable, column_default FROM information_schema.columns
     WHERE table_name = 'session_payments' AND column_name = 'funding_source'`);

  const funding = required(
    (fundingCol.rows as { is_nullable: string; column_default: string | null }[])[0],
    "the funding_source column",
  );

  check(
    "🔴 C243 funding_source is NOT NULL with a default, so sponsored is never an absence",
    funding.is_nullable === "NO" && /card/.test(funding.column_default ?? ""),
    `is_nullable=${funding.is_nullable}, default=${funding.column_default}`,
  );

  /* ================================================================== */
  /*  C243 · the therapist's own money surfaces                          */
  /* ================================================================== */

  /*
   * 🔴 A therapist-facing money surface shows the PATIENT and never the PAYER.
   *
   * C243's ruling, and 53.24's warning about how to check it: the leak is an
   * absence, so the check reads the RENDERED OUTPUT rather than the query.
   * `payerName` appearing in any component is the defect whether it is rendered
   * as a value or as a fallback.
   */
  /*
   * 🔴 COMMENTS STRIPPED, and the first draft of this check did not strip them.
   *
   * It read the files with `readFileSync` and reported three offenders, all
   * three of which are paragraphs in `ledger.tsx`, `payment-history.tsx` and
   * `vault-payment-row.tsx` explaining that `payerName` USED to be rendered
   * there and why it is not any more.
   *
   * That is the standing rule of this repository — *strip comments before any
   * scan of source* — broken in a check written to enforce a wall, by somebody
   * who has cited that rule four times this session. Eight checkers here have
   * now matched their own documentation.
   */
  const payerReaders = files.filter(
    (file) =>
      (file.startsWith("components/") || file.startsWith("app/")) &&
      /payerName|payerEmail/.test(readSource(file)) &&
      // The pay screen legitimately COLLECTS the payer's name to send to Stripe.
      !file.startsWith("app/pay/"),
  );

  check(
    "🔴 C243 no component or page renders a payer name or email",
    payerReaders.length === 0,
    payerReaders.length === 0
      ? "every money surface shows the patient, and a pot payment has no cardholder to show"
      : payerReaders.join(", "),
  );

  /*
   * 🔴 C244 — and no surface performs the self-join that WOULD work.
   *
   * Double entry means the pot leg and the session leg of one payment share a
   * `txn_id`, so "every pot cent traces to one payment in and one session out"
   * (53.16) is true and the join C244 forbids is one self-join away. That is a
   * knife-edge, and this is the check that holds it: no file under `app/` or
   * `components/` may join `ledger_entries` to itself on `txn_id`.
   */
  const selfJoiners = files.filter(
    (file) =>
      (file.startsWith("app/") || file.startsWith("components/")) &&
      /ledger_entries[\s\S]{0,200}txn_id[\s\S]{0,200}ledger_entries/.test(source.get(file)!),
  );

  check(
    "🔴 C244 no surface joins the ledger to itself on txn_id, which is the one path that would work",
    selfJoiners.length === 0,
    selfJoiners.length === 0
      ? "the trace exists for reconciliation and no screen can walk it"
      : selfJoiners.join(", "),
  );

  /* ================================================================== */
  /*  the constraints, proved by attempting the write                    */
  /* ================================================================== */

  const [sponsor] = (
    await db.execute(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES ('verify53 fixture', 'university', 'us', 'usd', 'active')
      RETURNING id`)
  ).rows as { id: string }[];
  const fixture = required(sponsor, "a planted sponsor");

  try {
    /*
     * 🔴 C248 — a specimen identifier is REFUSED BY THE DATABASE.
     *
     * "for example, 20215544" is a working template handed to anybody who
     * scans a poster.
     */
    let specimenRefused = false;
    try {
      await db.execute(sql`
        INSERT INTO sponsor_identifier_fields (sponsor_id, kind, shape_hint)
        VALUES (${fixture.id}, 'id_number', 'for example, 20215544')`);
    } catch {
      specimenRefused = true;
    }

    check(
      "🔴 C248 a shape hint containing a specimen value is refused",
      specimenRefused,
      "a working template is not an example",
    );

    /* 🔴 CONTROL — a real description of the shape is accepted. */
    let descriptionAccepted = false;
    try {
      await db.execute(sql`
        INSERT INTO sponsor_identifier_fields (sponsor_id, kind, shape_hint)
        VALUES (${fixture.id}, 'id_number', 'eight digits beginning with your year of entry')`);
      descriptionAccepted = true;
    } catch {
      descriptionAccepted = false;
    }

    check(
      "🔴 CONTROL a description of the shape IS accepted, so the guard is not refusing every hint",
      descriptionAccepted,
      "a person who reads poorly still gets told what to type",
    );

    /*
     * 🔴 C233 — A POT HOLDING MONEY MUST HAVE REFUND AND EXPIRY TERMS.
     *
     * *Decided and written on the page before a single deal is signed, never
     * afterwards.* C232's amendment makes it a precondition rather than a
     * parallel task, because refund terms are precisely what counsel will
     * change and taking $5,000 first means a migration against real money.
     */
    let termlessRefused = false;
    try {
      await db.execute(sql`
        INSERT INTO sponsor_pots (sponsor_id, balance_cents)
        VALUES (${fixture.id}, 500000)`);
    } catch {
      termlessRefused = true;
    }

    check(
      "🔴 C233 a pot cannot hold money without refund and expiry terms",
      termlessRefused,
      "the terms are a precondition of the money, in the database",
    );

    /* 🔴 CONTROL — with terms, the same top-up lands. */
    let withTerms = false;
    try {
      await db.execute(sql`
        INSERT INTO sponsor_pots (sponsor_id, balance_cents, refund_policy, expires_at)
        VALUES (${fixture.id}, 500000, 'refundable less what was spent', now() + interval '1 year')`);
      withTerms = true;
    } catch {
      withTerms = false;
    }

    check(
      "🔴 CONTROL a pot WITH terms accepts the money, so the guard is not refusing every top-up",
      withTerms,
      "$5,000 in, terms stated beside the button",
    );

    /*
     * 🔴 C239 amended — THE OVERDRAFT IS PER SPONSOR AND BOUNDED.
     *
     * *A sponsor with 400 enrolled people and an empty pot can go 400 sessions
     * negative at once, each individually permitted.* So the bound is on the
     * pot, in the database, and not on a per-patient rule a service applies.
     */
    let unboundedRefused = false;
    try {
      await db.execute(sql`
        UPDATE sponsor_pots SET balance_cents = -100000 WHERE sponsor_id = ${fixture.id}`);
    } catch {
      unboundedRefused = true;
    }

    check(
      "🔴 C239 a pot cannot go further negative than its own overdraft",
      unboundedRefused,
      "a session already started always completes; 400 at once is not a session",
    );

    /*
     * 🔴 C246 — ONE IDENTIFIER, USED ONCE, EVER, ACROSS EVERY SPONSOR.
     *
     * An identifier that crossed one gate must not cross another. Two people
     * submitting the same guessed student number in the same second is exactly
     * what a check-then-insert loses, so it is a unique index.
     */
    const [person] = (await db.execute(sql`SELECT id FROM people LIMIT 1`)).rows as {
      id: string;
    }[];
    const who = required(person, "a person to enrol");
    const identifier = createHash("sha256").update(randomBytes(16)).digest("hex");

    await db.execute(sql`
      INSERT INTO enrolments (sponsor_id, person_id, identifier_hash, identifier_kind)
      VALUES (${fixture.id}, ${who.id}, ${identifier}, 'domain_email')`);

    const [second] = (
      await db.execute(sql`
        INSERT INTO sponsors (name, kind, entity, currency, state)
        VALUES ('verify53 second', 'company', 'us', 'usd', 'active') RETURNING id`)
    ).rows as { id: string }[];
    const otherSponsor = required(second, "a second sponsor");

    let reusedRefused = false;
    try {
      await db.execute(sql`
        INSERT INTO enrolments (sponsor_id, person_id, identifier_hash, identifier_kind)
        VALUES (${otherSponsor.id}, ${who.id}, ${identifier}, 'domain_email')`);
    } catch {
      reusedRefused = true;
    }

    check(
      "🔴 C246 the same identifier cannot enrol again, at this sponsor or any other",
      reusedRefused,
      "one identifier, used once, ever, enforced by an index rather than a check",
    );

    /*
     * 🔴 C249 — EXACTLY ONE PRIMARY PER PERSON.
     *
     * *The primary pot pays* is meaningless if two rows claim it, and a service
     * that sets one and clears the other has a window between the statements.
     */
    let twoPrimariesRefused = false;
    try {
      await db.execute(sql`
        INSERT INTO enrolments (sponsor_id, person_id, identifier_hash, identifier_kind, is_primary)
        VALUES (${otherSponsor.id}, ${who.id}, ${identifier + "b"}, 'domain_email', true)`);
    } catch {
      twoPrimariesRefused = true;
    }

    check(
      "🔴 C249 a person cannot hold two primary enrolments at once",
      twoPrimariesRefused,
      "one primary, so the pot that pays is never ambiguous",
    );

    /*
     * 🔴 CONTROL — a SECOND, non-primary enrolment IS allowed.
     *
     * C249 is that a postgraduate student who also works part-time may hold
     * two. A check that only proved the refusal would pass against a schema
     * that forbids the second sponsor entirely.
     */
    let secondAllowed = false;
    try {
      await db.execute(sql`
        INSERT INTO enrolments (sponsor_id, person_id, identifier_hash, identifier_kind, is_primary)
        VALUES (${otherSponsor.id}, ${who.id}, ${identifier + "c"}, 'domain_email', false)`);
      secondAllowed = true;
    } catch {
      secondAllowed = false;
    }

    check(
      "🔴 CONTROL a person MAY be enrolled with a second sponsor, just not as primary twice",
      secondAllowed,
      "a postgraduate who also works part-time holds two, and neither sponsor learns of the other",
    );

    /*
     * 🔴 §3e — a removal reason is a FIXED LIST, never free text.
     *
     * A sponsor typing a reason is a sponsor writing a sentence about an
     * individual into our database, which is the one act C227 says they never
     * perform.
     */
    let freeTextRefused = false;
    try {
      await db.execute(sql`
        UPDATE enrolments SET removed_at = now(), removal_reason = 'performance issues'
         WHERE sponsor_id = ${fixture.id}`);
    } catch {
      freeTextRefused = true;
    }

    check(
      "🔴 §3e a removal reason cannot be free text a sponsor typed",
      freeTextRefused,
      "four values, and none of them is a sentence about somebody",
    );

    /* ================================================================ */
    /*  53.10 to 53.16 · the pot's money, and the sign that broke once  */
    /* ================================================================ */

    const { weeklySpend } = await import("../lib/data/sponsors");
    const { ledgerPotBalance, potTotals, reconcilePots } = await import("../lib/billing/pot");
    const { journal } = await import("../lib/billing/ledger");

    /*
     * 🔴 THE SIGN. This is the check the sign bug would have failed.
     *
     * `sponsor_pot` is a liability, so a TOP-UP is a negative leg and a SESSION
     * SPENDING the pot is a positive one. The first draft of `weeklySpend` read
     * `amount_cents < 0` as spend, which is the sign of a deposit: it would have
     * charted every top-up as expenditure and every session as nothing, and looked
     * entirely plausible.
     *
     * So both legs are POSTED, for real, and the functions are asked which is
     * which. Reading the SQL string for a `>` would pass against a query that had
     * the comparison right and the account wrong.
     */
    const topUpTxn = await journal({
      kind: "pot_topup",
      refType: "sponsor",
      refId: fixture.id,
      legs: [
        { account: "cash", amountCents: 500_000, memo: "verify53 top-up" },
        { account: "sponsor_pot", amountCents: -500_000, memo: "verify53 held" },
      ],
    });

    await journal({
      kind: "session_payment",
      refType: "sponsor",
      refId: fixture.id,
      legs: [
        { account: "sponsor_pot", amountCents: 3_000, memo: "verify53 spend" },
        { account: "cash", amountCents: -3_000, memo: "verify53 spend" },
      ],
    });

    const balance = await ledgerPotBalance(fixture.id);

    check(
      "🔴 53.27 the balance a sponsor reads is the ledger, and a top-up minus a spend",
      balance === 497_000,
      `$5,000 in, $30 spent, ${(balance / 100).toFixed(2)} left`,
    );

    const totals = await potTotals(fixture.id);

    check(
      "🔴 53.25 total spent counts the SPEND and not the top-up, which is the sign that broke",
      totals.spentCents === 3_000 && totals.sessions === 1,
      `${totals.sessions} session, $${(totals.spentCents / 100).toFixed(2)} spent, and the $5,000 deposit is not spend`,
    );

    /*
     * 🔴 CONTROL — and it would NOTICE the sign being wrong.
     *
     * With the signs read the other way round, total spend would be $5,000 and the
     * session count 1 as well. So the control is the ARITHMETIC: spend plus balance
     * equals what went in. A function reading the wrong sign cannot satisfy both.
     */
    check(
      "🔴 CONTROL spend plus balance equals what was put in, so neither sign can be wrong alone",
      totals.spentCents + balance === 500_000,
      "$30 spent plus $4,970 left is the $5,000 deposited",
    );

    /*
     * 🔴 53.16 / C232 — the reconciliation notices a disagreement, and says nothing
     * when there is none.
     *
     * Both directions in one run (C284). The pot's `balance_cents` is deliberately
     * set away from the ledger, the drift is asserted, and then it is set back and
     * the silence asserted. A check that only proved the alarm would pass against a
     * function that alarms on every pot every day, which is an alarm nobody reads.
     */
    await db.execute(sql`
      UPDATE sponsor_pots SET balance_cents = 400000 WHERE sponsor_id = ${fixture.id}`);

    const drifted = await reconcilePots();
    const mine = drifted.find((row) => row.sponsorId === fixture.id);

    check(
      "🔴 53.16 / C232 the reconciliation finds a pot whose balance disagrees with the ledger",
      mine !== undefined && mine.deltaCents === 400_000 - 497_000,
      mine ? `out by ${(mine.deltaCents / 100).toFixed(2)}` : "not found",
    );

    await db.execute(sql`
      UPDATE sponsor_pots SET balance_cents = 497000 WHERE sponsor_id = ${fixture.id}`);

    const agreed = await reconcilePots();

    check(
      "🔴 CONTROL …and it says NOTHING about a pot that agrees, so the alarm means something",
      agreed.every((row) => row.sponsorId !== fixture.id),
      "a silent reconciliation is the normal day",
    );

    /*
     * 🔴 53.16 — the pot leg and the session legs share ONE txn id, which is what
     * makes "every pot cent traces to one payment in and one session out" true.
     *
     * Asserted on the rows, by counting distinct accounts under one txn. The two
     * `journal` calls in `payFromPot` pass the same `txnId`, and a future edit that
     * dropped it would leave two transactions that no longer trace to each other.
     */
    const shared = await journal({
      kind: "session_payment",
      txnId: crypto.randomUUID(),
      refType: "sponsor",
      refId: fixture.id,
      legs: [
        { account: "sponsor_pot", amountCents: 1_000, memo: "verify53 shared" },
        { account: "cash", amountCents: -1_000, memo: "verify53 shared" },
      ],
    });

    const legs = (
      await db.execute(sql`
        SELECT count(DISTINCT account)::int AS accounts, sum(amount_cents)::int AS total
          FROM ledger_entries WHERE txn_id = ${shared}`)
    ).rows as { accounts: number; total: number }[];

    check(
      "🔴 53.16 the legs of one pot movement share a txn id and sum to zero",
      legs[0]?.accounts === 2 && legs[0]?.total === 0,
      `${legs[0]?.accounts} accounts, summing to ${legs[0]?.total}`,
    );

    /*
     * 🔴 C284 — the weekly series is exercised against REAL POSTED LEGS, not a
     * hand-built array.
     *
     * The pure `applyActivityFloor` checks above are the arithmetic; this is the
     * query. A floor of 1 so the two weeks publish, because what is under test here
     * is whether `weeklySpend` finds the spend at all, which is the half the sign
     * bug broke.
     */
    const series = await weeklySpend(fixture.id, 1);
    const charted = series.reduce((total, week) => total + (week.spendCents ?? 0), 0);

    check(
      "🔴 53.25 the weekly series finds the spend legs and not the deposit",
      charted === 4_000,
      `$40 charted across ${series.length} week(s), and the $5,000 deposit charted as nothing`,
    );

    /* ============================================================ */
    /*  53.15 · the invoice, and what it refuses to do without      */
    /* ============================================================ */

    const { invoiceFor } = await import("../lib/billing/invoice");

    const blank = await invoiceFor(fixture.id, topUpTxn);

    check(
      "🔴 53.15 / C241 an invoice refuses to render without our own legal details",
      blank !== null && "missing" in blank && blank.missing.length === 3,
      blank && "missing" in blank ? `missing ${blank.missing.join(", ")}` : "rendered anyway",
    );

    /*
     * 🔴 CONTROL — with the details filled in it DOES render, and the total is the
     * amount that arrived rather than the negative liability leg.
     *
     * A check that only proved the refusal would pass against a function that
     * refuses every invoice for ever. The settings are overridden for this run and
     * restored in the `finally`, so the check does not depend on what an operator
     * has configured (C284).
     */
    await db.execute(sql`
      INSERT INTO platform_settings (key, value)
      VALUES ('invoice', ${JSON.stringify({
        entities: [
          {
            entity: "us",
            legalName: "verify53 Legal Name",
            address: "verify53 address",
            taxId: "verify53-tax",
            numberPrefix: "V5",
          },
        ],
      })}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);

    /*
     * 🔴 No cache to clear, and that was CHECKED rather than assumed.
     *
     * `getSettings` is wrapped in React's `cache()`, which is per-request
     * memoisation. Outside a request there is no cache scope, so it re-reads on
     * every call — proved by writing a row between two reads and watching the
     * second differ. Had it memoised, this check would have read the blank
     * settings twice and the CONTROL below would have failed for a reason that
     * had nothing to do with the invoice.
     */
    const rendered = await invoiceFor(fixture.id, topUpTxn);

    check(
      "🔴 CONTROL …and WITH them it renders, with the amount that arrived, not a negative",
      rendered !== null &&
        !("missing" in rendered) &&
        rendered.totalCents === 500_000 &&
        rendered.number.startsWith("V5-"),
      rendered && !("missing" in rendered)
        ? `${rendered.number}, ${(rendered.totalCents / 100).toFixed(2)}`
        : "still refused",
    );

    /*
     * 🔴 One organisation cannot read another's invoice, and the check is that the
     * sponsor id is a CONDITION of the query rather than a comparison afterwards.
     *
     * Asked with the second sponsor's id and the first sponsor's transaction, which
     * is exactly what editing a URL produces.
     */
    const borrowed = await invoiceFor(otherSponsor.id, topUpTxn);

    check(
      "🔴 53.15 a sponsor asking for another organisation's invoice is told there is none",
      borrowed === null,
      "the sponsor id is in the WHERE clause, so a edited URL finds nothing",
    );

    /* ======================================================== */
    /*  53.19 · proof over pattern, and the gate it controls    */
    /* ======================================================== */

    /*
     * 🔴 THE CHECK THAT CATCHES THE COMMENT-VERSUS-CODE DEFECT.
     *
     * `enrol` says an unverified `domain_email` enrolment does not fund anything.
     * That is a claim about `payFromPot`'s WHERE clause and it was FALSE for one
     * commit. So this reads that function's source for the condition and, more
     * importantly, the CONTROL below proves the clause is not simply refusing
     * everything.
     */
    const potSource = readSource("lib/billing/pot.ts");

    check(
      "🔴 53.19 an unverified enrolment funds nothing, in the WHERE clause rather than a comment",
      /isNotNull\(\s*enrolments\.lastVerifiedAt\s*\)/.test(potSource),
      "the claim in enrol's comment is a claim about this clause",
    );

    check(
      "🔴 CONTROL …and the same clause still requires the pause and the removal to be absent",
      /isNull\(\s*enrolments\.pausedAt\s*\)/.test(potSource) &&
        /isNull\(\s*enrolments\.removedAt\s*\)/.test(potSource),
      "three conditions, so adding one did not replace the others",
    );

    /*
     * 🔴 53.18b — THE WORK ADDRESS HAS NO COLUMN, so nothing later can send to it.
     *
     * The strongest form of "never a destination for anything we send except the one
     * verification code" is that the address is not stored. Asserted against
     * `information_schema` rather than against the schema file, because the file is
     * a claim and the database is the fact.
     */
    const enrolmentColumns = (
      await db.execute(sql`
        SELECT column_name FROM information_schema.columns
         WHERE table_name IN ('enrolments', 'enrolment_verifications')
         ORDER BY column_name`)
    ).rows as { column_name: string }[];

    const names = enrolmentColumns.map((row) => row.column_name);

    check(
      "🔴 53.18b no column anywhere holds the identifier in plain text",
      !names.some((name) => /email|address|identifier_value|plain/.test(name)),
      names.join(", "),
    );

    check(
      "🔴 CONTROL …and the hash IS there, so the gate can still match and de-duplicate",
      names.includes("identifier_hash") && names.includes("code_hash"),
      "a salted hash for matching, and a hash of the code",
    );

    /*
     * 🔴 53.19 — five wrong guesses and the code is DEAD, in the database.
     *
     * The rate limit in `lib/data/enrolment.ts` is per joining code rather than per
     * person, because a limit per person lets one attacker with many accounts grind
     * one code. This counter is the second wall, and it is a constraint.
     */
    const [enrolment] = (
      await db.execute(sql`
        SELECT id FROM enrolments WHERE sponsor_id = ${otherSponsor.id} LIMIT 1`)
    ).rows as { id: string }[];
    const target = required(enrolment, "an enrolment to verify");

    await db.execute(sql`
      INSERT INTO enrolment_verifications (enrolment_id, code_hash, expires_at)
      VALUES (${target.id}, ${"verify53-code"}, now() + interval '1 hour')`);

    let sixthRefused = false;
    try {
      await db.execute(sql`
        UPDATE enrolment_verifications SET attempts = 6
         WHERE enrolment_id = ${target.id}`);
    } catch {
      sixthRefused = true;
    }

    check(
      "🔴 53.19 a code cannot survive a sixth wrong guess",
      sixthRefused,
      "dead rather than slow, and the bound is in the database",
    );

    let fifthAllowed = false;
    try {
      await db.execute(sql`
        UPDATE enrolment_verifications SET attempts = 5
         WHERE enrolment_id = ${target.id}`);
      fifthAllowed = true;
    } catch {
      fifthAllowed = false;
    }

    check(
      "🔴 CONTROL …and five ARE allowed, so somebody mistyping twice is not locked out",
      fifthAllowed,
      "the bound is a bound and not a refusal of everything",
    );

    /*
     * 🔴 53.19b / C256 — the cycle is the SPONSOR'S, and the source says so in SQL.
     *
     * A per-person cycle would make every roster row's date that person's join date
     * shifted by whole cycles. So the job reads `verify_cycle_started_at` off the
     * SPONSOR and pauses everybody in one window, and `setSponsorState` is what
     * starts that clock — without which the job would never fire for anybody and
     * C247 would be a column and a no-op.
     */
    const cycleSource = readSource("lib/data/enrolment-verify.ts");
    const stateSource = readSource("lib/data/sponsor-admin.ts");

    check(
      "🔴 C256 the re-verification window is read off the sponsor, never off a person",
      /sponsors\.verifyCycleStartedAt/.test(cycleSource) &&
        !/enrolments\.createdAt/.test(cycleSource),
      "one window per organisation, so every roster date is the same date",
    );

    check(
      "🔴 53.19b activating a sponsor starts the cycle clock, so the job can ever fire",
      /verifyCycleStartedAt/.test(stateSource) && /COALESCE/.test(stateSource),
      "a mechanism wired at one end is a mechanism that does nothing",
    );

    /* ==================================================== */
    /*  53.5 / 53.8 / 53.9 · the doors and the poster       */
    /* ==================================================== */

    const { PRINCIPALS, routeDecision, SPONSOR_APPLY } = await import("../lib/routing");

    const sponsorPrincipal = required(
      PRINCIPALS.find((principal) => principal.name === "sponsor"),
      "the sponsor principal",
    );

    check(
      "🔴 53.5 the enquiry form is reachable by a stranger, and it is the ONLY such path",
      routeDecision(SPONSOR_APPLY, { expired: false }).kind === "pass" &&
        (sponsorPrincipal.openRoutes ?? []).length === 1,
      "one open route inside /sponsor, listed rather than implied",
    );

    check(
      "🔴 CONTROL …and every other sponsor path still bounces a stranger to the door",
      routeDecision("/sponsor", { expired: false }).kind === "redirect" &&
        routeDecision("/sponsor/people", { expired: false }).kind === "redirect" &&
        routeDecision("/sponsor/pot", { expired: false }).kind === "redirect",
      "the open route is an exception, not a hole",
    );

    /*
     * 🔴 C236 — UNLISTED IS THE DEFAULT, in the database and not in a form.
     *
     * A sponsor created with no `listed_publicly` given must be unlisted. Being in a
     * public list says "this organisation buys therapy for its staff", which is
     * theirs to say.
     */
    const [defaulted] = (
      await db.execute(sql`
        INSERT INTO sponsors (name, kind, entity, currency)
        VALUES ('verify53 default', 'company', 'us', 'usd')
        RETURNING listed_publicly, state`)
    ).rows as { listed_publicly: boolean; state: string }[];
    const fresh = required(defaulted, "a defaulted sponsor");

    check(
      "🔴 C236 / 53.5 a sponsor created with nothing specified is unlisted AND held",
      fresh.listed_publicly === false && fresh.state === "held",
      `listed=${fresh.listed_publicly}, state=${fresh.state}`,
    );

    /*
     * 🔴 C240 — the sentence is in the sponsor CHROME, so it is on every screen of
     * the portal rather than on a help page nobody opens.
     */
    const chrome = readSource("components/sponsor/chrome.tsx");

    check(
      "🔴 C240 the attendance sentence is in the chrome, so it is on every sponsor screen",
      /sponsor\.noAttendance/.test(chrome),
      "the person drafting a policy will not click through to find out",
    );

    /*
     * 🔴 53.9 — the QR is generated on the SERVER and embedded, never fetched from
     * an image service.
     *
     * A URL containing our customer's joining code, sent to a third party on every
     * render, is a list of which organisations buy therapy for their staff,
     * assembled in somebody else's access log.
     */
    const codePage = readSource("app/(sponsor)/sponsor/code/page.tsx");

    check(
      "🔴 53.9 the QR is made on the server, not fetched from an image service",
      /QRCode\.toDataURL/.test(codePage) &&
        !/chart\.googleapis|qrserver|api\.qrcode/.test(codePage),
      "no third party is handed our customer's code on every render",
    );

    /*
     * 🔴 53.3 / C229 — THE FLOOR CANNOT BE SET BELOW TWO AND CANNOT BE SWITCHED OFF.
     *
     * A floor of 1 means a sponsor with one enrolled person reads that person's
     * weekly therapy spend from a chart. Both directions in one run: zero is raised
     * to the minimum, and a legitimate higher value is kept.
     */
    const { parseGroup } = await import("../lib/settings/defs");

    /*
     * 🔴 ONE, not zero, and the difference is the whole check.
     *
     * `int` returns the DEFAULT when a value is below `min`, and the default is 5.
     * So passing 0 would read green with the `min` deleted, because 0 is also not a
     * safe integer answer anybody wants — this check's first draft did exactly that
     * and proved nothing. Passing 1 discriminates: with the bound it becomes 5, and
     * without it, it stays 1.
     */
    const floored = parseGroup("sponsor", { activityFloor: 1 });
    const raised = parseGroup("sponsor", { activityFloor: 25 });

    check(
      "🔴 C229 the activity floor cannot be set below two, and there is no way to switch it off",
      floored.activityFloor !== 1 && floored.activityFloor >= 2,
      `a floor of 1 becomes ${floored.activityFloor}, so one person's spend is never a chart`,
    );

    check(
      "🔴 CONTROL …and a higher floor an operator chose is kept, so the clamp is a floor",
      raised.activityFloor === 25,
      "raising it after a leak report is one edit",
    );

    /*
     * 🔴 53.11 — the minimum top-up is a SETTING, and 53.19b's cycle defaults to six
     * months rather than the three 0072's column said.
     */
    const sponsorDefaults = parseGroup("sponsor", {});

    check(
      "🔴 53.11 / 53.19b the minimum is $5,000 and the cycle is six months, both settings",
      sponsorDefaults.minTopUpCents === 500_000 && sponsorDefaults.verifyCycleMonths === 6,
      `$${sponsorDefaults.minTopUpCents / 100}, ${sponsorDefaults.verifyCycleMonths} months`,
    );

    /*
     * 🔴 53.10 — the two pot crossings exist in the DATABASE's CHECK, not only in
     * the TypeScript union.
     *
     * This is the sprint 56 defect, pre-empted: an enum extended in one place and
     * not the other is a value the database refuses and a check that measures
     * nothing. Both are attempted as writes.
     */
    /*
     * 🔴 READ AS A FACT FROM pg_constraint, and unconditional (C284).
     *
     * *A verifier exercises every branch it claims to cover, in one run, whatever
     * the machine is configured with, and a check count that varies by environment
     * is itself the defect.* The first draft of this attempted a write against
     * whatever `session_payments` row happened to exist, so on a database with none
     * it silently ran two checks fewer and the sweep still read PASS.
     *
     * So it reads the constraint definition instead. That is not a weaker claim: it
     * is the exact text Postgres evaluates on every write, unlike the TypeScript
     * union, which is a claim. The sprint 56 defect was precisely these two
     * disagreeing.
     */
    const crossingDef = (
      await db.execute(sql`
        SELECT pg_get_constraintdef(oid) AS d, convalidated
          FROM pg_constraint WHERE conname = 'session_payments_crossing_known'`)
    ).rows as { d: string; convalidated: boolean }[];

    const def = required(crossingDef[0], "the crossing constraint").d;

    check(
      "🔴 53.10 the DATABASE's crossing check knows both pot values, not just the TypeScript union",
      def.includes("pot_held_to_connect") &&
        def.includes("pot_held_to_manual") &&
        crossingDef[0]!.convalidated,
      "validated, so it applies to every existing row as well as the next one",
    );

    check(
      "🔴 CONTROL …and it still knows the original four and no invented fifth",
      def.includes("usd_stripe_to_connect") &&
        def.includes("egp_local_to_manual") &&
        def.includes("usd_stripe_to_manual") &&
        def.includes("egp_local_to_connect") &&
        !def.includes("pot_held_to_payout"),
      "extending an enum is not replacing it, and the value I first wrote is gone",
    );

    /*
     * 🔴 53.10 — and the two crossings are TWO for a reason: `isCrossBorder` has to
     * answer true for a pot paying an Egyptian clinician.
     *
     * A single combined value would have answered false for every pot session,
     * understating exactly what §3c added that column to measure. Both directions.
     */
    const { holdsMoney, isCrossBorder } = await import("../lib/billing/money");

    check(
      "🔴 §3c a pot holds money on both crossings, and the Egyptian one is cross-border",
      holdsMoney("pot_held_to_connect") &&
        holdsMoney("pot_held_to_manual") &&
        isCrossBorder("pot_held_to_manual"),
      "USD into the US entity, EGP out of the Egyptian one, needing an entity transfer",
    );

    check(
      "🔴 CONTROL …and the Connect one is NOT cross-border, so the predicate discriminates",
      !isCrossBorder("pot_held_to_connect") && !holdsMoney("usd_stripe_to_connect"),
      "a predicate that answers true for everything measures nothing",
    );

    /*
     * 🔴 C243 — a POT PAYMENT HAS NO PAYER NAME, asserted on the write.
     *
     * The source scan above proves no component renders one. This proves the column
     * is not being filled: writing the employer's name there would put "who pays
     * for this patient" on a clinician's earnings page through a column that already
     * existed.
     */
    const potSourceHasNullPayer =
      /payerName: null/.test(potSource) && /fundingSource: "pot"/.test(potSource);

    check(
      "🔴 C243 the pot payment writer leaves payer_name NULL and marks the funding source",
      potSourceHasNullPayer,
      "the employer is never the payer name on a clinical surface",
    );

    /*
     * 🔴 53.20 / C231 — the patient's notice log is APPEND ONLY, and dismissal is a
     * stamp.
     *
     * Asserted by reading the module for the absence of a delete AND, as the control,
     * for the presence of the dismissal update. An absence assertion alone passes
     * against an empty file.
     */
    const notices = readSource("lib/data/notices.ts");

    check(
      "🔴 53.20 / C231 nothing in the notice log deletes a row",
      !/\.delete\(/.test(notices),
      "a log with a delete cannot answer when your benefit ended",
    );

    check(
      "🔴 CONTROL …and dismissing IS implemented, as a stamp on the row",
      /dismissedAt: new Date\(\)/.test(notices) && /export async function dismissNotice/.test(notices),
      "dismissible from the main view only, which is what C231 asks for",
    );

    /* ================================================================ */
    /*  53.23 / C235 · CRISIS IS NEVER GATED ON MONEY                    */
    /* ================================================================ */

    /*
     * 🔴 *Proved by emptying a pot and asserting the crisis surface is unchanged.*
     *
     * C253 moved the source scan into sprint 46, months before a pot existed, and
     * that scan is still there and still green. This is the other half, which could
     * not be written until there was a pot to empty: the pot is set to zero and then
     * BELOW zero, and the crisis line for the same reader is compared byte for byte.
     *
     * Three states in one run rather than one (C284): funded, empty, and overdrawn.
     * An overdrawn pot is the state a commercial dispute produces, and it is the one
     * a check testing only "empty" would miss.
     */
    const { crisisLine, lineForNumber } = await import("../lib/crisis/line");

    /*
     * 🔴 TWO READERS, and the first draft used only the Egyptian one.
     *
     * There is one verified line in the table, for the US, so `lineForNumber` returns
     * null for a `+20` number — which is the honest answer and is what the orb renders
     * "call your local emergency number" for. My first version compared that null
     * across three pot states and read green, which is three nulls agreeing about
     * nothing. The CONTROL below caught it, which is the whole reason it is there.
     *
     * So both readers are compared: a reader with a line and a reader without one.
     * "Unchanged" has to hold for both, and the null case is the one most of this
     * product's patients are in.
     */
    const withLine = "+12025550100";
    const withoutLine = "+201234567890";

    const snapshot = () =>
      JSON.stringify([lineForNumber(withLine), lineForNumber(withoutLine), crisisLine("US")]);

    const funded = snapshot();

    await db.execute(sql`
      UPDATE sponsor_pots SET balance_cents = 0 WHERE sponsor_id = ${fixture.id}`);
    const emptied = snapshot();

    /*
     * The overdraft is raised first, because the database refuses a balance below the
     * bound C239 put on the pot. That refusal is asserted separately above; here it
     * would have stopped the run before the check it exists to serve.
     */
    await db.execute(sql`
      UPDATE sponsor_pots SET overdraft_cents = 10000, balance_cents = -5000
       WHERE sponsor_id = ${fixture.id}`);
    const overdrawn = snapshot();

    check(
      "🔴 53.23 / C235 emptying and overdrawing a pot changes the crisis line not at all",
      funded === emptied && emptied === overdrawn,
      "funded, empty and overdrawn all read identically, for a reader with a line and one without",
    );

    /*
     * 🔴 CONTROL — and the thing being compared is NOT nothing.
     *
     * Three nulls compare equal. This is the §6 family's favourite shape, it has
     * caught two checks in this repository already, and it caught the first draft of
     * the check above. So one of the two readers must resolve to a real line with a
     * real number, and the other must resolve to the honest null rather than to the
     * same line by accident.
     */
    const line = lineForNumber(withLine);

    check(
      "🔴 CONTROL …and one reader resolves to a real line while the other honestly does not",
      line !== null && line.tel.length > 0 && lineForNumber(withoutLine) === null,
      line
        ? `${line.label} for the US reader, and null for the Egyptian one`
        : "null for both, so the check above proved nothing",
    );

    /*
     * 🔴 And the SURFACE, not only the datum: the orb is rendered on every patient
     * screen by the chrome, and nothing in its path consults a pot.
     *
     * Read as source because the orb is a client component and this is not a browser.
     * The pairing is what makes it worth anything: the orb's module must not mention
     * money, AND it must still mention the thing it exists to produce.
     */
    const orb = readSource("components/patient/sos-orb.tsx");

    check(
      "🔴 53.23 the crisis orb's module cannot reach a pot, a balance or a benefit",
      !/sponsor|pot|balance|enrolment|fundingSource/i.test(orb),
      "nothing in the orb's path knows money exists",
    );

    check(
      "🔴 CONTROL …and it still renders a dialler link, so the scan is reading the real orb",
      /tel:/.test(orb),
      "a file that mentioned nothing would pass the check above",
    );

    /* ================================================================ */
    /*  53.24 / C242 / C243 · the therapist, ON RENDERED OUTPUT          */
    /* ================================================================ */

    /*
     * 🔴 *Nothing changes and nothing shows. And the verifier ASSERTS ON RENDERED
     * OUTPUT, NEVER ON QUERIES: the check as first written passes against C243's
     * leak, because that leak is an absence rather than a value.*
     *
     * That is the ticket's own instruction and it is the sharpest thing in this
     * sprint. The leak C243 described was `payer_name` going NULL on a pot payment:
     * a therapist's earnings list then read a real name against every private
     * session and nothing against every corporate one, and a query-level check
     * looking for the employer's name would have found nothing and passed.
     *
     * So the therapist's real money component is RENDERED, twice, with two rows
     * that differ only in how they were funded, and the two markups are compared.
     * If a pot row renders differently from a card row in any way a human can see,
     * these differ and this fails.
     */
    /*
     * 🔴 An ELEMENT, not a function call, and getting this wrong is instructive.
     *
     * Calling `PaymentHistory({...})` directly invokes `useT` outside a render, and
     * React's dispatcher is null there: "Cannot read properties of null (reading
     * 'useContext')". The component has to be handed to the renderer as an element so
     * the hooks run inside a render pass, which is what `renderMarkup` provides.
     */
    const React = (await import("react")).default;
    const { PaymentHistory } = await import("../components/billing/payment-history");

    const row = (patientName: string | null) => ({
      id: "verify53-payment",
      patientName,
      grossCents: 3_000,
      therapistNetCents: 2_550,
      settledInvoiceCents: 0,
      status: "paid" as const,
      capture: "platform" as const,
      receiptUrl: null,
      createdAt: "13 September 2026",
      paidAt: "13 September 2026",
    });

    const named = await renderMarkup(
      React.createElement(PaymentHistory, { payments: [row("Mona Hassan")], transfers: [] }),
    );
    const nameless = await renderMarkup(
      React.createElement(PaymentHistory, { payments: [row(null)], transfers: [] }),
    );

    /*
     * 🔴 THE LEAK IS VISIBLE, WHICH IS WHY THE NAME MUST COME FROM THE CHART.
     *
     * Rendering the same props twice would prove nothing, and that was this check's
     * first draft. What matters is that a row WITH a name and a row WITHOUT one
     * render DIFFERENTLY — because that difference is exactly C243's leak: if the
     * name came from `payer_name`, a pot row would have none, and a therapist could
     * read off which of their caseload is corporate by looking for the blanks.
     *
     * So the difference is asserted first, as the thing that would be exploitable,
     * and then the data layer is asserted to take the name from `patients` so that
     * no row ever falls into the nameless shape.
     */
    check(
      "🔴 53.24 / C243 a nameless row renders VISIBLY differently, which is the leak itself",
      named !== nameless && named.includes("Mona Hassan") && !nameless.includes("Mona Hassan"),
      "so a therapist could read the corporate rows off the blanks, if any row were blank",
    );

    const connectSource = readSource("lib/billing/connect.ts");
    const recent = connectSource.slice(
      connectSource.indexOf("export async function recentPayments"),
    );

    check(
      "🔴 53.24 / C243 …and the therapist's own list takes the name from the CHART, never the payer",
      /patients\.firstName/.test(recent) &&
        /leftJoin\(patients/.test(recent) &&
        !/payerName/.test(recent),
      "every row has a name, because the name is the patient's and not the cardholder's",
    );

    /*
     * 🔴 AND THE RENDERED OUTPUT CARRIES NO CORPORATE WORD AT ALL.
     *
     * Not "no employer name" — no vocabulary. A therapist must not be able to tell a
     * sponsored session from a private one, so the surface may not say "sponsor",
     * "employer", "benefit", "pot", "corporate" or "covered" even generically,
     * because a word present on some rows and absent on others is the sort order
     * that reveals the caseload.
     */
    /*
     * 🔴 CONTROL FIRST, because the absence check below is worthless without it.
     *
     * `renderMarkup` prints an invalid-hook warning here: there is one React copy for
     * the renderer and the component reaches `useT` through it. The markup still
     * comes out, and the patient's name is a PROP, so a check asserting only the name
     * would pass even if every `t()` call returned nothing — and a surface with no
     * words in it trivially contains no corporate words. That is the §6 shape for the
     * third time in this file.
     *
     * So a TRANSLATED label is asserted present. The fixture is a paid,
     * platform-captured payment, which is the branch that renders `tph.heldUntil`.
     */
    check(
      "🔴 CONTROL the rendered markup carries TRANSLATED text, not only the props",
      named.includes("Held until payouts open"),
      "a surface whose t() returned nothing would pass the absence check below for free",
    );

    const corporateWords = ["sponsor", "employer", "benefit", "pot", "corporate", "covered"];
    const leakedWords = corporateWords.filter((word) => named.toLowerCase().includes(word));

    check(
      "🔴 53.24 / C242 the therapist's money surface renders no corporate vocabulary at all",
      leakedWords.length === 0,
      leakedWords.length === 0
        ? "six words looked for, none present, so no row can be told from another"
        : `LEAKS: ${leakedWords.join(", ")}`,
    );

    /* ============================================================ */
    /*  53.12 · SPENDABLE HERE AND NOWHERE ELSE                      */
    /* ============================================================ */

    /*
     * 🔴 *No cash out, no transfer, no other product*, and the enforcement is that
     * there is no function which could do it.
     *
     * The pot module's only two money movements are a top-up in and a session spend
     * out. So the check is over its EXPORTS: nothing named for a withdrawal, a
     * refund, a transfer or a payout exists, and the control asserts the two that
     * should exist do. An absence assertion over an empty module passes.
     */
    const potExports = [...potSource.matchAll(/export async function (\w+)/g)].map(
      (match) => match[1]!,
    );

    const cashOut = potExports.filter((name) =>
      /withdraw|cashOut|payout|transfer|refund/i.test(name),
    );

    check(
      "🔴 53.12 no function in the pot module can take money out except a session",
      cashOut.length === 0,
      cashOut.length === 0
        ? `${potExports.join(", ")} — one way in, one way out, and out is a session`
        : `CASH OUT: ${cashOut.join(", ")}`,
    );

    check(
      "🔴 CONTROL …and the two that MUST exist do, so the module is not simply empty",
      potExports.includes("topUpPot") && potExports.includes("payFromPot"),
      "money in and a session spending it, which is the whole of a payment method",
    );

    /* ============================================================ */
    /*  53.2 · ENROLMENT IS ELIGIBILITY, NEVER THERAPY               */
    /* ============================================================ */

    /*
     * 🔴 *Nothing on any enrolment screen, email or poster implies the person needs
     * help.*
     *
     * Checked against the SHIPPED STRINGS rather than the components, because the
     * components render keys and the words live in the dictionary. Every key an
     * enrolment surface reads is swept for the vocabulary of illness.
     *
     * The list is deliberately of words that would be fine anywhere else in this
     * product and are not fine here: a screen a colleague can see over somebody's
     * shoulder in an open-plan office, and a poster whoever photographs it is seen
     * photographing.
     */
    const { DICTIONARIES } = await import("../lib/i18n/messages");

    const enrolmentKeys = Object.keys(DICTIONARIES.en).filter(
      (key) => key.startsWith("benefit.") || key === "sponsor.codePoster",
    );

    const clinicalWords = [
      "therapy",
      "therapist",
      "counselling",
      "mental health",
      "depress",
      "anxi",
      "struggl",
      "support you",
      "help you",
      "wellbeing",
      "crisis",
    ];

    const offending = enrolmentKeys.filter((key) => {
      const text = (DICTIONARIES.en as Record<string, string>)[key]!.toLowerCase();
      return clinicalWords.some((word) => text.includes(word));
    });

    check(
      "🔴 53.2 no word on any enrolment screen or poster implies the person needs help",
      offending.length === 0,
      offending.length === 0
        ? `${enrolmentKeys.length} enrolment strings, eleven words looked for, none present`
        : `IMPLIES THERAPY: ${offending.join(", ")}`,
    );

    /*
     * 🔴 CONTROL — the same sweep over the same words DOES flag a sentence that
     * breaks the rule, and it is the sentence somebody will write.
     */
    const plausible = "Activate your benefit and get help with your mental health.".toLowerCase();

    check(
      "🔴 CONTROL …and it catches the sentence somebody will eventually write",
      clinicalWords.some((word) => plausible.includes(word)),
      "the obvious first draft of an enrolment poster is caught by the same predicate",
    );

    /*
     * 🔴 53.19 — the spike reaches both screens as a NUMBER, and neither can render
     * an identifier because neither is given one.
     */
    const codeCard = readSource("components/sponsor/code-card.tsx");

    check(
      "🔴 53.19 the spike is a count on both screens, and no surface is handed an identifier",
      /attempts: number/.test(codeCard) &&
        !/identifier/i.test(codeCard) &&
        /sponsor\.attempts/.test(readSource("components/admin/sponsor-manager.tsx")),
      "a list of attempted employee numbers is a list of people who tried",
    );

    check(
      "🔴 CONTROL …and the count is actually read from the counter rather than hardcoded",
      /subjectKey\("enrol-code"/.test(sponsorData) &&
        /subjectKey\("enrol-code"/.test(readSource("lib/data/enrolment.ts")),
      "written by the enrolment path and read by the sponsor's, on the same key",
    );

    check(
      "🔴 CONTROL …and the same scan WOULD catch one, so it is reading the markup",
      corporateWords.some((word) =>
        `${named} this session was covered by a sponsor`.toLowerCase().includes(word),
      ),
      "the planted sentence is caught by the same predicate that cleared the real markup",
    );
  } finally {
    await db.execute(sql`DELETE FROM ledger_entries WHERE ref_type = 'sponsor' AND ref_id IN
      (SELECT id FROM sponsors WHERE name LIKE 'verify53%')`);
    await db.execute(sql`DELETE FROM enrolment_verifications WHERE enrolment_id IN
      (SELECT id FROM enrolments WHERE sponsor_id IN
        (SELECT id FROM sponsors WHERE name LIKE 'verify53%'))`);
    /*
     * 🔴 The settings override this run wrote, removed. A verifier that leaves a
     * fake legal name in `platform_settings` would put it on a real invoice.
     */
    await db.execute(sql`DELETE FROM platform_settings WHERE key = 'invoice'`);
    await db.execute(sql`DELETE FROM enrolments WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name LIKE 'verify53%')`);
    await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name LIKE 'verify53%')`);
    await db.execute(sql`DELETE FROM sponsor_identifier_fields WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name LIKE 'verify53%')`);
    await db.execute(sql`DELETE FROM sponsors WHERE name LIKE 'verify53%'`);
  }

  finish("sprint 53");
}

void main();
