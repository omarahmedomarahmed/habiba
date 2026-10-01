-- 0187: WHAT WAS AGREED AT SIGNUP, AND A RISK CHECK THAT FAILED. Additive.
--
-- Due diligence F3 and F11: a patient and a clinician now tick a required, layered
-- notice at signup that names who processes their data (OpenAI, Daily, Resend, Neon
-- and Vercel in the United States). The row keeps WHICH version of that notice was
-- accepted and WHEN, so a later rewrite of the notice cannot be read back onto
-- somebody who never saw it. A patient also confirms they are 18 or older, and the
-- instant they did is kept beside it.
--
-- Due diligence F13: a risk classifier whose answer could not be read used to look
-- exactly like "no findings". `sessions.risk_check_failed_at` is the explicit state the
-- clinician's session page shows instead. Null means the check ran or never applied.
--
-- Every column is nullable and nothing is backfilled: an account created before this
-- migration accepted nothing we can prove, and a null says exactly that. Safe to apply
-- before the deploy (H16): the running build neither reads nor writes any of them.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_version" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "patient_accounts" ADD COLUMN IF NOT EXISTS "terms_version" text;
--> statement-breakpoint
ALTER TABLE "patient_accounts" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "patient_accounts" ADD COLUMN IF NOT EXISTS "adult_confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "risk_check_failed_at" timestamp with time zone;
