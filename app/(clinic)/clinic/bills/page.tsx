import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";
import { clinicBills } from "@/lib/data/clinic";
import { getI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Your bills", robots: { index: false } };
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
export default async function ClinicBillsPage() {
  /* 🔴 W2-C01: by name, so a typed URL redirects instead of throwing. */
  const actor = await requireClinicCapability("bills.read");
  const { t, locale } = await getI18n();

  const bills = await clinicBills(actor);

  const money = (cents: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);

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
                </p>
              </div>

              <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{t("clinic.platformFee")}</dt>
                  <dd className="tabular-nums text-slate-700">{money(bill.platformFeeCents)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{t("clinic.aiFee")}</dt>
                  <dd className="tabular-nums text-slate-700">{money(bill.aiFeeCents)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-1">
                  <dt className="font-semibold text-slate-900">{t("clinic.total")}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {money(bill.totalCents)}
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
