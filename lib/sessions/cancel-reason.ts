/**
 * 🔴 W1-13 — the reason a clinician gives the patient for cancelling.
 *
 * Required, because a cancellation with no sentence reads as a mistake to the
 * person it happened to. Capped rather than refused when long: it is a message,
 * not an essay, and a long one should still reach them. Pure, so a test can ask.
 */
export function cleanCancelReason(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const reason = raw.trim();
  if (reason.length < 3) return null;
  return reason.slice(0, 300);
}
