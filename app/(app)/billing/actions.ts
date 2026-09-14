"use server";

import { redirect } from "next/navigation";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { formatUsd } from "@/lib/billing/plans";
import type { SeatQuote } from "@/components/billing/seat-manager";
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

/* ------------------------------------------------------------ 62 · seats -- */

export type SeatState = { error?: string; ok?: boolean };

/**
 * 🔴 62.2 to 62.4 — WHAT THIS COSTS, BEFORE ANYTHING CHANGES.
 *
 * Quoting and applying are two actions on purpose. The whole ruling is that the
 * figure comes first, and a single action that changed the count and returned
 * what it cost would satisfy every other sentence in the sprint.
 */
export async function quoteSeats(
  toSeats: number,
): Promise<{ quote?: SeatQuote; error?: string }> {
  const actor = await requireUser();

  const { quoteSeatChange } = await import("@/lib/billing/seats");
  const change = await quoteSeatChange({
    organizationId: actor.organizationId,
    toSeats,
  });

  return {
    quote: {
      fromSeats: change.fromSeats,
      toSeats: change.toSeats,
      fromMonthlyLabel: formatUsd(change.fromMonthlyCents),
      toMonthlyLabel: formatUsd(change.toMonthlyCents),
      /* 🔴 The absolute value, because the words above it say which direction. */
      proratedLabel: formatUsd(Math.abs(change.proratedCents)),
      proratedCents: change.proratedCents,
      daysRemaining: change.daysRemaining,
    },
  };
}

/**
 * Apply the count the clinic just saw a figure for.
 *
 * 🔴 `fromSeats` is passed back from the quote and guards the write. A second
 * tab that changed the seats in between must not have this applied on top of a
 * number nobody was shown; the clinic re-quotes and agrees again, which is the
 * only honest answer when the thing somebody accepted has moved.
 */
export async function saveSeats(fromSeats: number, toSeats: number): Promise<SeatState> {
  const actor = await requireUser();

  const { applySeatChange } = await import("@/lib/billing/seats");
  const result = await applySeatChange({
    organizationId: actor.organizationId,
    fromSeats,
    toSeats,
  });

  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "seats.changed",
    resourceType: "organization",
    resourceId: actor.organizationId,
    reason: `${fromSeats} to ${toSeats}`,
  });

  revalidatePath("/billing");
  return { ok: true };
}
