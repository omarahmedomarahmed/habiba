import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 W2-A05: one length for a reason, read by the screen and by the server.
 *
 * The transfer rejection modal enabled its button at five characters and the
 * server refused anything under ten, so an operator typed a reason, pressed
 * the button and was told off; several acts took no reason at all, and the
 * radar ban sent "Administrator action" when the field was left blank. Every
 * destructive or customer-visible act in the console now asks for a reason,
 * checked here by the action, and the confirm step enables at the same
 * number (`components/admin/confirm-with-reason.tsx`).
 *
 * Pure, so a client component can import the number.
 */
export const MIN_REASON = 10;

export function reasonProblem(reason: unknown): MessageKey | null {
  return typeof reason === "string" && reason.trim().length >= MIN_REASON ? null : "aconfirm.tooShort";
}

/** What goes in the audit row: trimmed and bounded, never the raw field. */
export function reasonText(reason: string): string {
  return reason.trim().slice(0, 500);
}
