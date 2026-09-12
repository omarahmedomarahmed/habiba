"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { createCreditCheckout, createInvoiceCheckout } from "@/lib/billing/stripe";

export type BillingActionState = { error?: string };

/**
 * Buy sessions in advance.
 *
 * The quantity is validated server-side against the tiers in
 * `platform_settings` — `quoteCredits` prices it from the stored rate, never
 * from anything the form sent. The old endpoint this replaces took no quantity
 * at all because there was one product; this one must not take a price.
 */
export async function buyCredits(amountCents: number): Promise<BillingActionState> {
  const actor = await requireUser();
  /*
   * 46.4 — an amount of credit, in cents. The server still prices it from
   * `platform_settings` through `quoteCredits` and never from what the form
   * sent; what the client chooses is how much to add, not what it costs.
   */
  if (!Number.isSafeInteger(amountCents) || amountCents < 100) {
    return { error: "Choose how much credit to add." };
  }

  const result = await createCreditCheckout({
    organizationId: actor.organizationId,
    email: actor.email,
    amountCents,
  });
  if (result.error || !result.url) return { error: result.error ?? "Could not start checkout." };
  redirect(result.url);
}

/**
 * Pay one invoice or twenty — the therapist picks, and gets a single Stripe
 * link for the total.
 */
export async function payInvoices(invoiceIds: string[]): Promise<BillingActionState> {
  const actor = await requireUser();
  if (invoiceIds.length === 0) return { error: "Select at least one invoice." };

  const result = await createInvoiceCheckout({
    organizationId: actor.organizationId,
    invoiceIds,
    email: actor.email,
  });
  if (result.error || !result.url) return { error: result.error ?? "Could not create a payment." };
  redirect(result.url);
}
