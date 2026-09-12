-- Sprint 21R — a patient who cannot get back in. C94 / 21R.4 / §3b.
--
-- 🔴 There was no patient password reset. Not a broken one — none. `auth_tokens`
-- hangs off `users`, the clinician table, and nothing let somebody who signed up
-- at /patient/signup back into their own record. It survived eight sprints
-- because every check we had asserted about therapists.
--
-- The code goes over WhatsApp, because most patients in this database have no
-- email address at all (§3b: the phone is the handle that is never missing).
-- `channel` records which door it left by, so "sent" and "sent somewhere they
-- read" stay different facts.
--
-- Additive: one new table, nothing backfilled, no existing row touched.

CREATE TABLE IF NOT EXISTS "patient_auth_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "patient_account_id" uuid NOT NULL REFERENCES "patient_accounts"("id") ON DELETE CASCADE,
  "purpose" text DEFAULT 'password_reset' NOT NULL,
  "token_hash" text NOT NULL,
  "channel" text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,

  -- A reset that never expires is a password that never changed.
  CONSTRAINT "patient_auth_tokens_expires" CHECK ("expires_at" > "created_at"),

  -- 🔴 The guess budget lives here rather than in the code that increments it.
  -- A six-digit code with unlimited attempts is a few hours of brute force, and
  -- a ceiling a future caller can forget is not a ceiling.
  CONSTRAINT "patient_auth_tokens_attempts_bounded"
    CHECK ("attempts" >= 0 AND "attempts" <= 5),

  CONSTRAINT "patient_auth_tokens_channel_known"
    CHECK ("channel" IN ('whatsapp', 'email')),

  CONSTRAINT "patient_auth_tokens_purpose_known"
    CHECK ("purpose" IN ('password_reset'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "patient_auth_tokens_hash_unique"
  ON "patient_auth_tokens" ("token_hash");

CREATE INDEX IF NOT EXISTS "patient_auth_tokens_account_idx"
  ON "patient_auth_tokens" ("patient_account_id", "used_at");
