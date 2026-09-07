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
      /*
       * 17.7 — the same three cards as a section on the homepage.
       *
       * The same component, not a copy of it: `compact` drops the feature
       * lists and keeps the prices, and the prices are still read from
       * `platform_settings` at request time. A homepage that quoted its own
       * figures is how C60 started.
       */
      { type: "pricing", compact: true },
      /*
       * 🔴 18.3 — one tap to help, from the homepage too. It is the last thing
       * on the page a person scrolls when they are not sure what they need.
       */
      { type: "crisis" },
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
    /*
     * 🔴 18.2 — the patients section.
     *
     * Half of this product is used by people who are not clinicians and have
     * never been asked to evaluate software. Everything they need to decide
     * whether to open the radar at 2am is on this page, in the order somebody
     * in that state would ask it — what this is, how to find a person, what
     * happens, what the person can and cannot see, what it costs — and the
     * crisis block is at the bottom of it because a person who has read this
     * far is exactly the person who may need it.
     */
    slug: "for-patients",
    title: "For patients",
    description:
      "How to find a therapist, what the Crisis Radar is, what happens in a session, and exactly what your therapist can and cannot see.",
    layout: "marketing",
    navLabel: "For patients",
    navOrder: 0,
    blocks: [
      {
        type: "hero",
        eyebrow: "For patients",
        heading: "A real therapist, without the waiting list",
        body: "You do not need an account to talk to somebody. Open the radar, see who is online this minute, pick a person, tell them what to call you — and you are in a session. Everything below is what happens next, in the order people ask about it.",
        ctaLabel: "See who is online now",
        ctaHref: "/radar",
        demo: "none",
        icon: "users",
        backgroundImage: "/backgrounds/waves.svg",
      },
      {
        type: "features",
        heading: "Finding somebody",
        items: [
          {
            title: "The Crisis Radar",
            body: "A live map of clinicians who are online right now. Filter by language or by what you need help with. Nobody on it is a bot, a queue or a callback — they are people with a session open.",
            icon: "zap",
          },
          {
            title: "When to use it",
            body: "When waiting until Tuesday is not the answer. It is not an emergency service and it is not a substitute for one, but it is minutes rather than weeks.",
            icon: "clock",
          },
          {
            title: "Booking an hour instead",
            body: "If you are not in a hurry, every clinician has a calendar. Pick an hour that suits you and you will get a reminder before it.",
            icon: "clock",
          },
        ],
      },
      {
        type: "showcase",
        heading: "What it actually looks like",
        items: [
          {
            title: "Your sessions, in your own app",
            body: "Once you claim your record you have your own screens: the sessions you have booked, the ones you found on the radar, and the note your therapist wrote to you after each. This is that screen.",
            icon: "users",
            demo: "patient-sessions",
          },
          {
            title: "The steps you agreed, not homework marked out of ten",
            body: "What you and your therapist agreed to try, written the way you agreed it. Nobody scores you, and nothing is shown to anybody else.",
            icon: "check",
            demo: "homework",
          },
        ],
      },
      {
        type: "features",
        heading: "What your therapist can and cannot see",
        items: [
          {
            title: "They see the sessions they ran with you",
            body: "Their own notes about their own sessions, exactly as any therapist keeps notes. Nothing about anybody else.",
            icon: "fileText",
          },
          {
            title: "A second therapist sees nothing until you say so",
            body: "If you see two people, neither can read the other's notes. You can share your history with a new therapist, in one tap, and take it back in one tap.",
            icon: "lock",
          },
          {
            title: "You can be recorded, or not",
            body: "Recording is asked for, not assumed, and you can stop it at any point in the session. The note says when recording started, so nothing pretends to a completeness it does not have.",
            icon: "mic",
          },
          {
            title: "Your record is yours to claim",
            body: "If a therapist has already been seeing you, the record has your name on it and you can claim it with your phone number. We ask you two questions first — proving a phone number is not proving a person.",
            icon: "shield",
          },
        ],
      },
      {
        type: "faq",
        heading: "What it costs you",
        items: [
          {
            q: "Do I pay to use 24Therapy?",
            a: "No. You pay the therapist for the session, at the price shown before you book. We take a share of that from them, not from you, and there is no fee for having an account.",
          },
          {
            q: "Can I pay in Egyptian pounds?",
            a: "Yes. The price is shown in both, at the rate of the day, and the rate you were shown is the rate you are charged — it is fixed onto the payment rather than recalculated later.",
          },
          {
            q: "What if the therapist does not turn up?",
            a: "After five minutes you are offered somebody else at the same price or less, or your money back. If the replacement costs less, the difference comes back to you as credit rather than disappearing.",
          },
          {
            q: "Do I need an account?",
            a: "Not to have a session. You need one to keep your history, see the notes written to you, and claim a record a therapist already keeps about you.",
          },
        ],
      },
      { type: "crisis" },
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
        body: "Most clinical software asks you to learn it. This asks you to press Start. Everything below is the real component, running on invented data — not a picture of one.",
        // 18R.1 — the same CTA pair as the header: the clinician's action is
        // the button, and the patient's route is one line away rather than
        // absent (18.4).
        ctaLabel: "Start free — for therapists",
        ctaHref: "/signup",
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
      {
        type: "showcase",
        heading: "And the half nobody shows you",
        items: [
          {
            title: "The patient has an app too",
            body: "Their own sessions, the ones they booked and the ones they found on the radar, and the note you wrote to them once you signed it. It has no field that could hold your clinical note — that is a property of the query, not of the screen.",
            icon: "users",
            demo: "patient-sessions",
          },
          {
            title: "What you agreed, on both phones",
            body: "Homework as the steps you actually agreed, not a scoreboard. Nobody is marked, and nothing is shown to anybody else.",
            icon: "check",
            demo: "homework",
          },
          {
            title: "A profile that is dated observations, not prose",
            body: "Every line traceable to the session it came from. No paragraph of machine writing about a person.",
            icon: "brain",
            demo: "profile",
          },
        ],
      },
      {
        type: "cta",
        heading: "Start free — your first session is on us",
        body: "Or if you are looking for a therapist rather than software, the radar has people online now.",
        ctaLabel: "Sign up free",
        ctaHref: "/signup",
        backgroundImage: "/backgrounds/mesh.svg",
      },
      { type: "crisis" },
    ],
  },
  {
    slug: "pricing",
    title: "Pricing",
    description:
      "Join free and pay per session, only when you run one — each session including its copilot questions about that patient. Your first session is free.",
    layout: "marketing",
    navLabel: "Pricing",
    navOrder: 2,
    blocks: [
      /*
       * 17.2 — the cards are the page. No hero above them.
       *
       * The old first block was a hero that restated $4 / $3 / $2 in prose,
       * and that is precisely how C60 happened: a price written twice is a
       * price that can be repriced once. Every figure now comes from
       * `platform_settings` through the `pricing` block, and this page states
       * no number of its own.
       */
      { type: "pricing" },
      {
        // 17.5 — the FAQ moves below the cards and the statements.
        type: "faq",
        heading: "Billing questions",
        items: [
          {
            q: "When am I charged on pay as you go?",
            a: "When a session is marked complete. Your first one is free, and the invoice appears on your billing page immediately. You can pay several at once with a single link.",
          },
          {
            q: "What does the session rate actually include?",
            a: "The full session — live transcription, the SOAP note, the patient report and crisis alerts — plus the copilot questions about that patient shown on the cards above, for every session you run with them, and unused ones roll over. Only questions you ask count; the copilot's own answers and the notes it saves from a live session do not.",
          },
          {
            q: "What if a session was a mistake?",
            a: "Cancel it instead of completing it and nothing is charged.",
          },
          {
            q: "What do you take when a patient pays me?",
            a: "The percentage shown on the cards above, and nothing else. Where you have a Stripe account the money is charged straight into it and we never hold it. Where you do not — Egypt, today — we collect it, hold it, and pay you out on request, and you can watch every step of that on your earnings page. You see exactly what you keep before you set a price.",
          },
          {
            q: "Can I pay my 24Therapy bill out of my earnings?",
            a: "Yes. When we are holding your earnings the session fee comes out of them automatically. If your patients pay straight into your own Stripe account, anything you owe can instead be settled out of the next payment rather than a card — never more than what that session would have paid you, and you can turn it off.",
          },
          {
            q: "What happens to sessions I bought and did not use?",
            a: "They last as long as the cards above say, and are always spent before anything new is billed, so moving to a smaller bundle never strands what you already paid for.",
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
        heading: "Write to a person",
        body: "Every message here goes into a queue somebody owns, with a name against it and a clock on it. Not an inbox.",
        // 🔴 18R.2 — no `mailto:`. The old button opened an email client and
        // the message went somewhere this system cannot see, which means
        // nobody could be held to answering it.
        demo: "none",
        icon: "mail",
        backgroundImage: "/backgrounds/waves.svg",
      },
      { type: "contact_form", heading: "Send us a message" },
      {
        type: "companies",
        heading: "Who you are dealing with",
        items: [
          {
            title: "24Therapy Inc.",
            entity: "us",
            body: "The international entity. Card payments, Stripe payouts, and everything outside Egypt.",
            address: "",
            phone: "",
            email: "support@24therapy.ai",
            hours: "Sunday to Thursday, 09:00–18:00 UTC",
          },
          {
            title: "24Therapy Egypt",
            entity: "eg",
            body: "The Egyptian entity. Payments in Egyptian pounds, and payouts by InstaPay or wallet.",
            address: "",
            phone: "",
            email: "egypt@24therapy.ai",
            hours: "Sunday to Thursday, 10:00–19:00 Cairo",
          },
        ],
      },
      {
        type: "features",
        heading: "What we can help with",
        items: [
          { title: "Getting started", body: "Setting up your practice and running your first session.", icon: "zap" },
          { title: "Compliance", body: "BAAs, subprocessors and how patient data is handled.", icon: "shield" },
          { title: "Billing", body: "Bundles, invoices, payouts and anything that looks wrong on your bill.", icon: "chart" },
        ],
      },
      { type: "crisis" },
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
    /*
     * HIPAA, stated as a destination rather than a possession.
     *
     * This page has now been wrong in both directions. It first claimed BAAs
     * that did not exist, which is the version a clinic's compliance officer
     * catches. Then it was stripped back to a flat "we are not compliant",
     * which is honest and useless — it tells a prospective customer nothing
     * about whether we will be, or when, or what is actually left to do.
     *
     * The third version is the one a real pre-launch company can defend: name
     * every subprocessor, say whether a BAA is available from them at all,
     * say whether we hold one, and date the gap. "Coming soon" is only
     * credible when the reader can see the list it is coming from — a badge
     * with no checklist behind it is marketing, and this audience is
     * specifically trained to discount it.
     *
     * The order of operations is real and worth writing down: a BAA is a
     * contract, and a contract needs a legal entity. Nothing on this list can
     * be signed before the US entity exists, which is why the entity is the
     * first row rather than a footnote.
     */
    slug: "hipaa",
    title: "Compliance",
    description: "Where we are on HIPAA, and what is left.",
    layout: "document",
    navLabel: "Compliance",
    navOrder: 12,
    blocks: [
      {
        type: "hero",
        eyebrow: "Compliance",
        heading: "HIPAA — in progress",
        demo: "none",
        icon: "shield",
        backgroundImage: "/backgrounds/contours.svg",
      },
      {
        type: "prose",
        heading: "Where we are today",
        body: "24Therapy is in closed beta and is not yet HIPAA compliant. We are incorporating in the United States, and business associate agreements with each of our infrastructure providers are the next step after that — a BAA is a contract, and a contract needs a legal entity to sign it. Until every row in the table below reads signed, do not put protected health information into this product. We will tell you the day that changes rather than leaving you to check.",
      },
      {
        type: "prose",
        heading: "The subprocessors, and where each one stands",
        body: "Vercel — hosting and compute. HIPAA-eligible on their Enterprise plan; BAA available; not yet signed. Neon — the database holding every clinical record. HIPAA-eligible on their Business plan; BAA available; not yet signed. OpenAI — transcription and note generation. Zero-retention and a BAA are available on their enterprise terms; not yet signed. Daily — video. HIPAA-eligible plan with a BAA available; not yet signed. Stripe — payments; a BAA is available and payment data is not PHI in our architecture, since we never see a card. Resend — transactional email; a BAA is available. Every one of these is a company we can sign with, which is why they were chosen; none of them is signed yet, which is why this page says in progress rather than compliant.",
      },
      {
        type: "prose",
        heading: "What the beta means for you",
        body: "Our first customers are a small number of practices who know exactly what this is: a product being tested, priced for that, with the compliance work openly unfinished. Their patients are told too — the recording consent step is real, it stores what was agreed and when, and refusing it costs the patient nothing. If you are a US covered entity and you are not comfortable being one of those first practices, wait for the table above to go green. That is a reasonable position and we will not argue you out of it.",
      },
      {
        type: "prose",
        heading: "What is already built",
        body: "None of this depends on a signature and all of it can be inspected. Access to any chart requires an authenticated, non-expired session; sessions expire after 30 minutes of inactivity and 8 hours absolute. Every read and write of clinical data is recorded in an append-only audit log with actor, patient, resource and timestamp. Passwords are stored as scrypt hashes. Video rooms are private and require a per-participant token. Patients are asked to agree to being recorded before they enter the room, and their answer is stored with a timestamp and the wording they saw. Clinicians cannot delete a patient or a session, and cannot send clinical text to an address they type.",
      },
      {
        type: "prose",
        heading: "Where your data is held",
        body: "Amazon Web Services in Oregon, United States (us-west-2). If your regulator requires patient data to remain inside your own country — as the UAE does for health information under Federal Law No. 2 of 2019 — this deployment does not meet that requirement, and a region inside your jurisdiction is available on request. HIPAA is a United States statute and does not itself govern a practice in Dubai or Riyadh; we are meeting the US standard first because it is the higher bar, and because clearing it makes everything that follows easier to answer.",
      },
      {
        type: "prose",
        heading: "Retention and recovery",
        body: "Audit records are retained for six years. Clinical records are retained until deleted by the practice. Database point-in-time recovery currently covers the last 24 hours and will be extended before general availability.",
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
        /*
         * This used to describe an error reporter that did not exist —
         * "error reporting strips request bodies and URLs, and session replay
         * is disabled" — which is a claim about the behaviour of a system
         * nobody had built. It is true now, and only because it was built in
         * the same pass that corrected the sentence.
         */
        type: "prose",
        heading: "Logging",
        body: "Application logs contain request identifiers, never transcript text, note content, patient names or crisis indicators. Server errors are recorded with the route, the status and a stack trace; the request body, the query string and any path segment that could be an identifier are dropped before the record is written. There is no session replay and no client-side analytics.",
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
