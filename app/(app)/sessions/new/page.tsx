import type { Metadata } from "next";

import { listConnections } from "@/lib/data/meeting-connections";
import { PROVIDERS } from "@/lib/meetings/providers";
import { NewSessionForm } from "@/components/session/new-session-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { getConnectAccount } from "@/lib/billing/connect";
import { listPatients } from "@/lib/data/patients";
import { getSettings } from "@/lib/settings";
import { fullName } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "New session", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { t } = await getI18n();
  const actor = await requireUser();
  const [{ welcome }, patients, connect, settings, connections] = await Promise.all([
    searchParams,
    listPatients(actor),
    getConnectAccount(actor.userId),
    getSettings(),
    listConnections(actor),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title={t("portal.sessions.newTitle")}
        subtitle={t("portal.sessions.newSubtitle")}
      />
      <div className="px-4 pb-10 sm:px-6">
        <NewSessionForm
          welcome={welcome === "1"}
          /*
            41.2 — only the providers this clinician has actually connected.
            An option they cannot use is a session that quietly falls back to
            the 24Therapy room, discovered when the patient is already in the
            wrong place.
          */
          connectedProviders={connections.map((connection) => ({
            provider: connection.provider,
            name: PROVIDERS[connection.provider].name,
          }))}
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
