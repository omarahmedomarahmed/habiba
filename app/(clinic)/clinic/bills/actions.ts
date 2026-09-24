"use server";

import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { requireClinicAdmin } from "@/lib/clinic-auth/guard";

export type PayState = { error?: string };

/**
 * 🔴 W2-C03: THE PRACTICE PAYS ITS OWN BILL, FROM ITS OWN PORTAL.
 *
 * W1-02 took `payInvoices` away from seat clinicians (it was the clinic's
 * money), and nothing in the clinic portal could pay, so a practice's bill had
 * no screen anybody could pay it from. This is the same card checkout the solo
 * portal uses, over every invoice due on the practice's account.
 *
 * 🔴 The invoices are read HERE, by organisation and due state, never taken
 * from the form: `sumPayable` pins both again inside `createInvoiceCheckout`.
 * The admin only, like every other act that spends the practice's money.
 *
 * 🔴 NOT the Egyptian rail. A bank transfer is declared by a payer row, and
 * the manual rail has no payer kind for a clinic principal yet; an Egyptian
 * practice is refused here in a sentence rather than sent to a card checkout
 * in the wrong entity (the 74.3 mistake).
 */
export async function payClinicBills(): Promise<PayState> {
  const actor = await requireClinicAdmin();

  const { organizationNeedsTransfer } = await import("@/lib/billing/manual-entry");
  if (await organizationNeedsTransfer(actor.clinicOrganizationId)) {
    const { getI18n } = await import("@/lib/i18n/server");
    const { t } = await getI18n();
    return { error: t("clinic.payByTransfer") };
  }

  const { getDueInvoices } = await import("@/lib/billing/service");
  const due = await getDueInvoices(actor.clinicOrganizationId);
  if (due.length === 0) return {};

  const { createInvoiceCheckout } = await import("@/lib/billing/stripe");
  const result = await createInvoiceCheckout({
    organizationId: actor.clinicOrganizationId,
    invoiceIds: due.map((row) => row.id),
    email: actor.email,
    returnPath: "/clinic/bills",
  });
  if (result.error || !result.url) return { error: result.error ?? "Could not create a payment." };

  await audit({
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "billing",
    action: "clinic.bills.checkout",
    resourceType: "organization",
    resourceId: actor.clinicOrganizationId,
    reason: `${due.length} invoice(s)`,
  });

  redirect(result.url);
}

/* ======================================================= the Egyptian rail == */

/**
 * 🔴 0150: AN EGYPTIAN PRACTICE PAYS ITS BILL BY TRANSFER, FROM ITS OWN PORTAL.
 *
 * The same sheet and the same four steps as a solo clinician's bill
 * (`app/(app)/billing/actions.ts`), with the PRACTICE as the payer. Admin
 * only, like every act that spends the practice's money; the invoices and
 * the amount are read here, never taken from the form.
 */
export type ClinicTransferState = { error?: string; ok?: boolean };

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && id.length <= 64).slice(0, 200);
}

export async function quoteClinicInvoices(invoiceIds: string[]): Promise<{
  amountLabel: string;
  lines: { label: string; amountLabel: string }[];
  totalCents: number;
}> {
  const actor = await requireClinicAdmin();
  const { billLines } = await import("@/lib/billing/bill-lines");
  const chosen = await billLines(actor.clinicOrganizationId, cleanIds(invoiceIds));
  const { egpMinorFor, egpRateMicro } = await import("@/lib/billing/manual");
  const { formatDisplay } = await import("@/lib/money/convert");
  const { localeTag } = await import("@/lib/i18n/config");
  const { getI18n } = await import("@/lib/i18n/server");
  const [rateMicro, { locale }] = await Promise.all([egpRateMicro(), getI18n()]);
  const egp = (cents: number) => formatDisplay(egpMinorFor(cents, rateMicro), "EGP", localeTag(locale));
  return {
    amountLabel: egp(chosen.totalCents),
    lines: chosen.lines.map((line) => ({ label: line.label, amountLabel: egp(line.cents) })),
    totalCents: chosen.totalCents,
  };
}

export async function openClinicBillPayment(invoiceIds: string[] = []): Promise<void> {
  const actor = await requireClinicAdmin();
  const { organizationNeedsTransfer } = await import("@/lib/billing/manual-entry");
  if (!(await organizationNeedsTransfer(actor.clinicOrganizationId))) return;
  const { billLines } = await import("@/lib/billing/bill-lines");
  const chosen = await billLines(actor.clinicOrganizationId, cleanIds(invoiceIds));
  if (chosen.totalCents <= 0) return;
  const { openCart } = await import("@/lib/billing/cart");
  const { egpMinorFor, egpRateMicro } = await import("@/lib/billing/manual");
  await openCart({
    purpose: "subscription",
    refId: actor.clinicOrganizationId,
    amountCents: egpMinorFor(chosen.totalCents, await egpRateMicro()),
    settlesCents: chosen.totalCents,
    lineItems: chosen.lines,
    payer: { kind: "organization", organizationId: actor.clinicOrganizationId },
  });
}

export async function cancelClinicBillPayment(): Promise<void> {
  const actor = await requireClinicAdmin();
  const { cancelCart } = await import("@/lib/billing/cart");
  await cancelCart({ kind: "organization", organizationId: actor.clinicOrganizationId });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/clinic/bills");
}

export async function declareClinicBillTransfer(
  _prev: ClinicTransferState,
  formData: FormData,
): Promise<ClinicTransferState> {
  const actor = await requireClinicAdmin();
  const { declarePaid, organizationNeedsTransfer } = await import("@/lib/billing/manual-entry");
  if (!(await organizationNeedsTransfer(actor.clinicOrganizationId))) {
    return { error: "Your practice pays by card. Reload the page." };
  }
  const { billingSummary } = await import("@/lib/billing/service");
  const summary = await billingSummary(actor.clinicOrganizationId);
  if (summary.outstandingCents <= 0) return { error: "Nothing is outstanding." };

  const { livePaymentFor } = await import("@/lib/billing/manual");
  const open = await livePaymentFor("subscription", actor.clinicOrganizationId);
  const settlesCents = open?.settlesCents ?? summary.outstandingCents;

  const reference = String(formData.get("reference") ?? "").trim();
  const proof = formData.get("proof");
  let proofUrl: string | null = null;
  if (proof instanceof File && proof.size > 0) {
    const { uploadDocument } = await import("@/lib/uploads");
    const stored = await uploadDocument({ kind: "receipt", userId: actor.clinicManagerId, label: "clinic-bill", file: proof });
    if (stored.error) return { error: stored.error };
    proofUrl = stored.url ?? null;
  }

  const result = await declarePaid({
    purpose: "subscription",
    refId: actor.clinicOrganizationId,
    settlesCents,
    lineItems: open?.lineItems ?? null,
    payer: { kind: "organization", organizationId: actor.clinicOrganizationId },
    reference,
    proofUrl,
  });
  if (result.error) return { error: result.error };

  await audit({
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "billing",
    action: "clinic.bills.transfer_declared",
    resourceType: "organization",
    resourceId: actor.clinicOrganizationId,
    reason: `settles ${settlesCents} cents, reference ${reference || "none"}`,
  });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/clinic/bills");
  return { ok: true };
}
