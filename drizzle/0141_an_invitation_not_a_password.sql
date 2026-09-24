-- W2-A06: nobody types a customer's password. An account is invited by link.
--
-- The console created back office, company, clinic and partner accounts with a
-- password the operator typed in clear on a call, so the operator knew every
-- customer's first password and nothing made them change it. Now the account
-- is created with no usable password and its owner is emailed a link that
-- sets one, once.
--
-- One table for the four kinds of account, because they live in four tables
-- (`users`, `sponsor_users`, `clinic_managers`, `partner_users`) and a token
-- per table is four copies of the same rule. `account_id` therefore carries no
-- foreign key; `audience` says which table it names, and the CHECK keeps that
-- list closed. The token is stored hashed, like `auth_tokens`.
CREATE TABLE IF NOT EXISTS "account_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "audience" text NOT NULL,
  "account_id" uuid NOT NULL,
  "purpose" text DEFAULT 'invite' NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_links_hash_unique" ON "account_links" ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_links_account_idx" ON "account_links" ("audience", "account_id");
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "account_links"
    ADD CONSTRAINT "account_links_audience_known"
    CHECK ("audience" IN ('staff', 'sponsor', 'clinic', 'partner'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "account_links"
    ADD CONSTRAINT "account_links_purpose_known"
    CHECK ("purpose" IN ('invite', 'reset'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
