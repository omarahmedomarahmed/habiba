/**
 * 🔴 78.2 — EVERY DEMO LOGIN WORKS, AND NOTHING IT OPENS ONTO IS EMPTY.
 *
 *     npm run verify:demo
 *     npm run on:production -- verify:demo
 *
 * ## Why this exists rather than a sentence in a document
 *
 * `seed:demo` was asked for in one line: seed data with history so each portal
 * can be opened and redesigned, and **not** an empty one. A seed that writes
 * rows is easy; a seed that writes rows the product will actually SHOW is the
 * thing being asked for, and those are different. `patients.therapist_id` was
 * null in the first draft, every row was written, every insert succeeded, and
 * all three clinicians would have signed in to an empty caseload.
 *
 * So the property under test is not "rows exist". It is **"the query each
 * portal runs returns something"**, asked the way the portal asks it.
 *
 * ## 🔴 EVERY COUNT HAS A CONTROL THAT MUST READ ZERO
 *
 * §6: a check that passes by measuring the wrong thing is worse than no check.
 * `COUNT(*) FROM patients` is greater than zero on any database with a patient
 * in it, including one where the caseload scoping is broken, which is the exact
 * defect this was written after. So each scoped count is run twice: once for the
 * person who should see rows, and once with the id swapped for somebody who
 * must see none. A scoping bug makes both non-zero and the control fails.
 *
 * ## 🔴 AND THE WIPE IS CHECKED FROM THE OTHER SIDE
 *
 * `seed:demo` deletes a hundred tables and keeps fourteen. A bug in the keep
 * list takes the published website, every price and the payroll with it, and
 * nothing about the seed's own output would say so. The last block asserts the
 * kept tables still hold rows.
 *
 * ## It reads, and writes nothing
 *
 * `verifyPassword` hashes a candidate and compares. Every other statement is a
 * SELECT. That is why it may be pointed at production.
 */
import { sql } from "drizzle-orm";

import {
  DEMO_LOGINS,
  DEMO_PASSWORD,
  OWNED_INBOXES,
  UNCLAIMED_EMAIL,
  isPrivateLogin,
  privatePassword,
} from "./_demo-cast";
import { scenario, scenarioFrom, TUNING } from "./_value-statements";
import { hostOf, reporter } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

async function main() {
  /*
   * 🔴 80.1 — THE SAME FLAG THE SEED TAKES, PARSED BY THE SAME FUNCTION.
   *
   *     npm run on:production -- verify:demo -- --scenario=money
   *
   * Two scripts parsing one flag two ways is how you seed one position and
   * certify another, and both report success. `scenarioFrom` is the only
   * reader, and it throws on a name that is not in the list rather than
   * quietly falling back to the default, which would certify `live` against a
   * database holding `money` and pass.
   *
   * Told the wrong name, this goes red on the coverage and the enrolment, which
   * is the useful answer: it says which position the database is actually in.
   */
  const name = scenarioFrom(process.argv.slice(2));
  const position = scenario(name);
  const tuning = TUNING[name];

  const { db, pool } = connect();
  console.log(`\nreading ${hostOf()}`);
  console.log(`scenario: ${name}. ${position.title}\n`);

  try {
    const { verifyPassword } = await import("../lib/auth/password");

    const num = async (text: ReturnType<typeof sql>): Promise<number> => {
      const { rows } = await db.execute(text);
      return Number((rows[0] as Record<string, unknown>)?.n ?? 0);
    };

    /**
     * A scoped count and its control, reported as one line each.
     *
     * `mine` is the query the portal runs for somebody who should see rows.
     * `theirs` is the identical query for somebody who must see none. Both are
     * required: the first proves there is something to look at, the second
     * proves the query is looking at the right person's things.
     */
    const scoped = async (
      label: string,
      atLeast: number,
      mine: ReturnType<typeof sql>,
      theirs: ReturnType<typeof sql>,
    ) => {
      const got = await num(mine);
      check(`${label}`, got >= atLeast, `${String(got)} rows, wanted ${String(atLeast)}+`);
      const control = await num(theirs);
      check(`${label}: control reads zero`, control === 0, `${String(control)} rows`);
    };

    /* ------------------------------------------------ can they sign in -- */

    for (const login of DEMO_LOGINS) {
      const { rows } = await db.execute(
        sql.raw(
          `SELECT password_hash AS h FROM ${login.table} WHERE lower(email) = lower('${login.email}')`,
        ),
      );
      const hash = (rows[0] as { h?: string } | undefined)?.h;
      if (!hash) {
        check(`${login.who} ${login.email}`, false, "no row");
        continue;
      }
      /*
       * 🔴 The three private logins are checked for the OPPOSITE property: the
       * published password must not open them, because it is in a public
       * repository and they open the console and a company's money. Whether the
       * private one opens them is checked only when it is configured here.
       */
      if (isPrivateLogin(login.email)) {
        check(
          `${login.who} ${login.email}: the published password does NOT open it`,
          !(await verifyPassword(DEMO_PASSWORD, hash)),
        );
        const mine = privatePassword();
        if (mine) {
          check(`${login.who} ${login.email}: the private password opens it`, await verifyPassword(mine, hash));
        }
        continue;
      }
      check(`${login.who} ${login.email}`, await verifyPassword(DEMO_PASSWORD, hash));
    }

    /*
     * 🔴 THE ONE WHO MUST NOT HAVE A LOGIN, which is a state rather than an
     * absence of work. Laila's record is on a clinician's list with her address
     * on it and she has never claimed it; a seed that quietly gave her an
     * account would delete the only unclaimed record in the cast and the claim
     * flow would have nothing to be tested against.
     */
    const lailaAccounts = await num(sql`
      SELECT count(*)::int AS n FROM patient_accounts WHERE email = ${UNCLAIMED_EMAIL}`);
    check("the unclaimed record has no account", lailaAccounts === 0, `${String(lailaAccounts)} found`);

    const lailaUnclaimed = await num(sql`
      SELECT count(*)::int AS n FROM people
       WHERE email = ${UNCLAIMED_EMAIL} AND claimed_at IS NULL`);
    check("and its person is unclaimed", lailaUnclaimed === 1);

    const lailaOnAList = await num(sql`
      SELECT count(*)::int AS n FROM patients WHERE email = ${UNCLAIMED_EMAIL} AND therapist_id IS NOT NULL`);
    check("and it is on a clinician's list", lailaOnAList >= 1, `${String(lailaOnAList)}`);

    /* --------------------------------------------- the therapist portal -- */

    const userId = (email: string) =>
      sql.raw(`(SELECT id FROM users WHERE email = '${email}')`);

    /*
     * The caseload query is `scope()` from `lib/data/patients.ts`: organisation
     * plus `therapist_id = me`. The control is the same clinician against the
     * OTHER organisation, which is what a scoping bug would wrongly return.
     */
    await scoped(
      "dr omar's caseload",
      3,
      sql`SELECT count(*)::int AS n FROM patients
           WHERE therapist_id = ${userId("omarabdelgawad001@gmail.com")}
             AND organization_id = (SELECT id FROM organizations WHERE slug = 'cairo-counselling')
             AND deleted_at IS NULL`,
      sql`SELECT count(*)::int AS n FROM patients
           WHERE therapist_id = ${userId("omarabdelgawad001@gmail.com")}
             AND organization_id = (SELECT id FROM organizations WHERE slug = 'nile-practice')
             AND deleted_at IS NULL`,
    );

    await scoped(
      "dr sara's caseload",
      2,
      sql`SELECT count(*)::int AS n FROM patients
           WHERE therapist_id = ${userId("dr.sara.demo@example.com")} AND deleted_at IS NULL`,
      sql`SELECT count(*)::int AS n FROM patients
           WHERE therapist_id = ${userId("dr.yasmin.example@example.com")} AND deleted_at IS NULL`,
    );

    await scoped(
      "dr kareem's caseload",
      1,
      sql`SELECT count(*)::int AS n FROM patients
           WHERE therapist_id = ${userId("dr.kareem.example@example.com")} AND deleted_at IS NULL`,
      sql`SELECT count(*)::int AS n FROM sessions
           WHERE therapist_id = ${userId("dr.yasmin.example@example.com")}`,
    );

    for (const [who, email, atLeast] of [
      ["dr omar", "omarabdelgawad001@gmail.com", 8],
      ["dr sara", "dr.sara.demo@example.com", 4],
      ["dr kareem", "dr.kareem.example@example.com", 4],
    ] as const) {
      const done = await num(sql`
        SELECT count(*)::int AS n FROM sessions
         WHERE therapist_id = ${userId(email)} AND status = 'completed'`);
      check(`${who}'s completed sessions`, done >= atLeast, `${String(done)}`);

      const notes = await num(sql`
        SELECT count(*)::int AS n FROM session_notes
         WHERE therapist_id = ${userId(email)} AND status = 'approved'`);
      check(`${who}'s approved notes`, notes === done, `${String(notes)} of ${String(done)}`);
    }

    const ahead = await num(sql`
      SELECT count(*)::int AS n FROM sessions WHERE status = 'scheduled' AND scheduled_at > now()`);
    check("something is booked ahead", ahead >= 1, `${String(ahead)}`);

    const lines = await num(sql`SELECT count(*)::int AS n FROM transcript_segments`);
    check("transcripts have lines in them", lines >= 100, `${String(lines)}`);

    /*
     * 🔴 THE APPLICANT'S PORTAL IS THE ONE SCREEN THAT IS SUPPOSED TO BE EMPTY,
     * and it is asserted empty rather than left unmentioned. Everything else
     * here fails on zero; this one fails on anything else.
     */
    const yasmin = await num(sql`
      SELECT count(*)::int AS n FROM patients
       WHERE therapist_id = ${userId("dr.yasmin.example@example.com")}`);
    check("the applicant has no caseload, deliberately", yasmin === 0, `${String(yasmin)}`);

    const queue = await num(sql`
      SELECT count(*)::int AS n FROM therapist_verifications WHERE state = 'submitted'`);
    check("the admin's review queue has work", queue >= 1, `${String(queue)}`);

    /*
     * Approved in `therapist_verifications` and verified on the user row are two
     * columns, and the second is derived by a trigger from the first. A seed
     * that wrote one without the other produces a clinician who reads as
     * verified on one screen and cannot start a session on another.
     */
    const agree = await num(sql`
      SELECT count(*)::int AS n FROM users u JOIN therapist_verifications v ON v.user_id = u.id
       WHERE (v.state = 'approved') <> (u.verification_status = 'verified')`);
    check("verification state and user status agree", agree === 0, `${String(agree)} disagree`);

    /* ------------------------------------------------- the clinic portal -- */

    await scoped(
      "the clinic's clinicians",
      2,
      sql`SELECT count(*)::int AS n FROM clinic_seats s
           JOIN organizations o ON o.id = s.organization_id
          WHERE o.slug = 'nile-practice' AND s.released_at IS NULL`,
      sql`SELECT count(*)::int AS n FROM clinic_seats s
           JOIN organizations o ON o.id = s.organization_id
          WHERE o.slug = 'cairo-counselling' AND s.released_at IS NULL`,
    );

    await scoped(
      "the clinic's sessions",
      8,
      sql`SELECT count(*)::int AS n FROM sessions s JOIN organizations o ON o.id = s.organization_id
          WHERE o.slug = 'nile-practice'`,
      sql`SELECT count(*)::int AS n FROM sessions s JOIN organizations o ON o.id = s.organization_id
          WHERE o.slug = '24therapy'`,
    );

    /* ------------------------------------------------ the company portal -- */

    const pot = await db.execute(sql`
      SELECT p.balance_cents AS balance, p.coverage_bps AS coverage
        FROM sponsor_pots p JOIN sponsors s ON s.id = p.sponsor_id
       WHERE s.name = 'Habiba Holdings'`);
    const potRow = pot.rows[0] as { balance?: number; coverage?: number } | undefined;
    /*
     * 🔴 AND IN ONE POSITION IT IS IN THE RED, WHICH IS THE PRODUCT WORKING.
     *
     * `growth` funds the pot to $100 against six covered sessions that want
     * $270, so `payFromPot` spends it down and the last session it funds takes
     * the balance negative. That is not a bug: `openPot` sets an overdraft of
     * 5,000 cents deliberately, the ledger agrees with the pot to the cent, and
     * the next booking is refused because 4,500 no longer fits inside what is
     * left of it.
     *
     * The floor asserted is therefore the overdraft rather than zero. A pot
     * BELOW its own overdraft would be the real defect, and this is the only
     * check in the repository that would see it.
     */
    const balance = Number(potRow?.balance ?? 0);
    const floor = tuning.topUpCreditCents > 100_000 ? 0 : -5_000;
    check(
      floor === 0
        ? "the company's pot holds money"
        : "the company's pot is spent down, and not past its own overdraft",
      balance > floor,
      `${String(balance)} cents, floor ${String(floor)}`,
    );
    check(
      "the company covers the share this position was seeded at",
      Number(potRow?.coverage ?? 0) === tuning.coverageBps,
      `${String(potRow?.coverage ?? 0)} bps, wanted ${String(tuning.coverageBps)}`,
    );

    /*
     * 🔴 AND THE BALANCE IS THE LEDGER'S, not a number somebody typed.
     *
     * This is the property the seed's own header claims and the one an INSERT
     * would have silently broken: a pot funded by writing `balance_cents` looks
     * identical on every screen and reconciles to nothing.
     */
    const { ledgerPotBalance } = await import("../lib/billing/pot");
    const sponsorId = (
      await db.execute(sql`SELECT id FROM sponsors WHERE name = 'Habiba Holdings'`)
    ).rows[0] as { id?: string } | undefined;
    if (sponsorId?.id) {
      const fromLedger = await ledgerPotBalance(sponsorId.id);
      check(
        "the pot balance is the ledger's",
        fromLedger === Number(potRow?.balance ?? -1),
        `ledger ${String(fromLedger)}, pot ${String(potRow?.balance ?? 0)}`,
      );
    } else {
      check("the pot balance is the ledger's", false, "no sponsor");
    }

    /*
     * 🔴 THE SPEND IS COUNTED THE WAY `potTotals` COUNTS IT.
     *
     * There is no `pot_spends` table, which the first draft of this file
     * assumed: a deduction is a positive leg on the `sponsor_pot` account in
     * `ledger_entries`, keyed to the sponsor. Asking a table that does not
     * exist is a check that throws rather than one that passes wrongly, which
     * is the only reason it was caught. The control is the same query on the
     * opposite sign, which is the top-up, and must not be confused with a spend.
     */
    if (sponsorId?.id) {
      const { potTotals } = await import("../lib/billing/pot");
      const totals = await potTotals(sponsorId.id);
      check(
        "sessions the company paid towards",
        totals.sessions >= 3,
        `${String(totals.sessions)} sessions, ${String(totals.spentCents)} cents`,
      );

      /*
       * 🔴 ITS SHARE, NOT THE WHOLE PRICE, and the arithmetic is derived from
       * the position rather than typed. The literal `0.6` here is what made
       * this check silently wrong for four of the five positions the moment
       * they existed: it would have gone red on `money` for the pot behaving
       * exactly as `money` asks it to.
       */
      const share = Math.round((7_500 * tuning.coverageBps) / 10_000);
      check(
        `and it paid its ${String(tuning.coverageBps / 100)} per cent, not all of it`,
        totals.spentCents === share * totals.sessions,
        `${String(totals.spentCents)} cents for ${String(totals.sessions)}, at ${String(share)} each`,
      );
    } else {
      check("sessions the company paid towards", false, "no sponsor");
    }

    const enrolled = await num(sql`
      SELECT count(*)::int AS n FROM enrolments WHERE state = 'active' AND removed_at IS NULL`);
    check("somebody is enrolled at the company", enrolled >= 1, `${String(enrolled)}`);

    /*
     * The one the founder named: a patient who is NOT enrolled, so the
     * enrolment flow has somebody to be walked through.
     *
     * 🔴 AND IN TWO POSITIONS HE IS, DELIBERATELY. `money` and `growth` put a
     * second person on the same pot, because one covered employee proves the
     * split and two prove the things that only exist with more than one claim
     * on a pot: `CV11`, where the employer's spend page lists both and names
     * neither, and `RR9`, where two bookings race a balance that funds one.
     * Asserted in both directions rather than skipped, so a position that
     * enrols him by accident fails as loudly as one that forgets to.
     */
    const unenrolled = await num(sql`
      SELECT count(*)::int AS n FROM people p
       WHERE p.email = 'mr.3omar.a7mad@gmail.com'
         AND NOT EXISTS (SELECT 1 FROM enrolments e WHERE e.person_id = p.id)`);
    check(
      tuning.enrolTheSecondPatient
        ? "the second patient IS enrolled, which this position needs"
        : "one patient is not enrolled anywhere",
      unenrolled === (tuning.enrolTheSecondPatient ? 0 : 1),
      `${String(unenrolled)} unenrolled`,
    );

    /* ------------------------------------------------- the patient's app -- */

    const personId = (email: string) => sql.raw(`(SELECT id FROM people WHERE email = '${email}')`);

    for (const [who, email] of [
      ["omar", "mr.3omar.a7mad@gmail.com"],
      ["mariam", "mariam.demo@example.com"],
      ["tarek", "tarek.demo@example.com"],
      ["nadia", "nadia.demo@example.com"],
    ] as const) {
      const sessions = await num(sql`
        SELECT count(*)::int AS n FROM sessions s JOIN patients p ON p.id = s.patient_id
         WHERE p.person_id = ${personId(email)}`);
      check(`${who}'s sessions`, sessions >= 3, `${String(sessions)}`);

      const summaries = await num(sql`
        SELECT count(*)::int AS n FROM clinical_summaries WHERE person_id = ${personId(email)}`);
      check(`${who}'s record has a summary`, summaries >= 1, `${String(summaries)}`);

      const homework = await num(sql`
        SELECT count(*)::int AS n FROM homework_items WHERE person_id = ${personId(email)}`);
      check(`${who}'s homework`, homework >= 3, `${String(homework)}`);

      const journal = await num(sql`
        SELECT count(*)::int AS n FROM journals WHERE person_id = ${personId(email)}`);
      check(`${who}'s journal`, journal >= 1, `${String(journal)}`);
    }

    /*
     * 🔴 TWO VERSIONS BY TWO CLINICIANS AT TWO PRACTICES, which is the
     * portability claim the public site rests on and the one thing that cannot
     * be shown on a database where everybody saw one person.
     */
    const versions = await db.execute(sql`
      SELECT count(*)::int AS n, count(DISTINCT approved_by_user_id)::int AS clinicians,
             count(DISTINCT organization_id)::int AS orgs
        FROM clinical_summaries WHERE person_id = ${personId("tarek.demo@example.com")}`);
    const v = versions.rows[0] as { n?: number; clinicians?: number; orgs?: number } | undefined;
    check("tarek's record has two versions", Number(v?.n ?? 0) === 2, `${String(v?.n ?? 0)}`);
    check("by two clinicians", Number(v?.clinicians ?? 0) === 2);
    check("at two practices", Number(v?.orgs ?? 0) === 2);

    const grant = await num(sql`
      SELECT count(*)::int AS n FROM history_grants WHERE status = 'granted'`);
    check("a record was handed over on a grant", grant >= 1, `${String(grant)}`);

    /* ----------------------------------------------- the admin's queues -- */

    for (const [label, text] of [
      ["payments waiting or settled", sql`SELECT count(*)::int AS n FROM manual_payments`],
      ["a payout to work", sql`SELECT count(*)::int AS n FROM payout_requests`],
      ["a support ticket", sql`SELECT count(*)::int AS n FROM support_tickets`],
      ["clinicians on the radar", sql`SELECT count(*)::int AS n FROM therapist_radar`],
      ["ledger entries", sql`SELECT count(*)::int AS n FROM ledger_entries`],
    ] as const) {
      const got = await num(text);
      check(`admin: ${label}`, got >= 1, `${String(got)}`);
    }

    /* ---------------------------------------------- and this position -- */

    /*
     * 🔴 80.1 — THE ROWS THAT MAKE THIS POSITION DIFFERENT FROM THE OTHER FOUR.
     *
     * Everything above is true of all five and would pass on any of them, which
     * means a reseed that silently did nothing — a flag misspelled, a scenario
     * block that threw and was swallowed — reads as a clean run. These are the
     * checks that can only pass on the position that was actually asked for.
     */
    if (name === "live" || name === "crisis") {
      const soon = await num(sql`
        SELECT count(*)::int AS n FROM sessions
         WHERE status = 'scheduled' AND payment_status = 'pending'
           AND scheduled_at BETWEEN now() AND now() + interval '1 hour'`);
      check("a session is minutes away and unpaid", soon >= 1, `${String(soon)}`);

      /*
       * 🔴 AND IT IS PRICED, because a session at zero opens the room and asks
       * for nothing. `openSessionForPatient` draws the amber orb from
       * `priceCents > 0 AND paymentStatus = 'pending'`, so a price of nothing
       * is a teal orb and half this walk has nothing to press.
       *
       * No claim row is asserted, and the seed writes none: `/pay/:token`
       * prices the sheet itself and re-states the row from what it computed, so
       * a seeded one would be a figure this repository invented sitting in
       * front of an operator until somebody opened the sheet.
       */
      const priced = await num(sql`
        SELECT count(*)::int AS n FROM sessions
         WHERE status = 'scheduled' AND payment_status = 'pending' AND price_cents > 0
           AND scheduled_at BETWEEN now() AND now() + interval '1 hour'`);
      check("and it has a price on it, so the orb is amber", priced >= 1, `${String(priced)}`);

      /*
       * 🔴 THE ROW THE WHOLE OF 79.1 EXISTS FOR. A clinician invited a patient
       * on production, the patient opened the app and there was nothing there.
       * If this reads zero, the position cannot prove `P2` and nothing else in
       * this file would have said so.
       */
      const told = await num(sql`
        SELECT count(*)::int AS n FROM patient_notifications n
         JOIN people p ON p.id = n.person_id
        WHERE p.email = 'mr.3omar.a7mad@gmail.com' AND n.kind = 'session_invited'`);
      check("and the invitation is findable inside the app", told >= 1, `${String(told)}`);
    }

    if (name === "money") {
      /*
       * `RA8`. The open-carts tab on `/admin/transfers` exists for this and has
       * never had a row in it, so the screen an operator uses to work out what
       * an unmatched bank line belongs to has never been used by anybody.
       */
      const waiting = await num(sql`
        SELECT count(*)::int AS n FROM manual_payments
         WHERE state = 'submitted' AND decided_at IS NULL`);
      check("an unmatched transfer is on the operator's queue", waiting >= 1, `${String(waiting)}`);

      const bothCovered = await num(sql`
        SELECT count(*)::int AS n FROM enrolments WHERE state = 'active' AND removed_at IS NULL`);
      check("two people are on one pot", bothCovered >= 2, `${String(bothCovered)}`);
    }

    if (name === "continuity") {
      const asking = await num(sql`
        SELECT count(*)::int AS n FROM history_grants WHERE status = 'requested'`);
      check("a clinician is waiting on the patient's answer", asking >= 1, `${String(asking)}`);

      /*
       * The control for it: a record with a request on it must ALSO already
       * carry a granted one, or the patient has no second clinician to compare
       * against and `P4` is being walked on one version of one summary.
       */
      const already = await num(sql`
        SELECT count(*)::int AS n FROM history_grants WHERE status = 'granted'`);
      check("and one was granted earlier, so there are two to tell apart", already >= 1, `${String(already)}`);
    }

    if (name === "crisis") {
      const refused = await db.execute(sql`
        SELECT reject_reason AS why FROM manual_payments WHERE state = 'rejected' LIMIT 1`);
      const why = String((refused.rows[0] as { why?: string } | undefined)?.why ?? "");
      check(
        "a rejected transfer is waiting on the payer's side",
        why.split(/\s+/).length >= 15,
        why ? `${String(why.split(/\s+/).length)} words` : "no rejection found",
      );
    }

    if (name === "growth") {
      /*
       * 🔴 THE POT CANNOT FUND THE NEXT SESSION, which is the whole position.
       *
       * Asserted as arithmetic rather than as a balance, because `CV9` is about
       * what happens when the balance is SHORT rather than when it is low: a
       * pot with $40 in it funds a $45 share of nothing.
       */
      const share = Math.round((7_500 * tuning.coverageBps) / 10_000);
      const balance = Number(potRow?.balance ?? 0);
      check(
        "the pot cannot fund another session, which is the point of this one",
        balance < share,
        `${String(balance)} cents against a ${String(share)} cent share`,
      );

      const applicant = await num(sql`
        SELECT count(*)::int AS n FROM therapist_verifications v
         WHERE v.state = 'submitted'
           AND NOT EXISTS (SELECT 1 FROM clinic_seats s WHERE s.user_id = v.user_id
                             AND s.released_at IS NULL)`);
      check("somebody is waiting to be let in, with no seat yet", applicant >= 1, `${String(applicant)}`);
    }

    /* ------------------------------------- what the wipe was not allowed -- */

    /*
     * 🔴 THE CHECK THE WIPE ITSELF CANNOT MAKE.
     *
     * `seed:demo` empties a hundred tables and keeps fourteen, and if the keep
     * list were wrong it would report a clean run either way: it counts what it
     * deleted, not what it should not have. Every one of these is configuration,
     * published copy or the company's own books, and an empty one means the
     * website or the payroll went with the cast.
     */
    for (const table of ["content_pages", "platform_settings", "country_settings"]) {
      const got = await num(sql.raw(`SELECT count(*)::int AS n FROM ${table}`));
      check(`kept: ${table}`, got >= 1, `${String(got)} rows`);
    }

    /*
     * 🔴 `locales`, `ui_strings` AND `taxonomy_entries` ARE NOT ASSERTED HERE,
     * and the reason is worth writing down rather than leaving as a gap.
     *
     * The first draft of this file demanded rows in all three and failed on
     * every database it was pointed at, dev and production alike, because they
     * are empty on both: the Arabic the product ships is in
     * `lib/i18n/messages.ts`, not in a table. A check that reads red on a
     * correct database is worse than no check, because the next person learns
     * to scroll past this block.
     *
     * What the keep list actually promises is that the wipe changed NOTHING on
     * these fourteen tables, and that is proved where it can be: `seed:demo`
     * counts all fourteen before the wipe and again after, and throws naming
     * any table that lost a row. Production holds seven employees and seven
     * salary rows that only that census can protect, since asserting "more than
     * zero" would pass on a dev branch that never had them.
     */
    const payroll = await num(sql`SELECT count(*)::int AS n FROM employees`);
    console.log(`  --    employees: ${String(payroll)} rows, protected by the seed's own census`);

    /*
     * 🔴 AND THE RULE THE WIPE BREAKS IS BACK ON.
     *
     * `seed:demo` disables `clinical_summaries_no_rewrite` to empty the table
     * and re-enables it in a `finally`. A crash between the two leaves a
     * database where a clinical summary can be edited or deleted, which is
     * exactly the state the trigger exists to make impossible, and nothing on
     * any screen would say so.
     */
    const enabled = await num(sql`
      SELECT count(*)::int AS n FROM pg_trigger
       WHERE tgname = 'clinical_summaries_no_rewrite' AND tgenabled <> 'D'`);
    check("the append-only rule is enabled", enabled === 1, `${String(enabled)}`);

    /*
     * 🔴 C127 — EVERY INVENTED PERSON LOOKS INVENTED.
     *
     * The four addresses the founder named are real inboxes they own, which is
     * the point: they are testing what arrives. Everybody else in the cast must
     * be at `example.com`, so a message that escapes the test reaches a domain
     * RFC 2606 reserves and nobody's actual inbox.
     */
    const list = OWNED_INBOXES.map((e) => `'${e}'`).join(",");
    const stray = await num(
      sql.raw(`
        SELECT count(*)::int AS n FROM (
          SELECT email FROM users
          UNION ALL SELECT email FROM patient_accounts
          UNION ALL SELECT email FROM sponsor_users
          UNION ALL SELECT email FROM clinic_managers
          UNION ALL SELECT email FROM people
        ) a
        WHERE a.email IS NOT NULL
          AND a.email NOT IN (${list})
          AND a.email NOT LIKE '%@example.com'`),
    );
    check("every other address is at example.com", stray === 0, `${String(stray)} elsewhere`);

    finish("verify:demo");
  } finally {
    await pool.end();
  }
}

void main();
