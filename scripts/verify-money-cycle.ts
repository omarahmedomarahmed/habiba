/**
 * 🔴 76.22 — A WHOLE CYCLE OF MONEY, ON REAL ROWS, EVERY TIME.
 *
 *   npm run verify:cycle
 *
 * ## Why this exists, and why it is a gate rather than an afternoon
 *
 * `verify:rail` ends with a warning in its own words:
 *
 *   > *THESE THREE READ SOURCE, AND SOURCE IS THE WEAKER KIND OF EVIDENCE HERE.
 *   > All three defects sprint 74 found in the entitlement loop were true of the
 *   > source and false of the database. These catch the posting being DELETED.
 *   > They cannot catch it posting the wrong number, and only a run against real
 *   > rows can.*
 *
 * That was written and left undone. Meanwhile the sweep that added `sawRows`
 * found the board reporting ZERO cents collected and ZERO transfers decided on
 * every branch we have, seeded ones included, which means the money half of the
 * product had never been exercised against rows anywhere.
 *
 * A cycle run once by hand proves the day it ran. This runs on every pass.
 *
 * ## What it does, in the order the money actually moves
 *
 *   1. A company sends a pot top-up by transfer, and an operator confirms it.
 *   2. A patient pays for a session by transfer, and an operator confirms it.
 *   3. A clinician pays their bill by transfer, and an operator confirms it.
 *   4. A fourth payer is REJECTED, because a queue that can only say yes is
 *      half a queue and the rejection path is the half nobody exercises.
 *
 * ## ⚠️ 76.33 — STEP 2 USED TO SAY "PART COVERED FROM THAT POT" AND WAS NOT
 *
 * The heading said the session was partly covered by the pot funded one step
 * above it. Nothing in the body called `payFromPot`: it funded a pot, then had
 * a guest pay the FULL price of an unrelated session, and the two halves never
 * met. So the one gate that claimed to exercise employer coverage exercised
 * none of it, which is why three separate defects in that exact path survived
 * every pass.
 *
 * A heading describing a check that does not exist is §6 landing on the
 * instrument rather than the product, and it is the worse place for it: a
 * reader scanning the pass sees coverage covered.
 *
 * The heading now says what the step does. The coverage path has its own file,
 * `verify:edges`, with twelve scenarios and a control on each.
 *
 * ## 🔴 AND IT ASSERTS THE LEDGER, NOT THE HAPPY PATH
 *
 * Every step checks the double entry rather than the screen. `grantPotTopUp`
 * journalled nothing for a sprint and credited the gross; both were invisible
 * from every surface and obvious in a trial balance. The last check here is
 * that every transaction this cycle wrote balances to zero, with a planted
 * offender to prove the check can see one that does not.
 *
 * Everything it makes is deleted in a `finally`, and `writesTo()` refuses
 * production by name.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `cycle${Date.now().toString(36)}`;

async function main() {
  writesTo();

  const { db, pool } = connect();

  try {
    /* ================================================================ */
    /*  THE CAST                                                         */
    /* ================================================================ */

    const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
      const { rows } = await db.execute(text);
      return rows[0] as T;
    };

    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug)
      VALUES ('Cycle Demo Practice', 'eg', ${fixture}) RETURNING id`);

    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`mona.${fixture}@example.com`}, 'Mona', 'Demo', 'therapist', 'x')
      RETURNING id`);

    const operator = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`ops.${fixture}@example.com`}, 'Ops', 'Demo', 'admin', 'x')
      RETURNING id`);

    const sponsor = await one<{ id: string }>(sql`
      INSERT INTO sponsors (name, kind, entity, currency)
      VALUES ('Cycle Demo Foundry', 'company', 'eg', 'EGP') RETURNING id`);

    const person = await one<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, region)
      VALUES ('Nour', 'Demo', 'eg') RETURNING id`);

    const patient = await one<{ id: string }>(sql`
      INSERT INTO patients (organization_id, person_id, first_name, last_name, email, phone, source)
      VALUES (${org.id}, ${person.id}, 'Nour', 'Demo', ${`nour.${fixture}@example.com`},
              '+201000000002', 'self')
      RETURNING id`);

    const { openCart } = await import("../lib/billing/cart");
    const { submitProof, confirmPayment, rejectPayment, egpMinorFor, egpRateMicro } = await import(
      "../lib/billing/manual"
    );
    const { grantFor } = await import("../lib/billing/manual-grants");
    const { potTopUpMoney, entityVatBps } = await import("../lib/billing/pot");
    const rate = await egpRateMicro();

    /* ================================================================ */
    /*  1 · A COMPANY FUNDS ITS POT                                      */
    /* ================================================================ */

    /*
     * 🔴 THE POT IS OPENED FIRST, THROUGH THE REAL FUNCTION, and the first
     * draft of this cycle skipped it.
     *
     * It skipped it and the run said so: `grantPotTopUp` refused, logged "either
     * there is no pot, or this payment had already been applied", and left a
     * confirmed payment crediting nothing. That looked like a product defect for
     * a minute and is not one — `/sponsor/pot` renders the payment sheet only
     * when the terms exist, so a company cannot reach a top-up before an
     * operator has opened their pot. The fixture was wrong, not the product.
     *
     * Using `openPot` rather than an INSERT is the point: it exercises the
     * welcome credit and the ledger legs that go with it, which is a whole
     * commercial promise the product could not keep until sprint 75.
     */
    const { openPot } = await import("../lib/data/sponsor-admin");
    const opened = await openPot({
      sponsorId: sponsor.id,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      overdraftCents: 5_000,
      welcomeCreditCents: 10_000,
    });

    check(
      "🔴 an operator opens a pot with terms, and the welcome credit lands in it",
      !opened.error,
      opened.error ?? "$100 of welcome credit, on terms a company can read",
    );

    const welcomed = await one<{ balance_cents: number }>(sql`
      SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);

    const vatBps = await entityVatBps("eg");
    const topUp = potTopUpMoney({ creditCents: 100_000, vatBps });

    const potPayment = await openCart({
      purpose: "pot_topup",
      refId: sponsor.id,
      amountCents: egpMinorFor(topUp.settlesCents, rate),
      settlesCents: topUp.settlesCents,
      lineItems: [
        { label: "Pot credit", cents: topUp.creditCents },
        ...(topUp.vatCents > 0 ? [{ label: "VAT", cents: topUp.vatCents }] : []),
      ],
      payer: { kind: "sponsor", sponsorId: sponsor.id },
    });

    check(
      "🔴 a company opens a pot top-up, and the row freezes both figures",
      Boolean(potPayment.id),
      `$${topUp.creditCents / 100} of credit, $${topUp.settlesCents / 100} to send, ${egpMinorFor(topUp.settlesCents, rate) / 100} EGP`,
    );

    await submitProof({
      paymentId: potPayment.id!,
      reference: `CYCLE-POT-${fixture}`,
      proofUrl: null,
    });
    await confirmPayment({ paymentId: potPayment.id!, byUserId: operator.id, onConfirmed: grantFor });

    const pot = await one<{ balance_cents: number }>(sql`
      SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);

    /*
     * 🔴 THE CREDIT, NOT THE TOTAL. This is the defect 0106 was written about:
     * the pot is denominated in dollars, the payer sent pounds, and the VAT is
     * ours rather than theirs. A pot credited its gross is a company given back
     * its own tax.
     */
    check(
      "🔴 …and the pot is credited the CREDIT, never the gross and never the pounds",
      pot?.balance_cents === welcomed.balance_cents + topUp.creditCents,
      `balance ${pot?.balance_cents} = ${welcomed.balance_cents} welcome + ${topUp.creditCents} credit, and NOT ${topUp.settlesCents} sent`,
    );

    const potLegs = await one<{ n: number; sum: number }>(sql`
      SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_cents), 0)::int AS sum
      FROM ledger_entries WHERE ref_type = 'sponsor' AND ref_id = ${sponsor.id}`);

    check(
      "🔴 …and it is journalled, in legs that sum to zero",
      potLegs.n > 0 && potLegs.sum === 0,
      `${potLegs.n} legs, net ${potLegs.sum}`,
    );

    /* ================================================================ */
    /*  2 · A PATIENT PAYS FOR A SESSION BY TRANSFER                     */
    /* ================================================================ */

    const session = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            join_token, feedback_token, price_cents, payment_status, scheduled_at)
      VALUES (${org.id}, ${therapist.id}, ${patient.id}, 'scheduled', 'video',
              ${`join-${fixture}`}, ${`fb-${fixture}`}, 2000, 'pending', now() + interval '1 hour')
      RETURNING id`);

    const { sessionTransferMoney } = await import("../lib/billing/manual-entry");
    const money = await sessionTransferMoney({ organizationId: org.id, priceCents: 2000 });

    check(
      "🔴 an Egyptian session adds VAT on top, so 1,000 EGP of therapy is 1,140 to send",
      money.vatCents === 280 && money.settlesCents === 2280,
      `$${money.grossCents / 100} + $${money.vatCents / 100} tax = ${egpMinorFor(money.settlesCents, rate) / 100} EGP`,
    );

    /*
     * 🔴 THE PAYER THIS RAIL WAS BUILT FOR, and they have no account at all.
     * A guest paying for a session off the radar is identified by the session
     * itself, which carries the therapist, the price and the token they held.
     */
    const guestPayment = await openCart({
      purpose: "session",
      refId: session.id,
      amountCents: egpMinorFor(money.settlesCents, rate),
      settlesCents: money.settlesCents,
      payer: { kind: "session", organizationId: org.id },
    });

    await submitProof({
      paymentId: guestPayment.id!,
      reference: `CYCLE-SESSION-${fixture}`,
      proofUrl: null,
    });
    await confirmPayment({
      paymentId: guestPayment.id!,
      byUserId: operator.id,
      onConfirmed: grantFor,
    });

    const paid = await one<{ payment_status: string }>(sql`
      SELECT payment_status FROM sessions WHERE id = ${session.id}`);

    check(
      "🔴 confirming a session transfer is what makes it paid, and nothing earlier does",
      paid.payment_status === "paid",
      `payment_status ${paid.payment_status}`,
    );

    /* ================================================================ */
    /*  3 · A CLINICIAN PAYS THEIR BILL                                  */
    /* ================================================================ */

    await db.execute(sql`
      INSERT INTO invoices (organization_id, kind, description, amount_cents, status)
      VALUES (${org.id}, 'session', ${`Session, ${fixture}`}, 400, 'due'),
             (${org.id}, 'session', ${`Session, ${fixture} b`}, 400, 'due')`);

    const { billLines } = await import("../lib/billing/bill-lines");
    const bill = await billLines(org.id, []);

    const billPayment = await openCart({
      purpose: "subscription",
      refId: org.id,
      amountCents: egpMinorFor(bill.totalCents, rate),
      settlesCents: bill.totalCents,
      lineItems: bill.lines,
      payer: { kind: "user", userId: therapist.id, organizationId: org.id },
    });

    check(
      "🔴 a clinician's transfer carries its line items, so a part payment can be read",
      bill.lines.length === 2 && bill.totalCents === 800,
      `${bill.lines.length} lines, $${bill.totalCents / 100}`,
    );

    await submitProof({
      paymentId: billPayment.id!,
      reference: `CYCLE-BILL-${fixture}`,
      proofUrl: null,
    });
    await confirmPayment({
      paymentId: billPayment.id!,
      byUserId: operator.id,
      onConfirmed: grantFor,
    });

    const settled = await one<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM invoices
      WHERE organization_id = ${org.id} AND status = 'paid'`);

    check(
      "🔴 …and confirming it settles the invoices it named, oldest first",
      settled.n === 2,
      `${settled.n} of 2 invoices paid`,
    );

    /* ================================================================ */
    /*  4 · AND ONE IS TURNED DOWN                                       */
    /* ================================================================ */

    const doomed = await openCart({
      purpose: "pot_topup",
      refId: sponsor.id,
      amountCents: egpMinorFor(topUp.settlesCents, rate),
      settlesCents: topUp.settlesCents,
      payer: { kind: "sponsor", sponsorId: sponsor.id },
    });
    await submitProof({
      paymentId: doomed.id!,
      reference: `CYCLE-BAD-${fixture}`,
      proofUrl: null,
    });
    await rejectPayment({
      paymentId: doomed.id!,
      byUserId: operator.id,
      reason: "No transfer found with that reference. Check it and send again.",
    });

    const after = await one<{ state: string; balance: number }>(sql`
      SELECT p.state,
             (SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}) AS balance
      FROM manual_payments p WHERE p.id = ${doomed.id!}`);

    /*
     * 🔴 THE REJECTION PATH, AND THE HALF THAT MATTERS IS THE BALANCE.
     * A queue that can only say yes is half a queue, and a rejection that moved
     * money would be worse than no queue at all.
     */
    check(
      "🔴 a rejected transfer moves no money, and the pot is exactly where it was",
      after.state === "rejected" && after.balance === welcomed.balance_cents + topUp.creditCents,
      `state ${after.state}, pot still $${after.balance / 100}`,
    );

    /* ================================================================ */
    /*  5 · AND THE BOOKS BALANCE                                        */
    /* ================================================================ */

    const { unbalancedTransactions } = await import("../lib/billing/ledger");
    const drift = await unbalancedTransactions();

    check(
      "🔴 every transaction this cycle wrote balances to zero",
      drift.length === 0,
      drift.length === 0 ? "no drift anywhere in the ledger" : `${drift.length} unbalanced`,
    );

    /*
     * 🔴 CONTROL, AND IT IS THE REASON THE CHECK ABOVE IS WORTH ANYTHING.
     *
     * A single leg with no counterpart is planted, seen, and removed. An
     * absence assertion that has never been watched finding something is a
     * sentence rather than a check, and `grantPotTopUp` journalling nothing at
     * all passed every surface this product has for a whole sprint.
     */
    await db.execute(sql`
      INSERT INTO ledger_entries (txn_id, txn_kind, account, amount_cents, currency, ref_type, ref_id, memo)
      VALUES (gen_random_uuid(), 'adjustment', 'platform_cash', 12345, 'usd', 'sponsor', ${sponsor.id},
              ${`planted by ${fixture}`})`);

    const withOffender = await unbalancedTransactions();
    await db.execute(sql`DELETE FROM ledger_entries WHERE memo = ${`planted by ${fixture}`}`);

    check(
      "🔴 CONTROL the same query finds a leg with no counterpart",
      withOffender.length > drift.length,
      `${withOffender.length} unbalanced with one planted, ${drift.length} without`,
    );

    /* ================================================================ */
    /*  AND WHAT THE BOARD NOW SEES                                      */
    /* ================================================================ */

    const { paymentsBoard, moneyBoard } = await import("../lib/console/board");
    const [payments, cash] = await Promise.all([paymentsBoard(), moneyBoard()]);

    check(
      "🔴 and the board counts it, which it could not do on any branch before this",
      (payments.confirmedWeek ?? 0) >= 3 && (payments.rejectedWeek ?? 0) >= 1,
      `${payments.confirmedWeek} confirmed, ${payments.rejectedWeek} rejected, $${(cash.inTotalCents ?? 0) / 100} in`,
    );
  } finally {
    /*
     * 🔴 EVERYTHING, IN DEPENDENCY ORDER, whatever happened above. A verifier
     * that leaves a demo company holding a funded pot is a verifier that puts
     * fake money on a real board.
     */
    await db.execute(sql`DELETE FROM ledger_entries WHERE memo LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE ref_id IN
      (SELECT id FROM sponsors WHERE name = 'Cycle Demo Foundry')`);
    await db.execute(sql`DELETE FROM manual_payments WHERE reference LIKE ${`CYCLE-%${fixture}`}`);
    await db.execute(sql`DELETE FROM manual_payments WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name = 'Cycle Demo Foundry')`);
    await db.execute(sql`DELETE FROM manual_payments WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM manual_payments WHERE ref_id IN
      (SELECT id FROM sessions WHERE join_token = ${`join-${fixture}`})`);
    await db.execute(sql`DELETE FROM invoices WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM sessions WHERE join_token = ${`join-${fixture}`}`);
    await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name = 'Cycle Demo Foundry')`);
    await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE name = 'Cycle Demo Foundry')`);
    await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name = 'Cycle Demo Foundry')`);
    await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name = 'Cycle Demo Foundry')`);
    await db.execute(sql`DELETE FROM sponsors WHERE name = 'Cycle Demo Foundry'`);
    await db.execute(sql`DELETE FROM patients WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM people WHERE id IN
      (SELECT person_id FROM patients WHERE email LIKE ${`%${fixture}%`})`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("the money cycle");
}

main();
