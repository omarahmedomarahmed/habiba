import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui";
import { invoiceFor } from "@/lib/billing/invoice";
import { requireSponsor } from "@/lib/sponsor-auth/guard";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The VAT invoice. PLAN.md 53.15, C226, C241.
 *
 * ## 🔴 A SERVER-RENDERED DOCUMENT, PRINTED BY THE BROWSER
 *
 * Not a generated PDF. A PDF means a stored file, a storage bucket and a URL that
 * is a secret rather than an access check — which is H14, the thing sprint 29
 * rebuilt the identity documents to stop doing. This page asks who is calling on
 * every view, and a browser turns it into a PDF perfectly well.
 *
 * ## 🔴 IT NAMES NOBODY WHO IS ENROLLED
 *
 * A corporate invoice is for money. `invoiceFor` reads two ledger legs and the
 * sponsor's own row, and there is no join in it that could reach a person, a
 * session or a date. C244 is about screens, and this is a screen.
 *
 * ## 🔴 IT REFUSES RATHER THAN GUESSING
 *
 * With no legal name, address or tax number in settings, this says what is missing
 * instead of printing a document a finance department will reject. That refusal is
 * C241's precondition made visible: the Egyptian entity cannot take a corporate
 * payment until counsel has confirmed e-invoicing, and `topUpPot` refuses it, so
 * this page can only ever render a US document today.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ txn: string }>;
}) {
  const actor = await requireSponsor();
  const { txn } = await params;

  /*
   * The sponsor id comes from the SESSION and is a condition of the query inside
   * `invoiceFor`. Editing the transaction id in the URL finds nothing rather than
   * finding another organisation's invoice.
   */
  const invoice = await invoiceFor(actor.sponsorId, txn);
  if (!invoice) notFound();

  if ("missing" in invoice) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">
          We cannot issue this document yet.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Ask us for it and we will send it to you. We are missing our own{" "}
          {invoice.missing.join(", ")}.
        </p>
      </Card>
    );
  }

  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency.toUpperCase(),
    }).format(cents / 100);

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-8 print:shadow-none print:ring-0">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-slate-900">{invoice.from.legalName}</p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">
              {invoice.from.address}
            </p>
            <p className="mt-1 text-xs text-slate-600">Tax number {invoice.from.taxId}</p>
          </div>

          <div className="text-end">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Invoice
            </p>
            <p className="font-mono text-sm font-bold text-slate-900">{invoice.number}</p>
            <p className="mt-1 text-xs text-slate-600">
              {invoice.issuedAt.toISOString().slice(0, 10)}
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Billed to
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{invoice.sponsorName}</p>
        </div>

        <table className="mt-8 w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2 text-slate-700">
                Prepayment for therapy sessions on 24Therapy
              </td>
              <td className="py-2 text-end tabular-nums text-slate-900">
                {fmt(invoice.netCents)}
              </td>
            </tr>
            {/*
              🔴 The VAT line is rendered even at zero, and it says the rate.
              A missing line reads as an oversight; a zero line with a rate beside
              it is a statement about the jurisdiction, which is what an invoice is
              for.
            */}
            <tr className="border-b border-slate-100">
              <td className="py-2 text-slate-700">
                VAT at {(invoice.vatBps / 100).toFixed(invoice.vatBps % 100 === 0 ? 0 : 1)}%
              </td>
              <td className="py-2 text-end tabular-nums text-slate-900">
                {fmt(invoice.vatCents)}
              </td>
            </tr>
            <tr>
              <td className="py-3 font-semibold text-slate-900">Paid</td>
              <td className="py-3 text-end font-semibold tabular-nums text-slate-900">
                {fmt(invoice.totalCents)}
              </td>
            </tr>
          </tbody>
        </table>

        {/*
          🔴 53.12 — on the document as well as on the screen that took the money.
          Spendable on sessions here and nothing else, no cash out, no transfer.
        */}
        <p className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
          This amount is held as a balance spendable on therapy sessions on this
          platform. It cannot be withdrawn as cash or transferred, and the refund and
          expiry terms agreed with your account apply.
        </p>
      </Card>
    </div>
  );
}
