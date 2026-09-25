"use server";

import { redirect } from "next/navigation";

import { reasonProblem, reasonText } from "@/lib/admin/reason";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { reportSubject } from "@/lib/data/radar-admin";

/**
 * 🔴 The reason for reading a transcript, by POST.
 *
 * It was a GET: `?why=` carried the reason in the address bar, the browser's
 * history, the server's request log and any Referer, and every render of the
 * page wrote another break-glass row, so a reload read as a second reading.
 * Now the reason arrives in a form body, one row is written here per reading,
 * and the page renders on that row's id (`investigationGrantHolds`) for a
 * short window without writing another.
 */
export async function openInvestigation(reportId: string, formData: FormData): Promise<void> {
  const actor = await requireRole("super_admin");
  const why = String(formData.get("why") ?? "");
  const back = `/admin/radar/investigate/${encodeURIComponent(reportId)}`;
  if (reasonProblem(why)) redirect(`${back}?short=1`);

  const report = await reportSubject(reportId);
  if (!report) redirect("/admin/radar");

  const grant = await audit({
    actor,
    category: "phi_access",
    action: "break_glass.investigate",
    resourceType: "session",
    resourceId: report.sessionId,
    patientId: report.patientId,
    reason: `Report ${report.id}, ${report.kind}: ${reasonText(why)}`,
  });
  redirect(`${back}?grant=${grant ?? ""}`);
}
