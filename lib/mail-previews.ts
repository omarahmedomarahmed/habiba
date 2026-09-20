import "server-only";

import type { NoteContent } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  sendClaimCode,
  sendNotification,
  sendPasswordReset,
  sendRatingReminder,
  sendRecordExport,
  sendSessionInvite,
  sendSessionReport,
  sendTherapistMessage,
  sendWalkInDirections,
} from "@/lib/mail";

/**
 * 🔴 77.12 — EVERY AUTOMATED MESSAGE THIS PRODUCT SENDS, AS ONE LIST.
 *
 * ## Why this is a module rather than a script
 *
 * It was a script, and the script could not run. Fourteen messages go out to
 * patients, clinicians and finance teams, and `npm run mail:preview -- --send`
 * renders every one by calling the real functions — but sending needs
 * `RESEND_API_KEY`, and on Vercel that variable is stored as **sensitive**,
 * which is write-only by design. Nobody can read it back: not the dashboard,
 * not the API, not the person who typed it in. So the one process that holds
 * the key is the deployed product, and a tool that lives only in a shell can
 * render the fourteen and never send them.
 *
 * The list lives here so both callers use the same one: the script still
 * renders them to `.render/mail/`, and `/admin/settings` sends them from
 * production, where the key is.
 *
 * ## 🔴 ONE COPY, WHICH IS THE POINT
 *
 * The obvious build is to leave the script alone and write the fourteen out
 * again in the action. That is C60's shape applied to a message instead of a
 * number: the day a subject line changes, one of the two copies is corrected
 * and the other is the one the founder is reading. A template that changes
 * changes here, and both callers see it.
 *
 * ## 🔴 EVERY NAME AND FIGURE IS INVENTED
 *
 * Surnames Demo and Example, at a domain RFC 2606 reserves. C127 has no
 * preview exemption: a tool that sent a real note would put clinical content
 * in somebody's inbox, and this one is reachable from a console rather than
 * from a shell, which makes the rule matter more rather than less.
 *
 * ## 🔴 AND IT GOES TO ONE TYPED ADDRESS
 *
 * No list, no roster, no database read. The address is typed by the person who
 * wants the mail, and there is no code path here that could reach a patient's
 * inbox. That property is what makes this safe to put on a page rather than
 * behind a secret.
 */

/** One message, ready to send, named for the row a reader will recognise. */
export type PreviewMessage = { name: string; send: (to: string) => Promise<boolean> };

const WHEN = new Date(Date.UTC(2026, 2, 12, 15, 0));

/** The note every clinical template renders. Invented, and it reads like one. */
const NOTE: NoteContent = {
  soap: {
    subjective:
      "Reports a return of middle-insomnia over the past week, waking around 03:00 with ruminative thinking about an upcoming performance review.",
    objective: "Arrived on time. Engaged throughout. No acute distress observed.",
    assessment:
      "Recurrence of anxiety-driven sleep disruption in the context of a time-limited work stressor. Adherence, not strategy, appears to be the limiting factor.",
    plan: "Increase the wind-down routine target to four nights and record which nights were completed.",
  },
  summary:
    "Follow-up session addressing a one-week recurrence of middle-insomnia linked to anticipatory work anxiety.",
  patientBrief:
    "Two of seven nights went better, and that is worth naming. Keep the wind-down going and we will look at it again in two weeks.",
  patientSteps: ["Wind-down routine, four nights", "Note which nights you managed it"],
  patientNext: "Same time next week. Bring the nights you wrote down.",
  talkingPoints: [
    "The review, and what happens after it",
    "What made the two better nights different",
  ],
  observations: "Engaged, no acute distress, no risk indicators elicited or observed.",
  impressions: "Consistent with the established formulation rather than a new process.",
  recommendations: [
    "Raise the adherence target",
    "Review if middle-insomnia outlasts the review date",
  ],
  followUp: "One week.",
};

/**
 * The fourteen, in the order a person meets them.
 *
 * Ten come from named functions in `lib/mail.ts`. The other four go through
 * `sendNotification`, which is the shell five call sites build a subject and a
 * body for; the copy below is lifted from those call sites rather than
 * invented, so what arrives is the sentence that actually goes out.
 */
export function previewMessages(): PreviewMessage[] {
  const app = env.appUrl;

  return [
    {
      name: "session report",
      send: (to) =>
        sendSessionReport({
          to,
          patientName: "Mariam Demo",
          therapistName: "Dr Nour Demo",
          note: NOTE,
          sessionDate: WHEN,
          timezone: "Africa/Cairo",
          language: "en",
        }),
    },
    {
      name: "session invite",
      send: (to) =>
        sendSessionInvite({
          to,
          therapistName: "Dr Nour Demo",
          joinUrl: `${app}/j/DEMO1234`,
          priceCents: 6_000,
        }),
    },
    {
      name: "rating reminder",
      send: (to) =>
        sendRatingReminder({
          to,
          therapistName: "Dr Nour Demo",
          therapistFirstName: "Nour",
          url: `${app}/r/DEMO1234`,
          sessionDate: WHEN,
          timezone: "Africa/Cairo",
        }),
    },
    {
      name: "therapist message",
      send: (to) =>
        sendTherapistMessage({
          to,
          firstName: "Mariam",
          subject: "About next week",
          body: "I have moved us to Thursday at the same time. Tell me if that does not work.",
        }),
    },
    {
      name: "password reset",
      send: (to) => sendPasswordReset({ to, url: `${app}/reset/DEMO-TOKEN` }),
    },
    { name: "claim code", send: (to) => sendClaimCode({ to, code: "419026" }) },
    {
      name: "record export",
      send: (to) =>
        sendRecordExport({
          to,
          patientName: "Mariam Demo",
          clinicianName: "Dr Nour Demo",
          url: `${app}/export/DEMO-TOKEN`,
          expiresInHours: 24,
        }),
    },
    {
      name: "walk-in directions",
      send: (to) =>
        sendWalkInDirections({
          to,
          therapistName: "Dr Nour Demo",
          practiceName: "Nile Practice",
          address: "12 Road 9, Maadi, Cairo",
          mapsUrl: "https://maps.google.com/?q=Maadi+Cairo",
        }),
    },
    {
      name: "booking confirmed",
      send: (to) =>
        sendNotification({
          to,
          subject: "A session with Dr Nour Demo",
          body: "Dr Nour Demo has kept Thursday 12 March at 17:00 for you.\n\nIf that does not work, tell them as early as you can and the hour goes back on their calendar for somebody else.",
          link: { label: "Open your session", url: `${app}/sessions/demo` },
        }),
    },
    {
      name: "booking reminder",
      send: (to) =>
        sendNotification({
          to,
          subject: "Your session with Dr Nour Demo",
          body: "A reminder that your session with Dr Nour Demo is tomorrow at 17:00.\n\nIf you cannot make it, tell them as early as you can. The hour goes back on their calendar for somebody else.",
          link: { label: "Open your session", url: `${app}/sessions/demo` },
        }),
    },
    {
      name: "session started",
      send: (to) =>
        sendNotification({
          to,
          subject: "Dr Nour Demo is ready for you",
          body: "The door is open. Join when you are ready.",
          link: { label: "Go in", url: `${app}/sessions/demo` },
        }),
    },
    {
      name: "summary ready",
      send: (to) =>
        sendNotification({
          to,
          subject: "Your session summary is ready",
          body: "Dr Nour Demo has approved the summary from your session. It is on your record.",
          link: { label: "Read it", url: `${app}/patient/sessions` },
        }),
    },
    {
      name: "payout sent",
      send: (to) =>
        sendNotification({
          to,
          subject: "Your withdrawal is on its way",
          body: "We have sent 1,840.00 EGP to Dr Nour Demo. The transfer receipt is on your earnings page.",
          link: { label: "Your earnings", url: `${app}/billing` },
        }),
    },
    {
      name: "payment due",
      send: (to) =>
        sendNotification({
          to,
          subject: "A session is waiting to be paid",
          body: "Your session on 12 March has an unpaid balance of 60.00 EGP. Nothing about your record changes until it is settled.",
          link: { label: "Pay for it", url: `${app}/patient/billing` },
        }),
    },
  ];
}
