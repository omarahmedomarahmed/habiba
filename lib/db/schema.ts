import { sql } from "drizzle-orm";

import type { Region } from "./region";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
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
/**
 * 🔴 42.3 / 42.7 — HOW something reached us, as distinct from WHO did it.
 *
 * `partner_api` is a partner's own server calling with a key. `partner_launch` is
 * a clinician inside an embedded widget, who is a real clinician doing a real
 * thing and is reached through the partner's product. The two have to be
 * distinguishable in an audit, because "their server read this chart" and "Dr X
 * read this chart from inside their product" are different events with different
 * answers, and 42.7 asks for the second one by name.
 *
 * Declared before `ROLES` because `audit_log` and `auth_sessions` are declared
 * near the top of this file and both carry it.
 */
export const AUDIT_VIA = ["partner_api", "partner_launch"] as const;
export type AuditVia = (typeof AUDIT_VIA)[number];

/**
 * 🔴 42.6 — who pays for a practice's sessions.
 *
 * `self` on every existing row, which is what they are: a clinician who signed up
 * pays their own platform fee. `partner_billed` sends the bill to the partner who
 * brought them, as one monthly aggregate.
 *
 * 🔴 AGGREGATE for the same reason a clinic's is (C263): an itemised partner
 * invoice would disclose which of a small caseload consented to recording, and
 * the argument does not weaken because the payer is a platform rather than an
 * employer.
 */
export const BILLING_MODES = ["self", "partner_billed"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

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
 * 🔴 Sprint 57 — `starter` and `growth` are gone and `practice` and `clinic`
 * are here, and NOTHING WAS MIGRATED, deliberately.
 *
 * The column is plain `text` with no check constraint, so a row still saying
 * `growth` is legal in the database. `tierByKey` fails closed to the free tier
 * for a key the settings no longer name, which is the correct outcome for a
 * therapist whose old rate lock no longer exists: they go back to the free door
 * and pay per session, rather than throwing or inheriting a tier by position.
 *
 * A rewrite would have had to decide what a $60 rate lock is worth in a world
 * of monthly subscriptions, and any answer to that is a refund question rather
 * than a data question. Leave the rows alone and let the money be discussed.
 */
export const PLANS = ["payg", "practice", "clinic"] as const;
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
    /**
     * 🔴 The jurisdiction this practice's own rows live in. 30.1, C118.
     *
     * `'us'` on every existing row, which is a statement of where they already
     * are rather than a backfill. A practice's region governs its sessions,
     * settings and payouts; a patient's chart is routed on the PATIENT (C154),
     * because an Egyptian person seeing an American clinician is ordinary here.
     */
    region: text("region").$type<Region>().notNull().default("us"),

    /**
     * 🔴 54.1 / C259 — A CLINIC IS THIS ROW. See the sprint 54 block at the end of
     * this file for why a sponsor is not, and why the two must not share a table.
     *
     * `solo` on every existing row, which is what they are: one clinician who
     * signed up for themselves, an organisation of one (C266). A clinic is the
     * same shape with more than one clinician in it and a manager who is not one.
     */
    kind: text("kind").$type<OrganizationKind>().notNull().default("solo"),

    /**
     * 🔴 54.3 — held, active, suspended, closed, and NULL on a solo row.
     *
     * Null rather than `active`, because a solo practice was never held and never
     * approved: the clinician's own licence verification is the gate, and
     * back-filling a state they were never in would be a lie in a column an
     * operator reads.
     */
    clinicState: text("clinic_state").$type<ClinicState>(),

    /**
     * 🔴 42.6 — WHOSE PRACTICE THIS IS, when a partner brought it.
     *
     * Null on every practice that signed up for itself, which is all of them
     * today. Set when a partner's launch creates one, so `billing_mode` can send
     * the bill to the partner instead of the clinician (42.6's monthly aggregate).
     *
     * 🔴 It is a `partners` reference and NOT a tenancy. A partner is outside the
     * boundary: this column says who PAYS, and the caseload inside the practice
     * belongs to the clinicians in it exactly as it does anywhere else. C277 is
     * the same point from the patient's side.
     */
    partnerId: uuid("partner_id").references((): AnyPgColumn => partners.id, {
      /* 🔴 0082 — a CHECK requires this non-null when billing_mode is partner_billed, so SET NULL made a partner undeletable with an error naming the wrong table. 42.1's path for a departing integrator is state = 'closed'. */
      onDelete: "restrict",
    }),
    billingMode: text("billing_mode").$type<BillingMode>().notNull().default("self"),

    /* 54.3 — the contact, for the call that happens before anything is activated. */
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("organizations_region_idx").on(t.region),
    /* 54.3 — the admin queue's query: every clinic awaiting a decision. */
    index("organizations_clinic_idx").on(t.kind, t.clinicState),
    /* 42.6 — the partner's monthly aggregate invoice reads this. */
    index("organizations_partner_idx").on(t.partnerId),
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

    /**
     * 🔴 42.3 — A LAUNCH MINTS ONE OF THESE, SO THERE STAYS EXACTLY ONE WAY TO BE
     * SIGNED IN.
     *
     * *A launch mints a short-lived `auth_sessions` row with `partner_id` and
     * `created_via`, so every existing screen works unchanged and the audit names
     * the partner.*
     *
     * That is the whole design and it is worth saying why it beats the
     * alternative. A second session mechanism for embedded clinicians would mean
     * every guard in the product growing an "or a partner launch" branch, and the
     * day one of them forgot is the day a widget reaches a screen it should not.
     * Instead a launched clinician IS signed in, ordinarily, with a row that
     * remembers where they came from and expires sooner.
     */
    partnerId: uuid("partner_id").references((): AnyPgColumn => partners.id, {
      /* 🔴 0082 — a launched session exists only because of the launch that made it, and RESTRICT would hold a company's row hostage to a credential that expires in an hour. */
      onDelete: "cascade",
    }),
    createdVia: text("created_via").$type<AuditVia>(),

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
    /**
     * 🔴 22.9 — `NOT NULL` since 0054, once the purge made the scan free.
     *
     * All three functions that create a session mint one; the nullable column
     * was a fact about the rows that existed in August, not about the rule.
     */
    feedbackToken: text("feedback_token").notNull(),

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
    /**
     * 🔴 37.2 — which acoustic voice said this line, when one was separated.
     *
     * Null for every row written before sprint 37 and for every two-track
     * capture, which needs no diarisation. When it is set, migration 0065's
     * trigger refuses any `speaker` that disagrees with the voice: a voice
     * nothing proves may only carry `unknown`.
     */
    voiceId: uuid("voice_id").references((): AnyPgColumn => sessionVoices.id, {
      onDelete: "set null",
    }),
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

/**
 * 🔴 How a note came to exist. 47.1, C212.
 *
 * Ordered from most to least externally corroborated, which is the order the
 * badge reads in and NOT a ranking of clinical quality. 47.5 is explicit that
 * a hand-written note is differently sourced rather than weaker evidence, and
 * the evidence screen keeps `clinician` at source priority 1.
 */
export const NOTE_PROVENANCES = ["transcript", "partial", "clinician"] as const;
export type NoteProvenance = (typeof NOTE_PROVENANCES)[number];

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

    /**
     * 🔴 47.1 / C212 — how this note was made. Evidence, or recollection.
     *
     * A future therapist reads eight notes and, without this, has no way to
     * tell that three of them rest on a colleague's memory of a session
     * nobody recorded. That is the difference between evidence and hearsay,
     * presented identically, in a clinical record somebody may act on.
     *
     *   transcript  the whole session was captured
     *   partial     consent was given and the clinician went off record for
     *               part of it. `offRecordSeconds` says how long, because
     *               "partially recorded" without a duration is a badge nobody
     *               can act on (47.2, C213)
     *   clinician   no recording. Written from memory, which is what every
     *               paper record in the world is and is not a lesser thing
     *
     * 🔴 `clinician` is the DEFAULT, and that is a decision. It is the honest
     * answer rather than the flattering one: a note whose origin we cannot
     * establish is a note nobody can vouch for a transcript behind.
     */
    provenance: text("provenance")
      .$type<NoteProvenance>()
      .notNull()
      .default("clinician"),
    /** 47.2 — only meaningful on `partial`. Null everywhere else. */
    offRecordSeconds: integer("off_record_seconds"),

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

    /**
     * 🔴 35.1 — the findings, each with the sentence that produced it.
     *
     * `indicators` holds labels; this holds evidence. A clinician reading an
     * alert needs the quote more than the label: "ideation" is a word a system
     * produced, and "ideation, because he said *I just want to go to sleep and
     * not wake up*" is something a person can act on or recognise as a misread
     * idiom. Same rule as 8.9's source sentence and 33.1's evidence quote.
     */
    findings: jsonb("findings")
      .$type<{ indicator: string; quote: string; confidence: number }[]>()
      .default([])
      .notNull(),
    /** Which model said so. A record that cannot be audited backwards is not one. */
    model: text("model"),
    /**
     * Findings dropped for quoting something the transcript does not contain.
     *
     * Counted because it is invisible by construction: a dropped finding leaves
     * no trace in the output, so without this the rate at which the classifier
     * invents a sentence is a number nobody has.
     */
    unquotedFindings: integer("unquoted_findings").notNull().default(0),

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
    /**
     * 26.9 / C127 — what a third party can check, and all they can check.
     *
     * Printed on the cover page and resolved on a public page. It attests what
     * we can honestly attest: that this platform holds a record, how much of
     * one, and when the extract was made. It never resolves to a name, a
     * diagnosis or a note, because that is the difference between a record
     * extract and the certificate this is not.
     */
    verificationCode: text("verification_code"),
    /** The identity the extract is about. Null on rows predating sprint 26. */
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
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
     * 🔴 49.14a / C221 — who the call was ABOUT, which is not who made it.
     *
     * `userId` is the clinician whose request it was. This is the person the
     * model was reasoning about, and without it 49.8's per-patient cost cannot
     * be computed at all: a copilot call and a note generation both belong to
     * a therapist and to a patient, and only one of those was recorded.
     *
     * ## 🔴 C280 — what this column makes possible, and what it must never do
     *
     * A timestamped record of every model call concerning a person, queryable
     * by person. That is a new kind of row in this database and it is worth
     * naming before somebody finds a use for it: the shape of somebody's care
     * is legible in the timing and volume of these rows even though not one of
     * them contains a clinical word.
     *
     * It exists for INTERNAL COST ACCOUNTING and nothing else. Never
     * patient-facing, never clinic-facing, never sponsor-facing, and inside
     * C244 from the day sponsors exist: no screen may join it to a sponsor.
     *
     * `set null` rather than `cascade`, deliberately. Deleting a patient must
     * not delete what their care cost us, because a cost that disappears when
     * a row does is how a margin goes wrong quietly (C221) and because the
     * money is ours rather than theirs.
     */
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
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
     * ⚠️ DEPRECATED. 49.14 / C279. Do not read this column.
     *
     * Rounding every cost into whole cents recorded zero for 91% of calls —
     * a transcription chunk is 0.15 cents and a mini copilot call is 0.014.
     * `costMicrocents` replaced it and every reporting path reads that.
     *
     * 🔴 It said "no longer the number anything reads", and that was not true:
     * `lib/data/admin.ts` summed it in three places while `lib/data/vault.ts`
     * summed `costMicrocents`, so two admin screens reported different totals
     * for the same calls, in production, for four sprints. Measured on the
     * verification database: 6 cents against 4, over twelve calls, with six of
     * them rounded to zero.
     *
     * The error runs in BOTH directions, which is why neither screen looked
     * obviously wrong. `Math.round(microcents / 1000)` per row sends a 0.6c
     * call up to 1c and a 0.4c call down to 0, so the lossy total is higher
     * than the true one on a run of medium calls and lower on a run of tiny
     * ones. A comment claiming nothing reads a column is not a fact about the
     * code; `verify:sprint49` now asserts it.
     *
     * Still WRITTEN, because something outside this repository may read it and
     * a column that silently stops moving is worse than one nobody reads.
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
    // 49.8 — cost by patient, over a range, which is the query Total View asks.
    index("ai_request_logs_patient_idx").on(t.patientId, t.createdAt),
  ],
);

// ----------------------------------------------------------------- billing ---

export const RENEWAL_STATES = ["due", "paid", "lapsed", "void"] as const;
export type RenewalState = (typeof RENEWAL_STATES)[number];

export const RENEWAL_RAILS = ["stripe", "egypt_gateway", "manual"] as const;
export type RenewalRail = (typeof RENEWAL_RAILS)[number];

/**
 * 🔴 59.13 / C310 / C341 — A SUBSCRIPTION IS AN OBLIGATION WE OWN, AND STRIPE IS
 * ONE WAY TO SETTLE IT.
 *
 * `subscriptions` below is a MIRROR of a Stripe object: a plan key, a status
 * string Stripe chose, a period end Stripe told us about. `entitledTier` read
 * it and therefore read Stripe, one table removed. Two things were wrong with
 * that and only the second is about Egypt.
 *
 * ## 🔴 ONE: A MISSED CALLBACK WAS A CANCELLED PLAN
 *
 * `mirrorSubscription` writes what the webhook says. A webhook that never
 * arrives leaves the row saying whatever it said last, and a period end in the
 * past reads as not entitled. So a clinician who paid could lose their plan
 * because our endpoint was down for an hour, and nothing anywhere would say
 * why. C294 already ruled that entitlement is the period paid for rather than a
 * gateway status; this is the row that makes it true rather than asserted.
 *
 * ## 🔴 TWO: THERE IS NO STRIPE IN EGYPT
 *
 * An Egyptian renewal is an invoice and a payment link through the Egyptian
 * gateway. If the only shape a subscription has is Stripe's, the Egyptian rail
 * needs a parallel billing model — which C226 refused once already for the
 * corporate pot, in the sentence *"a payment method, not a billing system"*.
 *
 * So: a due date, an amount, a currency, a state in OUR vocabulary, and a
 * nullable reference to whatever settled it.
 */
export const renewalObligations = pgTable(
  "renewal_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /**
     * 🔴 A key, not a foreign key. A retired plan must not take a paid
     * obligation down with it, and `entitledTier` already refuses to grant
     * anything for a plan key that no longer exists in settings.
     */
    plan: text("plan").notNull(),

    /** The amount is a decision; the currency is a fact about where the payer is. */
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").$type<"usd" | "egp">().notNull(),

    /** C294, as two columns: entitlement is the period paid for. */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),

    /**
     * 🔴 OUR vocabulary, never a gateway's. `due` is unpaid and not yet late,
     * `lapsed` is a due date that passed unpaid, `void` is one we cancelled on
     * a plan change or a write-off. Mapping Stripe's words into these is the
     * gateway adapter's job and happens once.
     */
    state: text("state").$type<RenewalState>().notNull().default("due"),

    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /**
     * 🔴 Which rail settled it, null until something does. That nullability is
     * the point of the table: the obligation exists before anybody pays it,
     * which is what lets a reconciler find an obligation with no transaction
     * and a transaction with no obligation (59.15).
     */
    settledVia: text("settled_via").$type<RenewalRail>(),
    settledRef: text("settled_ref"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /*
     * 🔴 One live obligation per organisation per period. Two rows for one
     * month is how a reconciler finds a double charge, so the database refuses
     * to create the ambiguity rather than reporting it afterwards.
     */
    uniqueIndex("renewal_obligations_period_unique")
      .on(t.organizationId, t.periodStart)
      .where(sql`state <> 'void'`),
    index("renewal_obligations_org_period_idx").on(t.organizationId, t.periodEnd),
    index("renewal_obligations_due_idx").on(t.state, t.dueAt).where(sql`state = 'due'`),
    index("renewal_obligations_settled_idx")
      .on(t.settledVia, t.settledRef)
      .where(sql`settled_ref IS NOT NULL`),
  ],
);

export type RenewalObligation = typeof renewalObligations.$inferSelect;

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
 * What a session bill is made of. PLAN.md 46.1, 46.13, C209, C251.
 *
 * ## Why a child table and not two invoices
 *
 * 46.1 asked for "two line items on one invoice" as an additive migration.
 * It cannot be one. `invoices_session_unique` above permits exactly one
 * invoice row per session, and it is not decoration: it exists because the
 * reconciler cron and a live completion raced each other and produced two
 * charges for one session, and it plus `ON CONFLICT DO NOTHING` is what makes
 * that race a no-op.
 *
 * So there were two options and only one of them is safe. Dropping the index
 * buys the shape and gives back the double charge. This keeps the index, keeps
 * one invoice per session, and puts the composition underneath it.
 *
 * ## What a line is
 *
 *   platform   🔴 charged on EVERY session. Free ones, in-person ones, and the
 *              ones where the patient refused recording. It buys the record,
 *              the booking, the reminders, the radar placement, the note
 *              storage and the free in-room copilot.
 *   ai         charged only where `sessions.recording_consent = 'granted'`.
 *
 * The split is not a pricing tweak. A single fee that vanishes when a patient
 * declines gives a therapist a financial reason to lean on the most vulnerable
 * person in the room, and a fee of zero gives away hosted HIPAA-grade video to
 * anybody who never asks for consent. The platform fee being **unavoidable**
 * is the whole protection (C209); the AI fee being conditional is not.
 *
 * `amountCents` on the parent stays the total and stays the thing the ledger,
 * the checkout and every existing report read, so nothing downstream had to
 * learn about this table to keep working.
 */
export const INVOICE_LINE_KINDS = ["platform", "ai"] as const;
export type InvoiceLineKind = (typeof INVOICE_LINE_KINDS)[number];

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

    kind: text("kind").$type<InvoiceLineKind>().notNull(),
    amountCents: integer("amount_cents").notNull(),

    /**
     * The tier in force when this line was raised, and what it unlocked.
     *
     * Copied in rather than looked up, for the reason `session_credits` gives:
     * the rate is a fact about the moment the session completed. An admin who
     * changes the AI rate changes what the *next* session bills; this line is
     * already history.
     */
    tierKey: text("tier_key"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /*
     * 🔴 One line of each kind per invoice.
     *
     * The same argument as `invoices_session_unique` one level down: the
     * reconciler (46.14) now backfills a MISSING line rather than a missing
     * invoice, so it races a live completion in exactly the way the parent
     * used to. Without this, a session whose AI fee was slow gets two AI fees.
     */
    uniqueIndex("invoice_lines_invoice_kind_unique").on(t.invoiceId, t.kind),
    index("invoice_lines_kind_idx").on(t.kind, t.createdAt),
  ],
);

export type InvoiceLine = typeof invoiceLines.$inferSelect;

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
/**
 * 🔴 Where the money for a session came from. 53.10, C226, C244.
 *
 * Two values, and `pot` is deliberately not a session TYPE. See the column.
 */
export const FUNDING_SOURCES = ["card", "pot"] as const;
export type FundingSource = (typeof FUNDING_SOURCES)[number];

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
    /**
     * 🔴 60.2 / C311 — THE EMPLOYER PERCENTAGE AS IT STOOD AT BOOKING, FROZEN.
     *
     * Never re-read from the pot. The obvious build reads `coverage_bps` when
     * the money moves, and then an employer lowering their percentage on a
     * Tuesday changes what a patient owes for a session they agreed to on
     * Monday. A price somebody was shown is a price they are owed.
     *
     * 🔴 THREE NUMBERS, NOT ONE, and the two shares are the reason.
     *
     * A percentage alone does not survive a rounding argument: computing both
     * shares from one percentage gives two numbers that are each defensible and
     * do not always sum, and the cent falls out of the books in a direction
     * nobody chose. One is computed, the other is the remainder, both are
     * stored, and `session_payments_shares_sum` refuses the alternative.
     *
     * A refund then apportions on the figures the patient was actually shown
     * rather than on a percentage that may since have moved (C315).
     */
    coverageBps: integer("coverage_bps").notNull().default(0),
    sponsorShareCents: integer("sponsor_share_cents").notNull().default(0),
    patientShareCents: integer("patient_share_cents").notNull().default(0),
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

    /**
     * 🔴 53.10 / C226 — THE ONE NEW FUNDING SOURCE, and it is one column.
     *
     * *The pot stands in for the patient's card and nothing else changes.* So
     * there is no `sessionType`, no corporate invoice path and no second
     * ledger: a sponsored payment is a `session_payments` row like any other,
     * whose money came from a pot instead of a card.
     *
     * 🔴 NOT NULLABLE-AS-A-SIGNAL. `card` is the default and every existing
     * row is one, which is exactly what those payments were. A null here would
     * make "sponsored" an ABSENCE, and C243 is the eighth occurrence of the
     * §6 family for precisely that reason: an absence is what a clinician finds
     * by sorting a column.
     *
     * 🔴 And there is NO sponsor id here. C244: no screen in this product, the
     * admin console included, may join a sponsor to a session, a booking, a
     * date or a patient name. A `sponsorId` on the payment row would make that
     * join one line of SQL away, forever, for every operator. The pot's own
     * ledger entries carry the sponsor; the session's payment carries only that
     * it was funded.
     */
    fundingSource: text("funding_source").$type<FundingSource>().notNull().default("card"),

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
  /*
   * 🔴 53.10 / C226 — ONE new account, and one is the ruling.
   *
   * A prepayment from a corporate counterparty, held for months, spent by third
   * parties. Every pot cent traces to one payment in and one session out in
   * this ledger, and the daily reconciliation covers it (53.16, C232).
   *
   * It is a liability, like `therapist_payable`: the money is somebody else's
   * until a session spends it. C232 puts that in front of counsel before the
   * second deal rather than the twentieth, and C232's amendment makes one
   * question — whether unspent pot balance is a liability we may hold — a
   * precondition of ticket 53.10 rather than a parallel task.
   */
  "sponsor_pot",
  /**
   * 🔴 TAX WE COLLECTED AND HAVE NOT REMITTED. A liability, like the two above it.
   *
   * The patient's own bill says, in both languages, *"VAT, paid to the
   * government"*. Until this account existed nothing in the books recorded a
   * penny of it. `sessionMoney` adds VAT on top of the price, Stripe charges it
   * as its own line, the money arrives, and `postSessionPayment` journalled
   * `cash` at the price WITHOUT the tax. So the ledger's cash was short by every
   * VAT cent we were holding, and the amount owed to a tax authority was a number
   * that existed on an invoice and in no account.
   *
   * That is not a rounding problem. It is the difference between money that is
   * ours and money we are keeping for somebody else, which is exactly the
   * distinction `therapist_payable` and `sponsor_pot` exist to make. The
   * reconciliation that covers those two could not cover this one.
   *
   * 🔴 NOT posted on a destination charge, and that is a decision rather than an
   * omission: see the comment in `postSessionPayment`.
   */
  "vat_payable",
  /**
   * 🔴 59.19 / C339 — FX DIFFERENCE, because a transfer at a frozen rate does
   * not reconcile to the cent.
   *
   * §3c freezes the rate onto a transaction so a receipt and a refund read the
   * same number. That is right, and it has a consequence: money collected in
   * EGP at Tuesday's rate and moved to the US entity on Friday arrives as a
   * different number of dollars than Tuesday said it would.
   *
   * Without an account for it, an `entity_transfer` would either fail to
   * balance — which `journal` refuses outright — or the difference would be
   * quietly absorbed into `platform_revenue`, where it would read as margin we
   * earned rather than as a currency movement we did not choose. The second is
   * worse: a business decision made by rounding.
   *
   * It is an expense-shaped account and it goes both ways: a favourable
   * movement is a negative amount here, which is the same convention
   * `platform_expense` carries.
   */
  "fx_difference",
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
  /**
   * 🔴 53.11 — a sponsor put money into their pot. Cash in, liability up.
   *
   * The only new kind sprint 53 adds, and it is money IN. Money out of a pot is
   * an ordinary `session_payment` sharing one `txn_id` with the pot leg, which is
   * what C226's "no parallel invoice path" means in practice and what makes
   * 53.16's trace from a pot cent to a session possible at all.
   *
   * `ledger_entries.txn_kind` carries no CHECK constraint, so this needs no
   * migration. That is worth stating rather than assuming: the sprint 56 defect
   * was an enum extended in TypeScript whose database CHECK was not, which made
   * a whole verifier check dead while it read green.
   */
  "pot_topup",
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
    /**
     * 🔴 The SPONSOR PORTAL USER who did it. Added in 0086, four sprints late.
     *
     * The paragraph above says "exactly one of the two is set on any row", and
     * it was written when there were two principals. A sponsor user ends
     * somebody's benefit, changes the identifier gate, tops the pot up and
     * rotates the joining code, and until 0086 not one of those acts was
     * written down anywhere. `removeFromRoster` even takes `bySponsorUserId`
     * with the comment "for `audit`" and passed it to nothing.
     *
     * 🔴 A row here says what a payer DID. It never says what a payer may SEE:
     * C244's wall is untouched by this column, and nothing joins it to a
     * session, a date or a therapist.
     */
    actorSponsorUserId: uuid("actor_sponsor_user_id").references(
      (): AnyPgColumn => sponsorUsers.id,
      { onDelete: "set null" },
    ),
    /**
     * 🔴 The CLINIC MANAGER who did it. Added in 0086 for the same reason.
     *
     * Inviting a clinician commits the practice to paying for their sessions,
     * and removing one moves a colleague to their own practice and disconnects
     * the clinic's meeting accounts. Both are consequential and neither left a
     * trace.
     *
     * 🔴 Rows written with this column carry NO `patient_id`, ever. A clinic
     * manager is inside the tenancy and sees none of the clinical record, so an
     * audit row naming one beside a patient would be recording a read that
     * cannot happen.
     */
    actorClinicManagerId: uuid("actor_clinic_manager_id").references(
      (): AnyPgColumn => clinicManagers.id,
      { onDelete: "set null" },
    ),
    category: text("category").$type<AuditCategory>().notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: uuid("resource_id"),
    /**
     * 🔴 The resource that is **not** a row with a UUID.
     *
     * A settings group ("pricing"), a taxonomy entry ("language:ar"), a string
     * override ("common.continue:ar"). Those are real resources with real
     * audit trails and no UUID, and writing one into `resource_id` throws —
     * which, because `audit()` deliberately does not swallow, means the whole
     * action fails. Found in sprint 21 while auditing a string save; the
     * taxonomy editor from sprint 1 had the same bug and every edit through it
     * was failing at the audit write.
     *
     * `audit()` routes the value to whichever column can hold it, so no caller
     * changes and both are queryable.
     */
    resourceKey: text("resource_key"),
    patientId: uuid("patient_id"),
    reason: text("reason"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    /**
     * 🔴 42.7 — so "who read this" answers "THEIR SERVER, ON BEHALF OF DR X".
     *
     * Both columns, because either alone is a worse answer than none. `partnerId`
     * without `via` cannot tell a partner's own server call from a clinician
     * clicking inside an embedded widget; `via` without `partnerId` says a call
     * came through an integration and not which one.
     *
     * Null on every row written before the partner plane and on every row a
     * clinician writes in our own product, which is what those rows were.
     */
    partnerId: uuid("partner_id").references((): AnyPgColumn => partners.id, {
      onDelete: "set null",
    }),
    via: text("via").$type<AuditVia>(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_org_idx").on(t.organizationId, t.createdAt),
    /* "What did this practice do" and "what did this payer do", newest first. */
    index("audit_log_sponsor_actor_idx").on(t.actorSponsorUserId, t.createdAt),
    index("audit_log_clinic_actor_idx").on(t.actorClinicManagerId, t.createdAt),
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
  /*
   * 28.6 — the two screens sprint 26 gave the patient, shown as themselves.
   *
   * The clinical summary is the portability argument made visible: two
   * clinicians, two versions, both with names on them. The journal is the
   * other half, what the person wrote. Both are real components driven by
   * invented people, which is the only kind of demonstration this site ships.
   */
  "summary",
  "journal",
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

  /**
   * 🔴 21R.8 / C98 / 0088 — THE CRISIS LINE, AS DATA, WHICH `lib/crisis/line.ts`
   * TOLD US TO DO AND NOBODY DID.
   *
   * That module carries a warning it wrote about itself in sprint 21R: the line
   * *"belongs in `country_settings` beside the payment rail, and adding it there
   * is the fix rather than growing this list from memory."* Its table still has
   * one entry, the United States, and Egypt is the first market. An Egyptian
   * patient in crisis is shown "call your local emergency number", which is
   * honest and is not a number.
   *
   * 🔴 SEEDED EMPTY, and that is the ruling rather than laziness. The same
   * module: *"a WRONG crisis number is worse than none."* A number recalled by
   * whoever wrote the migration is precisely what that forbids. An operator
   * enters each one with a phone in their hand, and the admin screen lists every
   * enabled country that still has none.
   *
   * 🔴 TWO COLUMNS. The label is what a reader sees, the tel is what the dialler
   * dials, and they are different strings for any line published with spaces.
   * A `tel:` built by stripping characters out of a display label is a guess
   * about a phone number, made at the worst possible moment.
   */
  crisisLineLabel: text("crisis_line_label"),
  crisisLineTel: text("crisis_line_tel"),
  /** "Is this still right" is asked a year later, and answered by a name and a date. */
  crisisLineVerifiedAt: timestamp("crisis_line_verified_at", { withTimezone: true }),
  crisisLineVerifiedBy: uuid("crisis_line_verified_by").references(
    (): AnyPgColumn => users.id,
    { onDelete: "set null" },
  ),

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

    /**
     * 🔴 46.4 / C223 — credit is MONEY, and these two columns are that.
     *
     * `quantity`/`consumed` counted sessions, which is the bundle C223 struck:
     * $30 does not buy ten of anything, it buys $30 of credit spendable
     * against any line, platform fee and AI fee alike.
     *
     * Added rather than replacing, and **nothing is backfilled**. A row bought
     * before this sprint has `creditCents` NULL and is worth
     * `(quantity - consumed) * rateCents`, which `remainingCentsOf` computes.
     * Rewriting those rows would be re-deriving somebody's purchase from
     * settings that have since changed, which is the mistake `rateCents`
     * exists to prevent one column up.
     *
     * `spentCents` defaults to 0 and is safe on a legacy row precisely because
     * that row's spending is recorded in `consumed` instead; the helper reads
     * whichever pair the row actually uses and never mixes them.
     */
    creditCents: integer("credit_cents"),
    spentCents: integer("spent_cents").notNull().default(0),

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
     * Their own picture. PLAN.md 25.7, C115.
     *
     * A storage path, never a URL handed to a browser. C115 rules that a
     * patient photo is served through an authenticated route like a clinical
     * document rather than as a public object, so the only reader of this
     * column is `/api/patient/avatar/[personId]`, and an admin can null it.
     */
    avatarUrl: text("avatar_url"),
    avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),

    /**
     * 🔴 Where this person's record lives. 30.1, C118, C154.
     *
     * On the PERSON rather than only on the practice, and that is the whole
     * ruling: an Egyptian patient seeing a clinician registered elsewhere is
     * the ordinary case on this product, and routing their chart to the
     * clinician's country would put an Egyptian person's therapy record in the
     * wrong jurisdiction while every test passed.
     */
    region: text("region").$type<Region>().notNull().default("us"),

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
    /**
     * 🔴 25.11 / C119 — optional since 0056.
     *
     * A guest who joined with a phone number and no email has no password and
     * never chose one. A code to a handle they have proven is a stronger
     * factor than a password invented under time pressure at the end of a
     * session, so a code is always a valid sign-in and a password is a
     * convenience for the people who want one.
     */
    passwordHash: text("password_hash"),
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
 * A patient who cannot get back in. PLAN.md 21R.4, C94, §3b.
 *
 * ## 🔴 Why this table exists at all
 *
 * There was no patient password reset. Not a broken one — none: `auth_tokens`
 * hangs off `users`, which is the clinician table, and nothing anywhere let
 * somebody who signed up at `/patient/signup` back in. A person locked out of
 * their own clinical record, with no route back to it, is the worst version of
 * this product's failure mode, and it survived eight sprints because every
 * check we had asserted about therapists.
 *
 * ## Why a code and not only a link
 *
 * §3b: the phone is the handle that is never missing and the email is a real
 * second way in *when there is one*. Most patients in this database have no
 * address at all, so a reset that emails a link is a reset most of them cannot
 * use. The code goes over WhatsApp, and `channel` records which door it went
 * out of — a reset that arrived by a channel the person does not read is a
 * different failure from one that was never sent.
 *
 * `attempts` is bounded **by the database** rather than by the code path that
 * increments it: a six-digit code with unlimited guesses is a four-hour brute
 * force, and the ceiling belongs where no future caller can forget it.
 */
export const patientAuthTokens = pgTable(
  "patient_auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientAccountId: uuid("patient_account_id")
      .notNull()
      .references(() => patientAccounts.id, { onDelete: "cascade" }),
    purpose: text("purpose")
      .$type<"password_reset" | "handle_verify">()
      .notNull()
      .default("password_reset"),
    /** SHA-256 of the code or link token. The raw value is never stored. */
    tokenHash: text("token_hash").notNull(),
    /** Which door it went out of — 'whatsapp' or 'email'. */
    channel: text("channel").$type<"whatsapp" | "email">().notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("patient_auth_tokens_hash_unique").on(t.tokenHash),
    index("patient_auth_tokens_account_idx").on(t.patientAccountId, t.usedAt),
  ],
);

/** How many wrong codes a reset survives. Enforced by a CHECK, not by hope. */
export const RESET_CODE_ATTEMPTS = 5;

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
  /**
   * 🔴 53.10 — a sponsor prepaid, a session spent it, we pay the clinician out.
   *
   * Own values rather than borrowed from `usd_stripe_to_connect`, because
   * `holdsMoney` reads that one as "we never touch it" and a pot is the opposite:
   * held for months and spent by third parties.
   *
   * 🔴 TWO of them, and the split is the same split as the four above: who we pay
   * out. That distinction is load-bearing rather than tidy — a pot paying an
   * Egyptian clinician is USD in to the US entity and EGP out of the Egyptian
   * one, which is a cross-border crossing needing an explicit
   * `entity_transfer`. One combined `pot_held_to_payout` value would have
   * collapsed exactly the fact §3c added this column to measure, and
   * `isCrossBorder` would have answered false for it.
   *
   * 🔴 `session_payments_crossing_known` IS a real CHECK constraint, so these
   * values do not exist until migration 0073 extends it. That is the sprint 56
   * defect stated as a rule: an enum extended here and not there is a value the
   * database refuses and a verifier check that quietly measures nothing.
   */
  "pot_held_to_connect",
  "pot_held_to_manual",
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
      /* 🔴 0082 — a completed change names who approved it. */
      onDelete: "restrict",
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

/* ------------------------------------------- §21 · strings and languages -- */

/**
 * A language the product can be authored in, and separately, offered in.
 * PLAN.md 21.9, 21.13.
 *
 * ## 🔴 Two switches, deliberately
 *
 * `authoringEnabled` lets a content team start translating; `publicEnabled`
 * decides whether a reader is ever offered it. They are separate because the
 * whole point of 21.14 is that Spanish can be translated for six weeks while
 * the site offers only Arabic and English, and the day it flips the site is
 * already there. One switch would mean either publishing a half-translated
 * language or having nowhere to put the work.
 *
 * The shipped `LOCALES` constant stays as the fallback for a database that has
 * not been seeded, and as the compile-time key set that makes a missing
 * Arabic string a type error (19.2). A row here can add a language; it cannot
 * remove the guarantee.
 */
export const locales = pgTable("locales", {
  /** BCP 47-ish: `en`, `ar`, `es`. Lower case. */
  code: text("code").primaryKey(),
  /** In English, for the admin list. */
  name: text("name").notNull(),
  /** In itself, for the switcher. A language is named in its own words. */
  nativeName: text("native_name").notNull(),
  direction: text("direction").$type<"ltr" | "rtl">().notNull().default("ltr"),

  /** 21.9 — a content team may write in it. */
  authoringEnabled: boolean("authoring_enabled").notNull().default(true),
  /** 🔴 21.13 — a reader may be offered it. The bigger switch. */
  publicEnabled: boolean("public_enabled").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LocaleRow = typeof locales.$inferSelect;

export const STRING_STATUSES = ["draft", "published"] as const;
export type StringStatus = (typeof STRING_STATUSES)[number];

/**
 * One interface string, in one language. PLAN.md 21.1–21.8.
 *
 * ## The dictionary is still the default
 *
 * `lib/i18n/messages.ts` ships every string and is what `tsc` checks. A row
 * here **overrides** it for one (key, locale) — and clearing the row restores
 * the shipped wording rather than blanking a button (21.5). That is why the
 * value column is not nullable: "no override" is the absence of a row, which
 * is a state the editor can produce and cannot get wrong.
 *
 * ## 🔴 AI drafts, a human publishes (21.17)
 *
 * A machine translation lands as `status = 'draft'` and counts as *missing* on
 * the completeness checklist until somebody approves it. `source` and `model`
 * record what a reviewer is reading, so a bad batch can be found by its model
 * name rather than by re-reading everything.
 */
export const uiStrings = pgTable(
  "ui_strings",
  {
    key: text("key").notNull(),
    locale: text("locale").notNull(),
    value: text("value").notNull(),

    status: text("status").$type<StringStatus>().notNull().default("published"),
    /** `human` or a machine draft. 21.19. */
    source: text("source").$type<"human" | "machine">().notNull().default("human"),
    /** Which model produced a draft, so a bad batch is findable. */
    model: text("model"),

    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.locale] }),
    index("ui_strings_locale_idx").on(t.locale, t.status),
  ],
);

export type UiString = typeof uiStrings.$inferSelect;

/**
 * A clinician's QR code, for a clinic wall. PLAN.md 25.17, C120.
 *
 * 🔴 There is deliberately no patient column here, and there never will be. A
 * printed code is public: whatever it carries, it carries to everyone who
 * walks past the poster. It carries the clinician, and nothing else.
 *
 * Revocable, because a poster outlives the person on it. `revokedAt` rather
 * than a delete, so a scan of a dead code can say "this code is no longer in
 * use" instead of "not found", which is what somebody standing in a waiting
 * room actually needs to read.
 */
export const therapistCodes = pgTable(
  "therapist_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Eight characters, no ambiguous glyphs. Shaped by a CHECK in 0058. */
    code: text("code").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("therapist_codes_code_unique").on(t.code),
    index("therapist_codes_user_idx").on(t.userId, t.revokedAt),
  ],
);

export type TherapistCode = typeof therapistCodes.$inferSelect;

/**
 * The patient's clinical summary, versioned. PLAN.md 26.1, C111.
 *
 * 🔴 Keyed on the **person**, not on a clinic's `patients` row. The summary is
 * about somebody rather than about one clinician's file on them, and the whole
 * portability argument collapses if moving practice means starting again.
 *
 * Append only, enforced by a trigger in migration 0059 rather than by everyone
 * remembering. Therapist B writing version 2 leaves version 1, with therapist
 * A's name on it, exactly where it was — and 26.2 is then free rather than
 * built: revoking A's grant cannot retract a version, because nothing in this
 * product can retract a version.
 *
 * The author is snapshotted by name and licence as well as by id. A clinician
 * can leave or be deleted; a patient's record may not lose its author to that.
 */
export const clinicalSummaries = pgTable(
  "clinical_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    body: text("body").notNull(),

    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedByName: text("approved_by_name").notNull(),
    approvedByCredentials: text("approved_by_credentials"),
    approvedByLicenseBody: text("approved_by_license_body"),
    approvedByLicenseNumber: text("approved_by_license_number"),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),

    approvedAt: timestamp("approved_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("clinical_summaries_person_version").on(t.personId, t.version)],
);

export type ClinicalSummary = typeof clinicalSummaries.$inferSelect;

/**
 * A journal. PLAN.md 26.5 to 26.8, C123, C124.
 *
 * What replaced patient file uploads and patient-dictated clinical history. A
 * person photographing a prescription was doing a clinician's filing; a person
 * dictating "my history" was writing a clinical document about themselves.
 * Neither is what somebody actually wants to do at eleven at night.
 *
 * 🔴 `riskLevel` and `riskIndicators` exist because C123 rules that a journal
 * is scanned like a transcript: somebody writes "I want to die" into one at
 * 3am and the clinician holding a grant is told. **Nothing on the patient's
 * screen reads these columns**, and the page never says or implies that
 * anybody is watching, because promising monitoring we cannot staff is the
 * most dangerous thing this product could do.
 */
export const journals = pgTable(
  "journals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** The patient account that wrote it. Points at `patient_accounts`. */
    accountId: uuid("account_id").notNull(),
    source: text("source").$type<"typed" | "dictated">().notNull().default("typed"),
    body: text("body").notNull(),
    riskLevel: text("risk_level").$type<RiskLevel | null>(),
    riskIndicators: jsonb("risk_indicators").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("journals_person_idx").on(t.personId, t.createdAt)],
);

export type Journal = typeof journals.$inferSelect;

/**
 * A patient's invite to a clinician. PLAN.md 27.2, C102b.
 *
 * 🔴 Redeeming this does **not** create access. It creates a *request*, which
 * the patient then approves in one tap. That is the whole design: the patient
 * gets the initiative, and nobody gets a back door. The copy says "invite your
 * therapist" and never "send your record", because the record does not move
 * until its owner says so a second time, knowing who is asking.
 *
 * The code is short and hyphenated because it is read aloud across a desk.
 */
export const patientInvites = pgTable(
  "patient_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** The patient account that made it. Points at `patient_accounts`. */
    accountId: uuid("account_id").notNull(),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    redeemedByUserId: uuid("redeemed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("patient_invites_code_unique").on(t.code),
    index("patient_invites_person_idx").on(t.personId, t.createdAt),
  ],
);

export type PatientInvite = typeof patientInvites.$inferSelect;

export const HISTORY_ASK_STATUSES = ["pending", "added", "declined"] as const;
export type HistoryAskStatus = (typeof HISTORY_ASK_STATUSES)[number];

/**
 * "Ask my previous therapist to add my history." PLAN.md 27.7, C108.
 *
 * 🔴 A row rather than a message, because the ruling is that a **silent
 * request is worse than a refusal**. We cannot promise that an old clinician
 * cooperates: they may have left, may want paying, may simply say no. What the
 * product can promise is that the patient finds out. So the clinician sees it
 * in a queue and either adds something or declines with a reason, and the
 * database refuses a decline with no reason at all.
 *
 * The copy everywhere says "ask", never "get".
 */
export const historyAsks = pgTable(
  "history_asks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull(),
    therapistUserId: uuid("therapist_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<HistoryAskStatus>().notNull().default("pending"),
    note: text("note"),
    /** Read by the patient verbatim. Never null on a decline. */
    declineReason: text("decline_reason"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("history_asks_therapist_idx").on(t.therapistUserId, t.status),
    index("history_asks_person_idx").on(t.personId, t.createdAt),
  ],
);

export type HistoryAsk = typeof historyAsks.$inferSelect;

/**
 * A record of processing, one row per person. PLAN.md 30.3, C118.
 *
 * 🔴 A table rather than a document. A policy describing a transfer is written
 * once; a transfer happens every time somebody books a session, and Egyptian
 * enforcement lands October 2026 asking who agreed to what and when.
 *
 * The **wording** is frozen into the row rather than a version number pointing
 * at editable text. A pointer proves nothing about what somebody actually
 * read, which is the only thing a consent record is for.
 */
export const crossBorderConsents = pgTable(
  "cross_border_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** Where they belong, and where they are actually being served from. */
    homeRegion: text("home_region").$type<Region>().notNull(),
    servingRegion: text("serving_region").$type<Region>().notNull(),
    wording: text("wording").notNull(),
    locale: text("locale").notNull(),
    agreedAt: timestamp("agreed_at", { withTimezone: true }).defaultNow().notNull(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [index("cross_border_consents_person_idx").on(t.personId, t.agreedAt)],
);

export type CrossBorderConsent = typeof crossBorderConsents.$inferSelect;

/**
 * The clinical evidence layer. PLAN.md 33.1 to 33.6.
 *
 * ## 🔴 Not a key-value table. A fact with a history.
 *
 * The thing this replaces is `patients.clinical`, a JSON blob holding
 * diagnoses and goals as strings. A blob can hold what the system believes and
 * cannot hold **why**, **when it was true**, **who said so**, or **what it
 * replaced** — so every downstream feature that reads it has to treat the
 * contents as equally certain, and a model's guess from session 3 sits in the
 * same array as a diagnosis a psychiatrist wrote.
 *
 * Every rule below is enforced by the database, in `0062_clinical_facts.sql`,
 * and each is proved in `verify:sprint33` by attempting the write:
 *
 *   - The evidence quote is `NOT NULL` and non-blank. A fact nobody can trace
 *     to a sentence cannot be stored at all.
 *   - `source_priority` is CHECKed against `source_type`, so an extraction job
 *     cannot write an `ai` row that outranks a clinician.
 *   - An `ai` fact cannot be inserted already verified. Confidence is not
 *     truth, and the agreement has to come from a person, afterwards.
 *   - Value, quote, domain, field and person are immutable after the insert.
 *     Disagreeing is a status change and a superseding row, never an edit.
 *   - A lower-ranked source may not supersede a higher-ranked one.
 *   - Superseding retires the old row to `historical` rather than deleting it.
 *   - Deleting the evidence nulls the pointer and the fact becomes
 *     `unsupported` in the same statement (33.5).
 */
export const FACT_SOURCES = ["clinician", "document", "patient", "ai"] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

export const FACT_STATUSES = [
  "active",
  "resolved",
  "historical",
  "disputed",
  /** 33.5 — the evidence behind it was deleted. Kept, never shown as current. */
  "unsupported",
] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

/**
 * 56.10 — `assessment` joins the four.
 *
 * A completed instrument is evidence like any other: it has a quote (the
 * question and the answer), a date, and a source that is the patient
 * themselves. What it is NOT is a conclusion, and 56.8 bounds it exactly as
 * C214 bounds a journal, on the same CHECK and for the same reason.
 */
export const FACT_EVIDENCE_KINDS = [
  "segment",
  "chunk",
  "journal",
  "clinician",
  "assessment",
] as const;
export type FactEvidenceKind = (typeof FACT_EVIDENCE_KINDS)[number];

export const FACT_SENSITIVITIES = ["normal", "sensitive", "restricted"] as const;
export type FactSensitivity = (typeof FACT_SENSITIVITIES)[number];

export const patientClinicalFacts = pgTable(
  "patient_clinical_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),

    domain: text("domain").notNull(),
    field: text("field").notNull(),
    value: text("value").notNull(),

    sourceType: text("source_type").$type<FactSource>().notNull(),
    /** Lower wins. Derived from `sourceType` and CHECKed against it. */
    sourcePriority: integer("source_priority").notNull(),
    sourceId: uuid("source_id"),

    /** 🔴 The sentence. NOT NULL, because a fact without one is a rumour. */
    evidenceQuote: text("evidence_quote").notNull(),
    evidenceKind: text("evidence_kind").$type<FactEvidenceKind>().notNull(),
    segmentId: uuid("segment_id").references(() => transcriptSegments.id, {
      onDelete: "set null",
    }),
    chunkId: uuid("chunk_id").references(() => documentChunks.id, { onDelete: "set null" }),
    journalId: uuid("journal_id").references(() => journals.id, { onDelete: "set null" }),
    /** 56.10 — the completed instrument a score came from. */
    assessmentId: uuid("assessment_id"),
    enteredByUserId: uuid("entered_by_user_id").references(() => users.id, {
      /* 🔴 0082 — sprint 47's honest record: a clinician-entered fact never loses the clinician who entered it. The sharpest of the six. */
      onDelete: "restrict",
    }),

    /** Only ever set for `ai`, and CHECKed that way. */
    confidence: real("confidence"),

    status: text("status").$type<FactStatus>().notNull().default("active"),

    /** 🔴 33.3 — when it was TRUE, not when it was written. */
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    firstObservedAt: timestamp("first_observed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).defaultNow().notNull(),

    supersedesId: uuid("supersedes_id"),

    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    sensitivity: text("sensitivity").$type<FactSensitivity>().notNull().default("normal"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("clinical_facts_person_idx").on(t.personId, t.domain, t.field),
    index("clinical_facts_active_idx").on(t.personId, t.status),
    index("clinical_facts_supersedes_idx").on(t.supersedesId),
  ],
);

export type ClinicalFact = typeof patientClinicalFacts.$inferSelect;

/**
 * Where a session's audio comes from. PLAN.md 36.1, and 41.1 made cheap.
 *
 * 🔴 The table is shaped so that sprint 41's hard rule — *the bot joins
 * meetings 24Therapy created for a session, nothing else, ever* — is a
 * property of the schema rather than a convention in a service. There is no
 * column for a link somebody pasted and no column that could hold a calendar
 * (C132); an external kind must carry `provisionedAt` and
 * `provisionedByUserId`, enforced by CHECK; and the meeting identity is
 * immutable after insert, so a source cannot be re-pointed at another meeting.
 *
 * See `drizzle/0064_session_sources.sql`, which names the residual honestly.
 */
export const SESSION_SOURCE_KINDS = [
  "24t_room",
  "google_meet",
  "zoom",
  "teams",
  "in_person",
  "upload",
  /**
   * 🔴 55.7 — a session held on a PARTNER's platform, written back into our record.
   *
   * *Through the door 36 built*, which is this table: a chart says where a session
   * happened rather than pretending it was ours. A partner's own video product is not
   * Google Meet and not an upload, and filing it as either would make the one column that
   * answers "where did this happen" answer wrongly.
   *
   * 🔴 `session_sources_kind` IS A REAL CHECK CONSTRAINT, so this value does not exist
   * until migration 0076 extends it. Third sprint running that this note has had to be
   * written: sprint 56 shipped an enum extended here and not there, which made a whole
   * verifier check structurally dead while it read green.
   */
  "partner_platform",
] as const;
export type SessionSourceKind = (typeof SESSION_SOURCE_KINDS)[number];

/** The kinds that describe a meeting inside somebody else's product. */
export const EXTERNAL_SOURCE_KINDS: readonly SessionSourceKind[] = [
  "google_meet",
  "zoom",
  "teams",
];

export const sessionSources = pgTable(
  "session_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),

    kind: text("kind").$type<SessionSourceKind>().notNull(),

    /** Only ever set for a meeting WE created in a connected account. */
    externalMeetingId: text("external_meeting_id"),
    provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
    provisionedByUserId: uuid("provisioned_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),

    /** 🔴 36.2 — the third door, hashed, expiring, revocable, counted. */
    ingestTokenHash: text("ingest_token_hash"),
    ingestTokenExpiresAt: timestamp("ingest_token_expires_at", { withTimezone: true }),
    ingestTokenRevokedAt: timestamp("ingest_token_revoked_at", { withTimezone: true }),
    ingestUses: integer("ingest_uses").notNull().default(0),
    ingestLastUsedAt: timestamp("ingest_last_used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

    /* ------------------------------------------- sprint 41 · the bot -- */

    /**
     * 🔴 41.7 — the provider's id for the bot we sent, and the reason this
     * column is UNIQUE.
     *
     * "Bot reconnects without duplicating" is an edge case that cannot be
     * handled by remembering. A network blip between us and Recall means our
     * dispatch call may have succeeded and its response may have been lost, so
     * a retry is the ordinary case rather than the exotic one. A second bot in
     * a therapy session is not a duplicate row to clean up later: it is a
     * second recorder in the room, and the patient consented to one.
     *
     * The unique index makes a duplicate dispatch a database error, and
     * `dispatchBot` writes it with a conditional UPDATE against
     * `bot_id IS NULL`, so the loser of a race is told rather than served.
     */
    botId: text("bot_id"),
    botDispatchedAt: timestamp("bot_dispatched_at", { withTimezone: true }),
    /**
     * What the provider last told us it was doing.
     *
     * Free text from their webhook rather than an enum of ours: a status we
     * have not heard of is information, and coercing it into "unknown" would
     * throw away the one line that explains why a session has no transcript.
     */
    botStatus: text("bot_status"),
    botLeftAt: timestamp("bot_left_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("session_sources_session_unique").on(t.sessionId),
    index("session_sources_org_idx").on(t.organizationId, t.createdAt),
    /* 41.7 — one bot, ever, per source. See the column comment. */
    uniqueIndex("session_sources_bot_unique").on(t.botId),
  ],
);

export type SessionSource = typeof sessionSources.$inferSelect;

/* ---------------------------------------------------- sprint 41 · meetings -- */

/**
 * A clinician's connected meeting account. PLAN.md 41.3, C132.
 *
 * ## 🔴 What this holds, and the one thing it must never enable
 *
 * An OAuth connection to Zoom, Google Meet or Teams, held per clinician, used
 * for exactly one purpose: **creating a meeting for a session, inside their
 * own account.** 41.1 is that the bot joins meetings 24Therapy created for a
 * session and nothing else, ever, and C132 is that no calendar is read.
 *
 * So the scopes requested are meeting-creation scopes. A calendar scope is not
 * requested, not stored, and not accepted: a tool that watches a calendar
 * eventually records a supervision call or a conversation with an accountant,
 * and the person whose words those are never agreed to anything.
 *
 * ## Why the tokens are sealed rather than hashed
 *
 * They have to be used again. See `lib/crypto/secretbox.ts`, which is the only
 * reversible primitive in this codebase and exists for these two columns.
 *
 * ## 🔴 A therapist never sees an API key (41.3)
 *
 * There is no column here a clinician could be shown or asked to paste. The
 * whole record is written by the OAuth callback and read only by the server.
 * §7: a therapist holding an API key is a therapist who got lost in our
 * product.
 */
export const MEETING_PROVIDERS = ["zoom", "google_meet", "teams"] as const;
export type MeetingProvider = (typeof MEETING_PROVIDERS)[number];

export const meetingConnections = pgTable(
  "meeting_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    provider: text("provider").$type<MeetingProvider>().notNull(),

    /** 🔴 Sealed with AES-256-GCM. Never rendered, never logged, never listed. */
    accessTokenSealed: text("access_token_sealed").notNull(),
    refreshTokenSealed: text("refresh_token_sealed"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /**
     * Their account at the provider, for the "connected as" line.
     *
     * An email or an account id, whatever the provider returns. Shown so a
     * clinician with two Zoom accounts can see which one this is, which is the
     * single most common support question any integration produces.
     */
    externalAccountLabel: text("external_account_label"),

    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    /**
     * Disconnection is a STAMP, not a delete.
     *
     * A session recorded through a connection that has since been removed
     * still has to be explainable a year later: which account made that
     * meeting, and when did it stop being connected. A deleted row makes that
     * unanswerable, and the sealed tokens are cleared on revoke so the row
     * keeps the fact without keeping the credential.
     */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /*
     * One LIVE connection per clinician per provider. A partial unique index,
     * so the history of revoked ones is kept beside it.
     */
    uniqueIndex("meeting_connections_live_unique")
      .on(t.userId, t.provider)
      .where(sql`revoked_at IS NULL`),
    index("meeting_connections_org_idx").on(t.organizationId),
  ],
);

export type MeetingConnection = typeof meetingConnections.$inferSelect;

/* --------------------------------------------------- sprint 56 assessments -- */

/**
 * 🔴 56.2 / C278 — what we are allowed to ship.
 *
 * PHQ-9 and GAD-7 are free to use and say so on their own face. Beck's
 * inventories, the Y-BOCS and most of the rest are licensed instruments that
 * cost money per administration, and shipping one without a licence is not a
 * product decision, it is copyright infringement inside a clinical record.
 *
 * The licence is a column rather than a convention, and `instruments_free_only`
 * in the migration refuses a PUBLISHED row that is not free. A licensed
 * instrument can exist in the table, unpublished, waiting for the paperwork;
 * it cannot reach a patient.
 */
export const INSTRUMENT_LICENCES = [
  /** No restriction. PHQ-9, GAD-7. */
  "public_domain",
  /** Free to use, attribution required on screen. */
  "free_with_attribution",
  /** 🔴 Cannot be published until a licence exists. */
  "licensed",
] as const;
export type InstrumentLicence = (typeof INSTRUMENT_LICENCES)[number];

/** One question. Content, so a new instrument needs no deploy (56.1). */
export type InstrumentQuestion = {
  /** Stable across translations and versions. The identifier, never the text. */
  key: string;
  /** By locale. A missing locale falls back to English at render (21.6). */
  text: Record<string, string>;
  /** The answers, in order. `value` scores; `label` is read. C203. */
  options: { value: number; label: Record<string, string> }[];
};

/**
 * An instrument, as content. PLAN.md 56.1, 56.2, 56.11.
 *
 * 🔴 Content rather than code, so adding one is an edit. The questions, the
 * options and the scoring bands all live in the row, which is what makes
 * 56.11's rule enforceable: an instrument's Arabic is reviewed by a named
 * person before it publishes, and a reviewer is a column here rather than a
 * promise in a process document.
 *
 * A mistranslated clinical instrument is not a typo. "Feeling down, depressed,
 * or hopeless" rendered loosely in Arabic changes what is being measured, and
 * a score computed from it is a number with no meaning attached to a person's
 * chart forever.
 */
export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** `phq9`, `gad7`. Stable, and what a fact cites. */
    key: text("key").notNull(),
    /** Bumped when the questions change. A response names the version it answered. */
    version: integer("version").notNull().default(1),

    name: jsonb("name").$type<Record<string, string>>().notNull(),
    /** 🔴 56.2 — shown on screen, beside the questions. */
    attribution: text("attribution").notNull(),
    licence: text("licence").$type<InstrumentLicence>().notNull(),
    /**
     * 56.11 — which languages this publishes in, stated rather than inferred.
     *
     * `instruments_translation_reviewed` reads it: publishing anything beyond
     * English requires a named reviewer. Explicit because the alternative was
     * counting the keys of `name`, which Postgres refuses inside a CHECK and
     * which was a proxy regardless: an instrument's NAME being English-only
     * says nothing about its questions.
     */
    locales: text("locales").array().notNull().default(["en"]),

    questions: jsonb("questions").$type<InstrumentQuestion[]>().notNull(),
    /**
     * Bands, for the CLINICIAN's screen only.
     *
     * 🔴 56.9 — a patient never sees one of these. "Moderately severe
     * depression" beside a number on somebody's phone at eleven at night is a
     * diagnosis delivered by a form, and C113 already rules that a machine
     * never tells a person what is wrong with them.
     */
    bands: jsonb("bands")
      .$type<{ min: number; max: number; label: string }[]>()
      .notNull()
      .default([]),

    /**
     * 🔴 56.11 — who read the translation, and when.
     *
     * Null means nobody has. The publish path refuses a row with a non-English
     * locale and no reviewer, because "the AI may draft it, but a person
     * publishes" is the founder's rule about clinical Arabic and this is the
     * only place it can be held.
     */
    translationReviewedBy: uuid("translation_reviewed_by").references(() => users.id, {
      /* 🔴 0082 — a published non-English instrument names its reviewer. */
      onDelete: "restrict",
    }),
    translationReviewedAt: timestamp("translation_reviewed_at", { withTimezone: true }),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("instruments_key_version").on(t.key, t.version)],
);

export type Instrument = typeof instruments.$inferSelect;

export const ASSIGNMENT_MODES = ["room", "homework"] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];

export const ASSIGNMENT_STATUSES = ["assigned", "started", "completed", "cancelled"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/**
 * One instrument, given to one person, once. PLAN.md 56.4, 56.5, 56.6.
 *
 * `sessionId` is set when the clinician shared it into a live room and null
 * when it was set as homework. That is the whole difference between the two
 * modes at this level: the same assignment, reached from two places, and 56.6
 * lands the homework one in the surface that already exists rather than
 * building a second one.
 */
export const assessmentAssignments = pgTable(
  "assessment_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Set for a room assignment, null for homework. */
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),

    mode: text("mode").$type<AssignmentMode>().notNull(),
    status: text("status").$type<AssignmentStatus>().notNull().default("assigned"),

    /**
     * The score, computed on completion and stored.
     *
     * Frozen for the same reason `session_credits.rate_cents` is: an
     * instrument's scoring can be corrected in a later version, and a score on
     * somebody's chart must keep meaning what it meant the day it was taken.
     */
    score: integer("score"),
    /** The version answered, so a re-scored instrument does not rewrite history. */
    instrumentVersion: integer("instrument_version").notNull().default(1),

    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("assessment_assignments_patient_idx").on(t.patientId, t.createdAt),
    index("assessment_assignments_session_idx").on(t.sessionId),
    // 56.5 — the clinician's live poll reads this.
    index("assessment_assignments_status_idx").on(t.status, t.updatedAt),
  ],
);

export type AssessmentAssignment = typeof assessmentAssignments.$inferSelect;

/**
 * One answer, and how long it took. PLAN.md 56.7.
 *
 * 🔴 `answerMs` is the point of this table, and it is the structured signal
 * the product has never had.
 *
 * A transcript says what somebody said. It cannot say that they answered eight
 * questions in four seconds each and then sat on "thoughts that you would be
 * better off dead" for ninety. That hesitation is clinical information no
 * amount of conversation reliably surfaces, and it is free: the only way to
 * lose it is not to record it.
 *
 * ⚠️ It is DATA, not a conclusion. 56.8 bounds what may be drawn from it by
 * the same CHECK that bounds a journal (C214): a copilot may cite that an
 * answer took ninety seconds; it may not conclude anything about the person
 * from that.
 */
export const assessmentResponses = pgTable(
  "assessment_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assessmentAssignments.id, { onDelete: "cascade" }),

    /** The question's stable key, never its text. C203. */
    questionKey: text("question_key").notNull(),
    /** The option's `value`. What scores. */
    value: integer("value").notNull(),

    /**
     * Milliseconds from the question appearing to the answer being chosen.
     *
     * Nullable because a resumed assignment cannot honestly time the question
     * that was on screen when the app was closed, and a fabricated duration is
     * worse than a missing one.
     */
    answerMs: integer("answer_ms"),

    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /*
     * 🔴 One answer per question per assignment.
     *
     * A patient going back to change an answer UPDATES; two rows for one
     * question would double-count in the score, and the score is the thing
     * that reaches a chart.
     */
    uniqueIndex("assessment_responses_unique").on(t.assignmentId, t.questionKey),
  ],
);

export type AssessmentResponse = typeof assessmentResponses.$inferSelect;

/* ------------------------------------------------------- sprint 37 voices -- */

export const VOICE_ROLES = ["therapist", "patient"] as const;
export type VoiceRoleColumn = (typeof VOICE_ROLES)[number];

/**
 * 🔴 How a voice acquired a person. There is no "model" and there must not be.
 *
 * `track` is the recording already knowing, because a video session captured
 * two tracks. `operator` is a named human saying so. Sprint 37.2 — an
 * unrecognised voice is a numbered speaker, never a guess — is only a rule
 * anybody can rely on if there is no way to write down a guess.
 */
export const VOICE_BINDINGS = ["track", "operator"] as const;
export type VoiceBinding = (typeof VOICE_BINDINGS)[number];

export const sessionVoices = pgTable(
  "session_voices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),

    /** The provider's opaque label for this voice. Not a person. */
    label: text("label").notNull(),
    /** 1-based, in first-heard order. "Speaker 3" is ordinal 3. */
    ordinal: integer("ordinal").notNull(),

    /** Null means unrecognised, which is normal and permanent. */
    role: text("role").$type<VoiceRoleColumn>(),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "restrict" }),
    boundBy: text("bound_by").$type<VoiceBinding>(),
    boundByUserId: uuid("bound_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    boundAt: timestamp("bound_at", { withTimezone: true }),

    speakingMs: integer("speaking_ms").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("session_voices_label_unique").on(t.sessionId, t.label),
    uniqueIndex("session_voices_ordinal_unique").on(t.sessionId, t.ordinal),
  ],
);

export type SessionVoice = typeof sessionVoices.$inferSelect;

/* ======================================================================== */
/*  §3e · CORPORATE — sprint 53                                             */
/* ======================================================================== */

/**
 * 🔴 A SPONSOR IS NOT AN `organizations` ROW. C230, C259.
 *
 * This is the single most important sentence in this file's corporate half, so
 * it is the first one.
 *
 * `organizations` is the therapist's practice, and `actor.organizationId`
 * scopes every clinical query in the product across sixty-odd call sites.
 * Putting a paying employer in that table would put them **inside the tenancy
 * boundary that separates clinical caseloads** — the single worst place in this
 * schema for somebody whose entire product promise is that they never see care.
 *
 * ## 🔴 And a clinic IS one, which is the trap
 *
 * C259: *they look like the same problem, an outside body with users and money,
 * and they have opposite answers.* A clinic **employs clinicians and its
 * therapists' patients sit inside its tenancy**, which is exactly what
 * `organizationId` already does, so a clinic is the organization and a clinic
 * manager is a new kind of user inside it holding zero clinical access. A
 * sponsor **pays for care it must never see**.
 *
 * So sprints 53 and 54 do not share a table, and this comment exists because a
 * session reading the two tickets back to back will otherwise reuse one and
 * take four weeks to find out why.
 *
 * ## What a sponsor user is
 *
 * Their own table, their own cookie, their own sign-in, their own sessions
 * table. Never an `Actor`: `Role` has no sponsor in it and `Actor` requires an
 * `organizationId`, so the type system refuses it before any guard does.
 */
export const SPONSOR_KINDS = ["company", "university"] as const;
export type SponsorKind = (typeof SPONSOR_KINDS)[number];

/**
 * The sponsor's lifecycle.
 *
 * 53.5: a new corporate signup is **held**, not active. Somebody talks to them
 * before a pot exists, because the first conversation is a sales call and
 * because C233's refund terms have to be agreed before any money is taken.
 */
export const SPONSOR_STATES = ["held", "active", "suspended", "closed"] as const;
export type SponsorState = (typeof SPONSOR_STATES)[number];

export const sponsors = pgTable(
  "sponsors",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** What they call themselves, on their own screens and their invoice. */
    name: text("name").notNull(),
    kind: text("kind").$type<SponsorKind>().notNull(),
    state: text("state").$type<SponsorState>().notNull().default("held"),

    /**
     * 🔴 C236 — LISTED IS OPT-IN, because the picker is a public customer list.
     *
     * Some clients will sign precisely on the condition that nobody knows they
     * have bought this. Unlisted is the default because the safe default is the
     * private one and sales can ask for the other.
     */
    listedPublicly: boolean("listed_publicly").notNull().default(false),

    /**
     * Which entity holds their pot. §3c's rails unchanged: an Egyptian
     * university funds the Egyptian entity in EGP, a US company funds the US
     * entity in USD.
     */
    entity: text("entity").$type<Entity>().notNull(),
    currency: text("currency").notNull(),

    /* 53.5 — the contact, for the call that happens before anything else. */
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    contactBestTime: text("contact_best_time"),

    /**
     * 🔴 C256 — RE-VERIFICATION IS ANCHORED HERE, NOT ON A PERSON.
     *
     * *"Last verified" leaks the join date, which §3e forbids.* If each
     * person's cycle ran from their own enrolment, their last-verified date
     * would be their join date shifted by whole cycles, and a sponsor could
     * read off who joined the week after a restructure was announced.
     *
     * So the cycle is per sponsor on a fixed calendar. Everybody in one
     * organisation is checked in the same window, so the date is the same for
     * everybody and carries no signal about anybody.
     */
    verifyCycleStartedAt: timestamp("verify_cycle_started_at", { withTimezone: true }),
    verifyCycleMonths: integer("verify_cycle_months").notNull().default(3),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("sponsors_state_idx").on(t.state),
    /* C236 — the public picker's query, and it can only ever see opted-in rows. */
    index("sponsors_listed_idx").on(t.listedPublicly).where(sql`listed_publicly = true`),
  ],
);

export type Sponsor = typeof sponsors.$inferSelect;

/**
 * 🔴 A sponsor's own users. Never an `Actor`, never in `users`.
 *
 * A separate table rather than a role on `users`, because `users.role` is read
 * by `requireRole` and every back-office guard, and one wrong `allowed` list
 * would hand an HR administrator a clinical screen. The type system cannot
 * catch that; a separate table means there is nothing to get wrong.
 */
export const SPONSOR_ROLES = ["admin", "viewer"] as const;
export type SponsorRole = (typeof SPONSOR_ROLES)[number];

export const sponsorUsers = pgTable(
  "sponsor_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),

    email: text("email").notNull(),
    name: text("name"),
    /** scrypt, the same helper `users` uses. Never reversible. */
    passwordHash: text("password_hash"),
    role: text("role").$type<SponsorRole>().notNull().default("viewer"),

    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sponsor_users_email_unique").on(t.email).where(sql`deleted_at IS NULL`),
    index("sponsor_users_sponsor_idx").on(t.sponsorId),
  ],
);

export type SponsorUser = typeof sponsorUsers.$inferSelect;

/** Their sessions, shaped exactly like the patient's. Own cookie, own table. */
export const sponsorAuthSessions = pgTable(
  "sponsor_auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorUserId: uuid("sponsor_user_id")
      .notNull()
      .references(() => sponsorUsers.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sponsor_auth_sessions_token_hash_unique").on(t.tokenHash),
    index("sponsor_auth_sessions_user_idx").on(t.sponsorUserId),
  ],
);

/**
 * 🔴 53.9 / C237 / C120 — the joining code, which is PRINTED ON A WALL.
 *
 * *The printed QR on an office wall is public, exactly as C120's clinic poster
 * was. Anybody can photograph it.* So the code carries the sponsor's identity
 * only: never a person, never an entitlement. Scanning opens enrolment and says
 * which organisation; the identifier the sponsor requires is still demanded.
 *
 * Short, revocable and rotatable. A dead one is answered with a sentence rather
 * than a 404, because somebody is standing in a corridor reading it.
 */
export const sponsorCodes = pgTable(
  "sponsor_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),

    /** Short, human-typeable, upper case. Stored as given. */
    code: text("code").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sponsor_codes_code_unique").on(t.code),
    index("sponsor_codes_sponsor_idx").on(t.sponsorId),
  ],
);

export type SponsorCode = typeof sponsorCodes.$inferSelect;

/**
 * 🔴 53.7 / C238 — WHAT THE SPONSOR MAY ASK FOR, and the cap is the ruling.
 *
 * *Left open, a client will ask for a national ID number, a manager's name, or
 * a department, and we will have built a form that collects sensitive data on
 * their behalf into our database.*
 *
 * So the kinds are a closed list in code, not a free-text type the sponsor
 * chooses. Never a national identifier, never health information, never free
 * text somebody could confess into.
 *
 * `domain_email` is the recommended one and the only one that is real proof:
 * C246 prefers an identifier we can prove over one we can only pattern-match,
 * and C247 is that without a roster nothing else can notice somebody has left.
 */
export const IDENTIFIER_KINDS = ["domain_email", "id_number"] as const;
export type IdentifierKind = (typeof IDENTIFIER_KINDS)[number];

export const sponsorIdentifierFields = pgTable(
  "sponsor_identifier_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),

    kind: text("kind").$type<IdentifierKind>().notNull(),

    /** For `domain_email`: the domain, without an @. A domain is public. */
    domain: text("domain"),
    /** For `id_number`: a regex the value must match. Never shown verbatim. */
    pattern: text("pattern"),

    /**
     * 🔴 C248 — A DESCRIPTION OF THE SHAPE, NEVER A SPECIMEN VALUE.
     *
     * *"for example, 20215544" is a working template handed to anybody who
     * scans a poster.* So this column holds "eight digits beginning with your
     * year of entry" and the database refuses a value that looks like a
     * specimen — see `sponsor_identifier_no_specimen` in 0072.
     */
    shapeHint: text("shape_hint"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sponsor_identifier_fields_sponsor_idx").on(t.sponsorId)],
);

export type SponsorIdentifierField = typeof sponsorIdentifierFields.$inferSelect;

/**
 * 🔴 ENROLMENT. 53.17 to 53.19d. THERE IS NO ROSTER AND NO APPROVAL QUEUE.
 *
 * C227, rewritten twice before it shipped, and both failures are worth keeping
 * because both are the obvious build:
 *
 *   - **An approval queue fails on the rejection path.** If HR accepts or
 *     rejects each applicant, rejections are surfaced individually, and who
 *     fails an identifier match is disproportionately contractors, recent name
 *     changes and people on leave. HR gets a short sharp list of exactly the
 *     people least able to absorb being on it.
 *   - **A bulk roster fixes that and creates a worse problem**: a complete
 *     staff list for every client sitting in our database, with a retention
 *     question and a breach surface attached.
 *
 * So a person enrols themselves with a code, and matching is automatic against
 * **a shape and a domain, never a list of people.** The sponsor never sees an
 * enrolment, never sees a rejection, never sees a join date, and performs no
 * act about any individual. Their only individual-level power is removal.
 *
 * ## 🔴 What is in this table that the sponsor may NEVER read
 *
 * `createdAt` is the join date, and §3e forbids the sponsor from seeing it.
 * It is here because we need it and because C250 makes funding start from it;
 * it is not here for them. The wall is a property of the query, not of the
 * column, so `lib/data/sponsors.ts` is where "the payer sees the roster"
 * becomes a select list — and `verify:sprint53` reads that select list rather
 * than trusting this comment.
 */
/**
 * 🔴 61.8 / C321 — `provisional` arrives in sprint 61, between nothing and active.
 *
 * An HR match enrols somebody and funding starts before their mailbox is
 * confirmed. The alternative is making them wait for an email, which in
 * practice means they pay for the first session themselves and never come back.
 * A provisional enrolment funds, and `provisional_sessions_used` caps it.
 */
export const ENROLMENT_STATES = ["active", "provisional", "paused", "removed"] as const;
export type EnrolmentState = (typeof ENROLMENT_STATES)[number];

/** Why funding ended. A fixed list, never free text (§3e). */
export const REMOVAL_REASONS = ["left", "graduated", "ended", "administrative"] as const;
export type RemovalReason = (typeof REMOVAL_REASONS)[number];

/**
 * 🔴 61.1 to 61.3 / C318 / C348 — PROVING A COMPANY IS A COMPANY.
 *
 * A joining code funds therapy out of somebody's pot. Until sprint 61 the only
 * thing between a stranger and a corporate account was an operator reading an
 * application form and pressing activate.
 *
 * ## 🔴 TWO PROOFS, AND NEITHER ALONE ISSUES A CODE
 *
 * An email code proves somebody holds a mailbox at the domain. A DNS TXT record
 * proves somebody controls the domain. They are different facts, and each is
 * individually forgeable by the wrong person: an employee with a mailbox is not
 * authorised to commit their employer to anything, and a contractor who can add
 * a DNS record may never have had an address there.
 *
 * ## 🔴 TWO TIMESTAMPS RATHER THAN ONE BOOLEAN
 *
 * A boolean answers "is this proved" and loses "proved how, and when", which is
 * the question asked when somebody disputes an account a year later.
 *
 * ## 🔴 C348 — the third path, recorded as what it is
 *
 * University IT does not always add a record this quarter. A countersigned
 * agreement is admin-approved and names the human who approved it, rather than
 * being written into one of the two columns above as a proof nobody performed.
 */
export const sponsorDomains = pgTable(
  "sponsor_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),

    /** 61.3 — one organisation is several domains, each proved on its own. */
    domain: text("domain").notNull(),

    mailboxProvedAt: timestamp("mailbox_proved_at", { withTimezone: true }),
    dnsProvedAt: timestamp("dns_proved_at", { withTimezone: true }),

    agreementApprovedAt: timestamp("agreement_approved_at", { withTimezone: true }),
    agreementApprovedBy: uuid("agreement_approved_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),

    /**
     * What IT is asked to publish, and what we look for. Generated per domain,
     * so one organisation's record cannot prove another's.
     */
    dnsToken: text("dns_token").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /*
     * 🔴 A domain belongs to ONE sponsor. Two companies both proving acme.com
     * means the second one enrols the first one's staff.
     */
    uniqueIndex("sponsor_domains_domain_unique").on(sql`lower(${t.domain})`),
    index("sponsor_domains_sponsor_idx").on(t.sponsorId),
  ],
);

export type SponsorDomain = typeof sponsorDomains.$inferSelect;

export const enrolments = pgTable(
  "enrolments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "restrict" }),
    /**
     * 🔴 The PERSON, not a patient row.
     *
     * `people` is the identity; `patients` is one clinician's file about them.
     * A benefit belongs to the person and follows them across clinicians,
     * which is also what makes C234 true: removing somebody ends the funding
     * and touches no file.
     */
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    state: text("state").$type<EnrolmentState>().notNull().default("active"),

    /**
     * 🔴 53.19d / C249 — more than one sponsor is allowed, exactly one is
     * primary, chosen by the patient. The primary pot pays.
     *
     * Neither sponsor ever learns the other exists, which follows from C227:
     * neither sees anything about an individual beyond the enrolled list.
     */
    isPrimary: boolean("is_primary").notNull().default(true),

    /**
     * 🔴 53.18b — THE IDENTIFIER IS A GATE AND NOTHING ELSE.
     *
     * Stored **hashed**, which is the whole ruling made structural. A work
     * email used to cross the gate is never used for communication unless the
     * person signed up with it, is never returned to the sponsor, and is never
     * a destination for anything we send except the one verification code.
     *
     * A hash cannot be returned to a sponsor, cannot be emailed, and cannot be
     * read by a support agent with a screenshot. It still de-duplicates, which
     * is C246's "one identifier used once, ever" — enforced by a unique index
     * rather than by a service that checks first.
     *
     * 🔴 This one has the SPONSOR ID INSIDE THE HASH, so it de-duplicates
     * within one organisation and cannot see across two. That is what
     * `identifierHashGlobal` below is for, and for a while it did not exist.
     */
    identifierHash: text("identifier_hash").notNull(),

    /**
     * 🔴 C246, the half that was missing. Hashed WITHOUT the sponsor id.
     *
     * `enrolments_identifier_unique` is global and its comment says why: an
     * identifier that crossed one gate must not cross another. But
     * `hashIdentifier` puts the sponsor id in the digest, so the same invented
     * student number at two organisations produced two different hashes and the
     * global index never fired. The index stated the ruling and the hash
     * function quietly made it unenforceable.
     *
     * This column carries the same value hashed without the sponsor, and
     * `enrolments_identifier_global_unique` is unique on it. The pair is
     * deliberate: `identifier_hash` stays the per-sponsor key that everything
     * else looks up by, this one is the cross-sponsor guard.
     *
     * 🔴 NULLABLE, and it will stay null on rows written before 0085. The
     * plaintext was never stored (C245), so old hashes cannot be recomputed.
     * The index is partial for that reason. This reaches forward and does not
     * pretend to reach back.
     */
    identifierHashGlobal: text("identifier_hash_global"),
    identifierKind: text("identifier_kind").$type<IdentifierKind>().notNull(),

    /**
     * 🔴 C256 — the same date for everybody in one organisation.
     *
     * Set from the sponsor's cycle, never from this person's own clock, so it
     * carries no signal about when they joined.
     */
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

    /** C234 — set on removal. The reason is a fixed list, never free text. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removalReason: text("removal_reason").$type<RemovalReason>(),
    /** C247 — funding paused because nobody answered the re-verification. */
    pausedAt: timestamp("paused_at", { withTimezone: true }),

    /**
     * 🔴 61.9 / C350 — how many sessions a PROVISIONAL person has funded.
     *
     * Counted on the row rather than derived. The question asked at booking is
     * "has this person had their one", and deriving it means a join from the
     * money path to `sessions`, which is exactly the join C244 spends the whole
     * corporate design avoiding.
     */
    provisionalSessionsUsed: integer("provisional_sessions_used").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /*
     * 🔴 Per sponsor, despite the name. The hash has the sponsor id in it, so
     * this refuses the same identifier twice at one organisation and sees
     * nothing across two. Kept because every lookup goes through it.
     */
    uniqueIndex("enrolments_identifier_unique").on(t.identifierHash),
    /*
     * 🔴 C246 — ONE IDENTIFIER, USED ONCE, EVER. This is the index that does it.
     *
     * Across every sponsor, not per sponsor: an identifier that crossed one
     * gate must not cross another. A unique index rather than a service check,
     * because two people submitting the same guessed student number in the
     * same second is exactly the case a check-then-insert loses.
     *
     * Partial, because rows from before 0085 have no global hash and must not
     * collide with each other on null.
     */
    uniqueIndex("enrolments_identifier_global_unique")
      .on(t.identifierHashGlobal)
      .where(sql`identifier_hash_global IS NOT NULL`),
    /* One live enrolment per person per sponsor. Removed ones stay beside it. */
    uniqueIndex("enrolments_person_sponsor_unique")
      .on(t.personId, t.sponsorId)
      .where(sql`removed_at IS NULL`),
    /*
     * 🔴 Exactly one primary per person. C249's "the primary pot pays" is
     * meaningless if two rows claim it, and a service that sets one and clears
     * the other has a window.
     */
    uniqueIndex("enrolments_one_primary")
      .on(t.personId)
      .where(sql`is_primary = true AND removed_at IS NULL`),
    index("enrolments_sponsor_idx").on(t.sponsorId, t.state),
  ],
);

export type Enrolment = typeof enrolments.$inferSelect;

/**
 * 🔴 THE POT IS A PAYMENT METHOD, NOT A BILLING SYSTEM. C226, 53.10.
 *
 * *The obvious build is a parallel path: corporate sessions, corporate
 * invoices, corporate ledger accounts, a `sessionType` of `corporate`. That
 * doubles every money code path in the product and guarantees the two drift.*
 *
 * So this table is a BALANCE and nothing else. It stands in for the patient's
 * card at the point of payment. The therapist is paid their own price, our
 * commission comes out of it as always, VAT as always, and the therapist's own
 * platform fee and AI fee stay theirs exactly as on any other session.
 *
 * 🔴 There is no `sessionType`, no corporate invoice table, and no second
 * ledger. One new ledger account (`sponsor_pot`) and one new funding source.
 * A corporate session is indistinguishable from any other in every report that
 * is not the corporate report, which C242 requires anyway.
 */
export const sponsorPots = pgTable(
  "sponsor_pots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "restrict" }),

    /**
     * The balance, in the entity's currency, in minor units.
     *
     * 🔴 May go NEGATIVE, by a bounded amount. C239, amended: *"per patient" is
     * the wrong unit and is unbounded in the direction that matters — a sponsor
     * with 400 enrolled people and an empty pot can go 400 sessions negative at
     * once, each individually permitted.* The overdraft is per SPONSOR, a small
     * number, a setting. A session already started always completes and is
     * always paid; new bookings stop once the sponsor overdraft is spent.
     */
    balanceCents: integer("balance_cents").notNull().default(0),
    overdraftCents: integer("overdraft_cents").notNull().default(0),

    /**
     * 🔴 C233 — DECIDED BEFORE A SINGLE DEAL IS SIGNED, never afterwards.
     *
     * Refundable less what was spent, with a stated expiry, both shown on the
     * top-up screen beside the button. Nullable only because a held sponsor has
     * no pot terms yet; 0072 refuses a funded pot without them.
     */
    /**
     * 🔴 60.1 / C311 — WHAT THIS EMPLOYER COVERS, IN FIVE PER CENT STEPS.
     *
     * Until 0090 a pot either paid for a session or refused: `payFromPot` spent
     * the whole gross. Every real corporate conversation is a percentage, and
     * the moment there is one, C311 arrives with it.
     *
     * 🔴 The step is a CHECK rather than a select box, because a form can be
     * bypassed and an API cannot be, and "60%" is a number a finance team
     * agreed to rather than an arbitrary basis point.
     *
     * 🔴 100% is the default, so every pot that existed before this column
     * behaves exactly as it did: the whole session, from the pot.
     */
    coverageBps: integer("coverage_bps").notNull().default(10000),

    /**
     * 🔴 C311's NOTICE WINDOW, as data rather than as a job.
     *
     * A reduction takes effect after a window an operator sets, because a
     * person being asked for money they were not expecting deserves warning.
     * The pair applies itself by being in the past, so there is no scheduled
     * task whose failure leaves an employer paying a percentage they changed
     * three weeks ago.
     *
     * An INCREASE needs none of this (C344), and the asymmetry is deliberate:
     * being asked for less than you agreed to needs no protection.
     */
    pendingCoverageBps: integer("pending_coverage_bps"),
    pendingCoverageFrom: timestamp("pending_coverage_from", { withTimezone: true }),

    refundPolicy: text("refund_policy"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /**
     * 🔴 C229, finally built. The anti-differencing floor on the BALANCE.
     *
     * `applyActivityFloor` suppresses the weekly heatmap, and the balance sat
     * beside it unsuppressed, which is the same attack with the chart removed:
     * a sponsor who reads the balance on Monday and again on Tuesday knows
     * exactly what was spent in between, and with one employee enrolled that is
     * one named person's session.
     *
     * `published_balance_cents` is the ONLY balance a sponsor surface may
     * render. Null means not enough has happened yet for any balance to be
     * publishable, which is a different statement from zero and is shown as
     * one. It advances only when the live session count has moved at least
     * `sponsor.activityFloor` beyond `published_sessions`.
     */
    publishedBalanceCents: integer("published_balance_cents"),
    publishedSessions: integer("published_sessions").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("sponsor_pots_sponsor_unique").on(t.sponsorId)],
);

export type SponsorPot = typeof sponsorPots.$inferSelect;

/**
 * 🔴 C231 — THE PATIENT'S OWN NOTIFICATION LOG, and there are TWO logs.
 *
 * The amendment is the whole ruling: *a permanently undeletable entry saying an
 * employer enrolled you and later removed you is a fact about the EMPLOYMENT
 * RELATIONSHIP, retained forever in a record C234 promises the payer cannot
 * touch, and it travels if the record is ever exported.*
 *
 * So: **this log keeps what happened to the PERSON, and a removal reads "your
 * benefit has ended" with no employer named and no reason.** The payer's acts
 * live in `audit`, where they already belong, and never enter a patient export.
 *
 * Append only. Dismissing takes an entry out of the main view and leaves it in
 * the history, which is what an audit needs and what a person expects.
 */
export const PATIENT_NOTICE_KINDS = [
  "benefit_started",
  "benefit_ended",
  "benefit_paused",
  "verify_needed",
] as const;
export type PatientNoticeKind = (typeof PATIENT_NOTICE_KINDS)[number];

export const patientNotifications = pgTable(
  "patient_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    kind: text("kind").$type<PatientNoticeKind>().notNull(),

    /**
     * 🔴 NO SPONSOR ID, AND THAT IS THE RULING.
     *
     * C231's amendment: a removal notice names no employer. A column here
     * holding a sponsor id would make "which employer dropped you" a join
     * away, permanently, inside a record the payer is promised they cannot
     * touch — and it would travel in an export.
     *
     * The body is a MessageKey resolved at render, so the words are
     * translatable and admin-editable and the row carries no prose either.
     */
    messageKey: text("message_key").notNull(),

    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("patient_notifications_person_idx").on(t.personId, t.createdAt)],
);

export type PatientNotification = typeof patientNotifications.$inferSelect;

/**
 * 🔴 53.19 / C246 — PROOF OVER PATTERN, as one short-lived row.
 *
 * *"An email on the sponsor's domain, verified by a one-time code, is the
 * recommended default. An ID matched only by shape is a weak gate, permitted, and
 * the sponsor is told in plain words that it is guessable."*
 *
 * ## 🔴 THE ADDRESS IS NOT ON THIS TABLE, AND THAT DECIDED THE WHOLE CYCLE
 *
 * `enrolments.identifier_hash` is a SALTED hash and there is no plaintext column
 * anywhere: 53.18b says the identifier is stored for matching and de-duplication
 * only. So the work address is not recoverable, which has one consequence worth
 * stating rather than discovering:
 *
 * **A code can only be sent while the person is typing the address.** Nothing
 * later — no job, no operator, no support ticket — can email a work inbox,
 * because nothing later knows it. That is the strongest possible form of "never a
 * destination for anything we send except the one verification code".
 *
 * It is also why 53.19b's re-verification asks the PERSON in their own app, on
 * their own contact details, rather than emailing their employer's mailbox. The
 * fix for a pause is that they re-enter the address, which mints a new code.
 *
 * ## 🔴 Attempts are counted on the row, and the rate limit is per CODE
 *
 * A limit per person lets one attacker with many accounts grind one joining code.
 * `lib/data/enrolment.ts` limits per code for that reason, and this counter is the
 * second wall: a single minted code survives a fixed number of wrong guesses and
 * then is dead rather than slow.
 */
export const enrolmentVerifications = pgTable(
  "enrolment_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrolmentId: uuid("enrolment_id")
      .notNull()
      .references(() => enrolments.id, { onDelete: "cascade" }),

    /** SHA-256 of the six digits. The code itself is never stored. */
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("enrolment_verifications_hash_unique").on(t.codeHash),
    index("enrolment_verifications_enrolment_idx").on(t.enrolmentId, t.usedAt),
  ],
);

/** How many wrong codes one minted code survives. A CHECK, not a convention. */
export const ENROLMENT_CODE_ATTEMPTS = 5;

// ------------------------------------------------- clinics and hospitals ---
//
// 🔴 SPRINT 54, AND THE FIRST THING TO READ IS WHY THIS IS NOT `sponsors`.
//
// C259, stated at the top of both sprints because a session reading them back to
// back will otherwise share one table and take four weeks to find out why:
//
//   **A CLINIC IS AN `organizations` ROW. A SPONSOR IS NOT.** Opposite answers,
//   both correct.
//
// A clinic EMPLOYS clinicians and its therapists' patients sit INSIDE its
// tenancy, which is exactly what `actor.organizationId` already scopes across 63
// queries in 33 files. So a clinic is the organization, and a clinic manager is a
// new kind of user inside it holding zero clinical access.
//
// A sponsor PAYS FOR CARE IT MUST NEVER SEE. Putting one in `organizations` would
// place a paying employer inside the boundary that separates caseloads (C230), so
// `sponsors` is its own table with its own auth and its own cookie.
//
// The consequence for this sprint is the thing to hold on to: a clinic manager's
// principal DOES carry an organisation id, and that id is the key to every
// clinical query in the product. A sponsor could not reach a chart if it tried,
// because the shape does not fit. A clinic manager could, so the wall here is not
// the type system. It is `lib/data/clinic.ts`'s select lists and a verifier that
// runs as a clinic manager against RENDERED OUTPUT (54.9, C243's lesson).

/**
 * 🔴 54.1 — what kind of organisation this row is.
 *
 * Every existing row is `solo`: one clinician who signed up for themselves, which
 * C266 calls "an organization of one" and which is already how tenancy works. A
 * `clinic` is the same shape with more than one clinician in it and a manager who
 * is not one of them.
 *
 * Deliberately NOT a boolean. `is_clinic` would leave "what is a row that is
 * neither" unanswerable the first time a third kind arrives, and a training
 * institute (C271) is already on the horizon reading as a clinic for every purpose
 * that matters.
 */
export const ORGANIZATION_KINDS = ["solo", "clinic"] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

/**
 * 🔴 54.3 — a clinic signs up, is HELD, and is activated by an admin exactly as a
 * sponsor is.
 *
 * The same four states as `sponsors` and deliberately a separate enum on a separate
 * column, because sharing one would be the first step toward sharing the table
 * C259 says must not be shared. They will drift, and they should: a suspended
 * sponsor loses a portal, while a suspended clinic has clinicians mid-caseload.
 *
 * 🔴 NULL on a solo row, and that is the shape rather than an omission. A solo
 * practice has no held state because nobody approved it: a clinician signs up,
 * verifies their own licence, and that verification IS the gate. Defaulting every
 * existing row to `active` would have been a lie about a state they were never in.
 */
export const CLINIC_STATES = ["held", "active", "suspended", "closed"] as const;
export type ClinicState = (typeof CLINIC_STATES)[number];

/**
 * 🔴 54.2 — A CLINIC MANAGER IS A NEW KIND OF USER, AND NOT A `Role`.
 *
 * *Not a `Role` on the back office enum, which is ours.* `ROLES` is therapist,
 * staff, manager and super_admin: the last three are OUR people, and adding a
 * fifth would put a customer's practice manager one enum value away from the
 * console that prices the product.
 *
 * So this is a separate table with its own auth, its own cookie and its own
 * sign-in, exactly like `sponsor_users` — and unlike them it carries an
 * `organization_id`, because that is C259's whole point.
 *
 * ## 🔴 WHY THE COLUMN IS READ THROUGH `clinicOrganizationId` AND NOT `organizationId`
 *
 * `ClinicActor` deliberately names it `clinicOrganizationId`. An `Actor` has
 * `organizationId`, and every clinical data function in the product takes an
 * `Actor` or an org id and scopes on it. If a clinic manager's principal carried a
 * property spelled `organizationId`, then `getPatient(clinicActor)` would be a
 * plausible line of code that compiled far more often than it should.
 *
 * Spelling it differently does not make the id less powerful. It makes reaching for
 * it a deliberate rename in a diff instead of an autocomplete, which is the most
 * this can be without a nominal type Postgres and TypeScript do not give us.
 */
export const CLINIC_ROLES = ["admin", "viewer"] as const;
export type ClinicRole = (typeof CLINIC_ROLES)[number];

export const clinicManagers = pgTable(
  "clinic_managers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    email: text("email").notNull(),
    name: text("name"),
    /** scrypt, the same helper `users` and `sponsor_users` use. */
    passwordHash: text("password_hash"),
    role: text("role").$type<ClinicRole>().notNull().default("viewer"),

    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    /*
     * 🔴 Unique ACROSS clinics, not within one.
     *
     * `users` is unique on (organization_id, email) because a clinician may
     * legitimately hold a solo account and a clinic account under C261. A MANAGER
     * may not: one address, one practice, so that "who is signing in" is never a
     * question the sign-in has to answer by guessing which clinic was meant.
     */
    uniqueIndex("clinic_managers_email_unique").on(t.email).where(sql`deleted_at IS NULL`),
    index("clinic_managers_org_idx").on(t.organizationId),
  ],
);

export type ClinicManager = typeof clinicManagers.$inferSelect;

/** Their sessions. Own cookie, own table, shaped like the sponsor's. */
export const clinicAuthSessions = pgTable(
  "clinic_auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicManagerId: uuid("clinic_manager_id")
      .notNull()
      .references(() => clinicManagers.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("clinic_auth_sessions_token_hash_unique").on(t.tokenHash),
    index("clinic_auth_sessions_manager_idx").on(t.clinicManagerId),
  ],
);

/**
 * 🔴 54.4 / 54.5 / 54.6 — the invitation, and the three rulings it carries.
 *
 * *The clinic adds therapists one at a time, by email and phone, and each is
 * invited.* One at a time rather than a CSV, because a bulk upload is a staff list
 * arriving before anybody consented to be on it, and because C267 means every one
 * of them has to act personally anyway.
 *
 * ## 🔴 C267 — THE CLINIC CANNOT VOUCH FOR A LICENCE, AND THERE IS NO COLUMN HERE
 *   THAT WOULD LET IT
 *
 * *An invited clinician verifies themselves exactly as a solo one does, and the
 * clinic's word is not evidence.* So this table has no `verified` flag, no
 * `licence_number`, no `verified_by` and no document reference. What it has is an
 * invitation that creates an `unverified` user, and the clinic can see that
 * verification is pending and chase it.
 *
 * The obvious build lets a hospital mark its own therapists verified, because the
 * hospital employs them and already checked. Accept it once and "only certified
 * therapists" becomes "certified, or somebody said so", and C106's database
 * invariant is bypassed by the most credible-looking route available.
 *
 * ## 🔴 C261 — NO PRIVATE PATIENTS, AND IT IS STATED BEFORE THEY ACCEPT
 *
 * `terms_shown_at` is stamped when the invitation page renders the sentence, and
 * `accepted_at` cannot be set on a row where it is null. So "it is said in the
 * invitation, not discovered afterwards" is a database constraint rather than a
 * paragraph somebody remembered to render.
 */
export const INVITATION_STATES = ["sent", "accepted", "revoked", "expired"] as const;
export type InvitationState = (typeof INVITATION_STATES)[number];

export const clinicianInvitations = pgTable(
  "clinician_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    email: text("email").notNull(),
    /** 54.4 — by email AND phone, because WhatsApp is the channel that exists. */
    phone: text("phone"),
    firstName: text("first_name"),
    lastName: text("last_name"),

    /** SHA-256 of the link token. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    state: text("state").$type<InvitationState>().notNull().default("sent"),

    /**
     * 🔴 C261 — stamped when the invitation screen RENDERS the sentence about
     * having no private patients, and `accepted_at` is refused without it.
     */
    termsShownAt: timestamp("terms_shown_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    /** The clinician this became, once they accepted. Never set by the clinic. */
    acceptedUserId: uuid("accepted_user_id").references(() => users.id, {
      /* 🔴 0082 — an accepted invitation names who accepted it (54.5). */
      onDelete: "restrict",
    }),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    invitedByManagerId: uuid("invited_by_manager_id").references(() => clinicManagers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("clinician_invitations_token_unique").on(t.tokenHash),
    /* One live invitation per address per clinic. A resend replaces it. */
    uniqueIndex("clinician_invitations_live_unique")
      .on(t.organizationId, t.email)
      .where(sql`state = 'sent'`),
    index("clinician_invitations_org_idx").on(t.organizationId, t.state),
  ],
);

export type ClinicianInvitation = typeof clinicianInvitations.$inferSelect;

// ------------------------------------------------------ the partner plane ---
//
// 🔴 SPRINT 55, AND IT CARRIES SPRINT 42's TABLES TOO.
//
// 55's own preamble says it *"extends sprint 42 from a set of tables into a
// product somebody can sign up for and use"*. Sprint 42 was never built: there
// was not one occurrence of the word `partner` in this file before this block.
// So 42.1, 42.2, 42.6 and 42.7 are here, and 55 is the sprint that makes them a
// product rather than the sprint that assumes they exist.
//
// ## 🔴 THE SIXTH PRINCIPAL, AND WHAT IT MUST NEVER BE
//
// §3f: a partner is *a developer at another company* who sees keys, docs,
// webhooks and their own subjects, and never content. §7 is blunter: **a
// therapist never sees an API key**, and *a therapist holding an API key is a
// therapist who got lost in our product*.
//
// So `PartnerActor` is a third principal shape beside `SponsorActor` and
// `ClinicActor`, and like the sponsor's it carries NO organisation id at all. A
// partner is outside the tenancy entirely: what reaches a chart is never the
// partner, it is a CLINICIAN holding a grant a patient gave (C277), signed in
// through an ordinary `auth_sessions` row that 42.3 mints.
//
// ## 🔴 C255 AND C265, WHICH DECIDE THE SHAPE OF THE WHOLE PLANE
//
// C255: *the integration answers a question about one person we already hold,
// and never enumerates.* Every HR platform worth integrating and SCIM itself are
// built around PROVISIONING: pull the directory, sync it, keep it. Build any of
// that and we hold a complete staff list for every client, which is what three
// enrolment designs were spent removing.
//
// C265: *an API key that can ask "does this person work here" is an identity
// oracle, and it is pointed at our own patients.* So the endpoint is scoped to
// one sponsor, rate-limited hard, and only ever answers about an identifier a
// person submitted through enrolment MINUTES ago.
//
// Both of those are shapes in this schema rather than rules in a service:
// `partner_api_keys.sponsor_id` scopes a key to exactly one sponsor, and
// `enrolment_attestations` is the short-lived row that makes "somebody offered
// this identifier" a fact with an expiry rather than a claim.

/** 42.1 — held until an operator activates, exactly like a sponsor or a clinic. */
export const PARTNER_STATES = ["held", "active", "suspended", "closed"] as const;
export type PartnerState = (typeof PARTNER_STATES)[number];

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    state: text("state").$type<PartnerState>().notNull().default("held"),

    /* 55.2 — the contact, for the call before anything is activated. */
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    /** What they say they want to build. Read by an operator, never by code. */
    intent: text("intent"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("partners_slug_unique").on(t.slug),
    index("partners_state_idx").on(t.state),
  ],
);

export type Partner = typeof partners.$inferSelect;

/**
 * 🔴 55.1 / 55.3 — a partner USER, and there is no `Role` on it.
 *
 * A developer at another company. Their own table, their own cookie, their own
 * sign-in, and no path to an `Actor`: the same construction as `sponsor_users`
 * and for the same reason, which is that §7's rule about API keys is a rule
 * about WHO, and the cheapest way to keep a therapist away from a key is for
 * the key to live behind a principal a therapist cannot become.
 */
export const PARTNER_ROLES = ["admin", "developer"] as const;
export type PartnerRole = (typeof PARTNER_ROLES)[number];

export const partnerUsers = pgTable(
  "partner_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),

    email: text("email").notNull(),
    name: text("name"),
    passwordHash: text("password_hash"),
    role: text("role").$type<PartnerRole>().notNull().default("developer"),

    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("partner_users_email_unique").on(t.email).where(sql`deleted_at IS NULL`),
    index("partner_users_partner_idx").on(t.partnerId),
  ],
);

export const partnerAuthSessions = pgTable(
  "partner_auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerUserId: uuid("partner_user_id")
      .notNull()
      .references(() => partnerUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("partner_auth_sessions_token_hash_unique").on(t.tokenHash),
    index("partner_auth_sessions_user_idx").on(t.partnerUserId),
  ],
);

/**
 * 🔴 42.1 / 55.2 / C265 — THE KEY, AND EVERY COLUMN ON IT IS A CONSTRAINT.
 *
 * *Keys (hashed, scoped, rotatable)*, and C265 adds the fourth thing: scoped to
 * ONE SPONSOR where the scope includes employment verification.
 *
 * ## 🔴 Hashed, so a leaked table is not a set of working keys
 *
 * Only the SHA-256 is stored and the raw key is shown exactly once, at creation.
 * A `prefix` is kept in clear so a developer can tell two keys apart in a list
 * and an operator can name one in a support conversation without either of them
 * holding the secret.
 *
 * ## 🔴 Scoped, and the scopes are a fixed list
 *
 * A key that can do everything is a key nobody can safely give to a contractor.
 * Each scope maps to exactly one use case in 55.4 to 55.8, so "what can this key
 * do" is answerable by reading one array.
 *
 * ## 🔴 `sponsor_id`, which is C265 in a column
 *
 * *The endpoint is scoped to one sponsor.* Kept on the table after
 * `employment:verify` moved to the sponsor portal, because the constraint and
 * the column are what made that endpoint safe and the sponsor's own version
 * inherits both. A key with no sponsor answers about nobody: the check is in
 * the query, so it fails closed rather than falling through to every sponsor.
 *
 * ## 🔴 `environment`, because a sandbox key that can reach real people is not a
 *   sandbox
 */
/**
 * 🔴 NARROWED TO ONE BUYER, 2026-09-14. Founder: *"cut the scope of the partner
 * API to telehealth platforms only."*
 *
 * It had five scopes serving six imagined customers and one real one. Two of
 * them were other portals' features wearing an API costume, and both go home:
 *
 *   - **`employment:verify` belongs to the SPONSOR.** An HR system connects to
 *     the company that bought the benefit, not to a third party holding a key
 *     about that company's staff. It becomes "enable employment verification"
 *     on the sponsor's own integrations page, where the people whose employment
 *     is being confirmed are that portal's own population. The C265 machinery
 *     underneath it — `enrolment_attestations`, the minutes-long consumable
 *     record of an identifier a person themselves submitted — is unchanged and
 *     is what keeps it from being an identity oracle whoever owns the door.
 *   - **`clinician:verify` belongs to nobody.** A telehealth platform takes
 *     responsibility for its own clinicians' licences; that is the deal. EHR
 *     and FHIR are a CLINIC setting, on the clinic's own integrations page and
 *     on the clinic plan, reached through `lib/ehr/` rather than through a key.
 *
 * What is left is one product: **a telehealth or teletherapy platform that has
 * the video, the booking and the clinicians, and wants the intelligence.** They
 * keep their own interface; we transcribe, write the note their therapist
 * approves, answer their therapist's questions about the patient, hold the
 * memory, and hand their patient a summary.
 *
 * ## 🔴 A SCOPE ARRIVES WITH ITS ENDPOINT, NEVER BEFORE IT
 *
 * The rest of that product is sprint 68, and its scopes are added there, one at
 * a time, each beside the route that serves it. This list has been an
 * advertisement for things that did not work once already: `grant.revoked` and
 * `record.claimed` sat in `WEBHOOK_EVENTS` for four sprints while nothing
 * emitted either, under a green check saying partners were told.
 */
export const API_SCOPES = [
  /** 55.6 — read a record the patient granted this clinician. C277. */
  "record:read",
  /** 55.7 — a session held on their platform lands in our record. */
  "session:write",
  /** 55.8 — a clinician-approved note is pushed to their system. */
  "note:deliver",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const API_ENVIRONMENTS = ["sandbox", "live"] as const;
export type ApiEnvironment = (typeof API_ENVIRONMENTS)[number];

export const partnerApiKeys = pgTable(
  "partner_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),

    /** A name the developer chose, so a list of keys means something. */
    label: text("label").notNull(),
    /** 🔴 SHA-256. The raw key is returned once and never stored. */
    keyHash: text("key_hash").notNull(),
    /** The first characters, in clear, so two keys can be told apart. */
    prefix: text("prefix").notNull(),

    scopes: jsonb("scopes").$type<ApiScope[]>().notNull().default([]),
    environment: text("environment").$type<ApiEnvironment>().notNull().default("sandbox"),

    /**
     * 🔴 C265 — ONE SPONSOR, OR NONE.
     *
     * *The endpoint is scoped to one sponsor.* Null means the key cannot answer
     * an employment question at all, which is the correct default and is why
     * the scope alone is not enough.
     */
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, { onDelete: "cascade" }),

    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    /**
     * 🔴 C265 — *an abnormal rate SUSPENDS THE KEY* rather than alerting
     * somebody to read a chart later.
     *
     * Set by the limiter itself, not by a human, and the reason is stored beside
     * it so a developer asking "why did my key stop" gets an answer.
     */
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),

    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("partner_api_keys_hash_unique").on(t.keyHash),
    index("partner_api_keys_partner_idx").on(t.partnerId, t.revokedAt),
  ],
);

export type PartnerApiKey = typeof partnerApiKeys.$inferSelect;

/**
 * 🔴 42.4 / 55.10 — A WEBHOOK CARRIES AN EVENT AND AN ID, NEVER CONTENT.
 *
 * *A leaked webhook URL then leaks nothing.* So there is no `payload` column on
 * the delivery table and no way to put one there: the delivery stores the event
 * name and the subject id it was about, and the partner calls back for anything
 * more with a key we can revoke.
 *
 * The endpoint's own secret is sealed with `lib/crypto/secretbox.ts`, which is
 * the only reversible primitive in the product, because signing a delivery needs
 * the secret back and a hash cannot give it.
 */
export const WEBHOOK_EVENTS = [
  "session.completed",
  "note.approved",
  "grant.revoked",
  "record.claimed",
  /**
   * 🔴 C277 / 0087 — the person cut the link, so the partner stops getting answers.
   *
   * Without this event a partner's next six calls return "no such subject" and
   * their integration reads it as our bug. Telling them is not a courtesy: an
   * access that ends silently is the failure C108 names one table over, where a
   * silent request is worse than a refusal.
   *
   * The payload is what every other delivery carries and nothing more: the event
   * and the subject id. Never why, never who, never when they claimed anything.
   */
  "subject.unlinked",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const partnerWebhooks = pgTable(
  "partner_webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),

    url: text("url").notNull(),
    /** 🔴 Sealed, not hashed: signing a delivery needs the secret back. */
    secretSealed: text("secret_sealed").notNull(),
    events: jsonb("events").$type<WebhookEvent[]>().notNull().default([]),

    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("partner_webhooks_partner_idx").on(t.partnerId, t.disabledAt)],
);

export const partnerWebhookDeliveries = pgTable(
  "partner_webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => partnerWebhooks.id, { onDelete: "cascade" }),

    event: text("event").$type<WebhookEvent>().notNull(),
    /**
     * 🔴 AN ID, AND THE ID IS OURS.
     *
     * The subject the event was about, as an opaque uuid. Not a patient name, not
     * a session summary, not a note. A partner receiving this knows something
     * happened and has to ask, with a key, to learn what.
     */
    subjectId: uuid("subject_id"),

    attempts: integer("attempts").notNull().default(0),
    /** The last HTTP status, for a delivery log a developer can debug from. */
    lastStatus: integer("last_status"),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("partner_webhook_deliveries_hook_idx").on(t.webhookId, t.createdAt),
    index("partner_webhook_deliveries_pending_idx")
      .on(t.createdAt)
      .where(sql`delivered_at IS NULL`),
  ],
);

/**
 * 🔴 42.2 — `partner_subjects`, UNIQUE ON `(partner_id, external_ref)`.
 *
 * *Two partners will both send `"P123"`.* That sentence is the whole table: an
 * external reference is meaningless without the partner it came from, and a
 * unique index on `external_ref` alone would have let the second partner to
 * integrate collide with the first one's patients.
 *
 * 🔴 It maps to a `people` row rather than a `patients` row, because a person is
 * the identity and a patient row is their relationship with one practice. A
 * partner's subject is a person who may later be seen by several clinicians.
 */
export const partnerSubjects = pgTable(
  "partner_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),

    /** Their id for this person, in their system. Opaque to us. */
    externalRef: text("external_ref").notNull(),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),

    /**
     * 🔴 C277's "revocable", which for four sprints applied to the grant and not
     * to this row. Added in 0087.
     *
     * Linking takes the person's own act: 55.6 will not point a subject at
     * anybody on a partner's say-so. Unlinking had no act at all, no column and
     * no screen, so a person who revoked every grant and claimed their record
     * was still permanently "P123" to that partner.
     *
     * And it was not a dead link. `writeBackSession` asks about the subject and
     * about no grant, so a partner could keep writing real sessions into the
     * chart of somebody who had withdrawn everything they were asked to consent
     * to. `resolveSubject` filters on this column, which is the one place every
     * partner endpoint goes through.
     *
     * 🔴 Revoked rather than deleted, like every other revocation here: "when
     * did this stop" is a question somebody asks later, and a deleted row
     * answers it with silence. The unique index stays, so re-linking means the
     * person confirms again rather than a partner inserting beside it.
     */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** 🔴 Always a patient. There is no operator path and no partner path here. */
    revokedByAccountId: uuid("revoked_by_account_id").references(
      (): AnyPgColumn => patientAccounts.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("partner_subjects_partner_ref_unique").on(t.partnerId, t.externalRef),
    index("partner_subjects_person_idx").on(t.personId),
  ],
);

/**
 * 🔴 C265 — THE ROW THAT MAKES THE IDENTITY ORACLE IMPOSSIBLE.
 *
 * > *The endpoint is scoped to one sponsor, rate-limited hard, and **only ever
 * > answers about an identifier a person has themselves submitted through
 * > enrolment in the last few minutes.** It is not a lookup API; it is a step
 * > inside one flow, and it can never be called with an identifier nobody
 * > offered.*
 *
 * That last sentence cannot be enforced by a rate limit or a scope. It needs a
 * record of the offering, with an expiry, and this is it: `enrol` writes one when
 * somebody types an identifier, and the endpoint answers only about a row that
 * exists and has not expired.
 *
 * ## 🔴 THE IDENTIFIER IS A SALTED HASH HERE TOO
 *
 * The same hash `enrolments.identifier_hash` holds, computed by the same
 * function. So the endpoint takes an identifier from the partner, hashes it, and
 * looks for a match: it can confirm what somebody offered and can never be read
 * to enumerate what anybody offered. A stolen table is not a list of work
 * addresses.
 *
 * ## 🔴 AND IT IS CONSUMED, so a row answers ONE question
 *
 * `answered_at` is stamped on use and a used row answers nothing more. Without
 * that, a single enrolment would licence unlimited questions about one person
 * for the length of the window, which is a smaller oracle rather than none.
 */
export const enrolmentAttestations = pgTable(
  "enrolment_attestations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),

    /** 🔴 The same salted hash `enrolments` holds. Never a plaintext address. */
    identifierHash: text("identifier_hash").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Stamped on use. A used attestation answers nothing more. */
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    /**
     * Which key asked, for the audit C265 requires of every call.
     *
     * 🔴 RESTRICT, not SET NULL, and 0078 fixed that forward.
     *
     * `enrolment_attestations_answer_names_key` forbids an answered row from having this null,
     * so SET NULL made deleting a key try a write the row refuses: the DELETE failed with a
     * check violation naming a table the operator was not touching. `verify:sprint55` hit it in
     * its own teardown. The CHECK is the one worth keeping (an answer nobody is answerable for
     * is not an audit), so the key cannot be erased once it has answered about a person.
     *
     * It changed nothing live: `revokeKey` sets `revoked_at` and there is no DELETE on
     * `partner_api_keys` anywhere, which is how a contradiction survives a review.
     */
    answeredByKeyId: uuid("answered_by_key_id").references(() => partnerApiKeys.id, {
      onDelete: "restrict",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("enrolment_attestations_lookup_idx").on(t.sponsorId, t.identifierHash),
    index("enrolment_attestations_expiry_idx").on(t.expiresAt),
  ],
);

export type EnrolmentAttestation = typeof enrolmentAttestations.$inferSelect;

/** How long an offering licences one question. Minutes, per C265's own word. */
export const ATTESTATION_TTL_MINUTES = 10;

/**
 * 🔴 42.3 / 55.9 — THE LAUNCH TOKEN, AND IT EXISTS BECAUSE THE FIRST DESIGN COULD NOT WORK.
 *
 * `POST /api/partner/v1/launch` is called by the PARTNER'S SERVER. My first version of
 * `launchClinician` minted an `auth_sessions` row and set the session cookie with
 * `cookies().set()`, which attaches `Set-Cookie` to the response of the request being
 * handled — and that response goes back to the partner's server. The partner's server would
 * have held the clinician's session cookie and the clinician's browser would never have
 * received one: an endpoint that returns 200, a URL that opens a sign-in form, and a session
 * credential sitting in somebody else's HTTP client.
 *
 * So a launch is TWO steps, which is also how SMART on FHIR does it and what sprint 43 will
 * need: the server call mints a short single-use token and returns a URL; the clinician's
 * BROWSER opens that URL, and the cookie is set on the response to that navigation, which is
 * the only response that reaches them.
 *
 * ## 🔴 SINGLE USE, AND ENFORCED BY A CONDITIONAL UPDATE
 *
 * `used_at` is stamped by an UPDATE whose WHERE requires it to be null, so two browsers
 * racing on one URL produce one session and one refusal rather than two sessions. The same
 * construction as `enrolment_attestations`, for the same reason: a check-then-write is a race.
 *
 * ## 🔴 TWO MINUTES, because this is a redirect rather than a credential
 *
 * The token's whole life is the gap between a server call and the browser navigation it
 * triggers. A launch URL that works for an hour is a sign-in link sitting in a partner's logs,
 * their browser history and any `Referer` header that leaves their page.
 *
 * ## 🔴 HASHED, so a leaked table is not a set of working launch links
 */
export const partnerLaunchTokens = pgTable(
  "partner_launch_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    /** Which of our clinicians. They must already exist and be verified: a launch creates
        no account and cannot, because §7's rule about grants is not bypassable by an
        integration. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Which key asked, so 42.7's audit can say "their server, on behalf of Dr X". */
    keyId: uuid("key_id").references(() => partnerApiKeys.id, { onDelete: "set null" }),

    tokenHash: text("token_hash").notNull(),
    /** Already resolved through the allow list. Never a caller's string. */
    target: text("target").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Stamped by a conditional UPDATE. A used token opens nothing. */
    usedAt: timestamp("used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("partner_launch_tokens_hash_unique").on(t.tokenHash),
    index("partner_launch_tokens_expiry_idx").on(t.expiresAt),
  ],
);

/** The gap between a server call and the browser navigation it triggers. Nothing more. */
export const LAUNCH_TOKEN_TTL_SECONDS = 120;

/* ========================================================================== */
/*  Sprint 43 · SMART on FHIR                                                  */
/* ========================================================================== */

// 🔴 THE TWO RULINGS THIS SECTION IS SHAPED BY.
//
// C266 / 43.1b: *a connection is owned by the ORGANIZATION, and a solo therapist is an
// organization of one.* A hospital connects once for every clinician under it; a solo clinician
// connects their own. A therapist leaving a clinic loses that connection immediately, without a
// question, because the credential was the hospital's.
//
// 43.4: *in an EHR the chart is THEIR system of record, not ours.* `lib/ehr/policy.ts` is the
// written decision and this schema is that decision in columns: there is nowhere here to put a
// date of birth, an MRN, a problem list or a medication, and `verify:sprint43` sweeps for the
// spellings somebody would reach for.

/**
 * 🔴 43.2 — WE ARE THE OAUTH **CLIENT**, AND THE VENDOR LIST IS PINNED.
 *
 * Not an identity provider, not a server. A hospital's EHR authorises us; we never authorise
 * anybody. That is why there is no `client_secret` we issue and no redirect URI a caller
 * supplies — both are ours, fixed, and registered with the vendor out of band.
 */
export const EHR_VENDORS = ["epic", "cerner", "athena", "smart_sandbox"] as const;
export type EhrVendor = (typeof EHR_VENDORS)[number];

/** 43.2 — pinned, because "latest FHIR" is a contract that moves under a hospital. */
export const FHIR_VERSION = "4.0.1" as const;
export const US_CORE_VERSION = "6.1.0" as const;

/**
 * 🔴 43.1 / 43.1b / C266 — A CONNECTION, OWNED BY THE ORGANISATION.
 *
 * ## 🔴 `organization_id` IS THE OWNER AND THERE IS NO `user_id`
 *
 * `meeting_connections` (sprint 41) carries BOTH a user and an organisation, because a Zoom
 * account genuinely belongs to a person: it is their calendar, their meetings, their licence.
 * An EHR connection is the opposite. A hospital's FHIR credential is the hospital's, issued to
 * the institution, and every clinician under it works through the one connection.
 *
 * So this table has no `user_id` at all, and that absence is the ruling. With one, the first
 * convenience anybody adds is "let this clinician use their own", and at that point a therapist
 * leaving a clinic keeps a credential pointed at the hospital's chart.
 *
 * 🔴 A SOLO THERAPIST IS AN ORGANISATION OF ONE, which is why this needs no second case:
 * `organizations.kind = 'solo'` is already every solo clinician's own row (C259), so the same
 * column is the owner in both worlds and 43.1c is two homes for one flow rather than two flows.
 *
 * ## 🔴 SEALED, NOT HASHED, and this is the third place `secretbox` belongs
 *
 * Refreshing an access token needs the refresh token back, so a hash cannot do it. Cleared on
 * revoke, so the row keeps the fact of the connection without keeping the credential — the same
 * construction `meeting_connections` uses and for the same reason.
 */
export const ehrConnections = pgTable(
  "ehr_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* 🔴 C266. The owner, and the only owner. There is deliberately no user_id. */
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    vendor: text("vendor").$type<EhrVendor>().notNull(),
    /** The hospital's FHIR base URL. Pinned per connection, because each tenant has its own. */
    fhirBaseUrl: text("fhir_base_url").notNull(),
    /** Their issuer, echoed back on every launch so a forged `iss` does not resolve. */
    issuer: text("issuer").notNull(),

    /** 🔴 Sealed with AES-256-GCM. Never rendered, never logged, never selected for a screen. */
    accessTokenSealed: text("access_token_sealed"),
    refreshTokenSealed: text("refresh_token_sealed"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** What the vendor granted. Stored so a missing scope is a sentence rather than a 403. */
    scopes: jsonb("scopes").$type<string[]>().default([]).notNull(),

    /**
     * Which hospital this is, for the "connected to" line.
     *
     * The institution's own name as the vendor reports it, so an operator with two Epic tenants
     * can tell them apart. An institution is not a person, so this is not the exception 43.4
     * carves for a display name.
     */
    tenantLabel: text("tenant_label"),

    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    /**
     * 🔴 Disconnection is a STAMP, and revoking SEVERS THE LINKS.
     *
     * The row stays because a note filed through a connection that has since been removed must
     * still be explainable a year later. What goes is the credential and, per 43.4's second
     * clock, every launch's mapping to their patient ids: after a disconnection we must not be
     * able to resolve a hospital's identifier, and the clinical record we hold stays held for
     * the patient.
     */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /*
     * 🔴 ONE LIVE CONNECTION PER ORGANISATION PER VENDOR, as a partial unique index so the
     * history of revoked ones stays beside it.
     *
     * Per organisation rather than per clinician, which is C266 as an index: a second live Epic
     * connection under one hospital is two credentials for one chart, and the losing one is
     * whichever a query happens to order first.
     */
    uniqueIndex("ehr_connections_live_unique")
      .on(t.organizationId, t.vendor)
      .where(sql`revoked_at IS NULL`),
    index("ehr_connections_org_idx").on(t.organizationId),
  ],
);

export type EhrConnection = typeof ehrConnections.$inferSelect;

/**
 * 🔴 43.1 / 43.4 — A LAUNCH, WHICH IS ALSO THE PATIENT MAPPING, AND IT HOLDS NO DEMOGRAPHICS.
 *
 * A clinician opens us from inside a patient's chart. The EHR hands us a patient id in its own
 * namespace, and this row is where that id becomes ours.
 *
 * ## 🔴 THE COLUMN LIST IS 43.4's DECISION
 *
 * `fhir_patient_id`, and no date of birth, no MRN, no address, no payer, no problem list. Every
 * one of those arrives in the same `Patient` resource we read to get here, and persisting what
 * you fetched is one line — which is exactly why there is no column to persist it into.
 * `FORBIDDEN_COLUMN_FRAGMENTS` in `lib/ehr/policy.ts` is what `verify:sprint43` sweeps this
 * table against.
 *
 * ## 🔴 AND THE MAPPING DIES WITH THE CONNECTION
 *
 * `fhir_patient_id` is nullable so that revoking a connection can NULL it across every launch
 * under it. That is 43.4's second clock: the clinical record we hold survives, the ability to
 * resolve a hospital's identifier does not. A launch row with a null patient id still says a
 * launch happened, which is what an audit a year later is asking.
 */
export const ehrLaunches = pgTable(
  "ehr_launches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => ehrConnections.id, { onDelete: "cascade" }),
    /** Which of our clinicians was launched. They sign in as themselves, as 42.3 established. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * 🔴 THEIR id for the patient, in their namespace, and the ONLY thing here that is theirs.
     *
     * Nullable because a revoke severs it (43.4), not because a launch can lack one.
     */
    fhirPatientId: text("fhir_patient_id"),
    /** Our patient, once resolved or created. Null until the clinician confirms the match. */
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),

    /** Their encounter, so a writeback can attach to the right one rather than to the chart. */
    fhirEncounterId: text("fhir_encounter_id"),

    launchedAt: timestamp("launched_at", { withTimezone: true }).defaultNow().notNull(),
    /** Stamped when a revoke severs the mapping, so the severing is itself auditable. */
    severedAt: timestamp("severed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ehr_launches_connection_idx").on(t.connectionId),
    index("ehr_launches_patient_idx").on(t.patientId),
    /*
     * 🔴 The lookup a launch actually does: "have I seen this hospital's patient before".
     * Scoped to the connection, because two hospitals will both call somebody `12345` — the
     * identity-collision problem `lib/integrations/registry.ts` has named as unsolved since
     * sprint 28, solved here by never treating a foreign id as ours.
     */
    index("ehr_launches_fhir_patient_idx").on(t.connectionId, t.fhirPatientId),
  ],
);

export type EhrLaunch = typeof ehrLaunches.$inferSelect;

/** 43.3 — where a note went, and whether it landed. */
export const WRITEBACK_STATES = ["pending", "filed", "refused"] as const;
export type WritebackState = (typeof WRITEBACK_STATES)[number];

/**
 * 🔴 43.3 — THE NOTE FILES BACK AS A `DocumentReference`, AND THIS ROW IS THE RECEIPT.
 *
 * ## 🔴 IT RECORDS THE ATTEMPT, NOT JUST THE SUCCESS
 *
 * A note that a clinician approved and that we believe reached the hospital's chart, but did
 * not, is the worst outcome this sprint can produce: the clinician has moved on, the chart has
 * a gap, and nobody knows. So `pending` is written BEFORE the request and the state is updated
 * after, which means a crash mid-flight leaves a row somebody can see rather than silence.
 *
 * ## 🔴 IT STORES NO CONTENT
 *
 * `session_notes` is the note. This row holds the id their server gave back and nothing that
 * could drift from the note it refers to. A copy of the filed text here would be a third
 * version of one clinical document, and the question "which of these is what the clinician
 * signed" would have no answer.
 *
 * The same rule `partner_webhook_deliveries` follows in sprint 55, arrived at independently
 * twice: the receipt is not the thing.
 */
export const ehrWritebacks = pgTable(
  "ehr_writebacks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => ehrConnections.id, { onDelete: "cascade" }),
    /** Which note. The note itself lives in `session_notes` and is never copied here. */
    noteId: uuid("note_id")
      .notNull()
      .references(() => sessionNotes.id, { onDelete: "cascade" }),

    state: text("state").$type<WritebackState>().notNull().default("pending"),
    /** Their id for the DocumentReference, once they have accepted it. */
    fhirDocumentReferenceId: text("fhir_document_reference_id"),
    /** Why it was refused, in their words, for the person who has to fix it. */
    lastError: text("last_error"),
    attempts: integer("attempts").notNull().default(0),

    filedAt: timestamp("filed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /*
     * 🔴 ONE FILING PER NOTE PER CONNECTION, so a retry cannot put two DocumentReferences for
     * one note in somebody's chart. Idempotency as an index rather than as a check in a service.
     */
    uniqueIndex("ehr_writebacks_note_unique").on(t.noteId, t.connectionId),
    index("ehr_writebacks_state_idx").on(t.state),
  ],
);

export type EhrWriteback = typeof ehrWritebacks.$inferSelect;

/* ========================================================================== */
/*  Sprint 44 · Check-ins                                                      */
/* ========================================================================== */

// 🔴 C97 / 44.1 / 44.2 — THE TWO RULINGS THIS SECTION IS SHAPED BY.
//
// 44.1: *personalised, very short, differently worded, their name, an admin-controlled rate, an
// opt-out and an overnight quiet window.* Every one of those is a column or a setting here, and the
// cadence lives in `settings.checkins` rather than in a constant because the founder's ruling was
// to PROVE it rather than assume it.
//
// 44.2: 🔴 **A CHECK-IN ASKS. IT NEVER INTERPRETS.** *A worrying reply goes to the crisis path,
// never to a copilot.* That is the rule this schema is built to make structurally true: there is no
// column on `checkin_replies` for a score, a sentiment, a mood, a risk level or a summary, and
// nothing here is reachable from `lib/ai/`. A reply is stored as the person's own words, scanned by
// the SAME keyword path a session transcript is scanned by, and either raises a crisis alert or
// sits there.

/**
 * 🔴 44.1 / C97 — A CHECK-IN THAT WAS SENT, AND THE ONE THING IT MUST NOT BE.
 *
 * ## 🔴 IT IS A LOG, NOT A QUEUE
 *
 * The row is written when the message goes out, so "how many did we send this week" and "when was
 * this person last messaged" are one query rather than an inference from a cron's memory. The
 * cadence check reads `MAX(sent_at)` per person, which means a deployment that missed a day sends
 * one message when it comes back rather than the four it owes. That is deliberate: a backlog of
 * check-ins delivered at once is the worst version of this feature.
 *
 * ## 🔴 `body` IS STORED, and it is the one thing here that looks like over-collection
 *
 * 44.1 asks for messages *differently worded each time, never a template everybody recognises*.
 * The only way to keep that promise is to know what we already said to this person, so the text is
 * kept. It is OUR words, not theirs, and it carries no clinical content by construction: a
 * check-in asks how somebody is and says nothing about them.
 */
export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * 🔴 The PERSON, not the patient record.
     *
     * A check-in is addressed to a human being, and `people` is the table that means a human being
     * (5.1). A `patients` row is one clinician's chart about them; somebody seen by two clinicians
     * has two, and messaging them twice a day because of our filing is exactly the harm C97's
     * cadence warning is about.
     */
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    /** Which channel carried it, so a mute on WhatsApp is not read as a mute on email. */
    channel: text("channel").$type<"email" | "whatsapp">().notNull(),
    /** What we said. Kept so the next one can be worded differently. Never about them. */
    body: text("body").notNull(),
    /** Which language it went out in, because the next one should match. */
    locale: text("locale").notNull().default("en"),

    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
    /** Whether the provider took it. A send that failed is not a check-in they received. */
    delivered: boolean("delivered").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /* The cadence query: the most recent check-in for one person. */
    index("checkins_person_sent_idx").on(t.personId, t.sentAt),
  ],
);

export type Checkin = typeof checkins.$inferSelect;

/**
 * 🔴 44.2 — A REPLY, IN THE PERSON'S OWN WORDS, AND NOTHING DERIVED FROM IT.
 *
 * > *A check-in is not a clinical assessment: it asks, it never interprets, and a worrying reply
 * > goes to the crisis path rather than to a copilot.*
 *
 * ## 🔴 THE COLUMN LIST IS THE RULE
 *
 * There is no `score`, no `mood`, no `sentiment`, no `risk_level`, no `summary` and no
 * `ai_response`. Not "not populated yet" — there is nowhere to put one, so a future edit that
 * wanted to interpret a reply would have to add a column in a diff somebody reads. The same
 * technique `queueWebhook` uses for 42.4 and `ehr_launches` for 43.4, arrived at for the third
 * time: enforce the rule with the shape rather than with a reviewer noticing.
 *
 * ## 🔴 `crisis_alert_raised` IS A BOOLEAN, NOT A JUDGEMENT
 *
 * It records that the reply went to the crisis path. It does not record a level, a category or a
 * confidence, because those would be this table interpreting — and the interpretation that does
 * happen belongs to `risk_assessments`, written by the SAME `scanForCrisisLanguage` and
 * `raiseCrisisAlert` a session transcript goes through. One crisis path, reached from two places.
 */
export const checkinReplies = pgTable(
  "checkin_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkinId: uuid("checkin_id")
      .notNull()
      .references(() => checkins.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    /** 🔴 Their words, as they wrote them. The only thing on this row that is theirs. */
    body: text("body").notNull(),

    /**
     * 🔴 Whether this went to the crisis path. A fact, not a finding.
     *
     * The finding, if there is one, is a `risk_assessments` row written by the ordinary crisis
     * path. This column exists so a verifier can assert that a reply containing crisis language
     * DID route, which is 44.2's whole assertion and is otherwise invisible.
     */
    crisisAlertRaised: boolean("crisis_alert_raised").notNull().default(false),

    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("checkin_replies_person_idx").on(t.personId),
    index("checkin_replies_checkin_idx").on(t.checkinId),
  ],
);

export type CheckinReply = typeof checkinReplies.$inferSelect;

/**
 * 🔴 44.1 / C97 — THE OPT-OUT, AND IT IS THE MOST IMPORTANT TABLE IN THIS SPRINT.
 *
 * > *A person who mutes it is worse off than one who was messaged less.*
 *
 * That sentence is why this is its own table rather than a boolean on `people`. A mute is an EVENT
 * with a time on it, and the time is what makes the mute rate measurable: a boolean says how many
 * people are muted today and a row says when they muted, which is the only way to tell whether a
 * cadence change helped.
 *
 * ## 🔴 UNMUTING IS A SECOND ROW, NOT A DELETE
 *
 * Deleting the mute would erase the evidence that the cadence drove somebody away, which is the
 * measurement the founder asked for. So `unmuted_at` is stamped and the row stays.
 *
 * ## 🔴 AND A MUTE IS NEVER A CLINICAL SIGNAL
 *
 * Nothing reads this table to infer anything about a person. It is not a disengagement flag, it
 * does not reach a copilot, and it is not on any clinician's screen as a risk indicator. Somebody
 * turning off unprompted messages has told us about our messages, not about themselves.
 */
export const checkinMutes = pgTable(
  "checkin_mutes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    mutedAt: timestamp("muted_at", { withTimezone: true }).defaultNow().notNull(),
    /** Stamped if they turn it back on. The row stays, so the rate stays measurable. */
    unmutedAt: timestamp("unmuted_at", { withTimezone: true }),
    /**
     * How they did it, so a reply of "stop" and a switch on a screen are distinguishable.
     *
     * The first is somebody who had had enough; the second is somebody making a settings choice.
     * A mute rate that mixed them would hide the number that matters.
     */
    via: text("via").$type<"reply" | "screen">().notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /* One LIVE mute per person, as a partial unique index, so the history stays beside it. */
    uniqueIndex("checkin_mutes_live_unique").on(t.personId).where(sql`unmuted_at IS NULL`),
    index("checkin_mutes_muted_at_idx").on(t.mutedAt),
  ],
);

export type CheckinMute = typeof checkinMutes.$inferSelect;
