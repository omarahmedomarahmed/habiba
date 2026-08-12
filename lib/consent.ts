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
