import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

import type {
  CallbackInput,
  CollectionEvent,
  CollectionGateway,
  PayoutEvent,
  PayoutInstruction,
  PayoutProvider,
  ProviderRefusal,
} from "./types";

/**
 * 🔴 PAYMOB, BOTH SIDES: CARD COLLECTION AND PAYOUTS. Rulings 12 and 13b.
 *
 * Written to Paymob's published documents before any key exists, so the day
 * the keys arrive the work is a sandbox run and not a build. Every line the
 * documents leave open is marked `PAYMOB-CONFIRM:` and is the checklist for
 * that sandbox run: search the repository for the marker, try each one, and
 * delete the marker once the sandbox has answered.
 *
 *   collection  Accept's Intention API creates the payment and Unified
 *               Checkout is the hosted page the patient is sent to. The
 *               "transaction processed" callback is POSTed as JSON with an
 *               HMAC-SHA512 in `?hmac=`, over twenty fields in a fixed order.
 *               A status read asks the order's transaction with a short-lived
 *               token bought with the API key. A refund is issued against the
 *               transaction id.
 *   payouts     Paymob Send (the Payouts portal): an OAuth token from the API
 *               user, then one instant disbursement per payout, to a mobile
 *               wallet (Vodafone, Etisalat, Orange), a bank wallet, a bank
 *               account or card, or an instant bank transfer.
 *
 * 🔴 NO KEY IS EVER WRITTEN HERE. Every one is read from the environment at
 * the moment it is used (`lib/env.ts`), the repository is public, and a
 * refusal's reason is built from Paymob's status and message only, never from
 * a request, so a key cannot reach a log or a screen through an error.
 *
 * 🔴 NOTHING THROWS ON A BUSINESS OUTCOME (see `types.ts`). A decline, a
 * refused refund and a closed wallet are values. A network failure does throw,
 * and the callers already treat a throw as "no answer, check before retrying".
 */

/* ================================================================ shared == */

type Json = Record<string, unknown>;

async function readJson(res: Response): Promise<Json> {
  try {
    const body = (await res.json()) as unknown;
    return body && typeof body === "object" ? (body as Json) : {};
  } catch {
    return {};
  }
}

function record(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

/** A refusal's words: Paymob's own message if it gave one, never our request. */
function refusal(what: string, res: Response, body: Json): ProviderRefusal {
  const said = [body.detail, body.message, body.status_description, body.error_description, body.error]
    .find((v) => typeof v === "string" && v.trim().length > 0) as string | undefined;
  return { ok: false, reason: `Paymob refused ${what} (HTTP ${res.status})${said ? `: ${said.slice(0, 200)}` : ""}` };
}

/** Constant time, and false for anything that is not the same length of hex. */
function sameHex(given: string, expected: string): boolean {
  const a = given.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(a) || a.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(expected));
}

/* ============================================================ collection == */

const ACCEPT_BASE = "https://accept.paymob.com";

function acceptBase(): string {
  return (env.paymobBaseUrl || ACCEPT_BASE).replace(/\/+$/, "");
}

/** What the card side still needs, in sentences an operator can act on. */
export function paymobCollectionNeeds(): string[] {
  const needs: string[] = [];
  if (!env.paymobSecretKey) needs.push("Paymob's secret key in PAYMOB_SECRET_KEY.");
  if (!env.paymobPublicKey) needs.push("Paymob's public key in PAYMOB_PUBLIC_KEY.");
  if (!/^\d+$/.test(env.paymobIntegrationId)) {
    needs.push("The card integration id from Paymob's dashboard, digits only, in PAYMOB_INTEGRATION_ID.");
  }
  if (!env.paymobHmacSecret) needs.push("Paymob's HMAC secret, for the callback signature, in PAYMOB_HMAC_SECRET.");
  if (!env.paymobApiKey) needs.push("Paymob's API key, for status reads, in PAYMOB_API_KEY.");
  return needs;
}

/**
 * 🔴 THE TWENTY FIELDS PAYMOB SIGNS, IN ITS ORDER (the "transaction processed"
 * callback). Concatenated with no separator and hashed with HMAC-SHA512 under
 * the HMAC secret from the dashboard's profile page. The order is alphabetical
 * by key and it is the documented order; it is not ours to sort.
 */
export const PAYMOB_HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
] as const;

function pick(obj: Json, path: string): unknown {
  return path.split(".").reduce<unknown>((at, key) => record(at)[key], obj);
}

/**
 * One field as Paymob writes it into the signed string: booleans as
 * `true`/`false`, numbers as their digits, strings as they are.
 */
function signedValue(value: unknown): string {
  // PAYMOB-CONFIRM: a null or absent field (a wallet payment has no `source_data.pan`) is signed here as the empty string; check a wallet callback in the sandbox signs the same way.
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** The hex HMAC of one transaction object. Exported for the tests and the sandbox run. */
function paymobTransactionHmac(obj: Json, secret: string): string {
  const signed = PAYMOB_HMAC_FIELDS.map((field) => signedValue(pick(obj, field))).join("");
  return createHmac("sha512", secret).update(signed).digest("hex");
}

/** A Paymob transaction object as our event. `null` when it is not one. */
function eventFrom(obj: Json): CollectionEvent | null {
  const order = record(obj.order);
  const orderId = order.id;
  if (orderId === undefined || orderId === null || obj.id === undefined || obj.id === null) return null;
  const amount = Number(obj.amount_cents);
  if (!Number.isInteger(amount)) return null;

  /*
   * 🔴 A child transaction (a refund or a void) is never "paid". It succeeds,
   * for the refunded amount, against the same order, and read as a payment it
   * would be a "paid" for the wrong sum. `applyGatewayEvent` refuses that too;
   * this says what it is instead.
   */
  const child = obj.has_parent_transaction === true || obj.is_refund === true || obj.is_void === true;
  const outcome: CollectionEvent["outcome"] =
    child || obj.is_refunded === true || obj.is_voided === true
      ? "refunded"
      : obj.pending === true
        ? "pending"
        : obj.success === true
          ? "paid"
          : "failed";

  const data = record(obj.data);
  const failure =
    outcome === "failed"
      ? String(data.message ?? data["txn_response_code"] ?? obj.data_message ?? "declined").slice(0, 300)
      : null;

  return {
    providerRef: String(orderId),
    // PAYMOB-CONFIRM: the Intention API's `special_reference` comes back as the order's `merchant_order_id`; if the sandbox shows it elsewhere (for example `obj.special_reference`), read it from there.
    reference: String(order.merchant_order_id ?? obj.special_reference ?? ""),
    outcome,
    transactionId: String(obj.id),
    amountMinor: amount,
    currency: String(obj.currency ?? "").toLowerCase(),
    failure,
  };
}

/*
 * The short-lived token a status read needs, bought with the API key and
 * kept until shortly before Paymob retires it. One per process: a cold start
 * buys a new one, which is what Paymob expects.
 */
let acceptToken: { token: string; until: number } | null = null;
/** Documented as an hour; renewed well inside it. */
const ACCEPT_TOKEN_MS = 50 * 60 * 1000;

async function acceptAuthToken(): Promise<string | null> {
  if (acceptToken && acceptToken.until > Date.now()) return acceptToken.token;
  const res = await fetch(`${acceptBase()}/api/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: env.paymobApiKey }),
  });
  const body = await readJson(res);
  if (!res.ok || typeof body.token !== "string" || !body.token) return null;
  acceptToken = { token: body.token, until: Date.now() + ACCEPT_TOKEN_MS };
  return acceptToken.token;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const first = (parts.shift() ?? "").slice(0, 50);
  const last = parts.join(" ").slice(0, 50);
  return { first: first || "NA", last: last || "NA" };
}

export const PAYMOB_GATEWAY: CollectionGateway = {
  name: "paymob",

  async createCheckout(input) {
    const name = splitName(input.payer.name);
    const body = {
      /* Piastres: Paymob's `amount` is in the currency's minor unit. */
      amount: input.amountMinor,
      currency: "EGP",
      payment_methods: [Number(env.paymobIntegrationId)],
      /* 🔴 Paymob refuses items that do not sum to `amount`; ours always do (`session.ts`). */
      items: input.items.map((item) => ({
        name: item.name.slice(0, 50),
        amount: item.amountMinor,
        description: item.name.slice(0, 255),
        quantity: 1,
      })),
      /*
       * Paymob requires every billing field. We ask a patient for a name and
       * nothing else, and we do not invent an address for them.
       */
      // PAYMOB-CONFIRM: "NA" for the fields we do not hold is the documented placeholder; check the sandbox accepts "NA" for `email` and `phone_number` when the payer gave neither.
      billing_data: {
        first_name: name.first,
        last_name: name.last,
        email: input.payer.email || "NA",
        phone_number: input.payer.phone || "NA",
        apartment: "NA",
        floor: "NA",
        street: "NA",
        building: "NA",
        city: "NA",
        state: "NA",
        country: "EG",
        postal_code: "NA",
      },
      special_reference: input.reference,
      notification_url: input.callbackUrl,
      redirection_url: input.returnUrl,
    };
    const res = await fetch(`${acceptBase()}/v1/intention/`, {
      method: "POST",
      headers: { Authorization: `Token ${env.paymobSecretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const created = await readJson(res);
    if (!res.ok) return refusal("the checkout", res, created);
    const clientSecret = created.client_secret;
    /*
     * 🔴 THE ORDER ID IS THE REFERENCE WE KEEP, because it is the one the
     * callback carries (`obj.order.id`) and the one a status read asks by.
     * The intention's own id (`pi_...`) appears in neither.
     */
    // PAYMOB-CONFIRM: the callback's `obj.order.id` equals the intention's `intention_order_id`.
    const orderId = created.intention_order_id;
    if (typeof clientSecret !== "string" || !clientSecret || orderId === undefined || orderId === null) {
      return { ok: false, reason: "Paymob answered the checkout without a client secret or an order id." };
    }
    const url = new URL(`${acceptBase()}/unifiedcheckout/`);
    url.searchParams.set("publicKey", env.paymobPublicKey);
    url.searchParams.set("clientSecret", clientSecret);
    return { ok: true, providerRef: String(orderId), checkoutUrl: url.toString() };
  },

  /**
   * 🔴 THE HMAC FIRST, and nothing read before it verifies. A body without a
   * valid `?hmac=` is not an event, whatever it says.
   */
  async verifyCallback({ rawBody, url }: CallbackInput) {
    const secret = env.paymobHmacSecret;
    if (!secret || !url) return null;
    let given = "";
    try {
      // PAYMOB-CONFIRM: the POST callback carries its HMAC in the query string as `hmac`, not in a header.
      given = new URL(url).searchParams.get("hmac") ?? "";
    } catch {
      return null;
    }
    if (!given) return null;
    let parsed: Json;
    try {
      parsed = record(JSON.parse(rawBody));
    } catch {
      return null;
    }
    /* Only a transaction is a payment; a token or a delivery status is not ours. */
    if (parsed.type !== "TRANSACTION") return null;
    const obj = record(parsed.obj);
    if (!sameHex(given, paymobTransactionHmac(obj, secret))) return null;
    return eventFrom(obj);
  },

  async fetchStatus(providerRef) {
    const token = await acceptAuthToken();
    if (!token) return { ok: false, reason: "Paymob did not give a token for the status read (check PAYMOB_API_KEY)." };
    // PAYMOB-CONFIRM: the inquiry by order id, with the token as a Bearer header; older accounts expect `auth_token` in the body instead, so both are sent.
    const res = await fetch(`${acceptBase()}/api/ecommerce/orders/transaction_inquiry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ auth_token: token, order_id: Number(providerRef) }),
    });
    const body = await readJson(res);
    /* An order nobody has paid yet has no transaction to show: that is "pending". */
    if (res.status === 404 || (res.ok && (body.id === undefined || body.id === null))) {
      return {
        providerRef,
        reference: "",
        outcome: "pending",
        transactionId: null,
        amountMinor: 0,
        currency: "egp",
        failure: null,
      };
    }
    if (!res.ok) {
      /* A token Paymob has retired early is bought again on the next read. */
      if (res.status === 401) acceptToken = null;
      return refusal("the status read", res, body);
    }
    return eventFrom(body) ?? { ok: false, reason: "Paymob answered the status read with something that is not a transaction." };
  },

  async refund(input) {
    if (input.amountMinor <= 0) return { ok: false, reason: "Nothing to refund." };
    /*
     * 🔴 THE WHOLE AMOUNT THE PATIENT PAID, card fee included (ruling 16 is a
     * full refund). `session.ts` claims the refund before it gets here, so two
     * callers cannot both send it; Paymob documents no idempotency key.
     */
    const res = await fetch(`${acceptBase()}/api/acceptance/void_refund/refund`, {
      method: "POST",
      headers: { Authorization: `Token ${env.paymobSecretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: Number(input.transactionId), amount_cents: input.amountMinor }),
    });
    const body = await readJson(res);
    if (!res.ok) return refusal("the refund", res, body);
    // PAYMOB-CONFIRM: a refund Paymob accepts but has not finished answers `pending: true` with `success: false`; it is taken as issued and the order's callback says the rest.
    if (body.success !== true && body.pending !== true) {
      const data = record(body.data);
      return { ok: false, reason: `Paymob refused the refund: ${String(data.message ?? body.message ?? "no reason given").slice(0, 200)}` };
    }
    return { ok: true, refundRef: String(body.id ?? input.reference) };
  },
};

/* =============================================================== payouts == */

/*
 * The Payouts portal's own hosts. Its staging host anywhere but the live
 * deployment, so a developer's keys cannot move real money by default.
 */
const PAYOUTS_LIVE = "https://payouts.paymobsolutions.com/api/secure";
const PAYOUTS_STAGING = "https://stagingpayouts.paymobsolutions.com/api/secure";

function payoutsBase(): string {
  return (env.paymobPayoutsBaseUrl || (env.liveDeployment ? PAYOUTS_LIVE : PAYOUTS_STAGING)).replace(/\/+$/, "");
}

/** What automated payouts still need, in sentences an operator can act on. */
export function paymobPayoutsNeeds(): string[] {
  const needs: string[] = [];
  if (!env.paymobPayoutsClientId) needs.push("Paymob Send's OAuth client id in PAYMOB_PAYOUTS_CLIENT_ID.");
  if (!env.paymobPayoutsClientSecret) needs.push("Paymob Send's OAuth client secret in PAYMOB_PAYOUTS_CLIENT_SECRET.");
  if (!env.paymobPayoutsUsername) needs.push("Paymob Send's API user in PAYMOB_PAYOUTS_USERNAME.");
  if (!env.paymobPayoutsPassword) needs.push("That API user's password in PAYMOB_PAYOUTS_PASSWORD.");
  return needs;
}

/*
 * 🔴 ONE TOKEN, REUSED UNTIL IT IS NEARLY SPENT. Documented as sixty minutes;
 * renewed a minute early so a send never starts on a token that dies halfway.
 * The inquiry is throttled to five a minute, so buying a token per call would
 * spend the budget on logging in.
 */
let payoutsToken: { token: string; until: number } | null = null;

async function payoutsAccessToken(): Promise<string | null> {
  if (payoutsToken && payoutsToken.until > Date.now()) return payoutsToken.token;
  const basic = Buffer.from(`${env.paymobPayoutsClientId}:${env.paymobPayoutsClientSecret}`).toString("base64");
  const form = new URLSearchParams({
    grant_type: "password",
    username: env.paymobPayoutsUsername,
    password: env.paymobPayoutsPassword,
  });
  // PAYMOB-CONFIRM: the documented form is HTTP Basic with the client id and secret plus a form-encoded password grant; the parameter table also lists the client id and secret as body fields, which some accounts may require instead.
  const res = await fetch(`${payoutsBase()}/o/token/`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = await readJson(res);
  if (!res.ok || typeof body.access_token !== "string" || !body.access_token) return null;
  const seconds = Number(body.expires_in);
  const lifetime = Number.isFinite(seconds) && seconds > 120 ? seconds : 3600;
  payoutsToken = { token: body.access_token, until: Date.now() + (lifetime - 60) * 1000 };
  return payoutsToken.token;
}

/** Test seam: forget both cached tokens, as a cold start would. */
export function forgetPaymobTokens(): void {
  acceptToken = null;
  payoutsToken = null;
}

/** An Egyptian mobile number as the eleven digits Paymob wants (it adds the +2). */
function msisdn(identifier: string): string | null {
  const digits = identifier.replace(/[^\d]/g, "").replace(/^(?:0020|20)(?=1)/, "0");
  return /^01\d{9}$/.test(digits) ? digits : null;
}

/**
 * 🔴 WHICH WALLET, FROM THE NUMBER'S PREFIX. 010 is Vodafone, 011 Etisalat
 * (e&), 012 Orange. A 015 number (WE) or a ported number has no issuer we can
 * read off it, and a payout to the wrong issuer is a payout that fails or,
 * worse, lands somewhere nobody meant; so it is refused and sent by hand.
 */
// PAYMOB-CONFIRM: whether Paymob routes a number ported between networks by its current network or by the issuer we name; if the latter, the payout method needs the issuer stored, not guessed.
const WALLET_ISSUER: Record<string, string> = { "010": "vodafone", "011": "etisalat", "012": "orange" };

/**
 * A bank destination, written `BANKCODE:account` (the code from Paymob's
 * list, the account number, IBAN or card number after it). Nothing stores
 * that shape yet; until something does, a bank payout is refused and sent by
 * hand rather than guessed.
 */
function bankDestination(identifier: string): { code: string; account: string } | null {
  const match = identifier.trim().match(/^([A-Z]{2,6}):\s*([A-Z0-9 ]{6,40})$/);
  if (!match) return null;
  return { code: match[1]!, account: match[2]!.replace(/\s+/g, "") };
}

type Disbursement = Record<string, string | number | boolean>;

/** The request body for one payout, or the reason there cannot be one. */
function paymobDisbursement(input: PayoutInstruction): { ok: true; body: Disbursement } | ProviderRefusal {
  if (input.currency !== "egp") return { ok: false, reason: "Paymob Send pays out in pounds only." };
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) return { ok: false, reason: "Nothing to send." };
  const common = {
    /* Pounds with at most two decimals, as a number. */
    amount: Number((input.amountMinor / 100).toFixed(2)),
    /* 🔴 Our request id: Paymob keeps it, so a retried send after a timeout can be looked up rather than repeated. */
    client_reference_id: input.reference,
    // PAYMOB-CONFIRM: the documents mark `national_id` mandatory for every issuer, and a payout method holds none; check the sandbox accepts a disbursement without it, or add it to the payout method.
  };

  if (input.method === "wallet") {
    const number = msisdn(input.identifier);
    if (!number) return { ok: false, reason: "That is not an Egyptian mobile wallet number." };
    const issuer = WALLET_ISSUER[number.slice(0, 3)];
    if (!issuer) return { ok: false, reason: "Paymob needs the wallet's network, and this number does not show it. Send it by hand." };
    return { ok: true, body: { ...common, issuer, msisdn: number } };
  }

  const bank = bankDestination(input.identifier);
  if (!bank) {
    return {
      ok: false,
      reason:
        input.method === "instapay"
          ? "Paymob sends to a bank account, not an InstaPay address. Send it by hand."
          : "Paymob needs the bank's code with the account. Send it by hand.",
    };
  }
  if (input.method === "instapay") {
    /* Instant bank transfer: Paymob's minimum is EGP 112. */
    if (input.amountMinor < 11_200) return { ok: false, reason: "Paymob's instant bank transfer starts at EGP 112." };
    return {
      ok: true,
      body: { ...common, issuer: "instant_bank", bank_card_number: bank.account, bank_code: bank.code, full_name: input.accountName },
    };
  }
  return {
    ok: true,
    body: {
      ...common,
      issuer: "bank_card",
      bank_card_number: bank.account,
      bank_code: bank.code,
      bank_transaction_type: "cash_transfer",
      full_name: input.accountName,
    },
  };
}

/** A disbursement record, from a send, a callback or an inquiry, as our event. */
function payoutEventFrom(row: Json, fallbackReference: string): PayoutEvent | null {
  const id = row.transaction_id;
  if (typeof id !== "string" || !id) return null;
  /* `transaction_status` is the older name the documents say is being retired. */
  const status = String(row.disbursement_status ?? row.transaction_status ?? "").toLowerCase();
  const outcome: PayoutEvent["outcome"] =
    status === "successful" || status === "success" ? "sent" : status === "failed" ? "failed" : "pending";
  const reference = String(row.client_reference_id ?? row.client_reference ?? fallbackReference ?? "");
  return {
    providerRef: id,
    reference,
    outcome,
    failure:
      outcome === "failed"
        ? String(row.status_description ?? row.failure_reason ?? row.status_code ?? "failed").slice(0, 300)
        : null,
  };
}

export const PAYMOB_PAYOUTS: PayoutProvider = {
  name: "paymob",

  async send(input) {
    const built = paymobDisbursement(input);
    if (!built.ok) return built;
    const token = await payoutsAccessToken();
    if (!token) return { ok: false, reason: "Paymob Send did not give a token (check the PAYMOB_PAYOUTS_ keys)." };
    const res = await fetch(`${payoutsBase()}/disburse/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(built.body),
    });
    const answer = await readJson(res);
    if (res.status === 401) payoutsToken = null;
    if (!res.ok) return refusal("the payout", res, answer);
    const event = payoutEventFrom(answer, input.reference);
    if (!event) return { ok: false, reason: "Paymob answered the payout without a transaction id." };
    /* 🔴 Refused at once: nothing left, so the request stays approved with the reason. */
    if (event.outcome === "failed") return { ok: false, reason: `Paymob refused the payout: ${event.failure ?? "failed"}` };
    return {
      ok: true,
      providerRef: event.providerRef,
      /* A wallet usually answers at once, and Paymob sends no callback for a wallet. */
      ...(event.outcome === "sent" ? { settled: { ...event, reference: input.reference } } : {}),
    };
  },

  /**
   * 🔴 PAYMOB SEND'S CALLBACK IS NOT SIGNED, so its body is a hint and never a
   * fact. The only thing read from it is the transaction id, and the outcome
   * is then asked of Paymob over our own authenticated channel. A forged
   * "successful" therefore changes nothing: the inquiry answers with what
   * really happened, or with nothing.
   */
  // PAYMOB-CONFIRM: the callback (set once in the Payouts dashboard, sent for bank and Aman transactions only) has no signature documented; if the sandbox shows one, verify it here as well as asking.
  async verifyCallback({ rawBody }: CallbackInput) {
    let parsed: Json;
    try {
      parsed = record(JSON.parse(rawBody));
    } catch {
      return null;
    }
    const id = parsed.transaction_id;
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const asked = await PAYMOB_PAYOUTS.fetchStatus(id);
    return "ok" in asked ? null : asked;
  },

  async fetchStatus(providerRef) {
    const token = await payoutsAccessToken();
    if (!token) return { ok: false, reason: "Paymob Send did not give a token (check the PAYMOB_PAYOUTS_ keys)." };
    const ask = async (bank: boolean) => {
      // PAYMOB-CONFIRM: the documents show this inquiry as a GET with a JSON body, which `fetch` cannot send; it is POSTed here, as the by-reference inquiry beside it accepts. If the sandbox refuses POST, send the GET with node:https.
      const res = await fetch(`${payoutsBase()}/transaction/inquire/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ transactions_ids_list: [providerRef], ...(bank ? { bank_transactions: true } : {}) }),
      });
      const body = await readJson(res);
      if (res.status === 401) payoutsToken = null;
      return { res, body };
    };
    /* A bank payout is only found when asked as one, and nothing says which this is. */
    let { res, body } = await ask(false);
    let results = Array.isArray(body.results) ? (body.results as Json[]) : [];
    if (res.ok && results.length === 0) {
      ({ res, body } = await ask(true));
      results = Array.isArray(body.results) ? (body.results as Json[]) : [];
    }
    if (!res.ok) return refusal("the payout status read", res, body);
    const row = results.find((r) => r.transaction_id === providerRef);
    if (!row) return { providerRef, reference: "", outcome: "pending", failure: null };
    return payoutEventFrom(row, "") ?? { providerRef, reference: "", outcome: "pending", failure: null };
  },
};
