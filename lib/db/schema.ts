import { sql } from "drizzle-orm";
import {
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

export const ROLES = ["super_admin", "therapist"] as const;
export type Role = (typeof ROLES)[number];

export const PLANS = ["payg", "unlimited"] as const;
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(t.tokenHash),
    index("auth_sessions_user_idx").on(t.userId),
  ],
);

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
    status: text("status").$type<SessionStatus>().notNull().default("scheduled"),

    /** Patient join link. Random, expiring, revocable. */
    joinToken: text("join_token"),
    joinTokenExpiresAt: timestamp("join_token_expires_at", { withTimezone: true }),

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
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),

    /** Drives the "generating your note" state without a job queue. */
    noteStatus: text("note_status")
      .$type<"none" | "generating" | "ready" | "failed">()
      .notNull()
      .default("none"),

    reportSentAt: timestamp("report_sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sessions_join_token_unique").on(t.joinToken),
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
    text: text("text").notNull(),
    startMs: integer("start_ms").notNull().default(0),
    endMs: integer("end_ms").notNull().default(0),
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
    status: text("status").$type<"draft" | "approved">().notNull().default("draft"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),

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
     * Prepended to the system prompt so a correction actually changes behaviour
     * instead of being forgotten at the end of the turn.
     */
    guidance: text("guidance"),
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
    /** ISO-3166 alpha-2. Country granularity only — never a precise location. */
    country: text("country"),

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

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("therapist_radar_user_unique").on(t.userId),
    index("therapist_radar_status_idx").on(t.status, t.lastSeenAt),
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
    kind: text("kind").$type<"transcribe" | "note" | "risk" | "copilot">().notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    audioSeconds: integer("audio_seconds").notNull().default(0),
    costCents: integer("cost_cents").notNull().default(0),
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

    grossCents: integer("gross_cents").notNull(),
    /** Our application fee: the platform cut plus anything settled below. */
    platformFeeCents: integer("platform_fee_cents").notNull(),
    /** Of the fee, the part that cleared the therapist's own 24Therapy bills. */
    settledInvoiceCents: integer("settled_invoice_cents").notNull().default(0),
    /** Gross minus the application fee — what reaches the therapist's account. */
    therapistNetCents: integer("therapist_net_cents").notNull(),

    status: text("status").$type<PaymentStatus>().notNull().default("pending"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

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
  (t) => [uniqueIndex("content_pages_slug_unique").on(t.slug)],
);

export type Organization = typeof organizations.$inferSelect;
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
