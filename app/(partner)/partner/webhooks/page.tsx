import type { Metadata } from "next";

import { WebhookList } from "@/components/partner/webhook-list";
import { getI18n } from "@/lib/i18n/server";
import { requirePartner } from "@/lib/partner-auth/guard";
import { webhooksFor } from "@/lib/partner/webhooks";

export const metadata: Metadata = { title: "Your endpoints", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The endpoints. PLAN.md 42.4, 55.2, 55.10.
 *
 * 🔴 `webhooksFor` never selects `secret_sealed`, so the secret does not reach this render
 * even as a sealed blob. It existed in one response, at creation, and after that the only
 * copy anybody can use is the partner's own.
 */
export default async function PartnerWebhooksPage() {
  const actor = await requirePartner();
  const { t } = await getI18n();

  const hooks = await webhooksFor(actor.partnerId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("dev.webhooksTitle")}</h1>

      <WebhookList
        hooks={hooks.map((hook) => ({
          id: hook.id,
          url: hook.url,
          events: hook.events,
          disabled: hook.disabledAt !== null,
        }))}
        canEdit={actor.role === "admin"}
      />
    </div>
  );
}
