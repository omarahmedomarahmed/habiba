import type { Metadata } from "next";

import { TransferQueue } from "@/components/admin/transfer-queue";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/guard";
import { and, eq, inArray } from "drizzle-orm";

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

  /*
   * ⚠️ 76.11 — THESE THREE HAD NO `WHERE` AND READ THE WHOLE TABLE.
   *
   * The ids were collected three lines up and then not used: each select
   * pulled every user, every patient account and every sponsor in the
   * database, and `nameFor` searched the result in memory. Correct output,
   * and a query that grows with the product rather than with the queue.
   */
  const [people, accounts, orgs] = await Promise.all([
    userIds.length > 0
      ? db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            organizationId: users.organizationId,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : Promise.resolve([]),
    patientIds.length > 0
      ? db
          .select({ id: patientAccounts.id, email: patientAccounts.email })
          .from(patientAccounts)
          .where(inArray(patientAccounts.id, patientIds))
      : Promise.resolve([]),
    sponsorIds.length > 0
      ? db
          .select({ id: sponsors.id, name: sponsors.name })
          .from(sponsors)
          .where(inArray(sponsors.id, sponsorIds))
      : Promise.resolve([]),
  ]);

  /*
   * 🔴 76.11 — HOW MANY CLINICIANS EACH PAYING PRACTICE HAS, which is what
   * separates a therapist from a clinic. The same question the billing screen
   * asks of the seat bill, asked here of the roster because this queue has no
   * subscription in hand.
   */
  const payingOrgIds = [
    ...new Set(people.map((p) => p.organizationId).filter((x): x is string => Boolean(x))),
  ];
  const rosters = payingOrgIds.length > 0
    ? await db
        .select({ organizationId: users.organizationId, id: users.id })
        .from(users)
        .where(and(inArray(users.organizationId, payingOrgIds), eq(users.role, "therapist")))
    : [];
  const clinicianCount = (orgId: string | null) =>
    orgId ? rosters.filter((r) => r.organizationId === orgId).length : 0;

  /*
   * 🔴 76.11 — WHICH KIND OF PAYER THIS IS, from the column that identifies them.
   *
   * The payer columns are mutually exclusive by CHECK constraint
   * (`manual_payments_one_payer`), so this is a read rather than a guess. A
   * clinician paying under a practice with more than one clinician is billed as
   * a clinic, which is the same rule `manualEntry` applies when it chooses
   * which heading to show them.
   */
  const typeFor = (row: (typeof rows)[number]): "patient" | "therapist" | "clinic" | "company" => {
    if (row.sponsorId) return "company";
    if (row.userId) {
      const u = people.find((p) => p.id === row.userId);
      return clinicianCount(u?.organizationId ?? null) > 1 ? "clinic" : "therapist";
    }
    return "patient";
  };

  /*
   * 🔴 Where an operator goes to see the rest of the story, and null when there
   * is nowhere to go. A guest paying for a session has no account at all, which
   * is the whole point of the `session` payer kind: asking somebody to sign up
   * before a crisis session would be the wrong trade.
   */
  const profileFor = (row: (typeof rows)[number]): string | null => {
    if (row.sponsorId) return `/admin/sponsors/${row.sponsorId}`;
    if (row.userId) return `/admin/therapists/${row.userId}`;
    if (row.patientAccountId) return `/admin/patients/${row.patientAccountId}`;
    return null;
  };

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
          payerType: typeFor(r),
          profileHref: profileFor(r),
        }))}
      />
    </div>
  );
}
