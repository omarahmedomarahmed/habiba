"use server";

import { redirect } from "next/navigation";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { formatUsd } from "@/lib/billing/plans";
import type { SeatQuote } from "@/components/billing/seat-manager";
import {
  cancelSubscription,
  createInvoiceCheckout,
  createSubscriptionCheckout,
  resumeSubscription,
} from "@/lib/billing/stripe";

export type BillingActionState = { error?: string };

/*
 * 🔴 76.34 — `buyCredits` IS GONE, AND SO IS THE SLIDER THAT CALLED IT.
 *
 * It opened a Stripe checkout for a dollar amount chosen on a range input, to
 * buy a balance held against the session and AI fees. Two repricings later the
 * offer is pay as you go, metered by the session, or a plan that meters
 * nothing, and a control that buys credit against fees a plan removes was a
 * third thing to explain on a screen about two.
 *
 * Deleted rather than left exported: `verify:reachable` reports an action no
 * screen calls, and it reported this one the moment the slider came out, which
 * is the gate doing exactly what it is for.
 */
/**
 * 🔴 Sprint 57 — subscribe to a monthly plan.
 *
 * The only thing that crosses the wire is a tier KEY. Not a price, not a
 * duration, not a Stripe price id: `createSubscriptionCheckout` looks the key up
 * in `platform_settings` and refuses anything that is not a live tier with a
 * monthly price. What the client chooses is which plan, never what it costs —
 * the same rule every other amount in this file follows: a price that arrived
 * from a browser is a price somebody can edit.
 */
/*
 * 🔴 76.34 — NOT AN ACTION ANY MORE, because no screen calls it.
 *
 * It was `subscribeTo`, exported, and the plan card called it on the tap of a
 * Subscribe button. That button is gone: choosing a tier now SELECTS, and the
 * confirmation panel's "Confirm and pay" calls `upgradeAndPay`, which raises
 * the bill and opens the sheet in one act.
 *
 * `verify:reachable` reported it as an exported server action no rendered page
 * reaches, which is exactly right and exactly what that gate is for. An action
 * left exported is an endpoint: it is POSTable by anybody with the action id,
 * whether or not a button exists. So it stops being one.
 */
async function startSubscription(tierKey: string): Promise<BillingActionState> {
  const actor = await requireUser();
  if (typeof tierKey !== "string" || tierKey.length === 0 || tierKey.length > 64) {
    return { error: "Choose a plan." };
  }

  /*
   * 🔴 74.3 — AN EGYPTIAN ACCOUNT IS BILLED, NOT SENT TO A CHECKOUT.
   *
   * `createSubscriptionCheckout` has no entity gate, so before this an Egyptian
   * therapist pressing Subscribe went to Stripe and was charged into the US
   * entity — the same blocker `topUpPot` refuses out loud, silently. This
   * raises the month's bill instead and the transfer card below it asks for the
   * money. The plan starts when an operator confirms it arrived, not here.
   */
  const { organizationNeedsTransfer } = await import("@/lib/billing/manual-entry");
  if (await organizationNeedsTransfer(actor.organizationId)) {
    const { subscribeByTransfer } = await import("@/lib/billing/service");
    const raised = await subscribeByTransfer({
      organizationId: actor.organizationId,
      tierKey,
    });
    if (raised.error) return { error: raised.error };

    await audit({
      actor,
      category: "billing",
      action: "subscription.invoiced",
      resourceType: "organization",
      resourceId: actor.organizationId,
      reason: `${tierKey} raised for payment by transfer`,
    });

    revalidatePath("/billing");
    return {};
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

/* ======================================================= the Egyptian rail == */

export type TransferState = { error?: string; ok?: boolean };

/**
 * 🔴 74.2 — A THERAPIST OR CLINIC IN EGYPT PAYS THEIR BILL BY TRANSFER.
 *
 * `payInvoices` above is the card rail and is untouched. The two never both
 * render: the page asks `organizationNeedsTransfer` once.
 *
 * ## 🔴 ONE TRANSFER FOR THE WHOLE BILL, LIKE THE CARD RAIL
 *
 * `createInvoiceCheckout` puts every outstanding invoice into one checkout. A
 * transfer rail that took one invoice at a time would mean a therapist on
 * pay-as-you-go making six bank transfers of $4, and an operator matching them
 * by hand. So `refId` is the ORGANISATION — which also makes the partial unique
 * index mean "one claim in flight per account" — and `grantSubscription`
 * settles oldest first.
 *
 * ## 🔴 AND THE AMOUNT IS READ, NEVER SENT
 *
 * `billingSummary().outstandingCents` is computed from stored invoice rows. A
 * therapist who could type what they owe is a therapist who owes less.
 */
export async function declareBillTransfer(
  _prev: TransferState,
  formData: FormData,
): Promise<TransferState> {
  const actor = await requireUser();

  const { declarePaid, organizationNeedsTransfer } = await import("@/lib/billing/manual-entry");

  /*
   * 🔴 Asked again here rather than trusted from the screen. A form that renders
   * on a condition is a form somebody can post without meeting it.
   */
  if (!(await organizationNeedsTransfer(actor.organizationId))) {
    return { error: "Your account pays by card. Reload the page." };
  }

  const { billingSummary } = await import("@/lib/billing/service");
  const summary = await billingSummary(actor.organizationId);
  if (summary.outstandingCents <= 0) return { error: "You have nothing outstanding." };

  /*
   * 🔴 76.16 — THE OPEN CART'S FIGURE, and the whole bill only if there is none.
   *
   * This used to declare `outstandingCents` unconditionally, which was right
   * while the sheet always meant everything. Once a clinician can choose four of
   * eleven sessions, declaring the total would take a transfer they made for one
   * figure and claim it was for another: the sheet said one number, the row said
   * a second, and an operator matching a bank statement would be reading a third.
   *
   * The row is the one the payer read, so the row wins. `openCart` has already
   * pinned it to this payer and this purpose.
   */
  const { livePaymentFor } = await import("@/lib/billing/manual");
  const open = await livePaymentFor("subscription", actor.organizationId);
  const settlesCents = open?.settlesCents ?? summary.outstandingCents;

  const reference = String(formData.get("reference") ?? "").trim();
  const proof = formData.get("proof");

  let proofUrl: string | null = null;
  if (proof instanceof File && proof.size > 0) {
    const { uploadDocument } = await import("@/lib/uploads");
    const stored = await uploadDocument({
      kind: "receipt",
      userId: actor.userId,
      label: "bill",
      file: proof,
    });
    if (stored.error) return { error: stored.error };
    proofUrl = stored.url ?? null;
  }

  const result = await declarePaid({
    purpose: "subscription",
    refId: actor.organizationId,
    settlesCents,
    /* The lines the payer read, kept on the row they are about to submit. */
    lineItems: open?.lineItems ?? null,
    payer: {
      kind: "user",
      userId: actor.userId,
      organizationId: actor.organizationId,
    },
    reference,
    proofUrl,
  });

  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "bill.transfer.declared",
    resourceType: "organization",
    resourceId: actor.organizationId,
    reason: `Declared a bank transfer for ${formatUsd(settlesCents)}, reference ${reference || "none"}`,
  });

  revalidatePath("/billing");
  return { ok: true };
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


/* ------------------------------------------- 🔴 76.16 · choosing what to pay -- */

/**
 * 🔴 76.16 — WHAT A CHOSEN SET OF INVOICES COSTS, PRICED AND WORDED BY THE SERVER.
 *
 * ## Why a round trip for a number the browser could add up
 *
 * It could add it up and it must not, twice over.
 *
 * The figure is in POUNDS, at a rate only the server holds, and C84 forbids a
 * client component formatting money at all: `Intl` in the browser renders
 * different digits from the server pass, and these are the characters somebody
 * copies into a banking app. The stepper solved the same problem the same way
 * one sprint ago, by holding an index into strings the server wrote.
 *
 * And a total assembled in the browser is a total the browser decided. Every
 * money path in this product reads amounts from stored rows for exactly that
 * reason — `sumPayable` says so in its own comment, and the endpoint it replaced
 * took `price_cents` from a request body.
 *
 * ## 🔴 IT WRITES NOTHING
 *
 * Ticking a box is not a decision to pay. The cart opens when the SHEET opens,
 * which is the moment somebody is going to read an account number, and a quote
 * that opened a row would put every idle tick in front of an operator.
 */
export async function quoteInvoices(invoiceIds: string[]): Promise<{
  amountLabel: string;
  lines: { label: string; amountLabel: string }[];
  totalCents: number;
}> {
  const actor = await requireUser();
  const ids = cleanIds(invoiceIds);

  const { billLines } = await import("@/lib/billing/bill-lines");
  const chosen = await billLines(actor.organizationId, ids);

  const { egpMinorFor, egpRateMicro } = await import("@/lib/billing/manual");
  const { formatMoney } = await import("@/lib/billing/plans");
  const { localeTag } = await import("@/lib/i18n/config");
  const { getI18n } = await import("@/lib/i18n/server");

  const [rateMicro, { locale }] = await Promise.all([egpRateMicro(), getI18n()]);
  const tag = localeTag(locale);
  const egp = (cents: number) => formatMoney(egpMinorFor(cents, rateMicro), "EGP", tag);

  return {
    amountLabel: egp(chosen.totalCents),
    lines: chosen.lines.map((line) => ({ label: line.label, amountLabel: egp(line.cents) })),
    totalCents: chosen.totalCents,
  };
}

/**
 * 🔴 76.13 / 76.16 — a clinician opened their bill, so the payment exists from now on.
 *
 * Same reasoning as the patient's: the row used to appear only on Submit, which
 * is one step after the moment somebody actually goes to their banking app.
 *
 * 🔴 AND IT NOW CARRIES WHICH INVOICES. An empty list means the whole bill,
 * which is both the old behaviour and the honest reading of "they opened the
 * sheet without touching the picker".
 */
export async function openBillPayment(invoiceIds: string[] = []): Promise<void> {
  const actor = await requireUser();

  const { organizationNeedsTransfer } = await import("@/lib/billing/manual-entry");
  if (!(await organizationNeedsTransfer(actor.organizationId))) return;

  const { billLines } = await import("@/lib/billing/bill-lines");
  const chosen = await billLines(actor.organizationId, cleanIds(invoiceIds));
  if (chosen.totalCents <= 0) return;

  const { openCart } = await import("@/lib/billing/cart");
  const { egpMinorFor, egpRateMicro } = await import("@/lib/billing/manual");

  await openCart({
    purpose: "subscription",
    refId: actor.organizationId,
    amountCents: egpMinorFor(chosen.totalCents, await egpRateMicro()),
    settlesCents: chosen.totalCents,
    lineItems: chosen.lines,
    payer: { kind: "user", userId: actor.userId, organizationId: actor.organizationId },
  });
}

/**
 * 🔴 A SERVER ACTION'S ARGUMENT IS UNTRUSTED INPUT, and this one is an array.
 *
 * `billLines` runs it through a WHERE that pins the organisation and the due
 * state, so a foreign id buys nothing. This is the other half: a list long
 * enough to be a denial of service never reaches the query.
 */
function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && id.length <= 64).slice(0, 200);
}

/**
 * 🔴 76.34 — CONFIRM, THEN PAY, IN ONE ACT.
 *
 * ## What it replaces
 *
 * Choosing a plan raised the bill and stopped. The money side then required the
 * clinician to notice a card further down the page, decide it was related, and
 * press a second button. So the commonest sequence was: press Subscribe, see a
 * line item appear, and leave, believing it was done.
 *
 * On the Egyptian rail, where nothing charges anybody automatically, that is a
 * plan somebody thinks they bought and has not paid for.
 *
 * ## The order, which is the whole point
 *
 * The bill is raised FIRST and the cart is opened from what is then due, so the
 * amount in the sheet is read back out of the invoices rather than passed from
 * a browser. `openBillPayment` runs `billLines`, whose WHERE pins the
 * organisation and the due state: a tier key somebody edited buys the plan the
 * server priced, and the sheet asks for what the server billed.
 *
 * ## 🔴 THE STRIPE RAIL IS UNCHANGED AND MUST BE
 *
 * `startSubscription` redirects to a checkout there, which throws a Next redirect
 * rather than returning. Nothing below it runs, and nothing below it should:
 * the payment happens at Stripe and a cart would be a second claim on money
 * already in flight.
 */
export async function upgradeAndPay(tierKey: string): Promise<BillingActionState> {
  const raised = await startSubscription(tierKey);
  if (raised.error) return raised;

  /* Only reached on the transfer rail. Stripe redirected out of the call above. */
  await openBillPayment([]);
  revalidatePath("/billing");
  return {};
}

/**
 * 🔴 76.34 — THE PAYER CHANGED THEIR MIND ABOUT AN OPEN PAYMENT.
 *
 * Scoped to the signed-in clinician, never to an id from the browser, and the
 * server refuses anything past `awaiting_proof` in its own WHERE clause: once
 * proof is in, the payment is a claim about money and belongs to an operator.
 */
export async function cancelBillPayment(): Promise<void> {
  const actor = await requireUser();
  const { cancelCart } = await import("@/lib/billing/cart");
  await cancelCart({ kind: "user", userId: actor.userId, organizationId: actor.organizationId });
  revalidatePath("/billing");
}
