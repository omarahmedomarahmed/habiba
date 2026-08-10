import type { TranscriptLine } from "@/components/clinical/transcript-panel";
import type { NoteContent } from "@/lib/db/schema";

/**
 * Synthetic demo data for the public site.
 *
 * Every value here is invented. It is a composite of nothing — no real session,
 * no real person, no real transcript. The marketing site renders the real
 * portal components against *these* objects and has no code path to anything
 * else, which is what makes "a live product component on a public page" safe
 * rather than terrifying.
 */

export const DEMO_TRANSCRIPT: TranscriptLine[] = [
  { id: "d1", speaker: "therapist", text: "Good to see you. How has the week been?" },
  { id: "d2", speaker: "patient", text: "Harder than I expected, honestly. The sleep thing came back." },
  { id: "d3", speaker: "therapist", text: "Tell me about the sleep — falling asleep, or staying asleep?" },
  { id: "d4", speaker: "patient", text: "Staying asleep. I wake around three and my head just starts going." },
  { id: "d5", speaker: "patient", text: "It is mostly work. There's a review coming up and I keep rehearsing it." },
  { id: "d6", speaker: "therapist", text: "So the rehearsing starts once you're already awake." },
  { id: "d7", speaker: "patient", text: "Right. And then I'm exhausted all day, which makes the worrying worse." },
  { id: "d8", speaker: "therapist", text: "Did you get a chance to try the wind-down routine?" },
  { id: "d9", speaker: "patient", text: "Twice. The nights I did it I got back to sleep faster, actually." },
  { id: "d10", speaker: "therapist", text: "That's worth noticing. Two nights out of seven, and both were better." },
  { id: "d11", speaker: "patient", text: "I hadn't connected those. I assumed nothing was working." },
];

export const DEMO_NOTE: NoteContent = {
  soap: {
    subjective:
      "Patient reports a return of middle-insomnia over the past week, waking around 03:00 with ruminative thinking focused on an upcoming performance review. Describes a reinforcing loop between daytime fatigue and anticipatory worry. Reports partial adherence to the agreed wind-down routine (2 of 7 nights), with subjectively faster return to sleep on both occasions.",
    objective:
      "Alert, oriented and engaged throughout. Affect mildly constricted and congruent with reported mood. Speech normal in rate and volume. Insight intact — patient revised an initial global appraisal when presented with their own data.",
    assessment:
      "Recurrence of anxiety-driven sleep disruption in the context of an identifiable, time-limited stressor. Consistent with the existing formulation rather than a new process. Adherence, not strategy, appears to be the limiting factor. No risk indicators elicited or observed.",
    plan: "Increase wind-down routine target to four nights before next session, with a written record of which nights were completed. Continue cognitive work on catastrophic appraisal of the review. Reassess sleep pattern at next session.",
  },
  summary:
    "Follow-up session addressing a one-week recurrence of middle-insomnia linked to anticipatory work anxiety. Partial adherence to the sleep intervention produced a measurable improvement the patient had not registered.",
  talkingPoints: [
    "Middle-insomnia recurrence, waking ~03:00 with rumination",
    "Upcoming performance review as the identifiable stressor",
    "Fatigue and worry operating as a reinforcing loop",
    "Wind-down routine used 2 of 7 nights — both nights better",
  ],
  observations:
    "Engaged and collaborative. Responded well to being shown the gap between reported outcome and actual data.",
  impressions:
    "Consistent with the existing formulation of anxiety-maintained sleep disruption. Provisional, for clinician review.",
  recommendations: [
    "Raise wind-down routine target to four nights per week with a simple written record",
    "Continue cognitive restructuring around performance-review catastrophising",
  ],
  followUp: "One week",
  patientBrief:
    "We spent most of today on the nights you have been having, and on how much of the day gets spent bracing for the next bad one. You put it into words really clearly.\n\nWe agreed you will try the wind-down we talked about — screens down an hour before bed, and getting up at the same time even after a rough night. Small and boring on purpose; it is the consistency that does the work.\n\nBefore next week, jot down roughly when you fall asleep and when you wake. Not a diary, just times. Bring it and we will look at it together.",
};
