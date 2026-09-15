"use server";

import { revalidatePath } from "next/cache";

import { createSessionPaymentCheckout } from "@/lib/billing/connect";
import { quoteFor } from "@/lib/billing/fx";
import { declarePaid, organizationNeedsTransfer } from "@/lib/billing/manual-entry";
import { resolveJoinToken } from "@/lib/data/sessions";
import { convertAtRate, getCountrySettings, getSettings, sessionMoney } from "@/lib/settings";
import { uploadDocument } from "@/lib/uploads";

export type PayState = {
  error?: string;
  /** Stripe's hosted checkout. A redirect, not a fetch. */
  payUrl?: string;
};

export type Breakdown = {
  countryCode: string;
  countryName: string;
  currency: string;
  vatBps: number;
  /** In the therapist's settlement currency. */
  grossCents: number;
  vatCents: number;
  totalCents: number;
  /** The same amounts in the patient's currency. */
  presentedGrossCents: number;
  presentedVatCents: number;
  presentedTotalCents: number;
  rateMicro: number;
  /** Whether the rate is a real quote or an indicative one. */
  rateSource: string;
  quoteExpiresAt: string;
  methods: string[];
};

/**
 * What this session costs, in the currency of the country the patient picked.
 *
 * Unauthenticated by design — the patient has a link and no account — and it
 * returns nothing clinical: a price, a tax, and a rate.
 *
 * Read on every country change rather than computed once and adjusted on the
 * client. The VAT rate, the currency and the exchange rate are all facts the
 * server holds; recomputing them in the browser is how a page ends up showing a
 * total the checkout then disagrees with.
 */
export async function priceFor(token: string, countryCode: string): Promise<Breakdown | { error: string }> {
  const session = await resolveJoinToken(token);
  if (!session) return { error: "That link has expired." };
  if (session.priceCents <= 0) return { error: "This session is free to join." };

  const country = await getCountrySettings(countryCode);
  if (!country) {
    return {
      error:
        "We cannot take payments in that country yet. Ask your therapist for a free link. The session works exactly the same.",
    };
  }

  const settings = await getSettings();
  const money = sessionMoney({
    grossCents: session.priceCents,
    feeBps: settings.session.platformFeeBps,
    vatBps: country.vatBps,
  });

  const quote = await quoteFor("usd", country.currency);
  if (!quote) return { error: "We cannot price this session in your currency yet." };

  return {
    countryCode: country.code,
    countryName: country.name,
    currency: country.currency,
    vatBps: country.vatBps,
    grossCents: money.grossCents,
    vatCents: money.vatCents,
    totalCents: money.patientTotalCents,
    presentedGrossCents: convertAtRate(money.grossCents, quote.rateMicro),
    presentedVatCents: convertAtRate(money.vatCents, quote.rateMicro),
    presentedTotalCents: convertAtRate(money.patientTotalCents, quote.rateMicro),
    rateMicro: quote.rateMicro,
    rateSource: quote.source,
    quoteExpiresAt: quote.expiresAt.toISOString(),
    methods: country.paymentMethods,
  };
}

/**
 * Hand the patient to Stripe.
 *
 * The country goes to the server and the *amount does not*. Everything
 * chargeable is recomputed from `sessions.price_cents` and `country_settings`
 * inside `createSessionPaymentCheckout` — a price that arrived from a form is a
 * price somebody can edit.
 */
export async function startPayment(input: {
  token: string;
  countryCode: string;
  name: string;
  email?: string | null;
}): Promise<PayState> {
  const session = await resolveJoinToken(input.token);
  if (!session) return { error: "That link has expired." };
  if (session.priceCents <= 0) return { error: "This session is free to join." };
  if (session.paymentStatus === "paid") return { error: "This session is already paid for." };

  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Enter the name your therapist knows you by." };

  const checkout = await createSessionPaymentCheckout({
    sessionId: session.id,
    token: input.token,
    payerName: name,
    payerEmail: input.email?.trim() || null,
    payerCountry: input.countryCode,
  });

  if (checkout.error || !checkout.url) {
    return { error: checkout.error ?? "Could not start the payment." };
  }
  return { payUrl: checkout.url };
}

/* ======================================================= the Egyptian rail == */

export type TransferState = { error?: string; ok?: boolean };

/**
 * 🔴 74.1 — A PATIENT IN EGYPT PAYS FOR A SESSION BY TRANSFER.
 *
 * `startPayment` above is the card rail and is untouched. The two never both
 * render: the page asks `organizationNeedsTransfer` once and shows one of them.
 *
 * ## 🔴 THE LINK IS THE AUTHENTICATION, AND THAT IS NOT A GAP
 *
 * Everything else on this rail is a signed-in payer. This one is not, because
 * the commonest payment this product will ever take is from somebody who found
 * a therapist on the radar at eleven at night and has no account. The token is
 * the credential — it is the same credential the join page runs on — and
 * nothing here reads anything clinical or writes anything but a claim about
 * money.
 *
 * ## 🔴 AND THE PRICE IS NEVER TAKEN FROM THE FORM
 *
 * `settlesCents` comes off the session row. The form carries a reference and a
 * photograph and nothing else that costs anything, which is the same rule
 * `startPayment` follows for exactly the same reason.
 */
export async function declareSessionTransfer(
  token: string,
  _prev: TransferState,
  formData: FormData,
): Promise<TransferState> {
  const session = await resolveJoinToken(token);
  if (!session) return { error: "That link has expired." };
  if (session.priceCents <= 0) return { error: "This session is free to join." };
  if (session.paymentStatus === "paid") return { error: "This session is already paid for." };

  /*
   * 🔴 Asked again here rather than trusted from the screen. A form that renders
   * on a condition is a form somebody can post without meeting it.
   */
  if (!(await organizationNeedsTransfer(session.organizationId))) {
    return { error: "This session is paid by card. Reload the page." };
  }

  const reference = String(formData.get("reference") ?? "").trim();
  const proof = formData.get("proof");

  let proofUrl: string | null = null;
  if (proof instanceof File && proof.size > 0) {
    /*
     * 🔴 The SESSION id owns the path, because the payer has no account. The
     * segment is there for operability — an operator tracing a receipt back
     * should not need a database round trip — and it grants no access on its
     * own: the random secret in the filename is what makes the URL work.
     */
    const stored = await uploadDocument({
      kind: "receipt",
      userId: session.id,
      label: "transfer",
      file: proof,
    });
    if (stored.error) return { error: stored.error };
    proofUrl = stored.url ?? null;
  }

  const result = await declarePaid({
    purpose: "session",
    /* The session is both what this pays for and who is paying. See 0105. */
    refId: session.id,
    settlesCents: session.priceCents,
    payer: { kind: "session", organizationId: session.organizationId },
    reference,
    proofUrl,
  });

  if (result.error) return { error: result.error };

  /*
   * 🔴 No audit row, deliberately, and it is the one call site on this rail with
   * none. `audit` records an actor, and there is no actor here: a guest holding
   * a link is not an account. The payment row itself is the record, it carries
   * the session, the reference and the receipt, and an operator's confirmation
   * IS audited with their name on it.
   */
  revalidatePath(`/pay/${token}`);
  return { ok: true };
}
