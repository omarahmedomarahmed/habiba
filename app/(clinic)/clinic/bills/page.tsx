import type { Metadata } from "next";

import { PayClinicBills } from "@/components/clinic/pay-bills";
import { BillPicker } from "@/components/billing/bill-picker";
import {
  cancelClinicBillPayment,
  declareClinicBillTransfer,
  openClinicBillPayment,
  quoteClinicInvoices,
} from "./actions";
import { Card } from "@/components/ui";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";
import { clinicBills, clinicSeatBills } from "@/lib/data/clinic";
import { getI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";
import { Money } from "@/components/ui/money";
import { rich, slot } from "@/lib/i18n/rich";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourBills"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The clinic's bills. PLAN.md 54.7, 54.8, C262, C263.
 *
 * ## 🔴 C263 — AGGREGATED, AND THE REASON IS ON THE SCREEN
 *
 * > *Dr Salma has four patients this week and the clinic's invoice shows three AI fees.
 * > In a caseload that small, set beside the schedule the clinic can already see, that
 * > is a named patient's consent decision reaching their clinician's employer.*
 *
 * So: a period, a session count, a total platform fee, a total AI fee, a total. No line
 * per session, because `clinicBills` never selects `session_id` and the grouping threw
 * it away before the rows left the database.
 *
 * A practice manager reconciling an invoice cannot tie a line to a session, which is a
 * genuine accounting inconvenience and the correct trade. `clinic.billsBody` says so,
 * in those terms, at the top of the screen where they will look for the missing detail.
 *
 * ## 🔴 54.7 — AND THERE IS NO SECOND BILLING SYSTEM BEHIND THIS
 *
 * The clinic is billed through the same path as a solo therapist, and it required no
 * code: `invoices.organization_id` has always been the tenancy, and C259 makes a clinic
 * the tenancy. So `chargeForSession` bills the practice on every session its clinicians
 * run, unchanged, and this page is a different READ of the rows a solo therapist's own
 * billing page already shows itemised to them.
 *
 * That is C226's rule holding in a second place: one billing system, not two.
 */
export default async function ClinicBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  /* 🔴 W2-C01: by name, so a typed URL redirects instead of throwing. */
  const actor = await requireClinicCapability("bills.read");
  const { t, locale } = await getI18n();

  const { checkout } = await searchParams;

  /*
   * 🔴 W2-C03: back from the card checkout. Confirmed here as `/billing`
   * does, so the paid state below is true on this render rather than after
   * the webhook lands; the webhook applies the same outcome either way.
   */
  if (checkout && checkout !== "cancelled") {
    const { confirmCheckout } = await import("@/lib/billing/stripe");
    await confirmCheckout(checkout);
  }

  const [bills, seatBills] = await Promise.all([clinicBills(actor), clinicSeatBills(actor)]);

  /* 🔴 W2-C03 / C3: what is owed now, sessions and seats together. */
  const dueCents =
    bills.reduce((sum, bill) => sum + bill.dueCents, 0) +
    seatBills.reduce((sum, row) => sum + (row.status === "due" ? row.amountCents : 0), 0);

  /*
   * 🔴 T12: a bill row passes its own currency, the field the CSV export writes as
   * a column; a seat row's cents are dollars like every invoice.
   */
  const money = (cents: number, currency = "USD") => <Money cents={cents} currency={currency} />;

  /*
   * 🔴 0150 — AN EGYPTIAN PRACTICE PAYS BY TRANSFER, HERE. The same sheet a
   * solo clinician's bill uses, with the practice as the payer, drawn only
   * for the admin and only when something is owed.
   */
  const { manualEntry, organizationNeedsTransfer } = await import("@/lib/billing/manual-entry");
  const needsTransfer = await organizationNeedsTransfer(actor.clinicOrganizationId);
  const transfer =
    needsTransfer && actor.role === "admin" && dueCents > 0
      ? await (async () => {
          const { billLines } = await import("@/lib/billing/bill-lines");
          const { getDueInvoices, billingSummary } = await import("@/lib/billing/service");
          const { localeTag } = await import("@/lib/i18n/config");
          const [bill, due, summary] = await Promise.all([
            billLines(actor.clinicOrganizationId, []),
            getDueInvoices(actor.clinicOrganizationId),
            billingSummary(actor.clinicOrganizationId),
          ]);
          const rail = await manualEntry({
            audience: "clinic",
            purpose: "subscription",
            refId: actor.clinicOrganizationId,
            payer: { kind: "organization", organizationId: actor.clinicOrganizationId },
            needed: summary.outstandingCents > 0,
            settlesCents: summary.outstandingCents,
            lines: bill.lines,
            locale: localeTag(locale),
          });
          return { rail, due };
        })()
      : null;

  /*
   * 🔴 `formatDate`, not `Intl`, and 37L.9 caught the first draft.
   *
   * The helper gives a day as well as a month, which is more than a billing period needs
   * and is the right trade: one date formatter in the product means one place where the
   * language, the digits and the zone are decided, and a second one here for the sake of
   * dropping a "1" is how C182 happened.
   */
  const month = (at: Date) => formatDate(at, "UTC", locale);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("clinic.billsTitle")}
        </h1>
        {/* 🔴 C263 — why there is no itemised breakdown, where they look for it. */}
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("clinic.billsBody")}</p>

        {/*
          🔴 63.17 / C334 — the export, and only for a principal that holds it.

          Reading a bill on a screen and taking a copy of it away are different acts,
          so `export` is its own capability rather than a consequence of
          `bills.read`. The route checks it again and refuses with a 403; this only
          decides whether a link is drawn.

          A plain link rather than a button: it is a GET that returns a file, which
          is what a browser already knows how to do.
        */}
        {actor.capabilities.includes("export") ? (
          <a
            href="/clinic/export?what=bills"
            className="mt-3 inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("clinic.exportCsv")}
          </a>
        ) : null}
      </div>

      {checkout && checkout !== "cancelled" ? (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          {t("portal.billing.paid")}
        </p>
      ) : null}
      {checkout === "cancelled" ? (
        <p className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600">
          {t("portal.billing.cancelled")}
        </p>
      ) : null}

      {/*
        🔴 W2-C03: WHAT IS OWED, AND THE WAY TO PAY IT.

        Nothing in this portal could pay, and nothing said whether a month was
        settled. The button is the admin's: paying spends the practice's money.
      */}
      {dueCents > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm font-semibold text-slate-900">
            {rich(t("clinic.dueNow", { amount: slot(0) }), [money(dueCents)])}
          </p>
          {actor.role === "admin" && !needsTransfer ? <PayClinicBills amountCents={dueCents} /> : null}
        </Card>
      ) : null}
      {transfer ? (
        <BillPicker
          storageKey={actor.clinicOrganizationId}
          onOpen={openClinicBillPayment}
          quote={quoteClinicInvoices}
          invoices={transfer.due.map((invoice) => ({
            id: invoice.id,
            description: invoice.description,
            cents: invoice.amountCents - invoice.discountCents,
            issuedAt: formatDate(invoice.issuedAt, "UTC", locale),
          }))}
          subject={{
            viewerName: actor.email,
            orgName: actor.clinicName,
            what: t("transfer.subjectBill"),
            payerType: "clinic",
          }}
          details={transfer.rail.details}
          amountLabel={transfer.rail.amountLabel}
          lines={transfer.rail.lines}
          live={transfer.rail.live}
          action={declareClinicBillTransfer}
          onCancel={cancelClinicBillPayment}
        />
      ) : null}

      {/* 🔴 W2-C03 / C3: the seat invoices, which no clinic screen showed. */}
      {seatBills.length > 0 ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-900">{t("clinic.nav.seats")}</p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {seatBills.map((row, index) => (
              <li key={index} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
                <span className="text-slate-600">
                  {month(row.issuedAt)} · {row.description}
                </span>
                <span className="tabular-nums text-slate-800">
                  {money(row.amountCents)}{" "}
                  <span className="text-xs text-slate-500">
                    {row.status === "paid" ? t("sponsor.inv.paid") : row.status === "due" ? t("clinic.due") : null}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {bills.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("clinic.billsEmpty")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => (
            <Card key={bill.periodStart.toISOString()} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{month(bill.periodStart)}</p>
                {/*
                  🔴 C262 — the COUNT is withheld below the floor and the money never is.
                  A month with one session and a bill for it is one patient's consent
                  decision divided by one; a practice still has to be able to pay.
                */}
                <p className="text-xs text-slate-500">
                  {bill.sessions === null
                    ? t("clinic.suppressed")
                    : t("clinic.sessionCount", { count: bill.sessions })}
                  {/* 🔴 W2-C03: settled or not, said on the month itself. */}
                  {bill.dueCents > 0
                    ? ` · ${t("clinic.due")}`
                    : bill.totalCents > 0 && bill.paidCents === bill.totalCents
                      ? ` · ${t("sponsor.inv.paid")}`
                      : null}
                </p>
              </div>

              <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{t("clinic.platformFee")}</dt>
                  <dd className="tabular-nums text-slate-700">
                    {bill.platformFeeCents === null ? t("clinic.suppressed") : money(bill.platformFeeCents, bill.currency)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{t("clinic.aiFee")}</dt>
                  <dd className="tabular-nums text-slate-700">
                    {/* 🔴 K7 / CE33: withheld with the count, or it is the consents priced. */}
                    {bill.aiFeeCents === null ? t("clinic.suppressed") : money(bill.aiFeeCents, bill.currency)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-1">
                  <dt className="font-semibold text-slate-900">{t("clinic.total")}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {money(bill.totalCents, bill.currency)}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
