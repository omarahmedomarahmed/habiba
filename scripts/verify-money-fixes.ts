/**
 * 🔴 THE MONEY FIXES OF 25 SEPTEMBER, EACH WATCHED ON REAL ROWS.
 *
 *   npm run verify:money-fixes
 *
 * One scenario per defect in the money list (K4, K5, K15, K16a to K16g, K17,
 * K20, ME20, and the pot trace), run through the product's own functions
 * against the dev database, each beside a CONTROL that shows the state the old
 * code would have left: a check that only asserts the good case is not a test
 * of a guard (H25). What cannot run here without a payment provider (a Stripe
 * checkout, a concurrent Stripe release) is asserted on the source, again with
 * a control that the scan can fail.
 *
 * Everything it makes is deleted in a `finally`, and `writesTo()` refuses
 * production by name.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `mfix${Date.now().toString(36)}`;
const PRICE = 2000;

async function main() {
  writesTo();
  const { db, pool } = connect();
  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };
  const approvalIds: string[] = [];

  try {
    /* ------------------------------------------------------------ the cast */

    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug)
      VALUES ('Money Fixes Demo Practice', 'eg', ${fixture}) RETURNING id`);
    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`amal.${fixture}@example.com`}, 'Amal', 'Demo', 'therapist', 'x') RETURNING id`);
    const operator = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`ops.${fixture}@example.com`}, 'Ops', 'Demo', 'admin', 'x') RETURNING id`);
    const second = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`ops2.${fixture}@example.com`}, 'Ops', 'Second', 'admin', 'x') RETURNING id`);

    const sponsorA = await one<{ id: string }>(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES ('Money Fixes Demo Foundry', 'company', 'eg', 'EGP', 'active') RETURNING id`);
    const sponsorB = await one<{ id: string }>(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES ('Money Fixes Demo Mill', 'company', 'eg', 'EGP', 'active') RETURNING id`);
    const { openPot } = await import("../lib/data/sponsor-admin");
    for (const sponsorId of [sponsorA.id, sponsorB.id]) {
      await openPot({
        sponsorId,
        refundPolicy: "Unused balance is refunded within 30 days of written notice.",
        expiresAt: new Date(Date.now() + 365 * 86_400_000),
        overdraftCents: 0,
        welcomeCreditCents: 0,
      });
    }
    await db.execute(sql`
      UPDATE sponsor_pots SET balance_cents = 10000, coverage_bps = 5000
       WHERE sponsor_id IN (${sponsorA.id}, ${sponsorB.id})`);

    let n = 0;
    const cast = async (
      tag: string,
      opts: { enrolIn?: string; type?: string; createdAgo?: string } = {},
    ): Promise<{ personId: string; patientId: string; sessionId: string }> => {
      n += 1;
      const person = await one<{ id: string }>(sql`
        INSERT INTO people (first_name, last_name, email, region)
        VALUES (${tag}, 'Demo', ${`${tag.toLowerCase()}.${fixture}@example.com`}, 'eg') RETURNING id`);
      const patient = await one<{ id: string }>(sql`
        INSERT INTO patients (organization_id, person_id, first_name, last_name, email, phone, source)
        VALUES (${org.id}, ${person.id}, ${tag}, 'Demo', ${`${tag.toLowerCase()}.${fixture}@example.com`},
                ${`+2011${String(Date.now()).slice(-5)}${n}`}, 'self')
        RETURNING id`);
      if (opts.enrolIn) {
        await db.execute(sql`
          INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash,
                                  identifier_kind, last_verified_at)
          VALUES (${opts.enrolIn}, ${person.id}, 'active', true, ${`${tag}-${fixture}`},
                  'domain_email', now())`);
      }
      const session = await one<{ id: string }>(sql`
        INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality, session_type,
                              join_token, feedback_token, price_cents, payment_status, scheduled_at, created_at)
        VALUES (${org.id}, ${therapist.id}, ${patient.id}, 'scheduled', 'video', ${opts.type ?? "direct"},
                ${`join-${tag}-${fixture}`}, ${`fb-${tag}-${fixture}`}, ${PRICE}, 'pending',
                now() + interval '2 hours', now() - ${opts.createdAgo ?? "0 minutes"}::interval)
        RETURNING id`);
      return { personId: person.id, patientId: patient.id, sessionId: session.id };
    };

    const { openCart, cancelCart } = await import("../lib/billing/cart");
    const { submitProof, confirmPayment, egpMinorFor, egpRateMicro } = await import("../lib/billing/manual");
    const { grantFor } = await import("../lib/billing/manual-grants");
    const { sessionTransferMoney } = await import("../lib/billing/manual-entry");
    const rate = await egpRateMicro();

    /** A transfer for a whole uncovered session, submitted and waiting. */
    const submitted = async (sessionId: string, tag: string, egpMinor?: number) => {
      const money = await sessionTransferMoney({ organizationId: org.id, priceCents: PRICE });
      const cart = await openCart({
        purpose: "session",
        refId: sessionId,
        amountCents: egpMinor ?? egpMinorFor(money.settlesCents, rate),
        settlesCents: money.settlesCents,
        payer: { kind: "session", organizationId: org.id },
      });
      await submitProof({ paymentId: cart.id!, reference: `MFIX-${tag}-${fixture}`, proofUrl: null });
      return { id: cart.id!, settlesCents: money.settlesCents };
    };

    /* ================================================================ */
    /*  K4 · a "credit without proof" request whose cart went away       */
    /* ================================================================ */

    const { secondPersonGate } = await import("../lib/billing/approvals");
    const { discardCart } = await import("../lib/billing/rail-exceptions");
    const k4a = await cast("Rana");
    const k4Cart = await openCart({
      purpose: "session",
      refId: k4a.sessionId,
      amountCents: 100_000,
      settlesCents: PRICE,
      payer: { kind: "session", organizationId: org.id },
    });
    await secondPersonGate({
      kind: "transfer_without_proof",
      subjectId: k4Cart.id!,
      payload: { paymentId: k4Cart.id! },
      reason: `Seen on the statement, ${fixture}`,
      actorUserId: operator.id,
      enabled: true,
    });
    const asked = await one<{ id: string; state: string }>(sql`
      SELECT id, state FROM pending_approvals WHERE subject_id = ${k4Cart.id!}`);
    approvalIds.push(asked.id);
    check("K4 CONTROL the request is open while its cart exists", asked.state === "asked", asked.state);
    /*
     * The person who asked may not discard it (AE10: they are told to leave it
     * to the second person); a second person discarding it declines the request
     * under their own name, and the cart goes with it.
     */
    const byAsker = await discardCart(k4Cart.id!, operator.id);
    check("K4 CONTROL the person who asked cannot discard the cart", byAsker === "asked", String(byAsker));
    await discardCart(k4Cart.id!, second.id);
    const afterDiscard = await one<{ state: string; decided_at: Date | null }>(sql`
      SELECT state, decided_at FROM pending_approvals WHERE id = ${asked.id}`);
    check(
      "🔴 K4 a second person discarding the cart closes its credit-without-proof request",
      afterDiscard.state === "declined" && afterDiscard.decided_at !== null,
      afterDiscard.state,
    );

    const k4b = await cast("Reem");
    const k4Cart2 = await openCart({
      purpose: "session",
      refId: k4b.sessionId,
      amountCents: 100_000,
      settlesCents: PRICE,
      payer: { kind: "session", organizationId: org.id },
    });
    await secondPersonGate({
      kind: "transfer_without_proof",
      subjectId: k4Cart2.id!,
      payload: { paymentId: k4Cart2.id! },
      reason: `Seen on the statement, ${fixture}`,
      actorUserId: operator.id,
      enabled: true,
    });
    const asked2 = await one<{ id: string }>(sql`SELECT id FROM pending_approvals WHERE subject_id = ${k4Cart2.id!}`);
    approvalIds.push(asked2.id);
    await cancelCart({ kind: "session", sessionId: k4b.sessionId });
    const afterCancel = await one<{ state: string }>(sql`SELECT state FROM pending_approvals WHERE id = ${asked2.id}`);
    check("🔴 K4 …and so does the payer cancelling it", afterCancel.state === "void", afterCancel.state);

    const transferActions = readSource("app/(admin)/admin/transfers/actions.ts");
    check(
      "🔴 K4 Complete on a cart that is gone closes the request instead of failing on it for ever",
      /still\?\.state !== "awaiting_proof"[\s\S]{0,200}voidApprovalsFor/.test(transferActions),
      "confirmUnclaimed voids the request when the payment is no longer an open cart",
    );

    /* ================================================================ */
    /*  K5 · a confirmation whose grant failed is still a confirmation   */
    /* ================================================================ */

    const k5 = await cast("Lina");
    const k5Pay = await submitted(k5.sessionId, "K5");
    const failed = await confirmPayment({
      paymentId: k5Pay.id,
      byUserId: operator.id,
      onConfirmed: async () => {
        throw new Error(`simulated grant failure ${fixture}`);
      },
    });
    check(
      "🔴 K5 a grant that throws still reports the payment as confirmed, so the action audits it",
      failed.confirmed === true && Boolean(failed.error),
      JSON.stringify(failed),
    );
    const confirmBody = transferActions.slice(
      transferActions.indexOf("export async function confirm("),
      transferActions.indexOf("export async function reject("),
    );
    const auditsFirst = (body: string) =>
      body.indexOf("if (result.confirmed)") > 0 &&
      body.indexOf("if (result.confirmed)") < body.indexOf("if (result.error) return") &&
      /action: "transfer\.confirm"/.test(body.slice(body.indexOf("if (result.confirmed)"), body.indexOf("if (result.error) return")));
    check(
      "🔴 K5 the confirm action writes `transfer.confirm` on `confirmed`, before it returns the grant's error",
      auditsFirst(confirmBody),
      "audit first, then the error to staff",
    );
    check(
      "K5 CONTROL the old shape, returning on the error before the audit, fails that scan",
      !auditsFirst(
        'const result = await confirmPayment({});\n  if (result.error) return { error: result.error };\n\n  await audit({ action: "transfer.confirm" });',
      ),
      "watched failing on the old body",
    );

    /* ================================================================ */
    /*  K16a · Retry after the grant threw past the claim (ME3)          */
    /* ================================================================ */

    const { claimSessionPaid } = await import("../lib/billing/session-owed");
    const { retryGrant } = await import("../lib/billing/rail-exceptions");
    const k16a = await cast("Maya");
    const k16aPay = await submitted(k16a.sessionId, "K16A");
    await confirmPayment({
      paymentId: k16aPay.id,
      byUserId: operator.id,
      /* What grantSession does up to the claim, then the throw that used to strand it. */
      onConfirmed: async (payment) => {
        await claimSessionPaid(payment.refId!);
        await db.execute(sql`UPDATE manual_payments SET granted_at = now() WHERE id = ${payment.id}`);
        throw new Error(`simulated settlement failure ${fixture}`);
      },
    });
    const beforeRetry = await one<{ n: number; status: string }>(sql`
      SELECT (SELECT count(*)::int FROM session_payments WHERE session_id = ${k16a.sessionId}) AS n,
             (SELECT payment_status FROM sessions WHERE id = ${k16a.sessionId}) AS status`);
    check(
      "K16a CONTROL the session is paid and nothing is on the books: the state the old Retry called overpaid",
      beforeRetry.status === "paid" && beforeRetry.n === 0,
      JSON.stringify(beforeRetry),
    );
    const retried = await retryGrant({ paymentId: k16aPay.id });
    const afterRetry = await one<{ n: number; exception: string | null; cash: number }>(sql`
      SELECT (SELECT count(*)::int FROM session_payments WHERE session_id = ${k16a.sessionId}) AS n,
             (SELECT exception FROM manual_payments WHERE id = ${k16aPay.id}) AS exception,
             (SELECT COALESCE(SUM(amount_cents), 0)::int FROM ledger_entries
               WHERE ref_type = 'session_payment' AND account = 'cash'
                 AND ref_id IN (SELECT id FROM session_payments WHERE session_id = ${k16a.sessionId})) AS cash`);
    check(
      "🔴 K16a Retry of our own claim records the payment instead of calling it overpaid",
      retried.ok === true && afterRetry.n === 1 && afterRetry.exception === null && afterRetry.cash === k16aPay.settlesCents,
      JSON.stringify({ retried, afterRetry }),
    );
    const again = await retryGrant({ paymentId: k16aPay.id });
    const legsAfterAgain = await one<{ cash: number }>(sql`
      SELECT COALESCE(SUM(amount_cents), 0)::int AS cash FROM ledger_entries
       WHERE ref_type = 'session_payment' AND account = 'cash'
         AND ref_id IN (SELECT id FROM session_payments WHERE session_id = ${k16a.sessionId})`);
    check(
      "K16a …and a second Retry posts nothing twice",
      Boolean(again.error) && legsAfterAgain.cash === afterRetry.cash,
      JSON.stringify({ again, legsAfterAgain }),
    );
    const other = await submitted(k16a.sessionId, "K16A-OTHER");
    await confirmPayment({ paymentId: other.id, byUserId: operator.id, onConfirmed: grantFor });
    const otherFlag = await one<{ exception: string | null }>(sql`SELECT exception FROM manual_payments WHERE id = ${other.id}`);
    check(
      "K16a CONTROL a DIFFERENT transfer for the same paid session is still raised as paid twice",
      otherFlag.exception === "overpaid",
      String(otherFlag.exception),
    );

    /* ================================================================ */
    /*  K16b · netted fees come off the books the earnings are on        */
    /* ================================================================ */

    const { heldForTherapistByEntity } = await import("../lib/billing/ledger");
    const held = await heldForTherapistByEntity(therapist.id);
    check(
      "🔴 K16b an Egyptian clinician's earnings are held on `eg`, which is where a netted fee now comes off",
      held.eg > 0 && held.us === 0 && !/entity: "us"/.test(readSource("lib/billing/service.ts").slice(
        readSource("lib/billing/service.ts").indexOf("async function netFeeFromEarnings"),
        readSource("lib/billing/service.ts").indexOf("async function raiseInvoice"),
      )),
      JSON.stringify(held),
    );
    check(
      "K16b CONTROL the scan finds the old hard-coded entity when it is there",
      /entity: "us"/.test('await postFeeNettedFromHeld({ amountCents: input.amountCents, entity: "us" });'),
      "watched finding it",
    );

    /* ================================================================ */
    /*  K16d · in person, never started: back to the wallet by the rule  */
    /* ================================================================ */

    const { refundSessionToWallet } = await import("../lib/billing/connect");
    const { walletBalanceCents } = await import("../lib/billing/wallet");
    const k16aPerson = k16a.personId;
    const walletBefore = await walletBalanceCents(k16aPerson);
    const paidRow = await one<{ id: string }>(sql`SELECT id FROM session_payments WHERE session_id = ${k16a.sessionId}`);
    const toWallet = await refundSessionToWallet({ paymentId: paidRow.id, reason: `Not started ${fixture}` });
    const walletAfter = await walletBalanceCents(k16aPerson);
    const refundedRow = await one<{ status: string }>(sql`SELECT status FROM session_payments WHERE id = ${paidRow.id}`);
    check(
      "🔴 K16d a refund under `refundTo: wallet` credits what the patient paid to their wallet and closes the payment",
      toWallet.ok === true && refundedRow.status === "refunded" && walletAfter - walletBefore === k16aPay.settlesCents,
      JSON.stringify({ toWallet, walletBefore, walletAfter, status: refundedRow.status }),
    );
    const twice = await refundSessionToWallet({ paymentId: paidRow.id, reason: `Not started ${fixture}` });
    check(
      "K16d …once: a second call finds it refunded and credits nothing",
      Boolean(twice.fallback) && (await walletBalanceCents(k16aPerson)) === walletAfter,
      JSON.stringify(twice),
    );
    check(
      "K16d CONTROL the in-person sweep reads the rule it used to ignore",
      /rules\.refundTo === "wallet"/.test(readSource("lib/data/in-person.ts")),
      "refundTo is read",
    );
    const walletLegs = await one<{ kinds: string[] }>(sql`
      SELECT array_agg(DISTINCT txn_kind) AS kinds FROM ledger_entries
       WHERE ref_type = 'patient_credit'
         AND ref_id IN (SELECT id FROM patient_credits WHERE person_id = ${k16aPerson})`);
    check(
      "🔴 K16c money coming back to a wallet is booked as `wallet_return`, the kind 0169 declared and nothing wrote",
      (walletLegs.kinds ?? []).includes("wallet_return"),
      JSON.stringify(walletLegs.kinds),
    );

    /* ================================================================ */
    /*  K16c · an expired credit leaves the books                        */
    /* ================================================================ */

    const { creditWallet, expireWalletCredits } = await import("../lib/billing/wallet");
    const k16c = await cast("Hoda");
    const credit = await creditWallet({
      personId: k16c.personId,
      cents: 500,
      reason: `Demo credit ${fixture}`,
      fromSessionId: k16c.sessionId,
      from: [{ account: "cash", amountCents: 500, organizationId: org.id, memo: `Demo credit ${fixture}` }],
    });
    await db.execute(sql`UPDATE patient_credits SET expires_at = now() - interval '1 day' WHERE id = ${credit!.creditId}`);
    const liabilityBefore = await one<{ sum: number }>(sql`
      SELECT COALESCE(SUM(amount_cents), 0)::int AS sum FROM ledger_entries
       WHERE account = 'patient_wallet' AND ref_type = 'patient_credit' AND ref_id = ${credit!.creditId}`);
    check(
      "K16c CONTROL an expired credit is spendable by nobody while the books still owe it",
      (await walletBalanceCents(k16c.personId)) === 0 && liabilityBefore.sum === -500,
      JSON.stringify(liabilityBefore),
    );
    const expired = await expireWalletCredits(new Date(), k16c.personId);
    const liabilityAfter = await one<{ sum: number }>(sql`
      SELECT COALESCE(SUM(amount_cents), 0)::int AS sum FROM ledger_entries
       WHERE account = 'patient_wallet' AND ref_type = 'patient_credit' AND ref_id = ${credit!.creditId}`);
    const expiredAgain = await expireWalletCredits(new Date(), k16c.personId);
    check(
      "🔴 K16c expiry releases the liability, once",
      expired.cents === 500 && liabilityAfter.sum === 0 && expiredAgain.cents === 0,
      JSON.stringify({ expired, liabilityAfter, expiredAgain }),
    );
    const wallet = readSource("lib/billing/wallet.ts");
    const returnBody = wallet.slice(wallet.indexOf("export async function returnSpentHold"), wallet.indexOf("export async function expireWalletCredits"));
    check(
      "🔴 K16c (ME25) the hold is marked returned and the credit written in ONE transaction",
      /db\.transaction\(async \(tx\)/.test(returnBody) && /executor: tx/.test(returnBody),
      "a failure between the two used to leave a returned hold and no money",
    );

    /* ================================================================ */
    /*  K16e · the wallet on the card rail (ME22)                        */
    /* ================================================================ */

    const connect2 = readSource("lib/billing/connect.ts");
    const checkout = connect2.slice(connect2.indexOf("export async function createSessionPaymentCheckout"), connect2.indexOf("async function recordSessionCheckout"));
    const settle = connect2.slice(connect2.indexOf("export async function settleSessionPayment"), connect2.indexOf("async function settleCoveredShare"));
    check(
      "🔴 K16e the card checkout charges the share LESS the wallet's hold, out of our fee",
      /walletCentsOn\(opts\.sessionId\)/.test(checkout) && /const patientGross = patientShare - walletCents/.test(checkout) &&
        /baseFee - walletCents/.test(checkout),
      "the checkout used to charge the whole share",
    );
    check(
      "🔴 K16e …and the card settlement spends the hold, which it never did",
      /spendHold\(row\.sessionId\)/.test(settle),
      "the hold stayed held for ever",
    );
    check(
      "K16e CONTROL the old checkout line is what the scan refuses",
      !/const patientGross = patientShare - walletCents/.test("const patientGross = covered ? covered.patientShareCents : gross;"),
      "watched refusing it",
    );

    /* ================================================================ */
    /*  K16f · one release of held earnings at a time (ME19)             */
    /* ================================================================ */

    const release = connect2.slice(connect2.indexOf("export async function releaseHeldEarnings"), connect2.indexOf("export async function releaseAllHeldEarnings"));
    check(
      "🔴 K16f a release reads the balance under a per-clinician lock, less every release still in flight",
      /pg_advisory_xact_lock\(hashtext\(\$\{`earnings-release:/.test(release) && /status = 'pending'/.test(release) &&
        release.indexOf("postEarningsTransfer(") < release.indexOf('set({ status: "paid"'),
      "cron and admin used to both read the same balance and both send it",
    );
    check(
      "K16f CONTROL the scan fails a release with no lock",
      !/pg_advisory_xact_lock/.test("const held = await heldForTherapist(therapistId); await db.insert(earningsTransfers)"),
      "watched failing",
    );

    /* ================================================================ */
    /*  K16g · the pounds the payer sent, not today's rate (ME39)        */
    /* ================================================================ */

    const { pendingPaymentFor } = await import("../lib/billing/pending");
    const { wordsIn } = await import("../lib/i18n/message-words");
    const words = await wordsIn("en");
    const k16g = await cast("Nada");
    const sentMinor = 123_456;
    const k16gPay = await submitted(k16g.sessionId, "K16G", sentMinor);
    const banner = await pendingPaymentFor({ kind: "session", sessionId: k16g.sessionId }, words.t, "en");
    check(
      "K16g CONTROL today's rate gives a different figure from what this payer sent",
      egpMinorFor(k16gPay.settlesCents, rate) !== sentMinor,
      `${egpMinorFor(k16gPay.settlesCents, rate)} against ${sentMinor}`,
    );
    check(
      "🔴 K16g the pending banner names the pounds stored on the payment",
      Boolean(banner?.amount.replace(/[^0-9.]/g, "").includes("1234.56")),
      banner?.amount ?? "no banner",
    );

    /* ================================================================ */
    /*  K15 · a partly covered radar session, abandoned (ME43)           */
    /* ================================================================ */

    const { payFromPot } = await import("../lib/billing/pot");
    const { sweepRadar } = await import("../lib/data/radar");
    const k15 = await cast("Sara", { enrolIn: sponsorA.id, type: "radar", createdAgo: "2 hours" });
    const potStart = await one<{ balance_cents: number }>(sql`SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsorA.id}`);
    const k15Spend = await payFromPot(k15.sessionId);
    const potSpent = await one<{ balance_cents: number }>(sql`SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsorA.id}`);
    check(
      "K15 CONTROL the company's share is taken at booking and a payment row exists, which kept the old sweep away",
      k15Spend.paid === true && potStart.balance_cents - potSpent.balance_cents === PRICE / 2,
      `${potStart.balance_cents} → ${potSpent.balance_cents}`,
    );
    const binned = await sweepRadar(k15.sessionId);
    const potBack = await one<{ balance_cents: number }>(sql`SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsorA.id}`);
    const k15Session = await one<{ status: string }>(sql`SELECT status FROM sessions WHERE id = ${k15.sessionId}`);
    check(
      "🔴 K15 abandoning it returns the company's share to its pot and cancels the session",
      binned.abandoned === 1 && k15Session.status === "cancelled" && potBack.balance_cents === potStart.balance_cents,
      JSON.stringify({ binned: binned.abandoned, status: k15Session.status, pot: potBack.balance_cents }),
    );
    const binnedAgain = await sweepRadar(k15.sessionId);
    const potStill = await one<{ balance_cents: number }>(sql`SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsorA.id}`);
    check(
      "K15 …once",
      binnedAgain.abandoned === 0 && potStill.balance_cents === potBack.balance_cents,
      String(potStill.balance_cents),
    );
    check(
      "🔴 K15 (ME44) a re-book on the radar gives the replaced hold's company share back too",
      /returnPotShareOfUnpaid\(previous/.test(readSource("app/(public)/radar/actions.ts")),
      "the previous hold used to be cancelled with the company's money still spent",
    );

    /* ================================================================ */
    /*  Where the pot went, keyed on the pot's own legs                  */
    /* ================================================================ */

    const { potTrace } = await import("../lib/console/pot-trace");
    const trace = await cast("Mona", { enrolIn: sponsorA.id });
    await payFromPot(trace.sessionId);
    /* The same person enrolled with a second company, and once before with the first. */
    await db.execute(sql`
      INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash, identifier_kind, last_verified_at)
      VALUES (${sponsorB.id}, ${trace.personId}, 'active', false, ${`Mona-B-${fixture}`}, 'domain_email', now())`);
    await db.execute(sql`
      INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash, identifier_kind, last_verified_at, removed_at, removal_reason)
      VALUES (${sponsorA.id}, ${trace.personId}, 'removed', false, ${`Mona-A-old-${fixture}`}, 'domain_email', now(), now(), 'left')`);
    const enrolledRows = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM enrolments WHERE person_id = ${trace.personId}`);
    const traceA = await potTrace(sponsorA.id);
    const traceB = await potTrace(sponsorB.id);
    check(
      "K-trace CONTROL the person has three enrolment rows, which the old join multiplied and crossed",
      enrolledRows.n === 3,
      String(enrolledRows.n),
    );
    check(
      "🔴 the pot trace lists a session once, under the company whose pot paid it, and never under another",
      traceA.rows.filter((r) => r.sessionId === trace.sessionId).length === 1 &&
        traceB.rows.filter((r) => r.sessionId === trace.sessionId).length === 0,
      JSON.stringify({ a: traceA.rows.filter((r) => r.sessionId === trace.sessionId).length, b: traceB.rows.filter((r) => r.sessionId === trace.sessionId).length }),
    );

    /* ================================================================ */
    /*  K20 · a booking cancelled while its transfer waited (PE24)       */
    /* ================================================================ */

    const { flagTransfersForCancelled } = await import("../lib/billing/rail-exceptions");
    const k20 = await cast("Aya");
    const k20Pay = await submitted(k20.sessionId, "K20");
    const flaggedEarly = await flagTransfersForCancelled(k20.sessionId);
    check("K20 CONTROL nothing is raised while the booking stands", flaggedEarly === 0, String(flaggedEarly));
    await db.execute(sql`UPDATE sessions SET status = 'cancelled', cancelled_by = 'patient', cancelled_at = now() WHERE id = ${k20.sessionId}`);
    await flagTransfersForCancelled(k20.sessionId);
    const k20Row = await one<{ state: string; exception: string | null; detail: string | null }>(sql`
      SELECT state, exception, exception_detail AS detail FROM manual_payments WHERE id = ${k20Pay.id}`);
    check(
      "🔴 K20 the waiting transfer is raised to staff at once, saying where the money will go",
      k20Row.state === "submitted" && k20Row.exception === "not_payable" && /patient's wallet/.test(k20Row.detail ?? ""),
      JSON.stringify(k20Row),
    );

    /* ---- the founder's decision: money that arrived goes to the wallet by default */

    const { walletBalanceCents: balanceOf } = await import("../lib/billing/wallet");
    const { refundTransferInstead, walletCreditedTransfers } = await import("../lib/billing/transfer-wallet");
    check(
      "K20 CONTROL nothing is in the wallet while the transfer is only submitted",
      (await balanceOf(k20.personId)) === 0,
      String(await balanceOf(k20.personId)),
    );
    const k20Confirm = await confirmPayment({ paymentId: k20Pay.id, byUserId: operator.id, onConfirmed: grantFor });
    const creditedOnce = await balanceOf(k20.personId);
    await flagTransfersForCancelled(k20.sessionId);
    await flagTransfersForCancelled();
    const k20After = await one<{ resolution: string | null; credits: number; wallet: number; cash: number; notices: number }>(sql`
      SELECT (SELECT exception_resolution FROM manual_payments WHERE id = ${k20Pay.id}) AS resolution,
             (SELECT count(*)::int FROM patient_credits WHERE person_id = ${k20.personId}) AS credits,
             (SELECT COALESCE(SUM(amount_cents), 0)::int FROM ledger_entries
               WHERE ref_type = 'patient_credit' AND account = 'patient_wallet'
                 AND ref_id IN (SELECT id FROM patient_credits WHERE person_id = ${k20.personId})) AS wallet,
             (SELECT COALESCE(SUM(amount_cents), 0)::int FROM ledger_entries
               WHERE ref_type = 'patient_credit' AND account = 'cash'
                 AND ref_id IN (SELECT id FROM patient_credits WHERE person_id = ${k20.personId})) AS cash,
             (SELECT count(*)::int FROM patient_notifications
               WHERE person_id = ${k20.personId} AND message_key = 'pnotice.walletCredited') AS notices`);
    check(
      "🔴 K20 confirming it credits the patient's wallet with what arrived, resolving the exception, books balanced",
      k20Confirm.walletCredited === true && creditedOnce === k20Pay.settlesCents &&
        (k20After.resolution ?? "").startsWith("Credited to the patient's wallet as credit ") &&
        k20After.wallet === -k20Pay.settlesCents && k20After.cash === k20Pay.settlesCents,
      JSON.stringify({ k20Confirm, creditedOnce, k20After }),
    );
    check(
      "🔴 K20 …once: the backstop run twice more credits nothing",
      k20After.credits === 1 && (await balanceOf(k20.personId)) === creditedOnce,
      JSON.stringify(k20After),
    );
    check(
      "🔴 K20 the patient is told, in the app (and by message), that it is in their wallet and can be refunded",
      k20After.notices === 1,
      `${k20After.notices} notices`,
    );

    /* A transfer already confirmed when the booking is cancelled: the hourly backstop credits it. */
    const k20b = await cast("Yasmin");
    const k20bPay = await submitted(k20b.sessionId, "K20B");
    await confirmPayment({ paymentId: k20bPay.id, byUserId: operator.id, onConfirmed: async () => {} });
    check("K20 CONTROL a confirmed transfer on a live booking is not credited", (await balanceOf(k20b.personId)) === 0, "0");
    await db.execute(sql`UPDATE sessions SET status = 'cancelled', cancelled_by = 'therapist', cancelled_at = now() WHERE id = ${k20b.sessionId}`);
    await flagTransfersForCancelled();
    check(
      "🔴 K20 a transfer that was already confirmed when the booking was cancelled goes to the wallet too",
      (await balanceOf(k20b.personId)) === k20bPay.settlesCents,
      String(await balanceOf(k20b.personId)),
    );

    /* Refund instead. */
    const shortReason = await refundTransferInstead({ paymentId: k20Pay.id, byUserId: operator.id, reason: "no" });
    check("K20 CONTROL refund instead needs a reason", Boolean(shortReason.error), JSON.stringify(shortReason));
    check(
      "K20 CONTROL the credited transfer is on the staff list with Refund instead",
      (await walletCreditedTransfers()).some((row) => row.id === k20Pay.id),
      "listed",
    );
    const instead = await refundTransferInstead({
      paymentId: k20Pay.id,
      byUserId: operator.id,
      reason: `The patient asked for a bank refund, ${fixture}`,
    });
    const insteadAgain = await refundTransferInstead({
      paymentId: k20Pay.id,
      byUserId: operator.id,
      reason: `The patient asked for a bank refund, ${fixture}`,
    });
    const reversed = await one<{ wallet: number; cash: number; refunds: number; amount: number }>(sql`
      SELECT (SELECT COALESCE(SUM(amount_cents), 0)::int FROM ledger_entries
               WHERE ref_type = 'patient_credit' AND account = 'patient_wallet'
                 AND ref_id IN (SELECT id FROM patient_credits WHERE person_id = ${k20.personId})) AS wallet,
             (SELECT COALESCE(SUM(amount_cents), 0)::int FROM ledger_entries
               WHERE ref_type = 'patient_credit' AND account = 'cash'
                 AND ref_id IN (SELECT id FROM patient_credits WHERE person_id = ${k20.personId})) AS cash,
             (SELECT count(*)::int FROM refund_requests WHERE manual_payment_id = ${k20Pay.id}) AS refunds,
             (SELECT COALESCE(MAX(amount_cents), 0)::int FROM refund_requests WHERE manual_payment_id = ${k20Pay.id}) AS amount`);
    check(
      "🔴 K20 Refund instead reverses the wallet credit on the books and queues ONE refund for the whole amount",
      instead.ok === true && Boolean(insteadAgain.error) && reversed.wallet === 0 && reversed.cash === 0 &&
        reversed.refunds === 1 && reversed.amount === k20Pay.settlesCents && (await balanceOf(k20.personId)) === 0,
      JSON.stringify({ instead, insteadAgain, reversed }),
    );
    await db.execute(sql`
      UPDATE patient_credits SET spent_cents = 100
       WHERE person_id = ${k20b.personId} AND from_session_id = ${k20b.sessionId}`);
    const afterSpend = await refundTransferInstead({
      paymentId: k20bPay.id,
      byUserId: operator.id,
      reason: `The patient asked for a bank refund, ${fixture}`,
    });
    const k20bRefunds = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM refund_requests WHERE manual_payment_id = ${k20bPay.id}`);
    check(
      "🔴 K20 Refund instead is refused once any of the wallet credit has been spent",
      Boolean(afterSpend.error) && k20bRefunds.n === 0,
      JSON.stringify(afterSpend),
    );

    /* Submitted and then rejected: nothing arrived, nothing moves. */
    const { rejectPayment } = await import("../lib/billing/manual");
    const k20c = await cast("Nadia");
    const k20cPay = await submitted(k20c.sessionId, "K20C");
    await db.execute(sql`UPDATE sessions SET status = 'cancelled', cancelled_by = 'patient', cancelled_at = now() WHERE id = ${k20c.sessionId}`);
    await flagTransfersForCancelled(k20c.sessionId);
    await rejectPayment({ paymentId: k20cPay.id, byUserId: operator.id, reason: "Nothing arrived in the account for this one." });
    await flagTransfersForCancelled();
    check(
      "🔴 K20 a transfer that was only submitted and then rejected credits nothing",
      (await balanceOf(k20c.personId)) === 0,
      String(await balanceOf(k20c.personId)),
    );
    check(
      "🔴 K20 every patient and clinician cancel path raises it, and the hourly job is the backstop",
      /flagTransfersForCancelled\(booking\.id\)/.test(readSource("lib/data/booking-change.ts")) &&
        /flagTransfersForCancelled\(cancelled\.sessionId\)/.test(readSource("lib/data/scheduling.ts")) &&
        /step\(failed, "flagTransfersForCancelled"/.test(readSource("app/api/cron/[job]/route.ts")),
      "patientCancel, cancelBooking and reminders",
    );

    /* ================================================================ */
    /*  K17 · renewal reminders, once per month per threshold (ME31)     */
    /* ================================================================ */

    const { sendRenewalReminders } = await import("../lib/billing/obligations");
    const soon = await one<{ id: string }>(sql`
      INSERT INTO renewal_obligations (organization_id, plan, amount_cents, currency, period_start, period_end, due_at, state)
      VALUES (${org.id}, 'practice', 8000, 'usd', now() + interval '60 hours', now() + interval '32 days', now() + interval '60 hours', 'due')
      RETURNING id`);
    const far = await one<{ id: string }>(sql`
      INSERT INTO renewal_obligations (organization_id, plan, amount_cents, currency, period_start, period_end, due_at, state)
      VALUES (${org.id}, 'practice', 8000, 'usd', now() + interval '40 days', now() + interval '70 days', now() + interval '40 days', 'due')
      RETURNING id`);
    await sendRenewalReminders(new Date(), org.id);
    await sendRenewalReminders(new Date(), org.id);
    const reminded = await one<{ soon: number[]; far: number[] }>(sql`
      SELECT (SELECT reminded_days FROM renewal_obligations WHERE id = ${soon.id}) AS soon,
             (SELECT reminded_days FROM renewal_obligations WHERE id = ${far.id}) AS far`);
    check(
      "🔴 K17 a month due in under three days is reminded at the 3-day threshold, once however often the job runs",
      JSON.stringify(reminded.soon) === "[3]",
      JSON.stringify(reminded.soon),
    );
    check("K17 CONTROL a month forty days out is not reminded", JSON.stringify(reminded.far) === "[]", JSON.stringify(reminded.far));
    await db.execute(sql`DELETE FROM renewal_obligations WHERE id IN (${soon.id}, ${far.id})`);

    /* ================================================================ */
    /*  ME20 · two chargers of one completed session                     */
    /* ================================================================ */

    const { chargeForSession } = await import("../lib/billing/service");
    const me20 = await cast("Dalia");
    await db.execute(sql`UPDATE sessions SET status = 'completed', ended_at = now(), started_at = now() - interval '50 minutes' WHERE id = ${me20.sessionId}`);
    const [first, secondCharge] = await Promise.all([
      chargeForSession({ organizationId: org.id, sessionId: me20.sessionId }),
      chargeForSession({ organizationId: org.id, sessionId: me20.sessionId }),
    ]);
    const invoicesFor = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM invoices WHERE session_id = ${me20.sessionId}`);
    check(
      "🔴 ME20 a completion and the reconciler racing charge the session once: one of them is refused before any money moves",
      invoicesFor.n === 1 && [first, secondCharge].filter((r) => r === null).length === 1,
      JSON.stringify({ first, second: secondCharge, invoices: invoicesFor.n }),
    );
    const third = await chargeForSession({ organizationId: org.id, sessionId: me20.sessionId });
    check("ME20 CONTROL …and a later call finds the invoice and does nothing", third === null, JSON.stringify(third));

    /* ================================================================ */
    /*  K26 · a billing run twice, and a step that throws                */
    /* ================================================================ */

    const route = readSource("app/api/cron/[job]/route.ts");
    check(
      "🔴 K26 (ME68) the booking release is a caught step, so a throw no longer stops webhooks and tax documents",
      /step\(failed, "releaseUnconfirmedBookings"/.test(route) && !/const released = await releaseUnconfirmedBookings\(now\);/.test(route),
      "it was the one call in the hourly job with no step",
    );
    check(
      "🔴 K26 (ME48) the one-person digest claims its day before it sends",
      /digest:one-hand/.test(readSource("lib/billing/approvals.ts")),
      "a second billing run sent it again",
    );

    /* ================================================================ */
    /*  The small ones                                                   */
    /* ================================================================ */

    const vault = readSource("lib/data/vault.ts");
    check(
      "🔴 MRR is each plan's price from settings, not 9900 per organisation holding credit",
      !/\* 9900/.test(vault) && /recurringMonthlyCents\(\)/.test(vault),
      "payingOrgs * 9900",
    );
    check(
      "the capital screen writes no audit line for setting nothing to zero",
      /if \(!existing && input\.amountCents === 0\) return \{ ok: true \};/.test(readSource("lib/data/capital.ts")),
      "zero for a month with no row",
    );
    check(
      "🔴 ME69 a company's payment notice goes to a live admin, never a viewer or a deleted login",
      /eq\(sponsorUsers\.role, "admin"\)/.test(readSource("lib/billing/payment-notices.ts")) &&
        /isNull\(sponsorUsers\.deletedAt\)/.test(readSource("lib/billing/payment-notices.ts")),
      "first sponsor user of any role",
    );
    /* ---------------------------------------- refunds that race, and repricing */

    const refundBody = connect2.slice(connect2.indexOf("export async function refundSessionPayment"), connect2.indexOf("/* ------------------------------------------------- releasing held earnings"));
    check(
      "🔴 ME9 two Stripe refunds of one payment send one refund and post one reversal",
      /idempotencyKey: `session-refund-\$\{payment\.id\}`/.test(refundBody) &&
        /eq\(sessionPayments\.status, "paid"\)\)\)\s*\.returning\(\{ id: sessionPayments\.id \}\);\s*if \(!claimedRefund\)/.test(refundBody),
      "the status move after Stripe had no guard",
    );
    check(
      "🔴 ME10 a gateway refund already in flight is not read as a failure to queue",
      /GATEWAY_REFUND_CLAIMED\) return \{ ok: true, toPayerCents: 0 \}/.test(refundBody),
      "every automatic caller queued an owed refund for money already on its way back",
    );
    check(
      "ME9/ME10 CONTROL the old lines fail those scans",
      !/GATEWAY_REFUND_CLAIMED\) return \{ ok: true/.test("if (viaGateway.error === GATEWAY_REFUND_CLAIMED) return { error: viaGateway.error };"),
      "watched failing",
    );
    check(
      "🔴 ME41 a destination checkout that would collect VAT is refused before anybody is charged",
      /if \(patientVatCents > 0\) \{[\s\S]{0,400}return \{/.test(checkout) &&
        checkout.indexOf("if (patientVatCents > 0)") < checkout.indexOf("client.checkout.sessions.create"),
      "postSessionPayment threw after Stripe had the money",
    );
    const recovery = readSource("lib/data/recovery.ts");
    check(
      "🔴 ME45 a reassignment between a US and an Egyptian practice books each leg on its own entity, and the cash crosses",
      /entity: fromEntity/.test(recovery) && /entity: toEntity/.test(recovery) && /fromEntity !== toEntity/.test(recovery),
      "the whole move took the first leg's entity",
    );
    check(
      "🔴 ME46 a card-paid (destination) session's money is not moved on books that never held it",
      /paid\.capture === "destination"/.test(recovery) && /paid && paid\.capture !== "destination"/.test(recovery),
      "the replacement's held balance went negative",
    );
    check(
      "🔴 ME70 the refund queue finds the pounds a pay-as-you-go session's transfer sent",
      /inArray\(manualPayments\.purpose, \["session", "payg_session"\]\)/.test(readSource("lib/billing/refunds.ts")),
      "only purpose session was looked up",
    );

    const { markPartnerMonthPaid } = await import("../lib/partner/billing");
    const notBilled = await markPartnerMonthPaid({
      partnerId: "00000000-0000-0000-0000-000000000000",
      periodStart: new Date(Date.UTC(2020, 0, 1)),
      reference: `REF-${fixture}`,
      byUserId: second.id,
    });
    check(
      "🔴 a partner month can be marked paid by staff, and only one that was billed",
      Boolean(notBilled.error) && /markMonthPaid/.test(readSource("app/(admin)/admin/partners/page.tsx")),
      JSON.stringify(notBilled),
    );
  } finally {
    /*
     * Keyed on the `mfix` prefix rather than this run's own tag, so a run that
     * died half way is swept by the next one. Sessions by organisation: the
     * radar sweep clears a join token, so a token pattern would miss them.
     */
    const orgs = sql`(SELECT id FROM organizations WHERE slug LIKE 'mfix%')`;
    const sponsorsOf = sql`(SELECT id FROM sponsors WHERE name LIKE 'Money Fixes Demo %')`;
    await db.execute(sql`DELETE FROM pending_approvals WHERE subject_id IN
      (SELECT id::text FROM manual_payments WHERE organization_id IN ${orgs})`);
    for (const id of approvalIds) await db.execute(sql`DELETE FROM pending_approvals WHERE id = ${id}`);
    await db.execute(sql`DELETE FROM pending_approvals WHERE reason LIKE 'Seen on the statement, mfix%'`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE memo LIKE '%mfix%'`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE ref_id IN ${sponsorsOf}`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE ref_type = 'patient_credit' AND ref_id IN
      (SELECT pc.id FROM patient_credits pc JOIN people p ON p.id = pc.person_id WHERE p.email LIKE '%.mfix%@example.com')`);
    await db.execute(sql`DELETE FROM refund_requests WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM manual_payments WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM manual_payments WHERE ref_id IN (SELECT id FROM sessions WHERE organization_id IN ${orgs})`);
    await db.execute(sql`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id IN ${orgs})`);
    await db.execute(sql`DELETE FROM invoices WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM session_payments WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM sponsor_money_entries WHERE sponsor_id IN ${sponsorsOf}`);
    await db.execute(sql`DELETE FROM renewal_obligations WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM sessions WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM enrolments WHERE identifier_hash LIKE '%-mfix%'`);
    await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id IN ${sponsorsOf}`);
    await db.execute(sql`DELETE FROM sponsors WHERE name LIKE 'Money Fixes Demo %'`);
    await db.execute(sql`DELETE FROM patients WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM people WHERE email LIKE '%.mfix%@example.com'`);
    await db.execute(sql`DELETE FROM subscriptions WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM users WHERE organization_id IN ${orgs}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug LIKE 'mfix%'`);
    await pool.end();
  }

  finish("the money fixes");
}

main();
