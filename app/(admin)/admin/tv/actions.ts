"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { relock, requireElevated, setKey, unlock } from "@/lib/console/gate";
import { readPerson, readSession, REASON_MIN } from "@/lib/console/reads";

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
 * Open one session: transcript, note and risk flags.
 *
 * The read happens here rather than in the page, so it happens once, after the
 * operator has typed why, and `readSession` writes the audit row first.
 */
export async function openSession(sessionId: string, reason: string) {
  const { actor } = await requireElevated();
  const detail = await readSession(actor, sessionId, reason);
  if (!detail) return { error: "missing" as const };
  if ("error" in detail) return detail;

  return {
    detail: {
      id: detail.session.id,
      clinician: [detail.therapistFirstName, detail.therapistLastName].filter(Boolean).join(" "),
      person:
        [detail.patientFirstName, detail.patientLastName].filter(Boolean).join(" ") ||
        detail.session.guestName ||
        "-",
      startedAt: detail.session.startedAt?.toISOString() ?? null,
      endedAt: detail.session.endedAt?.toISOString() ?? null,
      durationMinutes: detail.session.durationMinutes,
      consent: detail.session.recordingConsent,
      note: detail.note?.content ?? null,
      noteStatus: detail.note?.status ?? null,
      patientStatus: detail.note?.patientStatus ?? null,
      transcript: detail.transcript.map((t) => ({
        id: String(t.id),
        speaker: String(t.speaker),
        text: String(t.text),
      })),
      risks: detail.risks.map((r) => ({
        id: r.id,
        level: r.level,
        detail: r.recommendedAction ?? r.indicators.join(", "),
        at: r.createdAt.toISOString(),
      })),
    },
  };
}

/** Open one person's sessions and copilot conversation, audited per chart. */
export async function openPerson(patientIds: string[], reason: string) {
  const { actor } = await requireElevated();
  const read = await readPerson(actor, patientIds, reason);
  if ("error" in read) return read;

  return {
    conversation: read.conversation.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      at: m.createdAt.toISOString(),
      clinician: [m.therapistFirstName, m.therapistLastName].filter(Boolean).join(" "),
    })),
    sessions: read.sessions.map((s) => ({
      id: s.id,
      status: s.status,
      modality: s.modality,
      startedAt: s.startedAt?.toISOString() ?? null,
      durationMinutes: s.durationMinutes,
      autoEndedReason: s.autoEndedReason,
      clinician: [s.therapistFirstName, s.therapistLastName].filter(Boolean).join(" "),
      noteStatus: s.noteStatus,
      patientStatus: s.patientStatus,
      summary: s.summary,
    })),
  };
}

/**
 * Send one person their own record.
 *
 * Reuses the existing export path, so the delivery address is the one on the
 * chart and the owning clinician is notified exactly as they are for any other
 * request. Nobody else is copied: the operator's inbox is not a place a record
 * should land, and the audit row says it was sent and why.
 */
export async function mailRecordToPerson(
  patientId: string,
  reason: string,
): Promise<GateState & { sentTo?: string }> {
  const { actor } = await requireElevated();

  const why = reason.trim();
  if (why.length < REASON_MIN) return { error: "reason" };

  const { requestPatientExport, exportPath } = await import("@/lib/data/export");
  const request = await requestPatientExport(actor, patientId);
  if (!request.ok) return { error: request.error };

  const { env } = await import("@/lib/env");
  const { EXPORT_TTL_HOURS } = await import("@/lib/db/schema");
  const { sendRecordExport } = await import("@/lib/mail");
  /* 🔴 Ruling 8: in the patient's own language. */
  const { recipientLocale } = await import("@/lib/i18n/preference");
  const sent = await sendRecordExport({
    to: request.email,
    patientName: request.patientName,
    url: `${env.appUrl}${exportPath(request.token)}`,
    expiresInHours: EXPORT_TTL_HOURS,
    locale: await recipientLocale(request.personId ? { personId: request.personId } : null),
  });

  await audit({
    actor,
    category: "admin",
    action: "console.export.person",
    resourceType: "patient",
    resourceId: patientId,
    patientId,
    reason: `Sent to ${request.email}, ${why}`,
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
    return { error: "Give the reason and the authority for this request, at least a sentence." };
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
    reason: `Sent to ${to}, copy to ${actor.email}, ${reason}`,
  });

  /*
   * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden. See lib/db/region.ts.
   */
  const { dbFor } = await import("@/lib/db");
  const { pinnedToDefaultRegion } = await import("@/lib/db/region");
  const db = dbFor(pinnedToDefaultRegion("app/(admin)/admin/tv/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));
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
