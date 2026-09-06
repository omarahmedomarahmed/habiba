"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/guard";
import {
  awaitReply,
  claimTicket,
  closeTicket,
  extendTicket,
  movedToWhatsapp,
  readTicket,
} from "@/lib/data/support";

export type SupportState = { error?: string; ok?: boolean; note?: string };

/**
 * The queue's buttons. PLAN.md 20.18–20.26.
 *
 * 🔴 Every one of them calls `requireStaff`, and none of them takes a patient
 * id. 20.9 is a rule about what staff can *reach*, not about what they are
 * trusted to do: the ticket is the unit of work, and there is no path from
 * here to an account.
 */

export async function takeTicket(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const actor = await requireStaff();
  const ticketId = String(formData.get("ticketId") ?? "");

  const result = await claimTicket({ ticketId, ownerUserId: actor.userId });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "ticket.claimed",
    resourceType: "support_ticket",
    resourceId: ticketId,
  });
  revalidatePath("/admin/support");
  return { ok: true };
}

/** Open one, in full. This is the audited read — see `readTicket`. */
export async function openTicket(ticketId: string) {
  const actor = await requireStaff();
  return readTicket({ ticketId, actor });
}

export async function waitOnThem(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const actor = await requireStaff();
  const result = await awaitReply({
    ticketId: String(formData.get("ticketId") ?? ""),
    actorUserId: actor.userId,
    note: String(formData.get("note") ?? ""),
  });
  if (result.error) return { error: result.error };
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function extend(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const actor = await requireStaff();
  const result = await extendTicket({
    ticketId: String(formData.get("ticketId") ?? ""),
    actorUserId: actor.userId,
    reason: String(formData.get("reason") ?? ""),
  });
  if (result.error) return { error: result.error };
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function moveToWhatsapp(
  _prev: SupportState,
  formData: FormData,
): Promise<SupportState> {
  const actor = await requireStaff();
  const result = await movedToWhatsapp({
    ticketId: String(formData.get("ticketId") ?? ""),
    actorUserId: actor.userId,
  });
  if (result.error) return { error: result.error };
  revalidatePath("/admin/support");
  return { ok: true, note: "Recorded. Bring a written summary back before closing it." };
}

/**
 * Close it. 20.22 / 20.26.
 *
 * The link this returns is the one thing the person gets; the reply itself
 * stays here. Staff see the link so they can quote the reference on a call,
 * not so they can paste the conversation somewhere else.
 */
export async function close(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const actor = await requireStaff();
  const ticketId = String(formData.get("ticketId") ?? "");

  const result = await closeTicket({
    ticketId,
    actorUserId: actor.userId,
    summary: String(formData.get("summary") ?? ""),
  });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "ticket.closed",
    resourceType: "support_ticket",
    resourceId: ticketId,
  });
  revalidatePath("/admin/support");
  return { ok: true, note: "Closed. They have a link and a code — the reply itself stays here." };
}
