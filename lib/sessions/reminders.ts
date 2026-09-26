/**
 * 🔴 0183: THE HOUR BEFORE A BOOKED SESSION, as four messages.
 *
 * The founder: "send email reminders of session starting in 1 hr then 30 mins
 * then 15 mins, then at 5 mins before the session tell them they can start it
 * now". So:
 *
 *   60  "Your session with X starts in 1 hour"
 *   30  "... in 30 minutes"
 *   15  "... in 15 minutes"
 *    5  "You can go in now", with the join link: from five minutes before, the
 *       patient's door opens the room (`rules.start.joinEarlyMinutes`).
 *
 * Pure and dependency free, so the rule is tested as arithmetic
 * (`tests/session-reminders.test.ts`) and the minute tick that sends them
 * (`lib/data/session-reminders.ts`) only does the I/O.
 *
 * ## Only the ones still ahead, never a burst
 *
 * A mark is due from its moment for `GRACE_MINUTES`, and not after. A booking
 * made forty minutes before its start is sent the 30, the 15 and the 5, and
 * never a late "in 1 hour"; a tick that did not run for ten minutes skips the
 * mark it missed rather than sending it next to the one after. At most one
 * mark is due at any instant, the most imminent one, so a single tick can
 * never send two messages about one session.
 *
 * ## Only a session still waiting to begin
 *
 * Cancelled, completed, or already started by the clinician: nothing. The
 * clinician pressing Start sends its own "your session has started" message
 * (`lib/sessions/started-notice.ts`), and a "you can go in now" behind it would
 * be the product talking over itself.
 */

export const REMINDER_MARKS = [60, 30, 15, 5] as const;
export type ReminderMark = (typeof REMINDER_MARKS)[number];

/** The "you can go in now" mark. */
export const OPEN_NOW_MARK: ReminderMark = 5;

/**
 * How long after its moment a mark may still be sent. Four minutes: a tick
 * that is a minute or two late still sends, and a mark whose moment is long
 * gone is not sent at all. Smaller than the ten minutes between the 15 and the
 * 5, so the windows never overlap.
 */
export const GRACE_MINUTES = 4;

/** How far ahead the tick looks: the earliest mark, plus a minute of slack. */
export const LOOKAHEAD_MINUTES = REMINDER_MARKS[0] + 1;

export type ReminderCandidate = {
  status: string;
  scheduledAt: Date | string | null;
  startedAt?: Date | string | null;
  cancelledAt?: Date | string | null;
};

function toMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Is this session one we remind at all? */
export function remindable(session: ReminderCandidate): boolean {
  if (session.status !== "scheduled") return false;
  if (toMs(session.cancelledAt) !== null) return false;
  if (toMs(session.startedAt) !== null) return false;
  return toMs(session.scheduledAt) !== null;
}

/**
 * The one mark due now, or null.
 *
 * `sent` is the marks already claimed for this booked instant. The due mark is
 * the most imminent one whose moment has come and not gone by more than
 * `GRACE_MINUTES` (the 5 lasts until the booked time itself), and that has not
 * been claimed.
 */
export function dueMark(
  session: ReminderCandidate,
  now: number,
  sent: readonly number[] = [],
): ReminderMark | null {
  if (!remindable(session)) return null;
  const at = toMs(session.scheduledAt)!;
  const ahead = at - now;
  if (ahead <= 0) return null;

  // The most imminent mark whose moment has come: the smallest m with ahead <= m.
  let due: ReminderMark | null = null;
  for (const mark of REMINDER_MARKS) {
    if (ahead <= mark * 60_000) due = mark;
  }
  if (due === null) return null;

  // Its moment passed too long ago: it is stale, and the next one is not yet due.
  const lateBy = due * 60_000 - ahead;
  const grace = due === OPEN_NOW_MARK ? OPEN_NOW_MARK * 60_000 : GRACE_MINUTES * 60_000;
  if (lateBy > grace) return null;

  if (sent.includes(due)) return null;
  return due;
}

/**
 * Every mark a session booked `bookedMinutesAhead` before its start would be
 * sent, ticking once a minute. For the tests and the verifier: the schedule
 * as a list rather than as a walk through a clock.
 */
export function marksForBooking(bookedMinutesAhead: number, tickMinutes = 1): ReminderMark[] {
  const at = 10_000 * 60_000;
  const sent: ReminderMark[] = [];
  for (let m = bookedMinutesAhead; m > 0; m -= tickMinutes) {
    const mark = dueMark({ status: "scheduled", scheduledAt: new Date(at) }, at - m * 60_000, sent);
    if (mark !== null) sent.push(mark);
  }
  return sent;
}
