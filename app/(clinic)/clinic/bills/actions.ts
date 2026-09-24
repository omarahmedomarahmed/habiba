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
