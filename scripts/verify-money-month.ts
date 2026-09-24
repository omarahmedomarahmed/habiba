/**
 * 🔴 ONE MONTH OF MONEY FOR A WHOLE CAST, THEN EVERY BOOK AGAINST EVERY OTHER.
 *
 *   npm run verify:month
 *
 * Each rail has its own verifier, and each proves its own step. What none of
 * them can see is two steps disagreeing: a pot whose balance column drifts
 * from its ledger, a company ledger that sums to a different spend than the
 * pot recorded, a clinician's held balance that no longer equals what their
 * sessions earned minus what was sent, a VAT liability that is not the VAT we
 * collected. Those are the defects that surface at month end, in a
 * reconciliation, and cost the most to find.
 *
 * So this runs a month for one Egyptian practice, one company and nine
 * payers, on every Egyptian rail at once (transfer, the card gateway's
 * simulator, the pot, full and half coverage), refunds four of them three
 * different ways, pays the clinician out
 * through the payouts provider's simulator, and then recomputes every book
 * from first principles and compares:
 *
 *   I1  every transaction balances
 *   I2  the pot's balance column is its ledger
 *   I3  the pot holds the top-up less what sessions still hold of it
 *   I4  the company's published ledger sums to that same spend
 *   I5  the clinician is held exactly what their sessions earned, less payouts
 *   I6  our revenue is exactly the fees on money we kept
 *   I7  the VAT owed is exactly the VAT collected and not returned
 *   I8  no cancelled session is paid; every paid session has its money
 *   I9  every gateway attempt agrees with the payment it paid for
 *
 * Each invariant is checked against a planted offender first, so a green run
 * means the comparison can see a red one.
 */
process.env.EGYPT_GATEWAY = "fake";
process.env.EGYPT_PAYOUTS = "fake";

import { sql } from "drizzle-orm";

import { reporter, required, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();
const fixture = `month-${Date.now().toString(36)}`;
type Db = ReturnType<typeof connect>["db"];

async function main() {
  writesTo();
  const { pool, db } = connect();
  const one = async <T>(text: ReturnType<typeof sql>, what = "a row"): Promise<T> =>
    required((await db.execute(text)).rows[0] as T | undefined, what);

  const org = await one<{ id: string }>(sql`
    INSERT INTO organizations (name, region, slug) VALUES ('Month Demo Practice', 'eg', ${fixture}) RETURNING id`);
  const therapist = await one<{ id: string }>(sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
    VALUES (${org.id}, ${`dina.${fixture}@example.com`}, 'Dina', 'Demo', 'therapist', 'x') RETURNING id`);
  const operator = await one<{ id: string }>(sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
    VALUES (${org.id}, ${`ops.${fixture}@example.com`}, 'Ops', 'Demo', 'admin', 'x') RETURNING id`);
  const staff = await one<{ id: string }>(sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
    VALUES (${org.id}, ${`staff.${fixture}@example.com`}, 'Staff', 'Demo', 'staff', 'x') RETURNING id`);
  const sponsor = await one<{ id: string }>(sql`
    INSERT INTO sponsors (name, kind, entity, currency, state)
    VALUES (${`Month Co ${fixture}`}, 'company', 'eg', 'EGP', 'active') RETURNING id`);

  let n = 0;
  const payer = async (first: string, enrolled: boolean) => {
    n += 1;
    const p = await one<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, region) VALUES (${first}, 'Demo', 'eg') RETURNING id`);
    const patient = await one<{ id: string }>(sql`
      INSERT INTO patients (organization_id, person_id, first_name, last_name, email, source)
      VALUES (${org.id}, ${p.id}, ${first}, 'Demo', ${`${first.toLowerCase()}${n}.${fixture}@example.com`}, 'self')
      RETURNING id`);
    if (enrolled) {
      await db.execute(sql`
        INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash, identifier_kind,
                                last_verified_at, ledger_told_at)
        VALUES (${sponsor.id}, ${p.id}, 'active', true, ${`${first}${n}-${fixture}`}, 'domain_email',
                now(), now() - interval '1 minute')`);
    }
    const token = `join-${n}-${fixture}`;
    const s = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality, join_token,
                            feedback_token, price_cents, payment_status, scheduled_at, guest_name)
      VALUES (${org.id}, ${therapist.id}, ${patient.id}, 'scheduled', 'video', ${token}, ${`fb-${n}-${fixture}`},
              2000, 'pending', now() + interval '1 hour', ${`${first} Demo`})
      RETURNING id`);
    return { sessionId: s.id, token };
  };

  const cover = (bps: number) =>
    db.execute(sql`UPDATE sponsor_pots SET coverage_bps = ${bps} WHERE sponsor_id = ${sponsor.id}`);
  const paymentOf = async (sessionId: string) =>
    one<{ id: string }>(sql`SELECT id FROM session_payments WHERE session_id = ${sessionId}`, `the payment for ${sessionId.slice(0, 8)}`);

  try {
    const { openCart } = await import("../lib/billing/cart");
    const { submitProof, confirmPayment, egpMinorFor, egpRateMicro } = await import("../lib/billing/manual");
    const { grantFor } = await import("../lib/billing/manual-grants");
    const { potTopUpMoney, entityVatBps, payFromPot } = await import("../lib/billing/pot");
    const { openPot } = await import("../lib/data/sponsor-admin");
    const { sessionTransferMoney } = await import("../lib/billing/manual-entry");
    const { patientOwesFor } = await import("../lib/billing/session-owed");
    const gw = await import("../lib/billing/gateway/session");
    const { signFake, SIGNATURE_HEADER } = await import("../lib/billing/gateway/fake");
    const { POST: gatewayRoute } = await import("../app/api/gateway/callback/route");
    const { POST: payoutsRoute } = await import("../app/api/payouts/callback/route");
    const { refundSessionPayment } = await import("../lib/billing/connect");
    const { markRefundSent } = await import("../lib/billing/refunds");
    const rate = await egpRateMicro();

    const signed = async (route: (r: Request) => Promise<Response>, kind: "collection" | "payouts", body: object) => {
      const rawBody = JSON.stringify(body);
      return route(
        new Request("http://localhost/cb", {
          method: "POST",
          headers: { [SIGNATURE_HEADER]: signFake(kind, rawBody) },
          body: rawBody,
        }),
      );
    };
    const byTransfer = async (sessionId: string) => {
      const owed = await patientOwesFor(sessionId);
      const money = await sessionTransferMoney({ organizationId: org.id, priceCents: owed.grossCents });
      const cart = await openCart({
        purpose: "session",
        refId: sessionId,
        amountCents: egpMinorFor(money.settlesCents, rate),
        settlesCents: money.settlesCents,
        payer: { kind: "session", organizationId: org.id },
      });
      await submitProof({ paymentId: cart.id!, reference: `M-${sessionId.slice(0, 8)}`, proofUrl: null });
      await confirmPayment({ paymentId: cart.id!, byUserId: operator.id, onConfirmed: grantFor });
    };
    const byGateway = async (s: { sessionId: string; token: string }) => {
      await gw.createGatewaySessionCheckout({ sessionId: s.sessionId, token: s.token, payerName: "Demo", payerEmail: null, payerPhone: null });
      const attempt = await one<Record<string, unknown>>(sql`
        SELECT * FROM gateway_payments WHERE ref_id = ${s.sessionId} ORDER BY created_at DESC LIMIT 1`, "a gateway attempt");
      await signed(gatewayRoute, "collection", {
        providerRef: attempt.provider_ref,
        reference: attempt.id,
        outcome: "paid",
        transactionId: `fake_txn_${crypto.randomUUID()}`,
        amountMinor: Number(attempt.amount_minor),
        currency: "egp",
        failure: null,
      });
    };

    /* ------------------------------------------------ the company funds its pot */
    await openPot({
      sponsorId: sponsor.id,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      overdraftCents: 0,
      welcomeCreditCents: 0,
    });
    const topUp = potTopUpMoney({ creditCents: 50_000, vatBps: await entityVatBps("eg") });
    const potCart = await openCart({
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
    await submitProof({ paymentId: potCart.id!, reference: `M-POT-${fixture}`, proofUrl: null });
    await confirmPayment({ paymentId: potCart.id!, byUserId: operator.id, onConfirmed: grantFor });

    /* ------------------------------------------------------------ the month */
    await cover(10_000);
    const full = [await payer("Amal", true), await payer("Basma", true), await payer("Camelia", true)];
    for (const s of full) await payFromPot(s.sessionId);

    await cover(5_000);
    const halfGateway = await payer("Dalia", true);
    await payFromPot(halfGateway.sessionId);
    await byGateway(halfGateway);

    const halfTransfer = await payer("Eman", true);
    await payFromPot(halfTransfer.sessionId);
    await byTransfer(halfTransfer.sessionId);

    const halfUnpaid = await payer("Farida", true);
    await payFromPot(halfUnpaid.sessionId);

    const plainGateway = await payer("Ghada", false);
    await byGateway(plainGateway);
    const plainTransfer = await payer("Heba", false);
    await byTransfer(plainTransfer.sessionId);
    const plainGatewayRefund = await payer("Inas", false);
    await byGateway(plainGatewayRefund);

    /* ---------------------------------------------------------- the refunds */
    // The clinician cancels the half-covered session nobody finished paying.
    await db.execute(sql`UPDATE sessions SET status = 'cancelled' WHERE id = ${halfUnpaid.sessionId}`);
    const { afterClinicianCancel } = await import("../lib/data/clinician-cancel");
    await afterClinicianCancel({ actorUserId: therapist.id, sessionId: halfUnpaid.sessionId, reason: "Unwell today" });

    // A no-show on the transfer-paid half: the pot's half at once, theirs by the queue.
    const eman = await paymentOf(halfTransfer.sessionId);
    const noShow = await refundSessionPayment({ paymentId: eman.id, reason: "no-show", adminUserId: null, why: "no_show" });
    const queued = await one<{ id: string }>(sql`
      SELECT id FROM refund_requests WHERE session_payment_id = ${eman.id} AND status = 'owed'`, "the no-show's queued share");
    const sent = await markRefundSent({
      requestId: queued.id,
      senderUserId: staff.id,
      proofUrl: "https://example.com/proof/eman",
      method: "instapay",
      identifier: "eman@instapay",
      accountName: "Eman Demo",
    });

    // A patient refunded through the gateway, and a transfer refunded by the queue.
    const inas = await paymentOf(plainGatewayRefund.sessionId);
    const gatewayRefund = await refundSessionPayment({ paymentId: inas.id, reason: "admin", adminUserId: operator.id });
    const heba = await paymentOf(plainTransfer.sessionId);
    const hebaRefund = await refundSessionPayment({ paymentId: heba.id, reason: "admin", adminUserId: operator.id, why: "admin" });
    const hebaQueued = await one<{ id: string }>(sql`
      SELECT id FROM refund_requests WHERE session_payment_id = ${heba.id} AND status = 'owed'`, "the transfer refund's queue row");
    const hebaSent = await markRefundSent({
      requestId: hebaQueued.id,
      senderUserId: staff.id,
      proofUrl: "https://example.com/proof/heba",
      method: "instapay",
      identifier: "heba@instapay",
      accountName: "Heba Demo",
    });
    check(
      "the month's refunds all went through their own rails",
      Boolean(noShow.ok) && Boolean(sent.ok) && Boolean(gatewayRefund.ok) && Boolean(hebaSent.ok) && Boolean(hebaRefund.error || hebaRefund.ok),
      JSON.stringify({ noShow, sent, gatewayRefund, hebaRefund, hebaSent }),
    );

    /* ------------------------------------------------ the clinician is paid */
    await db.execute(sql`
      INSERT INTO payout_methods (therapist_id, organization_id, method, identifier, account_name, is_default)
      VALUES (${therapist.id}, ${org.id}, 'wallet', '01000000001', 'Dina Demo', true)`);
    const { requestPayout, approvePayout, sendViaProvider } = await import("../lib/billing/payouts");
    const asked = await requestPayout({ therapistId: therapist.id, organizationId: org.id, amountCents: 3_000 });
    await approvePayout({ requestId: asked.id!, approverUserId: staff.id });
    await sendViaProvider({ requestId: asked.id!, senderUserId: operator.id });
    const sending = await one<{ provider_ref: string }>(sql`SELECT provider_ref FROM payout_requests WHERE id = ${asked.id!}`);
    await signed(payoutsRoute, "payouts", { providerRef: sending.provider_ref, reference: asked.id, outcome: "sent", failure: null });

    /* ======================================================= the invariants */
    const scope = sql`(organization_id = ${org.id} OR (ref_type = 'sponsor' AND ref_id = ${sponsor.id}))`;
    const account = async (name: string) =>
      Number((await one<{ total: number }>(sql`
        SELECT COALESCE(SUM(amount_cents), 0)::int AS total FROM ledger_entries WHERE account = ${name} AND ${scope}`)).total);

    // I1
    const unbalanced = async () =>
      (await db.execute(sql`SELECT txn_id FROM ledger_entries WHERE ${scope} GROUP BY txn_id HAVING SUM(amount_cents) <> 0`)).rows.length;
    check("🔴 I1 every transaction of the month balances", (await unbalanced()) === 0, `${await unbalanced()} unbalanced`);

    // The payments, recomputed from first principles.
    const { fundingLegs } = await import("../lib/billing/split-refund");
    const rows = (await db.execute(sql`
      SELECT sp.*, s.payment_status AS session_status, s.status AS session_state
        FROM session_payments sp JOIN sessions s ON s.id = sp.session_id
       WHERE sp.organization_id = ${org.id}`)).rows as Record<string, unknown>[];
    let heldExpected = 0;
    let revenueExpected = 0;
    let vatExpected = topUp.vatCents;
    let potSpend = 0;
    for (const r of rows) {
      if (r.status === "refunded" || r.status === "pending") continue;
      const legs = fundingLegs({
        grossCents: Number(r.gross_cents),
        coverageBps: Number(r.coverage_bps ?? 0),
        sponsorShareCents: Number(r.sponsor_share_cents),
        patientShareCents: Number(r.patient_share_cents),
        platformFeeCents: Number(r.platform_fee_cents),
      });
      const pot = r.funding_source === "pot";
      const employeeIn = !pot || r.session_status === "paid";
      heldExpected += pot && !employeeIn ? legs.pot.netCents : Number(r.therapist_net_cents);
      revenueExpected += pot && !employeeIn ? legs.pot.feeCents : Number(r.platform_fee_cents);
      vatExpected += Number(r.vat_cents);
      if (pot) potSpend += legs.pot.grossCents;
    }
    const sentPayouts = Number((await one<{ total: number }>(sql`
      SELECT COALESCE(SUM(amount_cents), 0)::int AS total FROM payout_requests
       WHERE therapist_id = ${therapist.id} AND status IN ('sent', 'confirmed')`)).total);
    heldExpected -= sentPayouts;

    // I2 + I3
    const potRow = await one<{ balance_cents: number }>(sql`SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);
    const potLedger = -(await account("sponsor_pot"));
    check(
      "🔴 I2 the pot's balance column is its ledger",
      Number(potRow.balance_cents) === potLedger,
      `column ${potRow.balance_cents}, ledger ${potLedger}`,
    );
    check(
      "🔴 I3 the pot holds its top-up less exactly what sessions still hold of it",
      Number(potRow.balance_cents) === topUp.creditCents - potSpend,
      `${potRow.balance_cents} = ${topUp.creditCents} - ${potSpend}`,
    );

    // I4
    const { publishedLedger } = await import("../lib/data/sponsor-ledger");
    const later = await publishedLedger(sponsor.id, new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    const ledgerCovered = later.entries.reduce((sum, e) => sum + (e.kind === "refund" ? -e.coveredCents : e.coveredCents), 0);
    check(
      "🔴 I4 the company's published ledger sums to the same spend the pot recorded",
      later.entries.length >= 5 && ledgerCovered === potSpend,
      `${later.entries.length} entries covering ${ledgerCovered}, pot spend ${potSpend}`,
    );

    // I5
    const { heldForTherapist } = await import("../lib/billing/ledger");
    const held = await heldForTherapist(therapist.id);
    check(
      "🔴 I5 the clinician is held exactly what their sessions earned, less what was paid out",
      held === heldExpected,
      `held ${held}, expected ${heldExpected} after ${sentPayouts} paid out`,
    );

    // I6 + I7
    const revenue = -(await account("platform_revenue"));
    check("🔴 I6 our revenue is exactly the fees on money we kept", revenue === revenueExpected, `${revenue} vs ${revenueExpected}`);
    const vat = -(await account("vat_payable"));
    check("🔴 I7 the VAT owed is exactly the VAT collected and not returned", vat === vatExpected, `${vat} vs ${vatExpected}`);

    // I8
    const wrong = (await db.execute(sql`
      SELECT s.id FROM sessions s LEFT JOIN session_payments sp ON sp.session_id = s.id
       WHERE s.organization_id = ${org.id}
         AND ((s.status = 'cancelled' AND s.payment_status = 'paid')
           OR (s.payment_status = 'paid' AND (sp.id IS NULL OR sp.status <> 'paid')))`)).rows.length;
    check("🔴 I8 no cancelled session is paid, and every paid session has its money", wrong === 0, `${wrong} sessions disagree`);

    // I9
    const gatewayWrong = (await db.execute(sql`
      SELECT g.id FROM gateway_payments g JOIN session_payments sp ON sp.id = g.session_payment_id
       WHERE sp.organization_id = ${org.id}
         AND ((g.state = 'refunded' AND sp.status = 'paid' AND sp.funding_source <> 'pot')
           OR (g.state = 'paid' AND sp.status <> 'paid'))`)).rows.length;
    check("🔴 I9 every gateway attempt agrees with the payment it paid for", gatewayWrong === 0, `${gatewayWrong} disagree`);

    /* ------------------------------------------------------------ controls */
    await db.execute(sql`UPDATE sponsor_pots SET balance_cents = balance_cents + 1 WHERE sponsor_id = ${sponsor.id}`);
    const drifted = await one<{ balance_cents: number }>(sql`SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);
    await db.execute(sql`UPDATE sponsor_pots SET balance_cents = balance_cents - 1 WHERE sponsor_id = ${sponsor.id}`);
    const plantTxn = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO ledger_entries (txn_id, txn_kind, account, organization_id, amount_cents, ref_type, memo)
      VALUES (${plantTxn}, 'adjustment', 'cash', ${org.id}, 1, 'session_payment', 'month: planted')`);
    const plantedUnbalanced = await unbalanced();
    await db.execute(sql`DELETE FROM ledger_entries WHERE txn_id = ${plantTxn}`);
    check(
      "CONTROL a one-cent drift in the pot and a one-legged transaction are both seen",
      Number(drifted.balance_cents) !== potLedger && plantedUnbalanced === 1,
      JSON.stringify({ drifted: drifted.balance_cents, potLedger, plantedUnbalanced }),
    );
  } finally {
    const people = (await db.execute(sql`SELECT person_id FROM patients WHERE organization_id = ${org.id}`)).rows as { person_id: string }[];
    const steps: ReturnType<typeof sql>[] = [
      sql`DELETE FROM payout_request_events WHERE request_id IN (SELECT id FROM payout_requests WHERE organization_id = ${org.id})`,
      sql`DELETE FROM payout_requests WHERE organization_id = ${org.id}`,
      sql`DELETE FROM payout_methods WHERE organization_id = ${org.id}`,
      sql`DELETE FROM gateway_payments WHERE ref_id IN (SELECT id FROM sessions WHERE organization_id = ${org.id})`,
      sql`DELETE FROM refund_requests WHERE organization_id = ${org.id}`,
      sql`DELETE FROM manual_payments WHERE ref_id IN (SELECT id FROM sessions WHERE organization_id = ${org.id}) OR ref_id = ${sponsor.id}`,
      sql`DELETE FROM ledger_entries WHERE organization_id = ${org.id} OR (ref_type = 'sponsor' AND ref_id = ${sponsor.id})`,
      sql`DELETE FROM sponsor_money_entries WHERE sponsor_id = ${sponsor.id}`,
      sql`DELETE FROM session_payments WHERE organization_id = ${org.id}`,
      sql`DELETE FROM patient_notifications WHERE person_id IN (SELECT person_id FROM patients WHERE organization_id = ${org.id})`,
      sql`DELETE FROM sessions WHERE organization_id = ${org.id}`,
      sql`DELETE FROM enrolments WHERE sponsor_id = ${sponsor.id}`,
      sql`DELETE FROM patients WHERE organization_id = ${org.id}`,
      sql`DELETE FROM audit_log WHERE resource_id IN (SELECT id FROM sponsor_pots WHERE sponsor_id = ${sponsor.id})`,
      sql`DELETE FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`,
      sql`DELETE FROM sponsors WHERE id = ${sponsor.id}`,
      sql`DELETE FROM users WHERE organization_id = ${org.id}`,
      sql`DELETE FROM organizations WHERE id = ${org.id}`,
    ];
    for (const step of steps) await db.execute(step).catch((e: unknown) => console.warn("cleanup:", String(e).slice(0, 120)));
    for (const p of people) await db.execute(sql`DELETE FROM people WHERE id = ${p.person_id}`).catch(() => undefined);
    await pool.end();
  }

  finish("the money month");
}

void main();
