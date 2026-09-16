/**
 * 🔴 76.33 — EVERY WAY A COVERED EMPLOYEE'S MONEY CAN GO WRONG, ON REAL ROWS.
 *
 *   npm run verify:edges
 *
 * ## The defect this file is named after
 *
 * > *"a covered employee was being charged twice"*
 *
 * Sprint 76.27 found it: an employer covered half a session, `payFromPot`
 * debited their share at booking, and all three places that priced the session
 * afterwards read `sessions.price_cents` and asked the patient for the whole
 * thing. On a rail with no processor behind it that is money taken twice with
 * nothing to reverse it.
 *
 * It was fixed. This file exists because a single fix to a single defect is
 * worth very little when the SHAPE of the defect is "a money surface read the
 * price instead of the frozen share", and there were more of them:
 *
 *   - **`priceFor`**, the card rail's quote, still showed the full price while
 *     `createSessionPaymentCheckout` charged the share. One payment, two
 *     numbers, on the screen whose whole job is saying what you will be charged.
 *   - **`confirmSessionPayment`** could not write a second `session_payments`
 *     row for a session that already had a pot-funded one, so it hit
 *     `onConflictDoNothing`, logged a warning and returned. The patient's
 *     transfer, VAT and all, was posted to no account in the ledger.
 *   - **`vat_cents` was derived as `settles - price`**, which on a covered
 *     session is negative and clamps to zero, so the tax we actually collected
 *     and genuinely owe the ETA was recorded as nothing.
 *
 * ## 🔴 AND WHY `verify:cycle` DID NOT CATCH ANY OF THEM
 *
 * It has a section headed **"A PATIENT'S SESSION, PART COVERED BY THAT POT"**
 * and it never calls `payFromPot`. It funds a pot, then has a guest pay the
 * full price of an unrelated session. The heading describes a test that does
 * not exist, which is §6 in the instrument rather than in the product: a check
 * that passes by measuring the wrong thing. That is now fixed there and this
 * is the file that covers the rest.
 *
 * ## What each scenario is
 *
 * Every one is a sentence somebody could say about a real person, and every one
 * runs against rows through the product's own functions. Nothing here asserts
 * on source.
 *
 * Everything it makes is deleted in a `finally`, and `writesTo()` refuses
 * production by name.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `edge${Date.now().toString(36)}`;

/** One session's worth of therapy, in cents. 1,000 EGP at the seeded rate. */
const PRICE = 2000;

async function main() {
  writesTo();

  const { db, pool } = connect();

  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  try {
    /* ================================================================ */
    /*  THE CAST, and every one of them synthetic. C225.                 */
    /* ================================================================ */

    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug)
      VALUES ('Edge Demo Practice', 'eg', ${fixture}) RETURNING id`);

    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`hala.${fixture}@example.com`}, 'Hala', 'Demo', 'therapist', 'x')
      RETURNING id`);

    const operator = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`ops.${fixture}@example.com`}, 'Ops', 'Demo', 'admin', 'x')
      RETURNING id`);

    const sponsor = await one<{ id: string }>(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES ('Edge Demo Foundry', 'company', 'eg', 'EGP', 'active') RETURNING id`);

    const { openPot } = await import("../lib/data/sponsor-admin");
    await openPot({
      sponsorId: sponsor.id,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      overdraftCents: 0,
      welcomeCreditCents: 0,
    });

    /* A pot with enough for several half-sessions and not much more. */
    await db.execute(sql`
      UPDATE sponsor_pots SET balance_cents = 10000, coverage_bps = 5000
      WHERE sponsor_id = ${sponsor.id}`);

    /**
     * Make one enrolled person with one patient record and one pending session.
     *
     * `last_verified_at` is not decoration: `payFromPot` refuses an enrolment
     * without it, which cost a whole seed script an afternoon once.
     */
    const cast = async (
      tag: string,
      priceCents = PRICE,
    ): Promise<{ personId: string; patientId: string; sessionId: string }> => {
      const person = await one<{ id: string }>(sql`
        INSERT INTO people (first_name, last_name, region)
        VALUES (${tag}, 'Demo', 'eg') RETURNING id`);

      const patient = await one<{ id: string }>(sql`
        INSERT INTO patients (organization_id, person_id, first_name, last_name, email, phone, source)
        VALUES (${org.id}, ${person.id}, ${tag}, 'Demo', ${`${tag.toLowerCase()}.${fixture}@example.com`},
                ${`+2010000${Math.floor(Math.random() * 90000) + 10000}`}, 'self')
        RETURNING id`);

      await db.execute(sql`
        INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash,
                                identifier_kind, last_verified_at)
        VALUES (${sponsor.id}, ${person.id}, 'active', true, ${`${tag}-${fixture}`},
                'domain_email', now())`);

      const session = await one<{ id: string }>(sql`
        INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                              join_token, feedback_token, price_cents, payment_status, scheduled_at)
        VALUES (${org.id}, ${therapist.id}, ${patient.id}, 'scheduled', 'video',
                ${`join-${tag}-${fixture}`}, ${`fb-${tag}-${fixture}`}, ${priceCents}, 'pending',
                now() + interval '2 hours')
        RETURNING id`);

      return { personId: person.id, patientId: patient.id, sessionId: session.id };
    };

    const { payFromPot } = await import("../lib/billing/pot");
    const { patientOwesFor, sessionLines } = await import("../lib/billing/session-owed");
    const { sessionTransferMoney } = await import("../lib/billing/manual-entry");
    const { openCart } = await import("../lib/billing/cart");
    const { submitProof, confirmPayment, egpMinorFor, egpRateMicro } = await import(
      "../lib/billing/manual"
    );
    const { grantFor } = await import("../lib/billing/manual-grants");
    const rate = await egpRateMicro();

    /* ================================================================ */
    /*  1 · "A covered employee was charged twice"                       */
    /* ================================================================ */

    const half = await cast("Nour");
    const potBefore = await one<{ balance_cents: number }>(sql`
      SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);

    const spend = await payFromPot(half.sessionId);
    const potAfter = await one<{ balance_cents: number }>(sql`
      SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);

    check(
      "🔴 an employer covering 50% pays half at booking, and the pot goes down by half",
      spend.paid === true && potBefore.balance_cents - potAfter.balance_cents === PRICE / 2,
      `pot ${potBefore.balance_cents} → ${potAfter.balance_cents}, spent ${potBefore.balance_cents - potAfter.balance_cents} of ${PRICE}`,
    );

    const owed = await patientOwesFor(half.sessionId);

    check(
      "🔴 …and their employee is then asked for the OTHER half, not the whole price",
      owed.grossCents === PRICE / 2 && owed.coveredCents === PRICE / 2,
      `owes ${owed.grossCents}, covered ${owed.coveredCents}, price ${owed.priceCents}`,
    );

    /*
     * 🔴 THE CONTROL, and it is the defect itself, watched being wrong.
     *
     * `sessions.price_cents` is what all three surfaces read before 76.27 and
     * what `priceFor` was still reading after it. Asserting the right answer
     * without watching the wrong one appear is how a check passes for years
     * against a product that has quietly stopped doing the thing.
     */
    const naive = await one<{ price_cents: number }>(sql`
      SELECT price_cents FROM sessions WHERE id = ${half.sessionId}`);

    check(
      "🔴 CONTROL the old read is still there to be got wrong, and is twice what is owed",
      naive.price_cents === owed.grossCents * 2,
      `price_cents ${naive.price_cents} against ${owed.grossCents} owed`,
    );

    /* ================================================================ */
    /*  2 · "The payment screen quoted one number and charged another"   */
    /* ================================================================ */

    /*
     * Both rails, from the same frozen figure. The transfer rail adds VAT on
     * top of the patient's share; the card rail does the same arithmetic inside
     * `createSessionPaymentCheckout`. The bug was that the card rail's QUOTE
     * did not, so a patient saw roughly double what Stripe then asked for.
     */
    const transferMoney = await sessionTransferMoney({
      organizationId: org.id,
      priceCents: owed.grossCents,
    });

    check(
      "🔴 the transfer quote is VAT on the SHARE, not VAT on the price",
      transferMoney.grossCents === PRICE / 2 && transferMoney.settlesCents === 1140,
      `$${transferMoney.grossCents / 100} + $${transferMoney.vatCents / 100} = ${egpMinorFor(transferMoney.settlesCents, rate) / 100} EGP`,
    );

    const { priceFor } = await import("../app/pay/[token]/actions");
    const token = await one<{ join_token: string }>(sql`
      SELECT join_token FROM sessions WHERE id = ${half.sessionId}`);
    const quoted = await priceFor(token.join_token, "eg");

    check(
      "🔴 …and the CARD rail's quote agrees with it, which for a sprint it did not",
      !("error" in quoted) && quoted.grossCents === owed.grossCents,
      "error" in quoted
        ? quoted.error
        : `quote $${quoted.grossCents / 100} against $${owed.grossCents / 100} owed`,
    );

    /* ================================================================ */
    /*  3 · "The split was not shown, so the patient did not pay"        */
    /* ================================================================ */

    const lines = sessionLines({
      owed,
      vatCents: transferMoney.vatCents,
      sessionLabel: "A session with Dr Demo",
      benefitLabel: "Covered by your employer",
      vatLabel: "VAT",
    });

    check(
      "🔴 a part payment says what covered the rest, and the lines sum to the ask",
      lines.length === 3 &&
        lines.reduce((sum, line) => sum + line.cents, 0) === transferMoney.settlesCents,
      lines.map((line) => `${line.label} ${line.cents}`).join(", "),
    );

    /* ================================================================ */
    /*  4 · "Their transfer arrived and the books never heard about it"  */
    /* ================================================================ */

    const vatBefore = await one<{ sum: number }>(sql`
      SELECT COALESCE(SUM(amount_cents), 0)::int AS sum FROM ledger_entries
      WHERE account = 'vat_payable' AND organization_id = ${org.id}`);

    const claim = await openCart({
      purpose: "session",
      refId: half.sessionId,
      amountCents: egpMinorFor(transferMoney.settlesCents, rate),
      settlesCents: transferMoney.settlesCents,
      lineItems: lines,
      payer: { kind: "session", organizationId: org.id },
    });

    await submitProof({
      paymentId: claim.id!,
      reference: `EDGE-HALF-${fixture}`,
      proofUrl: null,
    });
    await confirmPayment({ paymentId: claim.id!, byUserId: operator.id, onConfirmed: grantFor });

    const settled = await one<{ payment_status: string }>(sql`
      SELECT payment_status FROM sessions WHERE id = ${half.sessionId}`);

    check(
      "🔴 confirming the employee's half is what lets them into the room",
      settled.payment_status === "paid",
      `payment_status ${settled.payment_status}`,
    );

    const vatAfter = await one<{ sum: number }>(sql`
      SELECT COALESCE(SUM(amount_cents), 0)::int AS sum FROM ledger_entries
      WHERE account = 'vat_payable' AND organization_id = ${org.id}`);

    /*
     * 🔴 THE TAX WE ACTUALLY HOLD, and it was ZERO for every covered employee.
     *
     * `vat_payable` is a liability, so it rises with a NEGATIVE amount. The
     * patient paid 140 EGP of tax on their half; before this sprint the
     * derivation was `settles - price`, which is negative on a covered session,
     * clamped to zero, and the row that would have carried it was never written
     * at all because the pot had already taken the unique index.
     */
    check(
      "🔴 …and the VAT on their half is recorded as owed, which for two sprints it was not",
      vatBefore.sum - vatAfter.sum === transferMoney.vatCents,
      `vat_payable moved ${vatBefore.sum - vatAfter.sum}, VAT collected ${transferMoney.vatCents}`,
    );

    const payment = await one<{
      gross_cents: number;
      sponsor_share_cents: number;
      patient_share_cents: number;
      vat_cents: number;
      platform_fee_cents: number;
      therapist_net_cents: number;
      n: number;
    }>(sql`
      SELECT gross_cents, sponsor_share_cents, patient_share_cents, vat_cents,
             platform_fee_cents, therapist_net_cents,
             (SELECT COUNT(*)::int FROM session_payments WHERE session_id = ${half.sessionId}) AS n
      FROM session_payments WHERE session_id = ${half.sessionId}`);

    check(
      "🔴 …and there is exactly ONE payment row for the session, holding both halves",
      payment.n === 1 &&
        payment.sponsor_share_cents === PRICE / 2 &&
        payment.patient_share_cents === PRICE / 2,
      `${payment.n} row, sponsor ${payment.sponsor_share_cents}, patient ${payment.patient_share_cents}, vat ${payment.vat_cents}`,
    );

    /*
     * 🔴 C313 — OUR CUT AND THE CLINICIAN'S NET ARE ON THE FULL PRICE.
     *
     * A partly covered session is not a cheaper session. A fee that moved with
     * the split would make a clinician's income depend on their patient's
     * employer, which is a thing no clinician would agree to and nobody would
     * notice until a payout looked wrong.
     */
    check(
      "🔴 …and the clinician is paid on the FULL price, not on what the patient sent",
      payment.gross_cents === PRICE &&
        payment.platform_fee_cents + payment.therapist_net_cents === PRICE,
      `gross ${payment.gross_cents}, fee ${payment.platform_fee_cents} + net ${payment.therapist_net_cents}`,
    );

    /* ================================================================ */
    /*  5 · "An operator pressed Confirm twice"                          */
    /* ================================================================ */

    const beforeSecond = await one<{ legs: number; balance: number }>(sql`
      SELECT (SELECT COUNT(*)::int FROM ledger_entries WHERE organization_id = ${org.id}) AS legs,
             (SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}) AS balance`);

    await confirmPayment({ paymentId: claim.id!, byUserId: operator.id, onConfirmed: grantFor });

    const afterSecond = await one<{ legs: number; balance: number }>(sql`
      SELECT (SELECT COUNT(*)::int FROM ledger_entries WHERE organization_id = ${org.id}) AS legs,
             (SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}) AS balance`);

    check(
      "🔴 confirming the same transfer twice moves nothing the second time",
      beforeSecond.legs === afterSecond.legs && beforeSecond.balance === afterSecond.balance,
      `${beforeSecond.legs} legs → ${afterSecond.legs}, pot ${beforeSecond.balance} → ${afterSecond.balance}`,
    );

    /* ================================================================ */
    /*  6 · "The employer covers all of it"                              */
    /* ================================================================ */

    await db.execute(sql`
      UPDATE sponsor_pots SET coverage_bps = 10000 WHERE sponsor_id = ${sponsor.id}`);

    const whole = await cast("Yara");
    const wholeSpend = await payFromPot(whole.sessionId);
    const wholeOwed = await patientOwesFor(whole.sessionId);
    const wholeSession = await one<{ payment_status: string }>(sql`
      SELECT payment_status FROM sessions WHERE id = ${whole.sessionId}`);

    check(
      "🔴 a fully covered employee is never shown a payment screen at all",
      wholeSpend.paid === true &&
        wholeSession.payment_status === "paid" &&
        wholeOwed.grossCents === 0,
      `status ${wholeSession.payment_status}, owes ${wholeOwed.grossCents}`,
    );

    /* ================================================================ */
    /*  7 · "The employer covers nothing, and that is not removal"       */
    /* ================================================================ */

    await db.execute(sql`
      UPDATE sponsor_pots SET coverage_bps = 0 WHERE sponsor_id = ${sponsor.id}`);

    const none = await cast("Salma");
    const noneSpend = await payFromPot(none.sessionId);
    const noneOwed = await patientOwesFor(none.sessionId);
    const stillEnrolled = await one<{ state: string }>(sql`
      SELECT state FROM enrolments WHERE person_id = ${none.personId}`);

    /*
     * 🔴 C345 — 0% IS LEGAL AND IS NOT REMOVAL.
     *
     * The person keeps their place on the roster and their badge; the money
     * stops. `nothing_to_pay` would be the wrong answer and the wrong screen:
     * they do owe, they owe all of it, and they are still an employee with a
     * benefit that currently pays nothing.
     */
    check(
      "🔴 an employer at 0% leaves the person enrolled and owing the whole price",
      noneSpend.paid === false &&
        noneOwed.grossCents === PRICE &&
        stillEnrolled.state === "active",
      `reason ${noneSpend.paid ? "funded" : noneSpend.reason}, owes ${noneOwed.grossCents}, enrolment ${stillEnrolled.state}`,
    );

    /* ================================================================ */
    /*  8 · "The employer lowered their percentage after I booked"       */
    /* ================================================================ */

    await db.execute(sql`
      UPDATE sponsor_pots SET coverage_bps = 5000 WHERE sponsor_id = ${sponsor.id}`);

    const frozen = await cast("Dina");
    await payFromPot(frozen.sessionId);
    const atBooking = await patientOwesFor(frozen.sessionId);

    await db.execute(sql`
      UPDATE sponsor_pots SET coverage_bps = 1000 WHERE sponsor_id = ${sponsor.id}`);
    const afterChange = await patientOwesFor(frozen.sessionId);

    /*
     * 🔴 C311 — A PRICE SOMEBODY WAS SHOWN IS A PRICE THEY ARE OWED.
     *
     * The split is read once, at booking, and written onto the payment row.
     * Re-reading the pot when the money moves would let an employer lowering
     * their percentage on a Tuesday change what somebody owes for a session
     * they agreed to on Monday.
     */
    check(
      "🔴 an employer lowering coverage cannot change a price already agreed",
      atBooking.grossCents === PRICE / 2 && afterChange.grossCents === atBooking.grossCents,
      `owed ${atBooking.grossCents} at booking, ${afterChange.grossCents} after the employer went to 10%`,
    );

    /* ================================================================ */
    /*  9 · "The pot ran out mid-month"                                  */
    /* ================================================================ */

    await db.execute(sql`
      UPDATE sponsor_pots SET balance_cents = 100, coverage_bps = 5000
      WHERE sponsor_id = ${sponsor.id}`);

    const broke = await cast("Mai");
    const brokeSpend = await payFromPot(broke.sessionId);
    const brokeOwed = await patientOwesFor(broke.sessionId);
    const brokeBalance = await one<{ balance_cents: number }>(sql`
      SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);

    /*
     * 🔴 AND THE PATIENT IS OFFERED THE ORDINARY LINK, not a refusal of care.
     * An empty pot is the employer's problem and it arrives in their inbox. The
     * person in front of it gets the pay screen everybody else gets.
     */
    check(
      "🔴 an empty pot refuses the spend, takes nothing, and the patient owes the full price",
      brokeSpend.paid === false &&
        brokeBalance.balance_cents === 100 &&
        brokeOwed.grossCents === PRICE,
      `reason ${brokeSpend.paid ? "funded" : brokeSpend.reason}, pot still ${brokeBalance.balance_cents}, owes ${brokeOwed.grossCents}`,
    );

    /* ================================================================ */
    /*  10 · "A free session asks nobody for anything"                   */
    /* ================================================================ */

    await db.execute(sql`
      UPDATE sponsor_pots SET balance_cents = 10000 WHERE sponsor_id = ${sponsor.id}`);

    const free = await cast("Laila", 0);
    const freeOwed = await patientOwesFor(free.sessionId);

    check(
      "🔴 a free session owes nothing, from every surface, and the pot is not touched",
      freeOwed.grossCents === 0 && freeOwed.priceCents === 0,
      `owes ${freeOwed.grossCents}`,
    );

    /* ================================================================ */
    /*  11 · "Where did our money go"                                    */
    /* ================================================================ */

    const { potTrace, potSpendAgrees } = await import("../lib/console/pot-trace");
    const trace = await potTrace(sponsor.id);
    const agrees = await potSpendAgrees(sponsor.id);

    check(
      "🔴 every pot cent traces to one session, and the trace agrees with the ledger",
      trace.rows.length >= 3 && agrees.agrees,
      `${trace.rows.length} sponsored sessions, $${agrees.fromSessions / 100} from sessions against $${agrees.fromLedger / 100} from the ledger`,
    );

    /*
     * 🔴 C227 / C243 — AND IT NAMES NOBODY.
     *
     * A list reading "Edge Demo Foundry paid for Nour Demo's session with Dr
     * Hala" is a register of who is in therapy, indexed by employer. The
     * clinician is safe because we pay them; the patient is a reference.
     */
    check(
      "🔴 …and not one row on it carries a patient's name",
      trace.rows.every((row) => !/Nour|Yara|Salma|Dina|Mai|Laila/.test(JSON.stringify(row))),
      `${trace.rows.length} rows, every patient an eight character reference`,
    );

    /* ================================================================ */
    /*  12 · AND THE BOOKS STILL BALANCE                                 */
    /* ================================================================ */

    const { unbalancedTransactions } = await import("../lib/billing/ledger");
    const drift = await unbalancedTransactions();

    check(
      "🔴 every transaction these twelve scenarios wrote balances to zero",
      drift.length === 0,
      drift.length === 0 ? "no drift anywhere in the ledger" : `${drift.length} unbalanced`,
    );

    await db.execute(sql`
      INSERT INTO ledger_entries (txn_id, txn_kind, account, amount_cents, currency, ref_type, ref_id, memo)
      VALUES (gen_random_uuid(), 'adjustment', 'platform_cash', 9999, 'usd', 'sponsor', ${sponsor.id},
              ${`planted by ${fixture}`})`);
    const withOffender = await unbalancedTransactions();
    await db.execute(sql`DELETE FROM ledger_entries WHERE memo = ${`planted by ${fixture}`}`);

    check(
      "🔴 CONTROL the same query finds a leg with no counterpart",
      withOffender.length > drift.length,
      `${withOffender.length} unbalanced with one planted, ${drift.length} without`,
    );
  } finally {
    /*
     * 🔴 EVERYTHING, IN DEPENDENCY ORDER. A verifier that leaves a demo company
     * holding a funded pot is a verifier that puts fake money on a real board.
     */
    await db.execute(sql`DELETE FROM ledger_entries WHERE memo LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE ref_id IN
      (SELECT id FROM sponsors WHERE name = 'Edge Demo Foundry')`);
    await db.execute(sql`DELETE FROM manual_payments WHERE reference LIKE ${`EDGE-%${fixture}`}`);
    await db.execute(sql`DELETE FROM manual_payments WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM manual_payments WHERE ref_id IN
      (SELECT id FROM sessions WHERE join_token LIKE ${`join-%-${fixture}`})`);
    await db.execute(sql`DELETE FROM session_payments WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM sessions WHERE join_token LIKE ${`join-%-${fixture}`}`);
    await db.execute(sql`DELETE FROM enrolments WHERE identifier_hash LIKE ${`%-${fixture}`}`);
    await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id IN
      (SELECT id FROM sponsors WHERE name = 'Edge Demo Foundry')`);
    await db.execute(sql`DELETE FROM sponsors WHERE name = 'Edge Demo Foundry'`);
    await db.execute(sql`DELETE FROM people WHERE id IN
      (SELECT person_id FROM patients WHERE email LIKE ${`%${fixture}%`})`);
    await db.execute(sql`DELETE FROM patients WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("the money edges");
}

main();
