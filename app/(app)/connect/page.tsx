import type { Metadata } from "next";

import { HistoryAsks, RedeemInvite } from "@/components/clinical/connect-panel";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { asksForTherapist } from "@/lib/data/portability";
import { formatDate, fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Connect", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where a clinician meets the patient side of portability. PLAN.md 27.2, 27.7.
 *
 * Two things a patient started: a code they handed over, and a request for the
 * history this clinician holds. Both are on one screen because both are
 * somebody else's initiative arriving, which is a different mental mode from
 * anything else in this product.
 */
export default async function ConnectPage() {
  const actor = await requireUser();
  const asks = await asksForTherapist(actor.userId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Connect"
        subtitle="Codes patients gave you, and people asking for their own history."
      />
      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <RedeemInvite />
        <HistoryAsks
          asks={asks.map((ask) => ({
            id: ask.id,
            name: fullName(ask.firstName, ask.lastName, "A former patient"),
            note: ask.note,
            on: formatDate(ask.createdAt, actor.timezone),
          }))}
        />
      </div>
    </div>
  );
}
