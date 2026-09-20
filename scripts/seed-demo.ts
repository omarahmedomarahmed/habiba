/**
 * 🔴 78.1 — THE DEMO CAST: TEN LOGINS, EVERY PORTAL, NOTHING EMPTY.
 *
 *     npm run seed:demo                     # on whatever DATABASE_URL points at
 *     npm run on:production -- seed:demo    # the counted door
 *
 * ## What this is for, and why it is not the simulation
 *
 * `scripts/simulate-seed.ts` creates an operator and two applications and
 * nothing else, on the stated ground that a cast seeded into existence never
 * walks the sign-up flow. That rule is right for a simulation, whose job is to
 * prove the product can be USED.
 *
 * This has the opposite job. Somebody is about to redesign every portal, and
 * for that they need to open each one and find it FULL: sessions with notes on
 * them, a pot with a spending history, a clinic with a week in it, queues with
 * work in them. An empty screen tells a designer nothing except that it is
 * empty. So this writes history directly, and says so rather than pretending
 * the rows arrived by themselves.
 *
 * ## 🔴 THE MONEY STILL GOES THROUGH THE PRODUCT'S OWN FUNCTIONS
 *
 * `openPot`, `payFromPot`, `openCart`, `submitProof`, `confirmPayment`. A
 * funded pot written in with an INSERT has no journal behind it, which is the
 * exact defect sprint 75 found; a balance that does not reconcile is worse than
 * no balance, because the screen showing it looks fine. Sessions, notes and
 * people are inserted; every cent is posted.
 *
 * ## 🔴 THE WIPE, AND WHY IT IS NOT `TRUNCATE ... CASCADE`
 *
 * The obvious wipe is to truncate `users`, `people`, `sponsors` and
 * `organizations` with CASCADE. Following the foreign keys out from those four
 * reaches **115 tables**, and among them are `content_pages`, `platform_settings`,
 * `country_settings`, `locales`, `ui_strings`, `taxonomy_entries` and the
 * company's own books. Truncating the cast would have taken the published
 * website, every price, every crisis line and the payroll with it.
 *
 * Every one of those links to `users` through a single audit column —
 * `updated_by`, `created_by`, `taken_by` — which records who last edited the
 * row rather than who owns it. So those columns are set to NULL first, and then
 * the person-shaped tables are DELETED in dependency order. Nothing
 * configuration-shaped is touched.
 */
import { sql } from "drizzle-orm";

import { hashPassword } from "../lib/auth/password";
import { DEMO_LOGINS, DEMO_PASSWORD, UNCLAIMED_EMAIL } from "./_demo-cast";
import { connect } from "./db";
import { writesTo } from "./_verify";

/**
 * Configuration, the company's own books, and the published website.
 *
 * These survive the wipe. Each one is reachable from `users` only through an
 * audit column, which is nulled rather than followed.
 */
const KEEP = [
  "content_pages",
  "platform_settings",
  "country_settings",
  "locales",
  "ui_strings",
  "taxonomy_entries",
  "instruments",
  "finance_benchmarks",
  "finance_scenarios",
  "employees",
  "employee_salaries",
  "capital_contributions",
  "other_costs",
  "fx_quotes",
] as const;

type Row = Record<string, unknown>;

async function main() {
  writesTo({ productionIsAllowed: true });

  const { db, pool } = connect();
  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  try {
    /* ============================================================== */
    /*  the wipe                                                      */
    /* ============================================================== */

    /*
     * Which tables hang off a person. Computed from the foreign keys rather
     * than typed out, because a list of a hundred table names goes stale the
     * first time somebody adds a table and nobody notices it was missed.
     */
    const reachable = await db.execute(sql`
      WITH RECURSIVE roots(t) AS (
        VALUES ('organizations'),('users'),('people'),('sponsors'),('partners')
        UNION
        SELECT c.conrelid::regclass::text
          FROM pg_constraint c JOIN roots r ON c.confrelid::regclass::text = r.t
         WHERE c.contype = 'f'
      ) SELECT DISTINCT t FROM roots`);

    const keep = new Set<string>(KEEP);
    const targets = (reachable.rows as Row[])
      .map((r) => String(r.t))
      .filter((t) => !keep.has(t));

    /*
     * 🔴 THE CENSUS, TAKEN BEFORE ANYTHING IS DELETED.
     *
     * The keep list is a claim, and the only honest way to check a claim about
     * what a wipe did NOT touch is to count those tables on both sides of it.
     * Production holds seven employees and seven salary rows on these tables;
     * dev holds none, so a bug that emptied them would look like a clean run on
     * every database this was tested against and take the payroll on the one
     * that matters. A count taken afterwards and compared cannot miss it.
     */
    const census = async (): Promise<Map<string, number>> => {
      const counts = new Map<string, number>();
      for (const table of KEEP) {
        const { rows } = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${table}`));
        counts.set(table, Number((rows[0] as Row).n));
      }
      return counts;
    };
    const before = await census();

    /* 🔴 The audit columns, nulled, so the keep-list stops pointing at a user. */
    const auditCols = await db.execute(sql`
      SELECT c.conrelid::regclass::text AS child, a.attname AS col
        FROM pg_constraint c
        JOIN unnest(c.conkey) k(attnum) ON true
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
       WHERE c.contype = 'f'
         AND c.confrelid::regclass::text IN ('users','people','organizations')
         AND c.conrelid::regclass::text = ANY(${sql.raw(
           `ARRAY[${KEEP.map((k) => `'${k}'`).join(",")}]`,
         )})`);

    for (const row of auditCols.rows as Row[]) {
      await db.execute(
        sql.raw(`UPDATE ${String(row.child)} SET ${String(row.col)} = NULL`),
      );
    }
    console.log(`  nulled ${String((auditCols.rows as Row[]).length)} audit columns on kept tables`);

    /*
     * 🔴 REPEATED PASSES RATHER THAN A TOPOLOGICAL SORT.
     *
     * The graph has cycles — a user points at an organisation and an
     * organisation's rows point back — so there is no single correct order. A
     * pass deletes what it can and the next pass gets what the first unblocked.
     * It stops when a pass changes nothing, and reports what is left, which is
     * the honest failure: a table that cannot be emptied is named rather than
     * swallowed.
     */
    const left = new Set(targets);
    try {
      /*
       * 🔴 THE ONE RULE THIS SCRIPT BREAKS, NAMED AND PUT BACK.
       *
       * `clinical_summaries_no_rewrite` is a BEFORE DELETE trigger that raises
       * on every row: a clinical summary is append-only, and correcting one
       * means writing version n+1 rather than editing version n. That is a
       * clinical-record rule and it is right.
       *
       * It also means the whole wipe stops dead. `clinical_summaries` is the
       * last thing pointing at `sessions`, which is the last thing pointing at
       * `patients`, so six tables cannot be emptied while one trigger holds.
       *
       * Emptying an entire database is the one act the rule was not written
       * about: there is no version n+1 of a record whose patient no longer
       * exists. So the trigger comes off for the length of the wipe and goes
       * back on in a `finally`, and the last thing this script does is check
       * that it is enabled again — a breach nobody closed is worse than the one
       * that was never opened.
       */
      await db.execute(
        sql`ALTER TABLE clinical_summaries DISABLE TRIGGER clinical_summaries_no_rewrite`,
      );

      for (let pass = 0; pass < 12 && left.size > 0; pass += 1) {
        let progress = false;
        for (const table of [...left]) {
          try {
            await db.execute(sql.raw(`DELETE FROM ${table}`));
            left.delete(table);
            progress = true;
          } catch {
            /* Still has children. The next pass will reach it. */
          }
        }
        if (!progress) break;
      }
    } finally {
      await db.execute(
        sql`ALTER TABLE clinical_summaries ENABLE TRIGGER clinical_summaries_no_rewrite`,
      );
    }

    if (left.size > 0) {
      throw new Error(`could not empty: ${[...left].join(", ")}`);
    }

    /*
     * 🔴 AND THE OTHER HALF OF THE CENSUS, WHICH IS THE ONE THAT MATTERS.
     *
     * A row lost here is not recoverable from anything this script knows. It
     * throws rather than warns, and it names the table and both numbers, so the
     * person reading it can go to the snapshot with something specific.
     *
     * §6: it was checked by planting the offender it exists for. A temporary
     * `DELETE FROM fx_quotes` between the two censuses produced
     * `the wipe took rows it was told to keep: fx_quotes 52 -> 0`, and the run
     * stopped. A comparison nobody has seen fail is a comparison nobody knows
     * the direction of.
     */
    const after = await census();
    const lost = [...before]
      .filter(([table, n]) => (after.get(table) ?? 0) < n)
      .map(([table, n]) => `${table} ${String(n)} -> ${String(after.get(table) ?? 0)}`);
    if (lost.length > 0) {
      throw new Error(`the wipe took rows it was told to keep: ${lost.join(", ")}`);
    }

    const populated = [...before].filter(([, n]) => n > 0).length;
    console.log(
      `  emptied ${String(targets.length)} tables, kept ${String(KEEP.length)} ` +
        `(${String(populated)} of them held rows, and still do)`,
    );

    /* ============================================================== */
    /*  the cast                                                      */
    /* ============================================================== */

    const hash = await hashPassword(DEMO_PASSWORD);
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

    /* ------------------------------------------------ organisations -- */

    const platform = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind) VALUES ('24Therapy', 'eg', '24therapy', 'solo')
      RETURNING id`);

    const solo = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind, contact_name, contact_email, contact_phone)
      VALUES ('Cairo Counselling', 'eg', 'cairo-counselling', 'solo',
              'Omar Abdelgawad', 'omarabdelgawad001@gmail.com', '+201000000010')
      RETURNING id`);

    /*
     * 🔴 `kind` AND `clinic_state` TOGETHER, because the table insists.
     * `organizations_kind_state` is a CHECK: a clinic without a state and a solo
     * practice with one are both refused. A clinic held at 'held' would also
     * shut the clinic portal, and the whole point is to open it.
     */
    const clinic = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind, clinic_state, seats, billing_mode,
                                 contact_name, contact_email, contact_phone)
      VALUES ('Nile Practice', 'eg', 'nile-practice', 'clinic', 'active', 2, 'self',
              'Habiba Heikal', 'habibaheikal27@gmail.com', '+201000000011')
      RETURNING id`);

    /*
     * 🔴 THE TIER KEYS ARE `payg`, `practice` AND `clinic`, and the first draft
     * of this seed wrote `solo`.
     *
     * `solo` was renamed in sprint 57 and nothing prices it any more.
     * `entitledTier` drops a row on a retired key to the free door rather than
     * honouring it, so Dr Omar's practice would have been subscribed to
     * something that does not exist and quietly treated as unsubscribed on
     * every screen that asks. `verify:sprint1` counts orphaned rows and is what
     * caught it.
     */
    for (const [org, plan] of [
      [platform, "payg"],
      [solo, "practice"],
      [clinic, "clinic"],
    ] as const) {
      await db.execute(sql`
        INSERT INTO subscriptions (organization_id, plan, status) VALUES (${org.id}, ${plan}, 'active')
        ON CONFLICT (organization_id) DO NOTHING`);
    }

    /* ------------------------------------------------------- people -- */

    const admin = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, status, timezone)
      VALUES (${platform.id}, 'omar@24therapy.app', 'Omar', 'Abdelgawad', 'super_admin', ${hash}, 'active',
              'Africa/Cairo')
      RETURNING id`);

    /*
     * 🔴 `verification_status` IS NOT WRITTEN HERE, AND MUST NOT BE.
     *
     * `lib/auth/session.ts` reads that column and nothing else to decide whether
     * a clinician may work, so the first draft of this seed set it by hand. The
     * database throws that away: `force_derived_verification_status` is a BEFORE
     * INSERT OR UPDATE trigger that replaces whatever is written with
     * `derived_verification_status(user)`, which reads
     * `therapist_verifications.state`. A value typed in here would have been
     * silently ignored and the seed would have looked like it worked.
     *
     * So the verification row below IS the switch, and the AFTER trigger on that
     * table pushes the derived value back onto the user.
     */
    const drOmar = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, status,
                         session_rate_cents, rate_currency, timezone)
      VALUES (${solo.id}, 'omarabdelgawad001@gmail.com', 'Omar', 'Abdelgawad', 'therapist', ${hash}, 'active',
              6000, 'USD', 'Africa/Cairo')
      RETURNING id`);

    const drSara = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, status,
                         session_rate_cents, rate_currency, timezone)
      VALUES (${clinic.id}, 'dr.sara.demo@example.com', 'Sara', 'Demo', 'therapist', ${hash}, 'active',
              7500, 'USD', 'Africa/Cairo')
      RETURNING id`);

    const drKareem = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, status,
                         session_rate_cents, rate_currency, timezone)
      VALUES (${clinic.id}, 'dr.kareem.example@example.com', 'Kareem', 'Example', 'therapist', ${hash}, 'active',
              7500, 'USD', 'Africa/Cairo')
      RETURNING id`);

    /*
     * 🔴 THE WAITING ROOM IS A FIFTH PERSON, NOT ONE OF THE FOUR.
     *
     * `/admin/verifications` opening onto an empty queue teaches a designer
     * nothing, so somebody has to be waiting. The first draft made that one of
     * the two clinic therapists, and it was the wrong trade: a clinician still
     * waiting cannot hold a caseload, so one of the logins asked for would have
     * opened onto exactly the empty screen this whole seed exists to prevent.
     *
     * So both clinic therapists are approved and working, and the queue item is
     * a separate applicant with no seat and no patients. Her portal IS empty,
     * and that is the screen she is here to show: what a clinician sees between
     * applying and being let in.
     */
    const drYasmin = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, status,
                         session_rate_cents, rate_currency, timezone)
      VALUES (${clinic.id}, 'dr.yasmin.example@example.com', 'Yasmin', 'Example', 'therapist', ${hash}, 'active',
              7500, 'USD', 'Africa/Cairo')
      RETURNING id`);

    /*
     * 🔴 THE VERIFICATION STATES ARE DELIBERATELY DIFFERENT.
     *
     * Two verified and one still waiting, so `/admin/verifications` opens onto
     * a queue with something in it and the clinic's own staff list shows both
     * states. A console whose every queue is empty teaches a designer nothing.
     */
    /*
     * 🔴 THE APPROVED STATE IS SPELLED `approved`, NOT `verified`.
     *
     * Two different words for two different columns, and the first draft used
     * the wrong one in the wrong place. `therapist_verifications.state` is one
     * of draft / submitted / approved / rejected; `users.verification_status`
     * is one of unverified / pending / verified / rejected, derived from it.
     * `history_grants_require_verified` reads the FIRST and tests it against
     * 'approved' exactly, so a row spelled 'verified' leaves a clinician who
     * looks verified on every screen and cannot be handed a record.
     *
     * Licence numbers are fixed rather than random: a seed that writes a
     * different number every run cannot be checked against anything afterwards.
     */
    for (const [user, org, state, licence] of [
      [drOmar, solo, "approved", "EPA-204418"],
      [drSara, clinic, "approved", "EPA-311907"],
      [drKareem, clinic, "approved", "EPA-450236"],
      [drYasmin, clinic, "submitted", "EPA-517740"],
    ] as const) {
      await db.execute(sql`
        INSERT INTO therapist_verifications
          (user_id, organization_id, state, country, license_body, license_number,
           license_expiry, specialties, languages, submitted_at, reviewed_at, reviewed_by)
        VALUES (${user.id}, ${org.id}, ${state}, 'eg', 'Egyptian Psychological Association',
                ${licence}, '2029-06-30',
                '["anxiety","sleep"]'::jsonb, '["ar","en"]'::jsonb, ${daysAgo(40).toISOString()},
                ${state === "approved" ? daysAgo(38).toISOString() : null},
                ${state === "approved" ? admin.id : null})`);
    }

    /* On the radar, so `/radar` is not an empty map. */
    for (const [user, org, headline] of [
      [drOmar, solo, "Anxiety, sleep, and work stress"],
      [drSara, clinic, "Trauma and grief, Arabic and English"],
    ] as const) {
      await db.execute(sql`
        INSERT INTO therapist_radar
          (user_id, organization_id, status, headline, languages, specialties, country, region, city,
           last_seen_at, accepts_walk_ins)
        VALUES (${user.id}, ${org.id}, 'available', ${headline}, '["ar","en"]'::jsonb,
                '["anxiety","sleep"]'::jsonb, 'eg', 'eg', 'Cairo', now(), true)`);
    }

    /* ------------------------------------------------ the clinic --- */

    await db.execute(sql`
      INSERT INTO clinic_managers (organization_id, email, name, password_hash, role)
      VALUES (${clinic.id}, 'habibaheikal27@gmail.com', 'Habiba Heikal', ${hash}, 'admin')`);

    for (const user of [drSara, drKareem]) {
      await db.execute(sql`
        INSERT INTO clinic_seats (organization_id, user_id, billable_from)
        VALUES (${clinic.id}, ${user.id}, ${daysAgo(60).toISOString()})`);
    }

    /* ------------------------------------------------ the company -- */

    const sponsor = await one<{ id: string }>(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES ('Habiba Holdings', 'company', 'eg', 'EGP', 'active')
      RETURNING id`);

    await db.execute(sql`
      INSERT INTO sponsor_users (sponsor_id, email, name, role, password_hash)
      VALUES (${sponsor.id}, 'habiba@24therapy.app', 'Habiba', 'admin', ${hash})`);

    const { openPot } = await import("../lib/data/sponsor-admin");
    const opened = await openPot({
      sponsorId: sponsor.id,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(now.getTime() + 365 * 86_400_000),
      overdraftCents: 5_000,
      welcomeCreditCents: 10_000,
    });
    if (opened.error) throw new Error(`openPot: ${opened.error}`);

    /* A real top-up, through the cart and confirmed by the operator. */
    const { openCart } = await import("../lib/billing/cart");
    const { submitProof, confirmPayment, egpMinorFor, egpRateMicro } = await import(
      "../lib/billing/manual"
    );
    const { grantFor } = await import("../lib/billing/manual-grants");
    const { potTopUpMoney, entityVatBps } = await import("../lib/billing/pot");

    const rate = await egpRateMicro();
    const money = potTopUpMoney({ creditCents: 250_000, vatBps: await entityVatBps("eg") });
    const topUp = await openCart({
      purpose: "pot_topup",
      refId: sponsor.id,
      amountCents: egpMinorFor(money.settlesCents, rate),
      settlesCents: money.settlesCents,
      lineItems: [
        { label: "Pot credit", cents: money.creditCents },
        { label: "VAT", cents: money.vatCents },
      ],
      payer: { kind: "sponsor", sponsorId: sponsor.id },
    });
    if (!topUp.id) throw new Error(`openCart: ${topUp.error ?? "no payment id"}`);
    await submitProof({ paymentId: topUp.id, reference: "MISR-88120", proofUrl: null });
    await confirmPayment({ paymentId: topUp.id, byUserId: admin.id, onConfirmed: grantFor });

    /* The company covers 60%, so a covered session splits visibly. */
    await db.execute(sql`
      UPDATE sponsor_pots SET coverage_bps = 6000 WHERE sponsor_id = ${sponsor.id}`);

    /*
     * 🔴 THE MONEY IS CHECKED HERE, BECAUSE `confirmPayment` DOES NOT FAIL LOUD.
     *
     * A grant that throws is logged and swallowed: the payment is marked
     * confirmed and the caller is told it worked. That is the right shape for a
     * console, where an operator needs the payment recorded whatever happened
     * next, and the wrong shape for a script that carries on writing sessions
     * against a pot with nothing in it.
     *
     * It was found the only way it could be. The pot came out at **minus 3,500
     * cents** — the welcome credit, less three sessions it should never have
     * been able to pay for — and the seed reported success. The cause was
     * 78.6's clock skew; the reason it got as far as a negative balance is
     * this check not existing.
     */
    const funded = await one<{ balance: number }>(sql`
      SELECT balance_cents AS balance FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);
    const wanted = 10_000 + money.creditCents;
    if (Number(funded.balance) !== wanted) {
      throw new Error(
        `the pot holds ${String(funded.balance)} cents and should hold ${String(wanted)}: ` +
          "the welcome credit plus the top-up. The grant did not land",
      );
    }
    console.log(`  pot funded: ${String(funded.balance)} cents, covering 60 per cent`);

    /* ------------------------------------------------ the patients -- */

    const person = async (first: string, last: string, email: string, phone: string) =>
      one<{ id: string }>(sql`
        INSERT INTO people (first_name, last_name, email, phone, region)
        VALUES (${first}, ${last}, ${email}, ${phone}, 'eg')
        RETURNING id`);

    /*
     * 🔴 CLAIMING IS A STATE ON THE PERSON, and every screen asks the person.
     *
     * `assertClaimed` in `lib/data/people.ts` refuses a journal, a homework tick
     * and a record export while `claimed_at` is null, so an account created
     * without stamping it is an account that signs in and can do nothing. The
     * stamp names the account that did it, which is what the real claim writes.
     */
    const account = async (personId: string, email: string, phone: string) => {
      const row = await one<{ id: string }>(sql`
        INSERT INTO patient_accounts (person_id, email, password_hash, email_verified_at, phone,
                                      phone_verified_at, timezone)
        VALUES (${personId}, ${email}, ${hash}, now(), ${phone}, now(), 'Africa/Cairo')
        RETURNING id`);
      await db.execute(sql`
        UPDATE people SET claimed_at = now(), claimed_by_account_id = ${row.id} WHERE id = ${personId}`);
      return row;
    };

    /*
     * 🔴 `therapist_id`, WITHOUT WHICH EVERY CASELOAD IS EMPTY.
     *
     * `scope()` in `lib/data/patients.ts` narrows a clinician to
     * `patients.therapist_id = me`. A chart seeded with a null there belongs to
     * the organisation and to nobody, so the clinician signs in to the exact
     * empty list this whole seed was written to prevent.
     */
    const chart = async (opts: {
      orgId: string;
      therapistId: string;
      personId: string;
      first: string;
      last: string;
      email: string;
      phone: string;
      source?: string;
    }) =>
      one<{ id: string }>(sql`
        INSERT INTO patients (organization_id, therapist_id, person_id, first_name, last_name,
                              email, phone, source, timezone)
        VALUES (${opts.orgId}, ${opts.therapistId}, ${opts.personId}, ${opts.first}, ${opts.last},
                ${opts.email}, ${opts.phone}, ${opts.source ?? "self"}, 'Africa/Cairo')
        RETURNING id`);

    /* 1 — Omar: has an account, has history, and is NOT enrolled anywhere. */
    const omarPerson = await person("Omar", "Ahmad", "mr.3omar.a7mad@gmail.com", "+201000000001");
    const omarAccount = await account(omarPerson.id, "mr.3omar.a7mad@gmail.com", "+201000000001");
    const omarChart = await chart({
      orgId: solo.id, therapistId: drOmar.id, personId: omarPerson.id,
      first: "Omar", last: "Ahmad", email: "mr.3omar.a7mad@gmail.com", phone: "+201000000001",
    });

    /*
     * 2 — Laila: a chart the clinician wrote down, with a person behind it and
     * NO account. `claimed_at` stays null, which is the state the whole claim
     * flow exists for and the one nobody ever has on a test database.
     *
     * `source = 'therapist'` is what `createPatient` writes, and migration 0042
     * makes the phone mandatory for exactly that source: a record nobody can be
     * invited to claim is a record nobody can ever be handed.
     */
    const lailaPerson = await person("Laila", "Demo", "laila.demo@example.com", "+201000000002");
    const lailaChart = await chart({
      orgId: solo.id, therapistId: drOmar.id, personId: lailaPerson.id,
      first: "Laila", last: "Demo", email: "laila.demo@example.com", phone: "+201000000002",
      source: "therapist",
    });

    /* 3 — Mariam: enrolled at the company, and the pot pays for her sessions. */
    const mariamPerson = await person("Mariam", "Demo", "mariam.demo@example.com", "+201000000003");
    const mariamAccount = await account(mariamPerson.id, "mariam.demo@example.com", "+201000000003");
    const mariamChart = await chart({
      orgId: clinic.id, therapistId: drSara.id, personId: mariamPerson.id,
      first: "Mariam", last: "Demo", email: "mariam.demo@example.com", phone: "+201000000003",
    });
    await db.execute(sql`
      INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash,
                              identifier_kind, last_verified_at)
      VALUES (${sponsor.id}, ${mariamPerson.id}, 'active', true, 'demo-mariam', 'domain_email', now())`);

    /* 4 — Tarek: saw one clinician, then handed the record to a second. */
    const tarekPerson = await person("Tarek", "Demo", "tarek.demo@example.com", "+201000000004");
    const tarekAccount = await account(tarekPerson.id, "tarek.demo@example.com", "+201000000004");
    const tarekChart = await chart({
      orgId: solo.id, therapistId: drOmar.id, personId: tarekPerson.id,
      first: "Tarek", last: "Demo", email: "tarek.demo@example.com", phone: "+201000000004",
    });
    const tarekAtClinic = await chart({
      orgId: clinic.id, therapistId: drSara.id, personId: tarekPerson.id,
      first: "Tarek", last: "Demo", email: "tarek.demo@example.com", phone: "+201000000004",
    });

    /* 5 — Nadia: Dr Kareem's own caseload, so the second clinic seat is not empty. */
    const nadiaPerson = await person("Nadia", "Demo", "nadia.demo@example.com", "+201000000005");
    const nadiaAccount = await account(nadiaPerson.id, "nadia.demo@example.com", "+201000000005");
    const nadiaChart = await chart({
      orgId: clinic.id, therapistId: drKareem.id, personId: nadiaPerson.id,
      first: "Nadia", last: "Demo", email: "nadia.demo@example.com", phone: "+201000000005",
    });

    await db.execute(sql`
      INSERT INTO history_grants (person_id, therapist_user_id, organization_id, status, shape,
                                  request_note, requested_at, decided_at)
      VALUES (${tarekPerson.id}, ${drSara.id}, ${clinic.id}, 'granted', 'summary',
              'Moving to the practice and would like the history to come with me.',
              ${daysAgo(20).toISOString()}, ${daysAgo(19).toISOString()})`);

    /*
     * 🔴 TWO VERSIONS, TWO CLINICIANS, BOTH KEPT. That is the portability claim
     * the whole public site rests on, and it is the one thing that cannot be
     * demonstrated on an empty database.
     */
    await db.execute(sql`
      INSERT INTO clinical_summaries (person_id, version, body, approved_by_user_id, approved_by_name,
                                      approved_by_credentials, organization_id, approved_at)
      VALUES
        (${tarekPerson.id}, 1,
         'Came about sleep and we found the pattern around performance reviews within two sessions. The wind-down routine helps on the nights he keeps it. Handing over because he is moving practice, not because anything went wrong.',
         ${drOmar.id}, 'Dr Omar Abdelgawad', 'Psychotherapist', ${solo.id}, ${daysAgo(21).toISOString()}),
        (${tarekPerson.id}, 2,
         'Picking up from Dr Abdelgawad. Sleep is steadier and the work anxiety underneath it is what we are on now. He named the reviews rather than the job as the trigger, which is worth holding on to.',
         ${drSara.id}, 'Dr Sara Demo', 'Clinical psychologist', ${clinic.id}, ${daysAgo(5).toISOString()})`);

    /*
     * 🔴 EVERY PATIENT WITH AN ACCOUNT GETS A SUMMARY, not only the one whose
     * record moved. The Record tab is the first screen a patient opens, and a
     * cast where two of three find it blank would send the redesign looking for
     * a bug in the page rather than at the page.
     */
    await db.execute(sql`
      INSERT INTO clinical_summaries (person_id, version, body, approved_by_user_id, approved_by_name,
                                      approved_by_credentials, organization_id, approved_at)
      VALUES
        (${omarPerson.id}, 1,
         'Started about sleep. Middle-insomnia, waking around three, and it tracks performance reviews rather than the job itself. The wind-down routine works on the nights he keeps it, and adherence is the thing we are on now rather than strategy.',
         ${drOmar.id}, 'Dr Omar Abdelgawad', 'Psychotherapist', ${solo.id}, ${daysAgo(4).toISOString()}),
        (${mariamPerson.id}, 1,
         'Work stress with a sleep component underneath it. Responds well to naming the trigger out loud, and the written record between sessions is doing more work than anything done in the room.',
         ${drSara.id}, 'Dr Sara Demo', 'Clinical psychologist', ${clinic.id}, ${daysAgo(3).toISOString()}),
        (${nadiaPerson.id}, 1,
         'Low mood with a long avoidance pattern around one conversation at home. Four sessions in and the pattern is named rather than argued with, which is the step that was missing.',
         ${drKareem.id}, 'Dr Kareem Example', 'Psychotherapist', ${clinic.id}, ${daysAgo(6).toISOString()})`);

    console.log("  people and charts in place");

    /* ============================================================== */
    /*  history: sessions, notes, homework, journals                  */
    /* ============================================================== */

    const TRANSCRIPT: { speaker: "therapist" | "patient"; text: string }[] = [
      { speaker: "therapist", text: "Good to see you. How has the week been since we last spoke?" },
      { speaker: "patient", text: "Harder than I expected, honestly. The sleep thing came back." },
      { speaker: "therapist", text: "Tell me about the sleep. Falling asleep, or staying asleep?" },
      { speaker: "patient", text: "Staying asleep. I wake around three and my head just starts going." },
      { speaker: "patient", text: "It is mostly work. There is a review coming up and I keep rehearsing it." },
      { speaker: "therapist", text: "So the rehearsing starts once you are already awake." },
      { speaker: "patient", text: "Right. And then I am exhausted all day, which makes it worse." },
      { speaker: "therapist", text: "Did you get a chance to try the wind-down routine?" },
      { speaker: "patient", text: "Twice. The nights I did it I got back to sleep faster." },
      { speaker: "therapist", text: "That is worth noticing. Two out of seven, and both were better." },
    ];

    /*
     * 🔴 A DIFFERENT NOTE EACH SESSION, because a list of identical ones is a
     * screen nobody can judge.
     *
     * Every session carried the same note in the first draft, and the patient's
     * app draws each session's `patientBrief` in its list — so the main screen
     * was the same paragraph three times over. It looked like a rendering bug
     * rather than a seed, which is the worst thing to hand somebody who is
     * about to redesign that page.
     *
     * These are the same episode of care moving forward: the same person, the
     * same problem, six weeks of it, so a reader can follow the thread down the
     * page rather than seeing one moment repeated.
     */
    const BRIEFS: { brief: string; steps: string[]; next: string }[] = [
      {
        brief:
          "Two of seven nights went better, and that is worth naming. Keep the wind-down going and we will look at it again in two weeks.",
        steps: ["Wind-down routine, four nights", "Note which nights you managed it"],
        next: "Same time next week. Bring the nights you wrote down.",
      },
      {
        brief:
          "Four nights this week, and the waking is later than it was. Nothing about the review has changed, so what changed is what you are doing with the hour before bed.",
        steps: ["Keep the four nights", "Write down roughly when you woke"],
        next: "Same time next week.",
      },
      {
        brief:
          "You got out of bed at half one instead of lying there, and you were back down inside twenty minutes. That is the piece that has been missing.",
        steps: ["Out of bed after twenty minutes awake", "Same wake time, whatever the night was like"],
        next: "Same time next week. We will look at the reviews themselves.",
      },
      {
        brief:
          "The review is on Thursday and you have not rehearsed it in bed once this week. Worth saying out loud, because in March that was the whole problem.",
        steps: ["Hold the wake time through the review week"],
        next: "The week after the review.",
      },
      {
        brief:
          "The review went the way you expected and the sleep did not come apart, which is the first time that has been true.",
        steps: ["Keep the wind-down on the nights it is easy", "Stop writing the times down"],
        next: "Two weeks.",
      },
      {
        brief:
          "Two weeks with nothing to report is the point rather than a quiet session. We talked about what you would do if it came back.",
        steps: ["Nothing set this week"],
        next: "A month, and sooner if you want it.",
      },
    ];

    const NOTE = {
      soap: {
        subjective:
          "Reports a return of middle-insomnia over the past week, waking around 03:00 with ruminative thinking about an upcoming performance review.",
        objective: "Arrived on time. Engaged throughout. No acute distress observed.",
        assessment:
          "Recurrence of anxiety-driven sleep disruption in the context of a time-limited work stressor. Adherence, not strategy, appears to be the limiting factor.",
        plan: "Increase the wind-down routine target to four nights and record which nights were completed.",
      },
      summary:
        "Follow-up session addressing a one-week recurrence of middle-insomnia linked to anticipatory work anxiety.",
      patientBrief:
        "Two of seven nights went better, and that is worth naming. Keep the wind-down going and we will look at it again in two weeks.",
      patientSteps: ["Wind-down routine, four nights", "Note which nights you managed it"],
      patientNext: "Same time next week. Bring the nights you wrote down.",
      talkingPoints: ["The review, and what happens after it", "What made the two better nights different"],
      observations: "Engaged, no acute distress, no risk indicators elicited or observed.",
      impressions: "Consistent with the established formulation rather than a new process.",
      recommendations: ["Raise the adherence target", "Review if middle-insomnia outlasts the review date"],
      followUp: "One week.",
    };

    /** The brief this session carries, rotated so no two in a row are the same. */
    const noteFor = (n: number) => {
      const row = BRIEFS[(n - 1) % BRIEFS.length]!;
      return { patientBrief: row.brief, patientSteps: row.steps, patientNext: row.next };
    };

    let token = 0;
    const held = async (opts: {
      orgId: string;
      therapistId: string;
      patientId: string;
      when: Date;
      priceCents: number;
      paymentStatus: string;
      modality?: string;
      withNote?: boolean;
    }) => {
      token += 1;
      const ended = new Date(opts.when.getTime() + 50 * 60_000);
      /*
       * `note_status` and `duration_minutes` are written because the screens
       * read them rather than deriving them: a completed session left at
       * `note_status = 'none'` draws "generating your note" for ever, and a null
       * duration prints a blank where every list shows fifty minutes.
       */
      /*
       * 🔴 `session_type` IS WRITTEN, because the product writes it.
       *
       * `createSession` records `price > 0 ? "paid_link" : "direct"` — where a
       * session came from, recorded at birth rather than inferred later. A seed
       * that leaves the column on its default produces priced sessions that
       * claim to be unpriced direct ones, and `verify:sprint4` is what noticed.
       */
      const session = await one<{ id: string }>(sql`
        INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                              session_type, join_token, feedback_token, price_cents, price_currency,
                              payment_status, scheduled_at, started_at, ended_at, duration_minutes,
                              note_status, recording_consent, recording_consent_at, transcript_language)
        VALUES (${opts.orgId}, ${opts.therapistId}, ${opts.patientId}, 'completed',
                ${opts.modality ?? "video"}, 'paid_link', ${`demo-join-${String(token)}`},
                ${`demo-fb-${String(token)}`}, ${opts.priceCents}, 'USD', ${opts.paymentStatus},
                ${opts.when.toISOString()}, ${opts.when.toISOString()}, ${ended.toISOString()},
                50, ${opts.withNote === false ? "none" : "ready"},
                'granted', ${opts.when.toISOString()}, 'en')
        RETURNING id`);

      for (const [i, line] of TRANSCRIPT.entries()) {
        await db.execute(sql`
          INSERT INTO transcript_segments (session_id, organization_id, sequence, speaker, text, start_ms, end_ms)
          VALUES (${session.id}, ${opts.orgId}, ${i + 1}, ${line.speaker}, ${line.text},
                  ${i * 8000}, ${(i + 1) * 8000})`);
      }

      if (opts.withNote !== false) {
        /*
         * 🔴 TWO APPROVALS AND A PROVENANCE, all three of which the first draft
         * left on their defaults, and the patient's app said so.
         *
         *   - `status` is the CLINICAL record being signed. `patient_status` is
         *     a separate decision to release it to the person it is about, and
         *     `lib/data/patient-view.ts` reads only the second. With it left at
         *     `draft`, every session in the patient's app read "Your therapist
         *     is still writing your summary" while the note sat approved on the
         *     clinician's side. That is the product being careful, and it made
         *     the patient's main screen a list of apologies.
         *
         *   - `provenance` defaults to `clinician`, which draws "This session
         *     was not recorded". These notes have a full transcript behind
         *     them, so `transcript` is the true answer. The default is the
         *     honest one for a note nobody can vouch for; claiming it here
         *     would be a lie in the other direction.
         */
        await db.execute(sql`
          INSERT INTO session_notes (session_id, organization_id, therapist_id, patient_id, content,
                                     status, approved_at, approved_by, patient_status,
                                     patient_approved_at, patient_approved_by, provenance,
                                     language, model)
          VALUES (${session.id}, ${opts.orgId}, ${opts.therapistId}, ${opts.patientId},
                  ${JSON.stringify({ ...NOTE, ...noteFor(token) })}::jsonb, 'approved', ${ended.toISOString()},
                  ${opts.therapistId}, 'approved', ${ended.toISOString()},
                  ${opts.therapistId}, 'transcript', 'en', 'seed')`);
      }

      await db.execute(sql`
        UPDATE patients SET last_session_at = ${ended.toISOString()} WHERE id = ${opts.patientId}`);
      return session;
    };

    /* Dr Omar's caseload: Omar over two months, Laila once, Tarek before he moved. */
    for (const n of [3, 10, 17, 24, 31, 45]) {
      await held({
        orgId: solo.id, therapistId: drOmar.id, patientId: omarChart.id,
        when: daysAgo(n), priceCents: 6_000,
        paymentStatus: n === 3 ? "pending" : "paid",
      });
    }
    await held({
      orgId: solo.id, therapistId: drOmar.id, patientId: lailaChart.id,
      when: daysAgo(12), priceCents: 6_000, paymentStatus: "paid", modality: "in_person",
    });
    for (const n of [28, 35]) {
      await held({
        orgId: solo.id, therapistId: drOmar.id, patientId: tarekChart.id,
        when: daysAgo(n), priceCents: 6_000, paymentStatus: "paid",
      });
    }

    /*
     * 🔴 SIX COVERED SESSIONS, NOT THREE, BECAUSE OF THE SMALL-NUMBERS FLOOR.
     *
     * A sponsor is shown `published_balance_cents`, and that figure is only
     * republished once `sessions - published_sessions >= settings.sponsor
     * .activityFloor`, which is five. The rule is right and it is one of the
     * strongest things about the employer side: a balance that moves after
     * every session is a balance an employer can difference to work out that
     * somebody went this week.
     *
     * With three covered sessions the company's own headline read "Not enough
     * activity to report yet". That is the privacy rule working and it is the
     * wrong screen to hand a redesign, because it looks exactly like an empty
     * one. Six crosses the floor, publishes a real balance, and still reads as
     * a person seeing somebody weekly.
     */
    for (const n of [4, 11, 18, 25, 32, 39]) {
      const s = await held({
        orgId: clinic.id, therapistId: drSara.id, patientId: mariamChart.id,
        when: daysAgo(n), priceCents: 7_500, paymentStatus: "pending",
      });
      /* 🔴 Through `payFromPot`, so the ledger has the company's 60% in it. */
      const { payFromPot } = await import("../lib/billing/pot");
      const spend = await payFromPot(s.id);
      if (!spend.paid) console.log(`  note: the pot declined one session (${spend.reason ?? "?"})`);
    }
    await held({
      orgId: clinic.id, therapistId: drSara.id, patientId: tarekAtClinic.id,
      when: daysAgo(5), priceCents: 7_500, paymentStatus: "paid",
    });
    /* Dr Kareem's own caseload, so the second clinic seat opens onto work. */
    for (const n of [6, 13, 20, 27]) {
      await held({
        orgId: clinic.id, therapistId: drKareem.id, patientId: nadiaChart.id,
        when: daysAgo(n), priceCents: 7_500, paymentStatus: n === 6 ? "pending" : "paid",
      });
    }

    /* One booked in the future, so every Sessions tab has something ahead of it. */
    await db.execute(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            join_token, feedback_token, price_cents, payment_status, scheduled_at)
      VALUES (${solo.id}, ${drOmar.id}, ${omarChart.id}, 'scheduled', 'video',
              'demo-join-next', 'demo-fb-next', 6000, 'pending', now() + interval '2 days')`);

    /* ------------------------------------- what the patient's app shows -- */

    for (const [personId, orgId, userId] of [
      [omarPerson.id, solo.id, drOmar.id],
      [mariamPerson.id, clinic.id, drSara.id],
      [tarekPerson.id, clinic.id, drSara.id],
      [nadiaPerson.id, clinic.id, drKareem.id],
    ] as const) {
      for (const [title, detail] of [
        ["Screens down an hour before bed", "Four nights. Pick them now."],
        ["Same wake time after a bad night", "The one that does the most work."],
        ["Two times, written down", "Roughly asleep, roughly awake. Not a diary."],
      ] as const) {
        await db.execute(sql`
          INSERT INTO homework_items (person_id, assigned_by_user_id, organization_id, title, detail, source, status)
          VALUES (${personId}, ${userId}, ${orgId}, ${title}, ${detail}, 'session', 'open')`);
      }

      for (const [n, text] of [
        [2, "Sleep disruption returns before performance reviews, twice now."],
        [9, "Kept the wind-down on four nights. Named it as the first thing that has worked."],
        [16, "Describes the wind-down routine as pointless before trying it."],
      ] as const) {
        await db.execute(sql`
          INSERT INTO observations (person_id, observed_at, text, source)
          VALUES (${personId}, ${daysAgo(n).toISOString()}, ${text}, 'session')`);
      }
    }

    for (const [personId, accountId, body] of [
      [omarPerson.id, omarAccount.id, "Slept through for the first time in about three weeks. Nothing special happened, which is the annoying part."],
      [omarPerson.id, omarAccount.id, "Got out of bed at half one like he said instead of lying there. Felt stupid. Went back down quicker though."],
      [mariamPerson.id, mariamAccount.id, "Wrote the review thing down before bed. Still thought about it, but it did not feel like it was growing."],
      [tarekPerson.id, tarekAccount.id, "First week at the new practice. Did not have to explain the whole thing again, which I was dreading."],
      [nadiaPerson.id, nadiaAccount.id, "Said the thing out loud in session that I have been writing down for a month. It was less of a big deal than I had built it into."],
    ] as const) {
      /* `journals_source` admits 'typed' and 'dictated', and nothing else. */
      await db.execute(sql`
        INSERT INTO journals (person_id, account_id, source, body)
        VALUES (${personId}, ${accountId}, 'typed', ${body})`);
    }

    /* ------------------------------------------- what the session cost -- */

    /*
     * 🔴 EVERY COMPLETED SESSION IS BILLED, through the product's own function.
     *
     * Without this the admin console reads "Collected $0 · Outstanding $0" on
     * its overview and `/admin/actuals` has no revenue in it, which is a
     * console about money with no money in it. `chargeForSession` raises the
     * invoice, its platform and AI lines, and the ledger legs behind them; it
     * reads the consent state off the session to decide the AI line, which is
     * why the sessions above record `recording_consent = 'granted'`.
     *
     * Pot-funded sessions are skipped: `payFromPot` already did their books,
     * and charging them again would bill the clinic for a session the company
     * has paid for.
     */
    const toBill = (
      await db.execute(sql`
        SELECT s.id, s.organization_id AS org FROM sessions s
         WHERE s.status = 'completed'
           AND NOT EXISTS (SELECT 1 FROM session_payments p WHERE p.session_id = s.id)`)
    ).rows as Row[];

    const { chargeForSession } = await import("../lib/billing/service");
    let billed = 0;
    for (const row of toBill) {
      const charged = await chargeForSession({
        organizationId: String(row.org),
        sessionId: String(row.id),
      });
      if (charged) billed += 1;
    }
    console.log(`  billed ${String(billed)} of ${String(toBill.length)} sessions`);

    /* ------------------------------------------------- the copilot -- */

    /*
     * 🔴 A THREAD PER PATIENT, because the copilot is the product's headline
     * and an empty one is the worst screen to hand a redesign.
     *
     * The answers below are written out rather than generated: this seed must
     * not spend money on a model, and a canned answer that reads like the real
     * one shows the same layout. What it must NOT do is invent a citation, so
     * each answer cites the session it came from by id and nothing else.
     *
     * `verify:sprint48` also refuses to run against a database with no thread
     * in it, and was reporting that refusal as a failure on every swept run.
     */
    const copilotFor = async (opts: {
      chartId: string;
      orgId: string;
      therapistId: string;
      question: string;
      answer: string;
      sessionId: string;
    }) => {
      const thread = await one<{ id: string }>(sql`
        INSERT INTO copilot_threads (patient_id, organization_id, therapist_id, reply_language,
                                     last_message_at)
        VALUES (${opts.chartId}, ${opts.orgId}, ${opts.therapistId}, 'en', now())
        RETURNING id`);
      await db.execute(sql`
        INSERT INTO copilot_messages (thread_id, role, content, session_id, created_at)
        VALUES (${thread.id}, 'therapist', ${opts.question}, ${opts.sessionId}, ${daysAgo(3).toISOString()})`);
      await db.execute(sql`
        INSERT INTO copilot_messages (thread_id, role, content, citations, session_id, created_at)
        VALUES (${thread.id}, 'assistant', ${opts.answer},
                ${JSON.stringify([{ sessionId: opts.sessionId, quote: "Staying asleep. I wake around three and my head just starts going." }])}::jsonb,
                ${opts.sessionId}, ${daysAgo(3).toISOString()})`);
      return thread;
    };

    const [anyOmarSession] = (
      await db.execute(sql`
        SELECT id FROM sessions WHERE patient_id = ${omarChart.id} AND status = 'completed' LIMIT 1`)
    ).rows as Row[];
    if (anyOmarSession) {
      await copilotFor({
        chartId: omarChart.id,
        orgId: solo.id,
        therapistId: drOmar.id,
        sessionId: String(anyOmarSession.id),
        question: "What have we actually tried for the middle-insomnia, and what stuck?",
        answer:
          "Two things so far. The wind-down routine, which he has kept on two nights of seven and both of those nights went better, and getting out of bed after twenty minutes awake rather than lying there, which he tried once and described as feeling stupid but effective. Adherence rather than strategy looks like the limiting factor.",
      });
    }

    const [anyMariamSession] = (
      await db.execute(sql`
        SELECT id FROM sessions WHERE patient_id = ${mariamChart.id} AND status = 'completed' LIMIT 1`)
    ).rows as Row[];
    if (anyMariamSession) {
      await copilotFor({
        chartId: mariamChart.id,
        orgId: clinic.id,
        therapistId: drSara.id,
        sessionId: String(anyMariamSession.id),
        question: "Has she named the trigger herself, or have I been naming it for her?",
        answer:
          "She named it in the last session, unprompted: the review rather than the job. Before that it was you offering it and her agreeing, which is a weaker form of the same sentence.",
      });
    }

    /* ------------------------------------------ money the operator sees -- */

    await db.execute(sql`
      INSERT INTO payout_methods (therapist_id, organization_id, method, identifier, account_name, currency, is_default)
      VALUES (${drOmar.id}, ${solo.id}, 'instapay', 'dr.omar@instapay', 'Omar Abdelgawad', 'EGP', true)`);

    await db.execute(sql`
      INSERT INTO payout_requests (organization_id, therapist_id, amount_cents, payout_amount_minor,
                                   payout_currency, entity, method, identifier, account_name,
                                   status, requested_at)
      VALUES (${solo.id}, ${drOmar.id}, 25_500, 1_275_000, 'EGP', 'eg', 'instapay',
              'dr.omar@instapay', 'Omar Abdelgawad', 'requested', ${daysAgo(2).toISOString()})`);

    await db.execute(sql`
      INSERT INTO support_tickets (reference, source, name, email, phone, topic, message, entity,
                                   status, audience, locale, due_at)
      VALUES ('SUP-DEMO-01', 'web', 'Laila Demo', 'laila.demo@example.com', '+201000000002', 'account',
              'I got a code to claim my record but the link says it has expired. Can you send another?',
              'eg', 'open', 'patient', 'en', now() + interval '20 hours')`);

    /* ============================================================== */
    /*  what to type in                                               */
    /* ============================================================== */

    console.log(`\n🔴 Seeded. One password for every login: ${DEMO_PASSWORD}\n`);
    /* Printed from `_demo-cast.ts` rather than typed here, so this list and the
     * one `verify:demo` checks cannot disagree about who exists. */
    for (const login of DEMO_LOGINS) {
      console.log(`  ${login.who.padEnd(32)} ${login.where.padEnd(34)} ${login.email}`);
    }
    console.log(
      `  ${"Patient, never claimed".padEnd(32)} ${"(no account, on Dr Omar's list)".padEnd(34)} ${UNCLAIMED_EMAIL}`,
    );
    console.log("");
  } finally {
    await pool.end();
  }
}

main();
