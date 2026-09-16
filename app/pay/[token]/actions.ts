"use server";

import { revalidatePath } from "next/cache";

import { createSessionPaymentCheckout } from "@/lib/billing/connect";
import { quoteFor } from "@/lib/billing/fx";
import {
  declarePaid,
  organizationNeedsTransfer,
  sessionTransferMoney,
} from "@/lib/billing/manual-entry";
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

  /*
   * 🔴 75.7 — THE SAME FIGURE THE SCREEN QUOTED, VAT INCLUDED, from the same
   * helper. Recomputed here rather than posted from the form for the reason
   * every amount on this rail is: a number a payer can edit is a number a payer
   * can lower.
   *
   * 🔴 76.27 — AND FROM THE SAME STARTING POINT, which is the half that was
   * wrong. All THREE places that priced this session read `price_cents` and
   * ignored the employer's share that `payFromPot` had already debited, so the
   * screen, the cart and the declaration agreed with each other and all three
   * were agreed on the wrong number.
   */
  const { patientOwesFor } = await import("@/lib/billing/session-owed");
  const owed = await patientOwesFor(session.id);

  const money = await sessionTransferMoney({
    organizationId: session.organizationId,
    priceCents: owed.grossCents,
  });

  const result = await declarePaid({
    purpose: "session",
    /* The session is both what this pays for and who is paying. See 0105. */
    refId: session.id,
    settlesCents: money.settlesCents,
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


/**
 * 🔴 76.13 — THE SHEET WAS OPENED, so the payment exists from now on.
 *
 * No proof, no claim, nothing for an operator to do. What it buys is the bar in
 * their portal and the fact that a payer who transferred the money and closed
 * the browser has a route back to the one screen that can tell us.
 */
export async function openSessionPayment(token: string): Promise<void> {
  const session = await resolveJoinToken(token);
  if (!session || session.priceCents <= 0 || session.paymentStatus === "paid") return;

  const { organizationNeedsTransfer, sessionTransferMoney } = await import(
    "@/lib/billing/manual-entry"
  );
  if (!(await organizationNeedsTransfer(session.organizationId))) return;

  /*
   * 🔴 76.27 — THE SAME CORRECTION AS THE PAGE, and it has to be here too.
   *
   * These two compute the figure separately, which is the shape that lets a
   * payer be shown one amount and charged another. Both read what the patient
   * still owes after their benefit paid, rather than what the session cost.
   */
  const { patientOwesFor } = await import("@/lib/billing/session-owed");
  const owed = await patientOwesFor(session.id);

  const money = await sessionTransferMoney({
    organizationId: session.organizationId,
    priceCents: owed.grossCents,
  });

  const { openCart } = await import("@/lib/billing/cart");
  const { egpMinorFor, egpRateMicro } = await import("@/lib/billing/manual");

  /*
   * 🔴 76.27 — AND THE LINES ARE STORED WITH IT, which is not optional.
   *
   * `openCart` re-states an open row from what it is given, so a call that
   * omitted the lines CLEARED them. That is exactly what happened: the page
   * computed the split, printed nothing, and the reason was that opening the
   * sheet had just wiped the lines the page was about to read back.
   *
   * The labels are translated here because this is where the row is written,
   * and the row outlives the page: an operator reading a claim next week needs
   * the words the payer saw rather than a key.
   */
  const { sessionLines } = await import("@/lib/billing/session-owed");
  const { getI18n } = await import("@/lib/i18n/server");
  const { t } = await getI18n();

  /*
   * The clinician's name, read here rather than carried on the token's row:
   * `resolveJoinToken` returns the therapist's ID and deliberately little else,
   * which is the right shape for a guard and the wrong one for a label.
   */
  const { controlDb } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const [clinician] = await controlDb
    .select({ first: users.firstName, last: users.lastName })
    .from(users)
    .where(eq(users.id, session.therapistId))
    .limit(1);
  const therapistName = [clinician?.first, clinician?.last].filter(Boolean).join(" ");

  const lineItems = sessionLines({
    owed,
    vatCents: money.vatCents,
    sessionLabel: therapistName
      ? t("transfer.forSessionWith", { name: therapistName })
      : t("transfer.forSession"),
    benefitLabel: t("pay.benefitPaid"),
    vatLabel: t("topup.vat"),
  });

  await openCart({
    purpose: "session",
    refId: session.id,
    amountCents: egpMinorFor(money.settlesCents, await egpRateMicro()),
    settlesCents: money.settlesCents,
    lineItems,
    payer: { kind: "session", organizationId: session.organizationId },
  });
}
