import type { Metadata } from "next";

import { TeamList } from "@/components/partner/team-list";
import { getI18n } from "@/lib/i18n/server";
import { requirePartner } from "@/lib/partner-auth/guard";
import { teamFor } from "@/lib/partner/team";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourTeam"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-X06: THE TEAM. Everybody on the account reads it; only an admin adds or
 * removes, and `invite` and `remove` check that themselves.
 *
 * Email, name, role and whether they have chosen a password yet. Never a password
 * hash, never when anybody signed in: this is a list of colleagues, not a log.
 */
export default async function PartnerTeamPage() {
  const actor = await requirePartner();
  const { t } = await getI18n();

  const team = await teamFor(actor.partnerId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("dev.teamTitle")}</h1>

      <TeamList
        team={team.map((member) => ({
          id: member.id,
          email: member.email,
          name: member.name,
          role: member.role,
          invited: member.invited,
          you: member.id === actor.partnerUserId,
        }))}
        canEdit={actor.role === "admin"}
      />
    </div>
  );
}
