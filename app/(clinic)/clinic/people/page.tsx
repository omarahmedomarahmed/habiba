import type { Metadata } from "next";

import { ClinicPeopleList } from "@/components/clinic/people-list";
import { requireClinic } from "@/lib/clinic-auth/guard";
import { clinicClinicians, clinicInvitations } from "@/lib/data/clinic";

export const metadata: Metadata = { title: "Your clinicians", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The clinic's clinicians. PLAN.md 54.4, 54.5, 54.11, C267.
 *
 * 🔴 A viewer reads this list; an admin invites and removes. The write actions call
 * `requireClinicAdmin` themselves rather than relying on the controls not rendering,
 * because a hidden control is a control somebody reaches with a form post.
 */
export default async function ClinicPeoplePage() {
  const actor = await requireClinic();

  const [people, invitations] = await Promise.all([
    clinicClinicians(actor.clinicOrganizationId),
    clinicInvitations(actor.clinicOrganizationId),
  ]);

  return (
    <ClinicPeopleList
      canManage={actor.role === "admin"}
      people={people.map((person) => ({
        userId: person.userId,
        name: person.name,
        email: person.email,
        verificationStatus: person.verificationStatus,
      }))}
      invitations={invitations
        .filter((row) => row.state === "sent")
        .map((row) => ({
          id: row.id,
          email: row.email,
          name: [row.firstName, row.lastName].filter(Boolean).join(" "),
          state: row.state,
        }))}
    />
  );
}
