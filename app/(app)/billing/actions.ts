"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import {
  cancelSubscription,
  createChargeCheckout,
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

export async function paySessionCharge(chargeId: string): Promise<BillingActionState> {
  const actor = await requireUser();
  const url = await createChargeCheckout({
    organizationId: actor.organizationId,
    chargeId,
    email: actor.email,
  });
  if (!url) return { error: "That charge could not be prepared for payment." };
  redirect(url);
}

export async function downgrade(): Promise<BillingActionState> {
  const actor = await requireUser();
  await cancelSubscription(actor.organizationId);
  revalidatePath("/billing");
  return {};
}
