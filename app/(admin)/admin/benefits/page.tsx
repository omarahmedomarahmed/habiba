import type { Metadata } from "next";

import { PausedBenefits, type PausedRow } from "@/components/admin/paused-benefits";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { pausedBenefits } from "@/lib/data/enrolment-verify";

export const metadata: Metadata = { title: "Paused benefits", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * C247's one step, and the queue that makes sure somebody takes it.
 *
 * PLAN.md 53.19b, C227, C231, C244, C247.
 *
 * ## 🔴 WHY THIS IS ITS OWN PAGE AND NOT A BLOCK ON `/admin/sponsors`
 *
 * The sponsors page says so itself: *"Not who is enrolled. An operational
 * screen about a commercial account has no business listing the people an
 * employer funds, because the first thing that happens to such a list is that
 * somebody screenshots it for the customer who asked."*
 *
 * That reasoning holds, and it is exactly why the remedy could not go there. A
 * paused-benefit queue is not the roster: it is short, it has a job attached to
 * every row, and it is organised by the person waiting rather than by the
 * company paying. Putting it beside a customer's account details is what would
 * turn it into something to screenshot.
 *
 * ## 🔴 AND IT IS NOT A SPONSOR SURFACE
 *
 * C244's wall is about what a payer can reach. Nothing here is reachable by a
 * sponsor user: the route is inside `(admin)`, the guard is `super_admin`, and
 * `lib/data/sponsors.ts` (the sponsor's own reader) does not import this
 * module. The sponsor is never told that one of their people paused, because
 * C227 rules they see no event about any individual at all.
 */
export default async function AdminBenefitsPage() {
  await requireRole("super_admin");

  const paused = await pausedBenefits();
  const now = Date.now();

  const rows: PausedRow[] = paused.map((row) => {
    const days = row.pausedAt
      ? Math.max(0, Math.floor((now - row.pausedAt.getTime()) / 86_400_000))
      : 0;

    return {
      enrolmentId: row.enrolmentId,
      name: [row.firstName, row.lastName].filter(Boolean).join(" "),
      email: row.email,
      sponsorName: row.sponsorName,
      identifierKind: row.identifierKind,
      pausedLabel: days === 0 ? "Paused today" : days === 1 ? "1 day" : `${days} days`,
      daysPaused: days,
    };
  });

  return (
    <div>
      <PageHeader
        title="Paused benefits"
        subtitle="Funding stopped because a re-verification went unanswered. Longest wait first."
      />

      <div className="px-4 pb-6 sm:px-6">
        <PausedBenefits rows={rows} />
      </div>
    </div>
  );
}
