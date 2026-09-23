"use client";

import {
  BadgeCheck,
  Banknote,
  BellRing,
  Building2,
  CalendarClock,
  ClipboardPen,
  Code2,
  FileLock2,
  Gauge,
  HeartHandshake,
  KeyRound,
  Languages,
  LifeBuoy,
  Mic,
  Percent,
  Radar,
  Receipt,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  Webhook,
} from "lucide-react";

import { AudiencePage, CodeVisual, PotVisual, SeatsVisual, SessionVisual, type AudienceConfig } from "./audience";
import { AccessDemo, ConsentDemo, DraftingNote, ScaledPhone } from "./sections";

const i = (Icon: typeof Mic) => <Icon className="h-5 w-5" aria-hidden />;

const PATIENTS: AudienceConfig = {
  audience: "patients",
  demo: "patient",
  eyebrow: "For you",
  title: (
    <>
      Someone to talk to, <span className="text-brand-400">tonight.</span>
    </>
  ),
  body: "See who is free now in Arabic or English, the one price you will pay, and go in. Or book a time that suits you. What you say stays yours.",
  primary: "Find someone now",
  secondary: "Try the app",
  visual: (
    <div className="mx-auto w-full max-w-[340px]">
      <ScaledPhone max={340} />
    </div>
  ),
  proof: [
    { big: "Now", small: "or any time you pick" },
    { big: "2", small: "languages, right to left" },
    { big: "1", small: "price, shown before you press" },
    { big: "0", small: "readers you did not say yes to" },
  ],
  features: [
    { icon: i(Radar), title: "Free right now", body: "The radar shows therapists who are free this minute, with their languages and price." },
    { icon: i(CalendarClock), title: "Or book for later", body: "Pick a time in your own time zone. Reminders come to you, not to anyone else." },
    { icon: i(Receipt), title: "One honest price", body: "The session, any cover from your employer, VAT on your share, and the one amount you pay." },
    { icon: i(Mic), title: "Recording is your choice", body: "Say yes and your therapist gets a draft note. Say no and nothing is captured." },
    { icon: i(FileLock2), title: "Your record, your call", body: "Summaries in plain words, signed by your therapist. You choose who else reads them." },
    { icon: i(LifeBuoy), title: "Help before anything", body: "SOS is on every screen. 105 and 123 in one tap, never behind a payment." },
  ],
  story: {
    eyebrow: "Your record",
    title: "Change therapist, keep your story.",
    body: "Everything signed about you is yours to carry. Take a reader's access back at any moment, and see every time someone looked.",
    visual: (
      <div className="rounded-[28px] bg-navy-900 p-6 text-white">
        <p className="text-[14px] font-semibold text-white/60">Who can read your record</p>
        <AccessDemo />
      </div>
    ),
  },
  rivals: undefined,
  cta: { title: "You do not have to wait for Monday.", body: "See who is free in your language right now.", primary: "Find someone now" },
};

const THERAPISTS: AudienceConfig = {
  audience: "therapists",
  demo: "therapist",
  eyebrow: "For therapists",
  title: (
    <>
      Do the session. <span className="text-brand-400">The note is drafted.</span>
    </>
  ),
  body: "A room that records only with a yes, a copilot that cites what was said, and a note ready to sign before you stand up. In Arabic or English.",
  primary: "Start free",
  secondary: "Try the workspace",
  visual: <SessionVisual />,
  proof: [
    { big: "$0", small: "a month to start" },
    { big: "$4", small: "a session with a note, on pay as you go" },
    { big: "20", small: "sessions a month and Practice pays for itself" },
    { big: "AR · EN", small: "notes in the language spoken" },
  ],
  features: [
    { icon: i(ClipboardPen), title: "Notes you sign", body: "SOAP, drafted from the session. A missing section is said, never quietly dropped." },
    { icon: i(Sparkles), title: "A copilot that cites", body: "Every hint points to the minute it came from, in this session or an earlier one." },
    { icon: i(Mic), title: "Off the record", body: "One press and that minute is never kept. Back on when you are ready." },
    { icon: i(Radar), title: "The radar", body: "Switch on when you are free and patients who need someone now can find you." },
    { icon: i(Banknote), title: "Paid, and shown how", body: "Earnings, what is held and why, and what you owe us, in one place." },
    { icon: i(BadgeCheck), title: "Verified once", body: "Your licence is checked by a person, then shown to patients as verified." },
  ],
  story: {
    eyebrow: "The note",
    title: "Read it, change it, sign it.",
    body: "Nothing reaches the patient until you sign. Their copy is written for them, not for a chart.",
    visual: <DraftingNote />,
  },
  pricing: true,
  rivals: ["SimplePractice", "TherapyNotes", "Upheal", "Mentalyc"],
  cta: { title: "Your next note could write itself.", body: "Start on pay as you go. Move to Practice when it pays.", primary: "Start free" },
};

const CLINICS: AudienceConfig = {
  audience: "clinics",
  demo: "clinic",
  eyebrow: "For clinics",
  title: (
    <>
      Run the practice. <span className="text-brand-400">Never see a patient&apos;s name.</span>
    </>
  ),
  body: "Seats, earnings per clinician and one bill. Patients, notes and sessions stay with each clinician, which is what lets them trust you with the practice.",
  primary: "Set up your clinic",
  secondary: "Try the portal",
  visual: <SeatsVisual />,
  proof: [
    { big: "$72", small: "a clinician a month, from two" },
    { big: "1", small: "bill for the whole practice" },
    { big: "0", small: "patient names the owner sees" },
    { big: "Same day", small: "a new clinician on the radar" },
  ],
  features: [
    { icon: i(UserPlus), title: "Add a clinician", body: "Invite by email and see the new seat price before you send." },
    { icon: i(Users), title: "Who is in session", body: "Live status for each clinician, never who they are with." },
    { icon: i(Wallet), title: "Earnings per clinician", body: "Totals and trends. Each clinician is paid directly." },
    { icon: i(Receipt), title: "One bill", body: "Seats at $72, pro rata when someone joins or leaves." },
    { icon: i(ShieldCheck), title: "A privacy wall", body: "No patient names, no notes, no transcripts reach the owner." },
    { icon: i(Languages), title: "Both languages", body: "Every clinician works in Arabic or English, their choice." },
  ],
  pricing: true,
  rivals: ["SimplePractice", "TherapyNotes"],
  cta: { title: "Bring the whole practice across.", body: "Two clinicians or twenty, one bill.", primary: "Set up your clinic" },
};

const COMPANIES: AudienceConfig = {
  audience: "companies",
  demo: "company",
  eyebrow: "For companies",
  title: (
    <>
      Pay for their therapy. <span className="text-brand-400">Never know who went.</span>
    </>
  ),
  body: "Fund a pot, choose how much of each session you cover, and see totals published in steps. Who, when and what stays with your people.",
  primary: "Offer it to your team",
  secondary: "Try the portal",
  visual: <PotVisual />,
  proof: [
    { big: "0 to 100%", small: "of each session, your choice" },
    { big: "5+", small: "the smallest count we ever show" },
    { big: "0", small: "names of who used it" },
    { big: "Pot", small: "pays only as sessions happen" },
  ],
  features: [
    { icon: i(Percent), title: "Set the cover", body: "Choose the share of each session you pay. People see the new price on their next booking." },
    { icon: i(Wallet), title: "A pot, not a contract", body: "Top up when you like. Sessions draw on it as they happen." },
    { icon: i(Gauge), title: "Totals, in steps", body: "Spend is published in steps, never live, so no one visit can be spotted." },
    { icon: i(Users), title: "Use by team, above five", body: "A team's count only shows at five or more." },
    { icon: i(HeartHandshake), title: "Nobody blocked", body: "An empty pot never stops someone from booking at their own price." },
    { icon: i(Building2), title: "Your domain", body: "People join with a work email on a domain you have proved." },
  ],
  story: {
    eyebrow: "The line we hold",
    title: "The benefit works because they believe it.",
    body: "Your people use it when they are sure you cannot see them doing so. Everything in this portal is built from that sentence.",
    visual: (
      <div className="rounded-[28px] bg-navy-900 p-6 text-white">
        <ConsentDemo />
      </div>
    ),
  },
  rivals: ["Lyra Health"],
  cta: { title: "Start with a pot of any size.", body: "Set the cover, invite your people, see the totals.", primary: "Offer it to your team" },
};

const PARTNERS: AudienceConfig = {
  audience: "partners",
  demo: "partner",
  eyebrow: "For partners",
  title: (
    <>
      Put sessions and notes <span className="text-brand-400">inside your product.</span>
    </>
  ),
  body: "Send us a session, get a drafted note, a patient summary and a transcript back, with the patient's consent checked on every call.",
  primary: "Get a test key",
  secondary: "Try the portal",
  visual: <CodeVisual />,
  proof: [
    { big: "$3", small: "a session, nothing monthly" },
    { big: "80%", small: "of your limit and we alert you" },
    { big: "1", small: "key shown once, then only a fingerprint" },
    { big: "FHIR", small: "to read what the patient granted" },
  ],
  features: [
    { icon: i(Code2), title: "Sessions in, notes out", body: "Record a session and read its note, summary and transcript." },
    { icon: i(ShieldCheck), title: "Consent on every call", body: "No consent, no note. The API refuses rather than guesses." },
    { icon: i(KeyRound), title: "Keys shown once", body: "We keep a fingerprint. Lose a key, make another, revoke the old." },
    { icon: i(BellRing), title: "A limit you set", body: "Sessions a month, with an alert at 80% and a stop at 100%." },
    { icon: i(Sparkles), title: "The copilot, by API", body: "Ask about a subject from what their clinician may already read." },
    { icon: i(Webhook), title: "Launch our room", body: "Open our session room signed in as your clinician, no second login." },
  ],
  rivals: undefined,
  cta: { title: "Build it this week.", body: "A test key costs nothing.", primary: "Get a test key" },
};

export const PatientsPage = () => <AudiencePage c={PATIENTS} />;
export const TherapistsPage = () => <AudiencePage c={THERAPISTS} />;
export const ClinicsPage = () => <AudiencePage c={CLINICS} />;
export const CompaniesPage = () => <AudiencePage c={COMPANIES} />;
export const PartnersPage = () => <AudiencePage c={PARTNERS} />;
