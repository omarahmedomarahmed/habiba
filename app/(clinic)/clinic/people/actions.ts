"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
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
   * 🔴 W2-C02: THE SEAT THIS INVITATION NEEDS, BOUGHT AS QUOTED.
   *
   * The form carries the count it was quoted against only when there was no
   * free seat. `applySeatChange` refuses if that count has moved, and raises
   * the proration invoice when it has not: the same function and the same
   * guard as the seats page. After the invitation rather than before, so a
   * refused address never buys a seat.
   */
  const from = Number(formData.get("seatFrom") ?? NaN);
  const to = Number(formData.get("seatTo") ?? NaN);
  let seatError: string | undefined;
  /* Only ever upward, and never by more than the form could have quoted. */
  if (Number.isInteger(from) && Number.isInteger(to) && to > from && to - from <= 50) {
    const { applySeatChange } = await import("@/lib/billing/seats");
    const seat = await applySeatChange({
      organizationId: actor.clinicOrganizationId,
      fromSeats: from,
      toSeats: to,
    });
    seatError = seat.error;
    if (!seat.error) {
      await audit({
        actor: null,
        clinicManagerId: actor.clinicManagerId,
        category: "billing",
        action: "seats.changed",
        resourceType: "organization",
        resourceId: actor.clinicOrganizationId,
        reason: `${from} to ${to}, for an invitation`,
      });
    }
  }

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

  /*
   * 🔴 0086 — INVITING SOMEBODY COMMITS THE PRACTICE TO PAYING FOR THEIR SESSIONS.
   *
   * 54.7. Until 0086 no clinic act wrote a single audit row, which meant the
   * question "who added this clinician to the practice, and when" had no answer
   * in the product at all: the invitation row says who was invited and the
   * membership says they joined, and neither says which manager did it.
   *
   * 🔴 The row names the INVITATION and no patient. `audit` refuses a clinic
   * manager beside a patient id outright, because a manager is inside the
   * tenancy and sees none of the clinical record.
   */
  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "admin",
    action: "clinic.invited",
    resourceType: "clinic_invitation",
    resourceId: result.invitationId ?? null,
  });

  revalidatePath("/clinic/people");
  revalidatePath("/clinic/seats");
  return { ok: true, link, ...(seatError ? { error: seatError } : {}) };
}

export async function cancelInvitation(invitationId: string): Promise<PeopleState> {
  const actor = await requireClinicAdmin();
  await revokeInvitation(actor.clinicOrganizationId, invitationId);

  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "admin",
    action: "clinic.invitation_cancelled",
    resourceType: "clinic_invitation",
    resourceId: invitationId,
  });

  revalidatePath("/clinic/people");
  return { ok: true };
}

/** 🔴 54.11 / C266 — they move to a practice of their own and the connections go. */
export async function remove(
  userId: string,
  /** 🔴 W2-C02 / C4: the seat count the release was quoted against, when a seat comes free. */
  seatFrom: number | null = null,
): Promise<PeopleState> {
  const actor = await requireClinicAdmin();

  const result = await removeClinician({
    clinicOrganizationId: actor.clinicOrganizationId,
    userId,
  });

  if (result.error) return { error: result.error };

  /*
   * 🔴 W2-T05: AND THEY ARE TOLD, by email as well as in their app.
   *
   * Best effort, like the invitation: the in-app notice `removeClinician`
   * wrote is the one that cannot fail to arrive. Nothing about any patient;
   * where their account stands and where their sessions went.
   */
  if (result.clinicianEmail) {
    /* 🔴 Ruling 8: in the clinician's own language. */
    const { wordsFor } = await import("@/lib/i18n/message-words");
    const { t, locale } = await wordsFor({ userId });
    await notify(
      { email: result.clinicianEmail, phone: null, locale },
      {
        kind: "clinic.removed",
        subject: t("tmsg.removed.subject", { clinic: actor.clinicName }),
        body: t("tmsg.removed.body", { clinic: actor.clinicName }),
        link: { label: t("tmsg.signIn"), url: `${env.appUrl}/login` },
      },
    );
  }

  /*
   * 🔴 C266 — the largest act on this screen. They move to a practice of their
   * own and the clinic's meeting accounts are disconnected from them. A
   * clinician who finds themselves outside a practice on a Monday is entitled
   * to an answer about who did it.
   */
  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "admin",
    action: "clinic.clinician_removed",
    resourceType: "user",
    resourceId: userId,
  });

  /*
   * 🔴 W2-C02 / C4: AND THE SEAT GOES WITH THEM.
   *
   * `removeClinician` released their `clinic_seats` row and left
   * `organizations.seats`, which prices the bill, where it was: C4's "the
   * next bill is lower by exactly one seat" was false. Applied through
   * `applySeatChange` against the count the admin was shown.
   */
  if (typeof seatFrom === "number" && seatFrom > 0) {
    const { applySeatChange } = await import("@/lib/billing/seats");
    const seat = await applySeatChange({
      organizationId: actor.clinicOrganizationId,
      fromSeats: seatFrom,
      toSeats: seatFrom - 1,
    });
    if (seat.error) return { ok: true, error: seat.error };
    await audit({
      actor: null,
      clinicManagerId: actor.clinicManagerId,
      category: "billing",
      action: "seats.changed",
      resourceType: "organization",
      resourceId: actor.clinicOrganizationId,
      reason: `${seatFrom} to ${seatFrom - 1}, a clinician left`,
    });
  }

  revalidatePath("/clinic/people");
  revalidatePath("/clinic/seats");
  return { ok: true };
}
