import type { Metadata } from "next";

import { RecordsPanel } from "@/components/ehr/records-panel";
import { requireClinic } from "@/lib/clinic-auth/guard";
import { connectionsFor, writebacksFor } from "@/lib/data/ehr";
import { features } from "@/lib/env";
import { whatIsMissing } from "@/lib/ehr/owner";
import { getI18n } from "@/lib/i18n/server";
import { formatDate, formatDateTime } from "@/lib/utils";

import { begin, disconnect } from "./actions";

export const metadata: Metadata = { title: "Your record system", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 43.1c — the practice's home. One of two, and the other is `/settings/records`.
 *
 * 🔴 Both render the SAME `RecordsPanel` and both read `lib/data/ehr`. Two screens that merely
 * agreed would be two places for C266 to be got wrong, and the second would be written by somebody
 * who had not read the first. What differs is one sentence, chosen by `isClinic`.
 */
export default async function ClinicRecordsPage() {
  const actor = await requireClinic();
  const { locale } = await getI18n();

  const [connections, filings] = await Promise.all([
    connectionsFor(actor.clinicOrganizationId),
    writebacksFor(actor.clinicOrganizationId),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <RecordsPanel
        isClinic={true}
        configured={features.ehr}
        missing={whatIsMissing()}
        actions={{ begin, disconnect }}
        filings={filings.map((filing) => ({
          id: filing.id,
          state: filing.state,
          lastError: filing.lastError,
          createdAt: formatDateTime(filing.createdAt, "UTC", locale),
        }))}
        connections={connections.map((connection) => ({
          id: connection.id,
          vendor: connection.vendor,
          tenantLabel: connection.tenantLabel,
          /* 🔴 `formatDate`, not `Intl` (37L.9), and formatted here so no date crosses the
             client boundary as an object. */
          connectedAt: formatDate(connection.connectedAt, "UTC", locale),
          revokedAt: connection.revokedAt ? formatDate(connection.revokedAt, "UTC", locale) : null,
          revokedReason: connection.revokedReason,
        }))}
      />
    </div>
  );
}
