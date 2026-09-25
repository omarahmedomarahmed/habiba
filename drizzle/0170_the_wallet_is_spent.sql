-- 🔴 0170: THE PATIENT'S WALLET IS SPENT (founder rulings 7 and 7b).
--
-- `patient_credits` has held money a patient is owed since sprint 14, and
-- nothing ever spent it. A hold is the wallet's share of one session: taken at
-- booking after any company benefit, spent when the rest is paid (or at once
-- when the wallet covers it all), given back when the session is cancelled or
-- refunded. One per session, and which credits it drew on, so giving it back
-- returns exactly what was taken.
CREATE TABLE IF NOT EXISTS "wallet_holds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "cents" integer NOT NULL,
  "state" text DEFAULT 'held' NOT NULL,
  "draws" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "spent_at" timestamp with time zone,
  "returned_at" timestamp with time zone,
  CONSTRAINT "wallet_holds_positive" CHECK ("cents" > 0),
  CONSTRAINT "wallet_holds_state" CHECK ("state" IN ('held', 'spent', 'released', 'returned'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_holds_session_unique" ON "wallet_holds" ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_holds_person_idx" ON "wallet_holds" ("person_id", "state");
--> statement-breakpoint
-- A credit can never be spent past what it holds, whatever races for it.
ALTER TABLE "patient_credits" DROP CONSTRAINT IF EXISTS "patient_credits_within";
--> statement-breakpoint
ALTER TABLE "patient_credits" ADD CONSTRAINT "patient_credits_within"
  CHECK ("spent_cents" >= 0 AND "spent_cents" <= "amount_cents" AND "amount_cents" > 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "patient_credits" VALIDATE CONSTRAINT "patient_credits_within";
--> statement-breakpoint
-- 🔴 RULING 8: THE LANGUAGE A PERSON CHOSE, kept with them rather than only in a
-- browser cookie, so a new phone and every message we send use it. Null means
-- they never chose, and the reader's browser decides as before.
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "locale" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" text;
