import type { Metadata } from "next";

import { NewSessionForm } from "@/components/session/new-session-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getConnectAccount } from "@/lib/billing/connect";
import { listPatients } from "@/lib/data/patients";
import { getSettings } from "@/lib/settings";
import { fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "New session", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const actor = await requireUser();
  const [{ welcome }, patients, connect, settings] = await Promise.all([
    searchParams,
    listPatients(actor),
    getConnectAccount(actor.userId),
    getSettings(),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="New session" subtitle="One field, then you are recording." />
      <div className="px-4 pb-10 sm:px-6">
        <NewSessionForm
          welcome={welcome === "1"}
          // Charging is offered only once Stripe will actually accept the money.
          // Showing the control before then produces a link that takes a
          // patient to a checkout that cannot complete.
          payments={
            connect.chargesEnabled
              ? {
                  defaultRateCents: connect.sessionRateCents,
                  feeBps: settings.session.platformFeeBps,
                  minPriceCents: settings.session.minPriceCents,
                  maxPriceCents: settings.session.maxPriceCents,
                }
              : undefined
          }
          patients={patients.map((p) => ({
            id: p.id,
            name: fullName(p.firstName, p.lastName, "Unnamed"),
            email: p.email,
          }))}
        />
      </div>
    </div>
  );
}
