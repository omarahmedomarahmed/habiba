-- 🔴 0167: THE BACK OFFICE PROVES IT TWICE.
--
-- Staff and owners approve payouts, confirm transfers and read records, and
-- until now a password was the whole of it. After the password a back office
-- session is PENDING until a second step passes: an authenticator app once
-- enrolled, or a code emailed to their address until then. The time it passed
-- is written on the session, and twelve hours later it is asked for again.

-- When this session passed its second step. Null for every clinician, and for
-- a back office session that has only given a password.
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "second_factor_at" timestamp with time zone;
--> statement-breakpoint

-- 🔴 One authenticator per person. The secret is SEALED (`lib/crypto/secretbox.ts`),
-- never stored as it is: it has to be used again to check a code, so it cannot
-- be hashed, and a table of plain TOTP secrets is every console login at once.
-- `confirmed_at` is null while an enrolment waits for its first code, and only
-- a confirmed row turns the email fallback off.
-- `last_step` is the last 30 second step a code was accepted for, so the same
-- code cannot be replayed inside its window.
CREATE TABLE IF NOT EXISTS "staff_second_factors" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "secret_sealed" text NOT NULL,
  "confirmed_at" timestamp with time zone,
  "last_step" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Ten per enrolment, shown once, stored as SHA-256. `used_at` is set by the one
-- UPDATE that redeems it, so two tabs cannot spend the same code.
CREATE TABLE IF NOT EXISTS "staff_recovery_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "staff_recovery_codes_hash_unique" ON "staff_recovery_codes" ("user_id", "code_hash");
--> statement-breakpoint

-- The fallback until an app is enrolled: six digits by email, for THIS session
-- only, for ten minutes, used once.
CREATE TABLE IF NOT EXISTS "staff_email_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "auth_sessions"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_email_codes_session_idx" ON "staff_email_codes" ("session_id");
