CREATE TABLE IF NOT EXISTS "history_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"therapist_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"shape" text,
	"request_note" text,
	"requested_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "history_grants" ADD CONSTRAINT "history_grants_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "history_grants" ADD CONSTRAINT "history_grants_therapist_fk" FOREIGN KEY ("therapist_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "history_grants" ADD CONSTRAINT "history_grants_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- One live row per (person, therapist). Partial, so a rejected or revoked row
-- never blocks a later request, while a second pending request cannot exist.
CREATE UNIQUE INDEX IF NOT EXISTS "history_grants_live_unique" ON "history_grants" USING btree ("person_id","therapist_user_id") WHERE "status" IN ('pending', 'granted');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_grants_person_idx" ON "history_grants" USING btree ("person_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_grants_therapist_idx" ON "history_grants" USING btree ("therapist_user_id","status");--> statement-breakpoint

-- 7.6: a patient granting, rejecting or revoking is an actor in the audit log,
-- and their id points at a different table from a clinician's.
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "actor_account_id" uuid;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_account_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- 7.8: the two controls, and when the microphone actually started.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "recording_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "profile_share_consent" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "profile_share_consent_at" timestamp with time zone;--> statement-breakpoint

/*
 * `recording_started_at` is deliberately NOT backfilled from `started_at`.
 *
 * For every existing session we do not know when the microphone began — only
 * that the session ran. Filling it with `started_at` would assert "recorded
 * from the beginning" for sessions where that may be false, and the whole
 * reason the column exists is to stop a note claiming a completeness it does
 * not have. Null here means unknown, which is the honest value, and the note
 * stamp only fires when there is a real timestamp to stamp.
 */
