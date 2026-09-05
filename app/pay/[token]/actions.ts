"use server";

import { createSessionPaymentCheckout } from "@/lib/billing/connect";
import { quoteFor } from "@/lib/billing/fx";
import { resolveJoinToken } from "@/lib/data/sessions";
import { convertAtRate, getCountrySettings, getSettings, sessionMoney } from "@/lib/settings";

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
        "We cannot take payments in that country yet. Ask your therapist for a free link — the session works exactly the same.",
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
