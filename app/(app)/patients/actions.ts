"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { issueInvite, revokeInvite } from "@/lib/data/claims";
import { requestAccess } from "@/lib/data/grants";
import {
  AccessRefusedError,
  createPatient,
  getPatient,
  updatePatient,
} from "@/lib/data/patients";
import { ensurePersonForPatient } from "@/lib/data/people";
import { env } from "@/lib/env";
import { e164Problem, toE164 } from "@/lib/phone/e164";
import { notify } from "@/lib/notify";
import { releaseLock } from "@/lib/data/challenge";
import { audit } from "@/lib/audit";
import { fullName } from "@/lib/utils";

export type PatientActionState = { error?: string; ok?: boolean };

export async function addPatient(
  _prev: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const actor = await requireUser();

  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return { error: "Enter their first name." };

  /*
   * 12.4 / §3b — the number is mandatory, and the form says why rather than
   * just refusing. "A first name is the only thing we need" was the old
   * wording, and it was true of a product where a record could never be handed
   * to the person it describes.
   */
  const rawPhone = String(formData.get("phone") ?? "").trim();
  if (!rawPhone) {
    return {
      error: "A phone number is required, so you can invite them to join by WhatsApp.",
    };
  }

  const parsed = toE164(rawPhone, String(formData.get("phoneCountry") ?? "") || null);
  if (!parsed.ok) return { error: e164Problem(parsed) ?? "Check that phone number." };

  const patient = await createPatient(actor, {
    firstName,
    lastName: String(formData.get("lastName") ?? "").trim() || undefined,
    email: String(formData.get("email") ?? "").trim() || undefined,
    phone: parsed.e164,
  });

  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

export async function savePatient(
  patientId: string,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    /** ISO-3166 alpha-2 from the selector beside the number. 11R.12. */
    phoneCountry?: string;
    diagnoses: string[];
    goals: string[];
  },
): Promise<PatientActionState> {
  const actor = await requireUser();
  if (!input.firstName.trim()) return { error: "A first name is required." };

  /*
   * 11R.12 — a number this record holds must be one we can actually reach.
   *
   * Refused rather than stored half-formed: the clinician is looking at the
   * screen right now and can pick the country, which is the one moment the
   * information is available. Nothing later in the product can supply it.
   */
  let phone: string | null = null;
  const rawPhone = input.phone.trim();
  if (rawPhone) {
    const parsed = toE164(rawPhone, input.phoneCountry ?? null);
    if (!parsed.ok) return { error: e164Problem(parsed) ?? "Check that phone number." };
    phone = parsed.e164;
  }

  try {
    await updatePatient(actor, patientId, {
      firstName: input.firstName,
      lastName: input.lastName || null,
      email: input.email || null,
      phone,
      clinical: {
        diagnoses: input.diagnoses.filter(Boolean),
        goals: input.goals.filter(Boolean),
      },
    });
  } catch (error) {
    // 7.7: a consent refusal is a message, not a crash. Anything else is a
    // real fault and must keep throwing — swallowing it would turn a failed
    // save into a screen that says it succeeded.
    if (error instanceof AccessRefusedError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

/*
 * A clinician cannot send a patient's record anywhere, and that is the point.
 *
 * There was a button here that emailed a patient their full chart. It only
 * ever sent to the address on file, which made it safe enough — but "a
 * clinician can cause clinical text to leave the practice" is a capability,
 * and this product now has exactly one of those: an administrator acting on a
 * patient's own request, from the admin console, audited, with the clinician
 * notified. See `emailPatientRecordToPatient` in the admin actions.
 *
 * What a patient gets automatically is their brief, which they pull themselves
 * by rating the session. That path can only ever send `patientBrief`.
 */

/*
 * There is deliberately no way for a clinician to delete a patient or a
 * session, and this is not an oversight.
 *
 * A therapy record is a legal document. Retention periods run to years — six
 * in most US states, longer for minors — and a clinician who deletes a chart
 * after a complaint has destroyed evidence, whether or not they meant to. The
 * old `deletePatient` is gone from this file rather than merely hidden from the
 * UI: a server action that exists can be called, and the only reliable way to
 * refuse a capability is not to ship it.
 *
 * What a clinician *can* do is correct a record (`savePatient`), cancel a
 * session before it completes, and reset their own copilot conversation. What
 * a patient can do is ask for their data, which an operator exports. Genuine
 * erasure requests go through us, deliberately, because they need a decision
 * about retention law that a product surface cannot make.
 */

/* ----------------------------------------------- 6.10: handing a record over -- */

/**
 * Issue an invite link for this patient's person record.
 *
 * Tenancy is enforced by `getPatient(actor, …)` — a clinician can only hand
 * over a record they can already read. Everything after that is on the person
 * rather than the patient row, because the record being handed over is the
 * identity, not one clinic's file on it.
 *
 * The token comes back exactly once. We show it, and we never store it, so a
 * clinician who loses the link revokes and issues another rather than asking
 * us to look it up.
 */
export async function createInviteLink(
  patientId: string,
): Promise<
  | { url: string; expiresAt: string; sent: boolean; channel: "email" | "whatsapp" | null }
  | { error: string }
> {
  const actor = await requireUser();

  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." };

  const personId = await ensurePersonForPatient(patientId);
  if (!personId) return { error: "That patient no longer exists." };

  const issued = await issueInvite({ personId, issuedByUserId: actor.userId });
  if ("error" in issued) return issued;

  const url = `${env.appUrl}/patient/invite/${issued.token}`;

  /*
   * 13.3 — **we send it**, rather than handing the clinician a string to copy.
   *
   * 6.10 built this route for a caseload with no contact details at all: the
   * link came back on screen and the therapist read it out. §3b makes the
   * number mandatory (12.4), so there is now somebody to send to, and a
   * clinician retyping a 24-character token into WhatsApp is a transcription
   * error waiting to hand the wrong person a record.
   *
   * The link is still returned either way. Whether it *arrived* is reported
   * rather than assumed (§6): if nothing sent, the screen says so and shows
   * the link to pass on by hand — which is exactly 6.10's original flow, kept
   * as the fallback it should always have been.
   *
   * 🔴 No clinical content. A first name, a therapist's name and a link.
   */
  const delivery = await notify(
    { email: patient.email, phone: patient.phone, timezone: patient.timezone },
    {
      kind: "claim.invite",
      subject: `${fullName(actor.firstName, actor.lastName)} has invited you to 24Therapy`,
      body: `${fullName(actor.firstName, actor.lastName)} would like to give you access to your own record on 24Therapy.\n\nOpen the link below to set up your account. It is yours, and you decide what happens to it.`,
      link: { label: "Set up my account", url },
      variables: [fullName(actor.firstName, actor.lastName)],
    },
  );

  await audit({
    actor,
    category: "phi_access",
    action: "patient.invite.send",
    resourceType: "patient",
    resourceId: patientId,
  });

  revalidatePath(`/patients/${patientId}`);
  return {
    url,
    expiresAt: issued.expiresAt.toISOString(),
    sent: delivery.sent,
    channel: delivery.channel,
  };
}

/**
 * Let a locked-out patient try again. 13R.4 / C88.
 *
 * Scoped by `getPatient`, which enforces tenancy — a clinician can only open
 * the door on a record they hold. Audited with a named actor and their written
 * reason, because "somebody unlocked this" with no name is how a release
 * becomes a habit nobody reviews.
 */
export async function releaseClaimLock(
  patientId: string,
  reason: string,
): Promise<PatientActionState> {
  const actor = await requireUser();

  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." };

  const result = await releaseLock({
    patientId,
    releasedByUserId: actor.userId,
    reason,
  });
  if (!result.ok) return { error: result.error };

  await audit({
    actor,
    category: "phi_access",
    action: "claim.lock.release",
    resourceType: "patient",
    resourceId: patientId,
  });

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

/**
 * Take a link back.
 *
 * `revokeInvite` is scoped to the issuing clinician, so this cannot revoke
 * somebody else's invite even with a guessed id.
 */
export async function cancelInviteLink(
  patientId: string,
  inviteId: string,
): Promise<PatientActionState> {
  const actor = await requireUser();

  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." };

  const revoked = await revokeInvite(inviteId, actor.userId);
  if (!revoked) return { error: "That link was already used or cancelled." };

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

/* ------------------------------------------------ 7.3: asking for access -- */

/**
 * Ask a person to let you read their profile again.
 *
 * The only thing a revoked clinician can do about their state, and it is
 * deliberately the *only* thing: there is no appeal, no notification to an
 * administrator, and no way to see what they are missing. §3 gives them a note
 * and a rate limit, and the answer belongs to the patient.
 */
export async function askForAccess(
  patientId: string,
  note: string,
): Promise<PatientActionState> {
  const actor = await requireUser();

  const result = await requestAccess({ actor, patientId, note });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/copilot/${patientId}`);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
