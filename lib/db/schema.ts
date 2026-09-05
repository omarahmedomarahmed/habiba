import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * 24Therapy schema — 22 tables.
 *
 * Deliberate invariants (each one is a bug that was paid for once already):
 *  - `sessions.patient_id` is NULLABLE. A session created from a join link has
 *    no patient row until someone types a name. Every join against it is a LEFT
 *    join. Three separate "note not found" bugs came from forgetting this.
 *  - `audit_log.patient_id` is NULLABLE. A NOT NULL there made HIPAA audit
 *    inserts fail silently on every route that isn't patient-scoped.
 *  - Users are unique on (organization_id, email) only among non-deleted rows.
 *    A plain unique constraint makes re-registration after a soft delete fail.
 *  - `therapist_id` on a session is a `users.id`. There is no separate therapist
 *    profile table, precisely so that "therapist id vs user id" can never again
 *    be passed to the wrong foreign key.
 */

/**
 * Roles inside an organisation.
 *
 * `"patient"` is deliberately **not** here. PLAN.md 6.1 asks for it, and adding
 * it would mean a patient is a `users` row — which 6.2, two tickets later,
 * forbids for a concrete reason (see `patientAccounts`). A patient has their
 * own identity table and their own session; they are not a member of an
 * organisation and never become one. See C41.
 */
export const ROLES = ["super_admin", "therapist"] as const;
export type Role = (typeof ROLES)[number];

/**
 * The tiers a therapist can be on. Keys only — every *figure* lives in
 * `platform_settings.pricing`, which is why there is no rate here.
 *
 * `unlimited` is gone: there is no subscription any more, only sessions bought
 * at a rate. Existing rows were moved to `payg` by `scripts/settings.ts
 * reprice`. The column is plain `text` with no check constraint, so a value
 * outside this list is possible in the database and `tierByKey` fails closed to
 * the zero-minimum tier rather than throwing.
 */
export const PLANS = ["payg", "starter", "growth"] as const;
export type PlanKey = (typeof PLANS)[number];

export const SESSION_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const MODALITIES = ["in_person", "video"] as const;
export type Modality = (typeof MODALITIES)[number];

// ---------------------------------------------------------------- tenancy ---

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** Practice-level preferences. Was a whole `organization_settings` table. */
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("organizations_slug_unique")
      .on(t.slug)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type TherapistProfile = {
  credentials?: string;
  licenseType?: string;
  licenseNumber?: string;
  licenseState?: string;
  npi?: string;
  bio?: string;
  phone?: string;
  timezone?: string;
  /** Copilot read-aloud voice and playback rate. */
  voice?: "british_female" | "american_male" | "american_female" | "british_male";
  voiceSpeed?: number;
  /**
   * Which radar events make a noise.
   *
   * Separated because they are genuinely different events. Someone opening
   * your profile is a heads-up; someone paying is an interruption you want. A
   * clinician who finds the first one twitchy should be able to silence it
   * without also silencing the one that means a patient is arriving.
   */
  alertOnView?: boolean;
  alertOnBooking?: boolean;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    role: text("role").$type<Role>().notNull().default("therapist"),
    status: text("status").$type<"active" | "suspended">().notNull().default("active"),

    /** License details etc. Collected lazily in settings, never at signup. */
    profile: jsonb("profile").$type<TherapistProfile>().default({}).notNull(),
    /** Soft signal only — it must never gate the clinical loop. */
    verificationStatus: text("verification_status")
      .$type<"unverified" | "pending" | "verified" | "rejected">()
      .notNull()
      .default("unverified"),

    /**
     * Stripe Connect Express.
     *
     * The therapist's own connected account. We never hold their money: a
     * patient payment is a destination charge that lands in this account with
     * our cut taken as an application fee, and Stripe owns the payout rails,
     * the KYC and the tax forms. Holding a balance ourselves and paying it out
     * by hand would make us a payment intermediary, which is a licensing
     * problem long before it is an engineering one.
     */
    stripeAccountId: text("stripe_account_id"),
    /** Mirrored from `account.updated`; never inferred from onboarding returning. */
    chargesEnabled: boolean("charges_enabled").notNull().default(false),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    /** What the therapist charges a patient for a 30-minute session, in cents. */
    sessionRateCents: integer("session_rate_cents").notNull().default(0),
    /**
     * Settle 24Therapy invoices out of the application fee on the next patient
     * payment, instead of asking for a card. Opt-out, disclosed at the point of
     * setting a rate.
     */
    autoSettleFromEarnings: boolean("auto_settle_from_earnings").notNull().default(true),

    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Partial: a soft-deleted user must not block the same address signing up again.
    uniqueIndex("users_org_email_unique")
      .on(t.organizationId, t.email)
      .where(sql`deleted_at IS NULL`),
    index("users_email_idx").on(t.email),
    index("users_org_idx").on(t.organizationId),
    // NULLs are distinct in Postgres, so this only constrains real accounts —
    // one connected account can never be attached to two clinicians.
    uniqueIndex("users_stripe_account_unique").on(t.stripeAccountId),
  ],
);

/**
 * Opaque server sessions. No JWT: the old code hit the database on every
 * request to validate the token anyway, so the JWT bought nothing and cost
 * revocation. A row here can be deleted and the user is out immediately.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    /** Sliding idle window. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    /** Hard cap, independent of activity. */
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    /**
     * Expiry of an elevated read grant on this session. Null for every ordinary
     * session; set by a second-factor check and always shorter than the session
     * itself.
     */
    elevatedUntil: timestamp("elevated_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(t.tokenHash),
    index("auth_sessions_user_idx").on(t.userId),
  ],
);

/**
 * Second-factor material for restricted administrative reads.
 *
 * Two slots, both scrypt-hashed with the same helper the login path uses. Slot
 * `a` is rotatable through the application; slot `b` is write-once from the
 * application and thereafter changeable only with direct database access.
 */
export const consoleKeys = pgTable("console_keys", {
  slot: text("slot").$type<"a" | "b">().primaryKey(),
  hash: text("hash").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Single-use, hashed, short-lived tokens for password reset / email verify. */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").$type<"password_reset">().notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_unique").on(t.tokenHash)],
);

// ------------------------------------------------------------ verification ---

export const VERIFICATION_STATES = ["draft", "submitted", "approved", "rejected"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

/**
 * Who a clinician actually is.
 *
 * We are asking a stranger on the internet to conduct therapy with vulnerable
 * people under our name and take money for it. Collecting identity is not
 * bureaucracy; it is the difference between a marketplace and a liability.
 *
 * One row per clinician, resubmittable. Kept in its own table rather than on
 * `users` because it is a *submission* with a lifecycle — drafted, submitted,
 * reviewed, possibly rejected and redone — and because it holds document URLs
 * that must never be selected by a query that is only after a name.
 */
export const therapistVerifications = pgTable(
  "therapist_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    state: text("state").$type<VerificationState>().notNull().default("draft"),

    /** ISO-3166 alpha-2. Drives which documents we ask for. */
    country: text("country"),
    /** Free text: registers differ wildly by country and we must not guess. */
    licenseBody: text("license_body"),
    licenseNumber: text("license_number"),
    licenseExpiry: text("license_expiry"),
    specialties: jsonb("specialties").$type<string[]>().default([]).notNull(),
    languages: jsonb("languages").$type<string[]>().default([]).notNull(),

    /**
     * Document URLs. Unguessable paths on Vercel Blob — the URL *is* the
     * credential, so these columns are never selected into anything a patient
     * or another clinician can reach, and never logged.
     */
    idFrontUrl: text("id_front_url"),
    idBackUrl: text("id_back_url"),
    licenseDocUrl: text("license_doc_url"),
    headshotUrl: text("headshot_url"),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    /** Shown to the clinician verbatim when rejected — so make it useful. */
    reviewNote: text("review_note"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("therapist_verifications_user_unique").on(t.userId),
    index("therapist_verifications_state_idx").on(t.state, t.submittedAt),
  ],
);

// ---------------------------------------------------------------- clinical ---

export type PatientClinical = {
  diagnoses?: string[];
  medications?: string[];
  goals?: string[];
  notes?: string;
};

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    /** The owning clinician. One therapist per patient in v1. */
    therapistId: uuid("therapist_id").references(() => users.id, { onDelete: "restrict" }),

    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),

    /**
     * The person this file is about, once there is one (5.1).
     *
     * Nullable, and staying nullable: a patient created from a join link has no
     * person until the backfill or the next write gives them one, and a NOT
     * NULL here would make that a failed insert rather than a row to tidy up.
     */
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),

    clinical: jsonb("clinical").$type<PatientClinical>().default({}).notNull(),

    /** How the record came into being — `join_link` patients typed their own name. */
    source: text("source").$type<"therapist" | "join_link">().notNull().default("therapist"),

    lastSessionAt: timestamp("last_session_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("patients_org_idx").on(t.organizationId),
    index("patients_therapist_idx").on(t.therapistId),
    index("patients_email_idx").on(t.organizationId, t.email),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Nullable on purpose: a link-based session has no patient until one joins.
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }),

    /** Shown before a patient record exists. */
    guestName: text("guest_name"),
    guestEmail: text("guest_email"),

    modality: text("modality").$type<Modality>().notNull().default("in_person"),

    /*
     * How this session came to exist. PLAN.md 4.6.
     *
     * Distinct from `modality` (video or in person) and from `price_cents`
     * (what it cost), because neither answers the question the business
     * actually asks: where did this session come from? A free link and a $0
     * radar session both have `price_cents = 0` and are completely different
     * events — one is a clinician inviting somebody they already know, the
     * other is a stranger in crisis finding them on a map.
     *
     * Backfilled on the migration from what *is* derivable, and `direct` is the
     * honest answer for a row where nothing distinguishes the two.
     */
    sessionType: text("session_type")
      .$type<SessionType>()
      .notNull()
      .default("direct"),
    status: text("status").$type<SessionStatus>().notNull().default("scheduled"),

    /** Patient join link. Random, expiring, revocable. */
    joinToken: text("join_token"),
    joinTokenExpiresAt: timestamp("join_token_expires_at", { withTimezone: true }),
    /**
     * The rating link, deliberately not the join token.
     *
     * These were the same value once, which meant a forwarded "rate your
     * session" link also opened the room, and a rating that had to work for
     * days forced the room key to stay valid for days. They have different
     * lifetimes and different audiences, so they are different secrets.
     */
    feedbackToken: text("feedback_token"),

    videoRoomUrl: text("video_room_url"),
    videoRoomName: text("video_room_name"),

    /**
     * What the patient pays the therapist for this session. Zero means the
     * session is free to join — the overwhelmingly common case for an existing
     * caseload, where money changes hands outside this product entirely.
     */
    priceCents: integer("price_cents").notNull().default(0),
    /**
     * `not_required` when the price is zero. A priced session sits at `pending`
     * until Stripe confirms, and the join link refuses to hand out a meeting
     * token until it reads `paid` — the gate is here, on the server, not a
     * disabled button.
     */
    paymentStatus: text("payment_status")
      .$type<"not_required" | "pending" | "paid">()
      .notNull()
      .default("not_required"),

    patientJoinedAt: timestamp("patient_joined_at", { withTimezone: true }),
    /**
     * Null while the microphone is running; a timestamp while it is paused.
     *
     * Off-record used to be client state only, which meant the person who
     * agreed to be recorded was the one person who could not tell when the
     * recording stopped. Persisted so the patient's own screen can show it.
     */
    recordingPausedAt: timestamp("recording_paused_at", { withTimezone: true }),

    /**
     * Whether the patient agreed to be recorded, when, and to what wording.
     *
     * The page used to say "your therapist may record it to write their
     * clinical notes" and leave it there. That is notice; consent is an act.
     * There was nothing to produce if a recording were ever disputed, which is
     * the only moment the question is ever asked.
     *
     * `declined` is a value rather than an absence because "they never agreed"
     * and "they refused" are opposite facts, and a null cannot tell them
     * apart. A refusal does not stop the session — it starts it off record.
     */
    recordingConsent: text("recording_consent").$type<"granted" | "declined">(),
    recordingConsentAt: timestamp("recording_consent_at", { withTimezone: true }),
    /** Consent is to particular words, and the words will be edited. */
    recordingConsentVersion: text("recording_consent_version"),

    /**
     * When the microphone actually started. PLAN.md 7.8.
     *
     * Not the same as `recordingConsentAt` and not the same as `startedAt`. A
     * patient who says yes at minute 10 creates a session where the first ten
     * minutes were never captured, and §3 requires the note to say so in those
     * words. Without this column the note can only claim the session was
     * recorded, which reads as a complete record of something that is not.
     */
    recordingStartedAt: timestamp("recording_started_at", { withTimezone: true }),

    /**
     * The second control from §3: **share my profile**. PLAN.md 7.8.
     *
     * Separate from recording consent because they are different questions —
     * one is about capturing this hour, the other is about handing over
     * everything before it. A patient may reasonably say yes to one and no to
     * the other, and a single "consent" flag makes that impossible to express.
     *
     * Both controls move in one direction only, off → on. Turning recording
     * *off* mid-session would leave a recording that exists and a patient who
     * believes it does not; §3's answer is to end the session and answer no
     * next time.
     */
    profileShareConsent: text("profile_share_consent").$type<"granted" | "declined">(),
    profileShareConsentAt: timestamp("profile_share_consent_at", { withTimezone: true }),

    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),

    /**
     * When the clinician chose to keep going past the half hour they were paid
     * for.
     *
     * Null means the decision has not been made — not that it was declined,
     * because declining is simply ending the session. Recorded as a timestamp
     * rather than a flag so the record can answer "at what point did this
     * become a longer session", which is a clinical question as much as a
     * billing one.
     *
     * Nothing about this raises a second charge. See `lib/session-clock.ts`.
     */
    extendedAt: timestamp("extended_at", { withTimezone: true }),
    /**
     * Why the session stopped, when it was not a person pressing End.
     *
     * `cap` is the fifty-minute limit; `silence` is a room everybody left. A
     * session that ended by itself must say so — the alternative is a clinician
     * reading a duration that does not match their memory with no explanation
     * anywhere.
     */
    autoEndedReason: text("auto_ended_reason").$type<"cap" | "silence" | null>(),

    /**
     * The language this session is spoken in, as an ISO 639-1 code.
     *
     * Null means we do not know, and the transcription request omits the
     * language parameter so the model detects it. A value pins every chunk of
     * the session to one language.
     *
     * That pinning is the point. Chunks are eight seconds long and transcribed
     * independently, so per-chunk detection on a chunk that is mostly "mm-hmm"
     * is a coin flip — and a transcript that switches language every third line
     * is harder to read, and harder to write a note from, than one that is
     * consistently wrong. A clinician who works in two languages can set this
     * in the room and it stays set.
     *
     * The value it replaces was `language: "en"`, hardcoded into every request.
     */
    transcriptLanguage: text("transcript_language"),

    /** Drives the "generating your note" state without a job queue. */
    noteStatus: text("note_status")
      .$type<"none" | "generating" | "ready" | "failed">()
      .notNull()
      .default("none"),

    reportSentAt: timestamp("report_sent_at", { withTimezone: true }),

    /**
     * When we nudged the patient to rate the session, so we never nudge twice.
     *
     * The rating is the gate in front of the summary, which makes an unrated
     * session a person who was told there was something for them and then never
     * came back for it. One reminder is a service; two is us pestering somebody
     * about their therapy, so this column exists to make the second impossible
     * rather than unlikely.
     */
    ratingReminderAt: timestamp("rating_reminder_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sessions_join_token_unique").on(t.joinToken),
    uniqueIndex("sessions_feedback_token_unique").on(t.feedbackToken),
    index("sessions_org_idx").on(t.organizationId),
    index("sessions_therapist_idx").on(t.therapistId, t.createdAt),
    index("sessions_patient_idx").on(t.patientId),
  ],
);

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    speaker: text("speaker").$type<"therapist" | "patient" | "unknown">()
      .notNull()
      .default("unknown"),
    /** True when the speaker was inferred from the words, not heard on a track. */
    speakerInferred: boolean("speaker_inferred").notNull().default(false),
    text: text("text").notNull(),
    startMs: integer("start_ms").notNull().default(0),
    endMs: integer("end_ms").notNull().default(0),

    /*
     * Acoustic descriptors. **Descriptors, never emotion labels.**
     *
     * PLAN.md 3.3 is emphatic about the distinction and it is a clinical one,
     * not a stylistic one. "Speaking at 190 words per minute after a 4-second
     * pause" is an observation a clinician can check against their own memory
     * of the room and disagree with. "Anxious" is a diagnosis, inferred from
     * timing by software with no access to the person — and once it is written
     * in a record it is very hard to unwrite, because the next reader sees a
     * label rather than the flimsy evidence behind it.
     *
     * So the schema can hold rate and pause and nothing else. There is
     * deliberately no `affect`, `tone` or `sentiment` column, and adding one is
     * a decision to be argued for rather than a field to be filled in.
     *
     * Both are derived from data already captured — the transcribed words, the
     * chunk's duration, and the gap to the previous segment — so no audio
     * analysis and no second model call. Null means not computed, which every
     * row predating this sprint is.
     */
    /** Words per minute over this segment. */
    wordsPerMinute: integer("words_per_minute"),
    /** Silence between the previous segment ending and this one starting. */
    pauseBeforeMs: integer("pause_before_ms"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // The client retries chunks; the same sequence must never land twice.
    uniqueIndex("transcript_segments_session_seq_unique").on(t.sessionId, t.sequence),
    index("transcript_segments_session_idx").on(t.sessionId, t.sequence),
  ],
);

export type SoapNote = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type NoteContent = {
  soap: SoapNote;
  summary: string;
  /**
   * What the patient is allowed to read.
   *
   * Written in the same generation pass as the clinical note but addressed to
   * the patient in plain language: what was talked about, what was agreed, what
   * to do before next time. The SOAP note is a professional document full of
   * differential impressions and risk language — sending it to the person it
   * is about is how a clinician ends up explaining the word "guarded" over the
   * phone. Nothing else is ever emailed out.
   */
  patientBrief: string;
  /**
   * The part of the brief somebody actually acts on.
   *
   * `recommendations` is the clinician's list — "trial behavioural activation",
   * "consider psychiatric referral" — and it is written about the patient. This
   * is the same session's plan written *to* them, in the second person, as
   * things a person can do in a week: two or three at most, because a list of
   * seven is a list nobody starts.
   *
   * Kept apart from the prose because prose is read once and a list is read
   * again on Thursday. It was the single most common thing missing from what
   * the patient received: a warm summary of a conversation with nothing in it
   * to do next.
   */
  patientSteps: string[];
  /**
   * One line about what happens after this: when to come back, and what to do
   * if it gets worse before then. The patient-facing counterpart to
   * `followUp`, which is a clinician's scheduling note and stays in the chart.
   */
  patientNext: string;
  talkingPoints: string[];
  observations: string;
  impressions: string;
  recommendations: string[];
  followUp: string;
};

/**
 * BCP-47-ish language tag for a note, plus the label to show a clinician.
 *
 * Only the languages we can reliably both transcribe and write clinical prose
 * in. An unknown tag falls back to English rather than producing a note in a
 * language nobody asked for.
 */
export const NOTE_LANGUAGES: Record<string, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
  nl: "Nederlands",
  tr: "Türkçe",
  ru: "Русский",
  uk: "Українська",
  pl: "Polski",
  hi: "हिन्दी",
  ur: "اردو",
  bn: "বাংলা",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
  th: "ไทย",
  he: "עברית",
  fa: "فارسی",
  sw: "Kiswahili",
  tl: "Tagalog",
};

/** Languages written right to left — the note viewer has to know. */
export const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

export const sessionNotes = pgTable(
  "session_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }),

    content: jsonb("content").$type<NoteContent>().notNull(),
    /**
     * The language the session was actually conducted in.
     *
     * `content` is always in this language: a clinician working in Arabic
     * should be signing an Arabic note, not translating one back in their head.
     */
    language: text("language").notNull().default("en"),
    /**
     * An English rendering of the same note, when the session was not in
     * English. Kept alongside rather than instead of, because the clinical
     * record is the one the clinician signed and a translation is a
     * convenience — for a supervisor, an insurer, or us.
     */
    contentEn: jsonb("content_en").$type<NoteContent | null>(),
    /**
     * The clinical record's signature. This is the one that makes the note a
     * document rather than a draft, and it is the one an auditor asks about.
     */
    status: text("status").$type<"draft" | "approved">().notNull().default("draft"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),

    /**
     * The patient's copy, signed separately.
     *
     * These are two different decisions and they were one button. "This is an
     * accurate clinical record" and "this is what I am content for the person
     * to read on their phone tonight" are not the same judgement, they are not
     * always made at the same moment, and one of them is irreversible in a way
     * the other is not — once the brief is sent it cannot be unsent.
     *
     * Splitting them also lets the useful order happen: a clinician can release
     * the plain-language summary while the patient is still holding their phone
     * and finish the formal write-up later, which is the sequence everybody
     * actually wanted and the old single button forbade.
     *
     * Nothing is emailed until *this* one is approved — see `releaseBrief`.
     */
    patientStatus: text("patient_status").$type<"draft" | "approved">().notNull().default("draft"),
    patientApprovedAt: timestamp("patient_approved_at", { withTimezone: true }),
    patientApprovedBy: uuid("patient_approved_by").references(() => users.id, {
      onDelete: "set null",
    }),

    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("session_notes_session_unique").on(t.sessionId),
    index("session_notes_therapist_idx").on(t.therapistId, t.createdAt),
  ],
);

export const RISK_LEVELS = ["none", "low", "moderate", "elevated", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const riskAssessments = pgTable(
  "risk_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }),

    level: text("level").$type<RiskLevel>().notNull(),
    source: text("source").$type<"keyword" | "model">().notNull(),
    /** Matched phrases / model indicators. PHI — never logged. */
    indicators: jsonb("indicators").$type<string[]>().default([]).notNull(),
    recommendedAction: text("recommended_action"),

    /**
     * Persisted as `pending` BEFORE anyone is notified, flipped to `delivered`
     * after. The sweeper cron is the only reason an alert survives a failed
     * notification, so the order of these two writes is load-bearing.
     */
    alertStatus: text("alert_status")
      .$type<"pending" | "delivered" | "acknowledged">()
      .notNull()
      .default("pending"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("risk_assessments_session_idx").on(t.sessionId),
    index("risk_assessments_alert_status_idx").on(t.alertStatus, t.createdAt),
    index("risk_assessments_therapist_idx").on(t.therapistId, t.createdAt),
  ],
);

/**
 * Per-patient copilot conversation.
 *
 * One thread per patient, and that isolation is the point: a thread's context
 * is built only from that patient's sessions, so asking it about anyone else
 * produces "I have nothing on that" rather than a leak across a caseload.
 */
export const copilotThreads = pgTable(
  "copilot_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Accumulated corrections from the therapist — "she is not the one with the
     * sister, that is a different patient", "stop suggesting CBT homework".
     *
     * Prepended to the system prompt, above everything else and framed as
     * overriding it. That placement is load-bearing and was learned the hard
     * way: appended at the end, after the output schema, "all answers in
     * arabic" was obeyed zero times out of six on a real thread. The model was
     * given the instruction and quietly outvoted it with twelve sessions of
     * context.
     */
    guidance: text("guidance"),
    /**
     * What language the copilot answers this thread in.
     *
     * `auto` means "match the language the question was asked in", which is the
     * right default and was, until this column existed, not what happened: the
     * prompt is written in English and said nothing about language, so an
     * Arabic question got an English answer. A clinician working in Arabic
     * should not have to correct that every time, and a correction is the wrong
     * tool for a setting.
     */
    replyLanguage: text("reply_language").notNull().default("auto"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("copilot_threads_patient_unique").on(t.patientId),
    index("copilot_threads_therapist_idx").on(t.therapistId, t.lastMessageAt),
  ],
);

/** Where a claim came from: a real transcript segment, resolvable to a row. */
export type Citation = {
  sessionId: string;
  sessionDate: string;
  sequence: number;
  speaker: "therapist" | "patient" | "unknown";
  quote: string;
  atSeconds: number;
};

export const COPILOT_ROLES = ["therapist", "copilot", "session_note", "correction"] as const;
export type CopilotRole = (typeof COPILOT_ROLES)[number];

export const copilotMessages = pgTable(
  "copilot_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => copilotThreads.id, { onDelete: "cascade" }),
    role: text("role").$type<CopilotRole>().notNull(),
    content: text("content").notNull(),
    /** Empty for anything the therapist wrote; required in spirit for answers. */
    citations: jsonb("citations").$type<Citation[]>().default([]).notNull(),
    /** Set on messages written automatically from an in-session suggestion. */
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("copilot_messages_thread_idx").on(t.threadId, t.createdAt)],
);

// ------------------------------------------------------------ data access ---

export const EXPORT_TTL_HOURS = 72;

/**
 * A patient asking for their own record.
 *
 * This is the whole answer to "someone wants their data and it lives on their
 * therapist's portal". No impersonation, no admin reading a transcript: a
 * clinician or an admin presses a button, and a link goes *to the patient's
 * own email*. Whoever pressed it never sees the contents.
 *
 * The token is stored hashed for the same reason a session token is — a leaked
 * database row must not be a leaked medical record. The export itself is not
 * stored anywhere; it is rendered fresh when the link is opened, so there is no
 * copy of a chart sitting in a bucket waiting to be found.
 */
export const dataExports = pgTable(
  "data_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    /** SHA-256 of the token in the link. Never the token itself. */
    tokenHash: text("token_hash").notNull(),
    /** Frozen at request time: the address the link was sent to. */
    deliveredTo: text("delivered_to").notNull(),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    requestedByRole: text("requested_by_role").$type<Role>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }),
    openCount: integer("open_count").default(0).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("data_exports_token_unique").on(t.tokenHash),
    index("data_exports_patient_idx").on(t.patientId, t.createdAt),
  ],
);

// ---------------------------------------------------------------- taxonomy ---

export const TAXONOMY_KINDS = ["country", "language", "specialty"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

/**
 * Admin control over what the radar offers.
 *
 * An *override* layer, not the list itself. The built-in lists in `lib/geo.ts`
 * are the universe of things that can exist; a row here says "this one is
 * switched off", or renames it, or adds a specialty we did not think of.
 *
 * Done the other way round — the table being the only source — the first empty
 * database is a radar with no languages, and every deployment needs a seed step
 * before it works. Absence of a row means "on", so the product is correct
 * before an admin has ever opened the page.
 */
export const taxonomyEntries = pgTable(
  "taxonomy_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<TaxonomyKind>().notNull(),
    /** ISO code for a country; the label itself for a language or specialty. */
    code: text("code").notNull(),
    /** Overrides the built-in display name when set. */
    label: text("label"),
    enabled: boolean("enabled").notNull().default(true),
    /** Lower sorts first; equal values fall back to alphabetical. */
    sortOrder: integer("sort_order").notNull().default(0),
    /** True for entries an admin created that have no built-in counterpart. */
    custom: boolean("custom").notNull().default(false),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("taxonomy_entries_kind_code_unique").on(t.kind, t.code)],
);

// ---------------------------------------------------------------- feedback ---

/*
 * The tag lists live in `lib/feedback-options.ts` and are re-exported here.
 *
 * They are read by a client component, and this module imports the ORM — one
 * `import { THERAPIST_TAGS } from "@/lib/db/schema"` in a form is drizzle in
 * the browser bundle.
 */
export { SERVICE_TAGS, THERAPIST_TAGS } from "@/lib/feedback-options";

/**
 * One patient's verdict on one session.
 *
 * The report is the incentive, and the design is deliberate: a patient
 * completes this to receive their brief, so the response rate is close to
 * total rather than the eight percent a "how did we do?" email gets. It also
 * means the email address arrives at the moment somebody actually wants to
 * give it, rather than being demanded before they have had any help.
 *
 * Two ratings, kept apart. "The therapist was excellent, the app kept
 * freezing" is one of the most useful things anyone can tell us and a single
 * star rating destroys it.
 */
export const sessionFeedback = pgTable(
  "session_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * Null until the session is over.
     *
     * The row is created the moment the patient walks in and rates *us* —
     * "how easy was it to find someone" — and completed when they rate the
     * session afterwards. One row, two moments.
     */
    therapistStars: integer("therapist_stars"),
    /** Was the half hour any use — separate from whether the person was right. */
    sessionStars: integer("session_stars"),
    /** The app itself. Asked on arrival, before the session can colour it. */
    serviceStars: integer("service_stars").notNull(),
    /** When they rated us on the way in, if they did. */
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    therapistTags: jsonb("therapist_tags").$type<string[]>().default([]).notNull(),
    serviceTags: jsonb("service_tags").$type<string[]>().default([]).notNull(),
    /** Shown to the clinician without a name attached. */
    comment: text("comment"),

    /** Where the brief went. Also becomes the patient record's address. */
    patientEmail: text("patient_email"),
    briefSentAt: timestamp("brief_sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("session_feedback_session_unique").on(t.sessionId),
    index("session_feedback_therapist_idx").on(t.therapistId, t.createdAt),
  ],
);

export const REPORT_KINDS = ["no_show", "abuse", "other"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/**
 * A patient telling us something went wrong.
 *
 * Separate from feedback because it has a lifecycle: somebody reads it, decides
 * something, and the decision is recorded. A one-star review is data; "he did
 * not turn up and I paid" is a refund and a suspension.
 */
export const sessionReports = pgTable(
  "session_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    kind: text("kind").$type<ReportKind>().notNull(),
    detail: text("detail"),
    patientEmail: text("patient_email"),

    status: text("status")
      .$type<"open" | "actioned" | "dismissed">()
      .notNull()
      .default("open"),
    resolution: text("resolution"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("session_reports_status_idx").on(t.status, t.createdAt),
    index("session_reports_therapist_idx").on(t.therapistId),
  ],
);

// ------------------------------------------------------------------- radar ---

export const RADAR_STATUSES = ["offline", "online", "pending", "in_session"] as const;
export type RadarStatus = (typeof RADAR_STATUSES)[number];

/**
 * Crisis Radar: which clinicians are available *right now*.
 *
 * The whole feature turns on one invariant — two patients must never book the
 * same therapist. That is enforced by a single conditional UPDATE against
 * `status` (see `claimTherapist`), not by reading the row and then writing it.
 * A read-then-write here is a double-booking under any real concurrency, and a
 * double-booked crisis slot is the worst failure this product could have.
 *
 * `pendingUntil` makes the claim self-healing: a patient who closes the Stripe
 * tab and never comes back releases the clinician automatically, because an
 * expired pending is treated as claimable by the same UPDATE that claims it.
 */
export const therapistRadar = pgTable(
  "therapist_radar",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    status: text("status").$type<RadarStatus>().notNull().default("offline"),

    /** Public profile. Nothing here is PHI — it is the clinician's own shopfront. */
    headline: text("headline"),
    photoUrl: text("photo_url"),
    languages: jsonb("languages").$type<string[]>().default([]).notNull(),
    specialties: jsonb("specialties").$type<string[]>().default([]).notNull(),
    /** ISO-3166 alpha-2. Where they practise, and how the map places them. */
    country: text("country"),
    /**
     * State, province, governorate — whatever the country calls its first-level
     * division. Free text, taken from the geocoder rather than a picker,
     * because a hand-maintained region list for ninety countries is a promise
     * nobody keeps. It is used to group and filter, never to route anything.
     */
    region: text("region"),
    city: text("city"),

    /**
     * A physical practice, and whether people may turn up to it.
     *
     * Off by default and separate from `status`: a clinician being available
     * online this minute says nothing about whether their door is open, and
     * conflating the two would send someone in distress to a locked building.
     *
     * The address is public the moment `acceptsWalkIns` is on — that is the
     * whole point of it — so it is a business address by definition. The
     * consent copy on the form says so in those words.
     */
    practiceName: text("practice_name"),
    practiceAddress: text("practice_address"),
    /** Confirmed by the clinician against a map, not trusted from a geocoder. */
    practiceLat: text("practice_lat"),
    practiceLon: text("practice_lon"),
    practiceConfirmedAt: timestamp("practice_confirmed_at", { withTimezone: true }),
    acceptsWalkIns: boolean("accepts_walk_ins").notNull().default(false),

    /**
     * The claim. Both are set and cleared together, by one statement.
     *
     * `pending` covers two different things, distinguished by whether there is
     * a session attached:
     *   - `pendingSessionId IS NULL` — someone has the booking sheet *open*.
     *     A sixty-second viewing reservation.
     *   - `pendingSessionId` set — they submitted, and this is a real booking
     *     working its way through checkout.
     */
    pendingSessionId: uuid("pending_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    pendingUntil: timestamp("pending_until", { withTimezone: true }),
    /**
     * Who holds the reservation — a hash of a random id the visitor's browser
     * generated.
     *
     * This exists because of a real and quite bad bug: the clinician went
     * `pending` the moment anyone started booking, and the *person doing the
     * booking* then saw "someone is booking them" and lost the form. The lock
     * has to know who it belongs to, or it locks out the one person it should
     * be letting through.
     *
     * Not a security token. Anyone who knew someone else's id could use it,
     * and the consequence is only that they take a reservation they would have
     * been able to take a minute later anyway — the atomic claim still
     * serialises the actual booking.
     */
    reservedBy: text("reserved_by"),

    /**
     * Heartbeat. A closed laptop must not leave someone advertised as available
     * to a person in crisis, so "online" expires rather than persisting.
     */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),

    /**
     * A seeded account for demonstrations.
     *
     * Exempt from the heartbeat expiry, because nobody is holding a browser
     * open for them — and that exemption is the entire reason this column
     * exists rather than a convention. It is set by `scripts/demo.ts` and by
     * nothing else; the admin radar counts them separately and says so, so
     * that "twelve clinicians online" can never quietly mean twelve fixtures.
     */
    demo: boolean("demo").notNull().default(false),

    /**
     * Forced off the radar by an administrator until this moment.
     *
     * Separate from `status` because it must survive the clinician toggling
     * themselves back on — a ban that a tap can clear is not a ban.
     */
    suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
    /** Null when the suspension is indefinite, pending an admin release. */
    suspendedReason: text("suspended_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("therapist_radar_user_unique").on(t.userId),
    index("therapist_radar_status_idx").on(t.status, t.lastSeenAt),
    index("therapist_radar_place_idx").on(t.country, t.region),
  ],
);

// ------------------------------------------------------------------- usage ---

/** Metadata only. Never store prompts or completions — they are transcripts. */
export const aiRequestLogs = pgTable(
  "ai_request_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    /**
     * Every kind of model call we make.
     *
     * Widened past the original four because the union was quietly incomplete:
     * the patient-facing copilot, the note translation pass and speech
     * synthesis all logged as something they were not, which made a
     * per-therapist cost breakdown wrong in a way no total would reveal.
     */
    kind: text("kind")
      .$type<"transcribe" | "note" | "risk" | "copilot" | "patient_copilot" | "translate" | "speech" | "diarise">()
      .notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    audioSeconds: integer("audio_seconds").notNull().default(0),
    /**
     * Kept, and no longer the number anything reads.
     *
     * Rounding every cost into whole cents recorded zero for 91% of calls —
     * a transcription chunk is 0.15 cents and a mini copilot call is 0.014.
     * See `costMicrocents`.
     */
    costCents: integer("cost_cents").notNull().default(0),
    /**
     * A thousandth of a cent, as an integer.
     *
     * The smallest thing we pay for is a few hundredths of a cent, so cents
     * cannot hold it and a float would reintroduce the same bug more quietly.
     * Everything that reports spend reads this.
     */
    costMicrocents: bigint("cost_microcents", { mode: "number" }).notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    status: text("status").$type<"success" | "error">().notNull(),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ai_request_logs_org_idx").on(t.organizationId, t.createdAt),
    index("ai_request_logs_session_idx").on(t.sessionId),
    index("ai_request_logs_kind_idx").on(t.kind, t.createdAt),
  ],
);

// ----------------------------------------------------------------- billing ---

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    plan: text("plan").$type<PlanKey>().notNull().default("payg"),
    status: text("status")
      .$type<"active" | "past_due" | "cancelled">()
      .notNull()
      .default("active"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /** PAYG: the first completed session is free, once, per organization. */
    trialSessionUsed: boolean("trial_session_used").notNull().default(false),
    /** Admin-granted credit applied to the next subscription invoice. */
    upcomingDiscountCents: integer("upcoming_discount_cents").notNull().default(0),
    upcomingDiscountReason: text("upcoming_discount_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("subscriptions_org_unique").on(t.organizationId)],
);

export const INVOICE_KINDS = ["session", "subscription"] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export const INVOICE_STATUSES = ["waived", "included", "due", "paid", "failed", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Every bill, of every kind, in one table.
 *
 * The previous model had `session_charges` for metered sessions and nothing at
 * all for subscription payments — so a therapist who paid $99 saw no record of
 * it anywhere. Two tables for "money the customer owes us" is also how the
 * ledger and the dashboard drift apart, which is exactly what must not happen
 * to the figure quoted to an investor.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").$type<InvoiceKind>().notNull(),
    /** Set for metered session bills, null for subscription periods. */
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }),

    amountCents: integer("amount_cents").notNull(),
    /** Applied by an admin. Never negative, never more than the amount. */
    discountCents: integer("discount_cents").notNull().default(0),
    discountReason: text("discount_reason"),
    discountedBy: uuid("discounted_by").references(() => users.id, { onDelete: "set null" }),

    status: text("status").$type<InvoiceStatus>().notNull(),
    description: text("description").notNull(),

    /**
     * Several invoices can share one checkout when the therapist pays a batch,
     * so the webhook settles them by looking them up on this column rather than
     * cramming a list of ids into Stripe metadata.
     */
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),

    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    // One bill per session. The reconciler cron and a live completion race each
    // other; with this plus ON CONFLICT DO NOTHING the race is a no-op rather
    // than a double charge.
    uniqueIndex("invoices_session_unique").on(t.sessionId),
    index("invoices_org_idx").on(t.organizationId, t.issuedAt),
    index("invoices_status_idx").on(t.status),
    index("invoices_checkout_idx").on(t.stripeCheckoutSessionId),
  ],
);

/**
 * Where a session came from.
 *
 *   direct     a link the clinician sent, free to join
 *   paid_link  a link the clinician sent, with a price on it
 *   radar      a stranger found them on the live map
 *   scheduled  booked ahead against an availability slot (sprint 11)
 */
export const SESSION_TYPES = ["direct", "paid_link", "radar", "scheduled"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "refunded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Money a *patient* paid a *therapist*, and the cut we took for facilitating it.
 *
 * Deliberately a separate table from `invoices`. An invoice is what a therapist
 * owes 24Therapy; this is what a patient paid a therapist. Merging the two
 * would make "revenue" a query nobody can write correctly — the gross here is
 * not ours, only `platform_fee_cents` is.
 *
 * Amounts are frozen at charge time rather than recomputed from the fee rate,
 * so changing the platform rate tomorrow cannot rewrite last month's ledger.
 */
export const sessionPayments = pgTable(
  "session_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),

    /** Who paid — captured before a patient record may exist. */
    payerName: text("payer_name"),
    payerEmail: text("payer_email"),

    /*
     * The money, in two currencies, and the difference matters.
     *
     * ## Settlement vs presentment
     *
     * `grossCents` and everything derived from it stay in the **settlement**
     * currency — what the therapist's price is denominated in, what Stripe
     * charges, what the ledger balances in. `presented*` is what the patient
     * actually saw and paid in their own currency.
     *
     * Keeping both is not redundancy. A refund is issued in the settlement
     * currency; a dispute is argued about the presented one; and the rate
     * between them was a fact about one hour on one day. Re-deriving either
     * from the other later means re-deriving a rate that has since moved.
     *
     * Every pre-sprint-4 row is `usd` with no VAT, which is exactly what those
     * payments were.
     */
    grossCents: integer("gross_cents").notNull(),
    /** ISO 4217, lowercase. The currency the therapist is paid in. */
    currency: text("currency").notNull().default("usd"),

    /*
     * VAT, which the patient pays **on top** and which is never ours.
     *
     * §3: "the patient pays it, on top of everything", and on a refund "our cut
     * is refunded, VAT is not" — because it was remitted to a government that
     * is not giving it back because a session was cancelled. Storing the rate
     * beside the amount means an audit can check the arithmetic without knowing
     * what `country_settings` said that month.
     */
    vatCents: integer("vat_cents").notNull().default(0),
    /** The rate applied, in basis points. Egypt is 1400. */
    vatBps: integer("vat_bps").notNull().default(0),
    /** The country whose VAT rule was applied — the patient's, not ours. */
    payerCountry: text("payer_country"),

    /** What the patient was shown, in their own currency. Null when the same. */
    presentedCents: integer("presented_cents"),
    presentedCurrency: text("presented_currency"),
    /**
     * Units of presented currency per unit of settlement currency, x1e6.
     *
     * An integer rather than a float, for the reason every other amount here is
     * an integer: a rate that rounds differently in two places produces two
     * different totals for one payment. 1e6 holds enough precision for a
     * currency like EGP at ~48/USD without ever needing a decimal.
     */
    fxRateMicro: integer("fx_rate_micro"),
    /** When the rate was quoted. §3/4.4: a quote is good for one hour. */
    fxQuotedAt: timestamp("fx_quoted_at", { withTimezone: true }),

    /** Our application fee: the platform cut plus anything settled below. */
    platformFeeCents: integer("platform_fee_cents").notNull(),
    /** The cut rate at the moment of payment, in basis points. */
    platformFeeBps: integer("platform_fee_bps").notNull().default(0),
    /** Of the fee, the part that cleared the therapist's own 24Therapy bills. */
    settledInvoiceCents: integer("settled_invoice_cents").notNull().default(0),
    /** Gross minus the application fee — what reaches the therapist's account. */
    therapistNetCents: integer("therapist_net_cents").notNull(),

    /**
     * Where the money landed.
     *
     * `destination` is the ordinary case: a destination charge straight into
     * the clinician's own connected account, our cut taken as an application
     * fee, Stripe owning the payout. `platform` means the clinician was not yet
     * transfer-capable when the patient paid, so we took the charge ourselves
     * and are holding their share — see `lib/billing/ledger.ts`.
     *
     * Recorded per payment rather than read off the account, because the
     * account's capabilities change and last month's payment did not.
     */
    capture: text("capture").$type<"destination" | "platform">().notNull().default("destination"),

    status: text("status").$type<PaymentStatus>().notNull().default("pending"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),

    /**
     * How they paid, for the patient's own record and for a dispute.
     *
     * Brand and last four only — never a token, never a fingerprint, never
     * anything that could be used to charge the card again. A clinician looking
     * at "Visa ·1234, 14 March" can answer a patient's question without us
     * storing a payment credential to do it.
     */
    paymentBrand: text("payment_brand"),
    paymentLast4: text("payment_last4"),
    /** Stripe's own hosted receipt. We do not host a copy of it. */
    receiptUrl: text("receipt_url"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    // One live payment attempt per session. A patient double-tapping Pay must
    // not produce two charges for one seat.
    uniqueIndex("session_payments_session_unique").on(t.sessionId),
    index("session_payments_therapist_idx").on(t.therapistId, t.createdAt),
    index("session_payments_checkout_idx").on(t.stripeCheckoutSessionId),
    index("session_payments_status_idx").on(t.status, t.paidAt),
  ],
);

/** What is actually payable after any admin discount. */
export function payableCents(invoice: { amountCents: number; discountCents: number }): number {
  return Math.max(0, invoice.amountCents - invoice.discountCents);
}

/* ------------------------------------------------------------------ ledger -- */

/**
 * The five accounts every movement of money touches.
 *
 * `invoices` and `session_payments` answer "what happened to this session".
 * Neither answers "how much of the money in our Stripe balance is ours" — and
 * the moment we can take a payment for a clinician who has not finished
 * onboarding, that question has a real answer that is not zero and somebody
 * will eventually have to defend it.
 *
 *   cash                  asset      what we actually hold
 *   therapist_payable     liability  the part of it that belongs to a clinician
 *   therapist_receivable  asset      what a clinician owes 24Therapy
 *   platform_revenue      revenue    our fee, and the subscription and
 *                                    per-session charges
 *   platform_expense      expense    fees given back, and anything written off
 */
export const LEDGER_ACCOUNTS = [
  "cash",
  "therapist_payable",
  "therapist_receivable",
  "platform_revenue",
  "platform_expense",
] as const;
export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[number];

export const LEDGER_TXN_KINDS = [
  "session_payment",
  "session_refund",
  "invoice_raised",
  "invoice_settled",
  "invoice_written_off",
  "earnings_transfer",
  "adjustment",
] as const;
export type LedgerTxnKind = (typeof LEDGER_TXN_KINDS)[number];

/**
 * Double-entry, one leg per row.
 *
 * ## The sign convention, stated once
 *
 * `amountCents` is signed, positive is a debit, and **the legs of one `txnId`
 * always sum to exactly zero**. That single rule is what makes the table worth
 * having: a balance is a `SUM`, a reconciliation is a `GROUP BY txn_id HAVING
 * SUM(...) <> 0`, and a bug that loses money shows up as a number rather than
 * as a missing row nobody thinks to look for.
 *
 * Assets and expenses rise with a positive amount; liabilities and revenue rise
 * with a negative one. So money we hold *for* a clinician accumulates as a
 * growing negative on `therapist_payable`, and `heldForTherapist` negates it
 * rather than asking every caller to remember which way round it goes.
 *
 * ## Why this is not derived from the other two tables
 *
 * It could have been, right up until the platform started taking charges on its
 * own account for clinicians Stripe has not verified yet. That money is ours to
 * hold and not ours to keep, it sits in one balance with our own revenue, and
 * "reconstruct it from a join over invoices and payments" is the kind of
 * derivation that is correct until the first refund.
 *
 * ## Append-only
 *
 * Nothing here is ever updated or deleted. A mistake is corrected by posting
 * the reversing transaction, which is also what leaves the mistake visible.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Groups the legs of one movement. Legs of a txn sum to zero. */
    txnId: uuid("txn_id").notNull(),
    txnKind: text("txn_kind").$type<LedgerTxnKind>().notNull(),
    account: text("account").$type<LedgerAccount>().notNull(),

    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    /** The clinician whose sub-ledger this leg belongs to, where there is one. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),

    /** What this leg is about: a session payment, an invoice, a transfer. */
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    /** Written for a person reading the ledger, not for a machine. */
    memo: text("memo").notNull(),
    /** Set only when a human caused it — an admin adjustment or write-off. */
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ledger_txn_idx").on(t.txnId),
    index("ledger_account_idx").on(t.account, t.createdAt),
    index("ledger_user_idx").on(t.userId, t.account),
    index("ledger_org_idx").on(t.organizationId, t.createdAt),
    index("ledger_ref_idx").on(t.refType, t.refId),
  ],
);

export type LedgerEntry = typeof ledgerEntries.$inferSelect;

/**
 * Money moved out to a clinician who could not be paid at the time they earned
 * it.
 *
 * A destination charge needs no row here — Stripe routed the money at the
 * moment the patient paid and there is nothing for us to remember. This exists
 * for the other case: a clinician set a price and took bookings before Stripe
 * finished verifying them, we captured the payment ourselves, and the money has
 * been sitting in our balance with their name on it ever since. Each row is one
 * release of that.
 */
export const earningsTransfers = pgTable(
  "earnings_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    status: text("status")
      .$type<"pending" | "paid" | "failed">()
      .notNull()
      .default("pending"),
    stripeTransferId: text("stripe_transfer_id"),
    stripeAccountId: text("stripe_account_id"),
    failureReason: text("failure_reason"),
    /** Null when the platform released it automatically. */
    releasedBy: uuid("released_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("earnings_transfers_therapist_idx").on(t.therapistId, t.createdAt),
    uniqueIndex("earnings_transfers_stripe_unique").on(t.stripeTransferId),
  ],
);

export type EarningsTransfer = typeof earningsTransfers.$inferSelect;

// -------------------------------------------------------------- throttling ---

/**
 * Rate limits, in Postgres.
 *
 * Not in memory: this runs on serverless, so an in-process counter is per
 * instance and a bucket that resets whenever a lambda is recycled is not a
 * rate limit, it is a decoration. Not in Redis either — one more service to
 * run, pay for and have go down, for a table that does one atomic UPSERT.
 *
 * `note` carries a small payload for limits that are really *holds* rather than
 * counters, notably "this address already has a radar booking in flight".
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    /** `scope:subject`, where the subject is hashed — never a raw IP. */
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
    /** Only for the sweeper; expiry is decided by `windowStart` at read time. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_expires_idx").on(t.expiresAt)],
);

/** Stripe redelivers webhooks. Without this table, so do the side effects. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------- platform ---

export const AUDIT_CATEGORIES = [
  "phi_access",
  "auth",
  "admin",
  "billing",
  "break_glass",
  /**
   * What a clinician did, as distinct from what they read.
   *
   * `phi_access` answers "who looked at this chart", which is the question a
   * privacy regulator asks. It does not answer "what happened in the product",
   * which is the question an operator, a support agent or a court asks — and
   * that question had no answer at all: starting a session, ending one,
   * approving a note, pausing a recording and going on the radar were all
   * unrecorded.
   *
   * One trail rather than a second table. Two audit logs means two places to
   * look and two chances for the answer to be in the other one.
   */
  "clinical",
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/**
 * One append-only log. Replaces audit_log + phi_access_log + break_glass_access
 * + platform_events. `patientId` is nullable — a NOT NULL there is what made
 * the old audit writes fail silently on non-patient-scoped routes.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    /**
     * The patient who did it. PLAN.md 7.6.
     *
     * A second nullable actor column rather than a shared one, because the two
     * ids point at different tables and a single column could not carry a
     * foreign key to either. Exactly one of the two is set on any row: a
     * clinician read, or a person granting, rejecting or revoking their own
     * history. Collapsing them would make "who revoked this?" answerable only
     * by guessing which table to look in.
     */
    actorAccountId: uuid("actor_account_id").references(() => patientAccounts.id, {
      onDelete: "set null",
    }),
    category: text("category").$type<AuditCategory>().notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: uuid("resource_id"),
    patientId: uuid("patient_id"),
    reason: text("reason"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_org_idx").on(t.organizationId, t.createdAt),
    index("audit_log_patient_idx").on(t.patientId, t.createdAt),
    index("audit_log_category_idx").on(t.category, t.createdAt),
    // The retention purge filters on this. It previously named a column that
    // did not exist and swallowed the error, so it never deleted a single row.
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"crisis" | "billing" | "system">().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionUrl: text("action_url"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** Icons an admin may choose. An allowlist, not a free string. */
export const CONTENT_ICONS = [
  "sparkles", "mic", "fileText", "shield", "heart", "clock", "users", "video",
  "lock", "zap", "check", "brain", "phone", "mail", "chart", "alert",
] as const;
export type ContentIcon = (typeof CONTENT_ICONS)[number];

/** Which real product component to render beside a value. */
export const CONTENT_DEMOS = ["transcript", "note", "risk", "copilot", "none"] as const;
export type ContentDemo = (typeof CONTENT_DEMOS)[number];

export type ContentBlock =
  | {
      type: "hero";
      eyebrow?: string;
      heading: string;
      body?: string;
      ctaLabel?: string;
      ctaHref?: string;
      demo?: "session-room" | "radar" | "note" | "none";
      icon?: ContentIcon;
      /** Absolute https:// image URL, or empty for the default gradient. */
      backgroundImage?: string;
    }
  | { type: "prose"; heading?: string; body: string; icon?: ContentIcon }
  | {
      type: "features";
      heading?: string;
      items: { title: string; body: string; icon?: ContentIcon }[];
    }
  | {
      /**
       * One value at a time, each paired with the real product component that
       * demonstrates it — the transcript panel beside the transcription claim,
       * the note card beside the note claim.
       */
      type: "showcase";
      heading?: string;
      items: { title: string; body: string; icon?: ContentIcon; demo?: ContentDemo }[];
    }
  | { type: "faq"; heading?: string; items: { q: string; a: string }[] }
  | {
      type: "cta";
      heading: string;
      body?: string;
      ctaLabel: string;
      ctaHref: string;
      backgroundImage?: string;
    };

/**
 * CMS. Content is structured blocks, never raw HTML — an admin-authored
 * `dangerouslySetInnerHTML` on the public origin is a stored-XSS hole straight
 * into the session cookie.
 */
export const contentPages = pgTable(
  "content_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    /**
     * Which language this row is written in.
     *
     * A page used to be unique on slug alone, which quietly made the entire
     * public site English-only at the database level — interface translation
     * never reaches it, because these words are rows rather than strings.
     */
    locale: text("locale").notNull().default("en"),
    title: text("title").notNull(),
    description: text("description"),
    blocks: jsonb("blocks").$type<ContentBlock[]>().default([]).notNull(),
    status: text("status").$type<"draft" | "published">().notNull().default("draft"),
    /** Legal pages render in a document layout; marketing pages do not. */
    layout: text("layout").$type<"marketing" | "document">().notNull().default("marketing"),
    navLabel: text("nav_label"),
    navOrder: integer("nav_order"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("content_pages_slug_locale_unique").on(t.slug, t.locale)],
);

/**
 * Server errors, kept where somebody will actually look at them.
 *
 * In our own database rather than a third-party drain, and that is the whole
 * design decision. An error thrown while writing a note can carry a patient's
 * words in a stack frame; shipping that to a vendor is a disclosure, and one
 * nobody consented to. Here it sits under the same access control, the same
 * audit log and the same retention rules as the record it came from.
 *
 * Nothing is written without going through `recordError`, which drops the
 * request body, the query string and every path segment that could be an
 * identifier first.
 */
export const errorEvents = pgTable(
  "error_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Route plus the top of the stack, hashed.
     *
     * What turns four thousand rows into nine problems. Deliberately not the
     * message: messages interpolate ids and values, which would split a single
     * bug into hundreds of groups and hide the fact that it is one bug.
     */
    fingerprint: text("fingerprint").notNull(),
    route: text("route").notNull(),
    method: text("method"),
    kind: text("kind").$type<"server" | "client">().notNull().default("server"),
    message: text("message").notNull(),
    stack: text("stack"),
    /** Next's own error digest, so a user-reported code can be looked up. */
    digest: text("digest"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("error_events_created_idx").on(table.createdAt),
    index("error_events_fingerprint_idx").on(table.fingerprint),
  ],
);

/* ---------------------------------------------------------------- settings -- */

/**
 * Every price, rate, limit and cap, out of the code and into a row.
 *
 * One row per *group* (`pricing`, `session`, `clock`, `copilot`) holding a
 * jsonb object, rather than a column per figure. The trade is deliberate:
 * adding a setting in a later sprint becomes a seed instead of a migration,
 * and the cost — that Postgres cannot type-check the contents — is paid back
 * by `parseGroup` in `lib/settings/defs.ts`, which validates field by field and
 * falls back per field rather than per group.
 *
 * `updatedBy` is a user id and not an organisation: changing a platform rate is
 * an act by a named admin, and §6 requires it be attributable. The audit log
 * carries the before and after; this column carries the last hand on it.
 */
export const platformSettings = pgTable("platform_settings", {
  /** One of `SETTINGS_GROUPS`. */
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * VAT, currency and payment methods, per country.
 *
 * A country with no row here is not "a country with 0% VAT" — it is a country
 * we cannot yet price a session in, and the accessor refuses rather than
 * guessing. Under-collecting a tax is a debt somebody discovers later; charging
 * a patient for a tax that does not exist is worse.
 */
export const countrySettings = pgTable("country_settings", {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  /** Basis points. Egypt is 1400. */
  vatBps: integer("vat_bps").notNull().default(0),
  /** ISO 4217, lowercase, as Stripe wants it. */
  currency: text("currency").notNull(),
  paymentMethods: jsonb("payment_methods").$type<string[]>().notNull().default([]),
  /** A country switched off stops accepting new paid sessions immediately. */
  enabled: boolean("enabled").notNull().default(true),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type CountrySetting = typeof countrySettings.$inferSelect;
export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type SessionNote = typeof sessionNotes.$inferSelect;
export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type ContentPage = typeof contentPages.$inferSelect;
export type CopilotThread = typeof copilotThreads.$inferSelect;
export type CopilotMessage = typeof copilotMessages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SessionPayment = typeof sessionPayments.$inferSelect;
export type TherapistRadar = typeof therapistRadar.$inferSelect;
export type RateLimit = typeof rateLimits.$inferSelect;
export type TherapistVerification = typeof therapistVerifications.$inferSelect;
export type SessionFeedback = typeof sessionFeedback.$inferSelect;
export type SessionReport = typeof sessionReports.$inferSelect;
export type ErrorEvent = typeof errorEvents.$inferSelect;

/* ----------------------------------------------------------- credits -- */

export const CREDIT_STATUSES = ["pending", "active", "void"] as const;
export type CreditStatus = (typeof CREDIT_STATUSES)[number];

/**
 * Sessions bought in advance, at the rate the quantity earned.
 *
 * One row per purchase, never one row per credit: a therapist buying thirty
 * sessions is one commercial event with one expiry and one price, and thirty
 * rows would make "what did they actually pay" a SUM that a partial refund
 * silently corrupts.
 *
 * `rateCents` is copied in rather than looked up. The rate is a fact about the
 * moment of purchase and `platform_settings` is mutable by design — an admin
 * lowering the Growth rate next March must not retroactively change what
 * somebody paid last week, and the earnings page reads this column precisely so
 * that it cannot.
 *
 * Consumption is `consumed` on the row rather than a join to sessions, and it
 * moves only through the conditional UPDATE in `consumeCredit`, which cannot
 * take a credit that is not there. A read-then-write here is two simultaneous
 * session completions both spending the last credit.
 */
export const sessionCredits = pgTable(
  "session_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** The tier key from `platform_settings.pricing`, as bought. */
    tierKey: text("tier_key").notNull(),
    /** The per-session rate at the moment of purchase. Never re-read. */
    rateCents: integer("rate_cents").notNull(),
    quantity: integer("quantity").notNull(),
    consumed: integer("consumed").notNull().default(0),

    /** Purchase time plus `pricing.creditExpiryMonths`. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    status: text("status").$type<CreditStatus>().notNull().default("pending"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // The consumption order: soonest to expire, oldest first. Indexed because
    // it runs on every completed session.
    index("session_credits_spend_idx").on(t.organizationId, t.status, t.expiresAt),
    uniqueIndex("session_credits_checkout_idx").on(t.stripeCheckoutSessionId),
  ],
);

export type SessionCredit = typeof sessionCredits.$inferSelect;

/* --------------------------------------------------------------- fx quotes -- */

/**
 * An exchange rate, frozen for an hour.
 *
 * PLAN.md 4.4. A patient who is shown "1,440 EGP" and then charged a different
 * number because the market moved between the page and the card form has been
 * quoted a price we did not honour — and in a product where the patient is
 * often in crisis, that is not a rounding complaint.
 *
 * So a quote is a row: a pair, a rate, and an expiry. `getQuote` reuses a live
 * one rather than asking again, which also means the rate a patient sees on the
 * pay page is provably the rate their payment is created with — the payment
 * stores the quote's own figures rather than re-fetching.
 *
 * Rates are not money and are not owed to anyone, so a stale row is garbage
 * rather than history: nothing here is append-only and old rows can be deleted
 * freely.
 */
export const fxQuotes = pgTable(
  "fx_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** ISO 4217 lowercase, e.g. "usd". */
    baseCurrency: text("base_currency").notNull(),
    quoteCurrency: text("quote_currency").notNull(),
    /** Units of quote per unit of base, x1e6. See `fx_rate_micro`. */
    rateMicro: integer("rate_micro").notNull(),
    /** Where it came from, so a wrong rate can be traced to a provider. */
    source: text("source").notNull().default("static"),
    quotedAt: timestamp("quoted_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    // The lookup: the newest live quote for a pair.
    index("fx_quotes_pair_idx").on(t.baseCurrency, t.quoteCurrency, t.expiresAt),
  ],
);

export type FxQuote = typeof fxQuotes.$inferSelect;

/* ------------------------------------------------------------------ people -- */

/**
 * A person, above the clinic that first wrote them down.
 *
 * ## What this changes
 *
 * `patients` is a row inside one practice: it has an `organization_id`, a
 * `therapist_id`, and it is the therapist's file about somebody. That is the
 * right shape for a paper drawer and the wrong shape for a person who sees two
 * clinicians, moves cities, or wants their own history. `people` is the person;
 * `patients.person_id` points at them.
 *
 * Deliberately nullable at first (5.1). Every existing patient gets its own
 * person in the backfill, and nothing is forced to have one before it does —
 * a NOT NULL added on the same migration as the backfill is a migration that
 * fails halfway and leaves the table locked.
 *
 * ## Claimed and unclaimed
 *
 * `claimed_at IS NULL` is the normal state, not the edge case: measured on this
 * database, **56 of 66 patients have no email and none has a phone number**, so
 * most of these people have no way to be contacted and will never claim
 * anything. §3 is explicit that this is a valid ending — an unclaimed record
 * stays a private file, and the product must not treat it as a queue to drain.
 *
 * Everything that can leak follows from that one column. An unclaimed person
 * cannot be shared, granted or merged, because there is nobody to ask — see
 * `assertClaimed` in `lib/data/people.ts`, which is the single gate sprint 7's
 * grants go through.
 *
 * ## Why the unique index is partial
 *
 * One *claimed* person per email. Unclaimed rows are deliberately free to
 * collide, because they are not identities — they are what three different
 * clinicians happened to type. Measured here: `omarabdelgawad001@gmail.com`
 * appears on two patients named "Omar" and "Sam" in two organisations. A unique
 * constraint over all rows would have refused that backfill; auto-merging them
 * would have put one person's record in another's file.
 */
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    /** Lowercased on write. Null is the common case. */
    email: text("email"),
    /** Digits and a leading +, normalised on write. Null is the common case. */
    phone: text("phone"),

    /**
     * When this person took ownership of their own record. Null means nobody
     * has, which is most of them.
     */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    /**
     * The patient account that claimed it.
     *
     * Points at `patient_accounts`, not `users` — a patient is not a member of
     * an organisation and never becomes one. See the note on `patientAccounts`.
     */
    claimedByAccountId: uuid("claimed_by_account_id"),

    /*
     * Where they pay from, remembered (C36 / PLAN.md 4.3).
     *
     * On the person rather than on `patients`, because a preference belongs to
     * whoever is paying and travels with them between clinicians. The *payment*
     * still records the country it was actually made under — that is history
     * and never moves.
     */
    preferredCountry: text("preferred_country"),
    preferredCurrency: text("preferred_currency"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // One claimed identity per email, and per phone. Unclaimed rows collide
    // freely — see the note above.
    uniqueIndex("people_claimed_email_unique")
      .on(t.email)
      .where(sql`${t.claimedAt} IS NOT NULL AND ${t.email} IS NOT NULL`),
    uniqueIndex("people_claimed_phone_unique")
      .on(t.phone)
      .where(sql`${t.claimedAt} IS NOT NULL AND ${t.phone} IS NOT NULL`),
    // The matcher reads these. Both are suggestions only.
    index("people_email_idx").on(t.email),
    index("people_phone_idx").on(t.phone),
  ],
);

export type Person = typeof people.$inferSelect;

/* -------------------------------------------------------- patient accounts -- */

/**
 * A patient's own login. **A separate table, not a nullable `organizationId`.**
 *
 * ## Why not `users`
 *
 * PLAN.md 6.2 is emphatic and it is right: `users_org_email_unique` is a unique
 * index on `(organization_id, email)`, and Postgres treats NULLs as distinct.
 * Putting patients in `users` with a null organisation means that index
 * constrains nothing for them — one email, unlimited signups, silently.
 *
 * ## Why this also settles 6.3
 *
 * 6.3 asks for `Actor.organizationId` to become `string | null` and for every
 * consumer to be audited: 32 direct reads across 52 files that call
 * `requireUser`. That work follows from patients flowing through the *same*
 * actor — and with a separate identity they do not.
 *
 * Leaving `Actor.organizationId` non-null is the safer answer, not merely the
 * cheaper one. Making it nullable would put a nullable value into 192
 * `.organizationId` reads, every one of which is a tenancy filter; a
 * `where organization_id = NULL` matches no rows if you are lucky and is a
 * missing filter if you are not. A therapist actor and a patient actor are
 * different kinds of thing, and the type system should say so.
 *
 * See C41.
 *
 * ## What a patient account is not
 *
 * It is not a member of an organisation and never becomes one. It owns a
 * `person`, and everything it can read is reached through that person and the
 * grants in sprint 7 — never through an org.
 */
export const patientAccounts = pgTable(
  "patient_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The person this login owns. One account per person, one person per account. */
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),

    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** Null until they follow the link. Nothing is shared before this. */
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /** §3 step 5: verification by email **or** WhatsApp. */
    phone: text("phone"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // One account per email — and unlike `users`, no organisation to make the
    // constraint conditional on. This is the index 6.2 exists to protect.
    uniqueIndex("patient_accounts_email_unique")
      .on(t.email)
      .where(sql`deleted_at IS NULL`),
    uniqueIndex("patient_accounts_person_unique")
      .on(t.personId)
      .where(sql`deleted_at IS NULL`),
  ],
);

/**
 * Patient sessions, mirroring `auth_sessions` rather than sharing it.
 *
 * Sharing one table would need a nullable `user_id` and a nullable
 * `patient_account_id` with a check constraint that exactly one is set — which
 * is the same nullable-column bug as 6.2, one table down. Two tables cost a
 * few lines and make "whose session is this" unanswerable-by-accident
 * impossible.
 */
export const patientAuthSessions = pgTable(
  "patient_auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientAccountId: uuid("patient_account_id")
      .notNull()
      .references(() => patientAccounts.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("patient_auth_sessions_token_hash_unique").on(t.tokenHash),
    index("patient_auth_sessions_account_idx").on(t.patientAccountId),
  ],
);

export const CLAIM_STATUSES = ["pending", "verified", "rejected", "expired"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_ROUTES = ["match", "invite"] as const;
export type ClaimRoute = (typeof CLAIM_ROUTES)[number];

/**
 * One attempt by one account to claim one person. §3's eight steps, as a row.
 *
 * ## Why it is a row rather than a flag on `people`
 *
 * Because a claim can fail, and because §3 says a first-time signup may match
 * several unclaimed profiles — "same flow, one at a time". A flag cannot hold
 * three attempts, two of which the person said no to, and cannot answer "who
 * tried to claim this record and when" afterwards.
 *
 * ## `therapistKeepsAccess`, and why it has no default
 *
 * §3 step 7: "We ask whether the therapist keeps access. **Default is OFF.**
 * The patient chooses." So the column is nullable and null means *not asked
 * yet* — distinct from `false`, which means asked and refused. Defaulting it to
 * false would be defaulting to the right answer for the wrong reason, and would
 * make "did anybody actually ask?" unanswerable.
 */
export const personClaims = pgTable(
  "person_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    patientAccountId: uuid("patient_account_id")
      .notNull()
      .references(() => patientAccounts.id, { onDelete: "cascade" }),

    /** How they got here: a contact-details match, or a link a therapist gave them. */
    route: text("route").$type<ClaimRoute>().notNull().default("match"),
    status: text("status").$type<ClaimStatus>().notNull().default("pending"),

    /** SHA-256 of the verification code. The raw value is never stored. */
    tokenHash: text("token_hash"),
    /** Which channel the code went to — §3 step 5. */
    channel: text("channel").$type<"email" | "whatsapp">(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /**
     * Step 7. Null = not asked yet. False = asked, and they said no.
     */
    therapistKeepsAccess: boolean("therapist_keeps_access"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    index("person_claims_person_idx").on(t.personId, t.status),
    index("person_claims_account_idx").on(t.patientAccountId),
    // One live attempt per (account, person). A second is the same attempt.
    uniqueIndex("person_claims_open_unique")
      .on(t.personId, t.patientAccountId)
      .where(sql`status = 'pending'`),
  ],
);

/**
 * A therapist-issued invite, bound to one record. C19 / PLAN.md 6.10.
 *
 * The third claim route, and for most of this database the *only* one that can
 * work: 56 of 66 patients have no email and none has a phone number, so there
 * is nothing to match on. The therapist hands the link over in the room, by
 * WhatsApp, on paper — we never send it, because we have no address to send it
 * to and that is exactly the situation.
 *
 * Single use and revocable. The token is stored hashed for the same reason a
 * session token is: a leaked database row must not be a leaked medical record.
 */
export const personInvites = pgTable(
  "person_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** The clinician who issued it — for the audit trail and for revocation. */
    issuedByUserId: uuid("issued_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set the moment it is used. A used invite is dead. */
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedByAccountId: uuid("used_by_account_id").references(() => patientAccounts.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("person_invites_token_hash_unique").on(t.tokenHash),
    index("person_invites_person_idx").on(t.personId),
  ],
);

export type PatientAccount = typeof patientAccounts.$inferSelect;
export type PersonClaim = typeof personClaims.$inferSelect;
export type PersonInvite = typeof personInvites.$inferSelect;

/* ============================================================== sprint 7 == */

/**
 * Consent to read a person's history. PLAN.md 7.1.
 *
 * ## Why the row is the *request* as well as the grant
 *
 * §3 gives a therapist in the revoked state a "request access" button with a
 * note. A separate requests table would mean two rows describing one
 * relationship and a state machine spread across both — and the question the
 * product actually asks is always the same one: *what is the current state
 * between this person and this therapist?* One row answers it.
 *
 * So `status` walks `pending → granted | rejected`, and `granted → revoked`.
 * A row never moves backwards; a new request after a rejection is a new row,
 * which is what makes the history readable.
 *
 * ## Person, not patient
 *
 * The grant is given by the **person** and it covers everything of theirs,
 * across every clinic. A grant keyed to a `patients` row would be a grant to
 * one clinic's file about them, which is the thing they already cannot control.
 *
 * ## Expiry is a timestamp, not a job
 *
 * A 24-hour grant has `expires_at` set and nothing ever runs to "expire" it.
 * Every read compares against `now()`. A cron that flips rows is a cron that
 * can be late, and being late here means a therapist reading a chart after
 * consent ran out.
 */
export const GRANT_SHAPES = ["24h", "open"] as const;
export type GrantShape = (typeof GRANT_SHAPES)[number];

export const GRANT_STATUSES = ["pending", "granted", "rejected", "revoked"] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];

export const historyGrants = pgTable(
  "history_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** The clinician the consent is given to. Consent is to a person, not a clinic. */
    therapistUserId: uuid("therapist_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Denormalised for the audit trail — which practice they were in at the time. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),

    status: text("status").$type<GrantStatus>().notNull().default("pending"),
    shape: text("shape").$type<GrantShape>(),

    /** 7.3 — a request carries a note, so the patient knows what they are agreeing to. */
    requestNote: text("request_note"),
    requestedAt: timestamp("requested_at", { withTimezone: true }),

    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Set only for a `24h` grant. Null on an open-ended one — see the header. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    /**
     * 7.4 — optional, and it stays optional.
     *
     * §3: the patient rejects "silently, or with a preset reason". A required
     * reason is a toll on saying no, and the whole point is that saying no
     * costs them nothing.
     */
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /*
     * One live row per (person, therapist). Partial, so a rejected or revoked
     * row does not block asking again later — and so a therapist cannot spam a
     * patient with a second pending request while one is already waiting.
     */
    uniqueIndex("history_grants_live_unique")
      .on(t.personId, t.therapistUserId)
      .where(sql`status IN ('pending', 'granted')`),
    index("history_grants_person_idx").on(t.personId, t.status),
    index("history_grants_therapist_idx").on(t.therapistUserId, t.status),
  ],
);

export type HistoryGrant = typeof historyGrants.$inferSelect;
