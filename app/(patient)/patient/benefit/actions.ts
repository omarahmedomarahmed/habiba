"use server";

import { revalidatePath } from "next/cache";

import { enrol, lookupCode, reconfirmEnrolment, setPrimarySponsor } from "@/lib/data/enrolment";
import { confirmEnrolmentCode } from "@/lib/data/enrolment-verify";
import type { MessageKey } from "@/lib/i18n/messages";
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
  /** 🔴 Ruling 15: only when the company also asks for an employee ID. */
  employeeId?: string,
): Promise<BenefitState> {
  const actor = await requirePatient();

  const result = await enrol({ personId: actor.personId, code, identifier, employeeId: employeeId ?? null });
  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/benefit");
  revalidatePath("/patient");
  return { ok: true };
}

/**
 * 🔴 53.19 / C246 — the code that turns a pattern into proof.
 *
 * The enrolment id comes from the client and the person id from the SESSION, and
 * `confirmEnrolmentCode` puts the person in its WHERE clause rather than checking
 * afterwards, so a borrowed enrolment id verifies nothing.
 */
export async function confirmCode(
  enrolmentId: string,
  code: string,
): Promise<BenefitState> {
  const actor = await requirePatient();

  const result = await confirmEnrolmentCode({
    personId: actor.personId,
    enrolmentId,
    code,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/patient/benefit");
  revalidatePath("/patient");
  return { ok: true };
}

/**
 * 🔴 W2-P08: a paused benefit, restarted by typing what enrolled it. The
 * person comes from the SESSION; `reconfirmEnrolment` puts it in its WHERE.
 */
export async function reconfirmBenefit(
  enrolmentId: string,
  identifier: string,
): Promise<BenefitState & { needsCode?: boolean }> {
  const actor = await requirePatient();

  const result = await reconfirmEnrolment({ personId: actor.personId, enrolmentId, identifier });
  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/benefit");
  return { ok: !result.needsCode, needsCode: result.needsCode };
}

/** 🔴 C249 — the patient chooses which pot pays, and may change it. */
export async function choosePrimary(enrolmentId: string): Promise<BenefitState> {
  const actor = await requirePatient();

  const result = await setPrimarySponsor(actor.personId, enrolmentId);
  if (result.error) return { error: result.error };

  revalidatePath("/patient/benefit");
  return { ok: true };
}


/**
 * 🔴 61.6 / C349 — "IS MY EMPLOYER HERE?", AND THE ANSWER IS ALWAYS THE SAME.
 *
 * The obvious build looks the domain up and says yes or no. That turns this
 * product into an oracle for *which companies buy therapy for their staff*,
 * answerable by anybody with a list of domains and an afternoon. C319 says that
 * is a fact a company publishes or does not, and the patient-app banner already
 * shows opted-in sponsors only for the same reason.
 *
 * 🔴 `employerLookup` does the work either way and returns one constant
 * message, so neither the words nor the timing answer the question.
 *
 * 🔴 NOTHING IS LOST BY REFUSING. The real answer was always going to reach
 * somebody through their employer: a code on a poster, an intranet page, an
 * email from HR. What is lost is the oracle.
 */
export async function askAboutEmployer(domain: string): Promise<{ message: MessageKey }> {
  await requirePatient();

  const { employerLookup } = await import("@/lib/data/sponsor-domains");
  return employerLookup(domain);
}
