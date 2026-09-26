import type { Metadata } from "next";

import { ShieldCheck, Wallet } from "lucide-react";

import { ClinicHead, Share } from "@/components/clinic/ui";
import { Avatar, Badge, Card, EmptyState, Stat } from "@/components/clinician/kit";
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

/* The same states as colours: waiting is amber, arrived is teal, not processed is grey. */
const PAYOUT_TONE: Record<PayoutStatus, "amber" | "green" | "slate"> = {
  requested: "amber",
  approved: "amber",
  sent: "green",
  confirmed: "green",
  rejected: "slate",
  returned: "slate",
};

export default async function ClinicEarningsPage() {
  const actor = await requireClinicCapability("earnings.read");
  const { t, locale } = await getI18n();

  const rows = await clinicEarnings(actor);

  const money = (cents: number) => <Money cents={cents} />;
  /* The largest earner sets the length of every share bar. */
  const top = Math.max(1, ...rows.map((row) => row.earnedCents));

  return (
    <div>
      <ClinicHead title={t("clinic.earn.title")} subtitle={t("clinic.earn.body")} />

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Wallet className="h-6 w-6" aria-hidden />} title={t("clinic.earn.empty")} />
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 🔴 63.15 — combined, and it is a sum of what is on this page rather
              than a second query that could disagree with the rows under it. */}
          <Stat tone="dark" label={t("clinic.earn.combined")} className="sm:max-w-sm">
            {money(rows.reduce((sum, row) => sum + row.earnedCents, 0))}
          </Stat>

          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((row) => (
              <Card key={row.userId} className="p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={row.name} size={44} />
                  <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-navy-700">{row.name}</p>
                  <p className="shrink-0 text-[20px] font-bold tabular-nums text-navy-700">{money(row.earnedCents)}</p>
                </div>
                <Share value={row.earnedCents / top} className="mt-3" />

                {row.withdrawals.length > 0 ? (
                  <ul className="mt-4 divide-y divide-navy-100/70 border-t border-navy-100 pt-1">
                    {row.withdrawals.map((withdrawal) => (
                      <li
                        key={`${withdrawal.requestedAt.toISOString()}-${withdrawal.amountCents}`}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                      >
                        <span className="text-navy-500">
                          {/* 🔴 T8: the day in the reader's zone, as on the rota. */}
                          {formatDate(withdrawal.requestedAt, actor.zone.name, locale)}
                        </span>
                        <Badge tone={PAYOUT_TONE[withdrawal.status]}>{t(PAYOUT_LABEL[withdrawal.status])}</Badge>
                        <span className="font-semibold tabular-nums text-navy-700">{money(withdrawal.amountCents)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[13px] text-navy-400">{t("clinic.earn.noWithdrawals")}</p>
                )}
              </Card>
            ))}
          </div>

          {/* 🔴 63.14 — said on the screen, because a practice that assumes it can
              move a colleague's money will ask us to, and the answer is no. */}
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-navy-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
            {t("clinic.earn.theirsOnly")}
          </p>
        </div>
      )}
    </div>
  );
}
