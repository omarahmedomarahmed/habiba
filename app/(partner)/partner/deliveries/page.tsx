import type { Metadata } from "next";

import { redeliverOne } from "@/app/(partner)/partner/webhooks/actions";
import { TryButton } from "@/components/partner/try-button";
import { Card } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { requirePartner } from "@/lib/partner-auth/guard";
import { deliveriesFor } from "@/lib/partner/webhooks";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Recent deliveries", robots: { index: false } };
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
 */
export default async function PartnerDeliveriesPage() {
  const actor = await requirePartner();
  const { t, locale } = await getI18n();

  const deliveries = await deliveriesFor(actor.partnerId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        {t("dev.deliveriesTitle")}
      </h1>

      {deliveries.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-slate-600">{t("dev.deliveriesEmpty")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {deliveries.map((delivery) => (
            <li key={delivery.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <code className="font-mono text-xs font-semibold text-slate-900">
                    {delivery.event}
                  </code>
                  {/*
                   * 🔴 W2-X03 — THREE STATES, AND "PENDING" NO LONGER MEANS "GAVE UP".
                   * A delivery that used every try says Failed, and one still being
                   * tried says when the next try is.
                   */}
                  <span
                    className={
                      delivery.deliveredAt
                        ? "text-xs font-semibold text-brand-700"
                        : delivery.failedAt
                          ? "text-xs font-semibold text-red-600"
                          : "text-xs font-semibold text-amber-700"
                    }
                  >
                    {delivery.deliveredAt
                      ? t("dev.delivered")
                      : delivery.failedAt
                        ? t("dev.failed")
                        : t("dev.pending")}
                  </span>
                  {!delivery.deliveredAt && !delivery.failedAt && delivery.nextAttemptAt ? (
                    <span className="text-xs text-slate-500">
                      {t("dev.nextTry", {
                        time: formatDateTime(delivery.nextAttemptAt, "UTC", locale),
                      })}
                    </span>
                  ) : null}
                  {delivery.lastStatus !== null ? (
                    <span className="font-mono text-xs text-slate-500">{delivery.lastStatus}</span>
                  ) : null}
                  <span className="text-xs text-slate-500">
                    {t("dev.attempts", { count: String(delivery.attempts) })}
                  </span>
                </div>

                {/* 🔴 The opaque id, exactly as the body carries it. Never a name. */}
                <p className="mt-1 break-all font-mono text-xs text-slate-500">
                  {delivery.subjectId ?? "-"}
                </p>

                <p className="mt-1 break-all font-mono text-xs text-slate-500">{delivery.url}</p>

                {/* 🔴 `formatDateTime`, not `Intl` (37L.9). */}
                <p className="mt-1 text-xs text-slate-500">
                  {formatDateTime(delivery.createdAt, "UTC", locale)}
                </p>

                {delivery.lastError ? (
                  <p className="mt-1 text-xs text-red-600">{delivery.lastError}</p>
                ) : null}

                {/* 🔴 W2-X03 — one try now, by hand. An admin act: it sends a signed request. */}
                {actor.role === "admin" && !delivery.endpointDisabled ? (
                  <TryButton action={redeliverOne} id={delivery.id} labelKey="dev.redeliver" />
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
