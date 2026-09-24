import type { Metadata } from "next";

import { RecordsPanel } from "@/components/ehr/records-panel";
import { requireUser } from "@/lib/auth/guard";
import { mayRunOrgAccount } from "@/lib/auth/org-authority";
import { connectionsFor, filersOn, isClinicOrganization, writebacksFor } from "@/lib/data/ehr";
import { orgKindOf } from "@/lib/data/org-kind";
import { features } from "@/lib/env";
import { whatIsMissing } from "@/lib/ehr/owner";
import { getI18n } from "@/lib/i18n/server";
import { formatDate, formatDateTime } from "@/lib/utils";

import { begin, disconnect } from "./actions";

export const metadata: Metadata = { title: "Your record system", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 43.1c — the solo clinician's home. One of two, and the other is `/clinic/records`.
 *
 * 🔴 Both render the SAME `RecordsPanel` and both read `lib/data/ehr`. Two screens that merely
 * agreed would be two places for C266 to be got wrong, and the second would be written by somebody
 * who had not read the first. What differs is one sentence, chosen by `isClinic`.
 */
export default async function SettingsRecordsPage() {
  const actor = await requireUser();
  const { locale } = await getI18n();

  const [connections, filings, filers, onClinicPlan, kind] = await Promise.all([
    connectionsFor(actor.organizationId),
    writebacksFor(actor.organizationId),
    /* 🔴 67.7 — what stops filing if they disconnect. */
    filersOn(actor.organizationId),
    /*
     * 🔴 67.1 — the ORGANISATION's kind, because what a records connection needs is
     * an organisation that outlives one person. A solo practice is told what to use
     * instead rather than shown a disabled button.
     */
    isClinicOrganization(actor.organizationId),
    orgKindOf(actor.organizationId),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <RecordsPanel
        isClinic={false}
        /*
         * 🔴 67.1 — A SOLO PRACTICE IS TOLD WHY, NOT SHOWN A DISABLED BUTTON.
         *
         * This page is reached by a clinician through their own settings, so the
         * organisation is a solo one unless they are also on a clinic account, in
         * which case the clinic portal is where this belongs. `onClinicPlan` is the
         * ORGANISATION's kind rather than a plan tier, because what a records
         * connection needs is an organisation that outlives one person.
         */
        onClinicPlan={onClinicPlan}
        /* 🔴 W1-02: a clinic seat clinician reads the clinic's connection and cannot change it. */
        canManage={mayRunOrgAccount(kind)}
        filers={filers}
        configured={features.ehr}
        missing={whatIsMissing()}
        actions={{ begin, disconnect }}
        filings={filings.map((filing) => ({
          id: filing.id,
          state: filing.state,
          lastError: filing.lastError,
          /* 🔴 67.5 — the status their server returned, and whose note it was. */
          responseStatus: filing.responseStatus,
          approvedBy:
            [filing.approvedByFirstName, filing.approvedByLastName].filter(Boolean).join(" ") ||
            null,
          createdAt: formatDateTime(filing.createdAt, "UTC", locale),
        }))}
        connections={connections.map((connection) => ({
          id: connection.id,
          vendor: connection.vendor,
          tenantLabel: connection.tenantLabel,
          /* 🔴 `formatDate`, not `Intl` (37L.9), and formatted here so no date crosses the
             client boundary as an object. */
          connectedAt: formatDate(connection.connectedAt, "UTC", locale),
          /* 🔴 67.4 — a call that returned, not an exchange that completed. */
          lastSuccessAt: connection.lastSuccessAt
            ? formatDateTime(connection.lastSuccessAt, "UTC", locale)
            : null,
          lastError: connection.lastError,
          revokedAt: connection.revokedAt ? formatDate(connection.revokedAt, "UTC", locale) : null,
          revokedReason: connection.revokedReason,
        }))}
      />
    </div>
  );
}
