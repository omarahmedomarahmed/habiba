"use server";

import { revalidatePath } from "next/cache";

import { enrol, lookupCode, setPrimarySponsor } from "@/lib/data/enrolment";
import { requirePatient } from "@/lib/patient-auth/guard";

export type BenefitState = {
  error?: string;
  ok?: boolean;
  /** The sponsor and the shape of what they ask, once a code resolves. */
  found?: {
    sponsorName: string;
    fields: { kind: string; domain: string | null; shapeHint: string | null }[];
  };
};

/**
 * Activating a benefit. PLAN.md 53.18, C121, C227.
 *
 * 🔴 Two steps on purpose, and the first one reveals nothing.
 *
 * `checkCode` resolves the code and returns which organisation it belongs to
 * and the SHAPE of what they require — C248, a description and never a specimen
 * value. It does not enrol anybody. So somebody who scans a poster out of
 * curiosity learns which organisation it is, which is public information printed
 * on the poster itself, and nothing else.
 *
 * 🔴 Signed in only. C121: nothing is pre-filled for anybody who is not. The
 * name and phone shown on the confirm step are the ones we already hold, which
 * is why this cannot be an anonymous flow.
 */
export async function checkCode(code: string): Promise<BenefitState> {
  await requirePatient();

  const lookup = await lookupCode(code);
  if (!lookup.ok) return { error: lookup.error };

  return {
    found: {
      sponsorName: lookup.sponsorName,
      fields: lookup.fields.map((field) => ({
        kind: field.kind,
        domain: field.domain,
        shapeHint: field.shapeHint,
      })),
    },
  };
}

/**
 * 🔴 The identifier crosses the gate, or it does not. C246.
 *
 * The person id comes from the SESSION. Everything else comes from the client
 * and is checked against a shape and a domain inside `enrol`, never against a
 * list of people, which is the whole of C227.
 */
export async function activateBenefit(
  code: string,
  identifier: string,
): Promise<BenefitState> {
  const actor = await requirePatient();

  const result = await enrol({ personId: actor.personId, code, identifier });
  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/benefit");
  revalidatePath("/patient");
  return { ok: true };
}

/** 🔴 C249 — the patient chooses which pot pays, and may change it. */
export async function choosePrimary(enrolmentId: string): Promise<BenefitState> {
  const actor = await requirePatient();

  const result = await setPrimarySponsor(actor.personId, enrolmentId);
  if (result.error) return { error: result.error };

  revalidatePath("/patient/benefit");
  return { ok: true };
}
