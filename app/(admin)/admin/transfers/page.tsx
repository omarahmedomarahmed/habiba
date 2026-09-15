import type { Metadata } from "next";

import { TransferQueue } from "@/components/admin/transfer-queue";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/guard";
import { queue } from "@/lib/billing/manual";
import { controlDb as db } from "@/lib/db";
import { patientAccounts, sponsors, users } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Transfers", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The manual rail's queue. PLAN.md 73.2.
 *
 * ## 🔴 `requireStaff`, not `requireRole("super_admin")`
 *
 * This is the opposite ruling from `/admin/financial-model`, and for the
 * opposite reason. A person is sitting on a spinner waiting to join a therapy
 * session, and the whole design of the rail assumes somebody is watching it by
 * the minute. Locking it to the two founders would mean the queue is worked when
 * they are awake, which is not what a person in a crisis at 2am needs.
 *
 * ## 🔴 The queue is oldest first, and that is not a preference
 *
 * Newest first means the person who has waited longest waits longest, forever,
 * whenever the queue is busier than the people working it. Every queue in this
 * product is oldest first for the same reason.
 */
export default async function TransfersPage() {
  await requireStaff();

  const rows = await queue();

  /*
   * 🔴 The payer's NAME, resolved here, because a queue of uuids is a queue
   * nobody can work. Three lookups rather than three joins: the queue is capped
   * at 200 and the alternative is a query with three LEFT JOINs whose result a
   * reader cannot check by eye.
   */
  const userIds = rows.map((r) => r.userId).filter((x): x is string => Boolean(x));
  const patientIds = rows.map((r) => r.patientAccountId).filter((x): x is string => Boolean(x));
  const sponsorIds = rows.map((r) => r.sponsorId).filter((x): x is string => Boolean(x));

  const [people, accounts, orgs] = await Promise.all([
    userIds.length > 0
      ? db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users)
      : Promise.resolve([]),
    patientIds.length > 0
      ? db.select({ id: patientAccounts.id, email: patientAccounts.email }).from(patientAccounts)
      : Promise.resolve([]),
    sponsorIds.length > 0
      ? db.select({ id: sponsors.id, name: sponsors.name }).from(sponsors)
      : Promise.resolve([]),
  ]);

  const nameFor = (row: (typeof rows)[number]): string => {
    if (row.userId) {
      const u = people.find((p) => p.id === row.userId);
      return u ? `${u.firstName} ${u.lastName}` : "A clinician";
    }
    if (row.patientAccountId) {
      const a = accounts.find((p) => p.id === row.patientAccountId);
      return a?.email ?? "A patient";
    }
    const s = orgs.find((p) => p.id === row.sponsorId);
    return s?.name ?? "A company";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transfers"
        subtitle="Sent by bank transfer, waiting to be checked."
      />
      <TransferQueue
        rows={rows.map((r) => ({
          id: r.id,
          purpose: r.purpose,
          amountCents: r.amountCents,
          currency: r.currency,
          settlesCents: r.settlesCents,
          reference: r.reference,
          proofUrl: r.proofUrl,
          submittedAt: r.submittedAt?.toISOString() ?? null,
          payer: nameFor(r),
        }))}
      />
    </div>
  );
}
