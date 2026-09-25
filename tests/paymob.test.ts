import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";

import { env } from "../lib/env";
import {
  PAYMOB_GATEWAY,
  PAYMOB_PAYOUTS,
  forgetPaymobTokens,
  paymobCollectionNeeds,
  paymobPayoutsNeeds,
} from "../lib/billing/gateway/paymob";
import { cardFeeMinorFor, RULES_DEFAULTS } from "../lib/settings/defs";

/**
 * 🔴 Rulings 12 and 13b: the Paymob adapters, against a mocked `fetch`.
 *
 * No key exists yet, so nothing here reaches Paymob. What it proves is our
 * half: the requests are the shape Paymob's documents describe, a callback is
 * believed only when its HMAC verifies, a refund and a payout say what
 * happened, and a token is bought once and reused. The lines the documents
 * leave open are marked `PAYMOB-CONFIRM:` in the adapter, for the sandbox run.
 *
 * Every key below is a made-up test value, never a real one.
 */

type Call = { url: string; method: string; headers: Record<string, string>; body: string };
let calls: Call[] = [];
let answers: ((call: Call) => Response)[] = [];
const realFetch = globalThis.fetch;
const saved = { ...env };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  calls = [];
  answers = [];
  forgetPaymobTokens();
  Object.assign(env, {
    liveDeployment: false,
    paymobSecretKey: "sk_test_example",
    paymobPublicKey: "pk_test_example",
    paymobIntegrationId: "4567",
    paymobHmacSecret: "hmac_test_example",
    paymobApiKey: "api_test_example",
    paymobBaseUrl: "",
    paymobPayoutsClientId: "client_example",
    paymobPayoutsClientSecret: "client_secret_example",
    paymobPayoutsUsername: "api_user_example",
    paymobPayoutsPassword: "password_example",
    paymobPayoutsBaseUrl: "",
  });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const call: Call = { url: String(input), method: init?.method ?? "GET", headers, body: String(init?.body ?? "") };
    calls.push(call);
    const answer = answers.shift();
    if (!answer) throw new Error(`unexpected fetch to ${call.url}`);
    return answer(call);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(env, saved);
});

/* ============================================================ collection == */

test("readiness: every missing Paymob key is named, and none is missing once all are set", () => {
  assert.deepEqual(paymobCollectionNeeds(), []);
  assert.deepEqual(paymobPayoutsNeeds(), []);
  Object.assign(env, { paymobSecretKey: "", paymobIntegrationId: "card", paymobPayoutsPassword: "" });
  const needs = paymobCollectionNeeds().join(" ");
  assert.match(needs, /PAYMOB_SECRET_KEY/);
  assert.match(needs, /PAYMOB_INTEGRATION_ID/);
  assert.match(paymobPayoutsNeeds().join(" "), /PAYMOB_PAYOUTS_PASSWORD/);
});

test("checkout: one Intention request, shaped as documented, and the Unified Checkout URL back", async () => {
  answers.push(() => json(201, { id: "pi_test_1", client_secret: "egy_csk_test_1", intention_order_id: 998877 }));
  const created = await PAYMOB_GATEWAY.createCheckout({
    reference: "7d3c1b9e-1111-4222-8333-944455556666",
    amountMinor: 117_435,
    currency: "egp",
    items: [
      { name: "Therapy session with Nour Demo", amountMinor: 114_000 },
      { name: "Card fee", amountMinor: 3_435 },
    ],
    payer: { name: "Salma Demo", email: "salma@example.com", phone: null },
    returnUrl: "https://app.example.com/pay/t?gateway=7d3c",
    callbackUrl: "https://app.example.com/api/gateway/callback",
  });

  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call!.url, "https://accept.paymob.com/v1/intention/");
  assert.equal(call!.method, "POST");
  assert.equal(call!.headers.authorization, "Token sk_test_example");
  const body = JSON.parse(call!.body);
  assert.equal(body.amount, 117_435);
  assert.equal(body.currency, "EGP");
  assert.deepEqual(body.payment_methods, [4567]);
  assert.equal(
    body.items.reduce((total: number, item: { amount: number }) => total + item.amount, 0),
    body.amount,
    "Paymob refuses items that do not sum to the amount",
  );
  assert.deepEqual(body.items[1], { name: "Card fee", amount: 3_435, description: "Card fee", quantity: 1 });
  assert.equal(body.special_reference, "7d3c1b9e-1111-4222-8333-944455556666");
  assert.equal(body.notification_url, "https://app.example.com/api/gateway/callback");
  assert.equal(body.redirection_url, "https://app.example.com/pay/t?gateway=7d3c");
  assert.equal(body.billing_data.first_name, "Salma");
  assert.equal(body.billing_data.last_name, "Demo");
  assert.equal(body.billing_data.email, "salma@example.com");
  assert.equal(body.billing_data.phone_number, "NA");
  assert.ok(!call!.body.includes("hmac_test_example") && !call!.body.includes("api_test_example"));

  assert.ok(created.ok);
  if (!created.ok) return;
  assert.equal(created.providerRef, "998877", "the order id, which the callback carries");
  const url = new URL(created.checkoutUrl);
  assert.equal(url.origin + url.pathname, "https://accept.paymob.com/unifiedcheckout/");
  assert.equal(url.searchParams.get("publicKey"), "pk_test_example");
  assert.equal(url.searchParams.get("clientSecret"), "egy_csk_test_1");
  assert.ok(!created.checkoutUrl.includes("sk_test_example"), "the secret key never reaches the browser");
});

test("checkout: a refusal is a value with Paymob's words, never a throw and never our key", async () => {
  answers.push(() => json(400, { detail: "Integration is not active" }));
  const created = await PAYMOB_GATEWAY.createCheckout({
    reference: "r",
    amountMinor: 100,
    currency: "egp",
    items: [{ name: "Therapy session", amountMinor: 100 }],
    payer: { name: "", email: null, phone: null },
    returnUrl: "https://app.example.com/r",
    callbackUrl: "https://app.example.com/c",
  });
  assert.equal(created.ok, false);
  if (created.ok) return;
  assert.match(created.reason, /HTTP 400.*Integration is not active/);
  assert.ok(!created.reason.includes("sk_test_example"));
});

/** A transaction callback as Paymob sends it, and its HMAC worked out here, independently of the adapter. */
function transaction(over: Record<string, unknown> = {}) {
  return {
    id: 192837465,
    pending: false,
    amount_cents: 117_435,
    success: true,
    is_auth: false,
    is_capture: false,
    is_standalone_payment: true,
    is_voided: false,
    is_refunded: false,
    is_3d_secure: true,
    integration_id: 4567,
    has_parent_transaction: false,
    order: { id: 998877, merchant_order_id: "7d3c1b9e-1111-4222-8333-944455556666" },
    created_at: "2026-09-25T10:15:30.123456",
    currency: "EGP",
    source_data: { pan: "2346", type: "card", sub_type: "MasterCard" },
    error_occured: false,
    owner: 302010,
    data: { message: "Approved" },
    ...over,
  };
}

function documentedHmac(obj: ReturnType<typeof transaction>, secret: string): string {
  /* The documented order, written out by hand so the adapter's list is checked, not reused. */
  const signed = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order.id,
    obj.owner,
    obj.pending,
    obj.source_data.pan,
    obj.source_data.sub_type,
    obj.source_data.type,
    obj.success,
  ]
    .map(String)
    .join("");
  return createHmac("sha512", secret).update(signed).digest("hex");
}

const callbackUrl = (hmac: string) => `https://app.example.com/api/gateway/callback?hmac=${hmac}`;

test("🔴 callback: a correctly signed transaction is an event, read the way Paymob means it", async () => {
  const obj = transaction();
  const rawBody = JSON.stringify({ type: "TRANSACTION", obj });
  const event = await PAYMOB_GATEWAY.verifyCallback({
    rawBody,
    headers: new Headers(),
    url: callbackUrl(documentedHmac(obj, "hmac_test_example")),
  });
  assert.deepEqual(event, {
    providerRef: "998877",
    reference: "7d3c1b9e-1111-4222-8333-944455556666",
    outcome: "paid",
    transactionId: "192837465",
    amountMinor: 117_435,
    currency: "egp",
    failure: null,
  });
  assert.equal(calls.length, 0, "verifying a callback asks nobody");
});

test("🔴 callback: a tampered amount, a wrong secret, no hmac, or not a transaction is no event at all", async () => {
  const obj = transaction();
  const good = documentedHmac(obj, "hmac_test_example");
  const tampered = JSON.stringify({ type: "TRANSACTION", obj: { ...obj, amount_cents: 100 } });
  const flipped = JSON.stringify({ type: "TRANSACTION", obj: { ...obj, success: false, pending: false } });
  const headers = new Headers();
  assert.equal(await PAYMOB_GATEWAY.verifyCallback({ rawBody: tampered, headers, url: callbackUrl(good) }), null);
  assert.equal(await PAYMOB_GATEWAY.verifyCallback({ rawBody: flipped, headers, url: callbackUrl(good) }), null);
  const honest = JSON.stringify({ type: "TRANSACTION", obj });
  assert.equal(
    await PAYMOB_GATEWAY.verifyCallback({ rawBody: honest, headers, url: callbackUrl(documentedHmac(obj, "another secret")) }),
    null,
  );
  assert.equal(await PAYMOB_GATEWAY.verifyCallback({ rawBody: honest, headers, url: "https://app.example.com/cb" }), null);
  assert.equal(await PAYMOB_GATEWAY.verifyCallback({ rawBody: honest, headers }), null);
  assert.equal(
    await PAYMOB_GATEWAY.verifyCallback({ rawBody: JSON.stringify({ type: "TOKEN", obj }), headers, url: callbackUrl(good) }),
    null,
  );
  /* And with no HMAC secret configured nothing verifies, however it is signed. */
  Object.assign(env, { paymobHmacSecret: "" });
  assert.equal(
    await PAYMOB_GATEWAY.verifyCallback({ rawBody: honest, headers, url: callbackUrl(createHmac("sha512", "").update("").digest("hex")) }),
    null,
  );
});

test("callback: a decline is 'failed' with Paymob's reason, and a refund child is never 'paid'", async () => {
  const declined = transaction({ success: false, data: { message: "Insufficient funds" } });
  const refundChild = transaction({ id: 555, has_parent_transaction: true, amount_cents: 117_435 });
  const read = (obj: ReturnType<typeof transaction>) =>
    PAYMOB_GATEWAY.verifyCallback({
      rawBody: JSON.stringify({ type: "TRANSACTION", obj }),
      headers: new Headers(),
      url: callbackUrl(documentedHmac(obj, "hmac_test_example")),
    });
  const a = await read(declined);
  assert.equal(a?.outcome, "failed");
  assert.equal(a?.failure, "Insufficient funds");
  assert.equal((await read(refundChild))?.outcome, "refunded");
});

test("status read: the token is bought with the API key once, reused, and the order's transaction is read", async () => {
  answers.push(() => json(201, { token: "auth_token_example" }));
  answers.push(() => json(200, transaction()));
  answers.push(() => json(200, {}));
  const first = await PAYMOB_GATEWAY.fetchStatus("998877");
  const second = await PAYMOB_GATEWAY.fetchStatus("998877");

  assert.equal(calls.length, 3, "one token, two reads");
  assert.equal(calls[0]!.url, "https://accept.paymob.com/api/auth/tokens");
  assert.deepEqual(JSON.parse(calls[0]!.body), { api_key: "api_test_example" });
  assert.equal(calls[1]!.url, "https://accept.paymob.com/api/ecommerce/orders/transaction_inquiry");
  assert.equal(calls[1]!.headers.authorization, "Bearer auth_token_example");
  assert.equal(JSON.parse(calls[1]!.body).order_id, 998877);
  assert.equal(calls[2]!.headers.authorization, "Bearer auth_token_example");
  assert.ok(!("ok" in first) && first.outcome === "paid" && first.transactionId === "192837465");
  assert.ok(!("ok" in second) && second.outcome === "pending", "an order nobody has paid is pending");
});

test("refund: against the transaction id, for the amount asked, with the secret key", async () => {
  answers.push(() => json(200, { id: 777001, success: true, pending: false }));
  const done = await PAYMOB_GATEWAY.refund({ transactionId: "192837465", amountMinor: 117_435, reference: "ref-1" });
  assert.deepEqual(done, { ok: true, refundRef: "777001" });
  assert.equal(calls[0]!.url, "https://accept.paymob.com/api/acceptance/void_refund/refund");
  assert.equal(calls[0]!.headers.authorization, "Token sk_test_example");
  assert.deepEqual(JSON.parse(calls[0]!.body), { transaction_id: 192837465, amount_cents: 117_435 });

  answers.push(() => json(200, { id: 777002, success: false, pending: false, data: { message: "Refund amount exceeded" } }));
  const refused = await PAYMOB_GATEWAY.refund({ transactionId: "192837465", amountMinor: 999_999, reference: "ref-2" });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.reason, /Refund amount exceeded/);

  const nothing = await PAYMOB_GATEWAY.refund({ transactionId: "1", amountMinor: 0, reference: "ref-3" });
  assert.equal(nothing.ok, false);
  assert.equal(calls.length, 2, "nothing to refund asks nobody");
});

/* =============================================================== payouts == */

const instruction = (over: Partial<Parameters<typeof PAYMOB_PAYOUTS.send>[0]> = {}) => ({
  reference: "0f1e2d3c-4b5a-4968-8776-655443322110",
  amountMinor: 15_050,
  currency: "egp" as const,
  method: "wallet" as const,
  identifier: "+20 100 123 4567",
  accountName: "Nour Demo",
  callbackUrl: "https://app.example.com/api/payouts/callback",
  ...over,
});

test("payout: an OAuth password grant, then one disbursement to the wallet's network, shaped as documented", async () => {
  answers.push(() => json(200, { access_token: "access_example", expires_in: 3600, token_type: "Bearer" }));
  answers.push(() =>
    json(200, {
      transaction_id: "9a8b7c6d-0000-4111-8222-933344445555",
      issuer: "vodafone",
      disbursement_status: "successful",
      status_code: "200",
    }),
  );
  const sent = await PAYMOB_PAYOUTS.send(instruction());

  assert.equal(calls[0]!.url, "https://stagingpayouts.paymobsolutions.com/api/secure/o/token/", "staging off the live deployment");
  assert.equal(
    calls[0]!.headers.authorization,
    `Basic ${Buffer.from("client_example:client_secret_example").toString("base64")}`,
  );
  assert.equal(calls[0]!.headers["content-type"], "application/x-www-form-urlencoded");
  const form = new URLSearchParams(calls[0]!.body);
  assert.equal(form.get("grant_type"), "password");
  assert.equal(form.get("username"), "api_user_example");
  assert.equal(form.get("password"), "password_example");

  assert.equal(calls[1]!.url, "https://stagingpayouts.paymobsolutions.com/api/secure/disburse/");
  assert.equal(calls[1]!.headers.authorization, "Bearer access_example");
  assert.deepEqual(JSON.parse(calls[1]!.body), {
    amount: 150.5,
    client_reference_id: "0f1e2d3c-4b5a-4968-8776-655443322110",
    issuer: "vodafone",
    msisdn: "01001234567",
  });

  assert.ok(sent.ok);
  if (!sent.ok) return;
  assert.equal(sent.providerRef, "9a8b7c6d-0000-4111-8222-933344445555");
  assert.equal(sent.settled?.outcome, "sent", "a wallet answers at once, and there is no callback to wait for");
  assert.equal(sent.settled?.reference, "0f1e2d3c-4b5a-4968-8776-655443322110");
});

test("payout: the token is cached across sends, and bought again once it is spent", async () => {
  answers.push(() => json(200, { access_token: "access_one", expires_in: 3600 }));
  answers.push(() => json(200, { transaction_id: "t-1", disbursement_status: "pending" }));
  answers.push(() => json(200, { transaction_id: "t-2", disbursement_status: "pending" }));
  await PAYMOB_PAYOUTS.send(instruction({ identifier: "01101234567" }));
  await PAYMOB_PAYOUTS.send(instruction({ identifier: "01201234567" }));
  assert.equal(calls.filter((c) => c.url.endsWith("/o/token/")).length, 1, "two sends, one token");
  assert.equal(JSON.parse(calls[1]!.body).issuer, "etisalat");
  assert.equal(JSON.parse(calls[2]!.body).issuer, "orange");

  /* A 401 retires the token, so the next call logs in again. */
  answers.push(() => json(401, { detail: "Authentication credentials expired" }));
  answers.push(() => json(200, { access_token: "access_two", expires_in: 3600 }));
  answers.push(() => json(200, { transaction_id: "t-3", disbursement_status: "pending" }));
  const expired = await PAYMOB_PAYOUTS.send(instruction());
  assert.equal(expired.ok, false);
  const again = await PAYMOB_PAYOUTS.send(instruction());
  assert.ok(again.ok);
  assert.equal(calls.at(-1)!.headers.authorization, "Bearer access_two");
});

test("payout: a failed disbursement, a number with no readable network, and an InstaPay address are refused, not sent", async () => {
  answers.push(() => json(200, { access_token: "access_example", expires_in: 3600 }));
  answers.push(() => json(200, { transaction_id: "t-9", disbursement_status: "failed", status_description: "Wallet is not registered" }));
  const failed = await PAYMOB_PAYOUTS.send(instruction());
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.match(failed.reason, /Wallet is not registered/);

  const before = calls.length;
  const we = await PAYMOB_PAYOUTS.send(instruction({ identifier: "01501234567" }));
  const ipa = await PAYMOB_PAYOUTS.send(instruction({ method: "instapay", identifier: "nour@instapay" }));
  assert.equal(we.ok, false);
  assert.equal(ipa.ok, false);
  assert.equal(calls.length, before, "a payout we cannot address asks Paymob nothing");
});

test("payout: a bank destination written with its code goes as a bank_card cash transfer", async () => {
  answers.push(() => json(200, { access_token: "access_example", expires_in: 3600 }));
  answers.push(() => json(200, { transaction_id: "t-b", disbursement_status: "pending", status_code: "8000" }));
  const sent = await PAYMOB_PAYOUTS.send(instruction({ method: "bank", identifier: "CIB:1000 2000 3000 4000", amountMinor: 250_000 }));
  assert.ok(sent.ok && !sent.settled, "a bank payout is pending until Paymob's callback");
  assert.deepEqual(JSON.parse(calls[1]!.body), {
    amount: 2500,
    client_reference_id: "0f1e2d3c-4b5a-4968-8776-655443322110",
    issuer: "bank_card",
    bank_card_number: "1000200030004000",
    bank_code: "CIB",
    bank_transaction_type: "cash_transfer",
    full_name: "Nour Demo",
  });
});

test("🔴 payout callback: unsigned, so its body is only a hint, and Paymob is asked what really happened", async () => {
  const id = "1e886593-03b1-4af9-b9e0-72b39fef479b";
  const forged = JSON.stringify({ transaction_id: id, disbursement_status: "successful" });
  answers.push(() => json(200, { access_token: "access_example", expires_in: 3600 }));
  answers.push(() =>
    json(200, { count: 1, results: [{ transaction_id: id, disbursement_status: "failed", status_description: "Invalid bank code" }] }),
  );
  const event = await PAYMOB_PAYOUTS.verifyCallback({ rawBody: forged, headers: new Headers() });
  assert.deepEqual(event, { providerRef: id, reference: "", outcome: "failed", failure: "Invalid bank code" });
  assert.equal(calls[1]!.url, "https://stagingpayouts.paymobsolutions.com/api/secure/transaction/inquire/");
  assert.deepEqual(JSON.parse(calls[1]!.body), { transactions_ids_list: [id] });

  assert.equal(await PAYMOB_PAYOUTS.verifyCallback({ rawBody: "not json", headers: new Headers() }), null);
  assert.equal(await PAYMOB_PAYOUTS.verifyCallback({ rawBody: JSON.stringify({ transaction_id: "x" }), headers: new Headers() }), null);
});

test("payouts use the live host only on the live deployment", async () => {
  Object.assign(env, { liveDeployment: true });
  answers.push(() => json(200, { access_token: "access_example", expires_in: 3600 }));
  answers.push(() => json(200, { transaction_id: "t-l", disbursement_status: "pending" }));
  await PAYMOB_PAYOUTS.send(instruction());
  assert.ok(calls.every((c) => c.url.startsWith("https://payouts.paymobsolutions.com/api/secure/")));
});

/* ============================================================== card fee == */

test("ruling 12: the card fee is 2.75% plus EGP 3 on the card part, and nothing when off or when nothing is owed", () => {
  assert.equal(cardFeeMinorFor(RULES_DEFAULTS, 100_000), 2_750 + 300);
  assert.equal(cardFeeMinorFor(RULES_DEFAULTS, 0), 0);
  const off = { ...RULES_DEFAULTS, payments: { ...RULES_DEFAULTS.payments, patientPaysCardFee: false } };
  assert.equal(cardFeeMinorFor(off, 100_000), 0);
});
