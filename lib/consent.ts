/**
 * What the patient is asked before they enter the room.
 *
 * In its own module, with no database import, so the exact words can be
 * rendered by the client, stored by the server, and quoted back in an
 * investigation without three copies drifting apart. The version is the point:
 * consent is to *particular words*, those words will be edited, and a stored
 * "granted" that cannot say what was on the screen is an assertion rather than
 * evidence.
 *
 * Bump `RECORDING_CONSENT_VERSION` whenever the wording below changes in a way
 * that alters what somebody is agreeing to. Fixing a typo does not count;
 * changing who can hear the recording does.
 */
export const RECORDING_CONSENT_VERSION = "2026-08-12";

/**
 * Plain words, and specific ones.
 *
 * Written for a person in distress who is about to talk to a stranger, not for
 * a lawyer reviewing it afterwards — which is also, as it happens, the
 * standard a consent has to meet to be worth anything. "Processing of personal
 * data for the purposes of clinical documentation" is not consent from
 * somebody having the worst night of their year; it is a sentence they scroll
 * past.
 */
export const RECORDING_CONSENT = {
  question: "May your therapist record this session?",
  points: [
    "The recording is turned into your therapist's clinical notes, and a plain-language summary for you.",
    "Only your therapist can see it. It is never sold, never used for advertising, and never shown to another patient.",
    "You can change your mind during the session — ask your therapist to stop and the recording indicator turns amber.",
  ],
  /** The consequence of saying no, stated before they say it. */
  refusal:
    "If you say no the session still happens, exactly the same. Your therapist writes their notes by hand instead.",
  grant: "Yes, you may record",
  decline: "No, please do not record",
} as const;

export type RecordingConsent = "granted" | "declined";

export function isRecordingConsent(value: unknown): value is RecordingConsent {
  return value === "granted" || value === "declined";
}

/* ------------------------------------------- 7.8: recording that began late -- */

/**
 * How long after the session started counts as "late". PLAN.md 7.8.
 *
 * A minute, not zero. Consent given on the join form and the session starting
 * are two separate writes seconds apart, and a stamp that fired on a two-second
 * gap would appear on every note — which would train every clinician to ignore
 * it, including on the session where it matters.
 */
export const LATE_RECORDING_THRESHOLD_MS = 60 * 1000;

/**
 * The sentence §3 requires on a note whose session was only half recorded.
 *
 * > "Turns it on at minute 10 → minutes 0–10 were never recorded and do not
 * > exist. The note is stamped *'recording began at 10:32; earlier
 * > conversation not captured'*."
 *
 * Pure, and returns `null` when there is nothing to say — which is the common
 * case and also the *unknown* case. A session with no `recordingStartedAt` is
 * one where we do not know when the microphone began; the honest output there
 * is silence, not a guess, because the whole purpose of the stamp is to stop a
 * note claiming a completeness it does not have.
 *
 * `timeZone` is an IANA name from the therapist's profile. A wrong clock is
 * worse than a vague one here — the stamp exists to be checked against
 * somebody's memory of the room — so an unusable zone falls back to UTC and
 * says so rather than silently rendering a time in the server's zone.
 */
export function lateRecordingStamp(input: {
  startedAt: Date | null;
  recordingStartedAt: Date | null;
  timeZone?: string | null;
}): string | null {
  const { startedAt, recordingStartedAt } = input;
  if (!startedAt || !recordingStartedAt) return null;

  const gap = recordingStartedAt.getTime() - startedAt.getTime();
  if (gap < LATE_RECORDING_THRESHOLD_MS) return null;

  const zone = usableTimeZone(input.timeZone);
  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zone ?? "UTC",
  }).format(recordingStartedAt);

  const minutes = Math.round(gap / 60000);
  return `Recording began at ${clock}${zone ? "" : " UTC"}; the first ${minutes} minute${minutes === 1 ? "" : "s"} of this session were not captured and do not exist.`;
}

/** Null when the zone is missing or not one this runtime knows. */
function usableTimeZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}
