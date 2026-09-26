import type { Metadata } from "next";

import { PayClinicBills } from "@/components/clinic/pay-bills";
import { BillPicker } from "@/components/billing/bill-picker";
import {
  cancelClinicBillPayment,
  declareClinicBillTransfer,
  openClinicBillPayment,
  quoteClinicInvoices,
} from "./actions";
import { Armchair, Building2, CheckCircle2, Download, Receipt } from "lucide-react";

import { ClinicHead } from "@/components/clinic/ui";
import { Badge, buttonClass, Card, EmptyState, Glow, IconTile } from "@/components/clinician/kit";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";
import { clinicBills, clinicSeatBills } from "@/lib/data/clinic";
import { getI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";
import { Money } from "@/components/ui/money";
import { rich, slot } from "@/lib/i18n/rich";
import { countKey } from "@/lib/i18n/count-form";
import { parseSeatBill } from "@/lib/billing/seat-label";

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

  /*
   * 🔴 Board 268: a seat line in the reader's language, each count in its own
   * form. "1 seats from 0" was the stored English printed as it was.
   */
  const seats = (n: number) => t(countKey("clinic.seatBill.seats", n), { count: n });
  const seatLine = (description: string) => {
    const parsed = parseSeatBill(description);
    if (!parsed) return description;
    if (parsed.kind === "change") {
      return t("clinic.seatBill.change", {
        seats: seats(parsed.toSeats),
        from: parsed.fromSeats,
        days: t(countKey("clinic.seatBill.days", parsed.days), { count: parsed.days }),
      });
    }
    if (parsed.kind === "month") return t("clinic.seatBill.month", { seats: seats(parsed.seats) });
    return t("clinic.seatBill.planMonth", { plan: parsed.plan, seats: seats(parsed.seats) });
  };

  return (
    <div className="space-y-4">
      {/* 🔴 C263 — why there is no itemised breakdown, where they look for it. */}
      <ClinicHead
        title={t("clinic.billsTitle")}
        subtitle={t("clinic.billsBody")}
        action={
          /*
            🔴 63.17 / C334 — the export, and only for a principal that holds it.

            Reading a bill on a screen and taking a copy of it away are different acts,
            so `export` is its own capability rather than a consequence of
            `bills.read`. The route checks it again and refuses with a 403; this only
            decides whether a link is drawn.

            A plain link rather than a button: it is a GET that returns a file, which
            is what a browser already knows how to do.
          */
          actor.capabilities.includes("export") ? (
            <a href="/clinic/export?what=bills" className={buttonClass("secondary", "sm")}>
              <Download className="h-4 w-4" aria-hidden />
              {t("clinic.exportCsv")}
            </a>
          ) : null
        }
      />

      {checkout && checkout !== "cancelled" ? (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 ring-1 ring-brand-100">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          {t("portal.billing.paid")}
        </p>
      ) : null}
      {checkout === "cancelled" ? (
        <p role="status" className="rounded-2xl bg-white px-4 py-3 text-sm text-navy-500 ring-1 ring-navy-100">
          {t("portal.billing.cancelled")}
        </p>
      ) : null}

      {/*
        🔴 W2-C03: WHAT IS OWED, AND THE WAY TO PAY IT.

        Nothing in this portal could pay, and nothing said whether a month was
        settled. The button is the admin's: paying spends the practice's money.
      */}
      {dueCents > 0 ? (
        <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl bg-navy-900 p-5 text-white sm:p-6">
          <Glow className="-end-16 -top-16 h-48 w-48 opacity-60" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-navy-700">
              <Receipt className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-[22px] font-bold tabular-nums">
              {rich(t("clinic.dueNow", { amount: slot(0) }), [money(dueCents)])}
            </p>
          </div>
          {actor.role === "admin" && !needsTransfer ? (
            <div className="relative">
              <PayClinicBills amountCents={dueCents} />
            </div>
          ) : null}
        </div>
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
          <div className="flex items-center gap-3">
            <IconTile tone="navy">
              <Armchair className="h-5 w-5" aria-hidden />
            </IconTile>
            <h2 className="text-[17px] font-bold text-navy-700">{t("clinic.nav.seats")}</h2>
          </div>
          <ul className="mt-3 divide-y divide-navy-100/70 text-sm">
            {seatBills.map((row, index) => (
              <li key={index} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-0 text-navy-500">
                  {month(row.issuedAt)} · {seatLine(row.description)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums text-navy-700">{money(row.amountCents)}</span>
                  {row.status === "paid" ? (
                    <Badge tone="green">{t("sponsor.inv.paid")}</Badge>
                  ) : row.status === "due" ? (
                    <Badge tone="amber">{t("clinic.due")}</Badge>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* 🔴 Board 268: "Nothing billed yet" under a seat bill was false. */}
      {bills.length === 0 && seatBills.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 className="h-6 w-6" aria-hidden />} title={t("clinic.billsEmpty")} />
        </Card>
      ) : bills.length === 0 ? null : (
        <div className="space-y-3">
          {bills.map((bill) => (
            <Card key={bill.periodStart.toISOString()} className="p-5">
              <div className="flex items-center gap-3">
                <IconTile tone={bill.dueCents > 0 ? "amber" : "navy"}>
                  <Building2 className="h-5 w-5" aria-hidden />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-navy-700">{month(bill.periodStart)}</p>
                  {/*
                    🔴 C262 — the COUNT is withheld below the floor and the money never is.
                    A month with one session and a bill for it is one patient's consent
                    decision divided by one; a practice still has to be able to pay.
                  */}
                  <p className="text-[13px] text-navy-400">
                    {bill.sessions === null
                      ? t("clinic.suppressed")
                      : t(countKey("clinic.sessionCount", bill.sessions), { count: bill.sessions })}
                  </p>
                </div>
                {/* 🔴 W2-C03: settled or not, said on the month itself. */}
                {bill.dueCents > 0 ? (
                  <Badge tone="amber">{t("clinic.due")}</Badge>
                ) : bill.totalCents > 0 && bill.paidCents === bill.totalCents ? (
                  <Badge tone="green">{t("sponsor.inv.paid")}</Badge>
                ) : null}
              </div>

              <dl className="mt-4 space-y-1.5 border-t border-navy-100 pt-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-navy-400">{t("clinic.platformFee")}</dt>
                  <dd className="tabular-nums text-navy-600">
                    {bill.platformFeeCents === null ? t("clinic.suppressed") : money(bill.platformFeeCents, bill.currency)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-navy-400">{t("clinic.aiFee")}</dt>
                  <dd className="tabular-nums text-navy-600">
                    {/* 🔴 K7 / CE33: withheld with the count, or it is the consents priced. */}
                    {bill.aiFeeCents === null ? t("clinic.suppressed") : money(bill.aiFeeCents, bill.currency)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-navy-100 pt-2">
                  <dt className="font-bold text-navy-700">{t("clinic.total")}</dt>
                  <dd className="text-[17px] font-bold tabular-nums text-navy-700">
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
