import type { Metadata } from "next";

import { SupportQueue } from "@/components/admin/support-queue";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/guard";
import { queueFor, queueHealth } from "@/lib/data/support";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Support", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The support queues. PLAN.md 20.18–20.26, §3d.
 *
 * 🔴 This page imports `lib/data/support` and nothing clinical. That is 20.9
 * enforced structurally rather than promised: *"a staff member helping a
 * patient sees the ticket, not the patient's account"*, and there is no query
 * on this screen that could return one. The sprint 20 verifier asserts the
 * import graph of every page behind `requireStaff`.
 */
export default async function SupportPage() {
  const actor = await requireStaff();
  const manager = actor.role === "manager" || actor.role === "super_admin";

  const [patient, therapist, health] = await Promise.all([
    queueFor("patient"),
    queueFor("therapist"),
    manager ? queueHealth() : Promise.resolve({ byAudience: [], byOwner: [] }),
  ]);

  const shape = (rows: Awaited<ReturnType<typeof queueFor>>) =>
    rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      name: row.name,
      topic: row.topic,
      status: row.status,
      locale: row.locale,
      ownerName: row.ownerName,
      ageHours: row.ageHours,
      overdue: row.overdue,
      waiting: row.status === "waiting_on_them",
      extended: row.extendedAt !== null,
      movedToWhatsapp: row.movedToWhatsappAt !== null,
      hasContext: row.hasContext,
      createdAtLabel: formatDate(row.createdAt, actor.timezone, "en"),
    }));

  return (
    <div>
      <PageHeader
        title="Support"
        subtitle="Two queues, because they are two jobs. Oldest deadline first."
      />

      <SupportQueue
        patient={shape(patient)}
        therapist={shape(therapist)}
        canSeeHealth={manager}
        health={health.byAudience.map((row) => ({
          audience: row.audience,
          open: row.open,
          waiting: row.waiting,
          overdue: row.overdue,
          unowned: row.unowned,
        }))}
      />
    </div>
  );
}
