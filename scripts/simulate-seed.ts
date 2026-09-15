/**
 * What a person could not create for themselves, and nothing else.
 *
 *   DATABASE_URL='<the simulation branch>' npm run settings:seed
 *   DATABASE_URL='<the simulation branch>' npm run ship:content -- 28 24
 *   DATABASE_URL='<the simulation branch>' npm run simulate:seed
 *
 * 🔴 THAT ORDER, AND NOT ANOTHER. `ship:content` lays down the platform
 * organisation; this script puts the operator in it. Run the other way round
 * and the branch gets two organisations called 24Therapy, the operator signs
 * into one, and every other tool looks at the other.
 *
 * Specified by `docs/simulation/01-SEED.md`, which says exactly three things
 * belong here:
 *
 *   1. The platform operator.
 *   2. Settings, countries, taxonomy and published content.
 *   3. The employer and clinic **applications**, in a pre-approval state.
 *
 * **It creates no therapist, no patient and no session.** Those are people, and
 * people sign themselves up. A cast seeded into existence never walks the
 * sign-up flow, and sign-up is where two of the last three walkthroughs found
 * their worst defects.
 *
 * ## 🔴 Why the applications are seeded and the approvals are not
 *
 * An application is a form a person fills in before they have any account, so
 * there is nobody to be at the keyboard. An approval is an operator's decision,
 * and the operator agent makes it on camera in wave two: that click, and the
 * screen it happens on, is a thing the simulation exists to photograph.
 *
 * They are created by calling `applyToClinic` and `applyToSponsor` rather than
 * by INSERT, so the seed goes through the same validation, the same slug rule
 * and the same "held" default the public form does. A seed that writes rows
 * directly is a seed that can create a state the product cannot.
 *
 * ## It refuses production, and it refuses to run twice
 *
 * `writesTo()` refuses the production endpoint by name. And it counts what it
 * is about to create first: a second run would produce two Nile Practices and
 * an operator who cannot tell which one the agents are using.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

/** One password for every account in the run. Never used outside a branch. */
export const SIMULATION_PASSWORD = "Simulation2026!";

/**
 * The operator. The only person in this file, because the console has to work
 * before there is anything in it and somebody has to approve the first clinic.
 */
export const OPERATOR = {
  email: "nour.example@example.com",
  firstName: "Nour",
  lastName: "Example",
} as const;

/**
 * The applications waiting in the operator's queue when the run begins.
 *
 * 🔴 Three employers and one practice, matching `01-SEED.md` exactly. `E3` is
 * here from the start even though it does nothing until wave three: Delta
 * Logistics hires `P5` away from Thames, and an employer that materialises on
 * the day it poaches somebody is a story the data cannot tell.
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
 * The earlier cast had a London company in it, which made the go-to-market look
 * like two markets and gave the money half of the simulation a card rail to fall
 * back on. There is no card rail in Egypt: `topUpPot` refuses `entity = 'eg'`,
 * and the bank transfer queue is the whole of how money reaches us.
 *
 * A run with one non-Egyptian customer would have proved the easy path works.
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

async function main() {
  writesTo();

  const { pool, db } = connect();

  try {
    /* ------------------------------------------------- refuse a second run -- */

    const already = await db.execute<{ n: string }>(sql`
      SELECT (SELECT COUNT(*) FROM organizations WHERE kind = 'clinic')
           + (SELECT COUNT(*) FROM sponsors)
           + (SELECT COUNT(*) FROM users WHERE role = 'super_admin') AS n`);

    if (Number(already.rows[0]?.n ?? 0) > 0) {
      console.error("\n  🔴 This database already has an operator, a practice or an employer.");
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
     * organisation with the slug `24therapy`. This script ran before it and
     * inserted a second one under a different slug, so the branch ended up with
     * two organisations both called 24Therapy: the operator signed into one and
     * every other tool in the repository looked at the other.
     *
     * Nothing failed. That is the whole problem with it. So the slug is the
     * canonical one, the row is found before it is created, and the documented
     * order puts this script LAST, after the two that lay the platform down.
     */
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

    await db.execute(sql`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
      VALUES (${orgId}, ${OPERATOR.email}, ${passwordHash}, ${OPERATOR.firstName},
              ${OPERATOR.lastName}, 'super_admin')`);

    check(
      "the operator exists, and the console has somebody to open it",
      true,
      `${OPERATOR.email} / ${SIMULATION_PASSWORD}`,
    );

    /* ------------------------------------------------------- the spend cap -- */

    /*
     * 🔴 THE BUDGET, ENFORCED BY THE PRODUCT RATHER THAN PROMISED IN A DOCUMENT.
     *
     * The run has $10 of OpenAI credit and must not stop halfway. The largest
     * variable cost per session is the in-session copilot, which the product
     * caps with `copilot.messagesPerPatientPerSession` and which ships at ten.
     * Ten times twenty-five sessions is a quarter of the budget spent on
     * suggestions nobody in a simulation reads.
     *
     * Four is enough to exercise every path the copilot has: it still asks, it
     * still cites, it still refuses, and the quota screen still says what is
     * left. What it cannot do is quietly spend the run.
     *
     * A quota is the honest lever here because it is a real product feature
     * used for its real purpose, on one branch. Nothing about the model calls
     * themselves is changed, so the measured cost per session is still a true
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
    check(
      "🔴 …and it created NO therapist, NO patient and NO session",
      Number(row.therapists) === 0 && Number(row.patients) === 0 && Number(row.sessions) === 0,
      `${row.therapists} therapists, ${row.patients} patients, ${row.sessions} sessions. People sign themselves up`,
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
     * `payouts.transferFields` ships empty, so the first Egyptian company to
     * open its pot is shown "not on the system yet" rather than an account
     * number somebody committed to a repository. An operator types the real ones
     * in on camera, in wave one, through `/admin/settings`, and the screens that
     * were empty fill in.
     *
     * A seed that wrote plausible-looking details would skip the one screen this
     * whole rail depends on, and would put a bank account in git.
     */
    const fields = await db.execute<{ n: string }>(sql`
      SELECT COALESCE(jsonb_array_length(value->'transferFields'), 0)::text AS n
        FROM platform_settings WHERE key = 'payouts'`);

    check(
      "🔴 the transfer details are EMPTY, so an operator types them in on camera",
      Number(fields.rows[0]?.n ?? 0) === 0,
      "a seeded bank account is a bank account in git, and a screen nobody walks",
    );

    /*
     * 🔴 AND EVERY APPLICANT IS ON THE `us` ENTITY, WHICH IS ALSO THE TEST.
     *
     * `applyToSponsor` lands every enquiry there, because which company bills a
     * customer is a decision somebody makes with the paperwork in front of them.
     * Moving these three to `eg` is an operator's click in wave one, and it is
     * the click that puts them on the transfer rail: `sponsorNeedsTransfer`
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
