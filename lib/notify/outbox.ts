import "server-only";

import { log, safeErrorMessage } from "@/lib/logger";

/**
 * 🔴 0170: A MESSAGE TO NOBODY IS KEPT, NOT SENT.
 *
 * Two rules, both about who is on the other end:
 *
 *   email      an address at `example.com` (RFC 2606, reserved) reaches nobody,
 *              and a bounce costs the sending domain its reputation. Never sent,
 *              always kept.
 *   WhatsApp   while `SIMULATION_RUNNING=1`, an invented phone number may belong
 *              to a real stranger. Not sent, kept.
 *
 * Kept means written to `sim_outbox` in full, codes and links included, so the
 * simulated cast can read what the product sent them (`npm run sim:inbox`) and
 * the report can count every message the product meant to send.
 */
export function isInventedEmail(to: string): boolean {
  return /@example\.com$/i.test(to.trim());
}

export function simulationRunning(): boolean {
  return process.env.SIMULATION_RUNNING === "1";
}

export async function keep(entry: {
  channel: "email" | "whatsapp";
  to: string;
  subject?: string | null;
  body: string;
  kind?: string | null;
  reason: string;
}): Promise<void> {
  try {
    const { controlDb } = await import("@/lib/db");
    const { simOutbox } = await import("@/lib/db/schema");
    await controlDb.insert(simOutbox).values({
      channel: entry.channel,
      toAddress: entry.to.trim().toLowerCase(),
      subject: entry.subject ?? null,
      body: entry.body,
      kind: entry.kind ?? null,
      reason: entry.reason,
    });
  } catch (error) {
    log.warn("outbox not written", { channel: entry.channel, reason: safeErrorMessage(error) });
  }
}
