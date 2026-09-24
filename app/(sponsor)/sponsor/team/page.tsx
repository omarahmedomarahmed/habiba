import type { Metadata } from "next";

import { Team } from "@/components/sponsor/team";
import { sponsorTeam } from "@/lib/data/sponsor-users";
import { getI18n } from "@/lib/i18n/server";
import { requireSponsor } from "@/lib/sponsor-auth/guard";

export const metadata: Metadata = { title: "Team", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-S05 — the company's own logins. Every one was made by an operator, so a
 * company could not add a colleague, take a leaver's access away or change who
 * may make changes. A viewer sees the list and can change their own password.
 */
export default async function SponsorTeamPage() {
  const actor = await requireSponsor();
  const { t } = await getI18n();
  const rows = await sponsorTeam(actor.sponsorId);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("sponsor.nav.team")}</h1>
      <Team
        rows={rows.map((row) => ({
          id: row.id,
          email: row.email,
          role: row.role,
          invited: row.invited,
        }))}
        me={actor.sponsorUserId}
        canManage={actor.role === "admin"}
      />
    </div>
  );
}
