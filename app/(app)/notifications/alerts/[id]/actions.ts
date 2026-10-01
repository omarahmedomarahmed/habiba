"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { reasonProblem, reasonText } from "@/lib/admin/reason";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { acknowledgeCrisisAlert, alertForViewer } from "@/lib/crisis/alerts";

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

/**
 * 🔴 Review: BREAK-GLASS for the platform on-call on a journal alert nobody
 * else can act on. The reason arrives by POST, one audit row is written here,
 * and the page shows the person's name, contact and words on that row's id
 * for a short window (`crisisContactGrantHolds`) without writing another.
 * Who may do it is `mayBreakGlass`, checked again by the read itself.
 */
export async function revealCrisisContact(riskId: string, formData: FormData): Promise<void> {
  const actor = await requireUser();
  const why = String(formData.get("why") ?? "");
  const back = `/notifications/alerts/${encodeURIComponent(riskId)}`;
  if (reasonProblem(why)) redirect(`${back}?short=1`);

  const alert = await alertForViewer(riskId, actor);
  if (!alert || !alert.breakGlass) redirect(back);

  const grant = await audit({
    actor,
    category: "phi_access",
    action: "break_glass.crisis_contact",
    resourceType: "risk_assessment",
    resourceId: riskId,
    reason: `role:${actor.role}: ${reasonText(why)}`,
  });
  redirect(`${back}?grant=${grant ?? ""}`);
}
