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
    /*
     * 🔴 41 — `partial`, and the entry says which half.
     *
     * Not `live`: Zoom works and Google Meet and Teams do not, and this
     * registry's whole argument is that the state is a fact about the code
     * rather than a marketing decision. Calling it live because one of three
     * providers works is the twelve-logos-in-a-grid page with one logo
     * removed.
     */
    state: "partial",
    summary: "Zoom works. A recorder that joins a session you created here, and nothing else.",
    today:
      "Connect a Zoom account once in Settings and 24Therapy creates the meeting inside it for each session, so the link stays ours until the patient has answered the recording question. The recorder joins the moment they agree, and a refusal sends no recorder at all rather than one that sits quietly in the room. One rule governs all of it: the bot joins meetings 24Therapy created for a session and never anything else. No calendar is ever read, and no calendar permission is even requested, because a tool that watches a calendar eventually records a supervision call or a conversation with an accountant.",
    limits:
      "Google Meet and Teams can be connected and cannot yet create a meeting, so those sessions run in the 24Therapy room. Many clinics block third-party Zoom apps at the account level, which no setting here can change, and the Settings page says so before you try. There is no way to point the recorder at a meeting you made yourself, which is deliberate rather than missing.",
    waitingOn: "Google Meet and Teams meeting creation",
  },
  {
    slug: "clinic-systems",
    name: "Your clinic's own system",
    category: "Records",
    /*
     * 🔴 `partial`, not `live`, and the half that works is small.
     *
     * This said "the SMART on FHIR flow works end to end against a sandbox ... and
     * the note you approve is filed back". It did not: `fileNote`, `recordLaunch`
     * and `readPatientName` had no caller and there is no launch route, so a
     * clinician can never be opened from a chart and no note is ever filed. What
     * exists is the practice's connection (the OAuth dance and its callback).
     * The copy now says that, and names the missing half as what it waits on.
     */
    state: "partial",
    summary:
      "A practice can connect its record system. Filing approved notes back into it is not built yet.",
    today:
      "A practice can connect its SMART on FHIR record system to us once, from its records settings, against a sandbox. Opening us from a patient's chart and filing an approved note back as a document on that chart are not built yet, so today nothing is read from your chart and nothing is filed into it. No hospital has registered us in its own tenant either, and each one has to before anything connects there. When the launch is built, your patient id will be resolved only within the connection that issued it, so P123 at your hospital and P123 at another stay two rows that cannot reach each other.",
    limits:
      "Your system is the record and ours is not. When the launch is built we will read one thing from your chart, the patient's name, so a schedule row is not blank; we will read and keep no date of birth, record number, address, payer, problem list, medication or allergy, and there is nowhere in our database to put one. What we keep is what we made: the session, the transcript recorded under the patient's consent, the note and who approved it. Disconnecting stops us using the connection the same moment and leaves the patient's record with us.",
    waitingOn:
      "the launch from a patient's chart and filing notes back, which are ours to build, then a hospital tenant registration, which is theirs to grant",
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

/* ────────────────────────────────────────────── the systems, by name ── */

/**
 * 🔴 76.78 — THE PRODUCTS BY NAME, AND WHAT IS TRUE OF EACH.
 *
 * "We integrate with your HR system" is a sentence nobody can check, and the
 * first question a buyer asks is the name of theirs. So both lists below are
 * products, spelled as their owners spell them.
 *
 * ## Every status is the truth and most of them are `planned`
 *
 * This is the whole reason integration pages stop being believed: a grid where
 * every logo looks equally connected, and a buyer who signs and then finds out.
 * What is actually built is the MECHANISM — an outbound webhook the HR system
 * calls, and SMART on FHIR for a records system — and those are `live` and
 * `partial` respectively, on their own rows. A named product is `planned` until
 * somebody has run it against that product's own tenant.
 *
 * `HR_SYSTEMS` in `lib/data/sponsor-integrations.ts` is the picker a sponsor
 * actually uses, and it is a shorter list because it is the systems we have
 * written STEPS for. This one is longer because a buyer's question is "is mine
 * here", and the honest answer for a seventh system is that the mechanism is
 * the same. The two lists are allowed to differ and each says what it is.
 */
export type VendorState = "live" | "partial" | "planned";

export type Vendor = {
  name: string;
  /** How it connects, in the words an integrator would search for. */
  via: string;
  state: VendorState;
};

/** Human resources and payroll systems a sponsoring employer might run. */
export const HR_VENDORS: Vendor[] = [
  { name: "Workday", via: "Outbound webhook · steps written", state: "planned" },
  { name: "SAP SuccessFactors", via: "Outbound webhook · steps written", state: "planned" },
  { name: "BambooHR", via: "Outbound webhook · steps written", state: "planned" },
  { name: "HiBob", via: "Outbound webhook · steps written", state: "planned" },
  { name: "Personio", via: "Outbound webhook · steps written", state: "planned" },
  { name: "Oracle HCM", via: "Outbound webhook · steps written", state: "planned" },
  { name: "Darwinbox", via: "Generic webhook", state: "planned" },
  { name: "Zoho People", via: "Generic webhook", state: "planned" },
  { name: "Menaitech", via: "Generic webhook", state: "planned" },
  { name: "Rippling", via: "Generic webhook", state: "planned" },
  { name: "Gusto", via: "Generic webhook", state: "planned" },
  { name: "Sage HR", via: "Generic webhook", state: "planned" },
];

/** Record and practice-management systems a clinic might already run. */
export const EHR_VENDORS: Vendor[] = [
  { name: "Epic", via: "SMART on FHIR R4", state: "partial" },
  { name: "Oracle Health (Cerner)", via: "SMART on FHIR R4", state: "partial" },
  { name: "athenahealth", via: "SMART on FHIR R4", state: "partial" },
  { name: "Elation Health", via: "FHIR R4", state: "planned" },
  { name: "Healthie", via: "FHIR R4", state: "planned" },
  { name: "DrChrono", via: "FHIR R4", state: "planned" },
  { name: "Tebra (Kareo)", via: "Partner API", state: "planned" },
  { name: "SimplePractice", via: "Partner API", state: "planned" },
  { name: "TherapyNotes", via: "Partner API", state: "planned" },
  { name: "Valant", via: "Partner API", state: "planned" },
  { name: "Jane", via: "Partner API", state: "planned" },
  { name: "InSync", via: "Partner API", state: "planned" },
];

export const VENDOR_STATE_LABEL: Record<VendorState, string> = {
  live: "Working today",
  partial: "Built, no tenant yet",
  planned: "Not built",
};
