import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";
import { clinicEarnings } from "@/lib/data/clinic";
import type { PayoutStatus } from "@/lib/db/schema";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatDate } from "@/lib/utils";
import { Money } from "@/components/ui/money";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.earnings"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * What the practice's clinicians have earned. PLAN.md 63.14, 63.15, 63.16, C331.
 *
 * ## 🔴 63.15 — A DIFFERENT PAGE FROM THE THERAPIST'S OWN, NOT THE SAME ONE FILTERED
 *
 * > *A therapist's own earnings page and a clinic earnings page are different pages.
 * > A dual-role human has both, and the clinic one can never move a colleague's
 * > money.*
 *
 * The therapist's is `/billing` in the clinician portal and it has a withdraw button.
 * This one is in the clinic portal, reads through the wall, and has no control on it
 * that moves anything: `requestPayout` takes a clinician's `Actor`, which nothing in
 * this route group can produce, so the absence is the type system rather than a
 * missing button somebody could add.
 *
 * ## 🔴 WHAT A WITHDRAWAL ROW SHOWS, AND WHAT IT DOES NOT
 *
 * A date, an amount and a state. No bank account, no wallet number, no method. A
 * practice reading an account number off a screen is a practice that can be
 * social-engineered into changing one, and the route the money takes belongs to the
 * person the money belongs to.
 */
/*
 * 🔴 T19: A WITHDRAWAL'S STATE, AS A WORD, IN THE READER'S LANGUAGE.
 *
 * The row printed `withdrawal.status`, so a practice manager reading in Arabic met
 * `requested` and `confirmed` in English, as stored. A `Record` over the closed set
 * means a new state added to `PAYOUT_STATUSES` does not compile until it has a
 * label here, rather than reaching this screen as a raw code again.
 *
 * `returned` (the transfer bounced back) reads "Not processed", as it does on the
 * clinician's own withdrawals screen: from where the practice sits, the money did
 * not arrive, and two screens naming one state two ways is a support ticket.
 */
const PAYOUT_LABEL: Record<PayoutStatus, MessageKey> = {
  requested: "clinic.payout.requested",
  approved: "clinic.payout.approved",
  sent: "clinic.payout.sent",
  confirmed: "clinic.payout.confirmed",
  rejected: "clinic.payout.rejected",
  returned: "clinic.payout.rejected",
};

export default async function ClinicEarningsPage() {
  const actor = await requireClinicCapability("earnings.read");
  const { t, locale } = await getI18n();

  const rows = await clinicEarnings(actor);

  const money = (cents: number) => <Money cents={cents} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("clinic.earn.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("clinic.earn.body")}</p>
      </div>

      {rows.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("clinic.earn.empty")}</p>
        </Card>
      ) : (
        <>
          {/* 🔴 63.15 — combined, and it is a sum of what is on this page rather
              than a second query that could disagree with the rows under it. */}
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("clinic.earn.combined")}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {money(rows.reduce((sum, row) => sum + row.earnedCents, 0))}
            </p>
          </Card>

          {rows.map((row) => (
            <Card key={row.userId} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                <p className="text-sm font-bold tabular-nums text-slate-900">
                  {money(row.earnedCents)}
                </p>
              </div>

              {row.withdrawals.length > 0 ? (
                <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-1">
                  {row.withdrawals.map((withdrawal) => (
                    <li
                      key={`${withdrawal.requestedAt.toISOString()}-${withdrawal.amountCents}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                    >
                      <span className="text-slate-600">
                        {/* 🔴 T8: the day in the reader's zone, as on the rota. */}
                        {formatDate(withdrawal.requestedAt, actor.zone.name, locale)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {t(PAYOUT_LABEL[withdrawal.status])}
                      </span>
                      <span className="tabular-nums text-slate-800">
                        {money(withdrawal.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t("clinic.earn.noWithdrawals")}</p>
              )}
            </Card>
          ))}

          {/* 🔴 63.14 — said on the screen, because a practice that assumes it can
              move a colleague's money will ask us to, and the answer is no. */}
          <p className="text-xs leading-relaxed text-slate-500">{t("clinic.earn.theirsOnly")}</p>
        </>
      )}
    </div>
  );
}
