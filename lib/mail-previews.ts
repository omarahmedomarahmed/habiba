import "server-only";

import { potAlertLink, potAlertMessage } from "@/lib/billing/pot-alerts";
import { overdueAlertMessage } from "@/lib/billing/payouts";
import { CODE_TTL_MINUTES } from "@/lib/data/enrolment-verify";
import { exportPath } from "@/lib/data/export";
import { domainConfirmMessage } from "@/lib/data/sponsor-domains";
import { EXPORT_TTL_HOURS, type NoteContent } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { whenFor } from "@/lib/i18n/message-words";
import { translator } from "@/lib/i18n/server";
import { limitAlertMessage } from "@/lib/partner/usage";
import { patientSessionLink } from "@/lib/sessions/patient-link";
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
 * It was a script, and the script could not run. Every message goes out to
 * patients, clinicians and finance teams, and `npm run mail:preview -- --send`
 * renders every one by calling the real functions — but sending needs
 * `RESEND_API_KEY`, and on Vercel that variable is stored as **sensitive**,
 * which is write-only by design. Nobody can read it back: not the dashboard,
 * not the API, not the person who typed it in. So the one process that holds
 * the key is the deployed product, and a tool that lives only in a shell can
 * render them all and never send them.
 *
 * The list lives here so both callers use the same one: the script still
 * renders them to `.render/mail/`, and `/admin/settings` sends them from
 * production, where the key is.
 *
 * ## 🔴 ONE COPY, WHICH IS THE POINT
 *
 * The obvious build is to leave the script alone and write the list out
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
 * 🔴 AE69: THE WORDS AND THE LINKS ARE THE REAL SENDS', NOT A COPY OF THEM.
 *
 * This list said fourteen in its comments while it held twenty-six, linked
 * five routes that do not exist (`/reset/…`, `/claim/…`, `/export/…`,
 * `/sponsor/billing`, `/sponsor/confirm/…`), told a benefit code lasted 15
 * minutes where the real one lasts 30, and previewed two messages nothing
 * sends. So each preview now reads the dictionary key, the builder or the link
 * helper the real call site uses, in English, and `verify:sprint77` fails on
 * any link here that no route answers. How many there are is counted where it
 * is shown, never written down.
 *
 * 🔴 THE ORDER IS BY AUDIENCE, because that is the question being answered.
 */
export function previewMessages(): PreviewMessage[] {
  const app = env.appUrl;
  const t = translator("en");
  const words = { locale: "en" as const, t };
  const therapist = "Dr Nour Demo";
  const when = whenFor(WHEN, { name: "Africa/Cairo", source: "reader" }, words);
  const door = patientSessionLink(app, "DEMO-TOKEN");

  return [
    {
      name: "session report",
      audience: "patient",
      when: "the clinician approves the note after a session",
      send: (to) =>
        sendSessionReport({
          to,
          patientName: "Mariam Demo",
          therapistName: therapist,
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
          therapistName: therapist,
          joinUrl: `${app}/join/DEMO-TOKEN`,
          priceCents: 6_000,
        }),
    },
    {
      name: "pay link",
      audience: "patient",
      when: "the clinician sends them the link to pay for a session",
      send: (to) =>
        sendNotification({
          to,
          subject: t("pmsg.payLink.subject"),
          body: t("pmsg.payLink.body", { therapist }),
          link: { label: t("pmsg.payLink.link"), url: `${app}/pay/DEMO-TOKEN` },
        }),
    },
    {
      name: "rating reminder",
      audience: "patient",
      when: "a day after a session, once",
      send: (to) =>
        sendRatingReminder({
          to,
          therapistName: therapist,
          therapistFirstName: "Nour",
          url: `${app}/feedback/DEMO-TOKEN`,
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
      send: (to) => sendPasswordReset({ to, url: `${app}/reset-password?token=DEMO-TOKEN` }),
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
          clinicianName: therapist,
          url: `${app}${exportPath("DEMO-TOKEN")}`,
          expiresInHours: EXPORT_TTL_HOURS,
        }),
    },
    {
      name: "walk-in directions",
      audience: "patient",
      when: "they book a room rather than a video call",
      send: (to) =>
        sendWalkInDirections({
          to,
          therapistName: therapist,
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
          subject: t("pmsg.booked.subject", { therapist }),
          body: t("pmsg.booked.body", { therapist, when }),
          link: door ? { ...door, label: t("pmsg.openSession") } : undefined,
        }),
    },
    {
      name: "booking reminder",
      audience: "patient",
      when: "the day before",
      send: (to) =>
        sendNotification({
          to,
          subject: t("pmsg.sessionWith", { therapist }),
          body: t("pmsg.reminder.body", { therapist, when }),
          link: door ? { ...door, label: t("pmsg.openSession") } : undefined,
        }),
    },
    {
      name: "session started",
      audience: "patient",
      when: "the clinician opens the room",
      send: (to) =>
        sendNotification({
          to,
          subject: t("pmsg.started.subject"),
          body: `${t("pmsg.hi", { name: "Mariam" })}\n\n${t("pmsg.started.body", { therapist })}`,
          link: { label: t("pmsg.started.link"), url: `${app}/join/DEMO-TOKEN` },
        }),
    },
    {
      name: "booking cancelled",
      audience: "patient",
      when: "the clinician gives the hour back",
      send: (to) =>
        sendNotification({
          to,
          subject: t("w1a.noShowCancelled"),
          body: [t("w1a.cancelledByClinician"), t("w1a.cancelReasonGiven", { reason: "I am unwell this week." })].join(
            "\n\n",
          ),
        }),
    },
    {
      name: "claim invitation",
      audience: "patient",
      when: "a clinician hands somebody the record they already hold about them",
      send: (to) =>
        sendNotification({
          to,
          subject: t("pmsg.claimInvite.subject", { who: therapist }),
          body: t("pmsg.claimInvite.body", { who: therapist }),
          link: { label: t("pmsg.claimInvite.link"), url: `${app}/patient/invite/DEMO-TOKEN` },
        }),
    },
    {
      name: "consent granted",
      audience: "patient",
      when: "they let a new clinician read what an old one wrote",
      send: (to) =>
        sendNotification({
          to,
          subject: t("pmsg.granted.subject"),
          body: t("pmsg.granted.body", { name: "Dr Sara Demo" }),
          link: { label: t("pmsg.granted.link"), url: `${app}/patient/consent` },
        }),
    },
    {
      name: "old clinician answered",
      audience: "patient",
      when: "the practice they left answers a request for what it holds",
      send: (to) =>
        sendNotification({
          to,
          subject: t("pmsg.history.addedSubject"),
          body: t("pmsg.history.added"),
          link: { label: t("pmsg.openRecord"), url: `${app}/patient/profile` },
        }),
    },
    {
      name: "check-in",
      audience: "patient",
      when: "on a schedule, and it is the only message here nobody asked for",
      send: (to) =>
        sendNotification({
          to,
          subject: t("checkin.subject"),
          body: `${t("checkin.1", { name: "Mariam" })}\n\n${t("checkin.howToStop")}`,
        }),
    },
    {
      name: "benefit code",
      audience: "patient",
      when: "they confirm they work somewhere that pays for their therapy",
      send: (to) =>
        sendNotification({
          to,
          subject: t("pmsg.code.benefitSubject"),
          body: t("pmsg.code.benefit", { code: "604118", minutes: CODE_TTL_MINUTES }),
        }),
    },
    {
      name: "support answered",
      audience: "patient",
      when: "we close a message they sent us",
      send: (to) =>
        sendNotification({
          to,
          subject: t("pmsg.support.subject"),
          body: t("pmsg.support.body", {
            reference: "SUP-DEMO-01",
            link: `${app}/support/DEMO-TOKEN`,
            code: "730492",
          }),
          link: { label: t("pmsg.support.link"), url: `${app}/support/DEMO-TOKEN` },
        }),
    },

    /* --------------------------------------------------- the clinician -- */

    {
      name: "payout sent",
      audience: "clinician",
      when: "we transfer their earnings out",
      send: (to) =>
        sendNotification({
          to,
          subject: t("tmsg.payout.sentSubject"),
          body: t("tmsg.payout.sent", { amount: "1840.00 EGP", account: "Nour Demo" }),
        }),
    },
    {
      name: "payout rejected",
      audience: "clinician",
      when: "we cannot send their earnings and have to say why",
      send: (to) =>
        sendNotification({
          to,
          subject: t("tmsg.payout.rejectedSubject"),
          /* The real body is the operator's reason, word for word. */
          body: "The account name on the transfer did not match the name on the account. Correct it on your earnings page and ask again.",
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
      send: (to) => {
        const message = potAlertMessage("empty", "Acme Demo");
        return sendNotification({ to, subject: message.subject, body: message.body, link: potAlertLink(false) });
      },
    },
    {
      name: "confirm the domain",
      audience: "company",
      when: "somebody sets up cover and we check they speak for the organisation",
      send: (to) =>
        sendNotification({
          to,
          ...domainConfirmMessage("example.com", `${app}/sponsor/domains/confirm/DEMO-ID?t=DEMO-TOKEN`),
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
          ...limitAlertMessage({ name: "Health Demo", at: 80, used: 400, limit: 500, projected: 470 }),
        }),
    },

    /* -------------------------------------------------- our own staff -- */

    {
      name: "payout overdue",
      audience: "our staff",
      when: "a clinician's withdrawal has sat unworked too long",
      /* 24 hours is the shipped `alertAfterHours`; the real one reads the setting. */
      send: (to) => sendNotification({ to, ...overdueAlertMessage(25_500, 24, false) }),
    },
  ];
}
