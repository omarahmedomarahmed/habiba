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
/**
 * Who somebody is inside the product. PLAN.md 20.8, §3d.
 *
 * `staff` and `manager` are new in sprint 20 and they are **not** a hierarchy
 * with `super_admin` at the top by accident — they exist because §3d's back
 * office is worked by people who must never see a patient's account:
 *
 *   therapist    the clinician. Their own caseload, nothing else.
 *   staff        the 24/7 team. The WORK — payouts, verifications, number
 *                changes, support tickets. No patient accounts, no
 *                impersonation, no clinical records (20.9).
 *   manager      that, plus the performance overview: ticket ages, overdue
 *                counts, throughput, who owns what.
 *   super_admin  everything, including the settings that price the product.
 *
 * Ordered here from least to most, and `requireRole` still takes an explicit
 * list rather than a level — an unknown role must fail closed, which is the
 * bug the comment in `lib/auth/guard.ts` records.
 */
export const ROLES = ["therapist", "staff", "manager", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

/** The roles that work the back office. Never a clinician, never a patient. */
export const BACK_OFFICE_ROLES = ["staff", "manager", "super_admin"] as const;

/** The roles that may see how the back office is *performing*. 20.8. */
export const MANAGER_ROLES = ["manager", "super_admin"] as const;

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
   * The general copilot's preferences. PLAN.md 10.6.
   *
   * Three scalars on the person who owns them, kept here rather than in a new
   * table — a table with one row per user and three columns is a join for no
   * reason. `assistantPrefsSetAt` is what makes "asked once" possible: null
   * means they have never been asked, which is a different state from having
   * been asked and chosen the defaults.
   */
  assistantLanguage?: string;
  assistantPrefsSetAt?: string;
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
    /**
     * IANA zone, e.g. `Africa/Cairo`. PLAN.md 11R.2.
     *
     * Nullable, and null means **we have not asked** — which is a different
     * fact from UTC. `lib/scheduling/tz.ts` falls back explicitly and says so
     * rather than defaulting silently, because a clinician who publishes
     * 18:00 and gets 20:00 has been lied to by a default.
     */
    timezone: text("timezone"),

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
     * 16.5 — the currency the clinician **priced in**, not a display choice.
     *
     * A therapist in Cairo who types 1500 means 1500 EGP; a therapist in
     * London who types 60 means $60. Storing the denomination beside the
     * number is what lets 16.4 show either currency without ever having to
     * guess which one the price was written in. Every existing row is `usd`,
     * which is what every existing price actually was.
     */
    rateCurrency: text("rate_currency").notNull().default("usd"),
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
     * IANA zone, for anything they read. PLAN.md 11R.3.
     *
     * Null falls back to the clinician's zone, then to UTC — and the message
     * says which, because "22:00" with no zone is a time somebody will get
     * wrong by three hours.
     */
    timezone: text("timezone"),

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
    /** 16.5 — the currency this price was set in. Frozen on the session. */
    priceCurrency: text("price_currency").notNull().default("usd"),
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

    /* ------------------------------------------- sprint 14: the let-down -- */

    /**
     * When we decided nobody was coming. 14.2.
     *
     * Recorded rather than inferred: "the patient waited five minutes" has to
     * be a fact somebody can check afterwards, not arithmetic done fresh on
     * every read against a clock that has moved.
     */
    noShowAt: timestamp("no_show_at", { withTimezone: true }),
    recoveryOfferedAt: timestamp("recovery_offered_at", { withTimezone: true }),
    /** `reassigned` · `refunded` · `abandoned`. What actually happened to them. */
    recoveryOutcome: text("recovery_outcome").$type<"reassigned" | "refunded" | "abandoned">(),

    /**
     * Who did not turn up, when the session was handed on. 14.5.
     *
     * The session **moves** rather than being cancelled and recreated: the
     * booking, the payment and the fact that somebody was let down all live on
     * this row, and a fresh session would start with none of it.
     */
    reassignedFromUserId: uuid("reassigned_from_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reassignedAt: timestamp("reassigned_at", { withTimezone: true }),
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

    /**
     * When this session is *planned* for. PLAN.md 11.2, closing C57.
     *
     * Distinct from `startedAt`, which is when it actually began. A session
     * booked for Tuesday at 19:00 that nobody joined has a `scheduledAt` and
     * no `startedAt`, and that gap is exactly what sprint 12's no-show
     * recovery reads. Collapsing the two would make "did they turn up?"
     * unanswerable.
     *
     * Nullable, and null for every session that came off the radar — those are
     * unplanned by definition.
     */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),

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
      .$type<
        | "transcribe"
        | "note"
        | "risk"
        | "copilot"
        | "patient_copilot"
        | "translate"
        | "speech"
        | "diarise"
        // Reading a diagnosis out of an uploaded document (8.9).
        | "diagnosis"
        // Rebuilding a person's rolling profile and timeline (9.1).
        | "profile"
      >()
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

    /*
     * 16.6a — **every** therapist chooses the currency they pay us in, not
     * only Egyptian ones. The bill is denominated in USD and always was;
     * these columns record what they were actually charged when they chose to
     * settle it in EGP, and at what rate.
     *
     * 16.6b / C76: the therapist absorbs the difference, which is only fair if
     * the number and the rate were on the screen with the button. They are —
     * and they are here afterwards, so a receipt reproduces exactly what was
     * shown rather than re-converting at today's rate.
     */
    settledCurrency: text("settled_currency"),
    settledAmountMinor: integer("settled_amount_minor"),
    fxRateMicro: integer("fx_rate_micro"),
    fxQuotedAt: timestamp("fx_quoted_at", { withTimezone: true }),

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

    /**
     * 16.7 / 16.9 — which of §3c's four crossings this payment was, and which
     * entity ended up holding it.
     *
     * Recorded rather than derived for the same reason `capture` is: the
     * therapist's Stripe status and the patient's country are facts about
     * *now*, and the question a year from now is what this payment was then.
     * Every pre-sprint-16 row is a USD card payment on the US entity, which
     * is exactly what the defaults say.
     */
    crossing: text("crossing").$type<Crossing>().notNull().default("usd_stripe_to_connect"),
    entity: text("entity").$type<Entity>().notNull().default("us"),

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
  /** 16.2 — a manual EGP payout left the Egyptian entity's bank account. */
  "manual_payout",
  /** 16.9 — money moved between the two entities, explicitly and audited. */
  "entity_transfer",
  /** C69 / 17.1 — a session fee netted against what we already hold. */
  "fee_netted",
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

    /**
     * 16.9 — which entity holds this leg. Defaults to `us`, which is what
     * every pre-sprint-16 leg actually was: one entity, one Stripe balance.
     * A cross-entity movement is its own transaction (`entity_transfer`),
     * never a side effect of some other posting.
     */
    entity: text("entity").$type<Entity>().notNull().default("us"),

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
export const CONTENT_DEMOS = [
  "transcript",
  "note",
  "risk",
  "copilot",
  /*
   * 18.8–18.9 — the product built since those first four existed.
   *
   * Every one of them renders the component a real user touches, against the
   * synthetic fixtures in `lib/content/demo.ts`. A screenshot would have been
   * quicker and would have started rotting the same afternoon (C80).
   */
  "patient-sessions",
  "homework",
  "profile",
  "none",
] as const;
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
      /**
       * The three rates, rendered from `platform_settings` at request time.
       * 17.7 — one component on two pages, so a price can never be repriced in
       * one place and left stale in the other (C60).
       *
       * It carries **no numbers of its own**, deliberately: an admin editing
       * this block can move it or drop it, and cannot make it disagree with
       * what the invoice charges. `compact` is the homepage form — the same
       * cards without the feature lists.
       */
      type: "pricing";
      compact?: boolean;
    }
  | {
      /**
       * 🔴 18R.6 — the two companies, side by side.
       *
       * §3c gives this platform a US entity and an Egyptian one, and the point
       * of naming two companies is that a person can see which one they are
       * dealing with. So every field is content — name, address, phone, email,
       * hours, and what to write to each about — editable by admin and
       * translatable per locale like any other row. Never hardcoded, and never
       * collapsed into one "our office", which is what a reader is told when
       * somebody could not be bothered to say.
       */
      type: "companies";
      heading?: string;
      items: {
        title: string;
        /** `us` or `eg`. International sorts first, both always render. */
        entity?: string;
        address?: string;
        phone?: string;
        email?: string;
        hours?: string;
        /** Which one to write to about what. */
        body?: string;
      }[];
    }
  | {
      /**
       * 18R.2 — the contact form itself, as a block, so the page around it
       * stays editable and the form can be moved or dropped without a deploy.
       */
      type: "contact_form";
      heading?: string;
      body?: string;
    }
  | {
      /**
       * 🔴 18.3 — getting help now, never behind a signup.
       *
       * A block rather than a page so it can sit at the bottom of *every*
       * patient-facing page: a person who has scrolled a page about what a
       * session is like is exactly the person who may need this, and asking
       * them to navigate is asking too much. It carries no editable numbers
       * for the same reason a fire exit has no configurable location.
       */
      type: "crisis";
      heading?: string;
      body?: string;
    }
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

  /*
   * 20.3 — which rail this country is on, and whether it has one at all.
   *
   * `collectionProvider` is how patients here pay (Stripe, or an Egyptian
   * collector by key); `payoutMethods` is how a clinician here is paid.
   * Both empty means a country we can name and cannot transact in, and the
   * admin screen lists exactly those — a country with neither rail is not a
   * gap in a spreadsheet, it is a clinician who signed up and cannot be paid.
   */
  collectionProvider: text("collection_provider"),
  payoutMethods: jsonb("payout_methods").$type<string[]>().notNull().default([]),
  /** 16.9 — which entity collects here. Follows the money in, per §3c. */
  entity: text("entity").$type<Entity>().notNull().default("us"),

  /*
   * 20.4 / 20.5 — what we ask a clinician here to prove, and to whom.
   *
   * These were hardcoded in `lib/regulators.ts` as a nested ternary per
   * country, which meant adding a country was a deploy and correcting the
   * name of an ID document was a deploy. They are data now; the constants
   * stay as the fallback for a country with no row, because inventing a
   * plausible-sounding regulator is worse than offering none.
   */
  regulators: jsonb("regulators").$type<string[]>().notNull().default([]),
  idLabelFront: text("id_label_front"),
  idLabelBack: text("id_label_back"),
  licenceLabel: text("licence_label"),
  /** A photograph of an acceptable document. Shown beside the upload. */
  sampleImageUrl: text("sample_image_url"),

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
/**
 * Money a patient is owed. 14.6.
 *
 * Not `session_credits`, which is the *therapist's* prepaid sessions. This is
 * the other direction: a patient who paid $40 and was seen by a replacement
 * charging $30 is owed $10, and refunding ten dollars to a card costs more in
 * fees than it returns.
 *
 * 🔴 Applied **after VAT** (§3). The VAT went to a government that is not
 * refunding it because a clinician overslept, so the credit is against the
 * therapist's price and the next session's VAT is computed on what remains.
 */
export const patientCredits = pgTable(
  "patient_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    spentCents: integer("spent_cents").notNull().default(0),

    /** Every cent traces to one let-down. */
    fromSessionId: uuid("from_session_id"),
    reason: text("reason").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("patient_credits_live_idx")
      .on(t.personId, t.expiresAt)
      .where(sql`spent_cents < amount_cents`),
  ],
);

export type PatientCredit = typeof patientCredits.$inferSelect;

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

    /**
     * Optional since 13R.6 / C86. §3b: the phone is the handle that is never
     * missing; the address is a real second way in when there is one, not a
     * requirement. Sprint 13 demanded one, which excluded exactly the people
     * this product is for.
     *
     * Unique **only over rows that have one** — see the index below.
     */
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    /** Null until they follow the link. Nothing is shared before this. */
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /**
     * 🔴 §3b: **the identity.** Unique among live accounts (0043), E.164 only.
     *
     * Nullable in the column type because 0043's presence check is `NOT VALID`
     * until sprint 22 empties the table — every write goes through it, and
     * nothing may create an account without one.
     */
    phone: text("phone"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),

    /**
     * Where they are. 13.11–13.13 / C85.
     *
     * Detected in the browser at signup, **shown to them and editable**, then
     * stored — so every patient screen takes it as a prop from the server, like
     * the clinician screens do, instead of flashing UTC and correcting a frame
     * later on the consent list where the date is the legally meaningful part.
     *
     * Nullable is the column, not the experience: empty only for accounts made
     * before this shipped, or for somebody who cleared it deliberately.
     *
     * 🔴 Precedence (13.13): this beats `patients.timezone`, which `bookSlot`
     * writes from the browser at anonymous booking time, which beats the
     * therapist's, which beats UTC. **Claiming never copies this into
     * `patients.timezone`** — that row records what the browser said the day
     * the booking was made, and one account may hold records from two
     * therapists.
     */
    timezone: text("timezone"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // One account per email — and unlike `users`, no organisation to make the
    // constraint conditional on. This is the index 6.2 exists to protect.
    /*
     * 🔴 Unique only over rows that HAVE an address. 13R.6.
     *
     * Postgres's default is `NULLS DISTINCT`, which is exactly the rule §3b
     * needs: many accounts legitimately have no email and must not collide.
     * `person_claims_open_unique` one table away uses `NULLS NOT DISTINCT` and
     * is right to — same keyword, opposite meaning.
     */
    uniqueIndex("patient_accounts_email_unique")
      .on(t.email)
      .where(sql`deleted_at IS NULL AND email IS NOT NULL`),
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

/**
 * `locked` is 13R.2's, and it is not `expired`.
 *
 * A code that timed out and a record whose name budget ran out are different
 * events with different remedies — one is "ask for another code", the other
 * needs a person to open the door (13R.4). Support could not tell them apart
 * while both read `expired`, and the release path needs something to target.
 */
export const CLAIM_STATUSES = ["pending", "verified", "rejected", "expired", "locked"] as const;
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

    /**
     * §3b step 5–6 — the challenge, because a code proves a number and not a
     * person.
     *
     * `seenTherapist` null = not asked · true = yes · false = **no, and
     * remembered**, so nobody is asked about that record twice.
     * `nameAttempts` is per claim rather than per caller: what is being
     * protected is one record's name, and a fresh IP must not buy a fresh
     * budget against it.
     */
    seenTherapist: boolean("seen_therapist"),
    nameAttempts: integer("name_attempts").notNull().default(0),
    challengedAt: timestamp("challenged_at", { withTimezone: true }),
    /**
     * Question two answered. 13.6 / 13.10.
     *
     * The state between passing the challenge and owning the record: consent
     * still has to be asked, because claiming is not consenting. Without this
     * the middle state has nowhere to live and the gate opens on question one.
     */
    nameConfirmedAt: timestamp("name_confirmed_at", { withTimezone: true }),

    /**
     * Which clinician's record this attempt is about.
     *
     * Two therapists may hold the same number (§3b step 8) and the person
     * answers for each separately — which a claim keyed only on the person
     * cannot do.
     */
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => [
    index("person_claims_person_idx").on(t.personId, t.status),
    index("person_claims_account_idx").on(t.patientAccountId),
    /*
     * One live attempt per (account, person, patient record). Per *record*
     * since 0043: keyed only on the person, one therapist's claim would block
     * the question about the other's.
     */
    uniqueIndex("person_claims_open_unique")
      .on(t.patientAccountId, t.personId, t.patientId)
      .where(sql`status = 'pending'`),
    index("person_claims_declined_idx")
      .on(t.patientAccountId, t.patientId)
      .where(sql`status = 'rejected'`),
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
/**
 * How many names have been offered against one record, by one account. C87.
 *
 * ## Why this is not a column on `person_claims`
 *
 * It was, and the budget reset. `answerName` set `status = 'expired'` on the
 * third wrong name; `person_claims_open_unique` is partial on
 * `WHERE status = 'pending'`, so the locked row left the index, the next code
 * request found no conflict to upsert against, and a **fresh** claim arrived
 * carrying `name_attempts DEFAULT 0`. Three guesses per code request,
 * unbounded, against somebody's first name.
 *
 * The budget belongs to the pair it protects — this account, this record — and
 * never to a row that can be replaced. A new claim inherits what has been
 * spent because the spending was never the claim's.
 *
 * ## And the way out (C88)
 *
 * Closing that hole without a release converts a security bug into a permanent
 * lockout for a patient who mistyped their own name. `released_*` is that door:
 * one audited action by the therapist who wrote the record down.
 */
export const claimAttempts = pgTable(
  "claim_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientAccountId: uuid("patient_account_id")
      .notNull()
      .references(() => patientAccounts.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),

    attempts: integer("attempts").notNull().default(0),
    /** 13R.2 — its own state. A lockout and a timed-out code are different events. */
    lockedAt: timestamp("locked_at", { withTimezone: true }),

    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedByUserId: uuid("released_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    releaseReason: text("release_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // The constraint that makes the budget un-resettable.
    uniqueIndex("claim_attempts_pair_unique").on(t.patientAccountId, t.patientId),
    index("claim_attempts_locked_idx")
      .on(t.patientId)
      .where(sql`locked_at IS NOT NULL AND released_at IS NULL`),
  ],
);

export type ClaimAttempts = typeof claimAttempts.$inferSelect;

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

/* ============================================================== sprint 8 == */

/**
 * How a document got here. PLAN.md 8.1.
 *
 * `typed` and `dictated` are text we own from the first moment, so they are
 * searchable immediately. `upload` is a file whose contents we may or may not
 * be able to read — see `extraction` below, and 8.4.
 */
export const DOCUMENT_SOURCES = ["upload", "typed", "dictated"] as const;
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

/**
 * Whether the copilot can read this document, and why not when it cannot.
 *
 *   none          nothing to extract — the text is already here (typed, dictated)
 *   pending       queued for the worker (H9: never in a request handler)
 *   ready         chunked, searchable, citable
 *   unsupported   we cannot read this format and will not pretend to (8.4)
 *   failed        we tried and could not
 *
 * `unsupported` and `failed` are separate values because they are different
 * facts. A scan of a prescription is *never* going to be searchable and the
 * screen should say so plainly; a PDF that blew up once might work on a retry.
 * One value for both would make the retry queue either useless or infinite.
 */
export const EXTRACTION_STATES = ["none", "pending", "ready", "unsupported", "failed"] as const;
export type ExtractionState = (typeof EXTRACTION_STATES)[number];

/**
 * A document about a person, belonging to the person. PLAN.md 8.1–8.7.
 *
 * ## On the person, not the patient row
 *
 * This is the difference sprint 5 was building towards. A letter from a
 * psychiatrist is a fact about a human being, not about one clinic's file on
 * them — so it lives here, travels with them, and is visible to a clinician
 * only through the consent states in `lib/access/state.ts`.
 *
 * `organizationId` and `uploadedByUserId` record *provenance* (8.7): which
 * clinician put it there and when. They are not access control. §3's revoked
 * state lets a clinician keep what they uploaded themselves, and that is the
 * question those two columns answer.
 *
 * ## The ordinal, and why it is not the id
 *
 * §3's citation format is `[D7:3]` — document 7, chunk 3. Seven is *this
 * person's* seventh document, stable and small enough for a model to repeat
 * without transcription errors. A uuid in a citation is a uuid the model will
 * eventually get one character wrong, and a citation that resolves to the
 * wrong document is worse than one that fails to resolve (8.5).
 */
export const personDocuments = pgTable(
  "person_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** 1-based, per person. The D-number in `[D7:3]`. */
    ordinal: integer("ordinal").notNull(),

    source: text("source").$type<DocumentSource>().notNull(),
    title: text("title").notNull(),

    /* ---- provenance (8.7). Exactly one of the two uploaders is ever set. --- */
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedByAccountId: uuid("uploaded_by_account_id").references(() => patientAccounts.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    /** The date on the document itself, when somebody says what it is. */
    documentDate: timestamp("document_date", { withTimezone: true }),

    /* ------------------------------------------------------------ the file -- */
    /**
     * Where the bytes are. **Never sent to a browser** — H14: a blob URL is a
     * secret, not access control, so a viewer that receives one has permanent
     * unaudited access. Reads go through `/api/documents/[id]`, which checks
     * consent and writes an audit row (8.10).
     */
    blobUrl: text("blob_url"),
    mimeType: text("mime_type"),
    byteSize: integer("byte_size"),

    /* ----------------------------------------------------------- the text -- */
    /** Typed or dictated text, verbatim. Null for uploads. */
    body: text("body"),
    extraction: text("extraction").$type<ExtractionState>().notNull().default("none"),
    extractionError: text("extraction_error"),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("person_documents_ordinal_unique").on(t.personId, t.ordinal),
    index("person_documents_person_idx").on(t.personId, t.createdAt),
    // The worker's queue. Partial, so it stays the size of the backlog rather
    // than the size of the table.
    index("person_documents_pending_idx").on(t.createdAt).where(sql`extraction = 'pending'`),
  ],
);

/**
 * One citable passage. PLAN.md 8.5 / 8.6.
 *
 * The `:3` in `[D7:3]`. Chunks are numbered from 1 within a document and never
 * renumbered — a citation written into a copilot answer last month has to
 * still point at the same words, so re-extraction replaces the whole set and
 * keeps the numbering deterministic rather than editing in place.
 */
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => personDocuments.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** 1-based within the document. */
    sequence: integer("sequence").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("document_chunks_sequence_unique").on(t.documentId, t.sequence),
    index("document_chunks_person_idx").on(t.personId),
  ],
);

/**
 * A diagnosis **as written in a document**. PLAN.md 8.9.
 *
 * 🔴 The rule this table exists to enforce: *extract only what is written,
 * show the source sentence, require confirmation, never infer from symptoms.*
 *
 * So `sourceSentence` is `NOT NULL`. There is no way to record a diagnosis
 * here without the words it came from, which makes "the model inferred it"
 * structurally impossible rather than merely discouraged — the same discipline
 * as C35's straddles, where the fix was to refuse rather than to guess.
 *
 * `status` starts `proposed` and only a human moves it. An unconfirmed
 * diagnosis is never shown as a diagnosis.
 */
export const DIAGNOSIS_STATES = ["proposed", "confirmed", "rejected"] as const;
export type DiagnosisState = (typeof DIAGNOSIS_STATES)[number];

export const personDiagnoses = pgTable(
  "person_diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    /** ICD-10 or DSM code, only when the document states one. Never derived. */
    code: text("code"),
    /** The diagnosis as the document words it. */
    label: text("label").notNull(),

    /** 🔴 The sentence it was taken from. Not nullable, on purpose. */
    sourceSentence: text("source_sentence").notNull(),
    sourceDocumentId: uuid("source_document_id").references(() => personDocuments.id, {
      onDelete: "cascade",
    }),
    sourceChunkId: uuid("source_chunk_id").references(() => documentChunks.id, {
      onDelete: "set null",
    }),

    status: text("status").$type<DiagnosisState>().notNull().default("proposed"),
    confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("person_diagnoses_person_idx").on(t.personId, t.status),
    index("person_diagnoses_document_idx").on(t.sourceDocumentId),
  ],
);

/**
 * "This is outdated" / "this is wrong". PLAN.md 8.8.
 *
 * One table for documents, passages and diagnoses rather than three flag
 * columns, because the flag is the same act every time and the thing being
 * corrected differs only in what it points at.
 *
 * 🔴 A flag never deletes and never edits. A patient saying "that diagnosis is
 * out of date" is a fact *about* the record, not permission to alter a
 * clinician's document — which they may be legally required to keep. What it
 * does is travel with the material: everything that renders a flagged item
 * renders the flag, and the copilot is told about it.
 */
export const FLAG_TARGETS = ["document", "chunk", "diagnosis"] as const;
export type FlagTarget = (typeof FLAG_TARGETS)[number];

export const FLAG_REASONS = ["outdated", "wrong", "not_mine"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export const contentFlags = pgTable(
  "content_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    targetType: text("target_type").$type<FlagTarget>().notNull(),
    targetId: uuid("target_id").notNull(),

    reason: text("reason").$type<FlagReason>().notNull(),
    /** Optional. A flag with no note is still a flag. */
    note: text("note"),

    /* Exactly one of these, like every other actor pair since C49. */
    raisedByUserId: uuid("raised_by_user_id").references(() => users.id, { onDelete: "set null" }),
    raisedByAccountId: uuid("raised_by_account_id").references(() => patientAccounts.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** Cleared by whoever raised it. Nobody else can dismiss somebody's flag. */
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [
    index("content_flags_target_idx").on(t.targetType, t.targetId),
    index("content_flags_person_idx").on(t.personId),
  ],
);

export type PersonDocument = typeof personDocuments.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type PersonDiagnosis = typeof personDiagnoses.$inferSelect;
export type ContentFlag = typeof contentFlags.$inferSelect;

/* ============================================================== sprint 9 == */

/**
 * The rolling profile. PLAN.md 9.1.
 *
 * ## Regenerated, never edited
 *
 * §3 and 9.1 both say it: *dated, cited, never hand-edited into permanence.*
 * A profile somebody can type into becomes a place where a sentence outlives
 * the evidence for it — a clinician writes "hostile to her mother" in 2024 and
 * it is still the first thing every future clinician reads in 2027, long after
 * the sessions it came from stopped supporting it.
 *
 * So there is exactly **one row per person**, it is replaced wholesale by
 * `regenerateProfile`, and there is no update path that takes prose from a
 * human. If a clinician disagrees with a line, they flag it (8.8) or they
 * record a session that says otherwise — both of which change the *sources*,
 * which is the only thing that can change the profile.
 *
 * `sections` carries its own citations, so every claim in the profile can be
 * opened. A profile sentence with no citation is a sentence nobody can check,
 * and this table has no way to store one.
 */
export type ProfileSection = {
  /** "Presenting problem", "What has helped", … — the model's own headings. */
  heading: string;
  body: string;
  /** `S2:14` for a session segment, `D7:3` for a document passage. */
  refs: string[];
};

export const personProfiles = pgTable(
  "person_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    sections: jsonb("sections").$type<ProfileSection[]>().notNull().default([]),

    /** What it was built from, so staleness is visible rather than assumed. */
    sessionCount: integer("session_count").notNull().default(0),
    documentCount: integer("document_count").notNull().default(0),
    /** 9.4 — conflicts found between sessions and history, surfaced not resolved. */
    conflicts: jsonb("conflicts").$type<{ text: string; refs: string[] }[]>().notNull().default([]),

    model: text("model"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("person_profiles_person_unique").on(t.personId)],
);

/**
 * The dated observation timeline. PLAN.md 9.2.
 *
 * One row per thing that was observed, on the date it was observed rather than
 * the date it was written down — a letter from 2019 read into the record today
 * belongs in 2019, or the timeline tells a story that never happened.
 *
 * Derived, like the profile: rows carry the source they came from and are
 * replaced when that source is re-read. Nothing here is typed by a human.
 */
export const OBSERVATION_SOURCES = ["session", "document"] as const;
export type ObservationSource = (typeof OBSERVATION_SOURCES)[number];

export const observations = pgTable(
  "observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    /** When it happened, not when we learned it. */
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    text: text("text").notNull(),

    source: text("source").$type<ObservationSource>().notNull(),
    /** The session or document it was drawn from. */
    sourceId: uuid("source_id"),
    /** `S2:14` or `D7:3` — openable, like everything else. */
    ref: text("ref"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("observations_person_idx").on(t.personId, t.observedAt),
    index("observations_source_idx").on(t.source, t.sourceId),
  ],
);

/**
 * Homework. PLAN.md 9.5.
 *
 * ## The warning at the top of the ticket is a schema decision
 *
 * > ⚠️ A completion rate shown to a depressed patient is a scoreboard of their
 * > failures. Trend to the therapist; next action to the patient.
 *
 * So there is no `completion_rate` column and no `streak`. The patient's screen
 * reads one row — the next thing to do — and the therapist's reads the set. The
 * *same* data answers both, and the difference is which query each side is
 * allowed to run: see `nextStepFor` and `homeworkTrend` in
 * `lib/data/homework.ts`, which is where that rule is enforced rather than in a
 * component somebody could copy.
 *
 * ## `skipped` is a first-class outcome
 *
 * Not "failed", and not silence. A person who did not do a thing has told us
 * something clinically useful, and a status set that offers only done/not-done
 * turns every unfinished week into an accusation.
 */
export const HOMEWORK_STATES = ["open", "done", "skipped"] as const;
export type HomeworkState = (typeof HOMEWORK_STATES)[number];

export const homeworkItems = pgTable(
  "homework_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** The session it came out of. Null for something set between sessions. */
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),

    /** The step itself, in the words the patient reads. */
    title: text("title").notNull(),
    /** Optional detail — when, how, what counts as done. */
    detail: text("detail"),

    /**
     * Drafted by the note, or written by the clinician.
     *
     * `NoteContent.patientSteps` already drafts these. Recorded separately
     * because a step a clinician typed carries their intent and a step a model
     * drafted carries a guess, and a patient asking "did you mean me to do
     * this?" deserves a true answer.
     */
    source: text("source").$type<"drafted" | "therapist">().notNull().default("therapist"),

    status: text("status").$type<HomeworkState>().notNull().default("open"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Only the person themselves closes a step. A clinician cannot mark it done. */
    completedByAccountId: uuid("completed_by_account_id").references(() => patientAccounts.id, {
      onDelete: "set null",
    }),
    /** Optional, and never required. "I could not face it" is an answer. */
    patientNote: text("patient_note"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("homework_person_idx").on(t.personId, t.status),
    index("homework_session_idx").on(t.sessionId),
  ],
);

export type PersonProfile = typeof personProfiles.$inferSelect;
export type Observation = typeof observations.$inferSelect;
export type HomeworkItem = typeof homeworkItems.$inferSelect;

/* ============================================================= sprint 10 == */

/**
 * The general copilot — a separate table on purpose. PLAN.md 10.1–10.5.
 *
 * ## Why not a nullable `patient_id` on `copilot_threads`
 *
 * 10.2 is the whole ticket: *roster only, **no clinical content in context**,
 * and the guarantee comes from what is absent rather than from what the prompt
 * says.* A nullable `patient_id` would put the general assistant inside the
 * module that assembles transcripts, notes and documents — one `if` away from
 * a leak, and that `if` would be the only thing standing between a general
 * question and twelve sessions of somebody's therapy.
 *
 * A separate table means `lib/ai/assistant.ts` imports **no clinical table at
 * all**. There is no query in it that could reach a transcript, because there
 * is no join that leads there. That is the same argument as C41's separate
 * patient identity, and it is the reason both were built this way.
 *
 * ## Threads are soft-deleted
 *
 * 10.4 asks for delete. `deletedAt` rather than a row removal because a
 * clinician deleting a thread is tidying their own workspace, not exercising a
 * retention right — and a hard delete would take the usage rows for the month's
 * allowance with it, which would quietly hand back messages they had spent.
 */
export const assistantThreads = pgTable(
  "assistant_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** Named from the first question, so a list of threads is readable. */
    title: text("title").notNull().default("New chat"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("assistant_threads_user_idx").on(t.userId, t.updatedAt)],
);

/**
 * One turn of the general chat.
 *
 * `mentions` holds patient links the **server** resolved (10.3) — never what
 * the model claimed. A name the model invented is not in this array, so it
 * cannot become a link, and a link that exists here was matched against the
 * clinician's real roster at the moment the answer was written.
 */
export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => assistantThreads.id, { onDelete: "cascade" }),
    /** Denormalised so the monthly allowance is one indexed count, not a join. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    role: text("role").$type<"therapist" | "assistant">().notNull(),
    content: text("content").notNull(),
    mentions: jsonb("mentions")
      .$type<{ patientId: string; name: string }[]>()
      .notNull()
      .default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("assistant_messages_thread_idx").on(t.threadId, t.createdAt),
    /*
     * The allowance query: therapist questions this month, across every thread.
     * Partial on the role, because assistant replies are not spent messages and
     * counting them would halve everybody's quota.
     */
    index("assistant_messages_quota_idx")
      .on(t.userId, t.createdAt)
      .where(sql`role = 'therapist'`),
  ],
);

export type AssistantThread = typeof assistantThreads.$inferSelect;
export type AssistantMessage = typeof assistantMessages.$inferSelect;

/* ============================================================= sprint 11 == */

/**
 * Bookable time. PLAN.md 11.1.
 *
 * ## Whole hours, enforced by the database
 *
 * 11.1: *whole hours only, 19:00–20:00, never 19:15.* That is a
 * `CHECK (date_part('minute', starts_at) = 0 AND date_part('second', ...) = 0)`
 * in migration 0039, not a validation in a form. A form validates what a form
 * submits; the constraint holds for a script, a backfill, an admin tool and
 * whatever the next sprint writes.
 *
 * The reason it matters is not tidiness. A calendar with 19:00 and 19:15 slots
 * on it is a calendar where two patients can book overlapping hours, and the
 * clinician finds out when the second one joins the room.
 *
 * ## One slot per hour per clinician
 *
 * A unique index on (therapist, starts_at). Double-booking is then a database
 * error rather than a race — two patients pressing "book" on the same slot at
 * the same moment is the ordinary case, not the exotic one.
 */
export const SLOT_STATES = ["open", "held", "booked", "blocked"] as const;
export type SlotState = (typeof SLOT_STATES)[number];

export const availabilitySlots = pgTable(
  "availability_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    therapistUserId: uuid("therapist_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** Always on the hour. The constraint is in the migration. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /** One hour. A column rather than a constant so a 90-minute slot is a data change. */
    durationMinutes: integer("duration_minutes").notNull().default(60),

    status: text("status").$type<SlotState>().notNull().default("open"),

    /**
     * `held` is a short-lived state between "somebody is paying" and "booked".
     *
     * Without it, a patient who reaches Stripe and takes four minutes has an
     * hour that is still advertised as free, and can lose it while their card
     * is being charged. The hold expires by timestamp rather than by a job —
     * a cron that runs late holds an hour nobody wants.
     */
    heldUntil: timestamp("held_until", { withTimezone: true }),

    /** Set when the slot becomes a real session. */
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    /** Who booked it, when there is an account. Null for a join-link booking. */
    bookedByAccountId: uuid("booked_by_account_id").references(() => patientAccounts.id, {
      onDelete: "set null",
    }),
    /**
     * What the patient said when booking. Shown to the clinician.
     *
     * 🔴 §6: **never edit text a patient wrote.** Nothing appends to this
     * column — not a marker, not a flag, not a suffix. `markReminded` writes
     * `remindedAt` instead, which is what C63 was: our bookkeeping glued into
     * a sentence somebody wrote about their own distress.
     */
    note: text("note"),

    /** 11R.6 — when the reminder went out. Replaces the ' [reminded]' marker. */
    remindedAt: timestamp("reminded_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("availability_slots_hour_unique").on(t.therapistUserId, t.startsAt),
    index("availability_slots_therapist_idx").on(t.therapistUserId, t.startsAt),
    // The public calendar's query: open slots in the future, by clinician.
    index("availability_slots_open_idx").on(t.startsAt).where(sql`status = 'open'`),
    // The reminder sweep: booked, soon, not yet reminded.
    index("availability_slots_reminder_idx")
      .on(t.startsAt)
      .where(sql`status = 'booked' AND reminded_at IS NULL`),
  ],
);

export type AvailabilitySlot = typeof availabilitySlots.$inferSelect;

/* ------------------------------------------------------- §3c · two rails -- */

/**
 * Which legal entity is holding a given cent. PLAN.md 16.9.
 *
 * Two entities, two bank accounts, two countries. A ledger that does not say
 * which one holds a balance cannot answer the only question a regulator or an
 * accountant will ask, and "we can work it out from the currency" is not an
 * answer — an Egyptian patient paying in EGP for a therapist on Connect is
 * money the *US* entity ends up owing.
 */
export const ENTITIES = ["us", "eg"] as const;
export type Entity = (typeof ENTITIES)[number];

/**
 * The four crossings of §3c, named. 16.7.
 *
 * They are enumerated rather than derived so that the two we are exposed on
 * are impossible to confuse with the two we are not — the names appear in the
 * ledger memo, in the payout queue and in the reconciliation report, and a
 * `grep` for `usd_stripe_to_manual` finds every place the risky path is taken.
 */
export const CROSSINGS = [
  /** Patient pays USD by card, therapist has Connect. Nothing is held. */
  "usd_stripe_to_connect",
  /** Patient pays EGP locally, therapist is Egyptian. Held by the EG entity. */
  "egp_local_to_manual",
  /** 🔴 Patient pays USD by card, therapist has no Stripe. We hold it. */
  "usd_stripe_to_manual",
  /** 🔴 Patient pays EGP locally, therapist is on Connect. We hold it. */
  "egp_local_to_connect",
] as const;
export type Crossing = (typeof CROSSINGS)[number];

export const PAYOUT_METHODS = ["instapay", "wallet", "stripe"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/**
 * Where a clinician's manual payout goes, and **who last touched it**.
 *
 * `editedByUserId` is not bookkeeping. C74: two-person approval above a
 * threshold, *and never the person who edited the payout details*. Somebody
 * who can change the destination account and then approve the payment to it is
 * a one-person fraud path, and the second signature is worthless if it is the
 * same signature. The column is what makes that rule checkable — by the
 * database, on the request row, at the moment of approval.
 *
 * The full name is stored **exactly as it appears on the receiving account**
 * (§3c). A transfer to "M. Ali" against an account registered to "Mohamed Ali
 * Hassan" is a transfer that bounces after a person has already done the work.
 */
export const payoutMethods = pgTable(
  "payout_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    method: text("method").$type<PayoutMethod>().notNull(),
    /** An IPA handle, a wallet number, or a Connect account id. */
    identifier: text("identifier").notNull(),
    /** The name on the receiving account, exactly. */
    accountName: text("account_name").notNull(),
    currency: text("currency").notNull().default("egp"),

    /** 🔴 C74's other half — who last changed where the money goes. */
    editedByUserId: uuid("edited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    editedAt: timestamp("edited_at", { withTimezone: true }).defaultNow().notNull(),

    isDefault: boolean("is_default").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("payout_methods_therapist_idx").on(t.therapistId),
    uniqueIndex("payout_methods_default_unique")
      .on(t.therapistId)
      .where(sql`is_default AND deleted_at IS NULL`),
  ],
);

export type PayoutMethodRow = typeof payoutMethods.$inferSelect;

/**
 * The statuses a therapist can watch. 16.2.
 *
 * Four forward states and one refusal. `requested` with no date is how trust
 * is lost (C74), so every one of them carries its own timestamp and the person
 * who caused it.
 */
export const PAYOUT_STATUSES = [
  "requested",
  "approved",
  "sent",
  "confirmed",
  "rejected",
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/**
 * A clinician asking for money we are holding. PLAN.md 16.2, 16.3, 16.3a–d.
 *
 * 🔴 **A payout request is a promise. Nothing may quietly fail.** That is why
 * this is a row with an age rather than a job that either runs or does not:
 * a stuck request is *visible* — to the therapist, to the queue, and to the
 * alert that goes out on a phone and an email when it ages (16.3b).
 */
export const payoutRequests = pgTable(
  "payout_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    /** Always in the settlement currency of the held balance: cents of USD. */
    amountCents: integer("amount_cents").notNull(),
    /** What we will actually send, in the payout currency. */
    payoutAmountMinor: integer("payout_amount_minor").notNull(),
    payoutCurrency: text("payout_currency").notNull().default("egp"),
    /** 16.6 — the rate is frozen here, with its timestamp. Never re-derived. */
    fxRateMicro: integer("fx_rate_micro"),
    fxQuotedAt: timestamp("fx_quoted_at", { withTimezone: true }),

    /** 16.9 — which entity's bank account this leaves from. */
    entity: text("entity").$type<Entity>().notNull().default("eg"),

    /*
     * The destination, **copied onto the request**.
     *
     * Not a foreign key alone: a payout is a photograph of where the money was
     * going when it was approved. If the therapist edits their IPA handle
     * between approval and sending, the sent transfer must still be auditable
     * against what the approver actually saw.
     */
    methodId: uuid("method_id").references(() => payoutMethods.id, { onDelete: "set null" }),
    method: text("method").$type<PayoutMethod>().notNull(),
    identifier: text("identifier").notNull(),
    accountName: text("account_name").notNull(),
    /** 🔴 C74 — snapshot of who last edited those details, for the CHECK. */
    detailsEditedByUserId: uuid("details_edited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    status: text("status").$type<PayoutStatus>().notNull().default("requested"),

    /** 16.3b — a named owner, so a stuck request belongs to somebody. */
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    /** When the ageing alert last went out. Null means it has not yet. */
    alertedAt: timestamp("alerted_at", { withTimezone: true }),

    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    rejectedReason: text("rejected_reason"),

    /** 16.3c — the transfer screenshot the therapist can see. */
    proofUrl: text("proof_url"),
    /** Set when the money left the books, so a reversal is traceable. */
    ledgerTxnId: uuid("ledger_txn_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("payout_requests_therapist_idx").on(t.therapistId, t.requestedAt),
    // The queue screen: open work, oldest first.
    index("payout_requests_open_idx")
      .on(t.requestedAt)
      .where(sql`status IN ('requested', 'approved', 'sent')`),
    index("payout_requests_status_idx").on(t.status, t.requestedAt),
  ],
);

export type PayoutRequest = typeof payoutRequests.$inferSelect;

/**
 * Every transition, attributable to a person. 16.2.
 *
 * The status columns above say where a request *is*; this says how it got
 * there and who moved it. A manual process is where the fraud is (C74), and a
 * queue with no history is a queue where a state can be walked backwards by
 * anybody with an UPDATE.
 */
export const payoutRequestEvents = pgTable(
  "payout_request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => payoutRequests.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").$type<PayoutStatus>(),
    toStatus: text("to_status").$type<PayoutStatus>().notNull(),
    /** Null only for the ageing alert, which the clock raises. */
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("payout_request_events_request_idx").on(t.requestId, t.createdAt)],
);

export type PayoutRequestEvent = typeof payoutRequestEvents.$inferSelect;

/* ----------------------------------------------- §3d · support tickets -- */

/**
 * What a ticket is about. 20.18 — chosen from a list, so the queue sorts.
 *
 * A free-text subject line cannot be triaged, counted or routed, and "Other"
 * with a paragraph under it is how the one urgent message in a hundred gets
 * read on Thursday. Sprint 21 makes the labels editable; the keys are stable
 * because a report that counts them has to survive a rename.
 */
export const TICKET_TOPICS = [
  "account",
  "billing",
  "my_record",
  "a_session",
  "a_therapist",
  "joining_as_a_therapist",
  "something_else",
] as const;
export type TicketTopic = (typeof TICKET_TOPICS)[number];

export const TICKET_STATUSES = ["open", "waiting_on_them", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/**
 * A message from a person, in a queue somebody owns. PLAN.md 18R.3, 20.18–20.22.
 *
 * ## 🔴 Why this is not an inbox
 *
 * §3d: *"an inbox nobody owns is how somebody in distress gets ignored for a
 * week."* Every row has a topic, an age, a named owner and a due time, for the
 * same reason a payout request does (C74) — the failure mode of manual work is
 * not "wrong", it is "nobody picked it up".
 *
 * ## 🔴 Why the message is clinical material
 *
 * 18R.4 and C82. The person filling in the contact form is not signed in and
 * may well be a patient describing a session, a diagnosis or a crisis. The
 * moment it lands it is health information arriving through a non-clinical
 * door, so it is stored here — not emailed onward (§6), not summarised into a
 * notification, and **never placed in a prompt**. `lib/data/support.ts` is the
 * only module that reads `message`, and the copilot cannot import it.
 */
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** A short human reference to quote back. Not a UUID in an email. */
    reference: text("reference").notNull(),

    /** `contact_form` is the anonymous public door; the others are signed in. */
    source: text("source")
      .$type<"contact_form" | "patient" | "therapist">()
      .notNull()
      .default("contact_form"),

    /*
     * Who wrote it, as far as we know — which for the public form is only what
     * they typed. Deliberately NOT resolved to a person or an account at
     * intake: matching "ahmed@…" to a patient record would be exactly the
     * auto-merge C39 measured and forbade, on weaker evidence.
     */
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    /** Set only when the sender was signed in as one. Never inferred. */
    patientAccountId: uuid("patient_account_id").references(() => patientAccounts.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    topic: text("topic").$type<TicketTopic>().notNull(),
    message: text("message").notNull(),
    /** The language they wrote in, so the reply comes back in it (18R.8). */
    locale: text("locale").notNull().default("en"),
    /** 18R.6 — which company they addressed. Both are always reachable. */
    entity: text("entity").$type<Entity>().notNull().default("us"),

    /**
     * 🔴 20.24 — which queue this belongs in, and they are not one queue.
     *
     * *"A therapist chasing a payout and a patient in distress are different
     * jobs with different clocks, and one list sorted by age puts them in the
     * wrong order."* Recorded on the row rather than derived from `source`,
     * because a therapist can write in through the public form too and the
     * queue must not depend on which door they happened to use.
     */
    audience: text("audience").$type<"patient" | "therapist">().notNull().default("patient"),

    /*
     * 20.25 — what the ticket is *about*, when it is about something.
     *
     * Staff should never have to work from "the payment did not arrive" with
     * nothing attached. Nullable because most tickets reference nothing, and
     * `set null` because deleting a payout request must not delete the
     * conversation about it.
     */
    relatedSessionId: uuid("related_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    relatedPayoutRequestId: uuid("related_payout_request_id").references(
      () => payoutRequests.id,
      { onDelete: "set null" },
    ),

    /**
     * 🔴 20.21 — a ticket that moved to WhatsApp says so, and comes back.
     *
     * A conversation we cannot see is not a record. Moving is allowed — it is
     * often the humane thing at 3am — but it is *recorded as having moved*,
     * and a written summary has to be brought back before the ticket can
     * close, which `closeTicket` enforces.
     */
    movedToWhatsappAt: timestamp("moved_to_whatsapp_at", { withTimezone: true }),
    whatsappSummary: text("whatsapp_summary"),

    /**
     * 🔴 20.22 / 20.26 — the close link, and why it is a token and not a copy.
     *
     * On close the sender gets a **link to a page that authenticates**, never
     * the correspondence in an email: an email carrying the conversation is
     * patient data leaving the building (§6), and one carrying the
     * conversation but not the attachments is the half-measure that drifts
     * back to "just include the summary". The token identifies the ticket; the
     * page still demands a code sent to the handle on the ticket before it
     * shows anything.
     */
    accessToken: text("access_token"),
    accessCodeHash: text("access_code_hash"),
    accessCodeExpiresAt: timestamp("access_code_expires_at", { withTimezone: true }),

    status: text("status").$type<TicketStatus>().notNull().default("open"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),

    /*
     * 20.20 — a 24-hour clock that **pauses while we are waiting on them**.
     *
     * `dueAt` is the deadline; `waitingSince` is when the clock stopped
     * because the ball is in their court. Staff are measured on their own
     * delay (C83), and a queue that counts a patient's four-day silence
     * against the person who answered in ten minutes is a queue that teaches
     * people to close tickets early.
     */
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    waitingSince: timestamp("waiting_since", { withTimezone: true }),
    extendedAt: timestamp("extended_at", { withTimezone: true }),
    extensionReason: text("extension_reason"),

    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByUserId: uuid("closed_by_user_id").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("support_tickets_reference_unique").on(t.reference),
    // The queue screen: open work, oldest first.
    index("support_tickets_open_idx")
      .on(t.dueAt)
      .where(sql`status <> 'closed'`),
    index("support_tickets_topic_idx").on(t.topic, t.createdAt),
    index("support_tickets_owner_idx").on(t.ownerUserId, t.status),
    // 20.24 — the two queues are two index scans, not one list filtered in JS.
    index("support_tickets_audience_idx")
      .on(t.audience, t.dueAt)
      .where(sql`status <> 'closed'`),
    uniqueIndex("support_tickets_access_token_unique").on(t.accessToken),
  ],
);

export type SupportTicket = typeof supportTickets.$inferSelect;

/** Every move on a ticket, attributable. Same reason as `payout_request_events`. */
export const supportTicketEvents = pgTable(
  "support_ticket_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    kind: text("kind")
      .$type<"created" | "claimed" | "replied" | "waiting" | "extended" | "moved" | "closed">()
      .notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("support_ticket_events_ticket_idx").on(t.ticketId, t.createdAt)],
);

export type SupportTicketEvent = typeof supportTicketEvents.$inferSelect;

/* --------------------------------------------- §3d · phone-number changes -- */

export const PHONE_CHANGE_STATUSES = [
  "requested",
  "approved",
  "verifying",
  "done",
  "refused",
] as const;
export type PhoneChangeStatus = (typeof PHONE_CHANGE_STATUSES)[number];

/**
 * A patient changing the number their whole identity hangs on. PLAN.md 20.13–20.17.
 *
 * ## 🔴 Why this is a queue and not a settings field
 *
 * §3b makes the phone number the identity. Letting somebody change it in the
 * app is letting them move an account to a number they have proved nothing
 * about — and the person who most wants to do that is not the account's owner.
 * So it is a request, a human check, and a code sent to the **new** number.
 *
 * ## The 24-hour correction (20.14)
 *
 * A mistyped digit is not a change of number, and treating it as one traps
 * somebody outside their own record for ninety days over a typo. The lock
 * starts when a number is *confirmed*, and a correction inside the first day
 * after signup is free.
 */
export const phoneChangeRequests = pgTable(
  "phone_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientAccountId: uuid("patient_account_id")
      .notNull()
      .references(() => patientAccounts.id, { onDelete: "cascade" }),

    oldPhone: text("old_phone").notNull(),
    newPhone: text("new_phone").notNull(),
    /** 20.13 — in the patient's own words. Never summarised by staff. */
    reason: text("reason").notNull(),
    /** 20.13 — their explicit permission to contact the new number. */
    contactConsent: boolean("contact_consent").notNull().default(false),

    status: text("status").$type<PhoneChangeStatus>().notNull().default("requested"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),

    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    /*
     * 20.16 — the code goes to the NEW number and is entered in the app.
     *
     * Hashed, like every other credential here: a staff member reading the
     * table must not be able to complete a change they approved, which is the
     * same two-person reasoning as C74's payouts one table away.
     */
    verificationHash: text("verification_hash"),
    verificationSentAt: timestamp("verification_sent_at", { withTimezone: true }),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    refusedReason: text("refused_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("phone_change_open_idx")
      .on(t.createdAt)
      .where(sql`status IN ('requested', 'approved', 'verifying')`),
    // One live request per account. Two in flight is two codes to two numbers.
    uniqueIndex("phone_change_one_open")
      .on(t.patientAccountId)
      .where(sql`status IN ('requested', 'approved', 'verifying')`),
  ],
);

export type PhoneChangeRequest = typeof phoneChangeRequests.$inferSelect;

/* ------------------------------------------- §3d · support attachments -- */

/**
 * What somebody attached to a ticket. PLAN.md 20.19, C82.
 *
 * 🔴 **Stored, audited and access-controlled exactly like sprint 8's
 * documents, and never in a prompt.** A patient photographing a prescription
 * for a support agent has just sent a medical record through a non-clinical
 * door; the door does not change what it is.
 *
 * The bytes live in blob storage and this row is the record of them — same
 * arrangement as `person_documents`, so there is one story about where
 * uploaded clinical material lives rather than two.
 */
export const supportAttachments = pgTable(
  "support_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),

    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    storageKey: text("storage_key").notNull(),

    /** Null when the sender uploaded it; set when a staff member did. */
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("support_attachments_ticket_idx").on(t.ticketId, t.createdAt)],
);

export type SupportAttachment = typeof supportAttachments.$inferSelect;
