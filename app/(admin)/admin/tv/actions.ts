"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { relock, requireElevated, setKey, unlock } from "@/lib/console/gate";

export type GateState = { error?: string; ok?: boolean };

export async function configureKey(slot: "a" | "b", value: string): Promise<GateState> {
  const actor = await requireRole("super_admin");
  return setKey(actor, slot, value);
}

export async function submitKeys(a: string, b: string): Promise<GateState> {
  const actor = await requireRole("super_admin");
  const result = await unlock(actor, a, b);
  if (result.ok) revalidatePath("/admin/tv");
  return result;
}

export async function close(): Promise<GateState> {
  await requireRole("super_admin");
  await relock();
  revalidatePath("/admin/tv");
  return { ok: true };
}

/**
 * Send one person their own record.
 *
 * Reuses the existing export path, so the delivery address is the one on the
 * chart and the owning clinician is notified exactly as they are for any other
 * request. The requesting administrator receives a copy of the same message.
 */
export async function mailRecordToPerson(
  patientId: string,
): Promise<GateState & { sentTo?: string }> {
  const { actor } = await requireElevated();

  const { requestPatientExport, exportPath } = await import("@/lib/data/export");
  const request = await requestPatientExport(actor, patientId);
  if (!request.ok) return { error: request.error };

  const { env } = await import("@/lib/env");
  const { EXPORT_TTL_HOURS } = await import("@/lib/db/schema");
  const { sendRecordExport } = await import("@/lib/mail");
  const sent = await sendRecordExport({
    to: request.email,
    copyTo: actor.email,
    patientName: request.patientName,
    clinicianName: "your clinician",
    url: `${env.appUrl}${exportPath(request.token)}`,
    expiresInHours: EXPORT_TTL_HOURS,
  });

  await audit({
    actor,
    category: "admin",
    action: "console.export.person",
    resourceType: "patient",
    resourceId: patientId,
    reason: `Sent to ${request.email}, copy to ${actor.email}`,
  });

  return sent
    ? { ok: true, sentTo: request.email }
    : { error: "The mail provider refused the message." };
}

/**
 * Send one clinician's full history to a named address, with a copy to the
 * requesting administrator.
 *
 * Requires a written reason and the address to send to. Both go in the audit
 * record, and the clinician is notified that it happened.
 */
export async function mailClinicianHistory(input: {
  therapistId: string;
  to: string;
  reason: string;
}): Promise<GateState & { sentTo?: string }> {
  const { actor } = await requireElevated();

  const to = input.to.trim().toLowerCase();
  const reason = input.reason.trim();
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(to)) return { error: "Enter a valid address." };
  if (reason.length < 20) {
    return { error: "Give the reason and the authority for this request — at least a sentence." };
  }

  const { buildClinicianHistory } = await import("@/lib/console/history");
  const history = await buildClinicianHistory(input.therapistId);
  if (!history) return { error: "Clinician not found." };

  const { sendClinicianHistory } = await import("@/lib/mail");
  const sent = await sendClinicianHistory({
    to,
    copyTo: actor.email,
    clinicianName: history.clinicianName,
    reason,
    csv: history.csv,
    summary: history.summary,
  });

  await audit({
    actor,
    category: "admin",
    action: "console.export.clinician",
    resourceType: "user",
    resourceId: input.therapistId,
    reason: `Sent to ${to}, copy to ${actor.email} — ${reason}`,
  });

  const { db } = await import("@/lib/db");
  const { notifications } = await import("@/lib/db/schema");
  await db.insert(notifications).values({
    userId: input.therapistId,
    kind: "system",
    title: "Your practice record was disclosed",
    body: `A copy of your session and note history on 24Therapy was sent to ${to} in response to a formal request. You are being told because you are entitled to know. The request and its stated reason are in our records; reply to this and we will give you the detail.`,
    actionUrl: "/settings",
  });

  return sent ? { ok: true, sentTo: to } : { error: "The mail provider refused the message." };
}
