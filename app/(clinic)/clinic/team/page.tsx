import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";

import { ClinicTeam } from "@/components/clinic/team";
import { DELEGABLE } from "@/lib/clinic-auth/capabilities";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";
import { clinicClinicians } from "@/lib/data/clinic";
import { rolesFor, staffFor } from "@/lib/data/clinic-team";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourTeam"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * The practice's own staff, and what each of them can do. PLAN.md 63.3, 63.4, 63.8.
 *
 * ## 🔴 THE PAGE ASKS FOR `team.manage`, AND THAT IS NOT WHAT KEEPS ANYBODY OUT
 *
 * `requireClinicCapability` redirects somebody who followed a link they cannot use,
 * which is a courtesy. The permission is `refuseWithout` inside every query and
 * `requireClinicAdmin` on every write in `actions.ts`. C325's whole point is that a
 * route guard is a navigation filter wearing a guard's clothes, so this one is the
 * third lock rather than the first.
 *
 * ## 🔴 WHY THE CLINICIAN LIST IS HERE AT ALL
 *
 * Because assignments are the thing that makes a capability scoped, and choosing them
 * means seeing names. It comes through `clinicClinicians`, which takes the principal
 * and checks `people.read` on the resource like everything else: a team screen does
 * not get its own back door to the clinician list.
 */
export default async function ClinicTeamPage() {
  const actor = await requireClinicCapability("team.manage");

  const [roles, staff, clinicians] = await Promise.all([
    rolesFor(actor.clinicOrganizationId),
    staffFor(actor.clinicOrganizationId),
    /*
     * 🔴 Only when they may read people. A practice manager with `team.manage` and
     * not `people.read` can still set roles; the assignment checkboxes are simply
     * empty, which is the honest rendering of "you cannot see the clinician list".
     */
    actor.capabilities.includes("people.read") ? clinicClinicians(actor) : Promise.resolve([]),
  ]);

  return (
    <ClinicTeam
      isAdmin={actor.role === "admin"}
      selfId={actor.clinicManagerId}
      grantable={[...DELEGABLE]}
      roles={roles}
      staff={staff.map((person) => ({
        id: person.id,
        email: person.email,
        name: person.name,
        isAdmin: person.role === "admin",
        roleId: person.roleId,
        roleName: person.roleName,
        assigned: person.assigned.map((row) => row.userId),
        invited: Boolean(person.invited),
      }))}
      clinicians={clinicians.map((clinician) => ({
        userId: clinician.userId,
        name: clinician.name,
      }))}
    />
  );
}
