import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 Board 679 (B36 class): an invoice's line in the reader's language.
 *
 * `lib/billing/service.ts` stores a description in English when it raises an
 * invoice ("First session, on us"), and the bill and the ledger printed it as
 * stored, so an Arabic clinician read English rows. The descriptions this
 * product writes are named here and read from the dictionary; anything else (an
 * admin's own words, an older row) is shown as stored.
 */
const STORED: Record<string, MessageKey> = {
  "First session, on us": "tinv.firstFree",
  "Session · from your credit": "tinv.fromCredit",
  "Completed session": "tled.completedSession",
  "Completed session · taken from your earnings": "tinv.fromEarnings",
};

export function invoiceLabel(description: string, t: (key: MessageKey) => string): string {
  const key = STORED[description.trim()];
  return key ? t(key) : description;
}
