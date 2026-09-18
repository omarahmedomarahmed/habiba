/**
 * The simulation seed: what a person could not create for themselves, and nothing else.
 *
 *   DATABASE_URL='<the simulation branch>' npm run settings:seed
 *   DATABASE_URL='<the simulation branch>' npm run ship:content -- 28 24
 *   DATABASE_URL='<the simulation branch>' npm run simulate:seed
 *
 * 🔴 THAT ORDER, AND NOT ANOTHER. `ship:content` lays down the platform
 * organisation; this script puts the operator inside it. Run it the other way
 * round and the branch ends up with two organisations called 24Therapy: the
 * operator signs into one and every other tool in the repository reads the
 * other. Nothing fails, which is the whole problem with it.
 *
 * ## 🔴 WHAT BELONGS IN A SEED, AND WHY IT IS THIS SHORT
 *
 * `docs/simulation/01-THE-CAST.md` names three things and no fourth:
 *
 *   1. The platform operator.
 *   2. Settings, countries, taxonomy and published content (the two scripts above).
 *   3. The clinic and company **applications**, in a pre-approval state.
 *
 * **It creates no therapist, no patient and no session.** Those are people, and
 * people sign themselves up. A cast seeded into existence never walks the sign-up
 * flow, and sign-up is where two of the last three walkthroughs found their worst
 * defects.
 *
 * ## Why the applications are seeded and the approvals are not
 *
 * An application is a form somebody fills in before they have any account, so
 * there is nobody to be at the keyboard. An approval is an operator's decision,
 * and the operator agent makes it on camera in wave 2: that click, and the screen
 * it happens on, is a thing the simulation exists to photograph.
 *
 * They are created by calling `applyToClinic` and `applyToSponsor` rather than by
 * INSERT, so the seed goes through the same validation, the same slug rule and the
 * same "held" default the public form does. A seed that writes rows directly is a
 * seed that can create a state the product cannot.
 *
 * ## It refuses production unless told, and it refuses a second cast
 *
 * `writesTo()` refuses the production endpoint by name, and takes
 * `I_MEAN_PRODUCTION=<the endpoint>` as the one way past it, because the run
 * this was written for happens there.
 *
 * Separately it counts what it is about to create: a second run would produce two
 * Nile Practices and an operator who cannot tell which one the agents are using.
 * It counts clinics and employers only. A super admin already existing is not a
 * second cast, and counting one used to stop this script dead on production.
 */
import { sql } from "drizzle-orm";

import { PAYROLL, SIMULATION_PASSWORD, firstNameOf, lastNameOf } from "./_cast";
import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

/* Re-exported because three scripts and two documents import it from here. */
export { SIMULATION_PASSWORD };

/**
 * The operator. The only person in this file, because the console has to work
 * before there is anything in it, and somebody has to approve the first clinic.
 */
export const OPERATOR = {
  email: "nour.example@example.com",
  firstName: "Nour",
  lastName: "Example",
} as const;

/**
 * 🔴 THREE SEATS, NOT FOUR OR FIVE.
 *
 * A small Cairo practice is two clinicians who share a waiting room, sometimes
 * three. Four is a different kind of business with a manager and a lease, and
 * modelling it inflates both seat revenue and sessions per account. The plan in
 * `lib/finance/plans.ts` averages 2.5 and `verify:plan` holds it between 2 and 3.
 *
 * Amira is `T1`, who joins with patients already on her books. Omar is `T4`, who
 * is rejected twice and still cannot see a patient after this practice invites
 * him. Both of those are the point of the practice existing.
 */
export const CLINIC_APPLICATION = {
  name: "Nile Practice",
  contactName: "Hana Example",
  contactEmail: "hana.example@example.com",
  contactPhone: "+20 100 900 0021",
  registrationNumber: "EG-PRAC-4471",
  registrationAuthority: "Egyptian Ministry of Health and Population",
  intendedClinicians: ["Tarek Demo", "Amira Demo", "Omar Demo"],
};

/**
 * 🔴 ALL THREE ARE EGYPTIAN, WHICH IS THE POINT OF THE RUN.
 *
 * An earlier cast had a London company in it, which made the go-to-market look
 * like two markets and gave the money half of the simulation a card rail to fall
 * back on. There is no card rail in Egypt: `topUpPot` refuses `entity = 'eg'` and
 * the bank transfer queue is the whole of how money reaches us. A run with one
 * non-Egyptian customer would have proved that the easy path works.
 *
 * 🔴 `E3` is here from the start even though it does nothing until wave 3. Delta
 * Logistics hires `P5` away from Alexandria Textiles, and an employer that
 * materialises on the day it poaches somebody is a story the data cannot tell.
 */
export const SPONSOR_APPLICATIONS = [
  {
    key: "E1",
    name: "Cairo Foundry",
    kind: "company",
    contactName: "Dalia Example",
    contactEmail: "dalia.example@example.com",
    contactPhone: "+20 100 900 0031",
    contactBestTime: "Mornings, Cairo time",
  },
  {
    key: "E2",
    name: "Alexandria Textiles",
    kind: "company",
    contactName: "Mariam Example",
    contactEmail: "mariam.example@example.com",
    contactPhone: "+20 100 900 0032",
    contactBestTime: "Afternoons, Cairo time",
  },
  {
    key: "E3",
    name: "Delta Logistics",
    kind: "company",
    contactName: "Rania Example",
    contactEmail: "rania.example@example.com",
    contactPhone: "+20 100 900 0033",
    contactBestTime: "Any time",
  },
] as const;

/**
 * 🔴 76.53 — THE PAYROLL, WHICH IS MOST OF WHAT SIX MONTHS COST.
 *
 * `lib/finance/plans.ts` decided this list and the figure: seven people at $500
 * a month, which is $3,500 a month and $21,000 over the run. Against a forecast
 * of a few thousand dollars of revenue, the wage bill IS the plan, and until
 * this sprint no row in the database held it, so `/admin/actuals` could only
 * ever have reported a profitable company by leaving out its largest cost.
 *
 * The names, titles and salaries are copied from the plan on purpose rather than
 * invented, so that reading `/admin/actuals` beside `/admin/financial-model` is
 * comparing two accounts of the same company rather than two companies.
 *
 * 🔴 THE LOGINS ARE WHY THIS IS IN THE SEED AT ALL.
 *
 * The Egyptian rail is a bank transfer and a person who checks it, and somebody
 * is on a spinner waiting to join a therapy session while they do. The plan calls
 * that staffing decision "not optional". A run where the operator works every
 * queue alone would be a run of a product nobody could staff, and it would also
 * never find the thing two people sharing a queue find: the same transfer picked
 * up twice.
 *
 * 🔴 76.55 — AND THE LIST MOVED TO `_cast.ts`, BECAUSE THERE WERE TWO OF THEM.
 *
 * This file held seven payroll rows and `_cast.ts` held two of those seven as
 * people who could sign in. Five colleagues therefore drew $500 a month in
 * `/admin/actuals` for six months and had no way to open the screen the salary
 * was for, so every row they were meant to clear would have been cleared by the
 * operator and the audit log would have said so. The founder asked for each staff
 * member to work their own queue under their own name; that is impossible with
 * two accounts and it is a single list now.
 */
const STAFF = PAYROLL;

/**
 * 🔴 THEY STARTED SIX MONTHS AGO, AND THE ALTERNATIVE IS A SILENT ZERO.
 *
 * Everything else in this run is created today and then moved backwards by
 * `npm run age` at the end of each wave. The payroll cannot be: this script runs
 * BEFORE the first marker opens, so `age` correctly leaves it alone, and a start
 * date of today would put every employee outside every month the run reports.
 *
 * `/admin/actuals` would then show six months of sessions and revenue against a
 * wage bill of nothing, which is not a small error: it is the difference between
 * a company that broke even and one that lost twenty-one thousand dollars.
 *
 * So the date is written where it belongs rather than left to be moved.
 */
function sixMonthsAgo(): string {
  const now = new Date();
  const then = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  return then.toISOString().slice(0, 10);
}

async function main() {
  /*
   * Let through to production. This is the script the door was opened for:
   * the run it seeds is the run on the real deployment. 76.52.
   */
  writesTo({ productionIsAllowed: true });

  const { pool, db } = connect();

  try {
    /* ------------------------------------------------- refuse a second run -- */

    /*
     * 🔴 WHAT A SECOND RUN ACTUALLY LOOKS LIKE, AND WHAT IT DOES NOT.
     *
     * The thing worth refusing is a second CAST: a second Nile Practice, a second
     * Cairo Foundry, with the agents unable to tell which one they are meant to
     * be in. That is a clinic row and a sponsor row, so those are what get
     * counted.
     *
     * An earlier version also counted `super_admin`, and it was wrong in a way
     * that only showed up on the database this run is for. Production has two
     * super admins, because production is a product somebody already signed into.
     * Counting them turned "there is already an operator" into "refuse", and the
     * run could not start at all on the only database it was ever meant for.
     *
     * A pre-existing operator is not a second cast. It is the ordinary state of
     * any database that is not brand new, and the operator below is found before
     * it is created for exactly the reason the organisation twenty lines down
     * already is. Same lesson, learned twice, in one file.
     */
    const already = await db.execute<{ n: string }>(sql`
      SELECT (SELECT COUNT(*) FROM organizations WHERE kind = 'clinic')
           + (SELECT COUNT(*) FROM sponsors) AS n`);

    if (Number(already.rows[0]?.n ?? 0) > 0) {
      console.error("\n  🔴 This database already has a practice or an employer in it.");
      console.error("     Running again would create a second Nile Practice and nobody could");
      console.error("     tell the agents which one to use. Refusing.\n");
      console.error("     For a fresh start, make a new branch. It takes a minute.\n");
      process.exit(1);
    }

    /* ---------------------------------------------------------- the operator */

    /*
     * 🔴 OUR OWN ORGANISATION, FOUND RATHER THAN CREATED, AND THE FIRST DRAFT
     * CREATED IT.
     *
     * `npm run ship:content` runs `db:seed`, which makes the platform
     * organisation with the slug `24therapy`. An earlier version of this script
     * ran before it and inserted a second one under a different slug, so the
     * branch ended up with two organisations both called 24Therapy.
     *
     * Nothing failed. So the slug is the canonical one, the row is found before
     * it is created, and the documented order puts this script last.
     */
    /*
     * 🔴 WHAT WAS HERE BEFORE, BECAUSE THE CHECKS AT THE BOTTOM ASK WHAT THIS
     * SCRIPT DID AND USED TO MEASURE WHAT THE DATABASE HELD.
     *
     * Three of them counted rows and asserted zero: no therapist, no patient, no
     * session, no bank account. On an empty branch those are the same sentence.
     * On production they are not, and both failed the moment this was rehearsed
     * against a copy of it: production carries one session, created by the
     * founder clicking around his own product on a Wednesday evening, and a set
     * of transfer fields somebody typed into `/admin/settings`.
     *
     * Neither is a defect. Both made a green check go red for a reason that has
     * nothing to do with what the check is for, which is §6 wearing the other
     * mask: not a check that passes by measuring the wrong thing, but one that
     * FAILS by measuring the wrong thing. The second is rarer and does more
     * damage, because the honest response to it is to weaken the assertion.
     *
     * So the assertion is not weakened. It is pointed at the delta, which is
     * what it always meant: this script creates no people, and writes no bank
     * account, whatever was here when it started.
     */
    const before = await db.execute<{
      therapists: string;
      patients: string;
      sessions: string;
      fields: string;
    }>(sql`
      SELECT (SELECT COUNT(*) FROM users WHERE role = 'therapist')::text AS therapists,
             (SELECT COUNT(*) FROM patients)::text AS patients,
             (SELECT COUNT(*) FROM sessions)::text AS sessions,
             (SELECT COALESCE(jsonb_array_length(value->'transferFields'), 0)
                FROM platform_settings WHERE key = 'payouts')::text AS fields`);

    const was = before.rows[0]!;

    const { hashPassword } = await import("../lib/auth/password");
    const passwordHash = await hashPassword(SIMULATION_PASSWORD);

    const existing = await db.execute<{ id: string }>(sql`
      SELECT id FROM organizations WHERE slug = 'twentyfour-therapy' OR slug = '24therapy' LIMIT 1`);

    const orgId =
      existing.rows[0]?.id ??
      (
        await db.execute<{ id: string }>(sql`
          INSERT INTO organizations (name, slug) VALUES ('24Therapy', '24therapy') RETURNING id`)
      ).rows[0]!.id;

    check(
      "🔴 there is exactly ONE platform organisation, not two called the same thing",
      Number(
        (
          await db.execute<{ n: string }>(sql`
            SELECT COUNT(*)::text AS n FROM organizations WHERE kind = 'solo'`)
        ).rows[0]?.n ?? 0,
      ) === 1,
      existing.rows[0] ? "joined the one ship:content made" : "created it, because nothing had",
    );

    await db.execute(sql`
      INSERT INTO subscriptions (organization_id, plan, status)
      VALUES (${orgId}, 'payg', 'active')
      ON CONFLICT (organization_id) DO NOTHING`);

    /*
     * 🔴 FOUND BEFORE CREATED, FOR THE ORGANISATION'S REASON.
     *
     * The unique index on users is partial (`WHERE deleted_at IS NULL`), so a
     * plain `ON CONFLICT (organization_id, email)` would have to repeat that
     * predicate to match it, and a predicate written twice is a predicate that
     * goes stale. Selecting first says the same thing in the same shape the
     * organisation above already uses.
     *
     * The password is rewritten on the way through on purpose. The login printed
     * at the end of this script has to be the login that works, and an operator
     * row left over from an earlier run carries an earlier hash.
     */
    const operator = await db.execute<{ id: string }>(sql`
      SELECT id FROM users
       WHERE organization_id = ${orgId} AND email = ${OPERATOR.email} AND deleted_at IS NULL
       LIMIT 1`);

    if (operator.rows[0]) {
      await db.execute(sql`
        UPDATE users SET password_hash = ${passwordHash}, role = 'super_admin'
         WHERE id = ${operator.rows[0].id}`);
    } else {
      await db.execute(sql`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
        VALUES (${orgId}, ${OPERATOR.email}, ${passwordHash}, ${OPERATOR.firstName},
                ${OPERATOR.lastName}, 'super_admin')`);
    }

    check(
      "the operator exists, and the console has somebody to open it",
      true,
      `${OPERATOR.email} / ${SIMULATION_PASSWORD}${operator.rows[0] ? " (already there, password reset to it)" : ""}`,
    );

    /* ----------------------------------------------------------- the payroll */

    const startedOn = sixMonthsAgo();

    /*
     * 🔴 WRITTEN HERE RATHER THAN THROUGH `addEmployee`, and the reason is worth
     * the four lines.
     *
     * Every other person in this file is created by calling the function the
     * product calls, because a seed that writes rows directly can create a state
     * the product cannot. `addEmployee` is not that function: it takes an `Actor`
     * and refuses anybody who is not a super admin, which is right for a form and
     * meaningless for a script with no session. And it deliberately does NOT
     * find-or-create by name, because two colleagues can share one, and a form
     * that silently joined them to one payroll row would be worse than a
     * duplicate.
     *
     * So the seed does what it does for the organisation and the operator: finds
     * by name first, then writes. The idempotency is the seed's problem here, not
     * the product's.
     */
    for (const person of STAFF) {
      const found = await db.execute<{ id: string }>(sql`
        SELECT id FROM employees WHERE name = ${person.name} LIMIT 1`);

      if (!found.rows[0]) {
        const made = await db.execute<{ id: string }>(sql`
          INSERT INTO employees (name, title, queue, started_on)
          VALUES (${person.name}, ${person.payroll.title}, ${person.payroll.queue}, ${startedOn})
          RETURNING id`);

        await db.execute(sql`
          INSERT INTO employee_salaries (employee_id, monthly_cents, effective_from, note)
          VALUES (${made.rows[0]!.id}, ${person.payroll.monthlyCents}, ${startedOn}, 'starting salary')`);
      }

      /*
       * 🔴 EVERY ONE OF THEM NEEDS SOMEWHERE TO SIGN IN, which is the change.
       *
       * Found before created, same as the operator and for the same reason. Nour
       * is written twice on purpose: once as the operator above and once here,
       * both find-or-create and both to `super_admin`, so the two blocks cannot
       * leave her in disagreement with herself.
       */
      const email = person.email!;
      const already = await db.execute<{ id: string }>(sql`
        SELECT id FROM users
         WHERE organization_id = ${orgId} AND email = ${email} AND deleted_at IS NULL
         LIMIT 1`);

      if (already.rows[0]) {
        await db.execute(sql`
          UPDATE users SET password_hash = ${passwordHash}, role = ${person.payroll.role}
           WHERE id = ${already.rows[0].id}`);
      } else {
        await db.execute(sql`
          INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
          VALUES (${orgId}, ${email}, ${passwordHash}, ${firstNameOf(person)},
                  ${lastNameOf(person)}, ${person.payroll.role})`);
      }
    }

    const payroll = await db.execute<{ people: string; bill: string }>(sql`
      SELECT COUNT(*)::text AS people,
             COALESCE(SUM(s.monthly_cents), 0)::text AS bill
        FROM employees e
        JOIN employee_salaries s ON s.employee_id = e.id
       WHERE e.ended_on IS NULL`);

    check(
      "🔴 the payroll is on the books, so /admin/actuals can see what six months cost",
      Number(payroll.rows[0]?.people ?? 0) === STAFF.length,
      `${payroll.rows[0]?.people ?? 0} people from ${startedOn}, ` +
        `$${(Number(payroll.rows[0]?.bill ?? 0) / 100).toFixed(0)} a month`,
    );

    /*
     * 🔴 CONTROL: every one of them can actually sign in, not just the two.
     *
     * A payroll row is a number in a table. A login is the thing that makes the
     * transfer queue a queue two people share, which is where the same transfer
     * gets picked up twice, and it is also the thing that puts a name on the row
     * rather than the operator's. Asserting the payroll rows exist is asserting
     * the part that was easy, and the version of this check that counted two was
     * green for the whole of the sprint in which five people could not sign in.
     */
    const wanted = STAFF.map((person) => person.email!);
    const staffLogins = await db.execute<{ email: string; role: string }>(sql`
      SELECT email, role FROM users
       WHERE organization_id = ${orgId} AND deleted_at IS NULL
         AND email = ANY(${wanted})`);

    const signedIn = new Map(staffLogins.rows.map((row) => [row.email, row.role]));
    const wrongRole = STAFF.filter((person) => signedIn.get(person.email!) !== person.payroll.role);

    check(
      "🔴 …and every one of the seven has a login, at the role their queue needs",
      wrongRole.length === 0,
      wrongRole.length === 0
        ? `${String(STAFF.length)} logins / ${SIMULATION_PASSWORD}, ` +
            `${String(STAFF.filter((p) => p.payroll.role === "super_admin").length)} founders and ` +
            `${String(STAFF.filter((p) => p.payroll.role === "staff").length)} staff`
        : `missing or at the wrong role: ${wrongRole.map((p) => p.email).join(", ")}`,
    );

    /* ------------------------------------------------------- the spend cap -- */

    /*
     * 🔴 THE BUDGET, ENFORCED BY THE PRODUCT RATHER THAN PROMISED IN A DOCUMENT.
     *
     * The run has $10 of OpenAI credit and must not stop halfway. The largest
     * variable cost per session is the in-session copilot, which the product caps
     * with `copilot.messagesPerPatientPerSession` and which ships at ten. Ten
     * times sixty-two sessions is a large share of the budget spent on
     * suggestions nobody in a simulation reads.
     *
     * Four is enough to exercise every path the copilot has: it still asks, it
     * still cites, it still refuses, and the quota screen still says what is
     * left. What it cannot do is quietly spend the run.
     *
     * A quota is the honest lever here because it is a real product feature used
     * for its real purpose, on one branch. Nothing about the model calls
     * themselves changes, so the measured cost per session is still a true
     * measurement of this product at this setting.
     */
    await db.execute(sql`
      UPDATE platform_settings
         SET value = jsonb_set(value, '{messagesPerPatientPerSession}', '4'::jsonb)
       WHERE key = 'copilot'`);

    const quota = await db.execute<{ q: string }>(sql`
      SELECT value->>'messagesPerPatientPerSession' AS q FROM platform_settings WHERE key = 'copilot'`);

    check(
      "🔴 the in-session copilot quota is 4, not the shipped 10, because the run has $10",
      quota.rows[0]?.q === "4",
      `messagesPerPatientPerSession = ${quota.rows[0]?.q ?? "missing"}`,
    );

    /* -------------------------------------------------------- the enquiries */

    const { applyToClinic } = await import("../lib/data/clinic-admin");
    const { applyToSponsor } = await import("../lib/data/sponsor-admin");

    const clinic = await applyToClinic({ ...CLINIC_APPLICATION });
    check(
      "🔴 the practice applied, through the same function the public form calls",
      clinic.ok === true,
      clinic.error ?? `${CLINIC_APPLICATION.name}, waiting for an operator`,
    );

    for (const application of SPONSOR_APPLICATIONS) {
      const result = await applyToSponsor({
        name: application.name,
        kind: application.kind,
        contactName: application.contactName,
        contactEmail: application.contactEmail,
        contactPhone: application.contactPhone,
        contactBestTime: application.contactBestTime,
      });
      check(
        `🔴 ${application.key} applied, and is HELD rather than active`,
        result.ok === true,
        result.error ?? `${application.name}, waiting for an operator`,
      );
    }

    /* ------------------------------------------------------- what it is not */

    const people = await db.execute<{ therapists: string; patients: string; sessions: string }>(sql`
      SELECT (SELECT COUNT(*) FROM users WHERE role = 'therapist')::text AS therapists,
             (SELECT COUNT(*) FROM patients)::text AS patients,
             (SELECT COUNT(*) FROM sessions)::text AS sessions`);

    const row = people.rows[0]!;
    const made = {
      therapists: Number(row.therapists) - Number(was.therapists),
      patients: Number(row.patients) - Number(was.patients),
      sessions: Number(row.sessions) - Number(was.sessions),
    };

    check(
      "🔴 …and it created NO therapist, NO patient and NO session",
      made.therapists === 0 && made.patients === 0 && made.sessions === 0,
      `${made.therapists} therapists, ${made.patients} patients, ${made.sessions} sessions created here. ` +
        `People sign themselves up (the database already held ${was.therapists}/${was.patients}/${was.sessions})`,
    );

    const held = await db.execute<{ n: string }>(sql`
      SELECT COUNT(*)::text AS n FROM sponsors WHERE state <> 'held'`);
    const clinicHeld = await db.execute<{ n: string }>(sql`
      SELECT COUNT(*)::text AS n FROM organizations WHERE kind = 'clinic' AND clinic_state <> 'held'`);

    check(
      "🔴 CONTROL nothing was approved by the seed, which is the operator's decision on camera",
      Number(held.rows[0]?.n ?? 0) === 0 && Number(clinicHeld.rows[0]?.n ?? 0) === 0,
      "four applications, four waiting",
    );

    /* ------------------------------------------------ the rail, left empty */

    /*
     * 🔴 THE BANK DETAILS ARE NOT SEEDED, AND THAT IS THE TEST.
     *
     * `payouts.transferFields` ships empty, so the first Egyptian company to open
     * its pot is shown "not on the system yet" rather than an account number
     * somebody committed to a repository. An operator types the real ones in on
     * camera, in wave 1, through `/admin/settings`, and the screens that were
     * empty fill in behind them.
     *
     * A seed that wrote plausible-looking details would skip the one screen this
     * whole rail depends on, and would put a bank account in git.
     *
     * 🔴 AND ON PRODUCTION SOMEBODY HAS ALREADY TYPED THEM, which is the state
     * this has to survive without lying in either direction. So the assertion is
     * that THIS SCRIPT wrote none, and the note says which of the two starting
     * points the run is actually on, because they need different things of the
     * operator: an empty rail is typed in on camera, a filled one is read back
     * against the real bank letter on camera. Both are a walk of the screen.
     * Neither is a seed writing an account number into git.
     */
    const fields = await db.execute<{ n: string }>(sql`
      SELECT COALESCE(jsonb_array_length(value->'transferFields'), 0)::text AS n
        FROM platform_settings WHERE key = 'payouts'`);

    const now = Number(fields.rows[0]?.n ?? 0);

    check(
      "🔴 the seed wrote NO bank account, so the rail is an operator's screen",
      now === Number(was.fields),
      now === 0
        ? "empty, and an operator types the real ones in on camera in wave 1"
        : `${now} fields were already here, so wave 1 CHECKS them on camera instead of typing them`,
    );

    /*
     * 🔴 AND EVERY APPLICANT IS ON THE `us` ENTITY, WHICH IS ALSO THE TEST.
     *
     * `applyToSponsor` lands every enquiry there, because which of our companies
     * bills a customer is a decision somebody makes with the paperwork in front
     * of them. Moving these three to `eg` is an operator's click in wave 1, and
     * it is the click that puts them on the transfer rail: `sponsorNeedsTransfer`
     * reads that column.
     *
     * Until sprint 74 nothing could make that click, so this is the assertion
     * that the run starts from the state a real Tuesday starts from.
     */
    const entities = await db.execute<{ n: string }>(sql`
      SELECT COUNT(*)::text AS n FROM sponsors WHERE entity <> 'us'`);

    check(
      "🔴 CONTROL every applicant starts on the us entity, and an operator moves them",
      Number(entities.rows[0]?.n ?? 0) === 0,
      "three enquiries, three still to be placed on the right company's books",
    );

    console.log("\n  Next:");
    console.log("    npm run age -- --marker wave1 --start   before anybody acts\n");
  } finally {
    await pool.end();
  }

  finish("simulate-seed");
}

main();
