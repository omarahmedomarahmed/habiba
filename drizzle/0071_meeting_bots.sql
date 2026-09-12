-- Sprint 41 — meeting bots. The bot joins meetings we created, and nothing else.
--
-- 🔴 Additive. H16: nothing applies migrations on deploy, so this runs against
-- production before main moves.

-- 41.3 / C132 — a clinician's connected meeting account.
--
-- 🔴 What this table is NOT for. There is no calendar column, no calendar
-- scope stored, and no place to put one. 41.1 is that the bot joins meetings
-- 24Therapy created for a session and never anything else, and a tool that
-- watches a calendar eventually records a supervision call or a conversation
-- with an accountant. The person whose words those are never agreed to
-- anything.
--
-- 🔴 There is also no column a therapist could be shown or asked to paste.
-- 41.3 and §7: a therapist holding an API key is a therapist who got lost in
-- our product. The whole row is written by an OAuth callback.
CREATE TABLE IF NOT EXISTS "meeting_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "provider" text NOT NULL,

  -- 🔴 Sealed with AES-256-GCM, never hashed, because a refresh token has to
  -- be USED again. See lib/crypto/secretbox.ts, the only reversible primitive
  -- in this codebase, which exists for these two columns and fails closed with
  -- no key configured rather than storing plaintext.
  "access_token_sealed" text NOT NULL,
  "refresh_token_sealed" text,
  "expires_at" timestamp with time zone,

  -- Shown so a clinician with two Zoom accounts can see which one this is,
  -- which is the most common support question any integration produces.
  "external_account_label" text,

  "connected_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Disconnection is a STAMP. A session recorded through a connection that has
  -- since been removed still has to be explainable a year later; the sealed
  -- tokens are cleared on revoke, so the row keeps the fact without the
  -- credential.
  "revoked_at" timestamp with time zone,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One LIVE connection per clinician per provider, with the history beside it.
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_connections_live_unique"
  ON "meeting_connections" ("user_id", "provider")
  WHERE "revoked_at" IS NULL;

CREATE INDEX IF NOT EXISTS "meeting_connections_org_idx"
  ON "meeting_connections" ("organization_id");

-- 🔴 The provider is one of three, enforced here rather than in a service.
ALTER TABLE "meeting_connections"
  DROP CONSTRAINT IF EXISTS "meeting_connections_provider";

ALTER TABLE "meeting_connections"
  ADD CONSTRAINT "meeting_connections_provider"
  CHECK ("provider" IN ('zoom', 'google_meet', 'teams')) NOT VALID;

ALTER TABLE "meeting_connections" VALIDATE CONSTRAINT "meeting_connections_provider";

-- 🔴 A revoked connection holds no credential.
--
-- Clearing the tokens is the service's job on the way out, and this is what
-- makes it true for every path including the next one somebody writes. A row
-- that says "revoked" and still carries a usable refresh token is worse than
-- one that was never revoked, because everybody reading it believes otherwise.
ALTER TABLE "meeting_connections"
  DROP CONSTRAINT IF EXISTS "meeting_connections_revoked_is_empty";

ALTER TABLE "meeting_connections"
  ADD CONSTRAINT "meeting_connections_revoked_is_empty"
  CHECK (
    "revoked_at" IS NULL
    OR ("access_token_sealed" = '' AND "refresh_token_sealed" IS NULL)
  ) NOT VALID;

ALTER TABLE "meeting_connections" VALIDATE CONSTRAINT "meeting_connections_revoked_is_empty";

-- 41.7 — the bot, on the source it belongs to.
ALTER TABLE "session_sources" ADD COLUMN IF NOT EXISTS "bot_id" text;
ALTER TABLE "session_sources" ADD COLUMN IF NOT EXISTS "bot_dispatched_at" timestamp with time zone;
ALTER TABLE "session_sources" ADD COLUMN IF NOT EXISTS "bot_status" text;
ALTER TABLE "session_sources" ADD COLUMN IF NOT EXISTS "bot_left_at" timestamp with time zone;

-- 🔴 41.7 — "bot reconnects without duplicating", made impossible rather than
-- remembered.
--
-- A network blip between us and the provider means our dispatch call may have
-- succeeded while its response was lost, so a retry is the ordinary case. A
-- second bot in a therapy session is not a duplicate row to tidy up: it is a
-- second recorder in the room, and the patient consented to one.
CREATE UNIQUE INDEX IF NOT EXISTS "session_sources_bot_unique"
  ON "session_sources" ("bot_id");

-- 🔴 41.1 / C132 — A BOT ONLY EXISTS FOR A MEETING WE CREATED.
--
-- The whole sprint in one constraint. `provisioned_at` and
-- `provisioned_by_user_id` are already required for an external kind (0064,
-- C175, C215), which is what makes a pasted link structurally impossible. This
-- adds the other half: a bot cannot be attached to a source that was not
-- provisioned by us.
--
-- So there is no path, through any service, any future call site or any admin
-- tool, that sends a bot into a meeting 24Therapy did not make for a session.
-- A rule that reaches this far has to be in the database, because every
-- service-layer version of it survives only until the next person writes a
-- second writer.
ALTER TABLE "session_sources"
  DROP CONSTRAINT IF EXISTS "session_sources_bot_only_if_ours";

ALTER TABLE "session_sources"
  ADD CONSTRAINT "session_sources_bot_only_if_ours"
  CHECK (
    "bot_id" IS NULL
    OR ("provisioned_at" IS NOT NULL AND "provisioned_by_user_id" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "session_sources" VALIDATE CONSTRAINT "session_sources_bot_only_if_ours";
