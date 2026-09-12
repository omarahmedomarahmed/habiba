"use server";

import { requestOwnExport } from "@/lib/data/export";
import { requirePatient } from "@/lib/patient-auth/guard";

export type ExportState = {
  error?: string;
  needsEmail?: boolean;
  sentTo?: string;
  code?: string;
};

/**
 * A patient asking for their own record. PLAN.md 26.9, 26.10, C128.
 *
 * The address is the one on their account and is never taken from the form.
 * A record extract sent to an address somebody typed on the page is the same
 * defect as the `shareReport` button sprint 8 deleted: the easiest possible
 * route for a whole chart to leave and end up somewhere nobody can account for.
 */
export async function exportMyRecord(): Promise<ExportState> {
  const actor = await requirePatient();

  const result = await requestOwnExport({
    accountId: actor.accountId,
    personId: actor.personId,
    email: actor.email,
  });

  if (!result.ok) return { error: result.error, needsEmail: result.needsEmail };

  return { sentTo: result.email, code: result.verificationCode };
}
