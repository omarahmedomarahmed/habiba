/**
 * 🔴 THE FOUNDER'S START RULING: one clock for a booked session, on both sides.
 *
 * It replaces B64's "Start now anyway", which asked the clinician and still
 * let a ten o'clock booking begin at half past midnight with one more press.
 * A booked session now reads the same windows in the clinician's room, on the
 * patient's join page and in the server that decides:
 *
 *   `booked`  more than `soonMinutes` before the booked time. The time, and
 *             nothing to press.
 *   `soon`    from `soonMinutes` to `joinEarlyMinutes` before. "Starting soon",
 *             the time, and still nothing to press.
 *   `early`   the last `joinEarlyMinutes` before. Both may join early: the
 *             clinician's button starts the session, the patient's opens the
 *             room and waits for them, as it always has.
 *   `open`    the booked time has come, or nobody booked one.
 *
 * A session with no booked time (started on the spot, a radar walk-in) is
 * `open` from the moment it exists, which is exactly what it was before.
 *
 * Pure and dependency free, so the room and the join page tick it in the
 * browser from the booked instant the server sent, and the verifier proves the
 * edges without a clock of its own. The thresholds are `rules.start` in the
 * audited settings, never constants.
 */
export type StartWindow = "booked" | "soon" | "early" | "open";

export type StartRule = { soonMinutes: number; joinEarlyMinutes: number };

export function startWindow(
  scheduledAt: Date | string | null | undefined,
  now: number,
  rule: StartRule,
): StartWindow {
  if (!scheduledAt) return "open";
  const at = typeof scheduledAt === "string" ? Date.parse(scheduledAt) : scheduledAt.getTime();
  if (Number.isNaN(at)) return "open";
  const ahead = at - now;
  if (ahead > rule.soonMinutes * 60_000) return "booked";
  if (ahead > rule.joinEarlyMinutes * 60_000) return "soon";
  if (ahead > 0) return "early";
  return "open";
}

/** May anybody start or join yet? False only in the two windows with nothing to press. */
export function mayEnter(window: StartWindow): boolean {
  return window === "early" || window === "open";
}

/**
 * The window a session is in, for the question "may it start or be joined".
 *
 * Only a session still waiting to begin is held. One already under way is
 * re-entry (a reload, a dropped connection), and never refused by the clock.
 */
export function windowFor(
  session: { status: string; scheduledAt: Date | string | null },
  now: number,
  rule: StartRule,
): StartWindow {
  return session.status === "scheduled" ? startWindow(session.scheduledAt, now, rule) : "open";
}
