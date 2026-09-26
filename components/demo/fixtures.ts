import type { TranscriptLine } from "@/components/clinical/transcript-panel";
import type { NoteContent } from "@/lib/db/schema";

/**
 * Synthetic demo data for the public site.
 *
 * Every value here is invented. No real session, no real person, no real
 * transcript. The marketing site renders the real portal components against
 * *these* objects and has no code path to anything else, which is what makes
 * "a live product component on a public page" safe rather than terrifying.
 *
 * 🔴 AND IT IS THE VIDEO'S SESSION NOW (founder, 26 Sep): Mariam Hassan's fourth
 * session with Dr Karim Nabil, the one where she reports the conversation with
 * her manager, typed out of `scripts/_event-story.ts` by hand. The room on the
 * homepage, the transcript and the note on `/for-therapists`, and the portal
 * mockups all tell the one story a visitor can then sign into.
 */

export const DEMO_TRANSCRIPT: TranscriptLine[] = [
  { id: "d1", speaker: "therapist", text: "You look different today. How did the conversation with Sherine go?" },
  { id: "d2", speaker: "patient", text: "I did it on Tuesday. كنت خايفة جدًا بس الموضوع طلع أبسط بكتير." },
  { id: "d3", speaker: "therapist", text: "What did you agree?" },
  {
    id: "d4",
    speaker: "patient",
    text: "If it is urgent she calls. Everything else I answer in the morning. She said she did not expect me to answer at night at all.",
  },
  { id: "d5", speaker: "therapist", text: "She did not expect it. How did that land?" },
  { id: "d6", speaker: "patient", text: "I laughed. Two years of answering at midnight and she never needed it." },
  { id: "d7", speaker: "therapist", text: "And the sleep this week?" },
  {
    id: "d8",
    speaker: "patient",
    text: "Five nights of seven I slept through. The questionnaires felt different too, I noticed when I filled them in.",
  },
  { id: "d9", speaker: "therapist", text: "They are. Both scores came down by about five points since the first week." },
  { id: "d10", speaker: "patient", text: "I am worried it will come back when the quarter closes. That is always a bad month." },
  { id: "d11", speaker: "therapist", text: "That is a good thing to plan for. What would you notice first if it started coming back?" },
  { id: "d12", speaker: "patient", text: "Checking my phone in bed. That is always the first thing." },
  { id: "d13", speaker: "therapist", text: "Then that is your early sign. Let us write down what you would do if you notice it." },
  { id: "d14", speaker: "patient", text: "Phone back to the kitchen, and book a session before it gets bad, not after." },
];

export const DEMO_NOTE: NoteContent = {
  soap: {
    subjective:
      "Held a one-to-one with her manager and agreed that urgent matters come by phone call and everything else waits until morning. Manager said she never expected night replies. Slept through five of seven nights. Anticipates pressure at quarter close.",
    objective: "Relaxed, smiling, spontaneous humour. Speech and affect markedly brighter than at intake.",
    assessment:
      "Significant improvement in sleep and anxiety. PHQ-9 7 (from 12), GAD-7 8 (from 13). Belief about availability substantially revised by direct evidence.",
    plan: "Relapse prevention: early warning sign (checking phone in bed) and response plan. Consolidate over the next sessions and review workload before quarter close.",
  },
  summary: "Agreed response times with her manager; sleeping through five of seven nights; relapse plan written.",
  talkingPoints: ["Quarter close and workload", "Keeping the gains without the notes"],
  observations: "Relaxed, smiling, spontaneous humour. Speech and affect markedly brighter than at intake.",
  impressions: "Good response to a brief behavioural and cognitive approach. Prognosis good.",
  recommendations: ["Relapse prevention plan in place", "Space sessions out after the quarter close if stable"],
  followUp: "One week, then review spacing.",
  patientBrief:
    "You had the conversation you were dreading, and it turned out your manager never expected a reply at night. Five nights of seven slept through, and both questionnaires are about five points lower than in the first week.",
  patientSteps: [
    "Your early sign is checking the phone in bed",
    "If you notice it: phone back to the kitchen, and book a session early",
  ],
  patientNext: "Next session: planning for the quarter close before it arrives.",
};
