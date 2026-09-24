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
  replyToTicket,
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

export type OpenedTicket = {
  message: string;
  events: { kind: string; note: string | null; at: string }[];
};

/**
 * Open one, in full. This is the audited read (`readTicket` writes the
 * `phi_access` row before returning anything).
 *
 * 🔴 W2-A02: this existed and nothing called it, so the card said "open it to
 * read what they wrote" over no way to. It returns what somebody wrote and
 * what was done, and nothing else: the row also carries the sender's access
 * token and code hash, which have no business in a browser.
 */
export async function openTicket(ticketId: string): Promise<OpenedTicket | null> {
  const actor = await requireStaff();
  const opened = await readTicket({ ticketId, actor });
  if (!opened) return null;
  return {
    message: opened.ticket.message,
    events: opened.events.map((event) => ({
      kind: event.kind,
      note: event.note,
      at: event.createdAt.toISOString().slice(0, 16).replace("T", " ") + " UTC",
    })),
  };
}

/** 🔴 W2-A02: answer without closing, behind the same link and code as the close. */
export async function reply(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const actor = await requireStaff();
  const ticketId = String(formData.get("ticketId") ?? "");
  const result = await replyToTicket({
    ticketId,
    actorUserId: actor.userId,
    reply: String(formData.get("reply") ?? ""),
  });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "ticket.replied",
    resourceType: "support_ticket",
    resourceId: ticketId,
  });
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function waitOnThem(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const actor = await requireStaff();
  const result = await awaitReply({
    ticketId: String(formData.get("ticketId") ?? ""),
    actorUserId: actor.userId,
    note: String(formData.get("note") ?? ""),
  });
  if (result.error) return { error: result.error };
  // W2-A02: on the record like taking a ticket on and closing one.
  await audit({
    actor,
    category: "admin",
    action: "ticket.waiting",
    resourceType: "support_ticket",
    resourceId: String(formData.get("ticketId") ?? ""),
  });
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
  // W2-A02: on the record like taking a ticket on and closing one.
  await audit({
    actor,
    category: "admin",
    action: "ticket.extended",
    resourceType: "support_ticket",
    resourceId: String(formData.get("ticketId") ?? ""),
  });
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
  // W2-A02: on the record like taking a ticket on and closing one.
  await audit({
    actor,
    category: "admin",
    action: "ticket.moved_to_whatsapp",
    resourceType: "support_ticket",
    resourceId: String(formData.get("ticketId") ?? ""),
  });
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
    whatsappSummary: String(formData.get("whatsappSummary") ?? ""),
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
  return { ok: true, note: "Closed. They have a link and a code, the reply itself stays here." };
}
