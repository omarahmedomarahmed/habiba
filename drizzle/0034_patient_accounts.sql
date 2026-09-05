CREATE TABLE IF NOT EXISTS "patient_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone" text,
	"phone_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patient_auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"patient_account_id" uuid NOT NULL,
	"route" text DEFAULT 'match' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token_hash" text,
	"channel" text,
	"expires_at" timestamp with time zone,
	"therapist_keeps_access" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"issued_by_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_account_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "patient_accounts" ADD CONSTRAINT "patient_accounts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
 ALTER TABLE "patient_auth_sessions" ADD CONSTRAINT "patient_auth_sessions_account_fk" FOREIGN KEY ("patient_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "person_claims" ADD CONSTRAINT "person_claims_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "person_claims" ADD CONSTRAINT "person_claims_account_fk" FOREIGN KEY ("patient_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "person_invites" ADD CONSTRAINT "person_invites_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "person_invites" ADD CONSTRAINT "person_invites_issuer_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "person_invites" ADD CONSTRAINT "person_invites_used_by_fk" FOREIGN KEY ("used_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "patient_accounts_email_unique" ON "patient_accounts" USING btree ("email") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "patient_accounts_person_unique" ON "patient_accounts" USING btree ("person_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "patient_auth_sessions_token_hash_unique" ON "patient_auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patient_auth_sessions_account_idx" ON "patient_auth_sessions" USING btree ("patient_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_claims_person_idx" ON "person_claims" USING btree ("person_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_claims_account_idx" ON "person_claims" USING btree ("patient_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_claims_open_unique" ON "person_claims" USING btree ("person_id","patient_account_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_invites_token_hash_unique" ON "person_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_invites_person_idx" ON "person_invites" USING btree ("person_id");--> statement-breakpoint

/*
 * `people.claimed_by_user_id` pointed at `users`, which was wrong the moment
 * patients got their own identity table. Nothing has claimed anything yet
 * (0 rows), so this is a rename-and-repoint rather than a data migration.
 */
ALTER TABLE "people" DROP CONSTRAINT IF EXISTS "people_claimed_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "people" RENAME COLUMN "claimed_by_user_id" TO "claimed_by_account_id";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "people" ADD CONSTRAINT "people_claimed_by_account_fk" FOREIGN KEY ("claimed_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
