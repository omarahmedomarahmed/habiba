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
 * 24Therapy schema — 16 tables.
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

/** What is actually payable after any admin discount. */
export function payableCents(invoice: { amountCents: number; discountCents: number }): number {
  return Math.max(0, invoice.amountCents - invoice.discountCents);
}

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
      demo?: "session-room" | "note" | "none";
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
export type Notification = typeof notifications.$inferSelect;
