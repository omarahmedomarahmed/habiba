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

/**
 * 🔴 78.4 — WHO THE MESSAGE IS FOR, which was the founder's actual question.
 *
 * Fourteen messages arrived in one inbox and the question back was: are these
 * all the patient's, do we send a company anything, what does a therapist get?
 * The answer was in the code and nowhere a person could read it — and it turned
 * out twelve of the fourteen were the patient's, so the list LOOKED complete
 * and was a survey of one audience.
 *
 * So every message now says whose it is, the console groups by it, and
 * `verify:sprint77` fails if any audience this product mails has nothing here.
 * A count cannot catch a missing audience; only naming them can.
 */
export type Audience =
  /** The person in therapy. */
  | "patient"
  /** The clinician, about their own practice and their own money. */
  | "clinician"
  /** A company or university paying for its people. Never about a named person. */
  | "company"
  /** A platform reselling us, about their own account. */
  | "partner"
  /** Our own operators. Nobody outside the company sees these. */
  | "our staff";

/**
 * What a client component may be told about the list: names, audiences and
 * moments, and nothing that could send anything.
 *
 * 🔴 The `send` function is deliberately absent. A server action cannot cross
 * the boundary and a list carrying one would fail the `boundary` gate, which is
 * the correct outcome: the console shows what WOULD go out, and the going out
 * happens in the action behind `requireRole("super_admin")`.
 */
export type PreviewRow = { name: string; audience: Audience; when: string };

/** The list as plain data, for a page to hand a client component. */
export function previewRoster(messages: PreviewMessage[]): PreviewRow[] {
  return messages.map(({ name, audience, when }) => ({ name, audience, when }));
}

/** One message, ready to send, named for the row a reader will recognise. */
export type PreviewMessage = {
  name: string;
  audience: Audience;
  /** When it fires, in the words somebody would use to describe the moment. */
  when: string;
  send: (to: string) => Promise<boolean>;
};

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
 * Every one of them, grouped by who receives it.
 *
 * Ten come from named functions in `lib/mail.ts`. The rest go through
 * `sendNotification`, which is the shell every other call site builds a subject
 * and a body for; the copy below is lifted from those call sites rather than
 * invented, so what arrives is the sentence that actually goes out.
 *
 * 🔴 THE ORDER IS BY AUDIENCE, because that is the question being answered.
 * Fourteen messages sorted by when they fire looked like a complete survey and
 * was twelve patient messages with two others at the end.
 */
export function previewMessages(): PreviewMessage[] {
  const app = env.appUrl;

  return [
    {
      name: "session report",
      audience: "patient",
      when: "the clinician approves the note after a session",
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
      audience: "patient",
      when: "a clinician books somebody in who has no account yet",
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
      audience: "patient",
      when: "a day after a session, once",
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
      audience: "patient",
      when: "the clinician writes to them from the patient profile",
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
      audience: "patient",
      when: "anybody asks to reset a password. The same template for every role",
      send: (to) => sendPasswordReset({ to, url: `${app}/reset/DEMO-TOKEN` }),
    },
    {
      name: "claim code",
      audience: "patient",
      when: "they start claiming the record a clinician holds about them",
      send: (to) => sendClaimCode({ to, code: "419026" }),
    },
    {
      name: "record export",
      audience: "patient",
      when: "they ask for everything we hold, and it is ready",
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
      audience: "patient",
      when: "they book a room rather than a video call",
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
      audience: "patient",
      when: "a session is put in the diary",
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
      audience: "patient",
      when: "the day before",
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
      audience: "patient",
      when: "the clinician opens the room",
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
      audience: "patient",
      when: "the note is approved and lands on their record",
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
      audience: "clinician",
      when: "we transfer their earnings out",
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
      audience: "patient",
      when: "a session ends with a balance on it",
      send: (to) =>
        sendNotification({
          to,
          subject: "A session is waiting to be paid",
          body: "Your session on 12 March has an unpaid balance of 60.00 EGP. Nothing about your record changes until it is settled.",
          link: { label: "Pay for it", url: `${app}/patient/billing` },
        }),
    },

    /* ------------------------------------------------ the patient, cont. -- */

    {
      name: "booking cancelled",
      audience: "patient",
      when: "the clinician gives the hour back",
      send: (to) =>
        sendNotification({
          to,
          subject: "Thursday is free again",
          body: "Dr Nour Demo has released Thursday 12 March at 17:00. Nothing has been charged.\n\nYou can book another time whenever suits you.",
          link: { label: "Find another time", url: `${app}/patient/sessions` },
        }),
    },
    {
      name: "claim invitation",
      audience: "patient",
      when: "a clinician hands somebody the record they already hold about them",
      send: (to) =>
        sendNotification({
          to,
          subject: "Dr Nour Demo has invited you to your record",
          body: "The notes from your sessions are yours. Setting up an account takes a minute and moves them to you, where they stay whoever you see next.",
          link: { label: "Set it up", url: `${app}/claim/DEMO-TOKEN` },
        }),
    },
    {
      name: "consent granted",
      audience: "patient",
      when: "they let a new clinician read what an old one wrote",
      send: (to) =>
        sendNotification({
          to,
          subject: "Somebody can now read your history",
          body: "Dr Sara Demo can read your history from now on. If that is not what you meant, you can stop it in one tap, and nobody is told why.",
          link: { label: "See who can read it", url: `${app}/patient/profile` },
        }),
    },
    {
      name: "old clinician answered",
      audience: "patient",
      when: "the practice they left answers a request for what it holds",
      send: (to) =>
        sendNotification({
          to,
          subject: "Your old therapist added to your record",
          body: "What they hold has been added to the record you own. It is in your profile.",
          link: { label: "Open your record", url: `${app}/patient/profile` },
        }),
    },
    {
      name: "check-in",
      audience: "patient",
      when: "on a schedule, and it is the only message here nobody asked for",
      send: (to) =>
        sendNotification({
          to,
          subject: "How has this week been?",
          body: "No answer needed. If you want to write something down, it goes on your record and your therapist sees it before your next session.\n\nYou can turn these off in your account at any time.",
          link: { label: "Write something", url: `${app}/patient/journal` },
        }),
    },
    {
      name: "benefit code",
      audience: "patient",
      when: "they confirm they work somewhere that pays for their therapy",
      send: (to) =>
        sendNotification({
          to,
          subject: "Your confirmation code",
          body: "Your code is 604118. Type it into the app to confirm your benefit. It lasts 15 minutes.",
        }),
    },
    {
      name: "support answered",
      audience: "patient",
      when: "we close a message they sent us",
      send: (to) =>
        sendNotification({
          to,
          subject: "Your message to 24Therapy",
          body: `We have answered your message (reference SUP-DEMO-01). Open ${app}/support/DEMO-TOKEN and enter the code 730492 to read the reply and anything attached to it. The code lasts seven days.`,
          link: { label: "Read the reply", url: `${app}/support/DEMO-TOKEN` },
        }),
    },

    /* --------------------------------------------------- the clinician -- */

    {
      name: "payout rejected",
      audience: "clinician",
      when: "we cannot send their earnings and have to say why",
      send: (to) =>
        sendNotification({
          to,
          subject: "We could not process your withdrawal",
          body: "The account name on the transfer did not match the name on the account. Correct it on your earnings page and ask again, and nothing about the amount changes.",
          link: { label: "Your earnings", url: `${app}/billing` },
        }),
    },

    /* --------------------------------------------------- the company -- */

    /*
     * 🔴 C227 / C229 / C243 — A SPONSOR IS NEVER TOLD WHO WENT.
     *
     * Both of these are about the sponsor's own account and neither carries a
     * name, a session, a date or a clinician. That is the whole design of the
     * employer side: a company sees money leaving a pot and never who it was
     * spent on, because a list of who used the therapy benefit is the single
     * most damaging thing this product could hand an employer.
     */
    {
      name: "the pot ran out",
      audience: "company",
      when: "the fund empties and their people start being asked to pay",
      send: (to) =>
        sendNotification({
          to,
          subject: "Your therapy fund needs topping up",
          body: "Habiba Holdings's fund has run out, so we have stopped covering sessions and your people are being asked to pay for their own. Topping it up starts the cover again immediately.",
          link: { label: "Top it up", url: `${app}/sponsor/billing` },
        }),
    },
    {
      name: "confirm the domain",
      audience: "company",
      when: "somebody sets up cover and we check they speak for the organisation",
      send: (to) =>
        sendNotification({
          to,
          subject: "Confirm example.com for your organisation's mental health cover",
          body: "Somebody at your organisation asked us to set up mental health cover for your people. Confirming this address is one of two checks we do before any joining code works. It commits you to nothing.",
          link: { label: "Confirm it", url: `${app}/sponsor/confirm/DEMO-TOKEN` },
        }),
    },

    /* --------------------------------------------------- the partner -- */

    {
      name: "close to the limit",
      audience: "partner",
      when: "a reselling platform passes 80 and then 90 per cent of its month",
      send: (to) =>
        sendNotification({
          to,
          subject: "Demo Health: 80% of this month's session limit",
          body: "You have used 400 of the 500 sessions this account allows this month, and are on course for about 470. At the limit your own platform keeps working exactly as it does now, and our transcription, notes, summaries and copilot stop until you raise it.",
          link: { label: "Your usage", url: `${app}/partner/usage` },
        }),
    },

    /* -------------------------------------------------- our own staff -- */

    {
      name: "payout overdue",
      audience: "our staff",
      when: "a clinician's withdrawal has sat unworked too long",
      send: (to) =>
        sendNotification({
          to,
          subject: "A payout has been waiting too long",
          body: "A withdrawal of $255.00 has been open for more than 24 hours. Nobody has taken it on.",
          link: { label: "The payouts queue", url: `${app}/admin/payouts` },
        }),
    },
  ];
}
