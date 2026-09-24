import type { Metadata } from "next";

import { UsageMeter } from "@/components/partner/usage-meter";
import { requirePartner } from "@/lib/partner-auth/guard";
import { closedMonthBill } from "@/lib/partner/billing";
import { usageFor } from "@/lib/partner/usage";

export const metadata: Metadata = { title: "Usage", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 68.15 — THE LIMIT THEY SET, WHAT THEY HAVE SPENT, AND THE PROJECTION.
 *
 * > *THEY set the limit, and we never exceed it.*
 *
 * The projection is the reason this page is worth having. "412 of 500" is a fact
 * somebody reads on the 3rd and forgets; "on course for 780" is a decision.
 *
 * ## 🔴 AND THE SENTENCE ABOUT WHAT HAPPENS AT THE LIMIT IS ON THIS PAGE
 *
 * Not in the docs, not in an email nobody kept: on the screen where somebody sets the
 * number. What happens at the limit is unusual enough that an integrator will assume
 * the usual thing — an overage charge — unless told otherwise here.
 */
export default async function PartnerUsagePage() {
  const actor = await requirePartner();
  const usage = await usageFor(actor.partnerId);

  /*
   * 🔴 68.19 — LAST MONTH'S BILL, ON THE SAME PAGE AS THIS MONTH'S METER.
   *
   * *The invoice they can hand to their finance team.* It is read rather than posted
   * here, from the same function the cron posts from, so the figure somebody sees
   * before it arrives is the figure that arrives. A bill an integrator sees for the
   * first time when it lands is a bill they dispute.
   *
   * 🔴 C15: and once it is posted, the figure is the LEDGER's. `billFor` prices
   * the month at today's setting, so a reprice rewrote a bill already sent.
   */
  const lastMonth = new Date(
    Date.UTC(usage.periodStart.getUTCFullYear(), usage.periodStart.getUTCMonth() - 1, 1),
  );
  const bill = await closedMonthBill({ partnerId: actor.partnerId, periodStart: lastMonth });

  return (
    <UsageMeter
      limit={usage.limit}
      used={usage.used}
      projected={usage.projected}
      stopped={usage.stopped}
      /* 🔴 Only an admin changes what the account spends. The same rule as keys. */
      canChange={actor.role === "admin"}
      periodLabel={usage.periodStart.toISOString().slice(0, 7)}
      lastMonth={
        bill && bill.sessions > 0
          ? {
              label: bill.periodStart.toISOString().slice(0, 7),
              sessions: bill.sessions,
              perSessionCents: bill.perSessionCents,
              totalCents: bill.totalCents,
            }
          : null
      }
    />
  );
}
