import type { ContentBlock } from "@/lib/db/schema";

export type DefaultPage = {
  slug: string;
  title: string;
  description: string;
  layout: "marketing" | "document";
  navLabel: string | null;
  navOrder: number | null;
  blocks: ContentBlock[];
};

/**
 * Built-in content for every public page.
 *
 * Two jobs: it is what `db:seed` writes into the CMS, and it is what the public
 * site renders when the database is unreachable or not yet migrated. The
 * marketing site failing because Postgres blinked — or a deploy failing because
 * the build could not prerender — is not an acceptable failure mode.
 *
 * Everything here is deliberately checkable. The old site claimed "40+
 * languages", "20+ validated scales" and carried invented press releases and
 * fabricated clinician bylines; none of that describes this product.
 */
export const DEFAULT_PAGES: DefaultPage[] = [
  {
    slug: "home",
    title: "24Therapy — your session notes, written for you",
    description:
      "Record a therapy session on your phone and walk away with a SOAP note, clinical insights and a report you can send to your patient.",
    layout: "marketing",
    navLabel: null,
    navOrder: null,
    blocks: [
      {
        type: "hero",
        eyebrow: "AI clinical documentation",
        heading: "Finish your notes before you leave the room",
        body: "Start a session on your phone. 24Therapy transcribes it live, then writes the SOAP note, the summary and the follow-up while you are still saying goodbye. You review, approve, and send.",
        ctaLabel: "Start your first session free",
        ctaHref: "/signup",
        demo: "session-room",
      },
      {
        type: "features",
        heading: "Three taps from hello to a signed note",
        items: [
          {
            title: "Start",
            body: "Tap New session, type a first name, tap Start. In-person or video — no scheduling, no forms, no setup wizard.",
          },
          {
            title: "Talk",
            body: "The transcript builds itself in the panel beside you. Tap Off record whenever the conversation should not be captured.",
          },
          {
            title: "Send",
            body: "End the session and the note is waiting. Read it, edit anything, approve it, and email the patient a plain-language summary.",
          },
        ],
      },
      {
        type: "features",
        heading: "Built for real clinical work",
        items: [
          {
            title: "SOAP notes you would have written",
            body: "Subjective, objective, assessment and plan, plus a summary, talking points, observations and a follow-up recommendation. Everything is a draft until you approve it.",
          },
          {
            title: "Crisis language never gets missed",
            body: "Every transcript segment is scanned as it arrives. If risk language appears, you are alerted in the room — and the alert is stored before anyone is notified, so it survives a failed delivery.",
          },
          {
            title: "Patients need no account",
            body: "Send a link. They type their first name and join. No password, no app, no portal to support.",
          },
          {
            title: "PHI stays where it belongs",
            body: "Every read of a chart is written to an append-only audit log. No transcript text is ever written to application logs. Sessions expire after 30 minutes idle.",
          },
        ],
      },
      {
        type: "cta",
        heading: "Your first session is free",
        body: "No card, no onboarding wizard. Sign up and start a session in under a minute.",
        ctaLabel: "Create your account",
        ctaHref: "/signup",
      },
    ],
  },
  {
    slug: "features",
    title: "How 24Therapy works",
    description:
      "Live transcription, automatic SOAP notes, crisis-language alerts and patient reports — on your phone.",
    layout: "marketing",
    navLabel: "Features",
    navOrder: 1,
    blocks: [
      {
        type: "hero",
        eyebrow: "Features",
        heading: "The whole product is one screen",
        body: "Most clinical software asks you to learn it. This asks you to press Start.",
        ctaLabel: "See pricing",
        ctaHref: "/pricing",
        demo: "session-room",
      },
      {
        type: "features",
        heading: "In the room",
        items: [
          {
            title: "Live transcript",
            body: "Audio is captured from your device microphone in short chunks and transcribed as the session runs. The panel fills in beside you.",
          },
          {
            title: "Off record",
            body: "One tap stops capture without ending the session. Nothing recorded, nothing transcribed, nothing stored.",
          },
          {
            title: "Risk alerts",
            body: "Crisis language raises an alert to you and only to you. A patient on a join link never sees a risk level — only a supportive message and a crisis line.",
          },
          {
            title: "Video when you need it",
            body: "Video sessions run in a private room with a per-participant token that expires. In-person sessions skip video entirely.",
          },
        ],
      },
      {
        type: "features",
        heading: "After the session",
        items: [
          {
            title: "The note writes itself",
            body: "Ending a session starts generation immediately. A full SOAP note plus summary, talking points, observations, impressions, recommendations and follow-up.",
          },
          {
            title: "You are the clinician",
            body: "Every note is a draft with your name on it. Nothing is filed, sent or shared until you approve it.",
          },
          {
            title: "Patient report",
            body: "Approve a note and optionally email the patient a plain-language summary. Clinical impressions stay in your chart, not in their inbox.",
          },
        ],
      },
      {
        type: "faq",
        heading: "Questions we get",
        items: [
          {
            q: "Do my patients need an account?",
            a: "No. For video sessions you send a link; they type a first name and join. For in-person sessions they do not touch the software at all.",
          },
          {
            q: "What happens if I lose signal mid-session?",
            a: "Audio chunks are uploaded independently and retried. A dropped chunk costs you a few seconds of transcript, not the session.",
          },
          {
            q: "Can I edit the note?",
            a: "Yes. Every field is editable before you approve, and the approved version is what is stored.",
          },
          {
            q: "Is a BAA included?",
            a: "Yes, on every plan. We process protected health information on your behalf, so a business associate agreement is not something we could reasonably charge extra for.",
          },
        ],
      },
    ],
  },
  {
    slug: "pricing",
    title: "Pricing",
    description: "Pay $6 a session or $99 a month. Your first session is free.",
    layout: "marketing",
    navLabel: "Pricing",
    navOrder: 2,
    blocks: [
      {
        type: "hero",
        eyebrow: "Pricing",
        heading: "Two plans. No seats, no setup fee.",
        body: "Start metered and switch to flat when it is cheaper. Your first completed session is free either way.",
        ctaLabel: "Start free",
        ctaHref: "/signup",
        demo: "none",
      },
      {
        type: "faq",
        heading: "Billing questions",
        items: [
          {
            q: "When am I charged on pay as you go?",
            a: "When a session is marked complete. Your first one is free, and you will see the charge on your billing page immediately.",
          },
          {
            q: "What if a session was a mistake?",
            a: "Cancel it instead of completing it and nothing is charged.",
          },
          {
            q: "Can I cancel Unlimited?",
            a: "Yes, at any time. You keep access until the end of the period you have paid for, then drop back to pay as you go.",
          },
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    description: "How 24Therapy handles personal and health information.",
    layout: "document",
    navLabel: "Privacy",
    navOrder: 10,
    blocks: [
      {
        type: "prose",
        body: "This page is a starting point maintained by your administrator, not legal advice. Review it with counsel before you accept a real patient.",
      },
      {
        type: "prose",
        heading: "What we store",
        body: "Account details for clinicians (name, email, hashed password, licence details you choose to add). For patients: a first name, optionally a last name and email, plus the clinical record created by sessions — transcripts, notes, and risk assessments.",
      },
      {
        type: "prose",
        heading: "What we send elsewhere",
        body: "Session audio and transcript text are sent to our AI provider to produce transcription and notes. Patient reports are sent by email through our email provider. Video sessions are carried by our video provider. Each of these is a subprocessor covered by a business associate agreement.",
      },
      {
        type: "prose",
        heading: "What we never do",
        body: "We do not write transcript text, note content or crisis indicators into application logs. We do not sell data. We do not use patient data to train models.",
      },
      {
        type: "prose",
        heading: "Access and deletion",
        body: "Clinicians can export or delete a patient record from the patient page. Deletion removes the chart, its sessions, transcripts and notes. Audit records of who accessed what are retained for six years, as required.",
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    description: "The agreement between 24Therapy and the clinicians who use it.",
    layout: "document",
    navLabel: "Terms",
    navOrder: 11,
    blocks: [
      {
        type: "prose",
        body: "This page is a starting point maintained by your administrator, not legal advice. Review it with counsel before you accept a real patient.",
      },
      {
        type: "prose",
        heading: "Clinical responsibility",
        body: "24Therapy produces drafts. Every note, impression and recommendation requires review and approval by the licensed clinician before it becomes part of a record. The software does not practise medicine and does not make clinical decisions.",
      },
      {
        type: "prose",
        heading: "Crisis detection is not a safety system",
        body: "Risk alerts are a prompt for your attention, not a monitoring service. They can miss risk and can raise false alarms. They do not contact emergency services and are not reviewed by a human on our side.",
      },
      {
        type: "prose",
        heading: "Consent to record",
        body: "You are responsible for obtaining and documenting your patient's consent to recording and transcription, in line with the law where you and your patient are located.",
      },
      {
        type: "prose",
        heading: "Billing",
        body: "Metered sessions are charged on completion. Subscriptions renew until cancelled and can be cancelled at any time, effective at the end of the paid period.",
      },
    ],
  },
  {
    slug: "hipaa",
    title: "HIPAA",
    description: "How 24Therapy supports HIPAA compliance.",
    layout: "document",
    navLabel: "HIPAA",
    navOrder: 12,
    blocks: [
      {
        type: "prose",
        heading: "Business associate agreement",
        body: "We sign a BAA with every customer on every plan. Handling protected health information on your behalf makes us a business associate; that is a legal relationship, not a paid feature.",
      },
      {
        type: "prose",
        heading: "Technical safeguards in the product",
        body: "Access to any chart requires an authenticated, non-expired session; sessions expire after 30 minutes of inactivity and 8 hours absolute. Every read and write of clinical data is recorded in an append-only audit log with actor, patient, resource and timestamp. Passwords are stored as scrypt hashes. Video rooms are private and require a per-participant token.",
      },
      {
        type: "prose",
        heading: "Subprocessors",
        body: "Hosting and compute, database, AI transcription and note generation, transactional email, and video. Each holds a BAA before any protected health information reaches it. Your administrator maintains the current list.",
      },
      {
        type: "prose",
        heading: "Retention",
        body: "Audit records are retained for six years. Clinical records are retained until deleted by the practice.",
      },
    ],
  },
  {
    slug: "security",
    title: "Security",
    description: "How 24Therapy is built and operated.",
    layout: "document",
    navLabel: "Security",
    navOrder: 13,
    blocks: [
      {
        type: "prose",
        heading: "Authentication",
        body: "Sessions are opaque tokens stored as hashes, held in an httpOnly, Secure, SameSite cookie. There is no token in browser storage for a script to read. Signing out, changing a password or resetting a password revokes every existing session immediately.",
      },
      {
        type: "prose",
        heading: "Authorisation",
        body: "Roles are an explicit allowlist, not a hierarchy of numbers — an unrecognised role is denied rather than silently permitted. Every query for clinical data is scoped to the practice that owns it, and the scoping is applied by the data layer rather than remembered by each caller.",
      },
      {
        type: "prose",
        heading: "Logging",
        body: "Application logs contain request identifiers, never transcript text, note content, patient names or crisis indicators. Error reporting strips request bodies and URLs, and session replay is disabled.",
      },
      {
        type: "prose",
        heading: "Reporting a vulnerability",
        body: "Email security@24therapy.ai. We will acknowledge within two business days.",
      },
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    description: "Get in touch with the 24Therapy team.",
    layout: "marketing",
    navLabel: "Contact",
    navOrder: 3,
    blocks: [
      {
        type: "hero",
        eyebrow: "Contact",
        heading: "Talk to a human",
        body: "Questions about the product, a BAA, or moving an existing practice across — write to us and we will answer.",
        ctaLabel: "Email support@24therapy.ai",
        ctaHref: "mailto:support@24therapy.ai",
        demo: "none",
      },
    ],
  },
];

export function findDefaultPage(slug: string): DefaultPage | null {
  return DEFAULT_PAGES.find((p) => p.slug === slug) ?? null;
}
