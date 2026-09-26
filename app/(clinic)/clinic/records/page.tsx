import type { Metadata } from "next";

import { RecordsPanel } from "@/components/ehr/records-panel";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";
import { connectionsFor, filersOn, writebacksFor } from "@/lib/data/ehr";
import { features } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { formatDate, formatDateTime } from "@/lib/utils";

import { begin, disconnect } from "./actions";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourRecordSystem"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 43.1c — the practice's home. One of two, and the other is `/settings/records`.
 *
 * 🔴 Both render the SAME `RecordsPanel` and both read `lib/data/ehr`. Two screens that merely
 * agreed would be two places for C266 to be got wrong, and the second would be written by somebody
 * who had not read the first. What differs is one sentence, chosen by `isClinic`.
 */
export default async function ClinicRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ ehr?: string }>;
}) {
  /*
   * 🔴 W2-C01: the capability its tab asks for. It was `requireClinic`, so
   * any staff member reached clinician names and raw vendor errors here.
   */
  const actor = await requireClinicCapability("team.manage");
  const { locale } = await getI18n();

  const [connections, filings, filers] = await Promise.all([
    connectionsFor(actor.clinicOrganizationId),
    writebacksFor(actor.clinicOrganizationId),
    /* 🔴 67.7 — what stops filing if they disconnect, as a number, before they do. */
    filersOn(actor.clinicOrganizationId),
  ]);

  return (
    <div className="max-w-3xl">
      <RecordsPanel
        /* 🔴 W2-C06: how the connection just went, from the callback. */
        outcome={(await searchParams).ehr ?? null}
        /* 🔴 W1-22: the same gate as both actions: `requireClinicAdmin`. */
        canManage={actor.role === "admin"}
        isClinic={true}
        /*
         * 🔴 67.1 — THIS PORTAL IS THE CLINIC PLAN.
         *
         * `requireClinic` only resolves for an organisation whose `kind` is `clinic`
         * and whose `clinic_state` is active: both conditions are in
         * `getClinicActor`'s WHERE clause. Somebody reaching this page has the plan
         * by construction, so the gate here is `true` rather than a second lookup
         * that could disagree with the session that let them in.
         */
        onClinicPlan={true}
        filers={filers}
        configured={features.ehr}
        actions={{ begin, disconnect }}
        /* 🔴 T8: every time below in the reader's zone (`actor.zone`), not UTC. */
        filings={filings.map((filing) => ({
          id: filing.id,
          state: filing.state,
          lastError: filing.lastError,
          /* 🔴 67.5 — the status their server returned, and whose note it was. */
          responseStatus: filing.responseStatus,
          approvedBy:
            [filing.approvedByFirstName, filing.approvedByLastName].filter(Boolean).join(" ") ||
            null,
          createdAt: formatDateTime(filing.createdAt, actor.zone.name, locale),
        }))}
        connections={connections.map((connection) => ({
          id: connection.id,
          vendor: connection.vendor,
          tenantLabel: connection.tenantLabel,
          /* 🔴 `formatDate`, not `Intl` (37L.9), and formatted here so no date crosses the
             client boundary as an object. */
          connectedAt: formatDate(connection.connectedAt, actor.zone.name, locale),
          /* 🔴 67.4 — a call that returned, not an exchange that completed. */
          lastSuccessAt: connection.lastSuccessAt
            ? formatDateTime(connection.lastSuccessAt, actor.zone.name, locale)
            : null,
          lastError: connection.lastError,
          revokedAt: connection.revokedAt ? formatDate(connection.revokedAt, actor.zone.name, locale) : null,
          revokedReason: connection.revokedReason,
        }))}
      />
    </div>
  );
}
