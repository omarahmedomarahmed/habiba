"use server";

import { redirect } from "next/navigation";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import {
  cancelSubscription,
  createCreditCheckout,
  createInvoiceCheckout,
  createSubscriptionCheckout,
  resumeSubscription,
} from "@/lib/billing/stripe";

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
 * 🔴 Sprint 57 — subscribe to a monthly plan.
 *
 * The only thing that crosses the wire is a tier KEY. Not a price, not a
 * duration, not a Stripe price id: `createSubscriptionCheckout` looks the key up
 * in `platform_settings` and refuses anything that is not a live tier with a
 * monthly price. What the client chooses is which plan, never what it costs —
 * the same rule `buyCredits` follows above, and for the same reason.
 */
export async function subscribeTo(tierKey: string): Promise<BillingActionState> {
  const actor = await requireUser();
  if (typeof tierKey !== "string" || tierKey.length === 0 || tierKey.length > 64) {
    return { error: "Choose a plan." };
  }

  const result = await createSubscriptionCheckout({
    organizationId: actor.organizationId,
    email: actor.email,
    tierKey,
  });
  if (result.error || !result.url) return { error: result.error ?? "Could not start checkout." };
  redirect(result.url);
}

/**
 * Stop the plan renewing, keeping the month already paid for.
 *
 * 🔴 No confirmation step here and none wanted: cancelling is reversible with
 * `resumePlan` until the period actually ends, and an undo that works is worth
 * more than a dialog that asks "are you sure".
 */
export async function cancelPlan(): Promise<BillingActionState> {
  const actor = await requireUser();
  await cancelSubscription(actor.organizationId);
  revalidatePath("/billing");
  return {};
}

/** Undo a cancellation that has not taken effect yet. */
export async function resumePlan(): Promise<BillingActionState> {
  const actor = await requireUser();
  const ok = await resumeSubscription(actor.organizationId);
  revalidatePath("/billing");
  return ok ? {} : { error: "That plan has already ended. Subscribing again starts a new month." };
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
