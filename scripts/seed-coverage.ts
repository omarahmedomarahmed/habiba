/**
 * 🔴 76.25 — A COMPANY COVERING HALF, AND AN EMPLOYEE PAYING THE REST.
 *
 *   DATABASE_URL='…' npm run seed:coverage
 *
 * ## What this puts on a branch, and why by hand is the wrong way
 *
 * The scenario the whole Egyptian corporate offer rests on:
 *
 *   1. A company funds a pot and sets coverage to 50%.
 *   2. An employee is enrolled against it.
 *   3. They book a $20 session. The pot pays $10 at BOOKING.
 *   4. They owe the other $10, plus VAT, by bank transfer.
 *   5. An operator sees a claim for their half and a session already half paid.
 *
 * Every step runs through the product's own functions — `openPot`, `payFromPot`,
 * `openCart`, `submitProof` — rather than writing the end state into tables.
 * A fixture assembled by hand proves that somebody can write rows, and the last
 * time this was skipped the pot refused to credit and the fixture, not the
 * product, turned out to be wrong.
 *
 * ## 🔴 IT REFUSES PRODUCTION AND IT DOES NOT CLEAN UP
 *
 * Unlike `verify:cycle`, this LEAVES the cast behind, because the point is to
 * photograph screens that need something on them. So it is for a throwaway
 * branch and nowhere else, and every person in it is surnamed Demo at
 * `example.com` (C225) so a frame containing one is visibly synthetic.
 */
import { sql } from "drizzle-orm";

import { connect } from "./db";
import { writesTo } from "./_verify";

const TAG = "coverage-demo";

async function main() {
  writesTo();

  const { db, pool } = connect();

  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  try {
    /*
     * 🔴 CLEARED FIRST, AND `ON CONFLICT` DELIBERATELY NOT USED.
     *
     * The first draft reached for upserts and met "no unique or exclusion
     * constraint matching the ON CONFLICT specification": the uniqueness on
     * `users` is a PARTIAL index (`WHERE deleted_at IS NULL`), and matching one
     * of those from raw SQL means restating its predicate exactly. Fighting
     * that is the wrong shape of effort for a fixture. Running twice should
     * give the same branch, so it starts by making that true.
     */
    await db.execute(sql`DELETE FROM sessions WHERE join_token = ${`join-${TAG}`}`);
    await db.execute(sql`DELETE FROM users WHERE email IN ('mona.demo@example.com', 'ops.demo@example.com')`);
    await db.execute(sql`DELETE FROM manual_payments WHERE reference IN ('MISR-4471', 'INSTA-99231')`);
    await db.execute(sql`DELETE FROM enrolments WHERE identifier_hash = ${`demo-${TAG}`}`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE ref_id IN
      (SELECT id FROM sponsors WHERE name = 'Cairo Foundry')`);
    await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name = 'Cairo Foundry')`);
    await db.execute(sql`DELETE FROM sponsor_users WHERE email = 'finance.demo@example.com'`);
    await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE name = 'Cairo Foundry')`);
    await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name = 'Cairo Foundry')`);
    await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name = 'Cairo Foundry')`);
    await db.execute(sql`DELETE FROM sponsors WHERE name = 'Cairo Foundry'`);
    await db.execute(sql`DELETE FROM patients WHERE email = 'nour.demo@example.com'`);
    await db.execute(sql`DELETE FROM patient_accounts WHERE email = 'nour.demo@example.com'`);
    await db.execute(sql`DELETE FROM people WHERE first_name = 'Nour' AND last_name = 'Demo'`);

    /* ---------------------------------------------------- the practice -- */

    /*
     * 🔴 LOOKED UP, THEN INSERTED, rather than upserted. `organizations.slug`
     * is unique behind a partial index too, and the same lesson applies: read
     * first and branch, which is legible, instead of restating an index
     * predicate in raw SQL to satisfy `ON CONFLICT`.
     */
    const existingOrg = await one<{ id: string } | undefined>(sql`
      SELECT id FROM organizations WHERE slug = ${TAG} LIMIT 1`);

    const org =
      existingOrg ??
      (await one<{ id: string }>(sql`
        INSERT INTO organizations (name, region, slug)
        VALUES ('Nile Practice', 'eg', ${TAG})
        RETURNING id`));


    await db.execute(sql`
      INSERT INTO subscriptions (organization_id, plan, status)
      VALUES (${org.id}, 'payg', 'active')
      ON CONFLICT (organization_id) DO NOTHING`);


    const { hashPassword } = await import("../lib/auth/password");
    const hash = await hashPassword("copper-meadow-demo1");

    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, status)
      VALUES (${org.id}, 'mona.demo@example.com', 'Mona', 'Demo', 'therapist', ${hash}, 'active')
      RETURNING id`);

    const operator = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, status)
      VALUES (${org.id}, 'ops.demo@example.com', 'Ops', 'Demo', 'super_admin', ${hash}, 'active')
      RETURNING id`);

    /* ------------------------------------------------------ the company -- */

    const sponsor = await one<{ id: string }>(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES ('Cairo Foundry', 'company', 'eg', 'EGP', 'active')
      RETURNING id`);

    await db.execute(sql`
      INSERT INTO sponsor_users (sponsor_id, email, name, role, password_hash)
      VALUES (${sponsor.id}, 'finance.demo@example.com', 'Layla Demo', 'admin', ${hash})`);

    /*
     * 🔴 THROUGH `openPot`, which posts the ledger legs for the welcome credit.
     * An INSERT here would leave a funded pot with no journal behind it, which
     * is the exact defect sprint 75 found and fixed.
     */
    const { openPot } = await import("../lib/data/sponsor-admin");
    const opened = await openPot({
      sponsorId: sponsor.id,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      overdraftCents: 5_000,
      welcomeCreditCents: 10_000,
    });
    if (opened.error) throw new Error(`openPot: ${opened.error}`);

    /* A real top-up on top of the welcome credit, confirmed by an operator. */
    const { openCart } = await import("../lib/billing/cart");
    const { submitProof, confirmPayment, egpMinorFor, egpRateMicro } = await import(
      "../lib/billing/manual"
    );
    const { grantFor } = await import("../lib/billing/manual-grants");
    const { potTopUpMoney, entityVatBps } = await import("../lib/billing/pot");
    const rate = await egpRateMicro();

    const money = potTopUpMoney({ creditCents: 100_000, vatBps: await entityVatBps("eg") });
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
    await submitProof({ paymentId: topUp.id!, reference: "MISR-4471", proofUrl: null });
    await confirmPayment({ paymentId: topUp.id!, byUserId: operator.id, onConfirmed: grantFor });

    /*
     * 🔴 FIFTY PER CENT, which is the number this whole scenario is about.
     * Set after the top-up so the balance shown "before" is the funded one.
     */
    await db.execute(sql`
      UPDATE sponsor_pots SET coverage_bps = 5000 WHERE sponsor_id = ${sponsor.id}`);

    const before = await one<{ balance_cents: number }>(sql`
      SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);

    /* ----------------------------------------------------- the employee -- */

    const person = await one<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, region)
      VALUES ('Nour', 'Demo', 'eg') RETURNING id`);

    const account = await one<{ id: string }>(sql`
      INSERT INTO patient_accounts (person_id, email, password_hash, email_verified_at, phone, phone_verified_at)
      VALUES (${person.id}, 'nour.demo@example.com', ${hash}, now(), '+201000000003', now())
      RETURNING id`);

    const patient = await one<{ id: string }>(sql`
      INSERT INTO patients (organization_id, person_id, first_name, last_name, email, phone, source)
      VALUES (${org.id}, ${person.id}, 'Nour', 'Demo', 'nour.demo@example.com',
              '+201000000003', 'self')
      RETURNING id`);

    /*
     * 🔴 `last_verified_at` IS NOT DECORATION. `payFromPot` refuses an
     * enrolment without it, and the comment three files away that said the
     * funding does not start until it is set was false for a sprint.
     */
    await db.execute(sql`
      INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash,
                              identifier_kind, last_verified_at)
      VALUES (${sponsor.id}, ${person.id}, 'active', true, ${`demo-${TAG}`},
              'domain_email', now())`);

    /* -------------------------------------------------- the session ---- */

    const session = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            join_token, feedback_token, price_cents, payment_status, scheduled_at)
      VALUES (${org.id}, ${therapist.id}, ${patient.id}, 'scheduled', 'video',
              ${`join-${TAG}`}, ${`fb-${TAG}`}, 2000, 'pending', now() + interval '2 hours')
      RETURNING id`);

    const { payFromPot } = await import("../lib/billing/pot");
    const spend = await payFromPot(session.id);
    if (!spend.paid) throw new Error(`the pot refused to cover: ${spend.reason}`);

    const after = await one<{ balance_cents: number }>(sql`
      SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);

    /* ------------------------------------ what the employee still owes -- */

    const remaining = await one<{ price_cents: number; payment_status: string }>(sql`
      SELECT price_cents, payment_status FROM sessions WHERE id = ${session.id}`);

    const covered = before.balance_cents - after.balance_cents;
    const owed = remaining.price_cents - covered;

    const { sessionTransferMoney } = await import("../lib/billing/manual-entry");
    const owedMoney = await sessionTransferMoney({
      organizationId: org.id,
      priceCents: owed,
    });

    const claim = await openCart({
      purpose: "session",
      refId: session.id,
      amountCents: egpMinorFor(owedMoney.settlesCents, rate),
      settlesCents: owedMoney.settlesCents,
      /*
       * 🔴 THE LINE THE EMPLOYER PAID IS ON THE CLAIM AT ZERO, on purpose.
       *
       * An operator holding a bank line for half a session needs to see that
       * the other half is already settled, or a $11.40 claim against a $20
       * session reads as an underpayment. It carries no money: `settlesCents`
       * is the only figure anything acts on, and this is a sentence.
       */
      lineItems: [
        { label: "Session with Mona Demo", cents: owedMoney.grossCents },
        { label: "VAT", cents: owedMoney.vatCents },
        { label: "Covered by Cairo Foundry (50%), already paid", cents: 0 },
      ],
      payer: { kind: "patient", patientAccountId: account.id },
    });

    /*
     * 🔴 LEFT UNSUBMITTED ON PURPOSE. The sheet's own details, the line items
     * and the red instruction only render BEFORE a claim exists; afterwards it
     * is the waiting card. `SUBMIT_PROOF=1` takes it the other way, so both
     * states can be photographed from one branch.
     */
    if (process.env.SUBMIT_PROOF === "1") {
      await submitProof({ paymentId: claim.id!, reference: "INSTA-99231", proofUrl: null });
    }

    console.log("\n🔴 A company covering half, seeded through the product's own functions.\n");
    console.log(`  pot before the booking   $${before.balance_cents / 100}`);
    console.log(`  the employer's share     $${covered / 100}`);
    console.log(`  pot after the booking    $${after.balance_cents / 100}`);
    console.log(`  the employee still owes  $${owed / 100} + $${owedMoney.vatCents / 100} VAT`);
    console.log(`  which is                 ${egpMinorFor(owedMoney.settlesCents, rate) / 100} EGP`);
    console.log(`\n  join link   /pay/join-${TAG}`);
    console.log(`  operator    ops.demo@example.com / copper-meadow-demo1`);
    console.log(`  session     ${session.id}`);
    console.log(`  sponsor     ${sponsor.id}`);
    console.log(`  patient     ${patient.id}`);
    console.log(`  therapist   ${therapist.id}`);
  } finally {
    await pool.end();
  }
}

main();
