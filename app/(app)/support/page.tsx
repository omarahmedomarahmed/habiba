import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";

import { TherapistSupport } from "@/components/support/therapist-support";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { payoutRequests, sessions, supportTickets } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/support/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export const metadata: Metadata = { title: "Support", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * A clinician's own support page. PLAN.md 20.23–20.26.
 *
 * Their recent sessions and payout requests are offered as *context* to attach
 * (20.25) — chosen from a list rather than typed, so staff get an id rather
 * than a description. The list is scoped to this clinician by the same
 * `therapistId` every other query here uses; there is no path to anybody
 * else's.
 */
export default async function TherapistSupportPage() {
  const actor = await requireUser();

  const [recentSessions, payouts, mine] = await Promise.all([
    db
      .select({ id: sessions.id, at: sessions.scheduledAt, createdAt: sessions.createdAt })
      .from(sessions)
      .where(eq(sessions.therapistId, actor.userId))
      .orderBy(desc(sessions.createdAt))
      .limit(10),
    db
      .select({
        id: payoutRequests.id,
        amountCents: payoutRequests.amountCents,
        status: payoutRequests.status,
        requestedAt: payoutRequests.requestedAt,
      })
      .from(payoutRequests)
      .where(eq(payoutRequests.therapistId, actor.userId))
      .orderBy(desc(payoutRequests.requestedAt))
      .limit(5),
    db
      .select({
        reference: supportTickets.reference,
        topic: supportTickets.topic,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
      })
      .from(supportTickets)
      .where(eq(supportTickets.userId, actor.userId))
      .orderBy(desc(supportTickets.createdAt))
      .limit(10),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Support"
        subtitle="A person reads this, and answers within a day."
      />

      <div className="px-4 pb-10 sm:px-6">
        <TherapistSupport
          sessions={recentSessions.map((row) => ({
            id: row.id,
            label: formatDate(row.at ?? row.createdAt, actor.timezone),
          }))}
          payouts={payouts.map((row) => ({
            id: row.id,
            label: `$${(row.amountCents / 100).toFixed(2)} · ${row.status} · ${formatDate(row.requestedAt, actor.timezone)}`,
          }))}
          mine={mine.map((row) => ({
            reference: row.reference,
            topic: row.topic,
            status: row.status,
            atLabel: formatDate(row.createdAt, actor.timezone),
          }))}
        />
      </div>
    </div>
  );
}
