-- W2-C04 and W2-C05: a clinic manager sets their own password, by link.
--
-- A clinic admin added staff by typing the new person's password into a form
-- and passing it on out of band, and no clinic manager or staff member had any
-- way to reset a forgotten one. Both now go through a single-use link: an
-- invitation (a staff row created with no password, which cannot sign in
-- until the link is used) or a reset (asked for by email at /clinic/forgot-password).
--
-- The clinician's `auth_tokens` hangs off `users`, and the patient's off
-- `patient_accounts`, so the clinic principal gets its own table beside its own
-- sessions (C264: separate principal, separate cookie, separate tokens). Only
-- the SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS "clinic_auth_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_manager_id" uuid NOT NULL,
  "purpose" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "clinic_auth_tokens"
    ADD CONSTRAINT "clinic_auth_tokens_clinic_manager_id_fk"
    FOREIGN KEY ("clinic_manager_id") REFERENCES "clinic_managers"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "clinic_auth_tokens"
    ADD CONSTRAINT "clinic_auth_tokens_purpose"
    CHECK ("purpose" IN ('invite', 'password_reset'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clinic_auth_tokens_hash_unique"
  ON "clinic_auth_tokens" ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_auth_tokens_manager_idx"
  ON "clinic_auth_tokens" ("clinic_manager_id", "used_at");
