"use server";

import { audit } from "@/lib/audit";
import { readByToken } from "@/lib/data/support";

export type ReaderState = {
  error?: string;
  ticket?: {
    reference: string;
    topic: string;
    message: string;
    closedAtLabel: string | null;
    events: { kind: string; note: string | null; atLabel: string }[];
  };
};

/**
 * Open one closed ticket, for the person who wrote it. PLAN.md 20.22.
 *
 * Two factors, neither of them the message: the token in the link, and a code
 * sent to the handle already on the ticket. The audit entry names the ticket
 * and not the reader, because there is no account here to name — what is
 * recorded is that this material was disclosed, and when.
 */
export async function openTicket(_prev: ReaderState, formData: FormData): Promise<ReaderState> {
  const token = String(formData.get("token") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  const result = await readByToken({ token, code });
  if (result.error || !result.ticket) {
    return { error: result.error ?? "That link or code is not right." };
  }

  await audit({
    actor: null,
    patientAccountId: result.ticket.patientAccountId,
    category: "phi_access",
    action: "ticket.read_by_sender",
    resourceType: "support_ticket",
    resourceId: result.ticket.id,
  });

  const fmt = (at: Date) => at.toISOString().slice(0, 16).replace("T", " ") + " UTC";

  return {
    ticket: {
      reference: result.ticket.reference,
      topic: result.ticket.topic,
      message: result.ticket.message,
      closedAtLabel: result.ticket.closedAt ? fmt(result.ticket.closedAt) : null,
      events: (result.events ?? [])
        .filter((event) => event.kind === "closed" || event.kind === "replied")
        .map((event) => ({
          kind: event.kind,
          note: event.note,
          atLabel: fmt(event.createdAt),
        })),
    },
  };
}
