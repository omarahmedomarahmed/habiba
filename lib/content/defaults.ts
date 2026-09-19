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
    title: "24Therapy: your session notes, written for you",
    description:
      "Record a session and walk away with a SOAP note, insights and a report for your patient.",
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
        heading: "Find a therapist who is available now",
        body: "Every dot is a verified clinician who has said they are free. If the map is empty, it is empty. Your record is yours, and it travels with you.",
        ctaLabel: "What this is for patients",
        ctaHref: "/for-patients",
        demo: "radar",
      },
      /*
       * 🔴 65.15 — FOUR HEROES, ONE PER PERSON WHO ARRIVES.
       *
       * > *The homepage has two heroes and both are about the therapist. That is the
       * > whole audience problem in one measurement.*
       *
       * A company, a patient and a clinic each arrive at this page with a different
       * question, and until sprint 65 the page answered a therapist's twice. Each hero
       * below is one line and the real component that audience would use, which is 65.14
       * and 65.17 in the same block: the picture carries what the paragraph used to.
       *
       * 🔴 AND EACH ONE LEADS TO ITS OWN PAGE (65.16), because a hero is a door rather
       * than an argument, and an audience given a section instead of a page has been
       * told they are a footnote to somebody else's product.
       */
      {
        type: "hero",
        eyebrow: "For therapists",
        heading: "Finish your notes before you leave the room",
        body: "Transcribed live, written while you say goodbye. You review, approve and send.",
        ctaLabel: "Start your first session free",
        ctaHref: "/signup",
        demo: "session-room",
        backgroundImage: "/backgrounds/mesh.svg",
      },
      {
        type: "hero",
        eyebrow: "For companies",
        heading: "Cover therapy for your people, and never learn who went",
        body: "You fund a pot and watch it spend. Attendance cannot be required through us.",
        ctaLabel: "How it works for companies",
        ctaHref: "/for-companies",
        demo: "company",
      },
      {
        type: "hero",
        eyebrow: "For clinics",
        heading: "Seats, colleagues and one set of books",
        body: "A practice sees schedules and bills. It never sees a note.",
        ctaLabel: "How it works for clinics",
        ctaHref: "/for-clinics",
        demo: "clinic",
      },
      {
        type: "showcase",
        heading: "What the product actually does",
        items: [
          {
            title: "The transcript writes itself",
            body: "Captured in chunks as the session runs. On video each person has their own track, so who said what is known rather than guessed.",
            icon: "mic",
            demo: "transcript",
          },
          {
            title: "The note is ready when you stand up",
            body: "A SOAP note, a summary and a follow-up, the moment a session ends. A draft with your name on it until you approve it.",
            icon: "fileText",
            demo: "note",
          },
          {
            title: "Risk language is scanned for, in Arabic and English",
            body: "Each segment is scanned for risk language as it arrives, and the alert is written down before anyone is notified. A prompt for your attention rather than a safety net: it misses things and raises false alarms.",
            icon: "shield",
            demo: "risk",
          },
          {
            title: "A quiet second opinion",
            body: "Two short prompts at most, and only when there is something worth saying. Silence is the expected answer.",
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
            body: "A first name and a tap. In person or video, no forms.",
            icon: "zap",
          },
          {
            title: "Talk",
            body: "The transcript builds beside you. Tap Off record whenever it should not.",
            icon: "mic",
          },
          {
            title: "Send",
            body: "End the session and the note is waiting. Edit, approve, send.",
            icon: "mail",
          },
          {
            title: "Patients need no account",
            body: "A link, a first name, and they are in. No password, no app.",
            icon: "users",
          },
          {
            title: "PHI stays where it belongs",
            body: "Every read of a chart is logged. No transcript text reaches application logs.",
            icon: "lock",
          },
          {
            title: "Built for a phone",
            body: "Designed for a phone. Desktop is the enhancement.",
            icon: "clock",
          },
          /*
           * 🔴 51.9 — the verified badge, which we check and never sell.
           *
           * Verification has been a real adapter-backed check since sprint 40:
           * a licence number, confirmed against a register, by us. Every
           * clinician who passes it gets a page at /t/:id they can put in an
           * Instagram bio, and no page has ever told them that is worth
           * something. It is the one thing here that helps a clinician
           * off-platform, which is exactly why it earns trust on it.
           */
          {
            title: "A verified page you can show anywhere",
            body: "We check your licence against the register. You get a page of your own that works as a link in a bio.",
            icon: "shield",
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
        body: "No card, no wizard.",
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
      "Your therapy record, owned by you and readable by nobody until you say so.",
    layout: "marketing",
    navLabel: "For patients",
    navOrder: 0,
    blocks: [
      {
        type: "hero",
        eyebrow: "For patients",
        heading: "Your therapy record, and it is actually yours",
        body: "Read it, hand it to the next therapist in one tap, and take that back just as fast.",
        ctaLabel: "See who is online now",
        ctaHref: "/radar",
        demo: "none",
        icon: "shield",
        backgroundImage: "/backgrounds/waves.svg",
      },
      /*
       * 🔴 65.20 — THE CLAIM FLOW AS THREE STEPS, which is the ticket's own example.
       *
       * This was four feature cards of prose describing an ordered process: you generate
       * a code, they enter it, you are asked. 65.22 forbids numbering content that is not
       * a sequence; this one is, so it is numbered, and the numbers are the information
       * the four paragraphs were spending words to establish.
       */
      {
        type: "flow",
        heading: "How your record reaches a new therapist",
        steps: [
          { title: "You make a code", detail: "On its own it shows them nothing" },
          { title: "They enter it", detail: "We ask you whether they may read your history" },
          { title: "You decide", detail: "Nothing moves until you say yes, and one tap ends it" },
        ],
      },
      {
        type: "features",
        heading: "It moves with you",
        items: [
          {
            title: "One record, however many therapists",
            body: "Every version of your summary stays, under its author's name.",
            icon: "users",
          },
          {
            title: "A copy you can keep",
            body: "Every session, note and summary, emailed to you, never over WhatsApp.",
            icon: "fileText",
          },
        ],
      },
      {
        type: "showcase",
        heading: "The two screens that argument rests on",
        items: [
          {
            title: "Your summary, with both therapists on it",
            body: "The real screen. Version one is still there under its author's name, and nobody can delete a version, including us.",
            icon: "fileText",
            demo: "summary",
          },
          {
            title: "What you wrote, between sessions",
            body: "A week is a long time to remember. Only a therapist you allowed can read it.",
            icon: "heart",
            demo: "journal",
          },
        ],
      },
      {
        type: "features",
        heading: "You never talk to the AI",
        items: [
          {
            title: "There is no chatbot here, and there will not be one",
            body: "No screen in the patient app types to a model, and the import graph is what stops it.",
            icon: "lock",
          },
          {
            title: "What it does instead",
            body: "It puts what it read in front of your clinician, with the sentence it came from attached.",
            icon: "brain",
          },
          {
            title: "Only a clinician you chose can ask it anything",
            body: "Only about you, and only while you allow it. Take it back and it stops that second.",
            icon: "shield",
          },
          {
            title: "Nothing written by a machine reaches you unsigned",
            body: "The person who was in the room reads it and puts their name on it first.",
            icon: "check",
          },
        ],
      },
      {
        type: "features",
        heading: "Finding somebody",
        items: [
          {
            title: "The Crisis Radar",
            body: "A live map of clinicians who are online now. No bot, no queue, no callback.",
            icon: "zap",
          },
          {
            title: "When to use it",
            body: "For when waiting until Tuesday is not the answer. Not an emergency service.",
            icon: "clock",
          },
          {
            title: "Booking an hour instead",
            body: "Every clinician has a calendar, and a reminder goes out before the hour.",
            icon: "clock",
          },
          /*
           * 🔴 51.9 — the largest unsold group we have, and it needs no code.
           *
           * Somebody in Toronto or Dubai who would rather cry in Arabic than
           * explain in English is not a feature request. The language filter
           * has been on the radar since sprint 8 and no page has ever said who
           * it is for. §7 calls this the biggest thing we built and never
           * mention.
           */
          {
            title: "A therapist who speaks your first language",
            body: "Filter the radar by language, and talk in the one you think in rather than the one you translate into.",
            icon: "users",
          },
        ],
      },
      {
        type: "showcase",
        heading: "What it actually looks like",
        items: [
          {
            title: "Your sessions, in your own app",
            body: "The sessions you booked, the ones you found on the radar, and the note written to you after each.",
            icon: "users",
            demo: "patient-sessions",
          },
          {
            title: "The steps you agreed, not homework marked out of ten",
            body: "What you agreed to try, written the way you agreed it. Nobody scores you.",
            icon: "check",
            demo: "homework",
          },
        ],
      },
      /*
       * 🔴 65.20 / 65.11 — THE WALL, DRAWN THE WAY THE PRODUCT DRAWS IT.
       *
       * Six feature cards of prose, on the public site, describing the rule the patient
       * app itself renders as two columns. A person who reads it here and then meets it
       * inside the product had to learn it twice.
       */
      {
        type: "seesWhat",
        heading: "What your therapist can and cannot see",
        who: "A therapist you allow",
        can: [
          "The sessions they ran with you, and their own notes",
          "Your history, while you allow it",
          "What you wrote, if you gave them access",
        ],
        cannot: [
          "Another therapist's notes, unless you say so",
          "Anything at all before you say yes",
          "Your record after you end their access",
        ],
      },
      {
        type: "features",
        heading: "The rest of it",
        items: [
          {
            title: "You can be recorded, or not",
            body: "Asked for, not assumed, and stoppable mid-session.",
            icon: "mic",
          },
          {
            title: "Claim it with your phone number",
            body: "We ask two questions first: a number is not a person.",
            icon: "shield",
          },
          {
            title: "A psychiatrist and a therapist, on one record",
            body: "Grant each separately, take either back on its own.",
            icon: "users",
          },
          {
            title: "It is still there in three years",
            body: "Nothing is deleted and nothing expires.",
            icon: "clock",
          },
        ],
      },
      {
        type: "faq",
        heading: "What it costs you",
        items: [
          {
            q: "Do I pay to use 24Therapy?",
            a: "No. You pay the therapist the price shown before you book. Our share comes from them.",
          },
          {
            q: "Can I pay in Egyptian pounds?",
            a: "Yes. The rate you were shown is the rate you are charged.",
          },
          {
            q: "What if the therapist does not turn up?",
            a: "After five minutes: somebody else at the same price or less, or your money back.",
          },
          {
            q: "Do I need an account?",
            a: "Not for a session. Yes to keep your history and claim a record.",
          },
          {
            q: "If I stop using 24Therapy, do I lose everything?",
            a: "No. Ask for a copy and it is emailed to you. It is a record extract, not a certificate.",
          },
          {
            q: "Can a therapist read my record without me agreeing?",
            a: "No. Every grant needs you, signed in, answering. You are messaged each time one starts.",
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
      "Live transcription, automatic SOAP notes, crisis-language alerts and patient reports, on your phone.",
    layout: "marketing",
    navLabel: "Features",
    navOrder: 1,
    blocks: [
      {
        type: "hero",
        eyebrow: "Features",
        heading: "The whole product is one screen",
        body: "Everything below is the real component on invented data, not a picture of one.",
        // 18R.1 — the same CTA pair as the header: the clinician's action is
        // the button, and the patient's route is one line away rather than
        // absent (18.4).
        ctaLabel: "Start free for therapists",
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
            body: "On video each person has their own track. In person, one microphone and the words decide.",
            icon: "mic",
            demo: "transcript",
          },
          {
            title: "Suggestions, not instructions",
            body: "Two short prompts at most, every few segments. Advice that changes every eight seconds is noise.",
            icon: "brain",
            demo: "copilot",
          },
          {
            title: "Crisis language raises a flag",
            body: "To you and only you. A patient sees a supportive message and a crisis line, never a level.",
            icon: "alert",
            demo: "risk",
          },
          {
            title: "The note you would have written",
            body: "SOAP, plus summary, talking points and follow-up. Editable everywhere, signed only by you.",
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
            body: "One tap stops capture without ending the session.",
            icon: "shield",
          },
          {
            title: "Video when you need it",
            body: "Private rooms, per-participant tokens that expire.",
            icon: "video",
          },
          {
            title: "Patient report by email",
            body: "Approve, then send a plain-language summary. Impressions stay in your chart.",
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
            a: "On video, each participant is on a separate audio track, no voice recognition or enrolment involved, so two similar voices are never confused. In person there is a single microphone, so the live transcript is unattributed and the note works out roles from context.",
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
            body: "Their sessions and the note you signed. No field could hold your clinical note: that is the query, not the screen.",
            icon: "users",
            demo: "patient-sessions",
          },
          {
            title: "What you agreed, on both phones",
            body: "The steps you agreed, not a scoreboard.",
            icon: "check",
            demo: "homework",
          },
          {
            title: "A profile that is dated observations, not prose",
            body: "Every line traceable to its session. No machine paragraph about a person.",
            icon: "brain",
            demo: "profile",
          },
        ],
      },
      {
        type: "cta",
        heading: "Start free. Your first session is on us",
        body: "Looking for a therapist rather than software? The radar is live.",
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
      "Join free. Pay per session, only when you run one, or take a flat price a month for unlimited sessions and unlimited AI. Your first session is free either way.",
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
            q: "What are the two ways to pay?",
            /*
             * 🔴 57.5 — the question the page did not have, and the reason the
             * whole model changed.
             *
             * A therapist cannot compare "a dollar plus two dollars a session"
             * to anything. Every product they will weigh us against quotes a
             * month. Pay as you go stays because a free door is worth more than
             * a trial, and because somebody running four sessions a week should
             * not be pushed onto a plan they do not need.
             */
            a: "Pay as you go bills per session; a plan bills one flat price and nothing per session. Move between them any time.",
          },
          {
            q: "When am I charged on pay as you go?",
            a: "When a session is marked complete. Your first is free.",
          },
          {
            q: "What does the session rate actually include?",
            a: "The session, transcription, the note, the report, crisis alerts, and the copilot questions on the cards above. Unused ones roll over.",
          },
          {
            q: "What does a monthly plan include?",
            a: "Unlimited sessions and AI, nothing per session. Our share of what a patient pays you is separate and unchanged.",
          },
          {
            q: "Which one should I be on?",
            /*
             * 🔴 The arithmetic rather than a recommendation, and no figure is
             * written here: both numbers are on the cards above, read from
             * `platform_settings` at render time. A worked example typed into
             * this file would be a second copy of the price, which is C60.
             */
            a: "Divide the monthly price by one session on pay as you go. Above that many sessions, the plan is cheaper.",
          },
          {
            q: "What happens when I cancel a plan?",
            /*
             * 🔴 Three sentences because three different fears are being
             * answered: am I locked in, do I lose the month I paid for, and do
             * I lose my records. The third is the one nobody asks out loud.
             */
            a: "It stops the next charge and nothing else. The plan runs to its date, then pay as you go resumes.",
          },
          {
            q: "What if a renewal payment fails?",
            a: "You keep the month you paid for. Still unpaid at the end of it, and pay as you go resumes.",
          },
          {
            q: "What if a session was a mistake?",
            a: "Cancel it instead of completing it and nothing is charged.",
          },
          {
            q: "What do you take when a patient pays me?",
            /*
             * 🔴 51.1 — "the percentage shown on the cards above" pointed at
             * a number 46.9 moved.
             *
             * There are two fees and they are not the same thing: what we
             * charge YOU, which the cards state, and our share of what a
             * PATIENT pays you, which is a percentage stated below them.
             * Sending a reader to the cards for the percentage sends them
             * somewhere it is not.
             */
            a: "A share of what the session paid you, at the percentage on this page. With a Stripe account we never hold the money; without one we hold it and pay out on request.",
          },
          {
            q: "Can I pay my 24Therapy bill out of my earnings?",
            a: "Yes. What you owe comes out of what you are paid rather than a card, never more than your share, and you can turn it off.",
          },
          {
            /*
             * 🔴 57.5 — rewritten again, and the reason is worth keeping.
             *
             * Sprint 46 replaced session bundles with credit that unlocked a
             * lower AI rate. Sprint 57 removed the rate ladder entirely, so the
             * sentence "the lower AI rate it unlocked stays yours" now promises
             * something that does not exist. Copy describing a mechanic the code
             * has dropped is the same defect as a test asserting one.
             */
            q: "What happens to credit I added and did not spend?",
            a: "Credit is money, not sessions. It pays session and AI fees, and it is spent before your card.",
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
            email: "support@24therapy.app",
            hours: "Sunday to Thursday, 09:00-18:00 UTC",
          },
          {
            title: "24Therapy Egypt",
            entity: "eg",
            body: "The Egyptian entity. Payments in Egyptian pounds, and payouts by InstaPay or wallet.",
            address: "",
            phone: "",
            email: "egypt@24therapy.app",
            hours: "Sunday to Thursday, 10:00-19:00 Cairo",
          },
        ],
      },
      {
        type: "features",
        heading: "What we can help with",
        items: [
          { title: "Getting started", body: "Setting up your practice and running your first session.", icon: "zap" },
          { title: "Compliance", body: "BAAs, subprocessors and how patient data is handled.", icon: "shield" },
          /* 51.1 — "bundles" is the pre-46 word. Credit, plans, invoices. */
          { title: "Billing", body: "Credit, plans, invoices, payouts and anything that looks wrong on your bill.", icon: "chart" },
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
        body: "هذه الصفحة بالإنجليزية، لأن النص الملزم قانونًا هو النص الإنجليزي. إن أردت شرحًا لها بالعربية فاكتب إلينا من صفحة التواصل وسيشرحها لك شخص.",
      },
      {
        type: "features",
        heading: "The short version",
        items: [
          {
            title: "Your notes are yours",
            body: "A clinician sees the patients they treat. Nobody else at 24Therapy reads a note unless you ask us to look at something.",
            icon: "lock",
          },
          {
            title: "Nothing trains a model",
            body: "Session audio and text go to our AI provider so the note can be written, and are never used to train anything.",
            icon: "shield",
          },
          {
            title: "You can take it or delete it",
            body: "A patient can export their record or ask us to erase it, and we do both rather than pointing at a clinician.",
            icon: "check",
          },
        ],
      },
      {
        type: "prose",
        body: "This page is a starting point maintained by your administrator, not legal advice. Review it with counsel before you accept a real patient.",
      },
      {
        type: "prose",
        heading: "What we store",
        body: "Account details for clinicians (name, email, hashed password, licence details you choose to add). For patients: a first name, optionally a last name and email, plus the clinical record created by sessions, transcripts, notes, and risk assessments.",
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
        body: "هذه الصفحة بالإنجليزية، لأن النص الملزم قانونًا هو النص الإنجليزي. إن أردت شرحًا لها بالعربية فاكتب إلينا من صفحة التواصل وسيشرحها لك شخص.",
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
        heading: "HIPAA, in progress",
        demo: "none",
        icon: "shield",
        backgroundImage: "/backgrounds/contours.svg",
      },
      {
        type: "prose",
        body: "هذه الصفحة بالإنجليزية، لأن النص الملزم قانونًا هو النص الإنجليزي. إن أردت شرحًا لها بالعربية فاكتب إلينا من صفحة التواصل وسيشرحها لك شخص.",
      },
      {
        type: "prose",
        heading: "Where we are today",
        body: "24Therapy is in closed beta and is not yet HIPAA compliant. We are incorporating in the United States, and business associate agreements with each of our infrastructure providers are the next step after that, a BAA is a contract, and a contract needs a legal entity to sign it. Until every row in the table below reads signed, do not put protected health information into this product. We will tell you the day that changes rather than leaving you to check.",
      },
      {
        type: "prose",
        heading: "The subprocessors, and where each one stands",
        body: "Vercel, hosting and compute. HIPAA-eligible on their Enterprise plan; BAA available; not yet signed. Neon, the database holding every clinical record. HIPAA-eligible on their Business plan; BAA available; not yet signed. OpenAI, transcription and note generation. Zero-retention and a BAA are available on their enterprise terms; not yet signed. Daily, video. HIPAA-eligible plan with a BAA available; not yet signed. Stripe, payments; a BAA is available and payment data is not PHI in our architecture, since we never see a card. Resend, transactional email; a BAA is available. Every one of these is a company we can sign with, which is why they were chosen; none of them is signed yet, which is why this page says in progress rather than compliant.",
      },
      {
        type: "prose",
        heading: "What the beta means for you",
        body: "Our first customers are a small number of practices who know exactly what this is: a product being tested, priced for that, with the compliance work openly unfinished. Their patients are told too, the recording consent step is real, it stores what was agreed and when, and refusing it costs the patient nothing. If you are a US covered entity and you are not comfortable being one of those first practices, wait for the table above to go green. That is a reasonable position and we will not argue you out of it.",
      },
      {
        type: "prose",
        heading: "What is already built",
        body: "None of this depends on a signature and all of it can be inspected. Access to any chart requires an authenticated, non-expired session; sessions expire after 30 minutes of inactivity and 8 hours absolute. Every read and write of clinical data is recorded in an append-only audit log with actor, patient, resource and timestamp. Passwords are stored as scrypt hashes. Video rooms are private and require a per-participant token. Patients are asked to agree to being recorded before they enter the room, and their answer is stored with a timestamp and the wording they saw. Clinicians cannot delete a patient or a session, and cannot send clinical text to an address they type.",
      },
      {
        type: "prose",
        heading: "Where your data is held",
        body: "Amazon Web Services in Oregon, United States (us-west-2). If your regulator requires patient data to remain inside your own country, as the UAE does for health information under Federal Law No. 2 of 2019, this deployment does not meet that requirement, and a region inside your jurisdiction is available on request. HIPAA is a United States statute and does not itself govern a practice in Dubai or Riyadh; we are meeting the US standard first because it is the higher bar, and because clearing it makes everything that follows easier to answer.",
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
        body: "هذه الصفحة بالإنجليزية، لأن النص الملزم قانونًا هو النص الإنجليزي. إن أردت شرحًا لها بالعربية فاكتب إلينا من صفحة التواصل وسيشرحها لك شخص.",
      },
      {
        type: "features",
        heading: "The short version",
        items: [
          {
            title: "Every read is written down",
            body: "Opening a chart appends a row to a log nobody can edit, including us.",
            icon: "shield",
          },
          {
            title: "A role is a list, not a rank",
            body: "An unrecognised role is denied rather than quietly allowed, and every clinical query is scoped to one practice.",
            icon: "lock",
          },
          {
            title: "We say what is not finished",
            body: "The compliance work still in progress is named on this page rather than implied to be done.",
            icon: "alert",
          },
        ],
      },
      {
        type: "prose",
        heading: "Authentication",
        body: "Sessions are opaque tokens stored as hashes, held in an httpOnly, Secure, SameSite cookie. There is no token in browser storage for a script to read. Signing out, changing a password or resetting a password revokes every existing session immediately.",
      },
      {
        type: "prose",
        heading: "Authorisation",
        body: "Roles are an explicit allowlist rather than a hierarchy of numbers, so an unrecognised role is denied rather than silently permitted. Every query for clinical data is scoped to the practice that owns it, and the scoping is applied by the data layer rather than remembered by each caller.",
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
        body: "Email security@24therapy.app. We will acknowledge within two business days.",
      },
    ],
  }

];

export function findDefaultPage(slug: string): DefaultPage | null {
  return DEFAULT_PAGES.find((p) => p.slug === slug) ?? null;
}
