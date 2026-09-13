import type { Metadata } from "next";

import { PartnerManagerList } from "@/components/admin/partner-manager";
import { requireRole } from "@/lib/auth/guard";
import { allPartners, keyCountFor, partnerUsersFor } from "@/lib/data/partner-admin";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Partners", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Integrators. PLAN.md 42.1, 55.2, 55.3, C265.
 *
 * 🔴 The key COUNT rather than the list, and `keyCountFor` is a count query rather than
 * `keysFor(...).length`: a number is what an operator needs to know whether an onboarding
 * stalled, and the prefixes are what somebody pastes into a support ticket.
 */
export default async function AdminPartnersPage() {
  await requireRole("super_admin");
  const { t } = await getI18n();

  const partners = await allPartners();

  const rows = await Promise.all(
    partners.map(async (partner) => {
      const [keyCount, users] = await Promise.all([
        keyCountFor(partner.id),
        partnerUsersFor(partner.id),
      ]);

      return {
        id: partner.id,
        name: partner.name,
        state: partner.state,
        contactName: partner.contactName,
        contactEmail: partner.contactEmail,
        contactPhone: partner.contactPhone,
        intent: partner.intent,
        keyCount,
        users,
      };
    }),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">{t("apartner.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("apartner.body")}</p>
      </div>

      <PartnerManagerList partners={rows} />
    </div>
  );
}
