/**
 * What the website says, kept apart from how it looks. Every price here is
 * read from lib/settings/defs.ts and every comparison row from the published
 * home page (docs/content-backup/home-production-2026-09-21.json, checked on
 * 2026-09-19). A sample that invents a price or a rival's weakness is a sample
 * the founder cannot ship, so nothing below is new copy about money or rivals.
 */

export type Plan = {
  key: "payg" | "practice" | "clinic";
  name: string;
  price: string;
  per: string;
  blurb: string;
  points: string[];
  cta: string;
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    key: "payg",
    name: "Pay as you go",
    price: "$0",
    per: "a month",
    blurb: "For a therapist starting out. You pay only when a session happens.",
    points: ["$1 a session for the room", "$3 more for the note, only when the patient said yes", "No monthly fee", "Move to a plan whenever it pays"],
    cta: "Start free",
  },
  {
    key: "practice",
    name: "Practice",
    price: "$80",
    per: "a month",
    blurb: "For a therapist with a full week. Every session and every note included.",
    points: ["Unlimited sessions in the room", "Unlimited drafted notes and copilot", "Pays for itself from 20 sessions a month", "Everything in pay as you go"],
    cta: "Choose Practice",
    featured: true,
  },
  {
    key: "clinic",
    name: "Clinic",
    price: "$72",
    per: "a clinician a month",
    blurb: "For a practice of two or more. One bill, and no patient names reach you.",
    points: ["Everything in Practice, for every clinician", "One bill for the practice, priced per seat", "Earnings per clinician, never who they saw", "Add or release a seat any day"],
    cta: "Set up your clinic",
  },
];

/** Pay as you go costs $4 a session with a note; Practice is flat. The line where they cross. */
export const PAYG_PER_SESSION = 4;
export const PRACTICE_MONTHLY = 80;

export type Rival = {
  name: string;
  who: string;
  price: string;
  rows: Array<{ claim: string; ours: string; theirs: string; concede?: boolean }>;
};

export const RIVALS: Rival[] = [
  {
    name: "SimplePractice",
    who: "The most used practice-management EHR for US therapists.",
    price: "From $49 a month, plus about $35 per clinician for AI notes",
    rows: [
      { claim: "What the subscription buys", ours: "A flat plan with no per-session fee, or a per-session rate with nothing monthly.", theirs: "A tiered monthly plan. AI notes are a separate per-clinician add-on." },
      { claim: "Arabic", ours: "Arabic and English throughout, right to left, including the note itself.", theirs: "English product. No published Arabic interface." },
      { claim: "Paying in Egypt", ours: "Bank transfer and local rails, priced in EGP with VAT shown.", theirs: "Card payments through US processing." },
      { claim: "Who owns the record", ours: "The patient. They claim it and carry it to their next therapist.", theirs: "The practice holds the chart." },
      { claim: "On-demand sessions", ours: "Crisis Radar: a patient books whoever is free right now.", theirs: "Appointments are scheduled. No on-demand marketplace." },
      { claim: "Breadth of practice tooling", ours: "Younger. Fewer billing and reporting features than a decade-old EHR.", theirs: "Deeper: insurance claims, ERA, a public directory, a website builder.", concede: true },
    ],
  },
  {
    name: "TherapyNotes",
    who: "A long-established behavioural-health EHR, strong on documentation and US insurance billing.",
    price: "About $69 a month solo, plus roughly $40 per clinician for AI notes",
    rows: [
      { claim: "What the subscription buys", ours: "Included on a plan. Nothing monthly on pay as you go.", theirs: "Documentation, billing and support in one price. AI notes cost extra." },
      { claim: "Arabic", ours: "Written for Arabic first in the launch market, both directions.", theirs: "English product." },
      { claim: "Risk language", ours: "Scanned in Arabic and English, and the page says the scan can miss.", theirs: "No published automatic risk scan of session content." },
      { claim: "Who owns the record", ours: "The patient claims and carries it.", theirs: "The practice's chart." },
      { claim: "Sessions held anywhere", ours: "Our room, in person on a phone, or Zoom, Meet and Teams.", theirs: "Built around its own telehealth." },
      { claim: "Insurance billing", ours: "None. We do not bill US insurers and do not pretend to.", theirs: "Mature US claims workflow, which is most of why people buy it.", concede: true },
    ],
  },
  {
    name: "Upheal",
    who: "An AI-native platform for therapists: notes, scheduling, billing.",
    price: "About $1 a session, capped near $69 a month",
    rows: [
      { claim: "What the subscription buys", ours: "Per session, or flat and unlimited. Both published.", theirs: "Per session with a monthly cap, the closest pricing here to ours." },
      { claim: "Arabic", ours: "Arabic and English, including the generated note.", theirs: "English product." },
      { claim: "Paying in Egypt", ours: "The Egyptian rail is the product, not a workaround.", theirs: "Card payments." },
      { claim: "Who owns the record", ours: "The patient, with consent they can revoke.", theirs: "The practice." },
      { claim: "On-demand sessions", ours: "Crisis Radar, and an employer can fund it.", theirs: "No on-demand marketplace." },
      { claim: "AI maturity", ours: "Newer. Our note quality is measured against a published eval set.", theirs: "Longer in market with an established assistant.", concede: true },
    ],
  },
  {
    name: "Mentalyc",
    who: "An AI documentation layer beside whatever EHR a practice runs.",
    price: "From about $20 to about $70 a month",
    rows: [
      { claim: "What it is", ours: "The record and the session: the room, the money, the patient's app.", theirs: "Notes only, deliberately. No scheduling, billing or client portal." },
      { claim: "Note formats", ours: "SOAP, sections labelled, and a missing one said rather than dropped.", theirs: "A wide library: SOAP, DAP, BIRP, GIRP, EMDR, couples and family." },
      { claim: "Arabic", ours: "Both languages, in the note and in the interface.", theirs: "English product." },
      { claim: "The patient's side", ours: "The patient has an app: sessions, steps, journal, record.", theirs: "No patient-facing product." },
      { claim: "Working with an existing EHR", ours: "We connect over FHIR, and that is newer work than theirs.", theirs: "Built to slot beside an EHR, which is the whole design.", concede: true },
    ],
  },
  {
    name: "Lyra Health",
    who: "An enterprise mental-health benefit sold to large employers.",
    price: "Quote only",
    rows: [
      { claim: "Who buys it", ours: "A therapist, a clinic, or an employer funding a pot. Same product underneath.", theirs: "The employer. Clinicians are supply, not customers." },
      { claim: "What the employer sees", ours: "The pot, the therapists paid and the amounts. Never who went.", theirs: "Aggregate utilisation reporting." },
      { claim: "Price transparency", ours: "Every price is on the pricing page, in EGP and USD.", theirs: "Quote only. Widely reported as out of reach for small and mid-size employers." },
      { claim: "The launch market", ours: "Egypt, in Arabic, on local payment rails.", theirs: "Primarily US and multinational enterprise." },
      { claim: "Clinical network", ours: "We are new and our network is small.", theirs: "A large vetted provider network, which is most of the value they sell.", concede: true },
    ],
  },
];

export const RIVALS_CHECKED = "19 September 2026";

export const FAQ: Array<{ q: string; a: string; for: Array<"all" | "patients" | "therapists" | "clinics" | "companies" | "partners"> }> = [
  { q: "Is a therapist really free right now?", a: "The radar shows a therapist only while their app is checking in. If nobody is free, it says so and offers the next time instead.", for: ["all", "patients"] },
  { q: "Who can read my record?", a: "Only the clinicians you said yes to. You can see every read, and take a yes back at any time.", for: ["all", "patients"] },
  { q: "Does my employer know I went?", a: "No. A company sees a pot, the totals paid, and use by team only where the count is five or more. Never who, when or what.", for: ["patients", "companies"] },
  { q: "What if I do not want the session recorded?", a: "Say no. Nothing is captured, the session goes ahead, and your therapist writes the note by hand.", for: ["all", "patients", "therapists"] },
  { q: "Who writes the note?", a: "A draft is made from the session when the patient said yes. Nothing reaches the patient until the therapist has read and signed it.", for: ["therapists", "clinics"] },
  { q: "Which plan should I pick?", a: "Under 20 sessions a month, pay as you go costs less. From 20 up, Practice does. The calculator on this page shows the line.", for: ["all", "therapists"] },
  { q: "Can a clinic owner read session notes?", a: "No. The owner sees seats, earnings per clinician and one bill. Patients and notes stay with each clinician.", for: ["clinics"] },
  { q: "Do you bill insurers?", a: "No. We do not bill US insurers and do not pretend to.", for: ["therapists", "clinics"] },
  { q: "How does a partner pay?", a: "$3 a session your clinicians run through us, with a monthly limit you set and alerts at 80%.", for: ["partners"] },
];
