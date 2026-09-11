/**
 * What 24Therapy connects to, and what it does not. PLAN.md 28.5, C149.
 *
 * ## 🔴 The page this registry exists to stop us shipping
 *
 * An integrations page is the easiest lie on a software website. Twelve logos
 * in a grid, each one a link to a page that says "connect your Zoom account",
 * and not one of them does anything. Everybody in the industry ships it, it
 * reliably wins meetings, and it is the exact defect this product's whole
 * argument is against: **every claim on the public site is a screen somebody
 * can open.**
 *
 * So each entry carries its real state, and the page renders the state rather
 * than the logo:
 *
 *   - `live`     you can use it today. There is a screen.
 *   - `partial`  some of it works and the rest does not, and the entry says
 *                which half, in a sentence.
 *   - `planned`  we intend to build it and it does not exist. **No date**, and
 *                no sign-up-to-be-told-first, because a waiting list is a
 *                commitment with the accountability removed.
 *
 * A `planned` entry is allowed on the page precisely because it is labelled.
 * Hiding it would be tidier and would leave a clinic asking us in an email
 * instead, which is worse for them and no more honest.
 *
 * ## Why a module and not a CMS page
 *
 * Because the state is a fact about the code, not a marketing decision. An
 * admin who could edit "planned" to "live" in a content editor is an admin who
 * can publish a false claim with one keystroke on a Friday. The prose around
 * each entry is editable; the state is not.
 */

export type IntegrationState = "live" | "partial" | "planned";

export type Integration = {
  slug: string;
  name: string;
  category: "Sessions" | "Payments" | "Messaging" | "Records" | "Meetings";
  state: IntegrationState;
  /** One line, on the index. */
  summary: string;
  /** What is true today, in full. Never aspirational. */
  today: string;
  /** What it does not do. Every entry has one, including the live ones. */
  limits: string;
  /** The sprint that changes this, when there is one. Named, not dated. */
  waitingOn?: string;
};

export const INTEGRATIONS: Integration[] = [
  {
    slug: "video-sessions",
    name: "Video sessions",
    category: "Sessions",
    state: "live",
    summary: "Run the session in the browser, with each person on their own audio track.",
    today:
      "A session created here opens a private room. Nobody enters it without a token minted on our server for that one person, and the room is deleted when the session ends. Because each participant arrives on a separate track, the transcript knows who said what rather than working it out from context.",
    limits:
      "It is our room, not yours. If your practice runs on something else, that is the Zoom and Meet entry below, and it is not built.",
  },
  {
    slug: "in-person-sessions",
    name: "In-person sessions",
    category: "Sessions",
    state: "live",
    summary: "One phone on the table, transcribed and written up the same way.",
    today:
      "Start the session on a phone and it records, transcribes and writes the note exactly as a video session does. The patient is asked for consent on the same screen, in their language.",
    limits:
      "One microphone hears the whole room, so who was speaking is worked out from context rather than known. The note says so. Telling two voices apart acoustically is built in a later sprint and is not here yet.",
    waitingOn: "sprint 37, acoustic diarisation",
  },
  {
    slug: "stripe",
    name: "Stripe",
    category: "Payments",
    state: "partial",
    summary: "Card payments, straight into the clinician's own account where Stripe reaches them.",
    today:
      "Where a clinician has a Stripe account that can take money, the patient's card is charged into it directly and we never hold the funds. Our fee is taken as a platform fee on the same charge.",
    limits:
      "Stripe does not pay out to every country we operate in. Egypt is the live example: there we collect the payment, hold it, and pay out by hand on request, and the clinician can watch every step of that on their earnings page. That is a different arrangement and the pricing page says so rather than averaging the two.",
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    category: "Messaging",
    state: "partial",
    summary: "Session links, reminders and codes over WhatsApp, where Meta has approved the template.",
    today:
      "Every message this product sends goes through one function that tries WhatsApp and email, and sends on both where both exist. Most patients here have no email address at all, which is why WhatsApp is first rather than a convenience.",
    limits:
      "Each message type needs Meta to approve a template, one at a time, and the authentication templates are on a stricter track. Until one is approved that particular message does not arrive, and the screen that depends on it says so in those words rather than pretending it sent.",
  },
  {
    slug: "record-extract",
    name: "Record extract",
    category: "Records",
    state: "live",
    summary: "A patient's whole record, emailed to them, with a code a third party can check.",
    today:
      "Every session, every note a clinician signed, every version of the clinical summary, the journals and the dates, with the name and licence of whoever signed each note. It is emailed to the patient and to nobody else, and the cover page carries a code anybody can check on a public page.",
    limits:
      "It is a record extract and never a certificate. The verification page confirms that we produced the document and what it contained, and says nothing about whether a clinical judgement inside it is correct.",
  },
  {
    slug: "zoom-and-meet",
    name: "Zoom and Google Meet",
    category: "Meetings",
    state: "planned",
    summary: "Not built. A bot that joins a session you created here, and nothing else.",
    today:
      "Nothing works today. When it does, one rule governs it: the bot joins meetings 24Therapy created for a session, and never anything else. No calendar is ever read, because a tool that watches a calendar eventually records a supervision call or a conversation with an accountant.",
    limits:
      "It needs the patient's link to remain ours, so the consent screen still happens before they are forwarded to the meeting. It also needs a transcript to tell two voices apart on one mixed stream, which is why it cannot ship before that does.",
    waitingOn: "sprints 37 and 41",
  },
  {
    slug: "clinic-systems",
    name: "Your clinic's own system",
    category: "Records",
    state: "planned",
    summary: "Not built. A way to push a finished note into the record system you already use.",
    today:
      "Nothing works today. The design problem is mapping identities: two clinics will both send us a patient called P123, and treating either as ours is how one person's note reaches another person's chart.",
    limits:
      "Until it exists, the honest answer is that this is a second place to look, and a clinic should decide whether that is acceptable before signing anything.",
    waitingOn: "sprint 42, the partner plane",
  },
];

export function findIntegration(slug: string): Integration | null {
  return INTEGRATIONS.find((entry) => entry.slug === slug) ?? null;
}

export const STATE_LABEL: Record<IntegrationState, string> = {
  live: "Working today",
  partial: "Partly working",
  planned: "Not built yet",
};
