/**
 * DD-2 B1: 18 or over, confirmed before anything is recorded.
 *
 * A patient who signs up confirms it themselves (`lib/consent/terms.ts`). A chart
 * a clinician types, a guest link and an in-person session have no such step, so
 * the clinician confirms it: a required box when they create the chart or the
 * session, or a question in the room. Who confirmed and when is stored on the
 * chart and the session (0190). Under 18 is refused, with a sentence in both
 * languages. There is no guardian model; that is a founder decision.
 *
 * Pure, so the rules are tested without a database.
 */

/** A ticked box: anything but "on", "yes" or "true" is not a tick. */
export function adultTicked(form: { get(name: string): unknown }): boolean {
  const value = String(form.get("adult") ?? "").trim().toLowerCase();
  return value === "on" || value === "yes" || value === "true";
}

/**
 * Whether a session may be recorded and processed, as far as age goes. Any one
 * confirmation is enough: on this session, on the chart it belongs to, or on the
 * patient's own account.
 */
export function adultConfirmedFrom(input: {
  session: Date | null;
  chart: Date | null;
  account: Date | null;
}): boolean {
  return input.session !== null || input.chart !== null || input.account !== null;
}
