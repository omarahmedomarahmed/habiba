/**
 * 🔴 44.1 / 44.2 / C97 — WHO GETS A CHECK-IN, WHEN, AND THE FOUR REASONS NOT TO SEND.
 *
 * Pure. No database, no `Actor`, no network. So every branch below is testable without a fixture,
 * and "would we message this person right now" is one function rather than a condition spread
 * across a cron.
 *
 * ## 🔴 THE FOUR REASONS NOT TO SEND, IN THE ORDER THEY ARE CHECKED
 *
 *   1. The channel is off, or the mute rate has crossed its ceiling.
 *   2. This person has muted.
 *   3. It is inside their quiet window, in THEIR timezone.
 *   4. Not enough hours have passed since the last one.
 *
 * The order matters for one reason: the halt comes first, so a deployment whose mute rate has
 * crossed the ceiling stops sending to everybody before it considers anybody individually. A halt
 * evaluated last would be a halt that still asks "is it quiet in Cairo" about a channel that should
 * not be running at all.
 *
 * ## 🔴 THE QUIET WINDOW IS IN THE PATIENT'S ZONE, AND THAT IS THE WHOLE POINT OF IT
 *
 * A quiet window on server time is a 3am message to somebody three timezones away, which is exactly
 * the harm it exists to prevent. So the hour is computed in their IANA zone, and a person with no
 * zone on their account is treated as being inside the window — refused rather than messaged, which
 * is the direction that cannot wake anybody up.
 */

export type CheckinSettings = {
  enabled: boolean;
  everyHours: number;
  quietFromHour: number;
  quietToHour: number;
  muteRateHalt: number;
};

/**
 * 🔴 The floor on the cadence, and it is not a setting.
 *
 * C97's requirement was six-hourly and the ruling was to make the rate adjustable. Adjustable
 * downward without a floor means an operator can type `1` into a box and send twenty-four
 * unprompted messages a day to people in distress. Six is the founder's own number and it is the
 * most this will ever send, whatever the setting says.
 *
 * A clamp rather than a validation error, because the setting is read on a cron with nobody
 * watching: refusing to run would stop check-ins entirely on a typo, and clamping sends fewer.
 */
export const MIN_HOURS_BETWEEN = 6;

export type Skip =
  | "channel_off"
  | "mute_rate_halt"
  | "muted"
  | "quiet_hours"
  | "too_soon"
  | "unreachable";

export type Decision = { send: true } | { send: false; because: Skip };

/**
 * The hour of the day in a person's own timezone, or null when we do not know their zone.
 *
 * `Intl.DateTimeFormat` with an explicit `timeZone` is the only correct way to do this, and it is
 * the one place in this product where using it directly is right: `formatDate` in `lib/utils.ts`
 * exists for rendering a date to a reader (37L.9), and this is arithmetic rather than display.
 */
export function hourIn(zone: string | null | undefined, now: Date): number | null {
  if (!zone) return null;
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "numeric",
      hour12: false,
    }).format(now);
    const parsed = Number(hour);
    return Number.isInteger(parsed) ? parsed % 24 : null;
  } catch {
    /* An unknown zone string. Treated as unknown rather than as UTC, so the caller refuses. */
    return null;
  }
}

/**
 * 🔴 Is this hour inside the quiet window, given that the window WRAPS MIDNIGHT?
 *
 * 21:00 to 09:00 is the default and it crosses midnight, so the naive `hour >= from && hour < to`
 * is false for every hour of it. The wrapped case is the common one rather than the edge case,
 * which is why this is its own function with its own test rather than an inline comparison.
 */
export function inQuietWindow(hour: number, fromHour: number, toHour: number): boolean {
  if (fromHour === toHour) return false;
  return fromHour < toHour
    ? hour >= fromHour && hour < toHour
    : hour >= fromHour || hour < toHour;
}

export function shouldSend(input: {
  settings: CheckinSettings;
  /** The proportion of reachable people who have muted, as `lib/data/checkins.ts` measures it. */
  muteRate: number;
  muted: boolean;
  /** Their IANA zone, or null. Null means we refuse rather than guess. */
  timezone: string | null;
  /** When they were last messaged, or null for never. */
  lastSentAt: Date | null;
  /** Whether we have any way to reach them at all. */
  reachable: boolean;
  now: Date;
}): Decision {
  const { settings } = input;

  /* 1. The halt, first, so a channel that should not be running considers nobody. */
  if (!settings.enabled) return { send: false, because: "channel_off" };
  if (input.muteRate >= settings.muteRateHalt) {
    return { send: false, because: "mute_rate_halt" };
  }

  if (!input.reachable) return { send: false, because: "unreachable" };

  /* 2. Their own choice, and it outranks everything below it. */
  if (input.muted) return { send: false, because: "muted" };

  /* 3. Their night, in their zone. An unknown zone is treated as night. */
  const hour = hourIn(input.timezone, input.now);
  if (hour === null) return { send: false, because: "quiet_hours" };
  if (inQuietWindow(hour, settings.quietFromHour, settings.quietToHour)) {
    return { send: false, because: "quiet_hours" };
  }

  /* 4. The cadence, clamped at the floor whatever the setting says. */
  const hours = Math.max(MIN_HOURS_BETWEEN, settings.everyHours);
  if (input.lastSentAt !== null) {
    const elapsed = input.now.getTime() - input.lastSentAt.getTime();
    if (elapsed < hours * 60 * 60 * 1000) return { send: false, because: "too_soon" };
  }

  return { send: true };
}

/**
 * 🔴 44.2 — THE ABSENCE, STATED SO A VERIFIER CAN FIND IT.
 *
 * *A check-in asks. It never interprets.*
 *
 * Nothing in `lib/checkins/` imports from `lib/ai/`. A reply is stored as the person's own words and
 * scanned by the same `scanForCrisisLanguage` a session transcript is scanned by; there is no
 * sentiment pass, no model call, no summary and no column to put one in. `verify:sprint44` asserts
 * the import graph, with a control that the crisis path IS reached.
 */
export const A_CHECKIN_NEVER_INTERPRETS = true;
