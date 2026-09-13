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
  } finally {
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
