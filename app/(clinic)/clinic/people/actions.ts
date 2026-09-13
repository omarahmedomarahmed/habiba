"use server";

import { revalidatePath } from "next/cache";

import { requireClinicAdmin } from "@/lib/clinic-auth/guard";
import { inviteClinician, removeClinician, revokeInvitation } from "@/lib/data/clinic-admin";
import { env } from "@/lib/env";
import { notify } from "@/lib/notify";
import { CLINIC_JOIN } from "@/lib/routing";

export type PeopleState = { error?: string; ok?: boolean; link?: string };

/**
 * The clinic's people. PLAN.md 54.4, 54.5, 54.11, C261, C266, C267.
 *
 * 🔴 `requireClinicAdmin` on all three. Inviting somebody commits the practice to paying
 * for that clinician's sessions (54.7); removing one moves them to their own practice
 * and disconnects the clinic's meeting accounts (C266). Neither is a read.
 *
 * 🔴 THERE IS NO ACTION HERE THAT VERIFIES ANYBODY, and that is C267 rather than an
 * omission. The obvious build lets a hospital mark its own therapists verified, because
 * the hospital employs them and already checked; accept it once and "only certified
 * therapists" becomes "certified, or somebody said so". Anything arriving later that
 * wants to do it has to add it in front of this paragraph.
 */
export async function invite(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  const actor = await requireClinicAdmin();

  const email = String(formData.get("email") ?? "");

  const result = await inviteClinician({
    clinicOrganizationId: actor.clinicOrganizationId,
    byManagerId: actor.clinicManagerId,
    email,
    phone: String(formData.get("phone") ?? "") || null,
    firstName: String(formData.get("firstName") ?? "") || null,
    lastName: String(formData.get("lastName") ?? "") || null,
  });

  if (result.error || !result.token) {
    return { error: result.error ?? "That invitation could not be sent." };
  }

  const link = `${env.appUrl}${CLINIC_JOIN}/${result.token}`;

  /*
   * 🔴 Sent by us, to the clinician, on both channels. Best effort.
   *
   * The link is ALSO returned to the manager, and that is deliberate rather than a
   * convenience: our mail domain is not verified yet (11.7), so `notify` reports
   * `sent: false` rather than delivering, and a practice onboarding six people on a
   * Tuesday needs a way through that does not depend on us. Telling them the link
   * exists is more honest than a screen that says "invitation sent" when nothing was.
   *
   * 🔴 The message names the practice and says nothing about therapy, patients or
   * anybody's care. It is an invitation to a job account.
   */
  await notify(
    { email: email.trim().toLowerCase(), phone: String(formData.get("phone") ?? "") || null },
    {
      kind: "claim.invite",
      subject: "You have been invited to a practice on 24Therapy",
      body: `${actor.clinicName} has invited you to join their practice on 24Therapy. Open the link to set a password. You verify your own licence with us afterwards.`,
      link: { label: "Open the invitation", url: link },
    },
  );

  revalidatePath("/clinic/people");
  return { ok: true, link };
}

export async function cancelInvitation(invitationId: string): Promise<PeopleState> {
  const actor = await requireClinicAdmin();
  await revokeInvitation(actor.clinicOrganizationId, invitationId);
  revalidatePath("/clinic/people");
  return { ok: true };
}

/** 🔴 54.11 / C266 — they move to a practice of their own and the connections go. */
export async function remove(userId: string): Promise<PeopleState> {
  const actor = await requireClinicAdmin();

  const result = await removeClinician({
    clinicOrganizationId: actor.clinicOrganizationId,
    userId,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/clinic/people");
  return { ok: true };
}
