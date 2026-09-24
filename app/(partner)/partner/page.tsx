import type { Metadata } from "next";

import { KeyList } from "@/components/partner/key-list";
import { getI18n } from "@/lib/i18n/server";
import { requirePartner } from "@/lib/partner-auth/guard";
import { keysFor } from "@/lib/partner/keys";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Your keys", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The developer's home, and it is the KEY LIST. PLAN.md 55.2, 55.3, C265.
 *
 * ## 🔴 THE FIRST SCREEN IS KEYS RATHER THAN A DASHBOARD, ON PURPOSE
 *
 * Every other portal in this product opens on something about people: the clinic's opens
 * on this week's schedule, the sponsor's on spend. A partner's opens on credentials,
 * because credentials are the only thing a partner holds. There is no number here about
 * how many patients came through their integration, and there could not be one without
 * counting people on their behalf.
 *
 * ## 🔴 `requirePartner`, NOT `requirePartnerAdmin`
 *
 * A developer debugging an integration needs to see which key is which and whether one is
 * suspended. What they cannot do is mint or revoke: `createKey` and `revoke` each call
 * `requirePartnerAdmin` themselves, so the split is in the action rather than in whether a
 * button is rendered. A hidden button is one bug away from a visible one.
 */
export default async function PartnerKeysPage() {
  const actor = await requirePartner();
  const { t, locale } = await getI18n();

  /*
   * 🔴 C5: no list of our companies. The picker it fed served a scope that moved
   * to the company's own portal, and every partner admin could read every name.
   */
  const keys = await keysFor(actor.partnerId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("dev.keysTitle")}</h1>

      <KeyList
        keys={keys.map((key) => ({
          id: key.id,
          label: key.label,
          prefix: key.prefix,
          scopes: key.scopes,
          environment: key.environment,
          sponsorName: key.sponsorName,
          /* 🔴 Through `formatDate`, not `Intl` (37L.9). Formatted here so the client
             component takes strings and no date arithmetic crosses the boundary. */
          lastUsed: key.lastUsedAt ? formatDate(key.lastUsedAt, "UTC", locale) : null,
          suspendedReason: key.suspendedReason,
          suspended: key.suspendedAt !== null,
          /* 🔴 W2-X04: stopped by the database's clock; a rolled key works until then. */
          revoked: key.stopped,
          stopsAt:
            !key.stopped && key.revokedAt ? formatDateTime(key.revokedAt, "UTC", locale) : null,
        }))}
        canMint={actor.role === "admin"}
      />
    </div>
  );
}
