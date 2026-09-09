import type { Metadata } from "next";

import { NumberQueue } from "@/components/admin/number-queue";
import { Card, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/guard";
import { LOCK_DAYS, openChanges } from "@/lib/data/phone-change";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Number changes", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The number-change queue. PLAN.md 20.13–20.17, §3d.
 *
 * 🔴 Like `/admin/support`, this page can reach a *request* and never an
 * account: `lib/data/phone-change.ts` is the only data module it imports, and
 * nothing in it selects a patient, a session or a note.
 */
export default async function NumbersPage() {
  const actor = await requireStaff();
  const rows = await openChanges();

  return (
    <div>
      <PageHeader
        title="Number changes"
        subtitle="The identity a patient's whole record hangs on. Check the new number yourself."
      />

      <Card className="mb-4 p-4 text-sm leading-relaxed text-slate-600">
        A confirmed number is locked for {LOCK_DAYS} days, and a correction inside the first day
        after signing up is not a change at all, a mistyped digit must not trap somebody outside
        their own record for three months.
      </Card>

      <NumberQueue
        rows={rows.map((row) => ({
          id: row.id,
          oldPhone: row.oldPhone,
          newPhone: row.newPhone,
          reason: row.reason,
          status: row.status,
          ageHours: row.ageHours,
          approved: row.status === "approved" || row.status === "verifying",
          createdAtLabel: formatDate(row.createdAt, actor.timezone),
          codeExpiresLabel: row.verificationExpiresAt
            ? formatDate(row.verificationExpiresAt, actor.timezone)
            : null,
        }))}
      />
    </div>
  );
}
