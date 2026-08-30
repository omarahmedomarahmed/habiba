-- Second-factor material for restricted administrative reads, and the
-- short-lived grant it produces.

CREATE TABLE IF NOT EXISTS "console_keys" (
  "slot" text PRIMARY KEY,
  "hash" text NOT NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "auth_sessions"
  ADD COLUMN IF NOT EXISTS "elevated_until" timestamptz;
