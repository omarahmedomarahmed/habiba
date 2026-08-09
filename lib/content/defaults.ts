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
        // The fold IS the radar: a live world map, real clinicians on it, and a
        // booking sheet that opens in place. Everything else on this page is
        // below it.
        type: "hero",
        eyebrow: "Crisis Radar",
        heading: "Talk to a real therapist in the next sixty seconds",
        body: "Every dot is a licensed clinician who is online this minute. Filter by language or what you need help with, pick someone, tell them what to call you — and you are in a session. No account, no waiting list, no form about your insurance.",
        demo: "radar",
      },
      {
        type: "hero",
        eyebrow: "For therapists",
        heading: "Finish your notes before you leave the room",
        body: "Start a session on your phone. 24Therapy transcribes it live, then writes the SOAP note, the summary and the follow-up while you are still saying goodbye. You review, approve, and send.",
        ctaLabel: "Start your first session free",
        ctaHref: "/signup",
        demo: "session-room",
        backgroundImage: "/backgrounds/mesh.svg",
      },
      {
        type: "showcase",
        heading: "Every claim on this page is a screen you can see",
        items: [
          {
            title: "The transcript writes itself",
            body: "Audio is captured in short chunks and transcribed as the session runs. On a video call each person is on their own track, so who said what is known rather than guessed. This is the real panel from the session room.",
            icon: "mic",
            demo: "transcript",
          },
          {
            title: "The note is ready when you stand up",
            body: "Ending a session starts generation immediately: a full SOAP note plus summary, talking points, observations, impressions and a follow-up. Everything is a draft with your name on it until you approve it.",
            icon: "fileText",
            demo: "note",
          },
          {
            title: "Risk language is never missed",
            body: "Every segment is scanned as it arrives. If risk language appears you are alerted in the room, and the alert is written to the database before anyone is notified — so it survives a failed delivery.",
            icon: "shield",
            demo: "risk",
          },
          {
            title: "A quiet second opinion",
            body: "At most two short prompts at a time, and only when there is something worth saying. It suggests, never instructs, and staying silent is the expected answer.",
            icon: "brain",
            demo: "copilot",
          },
        ],
      },
      {
        type: "features",
        heading: "Three taps from hello to a signed note",
        items: [
          {
            title: "Start",
            body: "Tap New session, type a first name, tap Start. In-person or video — no scheduling, no forms, no setup wizard.",
            icon: "zap",
          },
          {
            title: "Talk",
            body: "The transcript builds itself beside you. Tap Off record whenever the conversation should not be captured.",
            icon: "mic",
          },
          {
            title: "Send",
            body: "End the session and the note is waiting. Read it, edit anything, approve it, and email the patient a plain-language summary.",
            icon: "mail",
          },
          {
            title: "Patients need no account",
            body: "Send a link. They type their first name and join. No password, no app, no portal to support.",
            icon: "users",
          },
          {
            title: "PHI stays where it belongs",
            body: "Every read of a chart is written to an append-only audit log. No transcript text ever reaches application logs.",
            icon: "lock",
          },
          {
            title: "Built for a phone",
            body: "Therapists work from their phone, so this was designed for one. Desktop is the enhancement, not the other way round.",
            icon: "clock",
          },
        ],
      },
      {
        type: "cta",
        heading: "Your first session is free",
        body: "No card, no onboarding wizard. Sign up and start a session in under a minute.",
        ctaLabel: "Create your account",
        ctaHref: "/signup",
        backgroundImage: "/backgrounds/waves.svg",
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
        backgroundImage: "/backgrounds/grid.svg",
      },
      {
        type: "showcase",
        heading: "In the room",
        items: [
          {
            title: "Live transcript, both voices",
            body: "On video, the therapist and the patient arrive on separate audio tracks, so each line is attributed with certainty. In person, one microphone hears the room and the note works out who was speaking from context.",
            icon: "mic",
            demo: "transcript",
          },
          {
            title: "Suggestions, not instructions",
            body: "The copilot reads the last few minutes and offers at most two short prompts. It fires every few segments rather than constantly, because advice that changes every eight seconds is noise.",
            icon: "brain",
            demo: "copilot",
          },
          {
            title: "Crisis language raises a flag",
            body: "Alerts go to you and only to you. A patient on a join link never sees a risk level — only a supportive message and a crisis line.",
            icon: "alert",
            demo: "risk",
          },
          {
            title: "The note you would have written",
            body: "Subjective, objective, assessment and plan, plus summary, talking points, observations, impressions and follow-up. Editable everywhere, signed only by you.",
            icon: "fileText",
            demo: "note",
          },
        ],
      },
      {
        type: "features",
        heading: "And around it",
        items: [
          {
            title: "Off record",
            body: "One tap stops capture without ending the session. Nothing recorded, nothing transcribed, nothing stored.",
            icon: "shield",
          },
          {
            title: "Video when you need it",
            body: "Private rooms with a per-participant token that expires. In-person sessions skip video entirely.",
            icon: "video",
          },
          {
            title: "Patient report by email",
            body: "Approve a note and optionally send a plain-language summary. Clinical impressions stay in your chart.",
            icon: "mail",
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
            q: "How does it know who is speaking?",
            a: "On video, each participant is on a separate audio track — no voice recognition or enrolment involved, so two similar voices are never confused. In person there is a single microphone, so the live transcript is unattributed and the note works out roles from context.",
          },
          {
            q: "What happens if I lose signal mid-session?",
            a: "Audio chunks upload independently and retry. A dropped chunk costs a few seconds of transcript, not the session.",
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
    description:
      "$6 a session — including 10 copilot questions per patient every month — or $99 a month for everything. Your first session is free.",
    layout: "marketing",
    navLabel: "Pricing",
    navOrder: 2,
    blocks: [
      {
        type: "hero",
        eyebrow: "Pricing",
        heading: "Two plans. No seats, no setup fee.",
        body: "$6 buys the session and ten copilot questions about that patient every month — not the session alone. Switch to flat when it is cheaper. Your first completed session is free either way.",
        ctaLabel: "Start free",
        ctaHref: "/signup",
        demo: "none",
        icon: "chart",
        backgroundImage: "/backgrounds/contours.svg",
      },
      {
        type: "faq",
        heading: "Billing questions",
        items: [
          {
            q: "When am I charged on pay as you go?",
            a: "When a session is marked complete. Your first one is free, and the invoice appears on your billing page immediately. You can pay several at once with a single link.",
          },
          {
            q: "What does the $6 actually include?",
            a: "The full session — live transcription, the SOAP note, the patient report and crisis alerts — plus ten copilot questions about that patient, resetting every calendar month. Only questions you ask count; the copilot's own answers and the notes it saves from a live session do not. On Unlimited there is no cap.",
          },
          {
            q: "What if a session was a mistake?",
            a: "Cancel it instead of completing it and nothing is charged.",
          },
          {
            q: "What do you take when a patient pays me?",
            a: "10% of the session price, and nothing else. The money is a direct charge into your own Stripe account — we never hold it — and Stripe handles the payout to your bank. You see exactly what you keep before you set a price.",
          },
          {
            q: "Can I pay my 24Therapy bill out of my earnings?",
            a: "Yes. If you take payments from patients, anything you owe us can be settled out of the next one instead of a card. It is never more than what you would have received from that session, and you can turn it off.",
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
        icon: "mail",
        backgroundImage: "/backgrounds/waves.svg",
      },
      {
        type: "features",
        heading: "What we can help with",
        items: [
          { title: "Getting started", body: "Setting up your practice and running your first session.", icon: "zap" },
          { title: "Compliance", body: "BAAs, subprocessors and how patient data is handled.", icon: "shield" },
          { title: "Billing", body: "Plans, invoices and anything that looks wrong on your bill.", icon: "chart" },
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
        type: "hero",
        eyebrow: "Legal",
        heading: "Privacy Policy",
        demo: "none",
        icon: "lock",
        backgroundImage: "/backgrounds/grid.svg",
      },
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
        type: "hero",
        eyebrow: "Legal",
        heading: "Terms of Service",
        demo: "none",
        icon: "fileText",
        backgroundImage: "/backgrounds/grid.svg",
      },
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
        type: "hero",
        eyebrow: "Compliance",
        heading: "HIPAA",
        demo: "none",
        icon: "shield",
        backgroundImage: "/backgrounds/contours.svg",
      },
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
        type: "hero",
        eyebrow: "Compliance",
        heading: "Security",
        demo: "none",
        icon: "lock",
        backgroundImage: "/backgrounds/contours.svg",
      },
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
  }

];

export function findDefaultPage(slug: string): DefaultPage | null {
  return DEFAULT_PAGES.find((p) => p.slug === slug) ?? null;
}
