import type { Metadata } from "next";

import { PageHeader } from "@/components/clinician/kit";
import { DeliveryLog } from "@/components/partner/delivery-log";
import { getI18n } from "@/lib/i18n/server";
import { requirePartner } from "@/lib/partner-auth/guard";
import { deliveriesFor } from "@/lib/partner/webhooks";
import { formatDateTime } from "@/lib/utils";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.recentDeliveries"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The delivery log a developer debugs from. PLAN.md 42.4, 55.2, 55.10.
 *
 * ## 🔴 IT SHOWS THE WHOLE BODY, AND THAT IS THE POINT OF THE SCREEN
 *
 * An event, an id, the attempt count, the HTTP status and the error. There is no "view
 * payload" link because what is rendered here IS the payload: three fields. A developer who
 * expected a session object finds out on the screen where they came looking for it, which is
 * cheaper than finding out from a contract.
 *
 * ## 🔴 THE SUBJECT ID IS OPAQUE AND STAYS OPAQUE
 *
 * A uuid, never resolved to a name here. Resolving it would make this screen the patient
 * list the portal does not have: an event log that says WHO would be a roster ordered by
 * time, which is worse than a roster.
 *
 * A `requirePartner` rather than an admin guard, because this is the screen a developer
 * needs most. Its one act, Redeliver (W2-X03), is an admin's, checked in the action.
 *
 * The rows are drawn by `DeliveryLog`, which adds the mockup's filter over the same list.
 * Dates are formatted here, so no date arithmetic crosses to the client.
 */
export default async function PartnerDeliveriesPage() {
  const actor = await requirePartner();
  const { t, locale } = await getI18n();

  const deliveries = await deliveriesFor(actor.partnerId);

  return (
    <div>
      <PageHeader title={t("dev.deliveriesTitle")} />

      <div className="px-4 sm:px-6">
        <DeliveryLog
          deliveries={deliveries.map((delivery) => {
            const state = delivery.deliveredAt ? "delivered" : delivery.failedAt ? "failed" : "pending";
            return {
              id: delivery.id,
              event: delivery.event,
              state,
              nextTry:
                state === "pending" && delivery.nextAttemptAt
                  ? /* 🔴 `formatDateTime`, not `Intl` (37L.9). */
                    formatDateTime(delivery.nextAttemptAt, "UTC", locale)
                  : null,
              lastStatus: delivery.lastStatus,
              attempts: delivery.attempts,
              subjectId: delivery.subjectId,
              url: delivery.url,
              at: formatDateTime(delivery.createdAt, "UTC", locale),
              lastError: delivery.lastError,
              canRedeliver: actor.role === "admin" && !delivery.endpointDisabled,
            } as const;
          })}
        />
      </div>
    </div>
  );
}
