"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { acknowledgeCrisisAlert } from "@/lib/crisis/alerts";

/**
 * 🔴 F2: "I have it." Records who acknowledged the crisis alert and when, and
 * stops its escalation. A POST from a button on a signed-in page, never a GET:
 * mail scanners open every link in an email, and an alert acknowledged by a
 * spam filter is one nobody escalates. Whether this person may acknowledge it
 * is decided inside `acknowledgeCrisisAlert`, from the alert, not the form:
 * the clinician, a clinician in the same practice, or the platform on-call
 * (`mayAcknowledge`). The alert row keeps who (`acknowledged_by`); the audit
 * row keeps who and in what role.
 */
export async function acknowledgeAlert(formData: FormData): Promise<void> {
  const actor = await requireUser();
  const riskId = String(formData.get("riskId") ?? "");
  const done = await acknowledgeCrisisAlert(riskId, actor);
  if (done) {
    await audit({
      actor,
      category: "clinical",
      action: "crisis.acknowledge",
      resourceType: "risk_assessment",
      resourceId: riskId,
      reason: `role:${actor.role}`,
    });
  }
  revalidatePath(`/notifications/alerts/${riskId}`);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
