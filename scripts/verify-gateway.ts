/**
 * 🔴 64.1: THE EGYPTIAN CARD RAIL AND PAYOUTS PROVIDER, END TO END, ON THE SIMULATOR.
 *
 * Nothing here needs a contract. The simulator stands where a gateway and a
 * payouts provider will stand, signs its callbacks the way they will, and the
 * callbacks are delivered to the real routes. So what this proves is the whole
 * product around the adapter: the day an adapter is written, this runs against
 * it unchanged.
 *
 *   collection  checkout, a forged callback refused, a wrong amount refused,
 *               paid once however often it is said, the books, a refund through
 *               the gateway and the books back, a covered session's share, a
 *               payment for a cancelled session returned, a decline then a
 *               payer who comes back to a settled status read
 *   payouts     four eyes before sending, one instruction for two presses, a
 *               forged callback refused, a failure that leaves it approved to
 *               try again, "sent" that posts the ledger once
 *   readiness   nothing without an adapter; the simulator never on the live
 *               deployment
 */
process.env.EGYPT_GATEWAY = "fake";
process.env.EGYPT_PAYOUTS = "fake";
/*
 * 🔴 C23: the simulator has no built-in secret, so the run brings its own,
 * fresh each time, which is also what proves nothing depends on a constant.
 */
process.env.EGYPT_GATEWAY_HMAC = `verify-gw-${randomBytes(24).toString("hex")}`;
process.env.EGYPT_PAYOUTS_HMAC = `verify-po-${randomBytes(24).toString("hex")}`;

import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";

import { reporter, required, writesTo } from "./_verify";
import { connect } from "./db";
import { setRulesForThisCheck, TWO_PEOPLE_EVERYWHERE } from "./_rules";

const { check, finish } = reporter();
const fixture = `gw-${Date.now().toString(36)}`;
type Db = ReturnType<typeof connect>["db"];

async function one<T>(db: Db, text: ReturnType<typeof sql>): Promise<T> {
  return required((await db.execute(text)).rows[0] as T | undefined, "a planted row");
}

async function main() {
  writesTo();
  const { pool, db } = connect();

  const org = await one<{ id: string }>(db, sql`
    INSERT INTO organizations (name, region, slug) VALUES ('GW Demo Practice', 'eg', ${fixture}) RETURNING id`);
  const therapist = await one<{ id: string }>(db, sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
    VALUES (${org.id}, ${`nour.${fixture}@example.com`}, 'Nour', 'Demo', 'therapist', 'x') RETURNING id`);
  const staffA = await one<{ id: string }>(db, sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
    VALUES (${org.id}, ${`ops.a.${fixture}@example.com`}, 'Ops', 'A', 'staff', 'x') RETURNING id`);
  /* 🔴 Four eyes on every payout: B approves, A sends. */
  const staffB = await one<{ id: string }>(db, sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
    VALUES (${org.id}, ${`ops.b.${fixture}@example.com`}, 'Ops', 'B', 'staff', 'x') RETURNING id`);
  const sponsor = await one<{ id: string }>(db, sql`
    INSERT INTO sponsors (name, kind, entity, currency, state)
    VALUES (${`GW Co ${fixture}`}, 'company', 'us', 'USD', 'active') RETURNING id`);
  let n = 0;

  const person = async (first: string, enrol: boolean) => {
    n += 1;
    const p = await one<{ id: string }>(db, sql`
      INSERT INTO people (first_name, last_name, email, region)
      VALUES (${first}, 'Demo', ${`${first.toLowerCase()}${n}.${fixture}@example.com`}, 'eg') RETURNING id`);
    const patient = await one<{ id: string }>(db, sql`
      INSERT INTO patients (organization_id, person_id, first_name, last_name, email, source)
      VALUES (${org.id}, ${p.id}, ${first}, 'Demo', ${`${first.toLowerCase()}${n}.${fixture}@example.com`}, 'self')
      RETURNING id`);
    if (enrol) {
      await db.execute(sql`
        INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash,
                                identifier_kind, last_verified_at)
        VALUES (${sponsor.id}, ${p.id}, 'active', true, ${`${first}${n}-${fixture}`}, 'domain_email', now())`);
    }
    return patient.id;
  };
  const book = async (patientId: string, priceCents: number) => {
    n += 1;
    const token = `join-${n}-${fixture}`;
    const s = await one<{ id: string }>(db, sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            join_token, feedback_token, price_cents, payment_status, scheduled_at, guest_name)
      VALUES (${org.id}, ${therapist.id}, ${patientId}, 'scheduled', 'video', ${token},
              ${`fb-${n}-${fixture}`}, ${priceCents}, 'pending', now() + interval '2 hours', 'Salma Demo')
      RETURNING id`);
    return { sessionId: s.id, token };
  };
  const books = async () => {
    const rows = (
      await db.execute(sql`
        SELECT account, COALESCE(SUM(amount_cents), 0)::int AS total FROM ledger_entries
         WHERE organization_id = ${org.id} OR (ref_type = 'sponsor' AND ref_id = ${sponsor.id})
         GROUP BY account`)
    ).rows as { account: string; total: number }[];
    return Object.fromEntries(rows.map((r) => [r.account, Number(r.total)])) as Record<string, number>;
  };
  const moved = (a: Record<string, number>, b: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(b)
        .map(([k, v]) => [k, v - (a[k] ?? 0)] as const)
        .filter(([, d]) => d !== 0),
    );
  const unbalanced = async () =>
    (
      await db.execute(sql`
        SELECT txn_id FROM ledger_entries
         WHERE organization_id = ${org.id} OR (ref_type = 'sponsor' AND ref_id = ${sponsor.id})
         GROUP BY txn_id HAVING SUM(amount_cents) <> 0`)
    ).rows.length;
  const attempt = async (sessionId: string) =>
    (
      await db.execute(sql`
        SELECT * FROM gateway_payments WHERE ref_id = ${sessionId} ORDER BY created_at DESC LIMIT 1`)
    ).rows[0] as Record<string, unknown> | undefined;
  const status = async (sessionId: string) =>
    (
      (await db.execute(sql`SELECT payment_status FROM sessions WHERE id = ${sessionId}`)).rows[0] as {
        payment_status: string;
      }
    ).payment_status;

  try {
    const gw = await import("../lib/billing/gateway/session");
    const { signFake, SIGNATURE_HEADER, recordFakeOutcome } = await import("../lib/billing/gateway/fake");
    const { POST: gatewayRoute } = await import("../app/api/gateway/callback/route");
    const { POST: payoutsRoute } = await import("../app/api/payouts/callback/route");
    const { refundSessionPayment } = await import("../lib/billing/connect");

    const deliver = async (
      route: (r: Request) => Promise<Response>,
      kind: "collection" | "payouts",
      body: object,
      forge: boolean | ((rawBody: string) => string) = false,
    ) => {
      const rawBody = JSON.stringify(body);
      const header =
        typeof forge === "function" ? forge(rawBody) : forge ? "0".repeat(64) : signFake(kind, rawBody);
      const res = await route(
        new Request("http://localhost/callback", {
          method: "POST",
          headers: { [SIGNATURE_HEADER]: header },
          body: rawBody,
        }),
      );
      return res.status;
    };
    const paid = (a: Record<string, unknown>, amount = Number(a.amount_minor)) => ({
      providerRef: String(a.provider_ref),
      reference: String(a.id),
      outcome: "paid",
      transactionId: `fake_txn_${crypto.randomUUID()}`,
      amountMinor: amount,
      currency: "egp",
      failure: null,
    });

    /* ------------------------------------------------ 1. a full-price session */
    const patient1 = await person("Salma", false);
    const s1 = await book(patient1, 2_000);
    const before1 = await books();
    const opened = await gw.createGatewaySessionCheckout({
      sessionId: s1.sessionId,
      token: s1.token,
      payerName: "Salma Demo",
      payerEmail: "salma@example.com",
      payerPhone: null,
    });
    const a1 = await attempt(s1.sessionId);
    check(
      "64.1 a checkout opens on the gateway's own page, for what they owe plus VAT, in pounds",
      opened.ok && opened.url.includes("/dev/gateway/") && Boolean(a1) && Number(a1!.usd_cents) === 2_280,
      JSON.stringify({ opened, usd: a1?.usd_cents, egp: a1?.amount_minor }),
    );

    const forged = await deliver(gatewayRoute, "collection", paid(a1!), true);
    const wrong = await deliver(gatewayRoute, "collection", paid(a1!, Number(a1!.amount_minor) - 100));
    check(
      "🔴 64.1 a forged 'paid' is refused at the door, and a paid event for the wrong amount changes nothing",
      forged === 400 && wrong === 200 && (await status(s1.sessionId)) === "pending" &&
        Object.keys(moved(before1, await books())).length === 0,
      JSON.stringify({ forged, wrong, status: await status(s1.sessionId) }),
    );

    /*
     * 🔴 C23: the simulator's callbacks could be forged on any deployment that
     * was not live, with a secret printed in the source, and replayed for ever.
     * Signed over a time with the environment's secret now: the old public
     * constant, a correct signature ten minutes old, and anything at all with
     * no secret set are each refused.
     */
    const { env: liveEnv } = await import("../lib/env");
    const { createHmac } = await import("node:crypto");
    const publicConstant = await deliver(gatewayRoute, "collection", paid(a1!), (raw) =>
      createHmac("sha256", "fake-gateway-development-secret").update(raw).digest("hex"),
    );
    const stale = await deliver(gatewayRoute, "collection", paid(a1!), (raw) =>
      signFake("collection", raw, new Date(Date.now() - 10 * 60 * 1000)),
    );
    const heldSecret = liveEnv.egyptGatewayHmac;
    Object.assign(liveEnv, { egyptGatewayHmac: "" });
    const { collectionGateway: gatewayNow } = await import("../lib/billing/gateway");
    const unconfigured = gatewayNow();
    const noSecret = await deliver(gatewayRoute, "collection", paid(a1!), () => `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`);
    let signedWithout = "signed";
    try {
      signFake("collection", "{}");
    } catch {
      signedWithout = "refused";
    }
    Object.assign(liveEnv, { egyptGatewayHmac: heldSecret });
    check(
      "🔴 C23 the old public secret, a stale signature and a deployment with no secret are each refused, and nothing moves",
      publicConstant === 400 && stale === 400 && noSecret === 404 && unconfigured === null &&
        signedWithout === "refused" && (await status(s1.sessionId)) === "pending" &&
        Object.keys(moved(before1, await books())).length === 0,
      JSON.stringify({ publicConstant, stale, noSecret, unconfigured: unconfigured?.name ?? null, signedWithout }),
    );

    const event1 = paid(a1!);
    const first = await deliver(gatewayRoute, "collection", event1);
    check(
      "C23 CONTROL …and the same event signed now with the environment's secret is taken",
      first === 200,
      JSON.stringify({ first }),
    );
    const again = await deliver(gatewayRoute, "collection", event1);
    const booked1 = moved(before1, await books());
    check(
      "🔴 64.1 CONTROL a signed 'paid' settles the session once, however often it is said, so the forged refusal above is not a blanket one",
      first === 200 && again === 200 && (await status(s1.sessionId)) === "paid" &&
        (await attempt(s1.sessionId))!.state === "paid",
      JSON.stringify({ first, again }),
    );
    check(
      "64.1 …and books it as held Egyptian money: price and VAT in, VAT owed, our fee, the clinician's share",
      booked1.cash === 2_280 && booked1.vat_payable === -280 && booked1.platform_revenue === -300 &&
        booked1.therapist_payable === -1_700 && (await unbalanced()) === 0,
      JSON.stringify(booked1),
    );

    const payment1 = (
      await db.execute(sql`SELECT id FROM session_payments WHERE session_id = ${s1.sessionId}`)
    ).rows[0] as { id: string };
    const r1 = await refundSessionPayment({ paymentId: payment1.id, reason: "64.1 refund", adminUserId: null });
    check(
      "🔴 64.1 a refund goes back through the gateway, the attempt says so, and every account is back",
      Boolean(r1.ok) && (await attempt(s1.sessionId))!.state === "refunded" &&
        Object.keys(moved(before1, await books())).length === 0 && (await unbalanced()) === 0,
      JSON.stringify({ r1, moved: moved(before1, await books()) }),
    );

    /* -------------------------------------------- 2. a half-covered session */
    const { openPot } = await import("../lib/data/sponsor-admin");
    await openPot({
      sponsorId: sponsor.id,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      overdraftCents: 0,
      welcomeCreditCents: 0,
    });
    await db.execute(sql`UPDATE sponsor_pots SET balance_cents = 50000, coverage_bps = 5000 WHERE sponsor_id = ${sponsor.id}`);
    const patient2 = await person("Mariam", true);
    const s2 = await book(patient2, 2_000);
    const before2 = await books();
    const { payFromPot } = await import("../lib/billing/pot");
    await payFromPot(s2.sessionId);
    await gw.createGatewaySessionCheckout({
      sessionId: s2.sessionId,
      token: s2.token,
      payerName: "Mariam Demo",
      payerEmail: null,
      payerPhone: null,
    });
    const a2 = await attempt(s2.sessionId);
    await deliver(gatewayRoute, "collection", paid(a2!));
    const booked2 = moved(before2, await books());
    check(
      "🔴 64.1 a covered employee pays only their half plus its VAT, and the session is paid once both are in",
      Number(a2!.usd_cents) === 1_140 && (await status(s2.sessionId)) === "paid" &&
        booked2.vat_payable === -140 && booked2.therapist_payable === -1_700 && (await unbalanced()) === 0,
      JSON.stringify({ usd: a2?.usd_cents, booked2 }),
    );
    const payment2 = (
      await db.execute(sql`SELECT id FROM session_payments WHERE session_id = ${s2.sessionId}`)
    ).rows[0] as { id: string };
    const r2 = await refundSessionPayment({ paymentId: payment2.id, reason: "64.1 split", adminUserId: null });
    const after2 = moved(before2, await books());
    check(
      "64.1 …and refunded, the company's half goes back to its pot and theirs back through the gateway",
      Boolean(r2.ok) && (await attempt(s2.sessionId))!.state === "refunded" &&
        Object.keys(after2).length === 0 && (await unbalanced()) === 0,
      JSON.stringify({ r2, after2 }),
    );

    /* ------------------------------------ 3. paid after the session was cancelled */
    const patient3 = await person("Yara", false);
    const s3 = await book(patient3, 2_000);
    await gw.createGatewaySessionCheckout({ sessionId: s3.sessionId, token: s3.token, payerName: "Yara Demo", payerEmail: null, payerPhone: null });
    await db.execute(sql`UPDATE sessions SET status = 'cancelled' WHERE id = ${s3.sessionId}`);
    const before3 = await books();
    const a3 = await attempt(s3.sessionId);
    await deliver(gatewayRoute, "collection", paid(a3!));
    check(
      "🔴 64.1 money for a session cancelled while the card page was open goes straight back, and books nothing",
      (await attempt(s3.sessionId))!.state === "refunded" && (await status(s3.sessionId)) !== "paid" &&
        Object.keys(moved(before3, await books())).length === 0,
      JSON.stringify({ state: (await attempt(s3.sessionId))?.state }),
    );

    /* ------------------------------- 4. declined, then the payer comes back to a settled status */
    const patient4 = await person("Hoda", false);
    const s4 = await book(patient4, 2_000);
    await gw.createGatewaySessionCheckout({ sessionId: s4.sessionId, token: s4.token, payerName: "Hoda Demo", payerEmail: null, payerPhone: null });
    const a4 = await attempt(s4.sessionId);
    await deliver(gatewayRoute, "collection", { ...paid(a4!), outcome: "failed", transactionId: null, failure: "declined" });
    const declined = (await attempt(s4.sessionId))!.state;
    recordFakeOutcome(paid(a4!) as never);
    await gw.confirmGatewayReturn(String(a4!.id));
    check(
      "64.1 a decline leaves them owing; a payer who comes back after paying is settled by asking the gateway",
      declined === "failed" && (await status(s4.sessionId)) === "paid",
      JSON.stringify({ declined, status: await status(s4.sessionId) }),
    );

    /* --------------------------------------------------------------- payouts */
    const txn = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO ledger_entries (txn_id, txn_kind, account, organization_id, user_id, amount_cents, ref_type, memo)
      VALUES (${txn}, 'session_payment', 'cash', ${org.id}, NULL, 10000, 'session_payment', 'gw: in'),
             (${txn}, 'session_payment', 'therapist_payable', ${org.id}, ${therapist.id}, -10000, 'session_payment', 'gw: owed')`);
    await db.execute(sql`
      INSERT INTO payout_methods (therapist_id, organization_id, method, identifier, account_name, is_default)
      VALUES (${therapist.id}, ${org.id}, 'wallet', '01000000000', 'Nour Demo', true)`);
    const { requestPayout, approvePayout, sendViaProvider, markPayoutSent } = await import("../lib/billing/payouts");
    const asked = await requestPayout({ therapistId: therapist.id, organizationId: org.id, amountCents: 5_000 });
    const requestId = asked.id ?? "";
    await approvePayout({ requestId, approverUserId: staffB.id });

    const byPayee = await sendViaProvider({ requestId, senderUserId: therapist.id });
    const firstSend = await sendViaProvider({ requestId, senderUserId: staffA.id });
    const secondSend = await sendViaProvider({ requestId, senderUserId: staffA.id });
    const byHand = await markPayoutSent({ requestId, senderUserId: staffA.id, proofUrl: "https://example.com/r" });
    const row = async () =>
      (await db.execute(sql`SELECT * FROM payout_requests WHERE id = ${requestId}`)).rows[0] as Record<string, unknown>;
    check(
      "🔴 64.1 the payee cannot send their own payout; two presses make one instruction; nobody marks it sent by hand meanwhile",
      Boolean(byPayee.error) && Boolean(firstSend.ok) && Boolean(secondSend.error) && Boolean(byHand.error) &&
        (await row()).provider_state === "sending",
      JSON.stringify({ byPayee, firstSend, secondSend, byHand }),
    );

    const before5 = await books();
    const sending = await row();
    const payoutEvent = { providerRef: String(sending.provider_ref), reference: requestId, outcome: "failed", failure: "wallet closed" };
    const forgedPayout = await deliver(payoutsRoute, "payouts", { ...payoutEvent, outcome: "sent" }, true);
    await deliver(payoutsRoute, "payouts", payoutEvent);
    const failedRow = await row();
    check(
      "🔴 64.1 a forged 'sent' is refused; a failure leaves it approved with the reason, and nothing posted",
      forgedPayout === 400 && failedRow.status === "approved" && failedRow.provider_state === "failed" &&
        Object.keys(moved(before5, await books())).length === 0,
      JSON.stringify({ forgedPayout, status: failedRow.status, state: failedRow.provider_state }),
    );

    await sendViaProvider({ requestId, senderUserId: staffA.id });
    const resent = await row();
    const sentEvent = { providerRef: String(resent.provider_ref), reference: requestId, outcome: "sent", failure: null };
    await deliver(payoutsRoute, "payouts", sentEvent);
    await deliver(payoutsRoute, "payouts", sentEvent);
    const done = await row();
    const paidOut = moved(before5, await books());
    check(
      "🔴 64.1 'sent' is Mark sent: the request is sent, the ledger posts the payout once, and the books balance",
      done.status === "sent" && done.provider_state === "sent" && paidOut.therapist_payable === 5_000 &&
        paidOut.cash === -5_000 && (await unbalanced()) === 0,
      JSON.stringify({ status: done.status, paidOut }),
    );

    /* ------------------------------------------------------------- readiness */
    const { env } = await import("../lib/env");
    const { collectionGateway, payoutProvider, whatTheGatewayNeeds } = await import("../lib/billing/gateway");
    const saved = { g: env.egyptGateway, live: env.liveDeployment };
    Object.assign(env, { egyptGateway: "" });
    const none = collectionGateway();
    const needs = whatTheGatewayNeeds();
    Object.assign(env, { egyptGateway: "fake", liveDeployment: true });
    const onLive = collectionGateway();
    const payoutsOnLive = payoutProvider();
    Object.assign(env, { egyptGateway: "somegateway", liveDeployment: false });
    const noAdapter = whatTheGatewayNeeds();
    Object.assign(env, { egyptGateway: saved.g, liveDeployment: saved.live });
    check(
      "🔴 64.1 no adapter means no card rail and a sentence saying why; the simulator is refused on the live deployment",
      none === null && needs.length === 1 && onLive === null && payoutsOnLive === null &&
        noAdapter.some((line) => line.includes("no adapter")),
      JSON.stringify({ needs, noAdapter }),
    );
  } finally {
    await db.execute(sql`DELETE FROM payout_request_events WHERE request_id IN (SELECT id FROM payout_requests WHERE organization_id = ${org.id})`);
    await db.execute(sql`DELETE FROM payout_requests WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM payout_methods WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM gateway_payments WHERE ref_id IN (SELECT id FROM sessions WHERE organization_id = ${org.id})`);
    await db.execute(sql`DELETE FROM refund_requests WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE ref_type = 'sponsor' AND ref_id = ${sponsor.id}`);
    await db.execute(sql`DELETE FROM sponsor_money_entries WHERE sponsor_id = ${sponsor.id}`).catch(() => undefined);
    await db.execute(sql`DELETE FROM session_payments WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM sessions WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM enrolments WHERE sponsor_id = ${sponsor.id}`);
    const people = (await db.execute(sql`SELECT person_id FROM patients WHERE organization_id = ${org.id}`)).rows as { person_id: string }[];
    await db.execute(sql`DELETE FROM patients WHERE organization_id = ${org.id}`);
    for (const p of people) await db.execute(sql`DELETE FROM people WHERE id = ${p.person_id}`);
    await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);
    await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsor.id})`);
    await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsor.id})`);
    await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsor.id})`);
    await db.execute(sql`DELETE FROM sponsors WHERE id = ${sponsor.id}`);
    await db.execute(sql`DELETE FROM audit_log WHERE actor_user_id IN (SELECT id FROM users WHERE organization_id = ${org.id})`).catch(() => undefined);
    await db.execute(sql`DELETE FROM users WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM organizations WHERE id = ${org.id}`);
    await pool.end();
  }

  finish("64.1 gateway");
}

/* 🔴 0161: these checks were written for two people on every queue, so they say so. */
/* …and the VAT legs are part of what it proves, so it runs on the country rate (ruling 2 is proven in verify:rules). */
setRulesForThisCheck({ ...TWO_PEOPLE_EVERYWHERE, tax: { sessionVat: "standard" } });

void main();
