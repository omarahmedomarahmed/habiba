import type { Metadata } from "next";

import { PartnerManagerList } from "@/components/admin/partner-manager";
import { requireRole } from "@/lib/auth/guard";
import { allPartners, keyCountFor, partnerUsersFor, practicesFor } from "@/lib/data/partner-admin";
import { getI18n } from "@/lib/i18n/server";
import { closedMonthBill } from "@/lib/partner/billing";

import { markMonthPaid } from "./actions";

export const metadata: Metadata = { title: "Partners", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Integrators. PLAN.md 42.1, 55.2, 55.3, C265.
 *
 * 🔴 The key COUNT rather than the list, and `keyCountFor` is a count query rather than
 * `keysFor(...).length`: a number is what an operator needs to know whether an onboarding
 * stalled, and the prefixes are what somebody pastes into a support ticket.
 */
export default async function AdminPartnersPage() {
  await requireRole("super_admin");
  const { t } = await getI18n();

  const partners = await allPartners();

  const rows = await Promise.all(
    partners.map(async (partner) => {
      const [keyCount, users, practices] = await Promise.all([
        keyCountFor(partner.id),
        partnerUsersFor(partner.id),
        /* Board 611: the practices on their bill, which their live key can reach. */
        practicesFor(partner.id),
      ]);

      return {
        id: partner.id,
        name: partner.name,
        state: partner.state,
        contactName: partner.contactName,
        contactEmail: partner.contactEmail,
        contactPhone: partner.contactPhone,
        intent: partner.intent,
        /* 🔴 68.21 — what the owner reads before approving a production key. */
        documentsUrl: partner.documentsUrl,
        approvedAt: partner.approvedAt?.toISOString() ?? null,
        keyCount,
        users,
        practices,
      };
    }),
  );

  /* Last month's posted bill for each partner, and whether staff marked it paid. */
  const now = new Date();
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const bills = (
    await Promise.all(
      partners.map(async (partner) => {
        const bill = await closedMonthBill({ partnerId: partner.id, periodStart: lastMonth });
        return bill?.posted
          ? {
              partnerId: partner.id,
              name: partner.name,
              month: lastMonth.toISOString().slice(0, 7),
              totalCents: bill.totalCents,
              paidOn: bill.paidAt ? bill.paidAt.toISOString().slice(0, 10) : null,
            }
          : null;
      }),
    )
  ).filter((bill): bill is NonNullable<typeof bill> => bill !== null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">{t("apartner.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("apartner.body")}</p>
      </div>

      <PartnerManagerList partners={rows} />

      {/*
        A partner's month is invoiced and paid by bank transfer, outside the
        product. This is where staff say it arrived, which is the only thing
        that takes it off what the partner owes on our books.
      */}
      {bills.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-900">{t("apartner.bills")}</h2>
          <p className="text-xs text-slate-600">{t("apartner.billsBody")}</p>
          <ul className="divide-y divide-slate-100">
            {bills.map((bill) => (
              <li key={bill.partnerId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-sm">
                <span className="font-medium text-slate-900">{bill.name}</span>
                <span className="tabular-nums text-slate-600">
                  {bill.month} · ${(bill.totalCents / 100).toFixed(2)}
                </span>
                {bill.paidOn ? (
                  <span className="text-xs font-semibold text-emerald-700">
                    {t("apartner.billPaid", { date: bill.paidOn })}
                  </span>
                ) : (
                  <form action={markMonthPaid} className="ms-auto flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-amber-700">{t("apartner.billUnpaid")}</span>
                    <input type="hidden" name="partnerId" value={bill.partnerId} />
                    <input type="hidden" name="month" value={bill.month} />
                    <input
                      name="reference"
                      required
                      minLength={4}
                      aria-label={t("apartner.billRef")}
                      placeholder={t("apartner.billRef")}
                      className="h-9 w-40 rounded-lg border border-slate-300 px-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
                    >
                      {t("apartner.markPaid")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
