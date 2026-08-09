"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import {
  cancelSubscription,
  createInvoiceCheckout,
  createSubscriptionCheckout,
} from "@/lib/billing/stripe";

export type BillingActionState = { error?: string };

export async function upgradeToUnlimited(): Promise<BillingActionState> {
  const actor = await requireUser();
  const url = await createSubscriptionCheckout({
    organizationId: actor.organizationId,
    email: actor.email,
  });
  if (!url) return { error: "Payments are not configured on this deployment." };
  redirect(url);
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

export async function downgrade(): Promise<BillingActionState> {
  const actor = await requireUser();
  await cancelSubscription(actor.organizationId);
  revalidatePath("/billing");
  return {};
}
